/* Eval Villain just jams this rewriter function into the loading page, with
 * some JSON as CONFIG. Normally Firefox does this for you from the
 * background.js file. But you could always copy paste this code anywhere you
 * want. Such as into a proxie'd response or electron instramentation.
 */
const rewriter = function(CONFIG) {
	// the rewriter could be injected anywhere, which makes lineNumber come out
	// wrong in errors. LINESTART is used to correct it.
	const LINESTART = new Error().lineNumber + 1;

	/**
	 * Consistent error formats
	 */
	function logErr(err, title) {
		const fmt = CONFIG.formats.interesting;
		const lineno = err.lineNumber + LINESTART;
		if (title) {
			zebraLog([`[EV ERROR] from: ${location.href} ${title} err:`, err, ` rewriter.js:${lineno}`], fmt);
		} else {
			zebraLog([`[EV ERROR] from: ${location.href} err:`, err, ` rewriter.js:${lineno}`], fmt);
		}
	}

	/**
	 * Helper function, choses console.group vs console.groupCollapsed by bool
	 */
	function logGroup(format, ...args) {
		const title = args[0];
		if (format.open) {
			real.logGroup(...args);
		} else {
			real.logGroupCollapsed(...args);
		}
		return args[0];
	}

	// handled this way to preserve encoding...
	function getAllQueryParams(search) {
		return search.substr(search[0] == '?'? 1: 0)
			.split("&").map(x => x.split(/=(.*)/s));
	}

	class SourceFifo {
		constructor(limit) {
			this.limit = limit;
			this.fifo = [];
			this.set = new Set();
			this.removed = 0;
		}

		nq(sObj) {
			this.set.add(sObj.search);
			this.fifo.push(sObj);
			while (this.set.size > this.limit) {
				this.removed++;
				this.dq();
			}
			return this.removed;
		}

		dq() {
			const last = this.fifo.shift();
			this.set.delete(last.search);
			return last;
		}

		has(x) {
			return this.set.has(x);
		}

		*genAllMatches(str) {
			for (const sObj of this.fifo) {
				if (str.includes(sObj.search)) {
					yield sObj;
				}
			}
		}
	}

	const srcRefresher = {
		"query": function() {
			if (ALLSOURCES.query) {
				const srch = window.location.search;
				if (srch.length > 1) {
					for (const [key, value] of getAllQueryParams(srch)) {
						addToFifo({
							param: key,
							search: value
						}, "query");
					}
				}
			}
		},
		"fragment": function() {
			if (ALLSOURCES.fragment) {
				addToFifo({
					search: location.hash.substring(1),
				}, "fragment");
			}
		},
		"winname": function() {
			if (ALLSOURCES.winname) {
				addToFifo({
					display: "window.name",
					search: window.name,
				}, "winname");
			}
		},
		"path": function() {
			if (ALLSOURCES.path) {
				const pth = location.pathname;
				if (pth.length >= 1) {
					addToFifo({search: pth}, "path");
					pth.substring(1)
						.split('/').forEach((elm, index) => {
							addToFifo({
								param: ""+index,
								search: elm
							}, "path");
					});
				}
			}
		},
		"referer": function() {
			if (ALLSOURCES.referrer && document.referrer) {
				let url;
				try {
					url = new URL(document.referrer);
				} catch(_err) {
					return;
				};

				// TODO update this
				if (url.search != location.search || url.search && url.pathname !== "/" && url.hostname !== location.hostname) {
					addToFifo({search: document.referrer }, "referer");
				}
			}
		},
		"localStore": function() {
			const l = real.localStorage.length;
			for (let i=0; i<l; i++) {
				const key = real.localStorage.key(i);
				addToFifo({
					display: "localStorage",
					param: key,
					search: real.localStorage.getItem(key),
				}, "localStore");
			}
		},
		"cookie": function() {
			for (const i of document.cookie.split(/;\s*/)) {
				const s = i.split("=");
				if (s.length >= 2) {
					addToFifo({
						param: s[0],
						search: s[1],
					}, "cookie");
				} else {
					addToFifo({
						search: s[0],
					}, "cookie");
				}
			}
		},
		"userSource": function() {
			const srcer = CONFIG.sourcer;
			if (!srcer) {
				throw `Can't use user source without a name!!!`;
			}
			window[srcer] = (src_name, src_val, debug=false) => {
				// ex: evSourcer("Response from fetch", resp.json(), true)
				// debug=true results in a console.debug for each source injested
				if (debug) {
					const o = typeof(src_val) === 'string'? src_val: real.JSON.stringify(src_val);
					real.debug(`[EV] ${srcer}[${src_name}] from ${document.location.origin}  added:\n ${o}`);
				}
				addToFifo({
					display: `${srcer}[${src_name}]`,
					search: src_val,
					}, "userSource");
				return false;
			}
			delete CONFIG.sourcer;
		}
	};

	function initSource(nm) {
		// returns source if it exists, otherwise populates it.
		if (!ALLSOURCES[nm]) {
			// create fifo for holding sources
			ALLSOURCES[nm] = new SourceFifo(CONFIG.limits[nm]);

			// init contents
			const func = srcRefresher[nm];
			if (typeof(func) != "function") {
				throw `Source builder for ${nm} not found`;
			}
			func();
		}
		return ALLSOURCES[nm];
	}

	/** hold all interest fifos */
	const ALLSOURCES = {}; // Used to hold all interest Fifo's

	function strSpliter(str, needle) {
		const ret = [];
		str.split(needle).forEach((x, index, arr)=> {
			ret.push(x)
			if (index != arr.length-1) {
				ret.push(needle)
			}
		});
		return ret;
	}

	function regexSpliter(str, needle) {
		const ret = [];
		if (needle.global == false) {
			// not global regex, so just split into two on first
			needle.lastIndex = 0;
			const m = needle.exec(str)[0];
			const l = str.split(m);
			ret.push(l[0], m, l[1]);
		} else {
			let holder = str;
			let match = null;
			needle.lastIndex = 0;
			let prevLast = 0;

			while ((match = needle.exec(str)) != null) {
				const m = match[0];
				ret.push(holder.substr(0, holder.indexOf(m)));
				ret.push(m);
				holder = holder.substr(holder.indexOf(m)+m.length);
				if (prevLast >= needle.lastIndex) {
					real.warn("[EV] Attempting to highlight matches for this regex will cause infinite loop, stopping")
					break;
				}
				prevLast = needle.lastIndex;
			}
			ret.push(holder);
		}
		return ret;
	}

	/** Contains regex/str searches for needles/blacklists **/
	class NeedleBundle {

		/**
		 * Hold user defined needles, string/regex, to search sinks for.
		 * @param {string[]} needleList Array of needles, as strings
		 * @example
		 * // Needle bundle for substring `asdf` and regex `/asdf/gi`
		 * const x = new NeedleBundle(["asdf", "/asdf/gi"]);
		 **/
		constructor(needleList) {
			if (needleList === undefined) {
				needleList = [];
			}
			if (!Array.isArray(needleList)) {
				throw `Needle bundle only accepts arrays, recieved ${typeof(needleList)}: "${needleList}"`;
			}
			this.needles = [];
			this.regNeedle = [];
			const test = /^\/(.*)\/([gim]{0,3})$/;
			for (const need of needleList) {
				const s = test.exec(need);
				if (s) {
					const flags = s[2] === undefined? "": s[2]
					const reg = new RegExp(s[1], flags);
					this.regNeedle.push(reg);
				} else {
					this.needles.push(need);
				}
			}
		}

		*genStrMatches(str) {
			for (const need of this.needles) {
				if (str.includes(need)) {
					yield need;
				}
			}
		}

		*genRegMatches(str) {
			for (const need of this.regNeedle) {
				need.lastIndex = 0; // just to be sure there is no funny buisness
				if (need.test(str)) {
					need.lastIndex = 0; // This line is important b/c JS regex holds a state secretly :(
					yield need;
				}
			}
		}

		*genMatches(str) {
			for (const match of this.genStrMatches(str)) {
				yield match;
			}
			for (const match of this.genRegMatches(str)) {
				yield match;
			}
		}

		matchAny(str) {
			for (const match of this.genMatches(str)) {
				if (match) {
					return true;
				}
			}
			return false;
		}
	}

	/** All rules for a single argument that might make that sink call interesting */
	class SinkArgConf {
		fifoBank = {};
		needles = null;
		parseRules = null;

		/**
		 * Contains qualifications for sink to be considered interesting
		 * @param {NeedleBundle}	needles Needles ie user provided string/regex
		 * @param {object}	fifoBank Maps source name to `SourceFifo`
		 **/
		constructor(argConf) {
			this.needles = argConf.needles === "global"
				? NEEDLES
				: new NeedleBundle(argConf.needles);

			if (Array.isArray(argConf.argBlacklist)) {
				this.argBlacklist = new NeedleBundle(argConf.argBlacklist);
			}

			const srcs = argConf?.sources === "global"
				? SOURCES
				: argConf.sources;
			srcs?.forEach(src => this.fifoBank[src] = initSource(src));

			if (!argConf.types || !Array.isArray(argConf.types)) {
				throw `[EV] missing types in sink config`;
			}
			this.types = new Set(argConf.types);

			this.format = CONFIG.formats.args;
			if (argConf.format) {
				this.format = Object.assign({}, this.format);
				Object.assign(this.format, argConf.format);
			}

			if (argConf.parseAsConf && argConf.constructor === Object) {
				const {parseAs, keys} = argConf.parseAsConf;
				if (!(parseAs && keys && Array.isArray(keys) && typeof(parseAs) === 'string')) {
					real.log(`[EV] invalid parseAs ${argConf.parseAs}`);
					return;
				}

				if (parseAs === 'URL') {
					this.parseAs = function* (str) {
						const url = new URL(str, location.href);
						for (const key of keys) {
							yield [`${parseAs}:${key}`, url[key]];
						}
					}
				} else {
					real.log(`[EV] unkown parseAs ${parseAs}`);
				}
			}
		}

		/**
		 * Is this argument worth processing?
		 */
		allowedType(t) {
			return this.types.has(t);
		}

		*genSplits(argObj) {
			const {str, type} = argObj;
			if (!this.allowedType(type)) {
				return;
			}

			if (this.needles?.genStrMatches) {
				for (const match of this.needles.genStrMatches(str)) {
					yield {
						name: "needle", decode:"",
						search: match,
						split: strSpliter(str, match)
					};
				}
			}

			if (this.needles?.genRegMatches) {
				for (const match of this.needles.genRegMatches(str)) {
					yield {
						name: "needle", decode:"",
						search: match,
						split: regexSpliter(str, match)
					};
				}
			}

			for (const [key, fifo] of Object.entries(this.fifoBank)) {
				for (const match of fifo.genAllMatches(str)) {
					yield {
						name: key,
						split: strSpliter(str, match.search),
						...match,
					};
				}
			}
		}
	}

	/**
	 * Contains all rules to decide if a sink call should be considered interesting
	 */
	class SinkConf {
		perArgRules = {};
		requiredArgs = new Set();

		constructor(conf) {
			for (const [argName, argConf] of Object.entries(conf.args)) {
				const rule = new SinkArgConf(argConf);
				this.perArgRules[argName] = rule;
				if (argConf.requiredArg) {
					this.requiredArgs.add(argName);
				}
			}

			const {onPreInterest, onPostInterest} = conf;
			if (onPreInterest) {
				try {
					this.onPreInterest = new Function("argObj", "real", onPreInterest);
				} catch(err) {
					logErr(err, "Failed to create onPreInterest");
				}
			}
			if (onPostInterest) {
				try {
					this.onPostInterest = new Function("interest", "argObj", "real", onPostInterest);
				} catch(err) {
					logErr(err, "Failed to create onPostInterest");
				}
			}
		}

		getArgRule(argKey) {
			return this.perArgRules[argKey] ?? this.perArgRules.all;
		}

		hasRequiredArgs(argObj) {
			if (this.requiredArgs.size <= 0) {
				return true;
			}

			const s = new Set(argObj.args.filter(x => !x.blacklisted).map(x => "" + x.key));
			if (argObj.this) {
				s.add("this");
			}
			return this.requiredArgs.difference(s).size == 0;
		}

		*interestIterator(argObj) {
			for (const arg of argObj.args) {
				const rules = this.getArgRule(arg.key);
				if (rules) {
					for (const ret of rules.genSplits(arg)) {
						yield [ret, arg];
					}
				}
			}
		}

		/**
		* Grab only arguments that are relevent to testing
		*
		* @args {Object} args `arugments` object of hooked function
		*/
		getArgs(args, thisArg) {
			const retArgs = [];

			const argToArgObj = (key, arg, display) => {
				const rule = this.getArgRule(key);
				const t = typeof(arg);
				if (!rule?.allowedType(t)) {
					return undefined;
				}

				let s = arg;
				let cname = "";
				if (t !== "string") {
					if (t === "object") {
						try {
							s = real.JSON.stringify(s);
						} catch(err) { // cyclic objects
							logErr(err, "Failed to stringify argument");
						}
						cname = arg?.constructor.name ?? t;
					} else {
						s = s.toString();
					}
				}

				const ar = {
					"type": t,
					"key": key,
					"display": display,
					"str": s,
					"cname": cname,
				}
				if (t !== "string") {
					ar["orig"] = arg;
				}
				return ar;
			}

			if (typeof(arguments[Symbol.iterator]) !== "function") {
				throw "Aguments can't be iterated over."
			}

			const argLen = args.length;
			for (const i in args) {
				if (!args.hasOwnProperty(i)) {
					continue;
				}
				const key = +i;
				const idisplay = `${key + 1}/${argLen}`;
				const arg = argToArgObj(key, args[i], `[${idisplay}]`);

				if (arg) {
					retArgs.push(arg);

					const {parseAs, argBlacklist} = this.getArgRule(key);

					// don't add to args if it's blacklisted
					if (argBlacklist?.matchAny(arg.str)) {
						arg.blacklisted = true;
					}

					// Process sub arguments, if they exist.
					if (typeof(parseAs) === "function") {
						try {
							for (const [subKey, value] of parseAs(args[i])) {
								const objKey = `${key}|${subKey}`;
								const display = `[${idisplay}][${subKey}]`;
								const subArg = argToArgObj(objKey, value, display);
								if (subArg) {
									retArgs.push(subArg);
								}
							}
						} catch(err) {
							logErr(err, "parseAs failed");
						}
					}
				}
			}

			const ret = {
				"args" : retArgs,
				"len" : args.length // len of ret != len of args, if we threw some away
			} // TODO len may no longer be needed, now that each arg has a display?

			if (thisArg && thisArg !== window) {
				const thisKey = "this";
				const a = argToArgObj(thisKey, thisArg, "[this]");
				if (a) { // TODO can I put this in ret.args?
					ret[thisKey] = a;
				}
			}

			return ret;
		}

		runPreInterest(argObj) {
			if (this.onPreInterest) {
				try {
					return this.onPreInterest(argObj, real);
				} catch(err) {
					const fmts = CONFIG.formats.interesting;
					real.log("%c[ERROR]%c onPreInterest: %c%s%c on %c%s%c rewriter.js:%s",
						fmts.default, fmts.highlight, fmts.default, err,
						fmts.highlight, fmts.default, document.location.href,
						fmts.highlight, err.lineNumber - LINESTART
					);
					real.dir(err);
					real.log(this.onPreInterest);
				}
			}
			return true;
		}

		runPostInterest(interest, argObj) {
			if (this.onPostInterest) {
				try {
					return this.onPostInterest(interest, argObj, real);
				} catch(err) {
					const fmts = CONFIG.formats.interesting;
					real.log("%c[ERROR]%c.onPostInterest: %c%s%c on %c%s%c rewriter.js:%s",
						fmts.default, fmts.highlight, fmts.default, err,
						fmts.highlight, fmts.default, document.location.href,
						fmts.highlight, err.lineNumber - LINESTART
					);
					real.dir(err);
					real.log(this.onPreInterest);
				}
			}
			return true;
		}

		/**
		* Print all the arguments to the hooked funciton
		*
		* @argObj {Array} args array of arguments
		* @argObj {thisArg} the `this` of a method call/setter
		**/
		printArgs(argObj) {
			const getArgPrinter = (arg, output) => {
				const {type, display, key} = arg;
				const fmt = this.getArgRule(key).format;

				if (!fmt.use) return;
				const cname = arg.cname
					? ` constructor:${arg.cname}`
					: "";

				const end = logGroup(fmt, "%carg%s type:%s%s", fmt.default, display, type, cname);
				if (output) {
					if (typeof(output) === "string") {
						real.log("%c%s", fmt.highlight, output);
					} else {
						real.log(output);
					}
				} else {
					real.log("%c%s", fmt.highlight, arg.str);
					if (arg.orig !== undefined) {
						real.log(arg.orig);
					}
				}
				real.logGroupEnd(end);
			}

			if (argObj.this) {
				const arg = argObj.this;
				// this pargument parsing is not quite right still...
				getArgPrinter(arg, arg.orig);
			}

			argObj.args.forEach(x => getArgPrinter(x));
		}

		getInterest(argObj) {
			// update changing lists
			["query", "fragment", "winname", "path"]
				.forEach(nm => srcRefresher[nm]());

			this.runPreInterest(argObj);
			if (!this.hasRequiredArgs(argObj)) {
				return [];
			}
			const interest = Array.from(this.interestIterator(argObj));
			this.runPostInterest(interest);
			return interest;
		}

	};

	let rotateWarnAt = 8;
	/**
	 * Recursivly decode source object and add it to selected fifo.
	 * NOTE: needs to be available to evSourcer sink
	 */
	function addToFifo(sObj, fifoName) { // TODO: add blacklist arg
		const fifo = ALLSOURCES[fifoName];
		if (!fifo) {
			throw `No ${fifoName}`;
		}
		for (const [search, decode] of deepDecode(sObj.search)) {
			const throwaway = fifo.nq({...sObj, search: search, decode: decode});

			if (throwaway % rotateWarnAt == 1) {
				rotateWarnAt *= 2;
				const intCol = CONFIG.formats.interesting;
				real.log(`%c[EV INFO]%c '${CONFIG.formats[fifoName].pretty}' fifo limit (${fifo.limit}) exceeded. EV has rotated out ${throwaway} items so far. From url: %c${location.href}`,
					intCol.highlight, intCol.default, intCol.highlight
				);
			}
		}

		function prettyJson(s, tabs) {
			return real.replaceAll(
				real.JSON.stringify(s, null, 2),
				'\n', '\n' + '\t'.repeat(tabs));
		}

		function *deepDecode(s) {
			// TODO: Sets...
			if (typeof(s) === 'string') {
				yield *decodeAll(s);
			} else if (typeof(s) === "object") {
				const fwd = `\t{\n\t\tlet _ = ${prettyJson(s, 2)};\n\t\t_`;
				yield *decodeAny(s, `\t\tx = _\n\t}\n`, fwd);
			}
		}

		function isNeedleBad(str) {
			if (typeof(str) !== "string" || str.length == 0 || fifo.has(str)) {
				return true;
			}
			return BLACKLIST.matchAny(str);
		}


		function *decodeAny(any, decoded, fwd) {
			if (Array.isArray(any)) {
				yield *decodeArray(any, decoded, fwd);
			} else if (typeof(any) == "object"){
				yield *decodeObject(any, decoded, fwd);
			} else {
				yield *decodeAll(any, fwd + "= x;\n" + decoded);
			}
		}

		function *decodeArray(a, decoded, fwd) {
			for (const i in a) {
				yield *decodeAny(a[i], decoded, fwd+`[${i}]`);
			}
		}

		function* decodeObject(o, decoded, fwd) {
			for (const prop in o) {
				yield *decodeAny(o[prop], decoded, fwd+`[${real.JSON.stringify(prop)}]`);
			}
		}

		/**
		* Generate all possible decodings for string
		* @s {string}	args array of arguments
		* @decoded {string} string representing deocoding method
		*
		**/
		function *decodeAll(s, decoded="") {
			if (isNeedleBad (s)) {
				return;
			}
			yield [s, decoded];

			// JSON
			try {
				const dec = real.JSON.parse(s);
				if (dec) {
					const fwd = `\t{\n\t\tlet _ = ${prettyJson(dec, 2)};\n\t\t_`;
					yield *decodeAny(dec, `\t\tx = JSON.stringify(_);\n\t}\n${decoded}`, fwd);
					return;
				}
			} catch (_) {/**/}

			// URL decoder
			let url = null;
			try {
				url = new URL(s); // need to call URL, if it's not a URL you hit catch
				// This caused a lot of spam, so removing for now
				// if (url.hostname != location.hostname) {
				// 	const dec = ``
				// 		+ `\t{\n`
				// 		+ `\t\tconst _ = new URL("${real.replaceAll(s, '"', "%22")}");\n`
				// 		+ `\t\t_.hostname = x;\n`
				// 		+ `\t\tx = _.href;\n`
				// 		+ `\t}\n`
				// 		+ decoded;
				// 	yield *decodeAll(url.hostname, dec);
				// }

				// query string of URL
				for (const [key, value] of getAllQueryParams(url.search)) {
					const dec = ``
						+ `\t{\n`
						+ `\t\tconst _ = new URL("${real.replaceAll(s, '"', "%22")}");\n`
						+ `\t\t_.searchParams.set('${real.replaceAll(key, '"', '\x22')}', decodeURIComponent(x));\n`
						+ `\t\tx = _.href;\n`
						+ `\t}\n`
					+ decoded;
					yield *decodeAll(value, dec);
				}
				if (url.hash.length > 1) {
					const dec = ``
						+ `\t{\n`
						+ `\t\tconst _ = new URL("${real.replaceAll(s, '"', "%22")}");\n`
						+ `\t\t_.hash = x;\n`
						+ `\t\tx = _.href;\n`
						+ `\t}\n`
					+ decoded;
					yield *decodeAll(url.hash.substring(1), dec);
				}
			} catch (err) {
				if (url) {
					real.error("Got error during decoding: %s", JSON.stringify(err.name));
				}
			}

			// atob
			try {
				const dec = real.atob.call(window, s);
				if (dec) {
					yield *decodeAll(dec, `\tx = btoa(x);\n${decoded}`);
					return;
				}
			} catch (_) {/**/}

			// string replace
			const dec = real.replaceAll(s, "+", " ");
			if (dec !== s) {
				yield *decodeAll(dec, `\tx = real.replaceAll(x, "+", " ");\n${decoded}`);
			}

			if (!s.includes("%")) {
				return;
			}

			// match all of them
			try {
				const dec = real.decodeURIComponent(s);
				if (dec && dec != s) {
					yield *decodeAll(dec, `\tx = encodeURIComponent(x);\n${decoded}`);
				}
			} catch(_){/**/}

			// match all of them
			try {
				const dec = real.decodeURI(s);
				if (dec && dec != s) {
					yield *decodeAll(dec, `\tx = encodeURIComponent(x);\n${decoded}`);
				}
			} catch(_){/**/}
		}
	}

	/**
	* Returns the type of an argument. Returns null if the argument should be
	* skipped.
	* @arg Argument to have it's type checked
	* @arg Array of types that are acceptable.
	*/
	function typeCheck(arg, argTypes) {

		// sanity
		const knownType = ["function", "string", "number", "object",
			"undefined", "boolean", "symbol" ].includes(t);
		if (!knownType) {
			throw `Unexpect argument type ${t} for ${arg}`;
		}

		// configured to not check
		if (!argTypes.includes(t)) {
			return null;
		}

		return t;
	}

	function printTitle(name, format, num) {
		if (num > 1) {
			return logGroup(format, "%c[EV] %c%s[%d]%c %s",
				format.default, format.highlight, name, num, format.default, location.href);
		}
		return logGroup(format,  "%c[EV] %c%s%c %s",
			format.default, format.highlight, name, format.default, location.href);
	}

	function zebraBuild(arr, fmts) { // fmt2 is used via arguments
		const fmt = "%c%s".repeat(arr.length);
		const args = [];
		for (let i=0; i<arr.length; i++) {
			args.push(fmts[i % 2]);
			args.push(arr[i]);
		}
		args.unshift(fmt);
		return args;
	}

	function zebraLog(arr, fmt) {
		real.log(...zebraBuild(arr, [fmt.default, fmt.highlight]));
	}

	function zebraGroup(arr, fmt) {
		const a = zebraBuild(arr, [fmt.default, fmt.highlight]);
		return logGroup(fmt, ...a);
	}

	/**
	 * Builds a printer for an interesring argument
	 */
	function printInterest(match, arg) {
		const fmt = CONFIG.formats[match.name];
		const display = match.display? match.display: match.name;
		let word = match.search;
		let dots = "";
		if (word.length > 80) {
			dots = "..."
			word = match.search.substr(0, 77);
		}
		const title = [
			match.param? `${display}[${match.param}]: ` :`${display}: `, word
		];
		title.push(`${dots} found (arg:`, arg.display, ")");
		if (match.decode) {
			title.push(" [Decoded]");
		}

		const end = zebraGroup(title, fmt);
		if (dots) {
			const d = "Entire needle:"
			real.logGroupCollapsed(d);
			real.log(match.search);
			real.logGroupEnd(d);
		}
		if (match.decode) { // TODO probably should be moved to the recursve decoder area
			const d = "Encoder function:";
			real.logGroupCollapsed(d);
			let add = "\t";
			let pmtwo = false;
			switch (match.name) { // TODO: this should be moved to interestBundle, I think
			case "path":
				if (!match.param) break;
				add += `if (y) {\n\t\t`
				add += `const pth = document.location.pathname.substring(1).split('/');\n\t\t`;
				add += `pth[${match.param}] = x;\n\t\t`;
				add += `document.location.pathname = '/' + pth.join('/');\n\t`;
				add += `}\n\t`
				pmtwo = true;
				break;
			case "localStore":
				if (!match.param) break;
				add += `if (y) localStorage.setItem("${match.param}", x);\n\t`;
				pmtwo = true;
				break;
			case "query":
				if (!match.param) break;
				add +=  `const _ = new URL(window.location.href);\n\t`
				add += `// next line might need some changes\n\t`;
				add += `_.searchParams.set('${real.replaceAll(match.param, '"', '\x22')}', decodeURIComponent(x));\n\t`;
				add += `x = _.href;\n\t`;
				add += `if (y) window.location = x;\n\t`
				pmtwo = true;
				break;
			case "winname":
				add +=  `if (y) window.name = x;\n\t`
				pmtwo = true;
				break;
			}

			real.log(`encoder = ${pmtwo ? "(x, y)" : "x"} => {\n${match.decode}${add}return x;\n}//`);
			real.logGroupEnd(d);
		}
		zebraLog(match.split, fmt);
		real.logGroupEnd(end);
	}

	/**
	* Parse all arguments for function `name` and pretty print them in the console
	* @param {SinkConf}	conf obj representing interest rules per arg.
	* @param {object}	args The `arguments` passed to the original sink.
	* @param {any}	thisArg the `this` passed to original sink, if it exists.
	* @returns {boolean} Always returns `false`
	**/
	function EvalVillainHook(conf, args, thisArg) {
		const sinkConf = conf.conf;
		const name = conf.name;
		const fmts = CONFIG.formats;
		let argObj;
		try {
			argObj = sinkConf.getArgs(args, thisArg);
		} catch(err) {
			logErr(err);
			real.dir(args);
			real.dir(thisArg);
			return false;
		}

		if (!sinkConf.runPreInterest(argObj)) {
			return false;
		}

		// TODO allow empty calls to be displayed
		if (!Object.keys(argObj.args).length) {
			return false;
		}

		// does this call have an interesting result?
		const interest = sinkConf.getInterest(argObj);

		// is there any interest?
		const format = interest.length
			? fmts.interesting
			: fmts.title;
		if (!format.use) {
			return false;
		}

		const titleGrp = printTitle(name, format, interest.length);
		if (conf.why) {
			const end = logGroup(CONFIG.formats.why, "Explanation:")
			zebraLog(conf.why, CONFIG.formats.why);
			real.logGroupEnd(end);
		}
		sinkConf.printArgs(argObj);

		// print all intereresting reuslts
		interest.forEach(arr => printInterest(...arr));

		// stack display
		// don't put this into a function, it will be one more thing on the call
		// stack
		const stackFormat = CONFIG.formats.stack;
		if (stackFormat.use) {
			const stackTitle = "%cstack: "
			if (stackFormat.open) {
				real.logGroup(stackTitle, stackFormat.default);
			} else {
				real.logGroupCollapsed(stackTitle, stackFormat.default);
			}
			real.trace();
			real.logGroupEnd(stackTitle);
		}
		real.logGroupEnd(titleGrp);
		return false;
	}

	/**
	* Applies the Eval Villain hook to a sink, using the sink configuration
	*/
	function applyEvalVillain(sinkArg) {
		const pattern = sinkArg.pattern;
		sinkArg.conf = sinkArg.conf
			? new SinkConf(sinkArg.conf)
			: GLOB_SINK_CONF;

		if (!CONFIG.formats.why.use && sinkArg.why) {
			delete sinkArg.why;
		}

		class evProxy {
			// Start of Eval Villain hook
			apply(_target, thisArg, args) {
				EvalVillainHook(sinkArg, args, thisArg);
				return Reflect.apply(...arguments);
			}

			// Start of Eval Villain hook
			construct(_target, args, _newArg) {
				EvalVillainHook(sinkArg, args, null);
				return Reflect.construct(...arguments);
			}
		}

		function getFunc(n) {
			const ret = {}
			ret.where = window;
			const groups = n.split(".");
			let i; // outside for loop for a reason
			for (i = 0; i < groups.length - 1; i++) {
				ret.where = ret.where[groups[i]];
				if (!ret.where) {
					return null;
				}
			}
			ret.leaf = groups[i];
			return ret;
		}

		const ownprop = /^(\w*)\(([a-zA-Z.]+)\)\s*$/.exec(pattern);
		const ep = new evProxy();
		if (ownprop) {
			const [_, prop, pattern] = ownprop;
			const {where, leaf} = getFunc(pattern);
			const orig = Object.getOwnPropertyDescriptor(where.prototype, leaf)[prop];
			Object.defineProperty(where.prototype, leaf, {[prop] : new Proxy(orig, ep)});
		} else if (!/^[a-zA-Z.]+$/.test(pattern)) {
			real.log("[EV] name: %s invalid, not hooking", pattern);
			real.dir(pattern);
		} else {
			const f = getFunc(pattern);
			f.where[f.leaf] = new Proxy(f.where[f.leaf], ep);
		}
	}

	//////////////////////////////////////////
	// Enough functions, start doings stuff //
	//////////////////////////////////////////

	// prove we loaded
	if (CONFIG.checkId) {
		document.currentScript.setAttribute(CONFIG.checkId, true);
		delete CONFIG["checkId"];
	}

	// grab real functions before hooking
	const real = {
		// log : console.log,
		log : console.log,
		debug : console.debug,
		warn : console.warn,
		dir : console.dir,
		error : console.error,
		logGroup : console.group,
		logGroupEnd : console.groupEnd,
		logGroupCollapsed : console.groupCollapsed,
		trace : console.trace,
		JSON : JSON,
		localStorage: localStorage,
		decodeURIComponent : decodeURIComponent,
		decodeURI : decodeURI,
		atob: atob,
		replaceAll: "".replaceAll,
	};

	// XXX remove when DB refactor complete
	if (CONFIG.limits) {
		real.log("XXX a kind reminder to remove this code");
	} else {
		CONFIG.limits = {};
		for (const [key, value] of Object.entries(CONFIG.formats)) {
			if (value.limit) {
				CONFIG.limits[key] = value.limit;
				delete CONFIG.formats[key].limit;
			}
		}
	}


	// build up global sources
	const SOURCES = [
		"query", "fragment", "winname", "path", "referer", "localStore",
		"cookie", "userSource"
	].filter(n => CONFIG.formats[n]?.use);

	const BLACKLIST = new NeedleBundle(CONFIG.blacklist);
	const NEEDLES = CONFIG.formats.needle?.use? new NeedleBundle(CONFIG.needles): null;
	const GLOB_SINK_CONF = new SinkConf({
		"args": {
			"all": {
				"needles": "global",
				"sources": "global",
				"types": CONFIG.types,
			},
			"this": {
				"types": ["function", "string", "number", "object",
					"undefined", "boolean", "symbol"]
			}
		}
	});
	delete CONFIG.blacklist;
	delete CONFIG.needles;
	delete CONFIG.types;

	CONFIG.functions.forEach(applyEvalVillain);
	delete CONFIG.functions;

	// turns console.log into console.info
	if (CONFIG.formats.logReroute.use) {
		console.log = console.info;
	}

	if (CONFIG.sinker) {
		const conf = {
			name: CONFIG.sinker,
			pattern: CONFIG.sinkArg,
			conf: GLOB_SINK_CONF,
		}

		window[CONFIG.sinker] = function(sinkName, ...args) {
			conf.name = sinkName;
			EvalVillainHook(conf, args);
			return false;
		};
		delete CONFIG.sinker;
	}

	real.log("%c[EV]%c Functions hooked for %c%s%c",
		CONFIG.formats.interesting.highlight,
		CONFIG.formats.interesting.default,
		CONFIG.formats.interesting.highlight,
		document.location.origin,
		CONFIG.formats.interesting.default
	);
}
