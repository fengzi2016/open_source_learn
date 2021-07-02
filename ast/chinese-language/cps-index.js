const InputStream = require('./InputStream');
const parse = require('./parse');
const TokenStream = require('./TokenStream');
const Environment = require('./environment');
const evaluate = require('./cps-evaluate');
const makeJs = require('./generator')


const code = `相加 为 函数（甲，乙） 甲 加 乙；打印（相加（3，4））`;
const code2 = `斐波那契数列 为 函数（n） 如果 n 小于 2 则 n 否则 斐波那契数列（n 减 1） 加 斐波那契数列（n 减 2）；时间（函数（）打印（斐波那契数列（20）））`
const ast = parse(TokenStream(InputStream(code2)));
const globalEnv = new Environment();

globalEnv.def("时间", function (k, func) {
    console.time("time");
    func(function (ret) {
        console.timeEnd("time");
        k(ret);
    });
});

globalEnv.def("打印", function (callback, txt) {
    console.log(txt);
    callback(txt);
});

// run the evaluator
evaluate(ast, globalEnv, function (result) {
    console.log("result", result);
});