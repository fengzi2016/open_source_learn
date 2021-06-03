import { LOAD_ERROR, NOT_LOADED, LOADING_SOURCE_CODE, NOT_BOOTSTRAPPED, NOT_MOUNTED, MOUNTED, SKIP_BECAUSE_BROKEN } from './app.helpers.js'
import { toName, assign } from './app.helpers.js';
import { reroute } from '../lifecycles/reroute.js';

const apps = [];

export const isInBrowser = typeof window !== "undefined";

/** 根据app状态导出新的app 加载队列 */
export function getAppChanges() {
    const appsToUnload = [],
        appsToUnmount = [],
        appsToLoad = [],
        appsToMount = [];

    // We re-attempt to download applications in LOAD_ERROR after a timeout of 200 milliseconds
    const currentTime = new Date().getTime();
    console.log('apps', apps);
    apps.forEach((app) => {
        const appShouldBeActive =
            app.status !== SKIP_BECAUSE_BROKEN && shouldBeActive(app);
        switch (app.status) {
            case LOAD_ERROR:
                if (appShouldBeActive && currentTime - app.loadErrorTime >= 200) {
                    appsToLoad.push(app);
                }
                break;
            case NOT_LOADED:
            case LOADING_SOURCE_CODE:
                if (appShouldBeActive) {
                    appsToLoad.push(app);
                }
                break;
            case NOT_BOOTSTRAPPED:
            case NOT_MOUNTED:
                if (!appShouldBeActive && getAppUnloadInfo(toName(app))) {
                    appsToUnload.push(app);
                } else if (appShouldBeActive) {
                    appsToMount.push(app);
                }
                break;
            case MOUNTED:
                if (!appShouldBeActive) {
                    appsToUnmount.push(app);
                }
                break;
            // all other statuses are ignored
        }
    });

    return { appsToUnload, appsToUnmount, appsToLoad, appsToMount };
}

export function shouldBeActive(app) {
    try {
        console.log('active', app.activeWhen(window.location), window.location);
        return app.activeWhen(window.location);
    } catch (err) {
        console.log('err', err);
        // handleAppError(err, app, SKIP_BECAUSE_BROKEN);
        return false;
    }
}

const appsToUnload = {};


function getAppUnloadInfo(appName) {
    return appsToUnload[appName];
}

export function getMountedApps() {
    return apps.filter(isActive).map(toName);
}

export function isActive(app) {
    return app.status === MOUNTED;
}

export function getAppNames() {
    return apps.map(toName);
}

/** 注册app，处理app参数 */
export function registerApplication(
    appNameOrConfig,
    appOrLoadApp,
    activeWhen,
    customProps
) {
    const registration = {
        name: appNameOrConfig,
        loadApp: sanitizeLoadApp(appOrLoadApp),
        activeWhen: sanitizeActiveWhen(activeWhen),
        customProps: sanitizeCustomProps(customProps)
    };

    if (getAppNames().indexOf(registration.name) !== -1)
        throw Error(
            `There is already an app registered with name ${registration.name}`,

        );

    apps.push(
        assign(
            {
                loadErrorTime: null,
                status: NOT_LOADED,
                parcels: {},
                devtools: {
                    overlays: {
                        options: {},
                        selectors: [],
                    },
                },
            },
            registration
        )
    );

    if (isInBrowser) {
        reroute();
    }
}

function sanitizeLoadApp(loadApp) {
    if (typeof loadApp !== "function") {
        return () => Promise.resolve(loadApp);
    }

    return loadApp;
}

function sanitizeCustomProps(customProps) {
    return customProps ? customProps : {};
}

function sanitizeActiveWhen(activeWhen) {
    let activeWhenArray = Array.isArray(activeWhen) ? activeWhen : [activeWhen];
    activeWhenArray = activeWhenArray.map((activeWhenOrPath) =>
        typeof activeWhenOrPath === "function"
            ? activeWhenOrPath
            : pathToActiveWhen(activeWhenOrPath)
    );

    return (location) =>
        activeWhenArray.some((activeWhen) => activeWhen(location));
}

export function pathToActiveWhen(path, exactMatch) {
    const regex = toDynamicPathValidatorRegex(path, exactMatch);

    return (location) => {
        const route = location.href
            .replace(location.origin, "")
            .replace(location.search, "")
            .split("?")[0];
        return regex.test(route);
    };
}

function toDynamicPathValidatorRegex(path, exactMatch) {
    let lastIndex = 0,
        inDynamic = false,
        regexStr = "^";

    if (path && path[0] !== "/") {
        path = "/" + path;
    }

    for (let charIndex = 0; charIndex < path.length; charIndex++) {
        const char = path[charIndex];
        const startOfDynamic = !inDynamic && char === ":";
        const endOfDynamic = inDynamic && char === "/";
        if (startOfDynamic || endOfDynamic) {
            appendToRegex(charIndex);
        }
    }

    appendToRegex(path.length);
    return new RegExp(regexStr, "i");

    function appendToRegex(index) {
        const anyCharMaybeTrailingSlashRegex = "[^/]+/?";
        const commonStringSubPath = escapeStrRegex(path.slice(lastIndex, index));

        regexStr += inDynamic
            ? anyCharMaybeTrailingSlashRegex
            : commonStringSubPath;

        if (index === path.length) {
            if (inDynamic) {
                if (exactMatch) {
                    // Ensure exact match paths that end in a dynamic portion don't match
                    // urls with characters after a slash after the dynamic portion.
                    regexStr += "$";
                }
            } else {
                // For exact matches, expect no more characters. Otherwise, allow
                // any characters.
                const suffix = exactMatch ? "" : ".*";

                regexStr =
                    // use charAt instead as we could not use es6 method endsWith
                    regexStr.charAt(regexStr.length - 1) === "/"
                        ? `${regexStr}${suffix}$`
                        : `${regexStr}(/${suffix})?(#.*)?$`;
            }
        }

        inDynamic = !inDynamic;
        lastIndex = index;
    }

    function escapeStrRegex(str) {
        // borrowed from https://github.com/sindresorhus/escape-string-regexp/blob/master/index.js
        return str.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&");
    }
}
