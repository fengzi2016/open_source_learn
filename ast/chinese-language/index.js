

const InputStream = require('./InputStream');
const parse = require('./parse');
const TokenStream = require('./TokenStream');
const Environment = require('./environment');
const evaluate = require('./evaluate');
const makeJs = require('./generator')

const chineseAdd = `相加 为 函数（甲，乙） 甲 加 乙；打印（相加（3，4））`;
const chineseDemo = `定义（甲 为 2，乙 为 甲 加 7，丙 为 甲 加 乙）打印（甲 加 乙 加 丙）`;
const ifDemo = `如果（2 减 1 等于 1）「打印（666）」`;

const token = TokenStream(InputStream(chineseDemo));

const ast = parse(token);
// console.log(JSON.stringify(ast));
// const globalEnv = new Environment();

// globalEnv.def("打印", function (txt) {
//     console.log(txt)
// });

// evaluate(ast, globalEnv);

global.打印 = function (txt) {
    console.log(txt);
}

const code = makeJs(ast);
console.log(code);
eval(code);

