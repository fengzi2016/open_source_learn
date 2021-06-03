import { toName } from '../applications/app.helpers.js'
/* the array.prototype.find polyfill on npmjs.com is ~20kb (not worth it)
 * and lodash is ~200kb (not worth it)
 */
export function find(arr, func) {
    for (let i = 0; i < arr.length; i++) {
        if (func(arr[i])) {
            return arr[i];
        }
    }

    return null;
}

export function isParcel(appOrParcel) {
    return Boolean(appOrParcel.unmountThisParcel);
}

export function objectType(appOrParcel) {
    return isParcel(appOrParcel) ? "parcel" : "application";
}

export function validLifecycleFn(fn) {
    return fn && (typeof fn === "function" || isArrayOfFns(fn));

    function isArrayOfFns(arr) {
        return (
            Array.isArray(arr) && !find(arr, (item) => typeof item !== "function")
        );
    }
}

export function flattenFnArray(appOrParcel, lifecycle) {
    let fns = appOrParcel[lifecycle] || [];
    fns = Array.isArray(fns) ? fns : [fns];
    if (fns.length === 0) {
        fns = [() => Promise.resolve()];
    }

    const type = objectType(appOrParcel);
    const name = toName(appOrParcel);

    return function (props) {
        return fns.reduce((resultPromise, fn, index) => {
            return resultPromise.then(() => {
                const thisPromise = fn(props);
                return smellsLikeAPromise(thisPromise)
                    ? thisPromise
                    : Promise.reject(
                        // formatErrorMessage(
                        //     15,
                        //     __DEV__ &&
                        //     `Within ${type} ${name}, the lifecycle function ${lifecycle} at array index ${index} did not return a promise`,
                        //     type,
                        //     name,
                        //     lifecycle,
                        //     index
                        // )
                    );
            });
        }, Promise.resolve());
    };
}

export function smellsLikeAPromise(promise) {
    return (
        promise &&
        typeof promise.then === "function" &&
        typeof promise.catch === "function"
    );
}
