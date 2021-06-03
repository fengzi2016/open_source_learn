import {
    LOAD_ERROR,
    NOT_BOOTSTRAPPED,
    LOADING_SOURCE_CODE,
    NOT_LOADED,
    assign
} from "../applications/app.helpers.js";
import { ensureValidAppTimeouts } from "../applications/timeouts.js";
import { flattenFnArray } from './helpers.js'

/** 加载资源 */
export function toLoadPromise(app) {
    return Promise.resolve().then(() => {
        if (app.loadPromise) {
            return app.loadPromise;
        }


        if (app.status !== NOT_LOADED && app.status !== LOAD_ERROR) {
            return app;
        }


        app.status = LOADING_SOURCE_CODE;

        let appOpts, isUserErr;

        return (app.loadPromise = Promise.resolve()
            .then(() => {
                const loadPromise = app.loadApp(app.customProps);

                return loadPromise.then((val) => {
                    app.loadErrorTime = null;

                    appOpts = val;

                    let validationErrMessage, validationErrCode;

                    /** 一些错误处理 */
                    // if (typeof appOpts !== "object") {
                    //   validationErrCode = 34;
                    //   if (__DEV__) {
                    //     validationErrMessage = `does not export anything`;
                    //   }
                    // }

                    // if (
                    //   // ES Modules don't have the Object prototype
                    //   Object.prototype.hasOwnProperty.call(appOpts, "bootstrap") &&
                    //   !validLifecycleFn(appOpts.bootstrap)
                    // ) {
                    //   validationErrCode = 35;
                    //   if (__DEV__) {
                    //     validationErrMessage = `does not export a valid bootstrap function or array of functions`;
                    //   }
                    // }

                    // if (!validLifecycleFn(appOpts.mount)) {
                    //   validationErrCode = 36;
                    //   if (__DEV__) {
                    //     validationErrMessage = `does not export a mount function or array of functions`;
                    //   }
                    // }

                    // if (!validLifecycleFn(appOpts.unmount)) {
                    //   validationErrCode = 37;
                    //   if (__DEV__) {
                    //     validationErrMessage = `does not export a unmount function or array of functions`;
                    //   }
                    // }

                    // const type = objectType(appOpts);

                    if (validationErrCode) {
                        let appOptsStr;
                        try {
                            appOptsStr = JSON.stringify(appOpts);
                        } catch { }
                        //   console.error(
                        //     formatErrorMessage(
                        //       validationErrCode,
                        //       __DEV__ &&
                        //         `The loading function for single-spa ${type} '${toName(
                        //           app
                        //         )}' resolved with the following, which does not have bootstrap, mount, and unmount functions`,
                        //       type,
                        //       toName(app),
                        //       appOptsStr
                        //     ),
                        //     appOpts
                        //   );
                        //   handleAppError(validationErrMessage, app, SKIP_BECAUSE_BROKEN);
                        //   return app;
                    }

                    if (appOpts.devtools && appOpts.devtools.overlays) {
                        app.devtools.overlays = assign(
                            {},
                            app.devtools.overlays,
                            appOpts.devtools.overlays
                        );
                    }

                    app.status = NOT_BOOTSTRAPPED;
                    app.bootstrap = flattenFnArray(appOpts, "bootstrap");
                    app.mount = flattenFnArray(appOpts, "mount");
                    app.unmount = flattenFnArray(appOpts, "unmount");
                    app.unload = flattenFnArray(appOpts, "unload");
                    app.timeouts = ensureValidAppTimeouts(appOpts.timeouts);

                    delete app.loadPromise;

                    return app;
                });
            })
            .catch((err) => {

                delete app.loadPromise;

                //   let newStatus;
                //   if (isUserErr) {
                //     newStatus = SKIP_BECAUSE_BROKEN;
                //   } else {
                //     newStatus = LOAD_ERROR;
                //     app.loadErrorTime = new Date().getTime();
                //   }
                //   handleAppError(err, app, newStatus);

                return app;
            }));
    });
}
