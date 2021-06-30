function evaluate(exp, env) {
    switch (exp.type) {
        case "num":
        case "str":
        case "bool":
            return exp.value;
        case 'var':
            return env.get(exp.value);
        case 'assign':

            return env.set(exp.left.value, evaluate(exp.right, env));
        case 'binary':

            return apply_op(exp.operator, evaluate(exp.left, env), evaluate(exp.right, env));
        case 'func':

            return make_func(env, exp);
        case "let":
            exp.vars.forEach(function (v) {
                const scope = env.extend();
                scope.def(v.name, v.def ? evaluate(v.def, env) : false);
                env = scope;
            });
            return evaluate(exp.body, env);
        case 'if':

            const cond = evaluate(exp.cond, env);
            if (cond !== false) return evaluate(exp.then, env);
            return exp.else ? evaluate(exp.else, env) : false;
        case 'prog':

            let val = false;
            exp.prog.forEach(function (exp) {
                val = evaluate(exp, env);
            });
            return val;
        case "call":

            const func = evaluate(exp.func, env);
            return func.apply(null, exp.args.map(function (arg) {
                return evaluate(arg, env);
            }));
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
    }
    throw new Error("不能操作的符号" + op);
}

function make_func(env, exp) {
    if (exp.name) {
        env = env.extend();
        env.def(exp.name, func);
    }
    function func() {
        const names = exp.vars;
        const scope = env.extend();
        for (let i = 0; i < names.length; i++) {
            scope.def(names[i], i < arguments.length ? arguments[i] : false);
        }
        return evaluate(exp.body, scope);
    }
    return func;
}

function make_func2(env, exp) {
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

function evaluate2(exp, env, callback) {
    switch (exp.type) {
        case "num":
        case "str":
        case "bool":
            return callback(exp.value);

        case 'var':
            return callback(env.get(exp.value));

        case 'assign':
            if (exp.left.type !== 'var') {
                throw new Error("不能将变量赋值给" + JSON.stringify(exp.left));
            }
            return evaluate(exp.right, env, function (right) { callback(env.set(exp.left.value, right)) });

        case 'binary':
            return evaluate(exp.left, ev, function (left) {
                evaluate(exp.right, env, function (right) {
                    callback(apply_op(exp.operator, left, right));
                })
            })

        case 'func':
            return callback(make_func2(env, exp));

        case "let":
            (function loop(env, i) {
                if (i < exp.vars.length) {
                    const v = exp.vars[i];
                    if (v.def) {
                        evaluate(v.def, env, function (value) {
                            const scope = env.extend();
                            scope.def(v.name, value);
                            loop(scope, i + 1);
                        })
                    } else {
                        const scope = env.extend();
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
                if (i < exp.prog.length) {
                    evaluate(exp.prog[i], env, function (val) {
                        loop(val, i + 1);
                    })
                } else {
                    callback(last);
                }
            })(false, 0);
            return;

        case "call":
            evaluate(exp.func, env, function (func) {
                (function loop(args, i) {
                    if (i < exp.args.length) {
                        evaluate(exp.args[i], env, function (arg) {
                            args[i + 1] = arg;
                            loop(args, i + 1);
                        })
                    } else {
                        func.apply(null, args);
                    }
                })([callback], 0);
            });
            return;

        default:
            throw new Error("无法执行" + exp.type)
    }
}

module.exports = evaluate;