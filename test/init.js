const storekey = "somekey";
const storekeyfind = "0d9jlfk2j309jflaksjd0fasoekjr2398rjfalkjsdf";

// ensure we have parameters to play with
{
	let jsdata = btoa(JSON.stringify(
		  {
			 "firstProperty" : "firstPropans",
			 "secondArray" : [ "firstinarray", "secondinarray" ],
			 "bool" : true,
			 "small" : "a"
		  }
	));

	let gotourl = `?one=1&json=${jsdata}&param_zxcv=zxcv&encoded=%27%20%2b%20%3c&bool=true`
	let frag = "fragment_value";
	let url = new URL(location.href);

	// localStorage test
	let storeRefresh = false;
	if (!localStorage.getItem(storekey)) {
		storeRefresh = true;
		const inner = {
			foo: {
				foo: {
					ar: [
						storekeyfind
					]
				}
			}
		}
		localStorage.setItem(storekey, btoa(btoa(JSON.stringify(inner))));
	}
	if (url.search != gotourl || url.hash != frag || storeRefresh) {
		url.search = gotourl;
		url.hash = frag;
		location.href = url;
	}

}

const cl = console.log;
const ct = console.trace;
const cg = console.group;
const cgc = console.groupCollapsed;
const cge = console.groupEnd;

const allCalls = [];
function addToCalls() {
	allCalls.push(arguments);
}

// new globals you can use in rewriter for debugging
// Will break EV in normal env, so you don't publish debug code
xxxdir = console.dir;
xxxlog = console.log;
xxxtrace = console.trace;
zzzdebug = () => {debugger};

// replace native functions we use for testing
console.log = addToCalls;
console.group = addToCalls;
console.groupCollapsed = addToCalls;

// empty these to be less ugly
console.trace = () => {};
document.write = () => {};
document.writeln = () => {};
console.groupEnd = () => {};

function fail(x) {
	console.error(`[%cXX%c] ${x}`, "color:red", "color:None");
}

function argsToPrintable(args) {
	const ret = [];
	for (const i in args) {
		ret.push(args[i]);
	}
	return JSON.stringify(ret, null, 2);
}

function printNextArgs() {
	cl(argsToPrintable(allCalls[0]));
}

/**
 * Helper function, choses console.group vs console.groupCollapsed by bool
 */
function logGroup(...args) {
	const title = args[0];
	cg(...args);
	return args[0];
}

/**
 * Tests each `args` against each `test`
*/
function argsIs(args, test) {
	if (args.length != test.length) {
		return {off: [`arg.length ${args.length} != ${test.length} test.length`], expect: test, got: args};
	}
	let c = 0;
	const off = []
	for (let i of args) {
		let t = test[c];
		if ([t, i].filter(x => x instanceof RegExp).length == 2) {
			t = t.toString();
			i = i.toString();
		}
		if (i !== t) {
			off.push(`arg[${c}] '${i}' !== '${test[c]}'`)
		}
		c++;
	}
	if (off.length > 0) {
		return {expect: test, got: args, off: off};
	}
	return true;
}

/**
 * Pops msg from `allCalls` and checks if it matches `test`
*/
function checkArg(test, msg) {
	const args = allCalls.shift();
	if (!args) {
		fail(`[ERROR] '${msg}' Missing an expected output`);
		const title = "Expected:";
		cg(title);
		cl(...test);
		cge(title);
		return false;
	}

	const why = argsIs(args, test);
	if (why === true) {
		cgc(`[%c**%c] ${msg}`, "color:green", "color:None");
		cl(...test);
		cge();
		return true;
	}

	fail(msg);
	const erinfo = logGroup("Error Info:");
		for (const i of why.off) {
			cl(i);
		}

		const got = logGroup("got: ");
			cl(argsToPrintable(why.got));
			cl(...why.got);
		cge(got);

		const exp = logGroup("expected: ");
			cl("expected: ", JSON.stringify(why.expect, null, 2));
			cl(...why.expect);
		cge(exp);
	cge(erinfo)
	return false;
}

function getFuncConfByName(nm) {
	return config.functions.filter(x => x.name == nm)[0];
}

function getWhyByName(nm) {
	return getFuncConfByName(nm)?.why;
}

function checkStackBanner(msg) {
	return checkArg(["%cstack: ","color:None"], `${msg} stack banner`);
}

function checkArgTitle(value, indx, msg) {
	const ty = typeof(value);
	const cname = ty === "object"
		?  ` constructor:${value?.constructor.name}`
		: "";
	return checkArg(["%carg%s type:%s%s", colNone, indx, typeof(value), cname ], `${msg} arg test`);
}

