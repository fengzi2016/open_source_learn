// App statuses
export const NOT_LOADED = "NOT_LOADED";
export const LOADING_SOURCE_CODE = "LOADING_SOURCE_CODE";
export const NOT_BOOTSTRAPPED = "NOT_BOOTSTRAPPED";
export const BOOTSTRAPPING = "BOOTSTRAPPING";
export const NOT_MOUNTED = "NOT_MOUNTED";
export const MOUNTING = "MOUNTING";
export const MOUNTED = "MOUNTED";
export const UPDATING = "UPDATING";
export const UNMOUNTING = "UNMOUNTING";
export const UNLOADING = "UNLOADING";
export const LOAD_ERROR = "LOAD_ERROR";
export const SKIP_BECAUSE_BROKEN = "SKIP_BECAUSE_BROKEN";

// Object.assign() is not available in IE11. And the babel compiled output for object spread
// syntax checks a bunch of Symbol stuff and is almost a kb. So this function is the smaller replacement.
export function assign() {
    for (let i = arguments.length - 1; i > 0; i--) {
        for (let key in arguments[i]) {
            if (key === "__proto__") {
                continue;
            }
            arguments[i - 1][key] = arguments[i][key];
        }
    }

    return arguments[0];
}

export function toName(app) {
    return app.name
}