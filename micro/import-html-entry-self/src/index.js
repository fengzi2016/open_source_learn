import processTpl, { genLinkReplaceSymbol } from './process-tpl.js';

const defaultFetch = window.fetch.bind(window);
const embedHTMLCache = {};
const styleCache = {};
const scriptCache = {};
// 通过new URL 把 entry参数规范化
// new URL https://developer.mozilla.org/en-US/docs/Web/API/URL/URL
export function defaultGetPublicPath(entry) {
    if (typeof entry === 'object') {
        return '/';
    }
    try {
        // URL 构造函数不支持使用 // 前缀的 url
        const { origin, pathname } = new URL(entry.startsWith('//') ? `${location.protocol}${entry}` : entry, location.href);
        const paths = pathname.split('/');
        // 移除最后一个元素
        paths.pop();
        return `${origin}${paths.join('/')}/`;
    } catch (e) {
        console.warn(e);
        return '';
    }
}

function defaultGetTemplate(tpl) {
    return tpl;
}


function readResAsString(response, autoDetectCharset) {
    // 未启用自动检测
    if (!autoDetectCharset) {
        return response.text();
    }

    // 如果没headers，发生在test环境下的mock数据，为兼容原有测试用例
    if (!response.headers) {
        return response.text();
    }

    // 如果没返回content-type，走默认逻辑
    const contentType = response.headers.get('Content-Type');
    if (!contentType) {
        return response.text();
    }

    // 解析content-type内的charset
    // Content-Type: text/html; charset=utf-8
    // Content-Type: multipart/form-data; boundary=something
    // GET请求下不会出现第二种content-type
    let charset = 'utf-8';
    const parts = contentType.split(';');
    if (parts.length === 2) {
        const [, value] = parts[1].split('=');
        const encoding = value && value.trim();
        if (encoding) {
            charset = encoding;
        }
    }

    // 如果还是utf-8，那么走默认，兼容原有逻辑，这段代码删除也应该工作
    if (charset.toUpperCase() === 'UTF-8') {
        return response.text();
    }

    // 走流读取，编码可能是gbk，gb2312等，比如sofa 3默认是gbk编码
    return response.blob()
        .then(file => new Promise((resolve, reject) => {
            const reader = new window.FileReader();
            reader.onload = () => {
                resolve(reader.result);
            };
            reader.onerror = reject;
            reader.readAsText(file, charset);
        }));
}

/** T: start 可以先看看a.js， b.js 以及 index.html */
export default function importHTML(url, opts = {}) {
    let fetch = defaultFetch;
    /** 是否开启自动检测， 从用户配置里拿*/
    let autoDecodeResponse = false;
    let getPublicPath = defaultGetPublicPath;
    let getTemplate = defaultGetTemplate;
    /** 缓存资源 */
    return embedHTMLCache[url] || (embedHTMLCache[url] = fetch(url).then(response => {
        /** T: 请求目标 */
        console.log('response', response);
        return readResAsString(response, autoDecodeResponse);
    })).then(html => {
        const assetPublicPath = getPublicPath(url);
        /** T: processTpl */
        const { template, scripts, entry, styles } = processTpl(getTemplate(html), assetPublicPath);
        /** T: processTpl result */
        console.log("processTpl 解析结果", template, scripts, entry, styles);
        // 将link标签转化为style
        return getEmbedHTML(template, styles, { fetch }).then(embedHTML => ({
            template: embedHTML,
            assetPublicPath,
            getExternalScripts: () => getExternalScripts(scripts, fetch),
            getExternalStyleSheets: () => getExternalStyleSheets(styles, fetch),
            execScripts: (proxy, strictGlobal, execScriptsHooks = {}) => {
                if (!scripts.length) {
                    return Promise.resolve();
                }
                /** T: execScripts 执行script代码，并且挂在window proxy由entry文件执行后增加的属性上 */
                return execScripts(entry, scripts, proxy, {
                    fetch,
                    strictGlobal,
                    beforeExec: execScriptsHooks.beforeExec,
                    afterExec: execScriptsHooks.afterExec,
                });
            },
        }))
    })
}


/**
 * convert external css link to inline style for performance optimization
 * @param template
 * @param styles
 * @param opts
 * @return embedHTML
 */
