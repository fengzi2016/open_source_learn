const FALSE = { type: "bool", value: false };
// 操作符号权重

const PRECEDENCE = {
    "为": 1,
    "等于": 1.5,
    "小于": 1.5,
    "或": 2,
    "并": 3,
    "加": 10, "减": 10,
    "乘": 20, "除": 20, "余": 20,
};

// 解析token
function parse(input) {
    return parse_toplevel();
    // 解析整个程序 根节点prog
    function parse_toplevel() {
        const prog = [];
        while (!input.eof()) {
            prog.push(parse_expression());
            // 表达式以分号分割
            if (!input.eof()) skip_punc("；");
        }
        return { type: 'prog', prog }
    }
    // 解析表达式，表达式可能是调用，可能是定义，
    function parse_expression() {
        return maybe_call(function () {
            return maybe_binary(parse_atom(), 0);
        })
    }
    // 解析调用表达式
    function maybe_call(exp) {
        const expr = exp();
        // 如果下一个token是(
        return is_punc('（') ? parse_call(expr) : expr;
    }

    // 解析调用表达式
    function parse_call(func) {
        return {
            type: 'call',
            func,
            args: delimited('（', '）', '，', parse_expression)
        }
    }
    // 解析带操作权重的表达式
    function maybe_binary(left, my_prec) {
        const tok = is_op();

        if (tok) {
            const next_prec = PRECEDENCE[tok.value];
            if (next_prec > my_prec) {
                input.next();
                return maybe_binary({
                    type: tok.value === '为' ? 'assign' : 'binary',
                    operator: tok.value,
                    left,
                    right: maybe_binary(parse_atom(), next_prec)
                }, my_prec)
            }
        }
        return left;
    }


    // 分解原子表达式
    function parse_atom() {
        return maybe_call(function () {
            if (is_punc('（')) {
                input.next();
                const exp = parse_expression();
                skip_punc('）');
                return exp;
            }
            if (is_punc('「')) {
                return parse_prog();
            }
            if (is_kw('定义')) return parse_let();
            if (is_kw('如果')) {
                return parse_if();
            }
            if (is_kw('真') || is_kw('假')) return parse_bool();
            if (is_kw('函数')) {
                input.next();
                return parse_func();
            }
            const tok = input.next();

            if (tok.type === 'var' || tok.type === 'num' || tok.type === 'str') {
                return tok;
            }
            unexpected();
        })
    }

    // 分解块
    function parse_prog() {
        const prog = delimited('「', '」', '；', parse_expression);
        if (prog.length === 0) return FALSE;
        if (prog.length === 1) return prog[0];
        return { type: 'prog', prog };
    }

    // 分解if语句
    function parse_if() {
        skip_kw('如果');
        const cond = parse_expression();
        if (!is_punc('「')) skip_kw('则');
        const then = parse_expression();
        const ret = {
            type: 'if',
            cond,
            then
        }
        if (is_kw('否则')) {
            input.next();
            ret.else = parse_expression();
        }
        return ret;
    }

    // 解析bool
    function parse_bool() {
        return {
            type: 'bool',
            value: input.next().value === '真'
        }
    }

    // 解析函数
    function parse_func() {
        return {
            type: 'func',
            name: input.peek().type === 'var' ? input.next().value : null,
            vars: delimited('（', '）', '，', parse_varname),
            body: parse_expression()
        }
    }

    // 解析参数
    function parse_varname() {
        const name = input.next();
        if (name.type !== 'var') input.croak('此处期望变量名');
        return name.value;
    }

    // 解析let
    function parse_let() {
        skip_kw('定义');
        if (input.peek().type === 'var') {
            const name = input.next().value;
            const defs = delimited("（", "）", "，", parse_vardef);
            return {
                type: 'call',
                func: {
                    type: 'func',
                    name,
                    vars: defs.map((def) => def.name),
                    body: parse_expression()
                },
                args: defs.map((def) => def.def || FALSE)
            }
        }
        return {
            type: 'let',
            vars: delimited('（', '）', '，', parse_vardef),
            body: parse_expression()
        }
    }

    // 解析let定义的变量列表
    function parse_vardef() {
        let name = parse_varname(), def;
        if (is_op('为')) {
            input.next();
            def = parse_expression();
        }
        return { name, def };
    }

    // 组合多个连续的、可以组成表达式的 token 
    function delimited(start, end, separator, parser) {
        const a = [];
        let first = true;
        // 删除开始的符号
        skip_punc(start);
        // token 数组里还有值
        while (!input.eof()) {
            // 碰到关闭符号
            if (is_punc(end)) break;
            // 开始符号后面的第一个token不会是分隔符
            if (first) {
                first = false;
            } else {
                skip_punc(separator);
            }
            if (is_punc(end)) {
                break;
            }
            // 将不是符号的token解析后塞入结果
            a.push(parser())
        }
        skip_punc(end);
        return a;
    }


    function is_punc(ch) {
        const tok = input.peek();
        return tok && tok.type === 'punc' && (!ch || tok.value === ch) && tok;
    }

    function skip_punc(ch) {
        if (is_punc(ch)) {
            input.next();
        } else {
            input.croak(`期望的符号是 "${ch}"`)
        }
    }

    function is_op(op) {
        const tok = input.peek();

        return tok && tok.type === 'op' && (!op || tok.value === op) && tok;
    }

    function is_kw(kw) {
        const tok = input.peek();
        return tok && tok.type === 'kw' && (!kw || tok.value === kw) && tok;
    }

    function skip_kw(kw) {
        if (is_kw(kw)) { input.next(); }
        else input.croak(`期望的关键字是:${kw}`)
    }
    function skip_op(op) {
        if (is_op(op)) {
            input.next();
        } else {
            input.croak(`期望的操作是${op}`)
        }
    }
    function unexpected() {
        input.croak(`不被期望出现的token` + JSON.stringify(input))
    }
}

module.exports = parse