function checkAllArgs(msg, argArr) {
	let ret = true;
	for (const argDis of argArr) {
		const {value, key} = argDis;
		const display = argDis.display ?? `[${key}]`;
		ret &= checkArgTitle(value, display, `${msg} ${display} title`);

		if (typeof(value) === 'function') {
			ret &= checkArg(["%c%s", colGreen, value.toString()], `${msg} ${display} value`);
			ret &= checkArg([value], `${msg} arg${display} func ref`);
		} else if (typeof(value) === 'object') {
			ret &= checkArg([value], `${msg} ${display} value`);
		} else {
			ret &= checkArg(["%c%s", colGreen, value], `${msg} Interesting args`);
		}
	}
	return ret;
}

function checkAnInterest(msg, interest) {
	const {
		decoded, reason, needle, arg, c, line, display
	} = interest;
	const col = c ?? colGreen;

	const ban = [colNone,`${reason}: `, col, needle, colNone];
	ban.push(
		" found (arg:",
		"color:#088",
		display ?? '[1/1]',
		"color:None",
		")"
	);
	if (decoded) {
		ban.push(col, " [Decoded]");
	}

	let ret = checkArg(["%c%s".repeat(ban.length / 2)].concat(ban), `${msg} Interesting highlight title`);
	if (decoded) {
		ret &= checkArg(["Encoder function:"], `${msg} Encoder Highlight`);
		const encoder = allCalls.shift();
		if (encoder.length != 1) {
			ret = false;
			fail("Encoder not a single arg");
			cl(JSON.stringify(encoder, null, 2));
		} else {
			cl("TODO: Check if encoder makes sense:");
			cl(encoder[0]);
		}
	}

	const test = ["%c%s".repeat(line.length)];
	const colors = [colGreen, colNone];
	let ci = line.length % 2;
	for (const f of line) {
		test.push(colors[ci]);
		test.push(f);
		ci = (ci+1)%2;
	}
	ret &= checkArg(test, `${msg} Interesting highlight`);
	return ret;
}

function getArgLen(argObj) {
	return Object.keys(argObj).filter(x => x != "this").length;
}

function checkWhy(nm) {
	let ret = true;
	const why = getWhyByName(nm);
	if (why) {
		ret = checkArg(["Explanation:"], `${nm} Explanation group`);
		const ar = ["%c%s", config.formats.why.default];
		ar.push(...why);
		ret &= checkArg(ar, `${nm} why`);
	}
	return ret;
}

function testInterset(msg, name, argArr, interArray) {
	let ret = checkArg(["%c[EV] %c%s%c %s", colRed, colGreen, name, colRed, location.href], `${msg} Interesting Banner`);
	ret &= checkWhy(name);

	ret &= checkAllArgs(msg, argArr);
	for (const interest of interArray) {
		ret &= checkAnInterest(msg, interest);
	}

	ret &= checkStackBanner(msg);
	if (allCalls.length != 0) {
		fail ("msg: extra args left over")
		while (allCalls.length > 0) {
			printNextArgs();
			allCalls.shift();
		}
		return false;
	}
	return ret;
}

function pushHistoryParam(key, value, clear=true) {
	const url = new URL(location.href);
	if (clear) {
		Array.from(url.searchParams.keys() ).forEach(x => url.searchParams.delete(x));
	}
	url.searchParams.set(key, value);
	history.pushState({}, null, url);
}

function testNormal(msg, name, argArr) {
	const argLen = getArgLen(argArr);
	let ret = true;
	ret &= checkArg(["%c[EV] %c%s%c %s", colNone, colGreen, name, colNone, location.href], `${msg} Normal Banner`);
	ret &= checkWhy(name);
	ret &= checkAllArgs(msg, argArr);

	ret &= checkStackBanner(msg);
	if (allCalls.length != 0) {
		ret = false;
		fail ("msg: extra args left over")
		while (allCalls.length > 0) {
			printNextArgs();
			allCalls.shift();
		}
	}
	return ret;
}

