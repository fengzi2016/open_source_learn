

import { callCapturedEventListeners } from '../navigation/navigation-events.js'
import { toUnloadPromise } from './unload.js';
import { toMountPromise } from './mount.js';
import { getMountedApps, getAppChanges, shouldBeActive } from '../applications/app.js';
import { NOT_BOOTSTRAPPED, BOOTSTRAPPING, NOT_MOUNTED } from '../applications/app.helpers.js';
import { isStarted } from '../start.js'
import { toLoadPromise } from './load.js';
import { toUnmountPromise } from './unmount.js'
import { reasonableTime } from "../applications/timeouts.js";

let appChangeUnderway = false,
    peopleWaitingOnAppChange = [],
    currentUrl = window.location.href;



export function reroute(pendingPromises = [], eventArguments) {
    /** 变化产生在app 运行中 */
    if (appChangeUnderway) {
        return new Promise((resolve, reject) => {
            peopleWaitingOnAppChange.push({
                resolve,
                reject,
                eventArguments,
            });
        });
    }

    /** 拿到app加载状态列表 */
    const {
        appsToUnload,
        appsToUnmount,
        appsToLoad,
        appsToMount,
    } = getAppChanges();

    let appsThatChanged,
        navigationIsCanceled = false,
        oldUrl = currentUrl,
        newUrl = (currentUrl = window.location.href);

    if (isStarted()) {
        appChangeUnderway = true;

        appsThatChanged = appsToUnload.concat(
            appsToLoad,
            appsToUnmount,
            appsToMount
        );
        console.log("appsThatChanged", appsToUnmount, appsToLoad, appsToMount);
        return performAppChanges();
    } else {
        appsThatChanged = appsToLoad;
        return loadApps();
    }

    function cancelNavigation() {
        navigationIsCanceled = true;
    }

    function loadApps() {
        console.log('into load', appsToLoad);
        return Promise.resolve().then(() => {
            const loadPromises = appsToLoad.map(toLoadPromise);

            return (
                Promise.all(loadPromises)
                    .then(callAllEventListeners)
                    // there are no mounted apps, before start() is called, so we always return []
                    .then(() => [])
                    .catch((err) => {
                        callAllEventListeners();
                        throw err;
                    })
            );
        });
    }

    function performAppChanges() {
        console.log('performances');
        return Promise.resolve().then(() => {
            // https://github.com/single-spa/single-spa/issues/545
            /** 发布一些生命周期钩子事件 */
            // window.dispatchEvent(
            //     new CustomEvent(
            //         appsThatChanged.length === 0
            //             ? "single-spa:before-no-app-change"
            //             : "single-spa:before-app-change",
            //         getCustomEventDetail(true)
            //     )
            // );

            /** 先unload所有需要unload的app */
            const unloadPromises = appsToUnload.map(toUnloadPromise);

            /** 再unmount、unload需要卸载的app */
            const unmountUnloadPromises = appsToUnmount
                .map(toUnmountPromise)
                .map((unmountPromise) => unmountPromise.then(toUnloadPromise));

            const allUnmountPromises = unmountUnloadPromises.concat(unloadPromises);

            const unmountAllPromise = Promise.all(allUnmountPromises);

            // unmountAllPromise.then(() => {
            //     window.dispatchEvent(
            //         new CustomEvent(
            //             "single-spa:before-mount-routing-event",
            //             getCustomEventDetail(true)
            //         )
            //     );
            // });


            /** load 需要load的app */
            /* We load and bootstrap apps while other apps are unmounting, but we
             * wait to mount the app until all apps are finishing unmounting
             */
            const loadThenMountPromises = appsToLoad.map((app) => {
                console.log('app', app);
                return toLoadPromise(app).then((app) =>
                    tryToBootstrapAndMount(app, unmountAllPromise)
                );
            });

            /** 再mount已经load好的app */
            /* These are the apps that are already bootstrapped and just need
             * to be mounted. They each wait for all unmounting apps to finish up
             * before they mount.
             */
            const mountPromises = appsToMount
                .filter((appToMount) => appsToLoad.indexOf(appToMount) < 0)
                .map((appToMount) => {
                    return tryToBootstrapAndMount(appToMount, unmountAllPromise);
                });

            /** 添加所有promise执行后的预期操作 */
            console.log('unmountAllPromise', unmountAllPromise, loadThenMountPromises, mountPromises);
            return unmountAllPromise
                .catch((err) => {
                    callAllEventListeners();
                    throw err;
                })
                .then(() => {
                    /* Now that the apps that needed to be unmounted are unmounted, their DOM navigation
                     * events (like hashchange or popstate) should have been cleaned up. So it's safe
                     * to let the remaining captured event listeners to handle about the DOM event.
                     */
                    callAllEventListeners();

                    return Promise.all(loadThenMountPromises.concat(mountPromises))
                        .catch((err) => {
                            pendingPromises.forEach((promise) => promise.reject(err));
                            throw err;
                        })
                        .then(finishUpAndReturn);
                });
        });
    }

    function finishUpAndReturn() {
        const returnValue = getMountedApps();
        pendingPromises.forEach((promise) => promise.resolve(returnValue));

        try {
            const appChangeEventName =
                appsThatChanged.length === 0
                    ? "single-spa:no-app-change"
                    : "single-spa:app-change";
            // window.dispatchEvent(
            //     new CustomEvent(appChangeEventName, getCustomEventDetail())
            // );
            // window.dispatchEvent(
            //     new CustomEvent("single-spa:routing-event", getCustomEventDetail())
            // );
        } catch (err) {
            /* We use a setTimeout because if someone else's event handler throws an error, single-spa
             * needs to carry on. If a listener to the event throws an error, it's their own fault, not
             * single-spa's.
             */
            setTimeout(() => {
                throw err;
            });
        }

        /* Setting this allows for subsequent calls to reroute() to actually perform
         * a reroute instead of just getting queued behind the current reroute call.
         * We want to do this after the mounting/unmounting is done but before we
         * resolve the promise for the `reroute` function.
         */
        appChangeUnderway = false;

        if (peopleWaitingOnAppChange.length > 0) {
            /* While we were rerouting, someone else triggered another reroute that got queued.
             * So we need reroute again.
             */
            const nextPendingPromises = peopleWaitingOnAppChange;
            peopleWaitingOnAppChange = [];
            reroute(nextPendingPromises);
        }

        return returnValue;
    }

    /* We need to call all event listeners that have been delayed because they were
     * waiting on single-spa. This includes haschange and popstate events for both
     * the current run of performAppChanges(), but also all of the queued event listeners.
     * We want to call the listeners in the same order as if they had not been delayed by
     * single-spa, which means queued ones first and then the most recent one.
     */
    function callAllEventListeners() {
        pendingPromises.forEach((pendingPromise) => {
            callCapturedEventListeners(pendingPromise.eventArguments);
        });

        callCapturedEventListeners(eventArguments);
    }


}



function tryToBootstrapAndMount(app, unmountAllPromise) {
    console.log('sh', shouldBeActive(app));
    if (shouldBeActive(app)) {
        return toBootstrapPromise(app).then((app) =>
            unmountAllPromise.then(() =>
                shouldBeActive(app) ? toMountPromise(app) : app
            )
        );
    } else {
        return unmountAllPromise.then(() => app);
    }
}



export function toBootstrapPromise(appOrParcel, hardFail) {
    return Promise.resolve().then(() => {
        console.log('appOrParcel.bootstrap', appOrParcel.bootstrap);
        if (appOrParcel.status !== NOT_BOOTSTRAPPED) {
            return appOrParcel;
        }

        appOrParcel.status = BOOTSTRAPPING;


        if (!appOrParcel.bootstrap) {
            // Default implementation of bootstrap
            return Promise.resolve().then(successfulBootstrap);
        }

        return reasonableTime(appOrParcel, "bootstrap")
            .then(successfulBootstrap)

    });

    function successfulBootstrap() {
        appOrParcel.status = NOT_MOUNTED;
        return appOrParcel;
    }
}




