const FALSE = { type: "bool", value: false };
function make_js(exp) {
    return js(exp);

    function js(exp) {
        switch (exp.type) {
            case "num":
            case "str":
            case "bool": return js_atom(exp);
            case "var": return js_var(exp);
            case "binary": return js_binary(exp);
            case "assign": return js_assign(exp);
            case "let": return js_let(exp);
            case "func": return js_func(exp);
            case "if": return js_if(exp);
            case "prog": return js_prog(exp);
            case "call": return js_call(exp);
            default:
                throw new Error("Dunno how to make_js for " + JSON.stringify(exp));
        }
    }

    function js_atom(exp) {
        return JSON.stringify(exp.value);
    }

    function make_var(name) {
        return name;
    }

    function js_var(exp) {
        return make_var(exp.value);
    }

    function js_binary(exp) {
        return "(" + js(exp.left) + transform_operator(exp.operator) + js(exp.right) + ")";
    }

    function transform_operator(operator) {
        switch (operator) {
            case '为': return '=';
            case '加': return '+';
            case "减": return '-';
            case '乘': return '*';
            case '除': return '/';
            case '余': return '%';
            case '等于': return '==';
        }
    }

    function js_assign(exp) {
        return js_binary(exp);
    }

    function js_func(exp) {
        var code = "(function ";
        if (exp.name)
            code += make_var(exp.name);
        code += "(" + exp.vars.map(make_var).join(", ") + ") {";
        code += "return " + js(exp.body) + " })";
        return code;
    }

    function js_let(exp) {
        if (exp.vars.length == 0) {
            return js(exp.body);
        }
        var iife = {
            type: "call",
            func: {
                type: "func",
                vars: [exp.vars[0].name],
                body: {
                    type: "let",
                    vars: exp.vars.slice(1),
                    body: exp.body
                }
            },
            args: [exp.vars[0].def || FALSE]
        };
        console.log('iife', iife);
        return "(" + js(iife) + ")";
    }

    function js_if(exp) {
        return "("
            + js(exp.cond) + " !== false"
            + " ? " + js(exp.then)
            + " : " + js(exp.else || FALSE)
            + ")";
    }

    function js_prog(exp) {
        return "(" + exp.prog.map(js).join(", ") + ")";
    }
    function js_call(exp) {
        return js(exp.func) + "(" + exp.args.map(js).join(", ") + ")";
    }
}



module.exports = make_js