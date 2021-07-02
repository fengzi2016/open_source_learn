function evaluate(exp, env, callback) {
    switch (exp.type) {
        case "num":
        case "str":
        case "bool":
            return callback(exp.value);
        case 'var':
            return callback(env.get(exp.value));
        case 'assign':
            if (exp.left.type != "var")
                throw new Error("Cannot assign to " + JSON.stringify(exp.left));
            return evaluate(exp.right, env, function (right) { callback(env.set(exp.left.value, right)) });
        case 'binary':

            evaluate(exp.left, env, function (left) {
                evaluate(exp.right, env, function (right) {
                    callback(apply_op(exp.operator, left, right));
                });
            });
            return;
        case 'func':
            callback(make_func(env, exp));
            return;
        case "let":
            // 当还有let变量未定义时用loop继续定义作用域变量
            // 否则执行exp.body，exp.body执行时的scope已经记录好了所有的let变量
            (function loop(env, i) {
                if (i < exp.vars.length) {
                    var v = exp.vars[i];
                    if (v.def) evaluate(v.def, env, function (value) {
                        var scope = env.extend();
                        scope.def(v.name, value);
                        loop(scope, i + 1);
                    }); else {
                        var scope = env.extend();
                        scope.def(v.name, false);
                        loop(scope, i + 1);
                    }
                } else {
                    evaluate(exp.body, env, callback);
                }
            })(env, 0);
            return;
        case 'if':
            evaluate(exp.cond, env, function (cond) {
                if (cond !== false) evaluate(exp.then, env, callback);
                else if (exp.else) evaluate(exp.else, env, callback);
                else callback(false);
            });
            return;
        case 'prog':

            (function loop(last, i) {
                if (i < exp.prog.length) evaluate(exp.prog[i], env, function (val) {
                    loop(val, i + 1);
                }); else {
                    callback(last);
                }
            })(false, 0);
            return;
        case "call":

            evaluate(exp.func, env, function (func) {
                (function loop(args, i) {
                    if (i < exp.args.length) evaluate(exp.args[i], env, function (arg) {
                        args[i + 1] = arg;
                        loop(args, i + 1);
                    }); else {
                        func.apply(null, args);
                    }
                })([callback], 0);
            });
            return;
        default:
            throw new Error("无法执行" + exp.type)
    }
}

function apply_op(op, a, b) {
    function num(x) {
        if (typeof x !== 'number') {
            throw new Error('希望获取到数字但是获取到' + x);
        }
        return x;
    }

    function div(x) {
        if (num(x) === 0) {
            throw new Error("除以0")
        }
        return x;
    }

    switch (op) {
        case "加": return num(a) + num(b);
        case "减": return num(a) - num(b);
        case "乘": return num(a) * num(b);
        case "除": return num(a) / div(b);
        case "模": return num(a) % div(b);
        case "并": return a !== false && b;
        case "或": return a !== false ? a : b;
        case '等于': return a == b;
        case "小于": return a < b;
    }
    throw new Error("不能操作的符号" + op);
}


function make_func(env, exp) {
    function func(callback) {
        const names = exp.vars;
        const scope = env.extend();
        for (let i = 0; i < names.length; i++) {
            scope.def(names[i], i + 1 < arguments.length ? arguments[i + 1] : false);
        }
        evaluate(exp.body, scope, callback);
    };
    return func;
}


module.exports = evaluate;