const colNone = "color:None";
const colGreen = "color:#088";
const colBlue = "color:#147599";
const colRed = "color:red";
var config =  {
	"sourcer": "evSourcer",
	"sinker": "evSinker",
	"formats" : {
		"title" : {
			"pretty" : "Normal Results",
			"use" : true,
			"open" : true,
			"default" : colNone,
			"highlight" : colGreen
		},
		"interesting" : {
			"pretty" : "Interesting Results",
			"use" : true,
			"open" : true,
			"default" : colRed,
			"highlight" : colGreen
		},
		"why": {
			"pretty"	: "Explanation",
			"use"		: true,
			"open"		: false,
			"default"	: colNone,
			"highlight" : colGreen,
		},
		"args" : {
			"pretty" : "Args Display",
			"use" : true,
			"open" : true,
			"default" : colNone,
			"highlight" : colGreen
		},
		"needle" : {
			"pretty" : "Needles Search",
			"use" : true,
			"open" : true,
			"default" : colNone,
			"highlight" : colGreen
		},
		"query" : {
			"pretty" : "Query Search",
			"use" : true,
			"limit": 32,
			"open" : true,
			"default" : colNone,
			"highlight" : colGreen
		},
		"fragment" : {
			"pretty" : "Fragment Search",
			"use" : true,
			"limit": 32,
			"open" : true,
			"default" : colNone,
			"highlight" : colGreen
		},
		"winname" : {
			"pretty" : "window.name Search",
			"use" : true,
			"limit": 32,
			"open" : true,
			"default" : colNone,
			"highlight" : colGreen
		},
		"path": {
			"pretty": "Path Search",
			"use": false,
			"limit": 32,
			"open": true,
			"default": "color: none",
			"highlight": "color: #088"
		},
		"referrer": {
			"pretty": "Referrer Search",
			"use": false,
			"limit": 32,
			"open": true,
			"default": "color: none",
			"highlight": "color: #088"
		},
		"cookie" : {
			"pretty"	: "Cookie Search",
			"use"		: true,
			"limit": 32,
			"open"		: true,
			"default"	: "color: none",
			"highlight" : "color: colGreen"
		},
		"localStore" : {
			"pretty"	: "localStorage",
			"limit": 32,
			"use"		: true,
			"open"		: true,
			"default" : colNone,
			"highlight" : colGreen
		},
		"userSource": {
			"pretty": "User Sources",
			"use": true,
			"limit": 32,
			"default": colNone,
			"highlight": colGreen, // TODO allow colBlue,
			"open": false,
		},
		"stack" : {
			"pretty" : "Stack Display",
			"use" : true,
			"open" : true,
			"default" : colNone,
			"highlight" : colGreen
		},
		"logReroute": {
			"pretty": "Log Reroute",
			"use": true,
			"open": null,
			"default": "N/A",
			"highlight": "N/A"
		}
	},
	"needles" : ["asdf"],
	"blacklist" : [
		"/^\\s*\\S{0,3}\\s*$/",
		"/^s*(?:true|false)s*$/gi"
	],
	"functions" : [
		{
			"name": "eval",
			"pattern": "eval",
			"why": ["Eval is bad"],
		}, {
			"name": "innerHTML",
			"pattern": "set(Element.innerHTML)",
			"why": ["XSS is bad"],
		}, {
			"name": "outerHTML",
			"pattern": "set(Element.outerHTML)",
			"why": [""],
		}, {
			"name": "document.write",
			"pattern": "document.write",
			"why": [""],
		}, {
			"name": "document.writeln",
			"pattern": "document.writeln",
			"why": [""],
		}, {
			"name": "postMessage registered",
			"why": [""],
			"pattern": "window.addEventListener",
			"conf": {
				"args": {
					0: {
						"needles": ["/^message$/"],
						"types": ["string"],
						"format": {
							"use": false,
						}
					},
					1: {
						"types": ["function"],
						"format": {
							"use": true,
						},
						"argBlacklist": [
							"/^\\s*\\/\\/\\s*EVDONE[\\s:]*/m",
						],
						"requiredArg": true, // failed blacklist means thorwn away
					},
				}
			}
		}, {
			"name": "fetch",
			"why": ["could be cspt?"],
			"pattern": "fetch",
			"conf": {
				"args": {
					0: {
						"types": ["string"],
						"parseAsConf": {
							"parseAs": "URL",
							"keys": ["pathname", "hostname"]
						}
					},
					"all": {
						"types": ["string"],
						"needles": "global",
						"sources": "global",
						"format": {
							"use": false,
						},
					}
				}
			}
		}, 
		// {
		// 	"name" : "setAttribute",
		// 	"enabled" : true,
		// 	"pattern" : "value(Element.setAttribute)",
		// 	"conf": {
		// 		"onPostInterest": "real.dir(arguments);",
		// 		"args": {
		// 			"all": {
		// 				"types": ["string"],
		// 				"needles": "global",
		// 				"sources": "global",
		// 				"format": {
		// 					"use": false,
		// 				},
		// 			}
		// 		}
		// 	},
		// }
	],
	"types" : ["string", "function"],
};
