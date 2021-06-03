import { assign } from '../applications/app.helpers.js'

export function reasonableTime(appOrParcel, lifecycle) {

    return new Promise((resolve, reject) => {
        let finished = false;


        appOrParcel[lifecycle](appOrParcel.name)
            .then((val) => {
                finished = true;
                resolve(val);
            })
            .catch((val) => {
                finished = true;
                reject(val);
            });



    });
}

const defaultWarningMillis = 1000;

const globalTimeoutConfig = {
    bootstrap: {
        millis: 4000,
        dieOnTimeout: false,
        warningMillis: defaultWarningMillis,
    },
    mount: {
        millis: 3000,
        dieOnTimeout: false,
        warningMillis: defaultWarningMillis,
    },
    unmount: {
        millis: 3000,
        dieOnTimeout: false,
        warningMillis: defaultWarningMillis,
    },
    unload: {
        millis: 3000,
        dieOnTimeout: false,
        warningMillis: defaultWarningMillis,
    },
    update: {
        millis: 3000,
        dieOnTimeout: false,
        warningMillis: defaultWarningMillis,
    },
};

export function ensureValidAppTimeouts(timeouts) {
    const result = {};

    for (let key in globalTimeoutConfig) {
        result[key] = assign(
            {},
            globalTimeoutConfig[key],
            (timeouts && timeouts[key]) || {}
        );
    }

    return result;
}