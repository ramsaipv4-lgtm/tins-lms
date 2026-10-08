// Unit tests of the Snek interpreter (packages/games/src/lang). The acceptance rows AC-208 to AC-213 have
// their own tests in the tests repo; these check the interpreter directly: output, errors, limits,
// counting, step events, value conversion and the sandbox.
import test from 'node:test';
import assert from 'node:assert/strict';
import { compile, run, step, callFunction } from '../src/lang/index.ts';

function exec(src, opts) {
  const c = compile(src);
  assert.ok(c.ok, c.ok ? '' : `compile failed: ${JSON.stringify(c.error)}`);
  return run(c.program, opts);
}
function out(src, opts) {
  const r = exec(src, opts);
  assert.ok(r.ok, r.ok ? '' : `run failed: ${JSON.stringify(r.error)}`);
  return r.stdout;
}
function failure(src, opts) {
  const c = compile(src);
  if (!c.ok) return c.error;
  const r = run(c.program, opts);
  assert.ok(!r.ok, 'expected an error');
  return r.error;
}
function events(src, opts) {
  const c = compile(src);
  assert.ok(c.ok);
  const g = step(c.program, opts);
  const list = [];
  for (;;) {
    const n = g.next();
    if (n.done) return { events: list, result: n.value };
    list.push(n.value);
  }
}
const oneSentence = (m) => !/\n/.test(m) && m.length <= 160 && /[.!?]$/.test(m) && !/undefined|null|NaN|\[object/.test(m);

test('numbers print like CPython', () => {
  assert.equal(out('print(7 / 2, 6 / 3, 1 / 3, 0.1 + 0.2)'), '3.5 2.0 0.3333333333333333 0.30000000000000004\n');
  assert.equal(out('print(1e16, 1e15, 0.0001, 0.00001, -0.0, 2 ** 10, 10 ** 15)'), '1e+16 1000000000000000.0 0.0001 1e-05 -0.0 1024 1000000000000000\n');
  assert.equal(out('print(-7 // 2, -7 % 3, 7 % -3, 7.5 // 2, -7.5 % 2)'), '-4 2 -2 3.0 0.5\n');
  assert.equal(out('print(round(2.5), round(3.5), round(-2.5), round(2.675, 2), round(0.125, 2), round(1250, -2))'), '2 4 -2 2.67 0.12 1200\n');
  assert.equal(out('print(int("42") + 1, int(-3.99), float("2.5") * 2, bool(""), 3 == 3.0)'), '43 -3 5.0 False True\n');
});

test('ints stay inside 53 bits', () => {
  assert.equal(out('print(2 ** 52 + (2 ** 52 - 1))'), '9007199254740991\n');
  assert.equal(failure('print(2 ** 53)').kind, 'OverflowError');
  assert.equal(failure('x = 9007199254740991\nprint(x + 1)').kind, 'OverflowError');
  assert.equal(compile('x = 9007199254740993').ok, false);
});

test('strings, f-strings and formatting', () => {
  assert.equal(out('s = "Hello, World"\nprint(s[1:4], s[::-1], s.upper(), s.find("W"), s.replace("l", "L", 2))'), 'ell dlroW ,olleH HELLO, WORLD 7 HeLLo, World\n');
  assert.equal(out('print(f"{3.14159:.2f}|{42:>5}|{\'ab\':<4}|{7:03d}|{1234567:,}|{0.5:.0%}|{2.5:.0f}|{3.5:.0f}")'), '3.14|   42|ab  |007|1,234,567|50%|2|4\n');
  assert.equal(out('n = "Ada"\nprint(f"{n!r} {n.upper()} {{x}} {1 + 2}")'), "'Ada' ADA {x} 3\n");
  assert.equal(out('print(["a", "b\'c"], ("x", 1), {"k": "v"}, (1,), [])'), `['a', "b'c"] ('x', 1) {'k': 'v'} (1,) []\n`);
});

test('collections, comprehensions and unpacking', () => {
  assert.equal(out('xs = [3, 1, 2]\nxs.sort()\nprint(xs, xs[::-1], [x * x for x in xs if x > 1], {x: x + 1 for x in xs}, {x % 2 for x in xs} == {0, 1})'), '[1, 2, 3] [3, 2, 1] [4, 9] {1: 2, 2: 3, 3: 4} True\n');
  assert.equal(out('a, b = 1, 2\na, b = b, a\nxs = [1, 2]\nxs[0], xs[1] = xs[1], xs[0]\nprint(a, b, xs)'), '2 1 [2, 1]\n');
  assert.equal(out('d = {"b": 1, "a": 2}\ndel d["b"]\nd["c"] = 3\nprint(d, list(d.items()), d.get("z", 0), sorted(d))'), "{'a': 2, 'c': 3} [('a', 2), ('c', 3)] 0 ['a', 'c']\n");
  assert.equal(out('print(sorted(["pear", "fig", "apple"], key=len), sorted([3, 1, 2], reverse=True), max([1, 5, 3]), sum([1, 2, 3]))'), "['fig', 'pear', 'apple'] [3, 2, 1] 5 6\n");
  assert.equal(out('print(list(zip("ab", [1, 2])), list(enumerate("ab", 1)), list(map(str, [1, 2])), any([0, 1]), all([]))'), "[('a', 1), ('b', 2)] [(1, 'a'), (2, 'b')] ['1', '2'] True True\n");
});

test('dict keys follow Python equality', () => {
  assert.equal(out('d = {1: "a", True: "b", 2.0: "c", (1, 2): "t"}\nprint(d[1], d[2], d[(1, 2)], len(d))'), 'b c t 3\n');
  assert.equal(failure('d = {[1]: 2}').kind, 'TypeError');
});

test('functions, closures, defaults and keywords', () => {
  assert.equal(out('def f(a, b=2, *rest):\n    return (a, b, rest)\nprint(f(1), f(1, 3, 4, 5), f(b=7, a=0))'), '(1, 2, ()) (1, 3, (4, 5)) (0, 7, ())\n');
  assert.equal(out('def counter():\n    n = [0]\n    def inc():\n        n[0] += 1\n        return n[0]\n    return inc\nc = counter()\nc()\nprint(c())'), '2\n');
  assert.equal(out('def fact(n):\n    return 1 if n <= 1 else n * fact(n - 1)\nprint(fact(10))'), '3628800\n');
  assert.equal(out('print((lambda a, b=2: a * b)(4), sorted([(2, "a"), (1, "b")], key=lambda p: p[0]))'), "8 [(1, 'b'), (2, 'a')]\n");
});

test('classes and exceptions', () => {
  const cls = 'class Stack:\n    def __init__(self):\n        self.items = []\n    def push(self, x):\n        self.items.append(x)\n    def pop(self):\n        return self.items.pop()\n    def __str__(self):\n        return "Stack" + str(self.items)\nclass Box:\n    n = 0\n';
  assert.equal(out(cls + 's = Stack()\ns.push(1)\ns.push(2)\nBox.n += 1\nprint(s, s.pop(), Box.n, isinstance(s, Stack))'), 'Stack[1] 2 1 True\n');
  assert.equal(out('for s in ["1", "x"]:\n    try:\n        print(int(s))\n    except ValueError as e:\n        print("bad", s)\n    finally:\n        print("done")'), '1\ndone\nbad x\ndone\n');
  assert.equal(out('try:\n    raise KeyError("k")\nexcept (ValueError, KeyError) as e:\n    print(e, e.args)'), "'k' ('k',)\n");
  assert.equal(failure('def f():\n    raise ValueError("boom")\nf()').message, 'boom.');
});

test('loops: break, continue, else', () => {
  assert.equal(out('for i in range(5):\n    if i == 1:\n        continue\n    if i == 3:\n        break\n    print(i)\nelse:\n    print("no break")\nwhile False:\n    pass\nelse:\n    print("while else")'), '0\n2\nwhile else\n');
});

test('stdin and input()', () => {
  assert.equal(out('name = input("Name? ")\nprint(name.upper())', { input: ['kit'] }), 'Name? KIT\n');
  const e = failure('input()', { input: [] });
  assert.equal(e.kind, 'EOFError');
});

test('run returns the value of a last expression statement', () => {
  assert.equal(exec('1 + 2').value, 3);
  assert.equal(exec('x = 5').value, null);
  assert.deepEqual(exec('(1, 2.5, "s", None, True)').value, { $tuple: [1, 2.5, 's', null, true] });
});

test('errors carry kind, line and a one-sentence message with the keyword', () => {
  const cases = [
    ['x = 3\nif x > 1\n    print(x)\n', 'SyntaxError', 2, ':'],
    ['total = 5\nprint(totl)\n', 'NameError', 2, 'totl'],
    ['xs = [1, 2, 3]\nprint(xs[3])\n', 'IndexError', 2, 'index'],
    ['def f():\n    x = 1\n      y = 2\n    return x\n', 'IndentationError', 3, 'indent'],
    ['def f():\n    x = 1\n  y = 2\n', 'IndentationError', 3, 'indent'],
    ['if True:\nprint(1)\n', 'IndentationError', 2, 'indent'],
    ['age = 7\nprint("age: " + age)\n', 'TypeError', 2, '+'],
    ['n = 1\nassert n == 2, "nope"\n', 'AssertionError', 2, 'nope'],
    ['print(1 / 0)\n', 'ZeroDivisionError', 1, 'zero'],
    ['d = {}\nd["k"]\n', 'KeyError', 2, "'k'"],
    ['x = 5\nx.foo\n', 'AttributeError', 2, 'foo'],
    ['int("abc")\n', 'ValueError', 1, 'abc'],
    ['print("a"\n', 'SyntaxError', 1, '('],
    ['x = (1,\n', 'SyntaxError', 1, '('],
    ['print "hi"\n', 'SyntaxError', 1, 'print'],
    ['s = "oops\n', 'SyntaxError', 1, 'string'],
    ['class A:\n    pass\nA(1)\n', 'TypeError', 3, 'A'],
  ];
  for (const [src, kind, line, keyword] of cases) {
    const e = failure(src);
    assert.equal(e.kind, kind, src);
    assert.equal(e.line, line, src);
    assert.ok(e.col >= 1, src);
    assert.ok(e.message.includes(keyword), `${src} -> ${e.message}`);
    assert.ok(oneSentence(e.message), e.message);
  }
});

test('limits stop runs cleanly', () => {
  let r = exec('n = 0\nwhile True:\n    n += 1\n', { maxOps: 10000 });
  assert.equal(r.ok, false);
  assert.equal(r.error.kind, 'TooManySteps');
  assert.ok(r.error.message.includes('10000'));
  assert.ok(r.ops > 10000 && r.ops < 10100);
  r = exec('def down(n):\n    return down(n + 1)\ndown(0)\n', { maxDepth: 50 });
  assert.equal(r.error.kind, 'TooDeep');
  assert.ok(r.error.message.includes('50'));
  r = exec('xs = []\nwhile True:\n    xs.append(1)\n', { maxCells: 5000, maxOps: 10000000 });
  assert.equal(r.error.kind, 'TooBig');
  assert.ok(r.error.message.includes('5000'));
  assert.ok(r.peakCells <= 5001);
  assert.equal(exec('x = [0] * 10 ** 9').error.kind, 'TooBig');
  assert.equal(exec('x = list(range(10 ** 9))').error.kind, 'TooBig');
  assert.equal(exec('s = "ab"\nfor i in range(60):\n    s = s + s').error.kind, 'TooBig');
  assert.equal(exec('for i in range(10 ** 9):\n    pass').error.kind, 'TooManySteps');
  assert.equal(exec('print("x" * 100)\nwhile True:\n    print("loop")', { maxOps: 50000 }).ok, false);
});

test('a limit cannot be swallowed by try/except', () => {
  const r = exec('try:\n    while True:\n        pass\nexcept Exception:\n    print("caught")\n', { maxOps: 500 });
  assert.equal(r.error.kind, 'TooManySteps');
  assert.equal(r.stdout, '');
});

test('stdout survives an error', () => {
  const r = exec('print("before")\nprint(1 / 0)\nprint("after")');
  assert.equal(r.ok, false);
  assert.equal(r.stdout, 'before\n');
});

test('counting is deterministic and grows with the work', () => {
  const src = 'def f(n):\n    t = 0\n    for i in range(n):\n        t += i\n    return t\nxs = [f(5) for _ in range(20)]\nprint(sum(xs))';
  const a = exec(src);
  const b = exec(src);
  assert.equal(a.ops, b.ops);
  assert.equal(a.peakCells, b.peakCells);
  assert.ok(exec('for i in range(100):\n    pass').ops > exec('for i in range(10):\n    pass').ops * 5);
  assert.ok(a.peakCells >= 20 && a.peakCells < 100, `peakCells ${a.peakCells}`);
  assert.equal(exec('xs = list(range(1000))').peakCells, 1000);
  assert.ok(exec('def f():\n    a = [0] * 400\n    return len(a)\nf()').peakCells >= 400);
  // bubble sort is quadratic, merge sort is n log n
  const bubble = (n) => exec(`xs = [(i * 7919) % ${n} for i in range(${n})]\nfor i in range(${n}):\n    for j in range(${n} - 1 - i):\n        if xs[j] > xs[j + 1]:\n            xs[j], xs[j + 1] = xs[j + 1], xs[j]\n`, { maxOps: 1e8 }).ops;
  assert.ok(bubble(300) / bubble(100) > 7, 'about 9 times the work for 3 times the data');
  // built-ins cost their complexity: sorted is n log n, "in" on a list is n, on a set it is 1
  const cost = (src) => exec(src).ops;
  assert.ok(cost('xs = list(range(1000))\nsorted(xs)') - cost('xs = list(range(1000))') >= 9000);
  assert.ok(cost('xs = list(range(1000))\n999 in xs') - cost('xs = list(range(1000))') >= 1000);
  assert.ok(cost('s = set(range(1000))\n999 in s') - cost('s = set(range(1000))') < 10);
});

test('the same Program can be run again and with different options', () => {
  const c = compile('print(n * 2)\nn = k');
  assert.ok(c.ok);
  const a = run(c.program, { globals: { n: 4, k: 1 } });
  assert.equal(a.stdout, '8\n');
  const b = run(c.program, { globals: { n: 5, k: 1 } });
  assert.equal(b.stdout, '10\n');
  const e = run(c.program);
  assert.equal(e.ok, false);
  assert.equal(e.error.kind, 'NameError');
});

test('values convert between JS and Snek by the pinned table', () => {
  const g = (src, globals) => exec(src, { globals });
  assert.equal(g('x = a + b\nx', { a: 1, b: 2 }).value, 3);
  assert.equal(g('print(a, b, c, d, e)', { a: 1, b: 1.5, c: true, d: null, e: undefined }).stdout, '1 1.5 True None None\n');
  assert.equal(g('print(f)', { f: { $float: 2 } }).stdout, '2.0\n');
  assert.equal(g('print(a, a[1])', { a: [1, [2, 3]] }).stdout, '[1, [2, 3]] [2, 3]\n');
  assert.equal(g('print(t, t[0])', { t: { $tuple: [1, 2] } }).stdout, '(1, 2) 1\n');
  assert.equal(g('print(len(s), 2 in s)', { s: { $set: [1, 2, 2, 3] } }).stdout, '3 True\n');
  assert.equal(g('print(d["a"], d["b"]["c"], d)', { d: { a: 1, b: { c: 2 } } }).stdout, "1 2 {'a': 1, 'b': {'c': 2}}\n");
  assert.equal(g('r = double(21)\nr', { double: (x) => x * 2 }).value, 42);
  // back to JS
  assert.deepEqual(exec('[1, 2.5, "s"]').value, [1, 2.5, 's']);
  assert.deepEqual(exec('(1, 2)').value, { $tuple: [1, 2] });
  assert.deepEqual(exec('{3, 1, 2}').value, { $set: [3, 1, 2] });
  assert.deepEqual(exec('{"a": 1, "b": [2]}').value, { a: 1, b: [2] });
  assert.deepEqual(exec('{1: "x", "k": 2}').value, { $dict: [[1, 'x'], ['k', 2]] });
  assert.deepEqual(exec('class P:\n    def __init__(self):\n        self.x = 1\nP()').value, { $object: 'P', attrs: { x: 1 } });
  assert.deepEqual(exec('def f():\n    pass\nf').value, { $function: 'f' });
  assert.equal(exec('2.0').value, 2);
  assert.equal(Object.getPrototypeOf(exec('{"a": 1}').value), Object.prototype);
});

test('callFunction runs the module first, then the function', () => {
  const c = compile('print("module")\ndef add(a, b):\n    print("in add")\n    return a + b\ndef nested(xs):\n    xs.append(4)\n    return {"n": len(xs), "t": (1, 2)}\n');
  assert.ok(c.ok);
  const r = callFunction(c.program, 'add', [2, 3]);
  assert.equal(r.ok, true);
  assert.equal(r.value, 5);
  assert.equal(r.stdout, 'module\nin add\n');
  assert.ok(r.ops > 0);
  assert.deepEqual(callFunction(c.program, 'nested', [[1, 2, 3]]).value, { n: 4, t: { $tuple: [1, 2] } });
  const missing = callFunction(c.program, 'nope', []);
  assert.equal(missing.ok, false);
  assert.equal(missing.error.kind, 'NameError');
  assert.ok(missing.error.message.includes('nope'));
  assert.equal(callFunction(c.program, 'add', [1]).error.kind, 'TypeError');
});

test('step yields line events and variables like CPython', () => {
  const { events: ev, result } = events('x = 1\nfor i in range(2):\n    x += i\nprint(x)\n');
  assert.equal(result.ok, true);
  assert.equal(result.stdout, '2\n');
  assert.deepEqual(ev.map((e) => e.line), [1, 2, 3, 2, 3, 2, 4]);
  assert.deepEqual(ev[0].vars, {});
  assert.deepEqual(ev[3].vars, { x: 1, i: 0 });
  assert.deepEqual(ev.at(-1).vars, { x: 2, i: 1 });
});

test('step: functions, classes, try and loop forms', () => {
  const lines = (src) => events(src).events.map((e) => e.line);
  assert.deepEqual(lines('def f(n):\n    return n\nf(1)\nf(2)\n'), [1, 3, 2, 4, 2]);
  assert.deepEqual(lines('i = 0\nwhile i < 2:\n    i += 1\nelse:\n    i = 9\n'), [1, 2, 3, 2, 3, 2, 5]);
  assert.deepEqual(lines('a = 1\nif a == 2:\n    a = 5\nelif a == 1:\n    a = 6\nelse:\n    a = 7\n'), [1, 2, 4, 5]);
  assert.deepEqual(lines('try:\n    x = 1 / 0\nexcept ZeroDivisionError:\n    x = 2\nprint(x)\n'), [1, 2, 3, 4, 5]);
  assert.deepEqual(lines('class A:\n    def f(self):\n        pass\na = A()\n'), [1, 1, 2, 4]);
  assert.deepEqual(lines('for i in range(0):\n    pass\n'), [1]);
  assert.deepEqual(lines('x = 1; y = 2\n'), [1]);
  assert.deepEqual(lines('def f(a, b=1):\n    c = a + b\n    return c\nprint(f(1))\n'), [1, 4, 2, 3]);
});

test('step: host functions pause before they run', () => {
  const log = [];
  const g = step(compile('move()\nfor i in range(2):\n    turn(i)\nprint("done")\n').program, {
    globals: { move: () => { log.push('move'); }, turn: (i) => { log.push('turn' + i); } },
  });
  let n = g.next();
  assert.deepEqual(n.value, { kind: 'line', line: 1, vars: {} });
  n = g.next();
  assert.deepEqual(n.value, { kind: 'call', line: 1, name: 'move', args: [] });
  assert.deepEqual(log, []); // not run yet
  n = g.next();
  assert.deepEqual(log, ['move']);
  assert.equal(n.value.kind, 'line');
  while (!n.done && !(n.value.kind === 'call' && n.value.name === 'turn')) n = g.next();
  assert.deepEqual(n.value.args, [0]);
  assert.deepEqual(log, ['move']);
  while (!n.done) n = g.next();
  assert.deepEqual(log, ['move', 'turn0', 'turn1']);
  assert.equal(n.value.ok, true);
  assert.equal(n.value.stdout, 'done\n');
});

test('step: a throwing host function ends the run with RuntimeError', () => {
  const src = 'try:\n    move()\nexcept Exception:\n    print("swallowed")\nprint("after")\n';
  const { result } = events(src, { globals: { move: () => { throw new Error('wall ahead'); } } });
  assert.equal(result.ok, false);
  assert.equal(result.error.kind, 'RuntimeError');
  assert.ok(result.error.message.includes('wall ahead'));
  assert.ok(oneSentence(result.error.message));
  assert.equal(result.stdout, '');
});

test('step: vars leave out functions, classes, modules and host functions', () => {
  const { events: ev } = events('import math\nclass C:\n    pass\ndef f():\n    pass\nx = [1, (2, 3)]\ny = 2.0\nz = 1\n', { globals: { move: () => {} } });
  assert.deepEqual(ev.at(-1).vars, { x: [1, { $tuple: [2, 3] }], y: 2 });
});

test('step errors end with an error result', () => {
  const { events: ev, result } = events('x = 1\ny = x / 0\n');
  assert.equal(ev.length, 2);
  assert.equal(result.ok, false);
  assert.equal(result.error.kind, 'ZeroDivisionError');
  assert.equal(result.error.line, 2);
});

test('step events obey the op limit', () => {
  const { result } = events('while True:\n    pass\n', { maxOps: 100 });
  assert.equal(result.error.kind, 'TooManySteps');
});

test('the sandbox refuses access to the page and to Node', () => {
  const refused = [
    ['f = open("x")', 'open'],
    ['import os', 'os'],
    ['import sys', 'sys'],
    ['from os import path', 'os'],
    ['m = __import__("os")', '__import__'],
    ['eval("1 + 1")', 'eval'],
    ['exec("x = 1")', 'exec'],
    ['getattr(1, "real")', 'getattr'],
    ['globals()', 'globals'],
    ['x = (1).__class__', '__class__'],
    ['def f():\n    pass\nf.__globals__', '__globals__'],
    ['x = [].__class__.__bases__', '__class__'],
  ];
  for (const [src, word] of refused) {
    const e = failure(src);
    assert.ok(['NotAllowed', 'SyntaxError'].includes(e.kind), src);
    assert.ok(e.message.includes(word), `${src} -> ${e.message}`);
    assert.ok(oneSentence(e.message));
  }
  // a learner's own variable may share a refused name
  assert.equal(out('open = 3\nprint(open)'), '3\n');
  // JS object internals are not reachable through names or attributes
  assert.equal(failure('"abc".constructor').kind, 'AttributeError');
  assert.equal(failure('[].toString').kind, 'AttributeError');
  assert.equal(out('constructor = 1\ntoString = 2\nprint(constructor + toString)'), '3\n');
  assert.equal(out('d = {"__proto__": 1, "constructor": 2}\nprint(d["__proto__"], d["constructor"])'), '1 2\n');
});

test('unsupported features say so', () => {
  for (const src of ['with open(1) as f:\n    pass', 'def f():\n    yield 1', 'x = 1\ndef f():\n    global x', '@d\ndef f():\n    pass', 'async def f():\n    pass', 'lambda: (yield)']) {
    const c = compile(src);
    assert.equal(c.ok, false, src);
    assert.ok(oneSentence(c.error.message));
  }
  assert.equal(failure('"{}".format(1)').kind, 'AttributeError');
  assert.equal(failure('"%d" % 5').kind, 'TypeError');
});

test('deque, heapq and math', () => {
  assert.equal(out('from collections import deque\nq = deque([1, 2, 3])\nq.append(4)\nq.appendleft(0)\nprint(q.popleft(), q.pop(), len(q), list(q))'), '0 4 3 [1, 2, 3]\n');
  assert.equal(out('import heapq\nh = []\nfor v in [5, 1, 8, 3]:\n    heapq.heappush(h, v)\nprint([heapq.heappop(h) for _ in range(4)])\nxs = [9, 4, 7, 1]\nheapq.heapify(xs)\nprint(xs[0])'), '[1, 3, 5, 8]\n1\n');
  assert.equal(out('import math\nprint(math.floor(3.7), math.ceil(3.2), math.sqrt(16), math.inf > 10 ** 15, -math.inf < 0)'), '3 4 4.0 True True\n');
  assert.equal(out('import collections\nq = collections.deque()\nq.append(1)\nprint(q)'), 'deque([1])\n');
  assert.equal(failure('from collections import defaultdict').kind, 'NameError');
  assert.equal(failure('import heapq\nheapq.heappop([])').kind, 'IndexError');
});

test('every error message is one plain sentence', () => {
  const bad = [
    'print(a)', 'x = [1][5]', 'x = {}["a"]', '1 + "a"', 'len(5)', 'int("x")', 'float("y")', 'a, b = 1, 2, 3', 'x = None.foo',
    'def f(a): pass\nf()', 'def f(a): pass\nf(1, 2)', 'def f(a): pass\nf(b=1)', 'max([])', 'sorted([1, "a"])', 'x = 1\nx()',
    'for i in 5: pass', 'chr(-1)', '[].pop()', '{}.pop(1)', 'range(0, 1, 0)', 'import math\nmath.sqrt(-1)', 'raise ValueError', 'raise ValueError("a\\nb")',
    'assert False', 'assert 1 == 2, "x" * 500', 'x = 1 / 0', 'x = 1 % 0', 'x = 2 ** 0.5 ** 99999 + 1 // 0', 'print(zz)', 'if', 'x = (', 'x = )', 'for', 'def', 'class', 'x ==', '1 +',
  ];
  for (const src of bad) {
    const e = failure(src);
    assert.ok(oneSentence(e.message), `${src} -> ${JSON.stringify(e.message)}`);
    assert.ok(Number.isInteger(e.line) && e.line >= 1 && Number.isInteger(e.col) && e.col >= 1, src);
  }
});

test('random garbage never crashes the interpreter', () => {
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const pieces = ['x', '=', '1', '"s"', '(', ')', '[', ']', ':', '\n', '    ', 'if', 'else', 'for', 'in', 'range', 'def', 'f', ',', '+', '*', '.', 'print', 'while', 'return', 'class', 'lambda', '{', '}', '-', '2.5'];
  for (let i = 0; i < 400; i++) {
    let src = '';
    for (let k = 0; k < 4 + Math.floor(rnd() * 20); k++) src += pieces[Math.floor(rnd() * pieces.length)] + (rnd() < 0.5 ? ' ' : '');
    const c = compile(src);
    if (c.ok) {
      const r = run(c.program, { maxOps: 2000 });
      if (!r.ok) assert.ok(oneSentence(r.error.message), `${JSON.stringify(src)} -> ${r.error.message}`);
      for (const _ of step(c.program, { maxOps: 500 })) { /* drain */ }
    } else assert.ok(oneSentence(c.error.message), `${JSON.stringify(src)} -> ${c.error.message}`);
  }
});

test('long programs and deep expressions stay inside the limits', () => {
  assert.equal(compile('x = ' + '('.repeat(30000) + '1' + ')'.repeat(30000)).ok, false);
  const r = exec('def f(n):\n    return 0 if n == 0 else 1 + f(n - 1)\nprint(f(150))');
  assert.equal(r.stdout, '150\n');
  const deep = exec('def f(n):\n    return f(n + 1)\nf(0)', { maxDepth: 100000 });
  assert.equal(deep.error.kind, 'TooDeep');
  assert.ok(oneSentence(deep.error.message));
});

test('the bubble sort at n = 1000 runs fast enough', () => {
  const src = 'seed = 12345\ndata = []\nfor i in range(1000):\n    seed = (seed * 75 + 74) % 65537\n    data.append(seed % 1000)\nn = len(data)\nfor i in range(n):\n    for j in range(n - 1 - i):\n        if data[j] > data[j + 1]:\n            data[j], data[j + 1] = data[j + 1], data[j]\nprint(data[0], data[-1], len(data))';
  const t = Date.now();
  const r = exec(src, { maxOps: 100000000 });
  assert.equal(r.ok, true);
  assert.ok(r.ops > 5_000_000);
  assert.ok(Date.now() - t < 3000, `took ${Date.now() - t} ms`);
});
