// switcheroo won't log, instead it will push console args to allCalls where we
// can test them
//

// ensure functions hooked message is displayed
{
	if (allCalls.length != 1) {
		fail("Only Banner");
	}
	/* printNextArgs(); */
	checkArg(["%c[EV]%c Functions hooked for %c%s%c", colGreen, colRed, colGreen, location.origin, colRed], "banner check");
}

// test scope
{
	/*
	 * NOT interesting stuff
	*/
	let t = "innerHTML no interest"
	let value = 'z980j4kd0';
	const domObj = document.getElementById('here')
	domObj.innerHTML = value;
	testNormal(t, "set(Element.innerHTML)", {
		"this": {
			value: domObj,
			type: "object",
		},
		0: {
			value: value,
		}
	});

	t = "outerHTML no interest"
	domObj.outerHTML = value;
	testNormal(t, "set(Element.outerHTML)", {
		"this": {
			value: domObj,
			type: "object",
		},
		0: {
			value: value,
		}
	});

	t = "document.write no interest"
	document.write(value);
	testNormal(t, "document.write", {
		"this": {
			value: document,
			type: "object",
		},
		0: {
			value: value,
		}
	});

	t = "Eval no interest"
	value = '{let dk309slkz9 = 939202}';
	eval(value);
	testNormal(t, "eval", {
		0: {
			value: value,
		}
	});

	t = "Eval blacklist bool"
	value = '{let dk309slkz9 = true}';
	eval(value);
	testNormal(t, "eval", {
		0: {
			value: value,
		}
	});

	/*
	 * Interesting
	*/
	let needle = 'asdf';
	t = "Eval needle";
	let line = ['{let ', needle, ' = true}'];
	eval(line.join(""));
	let argObj = {
		0: {
			value: line.join(""),
		},
	};
	let intArr = [
		{
			decoded: false,
			reason: "needle",
			needle: needle,
			line: line,
		},

	];
	testInterset(t, "eval", argObj, intArr);

	t = "localstoreage test";
	needle = storekeyfind;
	line = ["() => {\n\treturn '", needle, "';// ", needle, " ssssssss\n}"];
	eval(line.join(""));
	argObj = {
		0: {
			value: line.join(""),
		},
	};
	intArr = [
		{
			decoded: true,
			reason: `localStorage[${storekey}]`,
			needle: needle,
			line: line,
		},

	];
	testInterset(t, "eval", argObj, intArr);

	t = "Blacklist true, needle eval"
	needle = 'asdf';
	line = ['', needle, ' = 1;{let ', needle, ' = true}'];
	eval(line.join(""));
	argObj = {
		0: {
			value: line.join(""),
		},
	};
	intArr = [
		{
			decoded: false,
			reason: "needle",
			needle: needle,
			line: line,
		},

	];
	testInterset(t, "eval", argObj, intArr);

	t = "Query unencoded"
	needle = 'zxcv';
	line = ['// ', needle, ''];
	eval(line.join(""));
	argObj = {
		0: {
			value: line.join(""),
		},
	};
	intArr = [
		{
			decoded: false,
			reason: "query[param_zxcv]",
			needle: needle,
			line: line,
		},

	];
	testInterset(t, "eval", argObj, intArr);

	t = "Query encoded"
	needle = '\' + <';
	line = ['// ', needle, ''];
	eval(line.join(""));
	argObj = {
		0: {
			value: line.join(""),
		},
	};
	intArr = [
		{
			decoded: true,
			reason: "query[encoded]",
			needle: needle,
			line: line,
		},

	];
	testInterset(t, "eval", argObj, intArr);

	t = "Fragment"
	needle = 'fragment_value';
	line = ['// ', needle, ''];
	eval(line.join(""));
	argObj = {
		0: {
			value: line.join(""),
		},
	};
	intArr = [
		{
			decoded: false,
			reason: "fragment",
			needle: needle,
			line: line,
		},

	];
	testInterset(t, "eval", argObj, intArr);

	t = "2nd Fragment"
	needle = "newfrag";
	window.location.hash = needle;
	line = ['// ', needle, ''];
	eval(line.join(""));
	argObj = {
		0: {
			value: line.join(""),
		},
	};
	intArr = [
		{
			decoded: false,
			reason: "fragment",
			needle: needle,
			line: line,
		},

	];
	testInterset(t, "eval", argObj, intArr);

	t = "new fragment blacklist"
	needle = "true";
	window.location.hash = needle;
	line = ['// ', needle, ''];
	eval(line.join(""));
	testNormal(t, "eval", {
		0: {
			value: line.join(""),
		}
	});

	t = "decoding atob,json,array  atob encoded"
	needle = 'secondinarray';
	line = ['// ', needle, ''];
	eval(line.join(""));
	argObj = {
		0: {
			value: line.join(""),
		},
	};
	intArr = [
		{
			decoded: true,
			reason: "query[json]",
			needle: needle,
			line: line,
		},

	];
	testInterset(t, "eval", argObj, intArr);

	// push state here
	t = "Push state to change URL params, test to see if new URL params found"
	let pname = "newpushedparameter";
	needle = "url_change_without_reload_test_needle";
	pushHistoryParam(pname, needle)
	line = ['// ', needle, ''];
	eval(line.join(""));
	argObj = {
		0: {
			value: line.join(""),
		},
	};
	intArr = [
		{
			decoded: false,
			reason: `query[${pname}]`,
			needle: needle,
			line: line,
		},

	];
	testInterset(t, "eval", argObj, intArr);

	// evSourcer
	pname = "test";
	needle = 'aisjd;ljaovkaoiejljgbvmbg;lkjsdfoigqa;elrtj';
	evSourcer(pname, needle, true)
	line = ['// ', needle, ''];
	eval(line.join(""));
	t = "evSourcer test"
	argObj = {
		0: {
			value: line.join(""),
		},
	};
	intArr = [
		{
			decoded: false,
			reason: `evSourcer[${pname}]`,
			needle: needle,
			line: line,
		},

	];
	testInterset(t, "eval", argObj, intArr);

	// evSourcer encoded
	t = "evSourcer base64"
	pname = "test";
	needle = 'ais1029834c,jlosdiforjoisalkdfkvcmlkdrtj';
	evSourcer(pname, btoa(needle), true)
	line = ['// ', needle, ''];
	eval(line.join(""));
	argObj = {
		0: {
			value: line.join(""),
		},
	};
	intArr = [
		{
			decoded: true,
			reason: `evSourcer[${pname}]`,
			needle: needle,
			line: line,
		},

	];
	testInterset(t, "eval", argObj, intArr);

	// evSourcer obj
	t = "evSourcer obj"
	pname = "objtest";
	needle = 'xxjopidfkjvcoisdjlkvjsoiddfkjgbkjgjgkjkjdfjkafkjdfs';
	evSourcer(pname, {a: {b: {c: needle}}}, true)
	line = ['// ', needle, ''];
	eval(line.join(""));
	argObj = {
		0: {
			value: line.join(""),
		},
	};
	intArr = [
		{
			decoded: true,
			reason:  `evSourcer[${pname}]`,
			needle: needle,
			line: line,
		},

	];
	testInterset(t, "eval", argObj, intArr);

	// evSourcer base64 json
	t = "evSourcer base64 json"
	pname = "base64 JSON";
	needle = 'this may as well be a readable string I guess...';
	evSourcer(pname, btoa(JSON.stringify({a: {b: {c: needle}}})), true)
	line = ['// ', needle, ''];
	eval(line.join(""));
	argObj = {
		0: {
			value: line.join(""),
		},
	};
	intArr = [
		{
			decoded: true,
			reason:  `evSourcer[${pname}]`,
			needle: needle,
			line: line,
		},

	];
	testInterset(t, "eval", argObj, intArr);


	// addEventListener("message", ...) custom
	t = "postMessage init"
	line = ["", "message", ""];
	const func = msg => {
		console.debug('got postMessage');
		console.dir(msg);
	}
	addEventListener("message", func);
	argObj = {
		0: {
			line: ["message"],
		},
		1: {
			func: func,
		}
	}
	intArr = [
		{
			decoded: false,
			reason: "needle",
			needle: /^message$/,
			line: line,
			arg: 0,
		},
	];
	testInterset(t, "window.addEventListener", argObj, intArr);

	// addEventListener("message", ...) custom
	t = "asdf in addEventListener not interesting";
	line = ["asdf"];
	addEventListener("asdf", func);
	testNormal(t, "window.addEventListener", {
		0: {
			line: line,
		},
		1: {
			func: func,
		}
	});
}
