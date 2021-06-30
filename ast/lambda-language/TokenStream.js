// { type: "punc", value: "(" }           // punctuation: parens, comma, semicolon etc.
// { type: "num", value: 5 }              // numbers
// { type: "str", value: "Hello World!" } // strings
// { type: "kw", value: "lambda" }        // keywords
// { type: "var", value: "a" }            // identifiers
// { type: "op", value: "!=" }            // operators
// 词法解析器
function TokenStream(input) {
    let current = null;
    // 关键词数组
    const keywords = " let if then else function lambda λ true ";

    return {
        // 移动到下一个token 词组
        next,
        peek,
        eof,
        croak: input.croak
    };
    function peek() {
        return current || (current = read_next());
    }
    function next() {
        let tok = current;
        current = null;
        return tok || read_next();
    }
    function eof() {
        return peek() === null;
    }
    // 读取下一个词组
    function read_next() {
        read_while(is_whitespace);
        if (input.eof()) return null;
        const char = input.peek();
        if (char === '#') {
            skip_comment();
            return read_next();
        }
        if (char === '"') return read_string();
        if (is_digit(char)) return read_number();
        if (is_id_start(char)) return read_ident();
        // 符号
        if (is_punc(char)) {
            return {
                type: 'punc',
                value: input.next()
            }
        }
        // 操作符
        if (is_op_char(char)) {
            return {
                type: 'op',
                value: read_while(is_op_char)
            }
        }
        input.croak('无法解析的字符:' + char);
    }
    function is_keyword(x) {
        return keywords.indexOf(" " + x + " ") >= 0;
    }
    function is_digit(ch) {
        return /[0-9]/i.test(ch);
    }
    function is_id_start(ch) {
        return /[a-zλ_]/i.test(ch);
    }
    function is_id(ch) {
        return is_id_start(ch) || '?!-<>=123456789'.indexOf(ch) >= 0;
    }
    function is_op_char(ch) {
        return '+-*/%=&|<>!'.indexOf(ch) >= 0;
    }
    function is_punc(ch) {
        return ",;(){}[]".indexOf(ch) >= 0;
    }
    function is_whitespace(ch) {
        return " \t\n".indexOf(ch) >= 0;
    }
    // 连续读取属于predicate类型的字符
    function read_while(predicate) {
        let str = '';
        while (!input.eof() && predicate(input.peek())) {
            str += input.next();
        }
        return str;
    }

    function read_number() {
        let has_dot = false;
        let number = read_while(function (ch) {
            if (ch === '.') {
                if (has_dot) {
                    return false;
                }
                has_dot = true;
                return true;
            }
            return is_digit(ch);
        });
        return { type: 'num', value: parseFloat(number) };
    }

    function read_ident() {
        const id = read_while(is_id);
        return {
            type: is_keyword(id) ? 'kw' : 'var',
            value: id
        }
    }
    // 读取带反编译\\的字符串
    function read_escaped(end) {
        var escaped = false, str = '';
        input.next();
        while (!input.eof()) {
            let ch = input.next();
            if (escaped) {
                str += ch;
                escaped = false;
            } else if (ch === '\\') {
                escaped = true;
            } else if (ch === end) {
                break;
            } else {
                str += ch;
            }
        }
        return str;
    }

    function read_string() {
        return { type: 'str', value: read_escaped('"') };
    }

    function skip_comment() {
        read_while(function (ch) { return ch !== '\n' });
        input.next();
    }
}
module.exports = TokenStream;