function getEmbedHTML(template, styles, opts = {}) {
    const { fetch = defaultFetch } = opts;
    let embedHTML = template;

    return getExternalStyleSheets(styles, fetch)
        .then(styleSheets => {
            embedHTML = styles.reduce((html, styleSrc, i) => {
                html = html.replace(genLinkReplaceSymbol(styleSrc), `<style>/* ${styleSrc} */${styleSheets[i]}</style>`);
                return html;
            }, embedHTML);
            return embedHTML;
        });
}


// for prefetch
function getExternalScripts(scripts, fetch = defaultFetch, errorCallback = () => {
}) {

    const fetchScript = scriptUrl => scriptCache[scriptUrl] ||
        (scriptCache[scriptUrl] = fetch(scriptUrl).then(response => {
            // usually browser treats 4xx and 5xx response of script loading as an error and will fire a script error event
            // https://stackoverflow.com/questions/5625420/what-http-headers-responses-trigger-the-onerror-handler-on-a-script-tag/5625603
            if (response.status >= 400) {
                errorCallback();
                throw new Error(`${scriptUrl} load failed with status ${response.status}`);
            }

            return response.text();
        }).catch(e => {
            errorCallback();
            throw e;
        }));

    /** 遍历所有的script标签，根据scrip属性进行获取 */
    return Promise.all(scripts.map(script => {

        if (typeof script === 'string') {
            if (isInlineCode(script)) {
                // if it is inline script
                return getInlineCode(script);
            } else {
                // external script
                return fetchScript(script);
            }
        } else {
            // use idle time to load async script
            const { src, async } = script;
            if (async) {
                return {
                    src,
                    async: true,
                    content: new Promise((resolve, reject) => requestIdleCallback(() => fetchScript(src).then(resolve, reject))),
                };
            }

            return fetchScript(src);
        }
    },
    ));
}

// for prefetch
function getExternalStyleSheets(styles, fetch = defaultFetch) {
    return Promise.all(styles.map(styleLink => {
        if (isInlineCode(styleLink)) {
            // if it is inline style
            return getInlineCode(styleLink);
        } else {
            // external styles
            return styleCache[styleLink] ||
                (styleCache[styleLink] = fetch(styleLink).then(response => response.text()));
        }

    },
    ));
}

const isInlineCode = code => code.startsWith('<');


function shouldSkipProperty(global, p) {
    if (
        !global.hasOwnProperty(p) ||
        !isNaN(p) && p < global.length
    )
        return true;

    if (isIE11) {
        // https://github.com/kuitos/import-html-entry/pull/32，最小化 try 范围
        try {
            return global[p] && typeof window !== 'undefined' && global[p].parent === window;
        } catch (err) {
            return true;
        }
    } else {
        return false;
    }
}

export function noteGlobalProps(global) {
    // alternatively Object.keys(global).pop()
    // but this may be faster (pending benchmarks)
    firstGlobalProp = secondGlobalProp = undefined;

    for (let p in global) {
        if (shouldSkipProperty(global, p))
            continue;
        if (!firstGlobalProp)
            firstGlobalProp = p;
        else if (!secondGlobalProp)
            secondGlobalProp = p;
        lastGlobalProp = p;
    }

    return lastGlobalProp;
}

function getExecutableScript(scriptSrc, scriptText, proxy, strictGlobal) {
    const sourceUrl = isInlineCode(scriptSrc) ? '' : `//# sourceURL=${scriptSrc}\n`;

    // 通过这种方式获取全局 window，因为 script 也是在全局作用域下运行的，所以我们通过 window.proxy 绑定时也必须确保绑定到全局 window 上
    // 否则在嵌套场景下， window.proxy 设置的是内层应用的 window，而代码其实是在全局作用域运行的，会导致闭包里的 window.proxy 取的是最外层的微应用的 proxy
    const globalWindow = (0, eval)('window');
    globalWindow.proxy = proxy;
    // TODO 通过 strictGlobal 方式切换切换 with 闭包，待 with 方式坑趟平后再合并
    return strictGlobal
        ? `;(function(window, self, globalThis){with(window){;${scriptText}\n${sourceUrl}}}).bind(window.proxy)(window.proxy, window.proxy, window.proxy);`
        : `;(function(window, self, globalThis){;${scriptText}\n${sourceUrl}}).bind(window.proxy)(window.proxy, window.proxy, window.proxy);`;
}


