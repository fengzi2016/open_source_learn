// 字符流分析器
function InputStream(input) {
    let pos = 0, col = 0, line = 1;
    return {
        // 移动到下一位
        next,
        // 返回下一位
        peek,
        // 是否到末尾
        eof,
        // 解析报错
        croak
    };
    function next() {
        const char = input.charAt(pos++);
        if (char === '\n') {
            line++;
            col = 0;
        } else {
            col++;
        }
        return char;
    }

    function peek() {
        return input.charAt(pos);
    }

    function eof() {
        return peek() === '';
    }

    function croak(msg) {
        throw new Error(`${msg} (${line}:${col})`);
    }
}
module.exports = InputStream;