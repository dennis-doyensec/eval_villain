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
	let argArr = [
			{
				value: domObj,
				type: "object",
				key: "this"
			},
			{value: value, key:0, display:"[1/1]"},
	];
	testNormal(t, "innerHTML", argArr);

	t = "outerHTML no interest"
	domObj.outerHTML = value;
	argArr = [
			{
				value: domObj,
				type: "object",
				key: "this"
			},
			{value: value, key:0, display:"[1/1]"},
	];
	testNormal(t, "outerHTML", argArr);

	t = "document.write no interest"
	document.write(value);
	argArr = [
			{
				value: document,
				type: "object",
				key: "this"
			},
			{value: value, key:0, display:"[1/1]"},
	];
	testNormal(t, "document.write", argArr);

	t = "Eval no interest"
	value = '{let dk309slkz9 = 939202}';
	eval(value);
	argArr = [
			{value: value, key:0, display: '[1/1]'},
	];
	testNormal(t, "eval", argArr);

	t = "Eval blacklist bool"
	value = '{let dk309slkz9 = true}';
	eval(value);
	testNormal(t, "eval", [{value: value, key:0, display: "[1/1]"}]);

	/*
	 * Interesting
	*/
	let needle = 'asdf';
	t = "Eval needle";
	let line = ['{let ', needle, ' = true}'];
	value = line.join("");
	eval(value);
	argArr = [{value: value, key: 0, display: '[1/1]'}];
	let intArr = [
		{
			decoded: false,
			reason: "needle",
			needle: needle,
			line: line,
		},

	];
	testInterset(t, "eval", argArr, intArr);

	t = "localstoreage test";
	needle = storekeyfind;
	line = ["() => {\n\treturn '", needle, "';// ", needle, " ssssssss\n}"];
	eval(line.join(""));
	argArr = [
		{value: line.join(""), key: 0, display: '[1/1]'},
	];
	intArr = [
		{
			decoded: true,
			reason: `localStorage[${storekey}]`,
			needle: needle,
			line: line,
		},

	];
	testInterset(t, "eval", argArr, intArr);

	t = "Blacklist true, needle eval"
	needle = 'asdf';
	line = ['', needle, ' = 1;{let ', needle, ' = true}'];
	eval(line.join(""));
	argArr = [
		{value: line.join(""), key: 0, display: '[1/1]'},
	];
	intArr = [
		{
			decoded: false,
			reason: "needle",
			needle: needle,
			line: line,
		},

	];
	testInterset(t, "eval", argArr, intArr);

	t = "Query unencoded"
	needle = 'zxcv';
	line = ['// ', needle, ''];
	eval(line.join(""));
	argArr = [
		{value: line.join(""), key: 0, display: '[1/1]'},
	];
	intArr = [
		{
			decoded: false,
			reason: "query[param_zxcv]",
			needle: needle,
			line: line,
		},

	];
	testInterset(t, "eval", argArr, intArr);

	t = "Query encoded"
	needle = '\' + <';
	line = ['// ', needle, ''];
	eval(line.join(""));
	argArr = [
		{value: line.join(""), key: 0, display: '[1/1]'},
	];
	intArr = [
		{
			decoded: true,
			reason: "query[encoded]",
			needle: needle,
			line: line,
		},

	];
	testInterset(t, "eval", argArr, intArr);

	t = "Fragment"
	needle = 'fragment_value';
	line = ['// ', needle, ''];
	eval(line.join(""));
	argArr = [
		{value: line.join(""), key: 0, display: '[1/1]'},
	];
	intArr = [
		{
			decoded: false,
			reason: "fragment",
			needle: needle,
			line: line,
		},

	];
	testInterset(t, "eval", argArr, intArr);

	t = "2nd Fragment"
	needle = "newfrag";
	window.location.hash = needle;
	line = ['// ', needle, ''];
	eval(line.join(""));
	argArr = [
		{value: line.join(""), key: 0, display: '[1/1]'},
	];
	intArr = [
		{
			decoded: false,
			reason: "fragment",
			needle: needle,
			line: line,
		},

	];
	testInterset(t, "eval", argArr, intArr);

	t = "new fragment blacklist"
	needle = "true";
	window.location.hash = needle;
	line = ['// ', needle, ''];
	value = line.join("");
	eval(value);
	testNormal(t, "eval", [{value: value, key:0, display: '[1/1]'}]);

	t = "decoding atob,json,array  atob encoded"
	needle = 'secondinarray';
	line = ['// ', needle, ''];
	eval(line.join(""));
	argArr = [
		{value: line.join(""), key: 0, display: '[1/1]'},
	];
	intArr = [
		{
			decoded: true,
			reason: "query[json]",
			needle: needle,
			line: line,
		},

	];
	testInterset(t, "eval", argArr, intArr);

	// push state here
	t = "Push state to change URL params, test to see if new URL params found"
	let pname = "newpushedparameter";
	needle = "url_change_without_reload_test_needle";
	pushHistoryParam(pname, needle)
	line = ['// ', needle, ''];
	eval(line.join(""));
	argArr = [
		{value: line.join(""), key: 0, display: '[1/1]'},
	];
	intArr = [
		{
			decoded: false,
			reason: `query[${pname}]`,
			needle: needle,
			line: line,
		},

	];
	testInterset(t, "eval", argArr, intArr);

	// evSourcer
	pname = "test";
	needle = 'aisjd;ljaovkaoiejljgbvmbg;lkjsdfoigqa;elrtj';
	evSourcer(pname, needle, true)
	line = ['// ', needle, ''];
	eval(line.join(""));
	t = "evSourcer test"
	argArr = [
		{value: line.join(""), key: 0, display: '[1/1]'},
	];
	intArr = [
		{
			decoded: false,
			reason: `evSourcer[${pname}]`,
			needle: needle,
			line: line,
		},

	];
	testInterset(t, "eval", argArr, intArr);

	// evSourcer encoded
	t = "evSourcer base64"
	pname = "test";
	needle = 'ais1029834c,jlosdiforjoisalkdfkvcmlkdrtj';
	evSourcer(pname, btoa(needle), true)
	line = ['// ', needle, ''];
	eval(line.join(""));
	argArr = [
		{value: line.join(""), key: 0, display: '[1/1]'},
	];
	intArr = [
		{
			decoded: true,
			reason: `evSourcer[${pname}]`,
			needle: needle,
			line: line,
		},

	];
	testInterset(t, "eval", argArr, intArr);

	// evSourcer obj
	t = "evSourcer obj"
	pname = "objtest";
	needle = 'xxjopidfkjvcoisdjlkvjsoiddfkjgbkjgjgkjkjdfjkafkjdfs';
	evSourcer(pname, {a: {b: {c: needle}}}, true)
	line = ['// ', needle, ''];
	eval(line.join(""));
	argArr = [
		{value: line.join(""), key: 0, display: '[1/1]'},
	];
	intArr = [
		{
			decoded: true,
			reason:  `evSourcer[${pname}]`,
			needle: needle,
			line: line,
		},

	];
	testInterset(t, "eval", argArr, intArr);

	// evSourcer base64 json
	t = "evSourcer base64 json"
	pname = "base64 JSON";
	needle = 'this may as well be a readable string I guess...';
	evSourcer(pname, btoa(JSON.stringify({a: {b: {c: needle}}})), true)
	line = ['// ', needle, ''];
	eval(line.join(""));
	argArr = [
		{value: line.join(""), key: 0, display: '[1/1]'},
	];
	intArr = [
		{
			decoded: true,
			reason:  `evSourcer[${pname}]`,
			needle: needle,
			line: line,
		},

	];
	testInterset(t, "eval", argArr, intArr);


	const handlerFunc = msg => 42;
	t = 'addEventListener("message", ...) custom interest';
	line = ["", "message", ""];
	argArr = [{value: handlerFunc, key: 1, display: '[2/2]'}];
	addEventListener("message", handlerFunc);
	intArr = [
		{
			decoded: false,
			reason: "needle",
			needle: /^message$/,
			display: "[1/2]",
			line: line,
			arg: 0,
		},
	];
	testInterset(t, "postMessage registered", argArr, intArr);

	t = "asdf in addEventListener not interesting";
	line = ["asdf"];
	addEventListener("asdf", handlerFunc);
	// argArr fallthrough from abouve
	testNormal(t, "postMessage registered", argArr);

	// test fetch
	t = 'fetch test interest';
	line = ["https://example.com/", "asdf"];
	value = line.join("");
	try {
		fetch(value);
	} catch(_err) {pass};

	argArr = [
		{value: value, key: 0, display: '[1/1]'},
	];
	intArr = [
		{
			decoded: false,
			reason: "needle",
			needle: "asdf",
			display: '[1/1][URL:pathname]',
			line: ["/", "asdf", ""],
			arg: 0,
		},
	];
	testInterset(t, "fetch", argArr, intArr);
}