function execScripts(entry, scripts, proxy = window, opts = {}) {
    const {
        fetch = defaultFetch, strictGlobal = false, success, error = () => {
        }, beforeExec = () => {
        }, afterExec = () => {
        },
    } = opts;

    /** 执行代码 */
    return getExternalScripts(scripts, fetch, error)
        .then(scriptsText => {

            const geval = (scriptSrc, inlineScript) => {
                const rawCode = beforeExec(inlineScript, scriptSrc) || inlineScript;
                /** T: 绑定当前的window proxy */
                const code = getExecutableScript(scriptSrc, rawCode, proxy, strictGlobal);
                console.log("getExecutableScript  code", code);
                (0, eval)(code);

                afterExec(inlineScript, scriptSrc);
            };

            function exec(scriptSrc, inlineScript, resolve) {
                /** T: 普通文件直接执行、入口文件需要记录和返回值 */
                if (scriptSrc === entry) {
                    noteGlobalProps(strictGlobal ? proxy : window);

                    try {
                        // bind window.proxy to change `this` reference in script
                        geval(scriptSrc, inlineScript);
                        /** T: 入口文件最后添加的属性挂载在window上 */
                        console.log("getGlobalProp exports", getGlobalProp(strictGlobal ? proxy : window))
                        const exports = proxy[getGlobalProp(strictGlobal ? proxy : window)] || {};
                        resolve(exports);
                    } catch (e) {
                        // entry error must be thrown to make the promise settled
                        console.error(`[import-html-entry]: error occurs while executing entry script ${scriptSrc}`);
                        throw e;
                    }
                } else {
                    if (typeof inlineScript === 'string') {
                        try {
                            // bind window.proxy to change `this` reference in script
                            geval(scriptSrc, inlineScript);
                        } catch (e) {
                            // consistent with browser behavior, any independent script evaluation error should not block the others
                            throwNonBlockingError(e, `[import-html-entry]: error occurs while executing normal script ${scriptSrc}`);
                        }
                    } else {
                        // external script marked with async
                        inlineScript.async && inlineScript?.content
                            .then(downloadedScriptText => geval(inlineScript.src, downloadedScriptText))
                            .catch(e => {
                                throwNonBlockingError(e, `[import-html-entry]: error occurs while executing async script ${inlineScript.src}`);
                            });
                    }
                }


            }

            /** T: 按顺序执行脚本、递归 */
            function schedule(i, resolvePromise) {

                if (i < scripts.length) {
                    const scriptSrc = scripts[i];
                    const inlineScript = scriptsText[i];

                    exec(scriptSrc, inlineScript, resolvePromise);
                    // resolve the promise while the last script executed and entry not provided
                    if (!entry && i === scripts.length - 1) {
                        resolvePromise();
                    } else {
                        schedule(i + 1, resolvePromise);
                    }
                }
            }
            /** 开始按script队列执行 */
            return new Promise(resolve => schedule(0, success || resolve));
        });
}


// safari unpredictably lists some new globals first or second in object order
let firstGlobalProp, secondGlobalProp, lastGlobalProp;

function getGlobalProp(global) {
    let cnt = 0;
    let lastProp;
    let hasIframe = false;

    for (let p in global) {
        if (shouldSkipProperty(global, p))
            continue;

        // 遍历 iframe，检查 window 上的属性值是否是 iframe，是则跳过后面的 first 和 second 判断
        for (let i = 0; i < window.frames.length && !hasIframe; i++) {
            const frame = window.frames[i];
            if (frame === global[p]) {
                hasIframe = true;
                break;
            }
        }

        if (!hasIframe && (cnt === 0 && p !== firstGlobalProp || cnt === 1 && p !== secondGlobalProp))
            return p;
        cnt++;
        lastProp = p;
    }

    if (lastProp !== lastGlobalProp)
        return lastProp;
}

function throwNonBlockingError(error, msg) {
    setTimeout(() => {
        console.error(msg);
        throw error;
    });
}

const isIE11 = typeof navigator !== 'undefined' && navigator.userAgent.indexOf('Trident') !== -1;
