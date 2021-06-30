function Environment(parent) {
    this.vars = Object.create(parent ? parent.vars : null);
    this.parent = parent;
}

Environment.prototype = {
    extend: function () {
        return new Environment(this);
    },
    lookup: function (name) {
        let scope = this;
        while (scope) {
            if (Object.prototype.hasOwnProperty.call(scope.vars, name)) {
                return scope;
            }
            scope = scope.parent;
        }
    },
    get: function (name) {
        if (name in this.vars) {
            return this.vars[name];
        }
        throw new Error(`未定义的变量：${name}`)
    },
    set: function (name, value) {
        const scope = this.lookup(name);
        // 不允许在嵌套环境内定义全局变量
        if (!scope && this.parent) {
            throw new Error(`未定义的变量：${name}`)
        }
        return (scope || this).vars[name] = value;
    },
    def: function (name, value) {
        return this.vars[name] = value
    }

}


module.exports = Environment;