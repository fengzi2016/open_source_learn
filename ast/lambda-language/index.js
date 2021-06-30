

const InputStream = require('./InputStream');
const parse = require('./parse');
const TokenStream = require('./TokenStream');
const Environment = require('./environment');
const evaluate = require('./evaluate');

const code = "sum = lambda(x, y) x + y; print(sum(2,4));";
const loop = `println(let loop (n = 100)
if n > 0 then n + loop(n - 1)
         else 0); `
const add = `let (x = 2, y = x + 1, z = x + y)
println(x + y + z);`
const fib = `fib = λ(n) if n < 2 then n else fib(n - 1) + fib(n - 2);
time( λ() println(fib(10)) );`
const chineseAdd = `相加 为 函数（甲，乙） 甲 加 乙；打印（相加（三，四））`
const token = TokenStream(InputStream(fib));

const ast = parse(token);
console.log(JSON.stringify(ast));
const globalEnv = new Environment();

globalEnv.def("print", function (txt) {
    console.log(txt)
});
globalEnv.def('println', function (callback, txt) {
    console.log(txt);
    callback(false);

});
globalEnv.def("time", function (fn) {
    var t1 = Date.now();
    var ret = fn();
    var t2 = Date.now();
    console.log("Time: " + (t2 - t1) + "ms");
    return ret;
});

evaluate(ast, globalEnv, function (result) {
    console.log('result', result)
});



// 分析本质
// 1. 从左往右读取的流式token
// 2. token对应节点顺序是树前序遍历的分解
// 3. 利用了递归（前序遍历）来构造ast，每个节点根据其type具有特殊的属性
// 4. evaluate 也是递归（前序遍历）得执行不同的节点