## 微应用

## single-spa
### 1. 完整流程（有DEMO => ../single-spa-self）
- 开发设置app的状态、启动时机、各种生命阶段函数。single-spa保存注册好的信息为apps、并且将app状态初始化为NOT_LOAD。
- 部署单页面应用，同一域名下的所有请求都映射到一个固定静态页面，比如index.html
- 用户访问index.html，进行操作后跳转路由，single-spa监听到路由跳转，将apps里的app根据当前激活的路由设置成不同的阶段状态，比如NOT_LOAD => LOAD，MOUNTED => UNMOUNT
- single-spa搜集apps的改变，重新遍历apps，根据app的不同状态来执行加载、卸载等操作、并且在适当时机发布各个阶段的事件
### 2. 主要问题：
- 需要改造的地方过多
- JS和样式污染（DEMO）
### 3. 可以学习的地方：
1. 监听路由变化
利用了订阅发布模式对window.addEventListener和removeEventListener劫持，将所有的事件都维护在自己的数组里
```js
// 所有被劫持的事件
const capturedEventListeners = [];
// 定义路由变化的监听事件
const routingEventsListeningTo = ["hashchange", "popstate"];

function main() {
    if (typeof window !== "undefined") {
       /** 添加路由变化的基础监听事件 */
        window.addEventListener("hashchange", urlReroute);
        window.addEventListener("popstate", urlReroute);

        const originalAddEventListener = window.addEventListener;
        const originalRemoveEventListener = window.removeEventListener;
        /** 添加添加路由变化自定义监听事件 */
        window.addEventListener = function (eventName, fn) {
            if (typeof fn === "function") {
                if (
                    routingEventsListeningTo.includes(eventName) &&
                    !find(capturedEventListeners[eventName], (listener) => listener === fn)
                ) {
                    capturedEventListeners[eventName].push(fn);
                    return;
                }
            }

            return originalAddEventListener.apply(this, arguments);
        };

        window.removeEventListener = function (eventName, listenerFn) {
            if (typeof listenerFn === "function") {
                if (routingEventsListeningTo.includes(eventName)) {
                    capturedEventListeners[eventName] = capturedEventListeners[
                        eventName
                    ].filter((fn) => fn !== listenerFn);
                    return;
                }
            }

            return originalRemoveEventListener.apply(this, arguments);
        };

        window.history.pushState = patchedUpdateState(
            window.history.pushState,
            "pushState"
        );
        window.history.replaceState = patchedUpdateState(
            window.history.replaceState,
            "replaceState"
        );

        if (window.singleSpaNavigate) {
            console.warn(

                "single-spa has been loaded twice on the page. This can result in unexpected behavior."

            );
        } else {
            // 用于代码中触发跳转
            /* For convenience in `onclick` attributes, we expose a global function for navigating to
             * whatever an <a> tag's href is.
             */
            window.singleSpaNavigate = navigateToUrl;
        }
    }
}

function navigateToUrl(obj) {
    let url;
    if (typeof obj === "string") {
        url = obj;
    } else if (this && this.href) {
        url = this.href;
    } else if (
        obj &&
        obj.currentTarget &&
        obj.currentTarget.href &&
        obj.preventDefault
    ) {
        url = obj.currentTarget.href;
        obj.preventDefault();
    } else {
        throw Error(

            `singleSpaNavigate/navigateToUrl must be either called with a string url, with an <a> tag as its context, or with an event whose currentTarget is an <a> tag`

        );
    }

    const current = parseUri(window.location.href);
    const destination = parseUri(url);

    if (url.indexOf("#") === 0) {
        window.location.hash = destination.hash;
    } else if (current.host !== destination.host && destination.host) {
        if (process.env.BABEL_ENV === "test") {
            return { wouldHaveReloadedThePage: true };
        } else {
            window.location.href = url;
        }
    } else if (
        destination.pathname === current.pathname &&
        destination.search === current.search
    ) {
        window.location.hash = destination.hash;
    } else {
        // different path, host, or query params
        window.history.pushState(null, null, url);
    }
}

function parseUri(str) {
    const anchor = document.createElement("a");
    anchor.href = str;
    return anchor;
}

function urlReroute() {
    console.log(" 重新根据状态和 url 来 load app ")
}

function callCapturedEventListeners(eventArguments) {
    if (eventArguments) {
        const eventType = eventArguments[0].type;
        if (capturedEventListeners.includes(eventType)) {
            capturedEventListeners[eventType].forEach(listener => {
                try {
                    listener.apply(this, eventArguments);
                } catch (e) {
                    setTimeout(() => {
                        throw e
                    });
                }
            })
        }
    }
}


/** 当路由发生变化的时候调用基础监听事件和自定义监听事件 */
function patchedUpdateState(updateState, methodName) {
    return function () {
        const urlBefore = window.location.href;
        const result = updateState.apply(this, arguments);
        const urlAfter = window.location.href;

        if (urlBefore !== urlAfter) {

            window.dispatchEvent(
                createPopStateEvent(window.history.state, methodName)
            );
        }


        return result;
    };
}

function createPopStateEvent(state, originalMethodName) {

    let evt;
    try {
        /** 这个方法用户监听history.back、go等事件：https://developer.mozilla.org/en-US/docs/Web/API/PopStateEvent **/
        /** And the event is only triggered when the user navigates between two history entries for the same document. */
        evt = new PopStateEvent("popstate", { state });
    } catch (err) {
        // IE 11 compatibility https://github.com/single-spa/single-spa/issues/299
        // https://docs.microsoft.com/en-us/openspecs/ie_standards/ms-html5e/bd560f47-b349-4d2c-baa8-f1560fb489dd
        evt = document.createEvent("PopStateEvent");
        evt.initPopStateEvent("popstate", false, false, state);
    }
    evt.singleSpa = true;
    evt.singleSpaTrigger = originalMethodName;
    return evt;
 
}


/* the array.prototype.find polyfill on npmjs.com is ~20kb (not worth it)
 * and lodash is ~200kb (not worth it)
 */
function find(arr, func) {
    for (let i = 0; i < arr.length; i++) {
        if (func(arr[i])) {
            return arr[i];
        }
    }

    return null;
}

main();
// navigation-events.js
```
其中对于createPopState 有一个更好的替代方案 
```ts
    window.addEventListener('locationchange', function(){
        console.log('location changed!');
    })
    history.pushState = (f => function pushState() {
        var ret = f.apply(this, arguments);
        window.dispatchEvent(new Event('pushstate'));
        window.dispatchEvent(new Event('locationchange'));
        return ret;
    })(history.pushState);

    history.replaceState = (f => function replaceState() {
        var ret = f.apply(this, arguments);
        window.dispatchEvent(new Event('replacestate'));
        window.dispatchEvent(new Event('locationchange'));
        return ret;
    })(history.replaceState);

    window.addEventListener('popstate', () => {
        window.dispatchEvent(new Event('locationchange'))
    });
```

2. 替换字符串路由配置到正则表达式路由
- 也就是如何实现将 /api/:id 匹配到所有符合要求的路径
```ts
function pathToActiveWhen(path: string, exactMath: boolean) {
    const regex = toDynamicPathValidatorRegex(path, exactMath);
    return (location : Window['location']) => {
        const route = location.href
        .replace(location.origin, "")
        .replace(location.search, "")
        .split("?")[0];
        return regex.test(route);
    }
}
/**
 * 
 * @param path 路由字符串
 * @param exactMath 是否精准匹配
 */
function toDynamicPathValidatorRegex(path: string, exactMath: boolean): RegExp {
    // 上一个token的最后一个下标，是否正在匹配动态的路由比如/:id/，最终的结果
    let lastIndex = 0,  inDynamic  = false, regexStr = "^";
    if(path[0]  !== '/') {
        path = '/'  + path;
    }

    for(let charIndex = 0; charIndex < path.length; charIndex++) {
        const char = path[charIndex];
        const startOfDynamic = !inDynamic && char === ':';
        const endOfDynamic = inDynamic && char === '/';
        if(startOfDynamic || endOfDynamic) {
            appendToRegex(charIndex);
        }
    }

    appendToRegex(path.length);
    return new RegExp(regexStr, 'i');


    function appendToRegex(index: number) {
        // 任何可能尾随斜杠的字符的正则表达式
        const anyCharMaybeTrailingSlashRegex = "[^/]+/";
        // 转义当前token路由字符串
        const commonStringSubPath = escapeStrRegex(path.slice(lastIndex, index));

        regexStr += inDynamic  ? anyCharMaybeTrailingSlashRegex  : commonStringSubPath;

        // 到了path尾巴
        if(index === path.length) {
            if(inDynamic) {
                if(exactMath) {
                    regexStr += '$';
                }
            } else {
                const suffix = exactMath ? "" : ".*";
                regexStr = regexStr.charAt(regexStr.length - 1) === '/' ?
                `${regexStr}${suffix}$` : `${regexStr}(/${suffix})?(#.*)?$`;
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
```
3. 当然还有更多
- 如何更好的控制错误以及打印错误formatErrorMessage、transformErr
- 如何共享公共组件 mountParcel
- 如何支持JQuery框架
- 以上等等在源码里都有体现

## qiankun 
### 1. 完整流程
- 预知：qiankun基于single-spa，最终是将用户的配置转化为single-spa配置再运行
- 研发完成qiankun配置文件，确定微应用项目文件来源，以及渲染方式
- 启动主应用于某个端口、运行主应用代码
- 用户操作页面，触发路由跳转、single-spa监听到跳转，触发loadApp
- loadApp根据用户的qiankun配置获取微应用服务( 运行于某个其他端口 )的静态资源，同时根据所处阶段触发各种钩子[预加载、importEntry](#0)
- 将当前获取到的微应用服务JS代码运行，最后的结果(比如需要后续某个时候触发的代码)转化成当前微应用沙盒(window proxy)的全局变量属性 [沙盒的实现](#5)
    - 单应用的话直接用window
    - 多应用的话用proxy复制新的fakeWindow
    - 给不同子应用的fakeWindow增加自己的addEventListener、removeEventListener、clearInterval、setInterval等全局事件创建和监听机制(sandbox/patchers)
    - 如果获取到的微应用JS文件不是入口的js文件则直接在fakeWindow上执行掉，否则作为模块暴露，用于加载子应用执行方法
- 将当前获取到的微应用服务CSS代码进行解析 [ScopedCSS](#4)
  - 如果发现是link则直接替换成css style
  - 通过给微应用添加 style wrapper 父 div 同时给子应用的 dom 和各种css style 选择器添加前缀或者 dom showdown 来隔离
- 这样就可以满足主应用、子应用A、子应用B的所有资源隔离，实现同时运行多个应用


### 2.应用之间如何进行通信？
- 订阅发布模式的globalState
  - 通过给子应用的props传递公共依赖库类，比如React、Vue
  - 暂时不支持子应用之间的通信、可能要用localStorage、custom Event

### 3. 可以学习的地方：

#### <span id ="0">3.0 预加载</span>
- 什么时候做：
在运行主应用之前，开始配置预加载子应用的资源
- 为什么要做：
加快子应用的加载速度
- 怎么做：
```ts
type RequestIdleCallbackHandle = any;
type RequestIdleCallbackOptions = {
  timeout: number;
};
type RequestIdleCallbackDeadline = {
  readonly didTimeout: boolean;
  timeRemaining: () => number;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface Window {
    requestIdleCallback: (
      callback: (deadline: RequestIdleCallbackDeadline) => void,
      opts?: RequestIdleCallbackOptions,
    ) => RequestIdleCallbackHandle;
    cancelIdleCallback: (handle: RequestIdleCallbackHandle) => void;
  }

  interface Navigator {
    connection: {
      saveData: boolean;
      effectiveType: string;
      type: 'bluetooth' | 'cellular' | 'ethernet' | 'none' | 'wifi' | 'wimax' | 'other' | 'unknown';
    };
  }
}

// RIC and shim for browsers setTimeout() without it
const requestIdleCallback =
  window.requestIdleCallback ||
  function requestIdleCallback(cb: CallableFunction) {
    const start = Date.now();
    return setTimeout(() => {
      cb({
        didTimeout: false,
        timeRemaining() {
          return Math.max(0, 50 - (Date.now() - start));
        },
      });
    }, 1);
  };

const isSlowNetwork = navigator.connection
  ? navigator.connection.saveData ||
    (navigator.connection.type !== 'wifi' &&
      navigator.connection.type !== 'ethernet' &&
      /(2|3)g/.test(navigator.connection.effectiveType))
  : false;

/**
 * prefetch assets, do nothing while in mobile network
 * @param entry
 * @param opts
 */
function prefetch(entry: Entry, opts?: ImportEntryOpts): void {
  if (!navigator.onLine || isSlowNetwork) {
    // Don't prefetch if in a slow network or offline
    return;
  }

/ / window.requestIdleCallback()方法将在浏览器的空闲时段内调用的函数排队
  requestIdleCallback(async () => {
    // 自己的预加载逻辑
    const { getExternalScripts, getExternalStyleSheets } = await importEntry(entry, opts);
    requestIdleCallback(getExternalStyleSheets);
    requestIdleCallback(getExternalScripts);
  });
}
```
#### 3.1 importEntry（有DEMO => ../import-html-entry-self）
- 为什么要使用这个库？
  - 因为需要保证子应用的JS和CSS文件以及代码在子应用自己的上下文里起作用，而不会污染到其他应用。
- 这个库做了什么？
  - 传入html路径，解析出其中的style、link、script标签
  - 将需要fetch的资源获取到转化为内联资源，并且绑定从外部传入的proxy window 为上下文
  - 将内联资源中能够执行的js在Promise函数中用eval执行，并将promise返回给使用者，让使用者来控制它调用的时机
- 实践(看DEMO)
#### 3.2 <span id="4">ScopedCSS</span>
- 为什么要做？
从上诉的总结来看，所有应用的link和style都会变成style直接在html里执行，那么不同的子应用需要应用自己的style，但是在写代码的时候样式的选择器是子应用唯一的，所以需要隔离开不同应用的样式。这种方法是通过添加父级容器再更改css选择器来实现的。

- 什么时候做？
生成子应用的容器container时（开始加载应用loadApp），通过劫持document.createElement，对于配置了{strictStyleIsolation: true}来开启严格的样式隔离模式，qiankun会为每个子应用的容纳器包裹上一个shadow dom节点，从而保证微应用的样式不会对全局造成影响。


- 劫持创建子组件容器的行为：
```js
function createElement(
  appContent: string,
  strictStyleIsolation: boolean,
  scopedCSS: boolean,
  appName: string,
): HTMLElement {
  const containerElement = document.createElement('div');
  containerElement.innerHTML = appContent;
  // appContent always wrapped with a singular div
  const appElement = containerElement.firstChild as HTMLElement;
  if (strictStyleIsolation) {
    if (!supportShadowDOM) {
      console.warn(
        '[qiankun]: As current browser not support shadow dom, your strictStyleIsolation configuration will be ignored!',
      );
    } else {
      const { innerHTML } = appElement;
      appElement.innerHTML = '';
      let shadow: ShadowRoot;

      if (appElement.attachShadow) {
        shadow = appElement.attachShadow({ mode: 'open' });
      } else {
        // createShadowRoot was proposed in initial spec, which has then been deprecated
        shadow = (appElement as any).createShadowRoot();
      }
      shadow.innerHTML = innerHTML;
    }

  }

  if (scopedCSS) {
    const attr = appElement.getAttribute(css.QiankunCSSRewriteAttr);
    if (!attr) {
      appElement.setAttribute(css.QiankunCSSRewriteAttr, appName);
    }

    const styleNodes = appElement.querySelectorAll('style') || [];
    forEach(styleNodes, (stylesheetElement: HTMLStyleElement) => {
      css.process(appElement!, stylesheetElement, appName);
    });
  }
}
```
> 你可以使用同样的方式来操作 Shadow DOM，就和操作常规 DOM 一样——例如添加子节点、设置属性，以及为节点添加自己的样式（例如通过 element.style 属性），或者为整个 Shadow DOM 添加样式（例如在 < style > 元素内添加样式）。不同的是，Shadow DOM 内部的元素始终不会影响到它外部的元素（除了 :focus-within），这为封装提供了便利。 -- MDN

- 要做啥：简而言之就是把子应用的html和body转换为'div[data-qiankun="react15"]'，比如：
```js
'.react15-main {display: flex; flex-direction: column; align-items: center;}' => 'div[data-qiankun="react15"] .react15-main {display: flex; flex-direction: column; align-items: center;}'
 '@media screen and (max-width: 300px) {div{margin: 1cm;}}' => '@media screen and (max-width: 300px) {div[data-qiankun="react15"] div {margin: 1cm;}}'
 'html ~ body {color: #eee;}' => 'div[data-qiankun="react15"] ~ div[data-qiankun="react15"] {color: #eee;}'
 'a,body,html,div {color: #eee;}' => 'div[data-qiankun="react15"]a,div[data-qiankun="react15"],div[data-qiankun="react15"]div{color:#eee;}'
```
- 怎么做？
  - 入口代码
```js
  if (scopedCSS) {
    const attr = appElement.getAttribute(css.QiankunCSSRewriteAttr);
    if (!attr) {
      appElement.setAttribute(css.QiankunCSSRewriteAttr, appName);
    }

    const styleNodes = appElement.querySelectorAll('style') || [];
    forEach(styleNodes, (stylesheetElement: HTMLStyleElement) => {
      css.process(appElement!, stylesheetElement, appName);
    });
  }
``` 
  - 给css选择器添加前缀并且监听style节点的变化
  - 总结：通过正则表达式匹配对应的css规则并且进行替换
```ts
/**
 * @author Saviio
 * @since 2020-4-19
 */

// https://developer.mozilla.org/en-US/docs/Web/API/CSSRule
enum RuleType {
  // type: rule will be rewrote
  STYLE = 1,
  MEDIA = 4,
  SUPPORTS = 12,

  // type: value will be kept
  IMPORT = 3,
  FONT_FACE = 5,
  PAGE = 6,
  KEYFRAMES = 7,
  KEYFRAME = 8,
}

const arrayify = <T>(list: CSSRuleList | any[]) => {
  return [].slice.call(list, 0) as T[];
};

const rawDocumentBodyAppend = HTMLBodyElement.prototype.appendChild;

export class ScopedCSS {
  private static ModifiedTag = 'Symbol(style-modified-qiankun)';

  private sheet: StyleSheet;

  private swapNode: HTMLStyleElement;

  constructor() {
    /* 初始化styleNode的替换值 */
    const styleNode = document.createElement('style');
    rawDocumentBodyAppend.call(document.body, styleNode);

    this.swapNode = styleNode;
    this.sheet = styleNode.sheet!;
    this.sheet.disabled = true;
  }

  process(styleNode: HTMLStyleElement, prefix: string = '') {
    /** 
     * 将传入的styleNode转化成CSSStyleSheet对象，在sheet里的用正则匹配需要改变的css规则，并* 且添加前缀
     * 给styleNode添加dom监听器MutationObserver，即使后续被执行的js改变了也能作出相应变* 换
     */
    if (styleNode.textContent !== '') {
      const textNode = document.createTextNode(styleNode.textContent || '');
      this.swapNode.appendChild(textNode);
      const sheet = this.swapNode.sheet as any; // type is missing
      const rules = arrayify<CSSRule>(sheet?.cssRules ?? []);
      const css = this.rewrite(rules, prefix);
      // eslint-disable-next-line no-param-reassign
      styleNode.textContent = css;

      // cleanup
      this.swapNode.removeChild(textNode);
      return;
    }

    const mutator = new MutationObserver((mutations) => {
      for (let i = 0; i < mutations.length; i += 1) {
        const mutation = mutations[i];

        if (ScopedCSS.ModifiedTag in styleNode) {
          return;
        }

        if (mutation.type === 'childList') {
          const sheet = styleNode.sheet as any;
          const rules = arrayify<CSSRule>(sheet?.cssRules ?? []);
          const css = this.rewrite(rules, prefix);

          // eslint-disable-next-line no-param-reassign
          styleNode.textContent = css;
          // eslint-disable-next-line no-param-reassign
          (styleNode as any)[ScopedCSS.ModifiedTag] = true;
        }
      }
    });

    // since observer will be deleted when node be removed
    // we dont need create a cleanup function manually
    // see https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/disconnect
    mutator.observe(styleNode, { childList: true });
  }

  private rewrite(rules: CSSRule[], prefix: string = '') {
    let css = '';

    rules.forEach((rule) => {
      switch (rule.type) {
        case RuleType.STYLE:
          css += this.ruleStyle(rule as CSSStyleRule, prefix);
          break;
        case RuleType.MEDIA:
          css += this.ruleMedia(rule as CSSMediaRule, prefix);
          break;
        case RuleType.SUPPORTS:
          css += this.ruleSupport(rule as CSSSupportsRule, prefix);
          break;
        default:
          css += `${rule.cssText}`;
          break;
      }
    });

    return css;
  }

  // handle case:
  // .app-main {}
  // html, body {}

  // eslint-disable-next-line class-methods-use-this
  private ruleStyle(rule: CSSStyleRule, prefix: string) {
    const rootSelectorRE = /((?:[^\w\-.#]|^)(body|html|:root))/gm;
    const rootCombinationRE = /(html[^\w{[]+)/gm;

    const selector = rule.selectorText.trim();

    let { cssText } = rule;
    // handle html { ... }
    // handle body { ... }
    // handle :root { ... }
    if (selector === 'html' || selector === 'body' || selector === ':root') {
      return cssText.replace(rootSelectorRE, prefix);
    }

    // handle html body { ... }
    // handle html > body { ... }
    if (rootCombinationRE.test(rule.selectorText)) {
      const siblingSelectorRE = /(html[^\w{]+)(\+|~)/gm;

      // since html + body is a non-standard rule for html
      // transformer will ignore it
      if (!siblingSelectorRE.test(rule.selectorText)) {
        cssText = cssText.replace(rootCombinationRE, '');
      }
    }

    // handle grouping selector, a,span,p,div { ... }
    cssText = cssText.replace(/^[\s\S]+{/, (selectors) =>
      selectors.replace(/(^|,\n?)([^,]+)/g, (item, p, s) => {
        // handle div,body,span { ... }
        if (rootSelectorRE.test(item)) {
          return item.replace(rootSelectorRE, (m) => {
            // do not discard valid previous character, such as body,html or *:not(:root)
            const whitePrevChars = [',', '('];

            if (m && whitePrevChars.includes(m[0])) {
              return `${m[0]}${prefix}`;
            }

            // replace root selector with prefix
            return prefix;
          });
        }

        return `${p}${prefix} ${s.replace(/^ */, '')}`;
      }),
    );

    return cssText;
  }

  // handle case:
  // @media screen and (max-width: 300px) {}
  private ruleMedia(rule: CSSMediaRule, prefix: string) {
    const css = this.rewrite(arrayify(rule.cssRules), prefix);
    return `@media ${rule.conditionText} {${css}}`;
  }

  // handle case:
  // @supports (display: grid) {}
  private ruleSupport(rule: CSSSupportsRule, prefix: string) {
    const css = this.rewrite(arrayify(rule.cssRules), prefix);
    return `@supports ${rule.conditionText} {${css}}`;
  }
}

let processor: ScopedCSS;

export const QiankunCSSRewriteAttr = 'data-qiankun';
export const process = (
  appWrapper: HTMLElement,
  stylesheetElement: HTMLStyleElement | HTMLLinkElement,
  appName: string,
): void => {
  // lazy singleton pattern
  if (!processor) {
    processor = new ScopedCSS();
  }

  if (stylesheetElement.tagName === 'LINK') {
    console.warn('Feature: sandbox.experimentalStyleIsolation is not support for link element yet.');
  }

  const mountDOM = appWrapper;
  if (!mountDOM) {
    return;
  }

  const tag = (mountDOM.tagName || '').toLowerCase();

  if (tag && stylesheetElement.tagName === 'STYLE') {
    const prefix = `${tag}[${QiankunCSSRewriteAttr}="${appName}"]`;
    processor.process(stylesheetElement, prefix);
  }
};

```
#### 3.3 <span id="5">沙盒的实现</span>
##### 3.3.1 legacySandBox（遗留的实现方式）
- 在一个主应用和一个子应用时使用
- 操作同一个window对象，记录状态变更
  ```ts
     /** 沙箱期间新增的全局变量 用于卸载时还原主应用全局变量*/
  private addedPropsMapInSandbox = new Map<PropertyKey, any>();

  /** 沙箱期间更新的全局变量 用于卸载时还原主应用全局变量*/
  private modifiedPropsOriginalValueMapInSandbox = new Map<PropertyKey, any>();

  /** 持续记录更新的(新增和修改的)全局变量的 map，用于在任意时刻做 snapshot即还原子应用状态 */
  private currentUpdatedPropsValueMap = new Map<PropertyKey, any>();

  ```
- 构造器
  ```ts
    // 构造器内创建新的proxy window
      const proxy = new Proxy(fakeWindow, {
      set: (_: Window, p: PropertyKey, value: any): boolean => {
        if (this.sandboxRunning) {
          // 当前子应用新增的属性
          if (!rawWindow.hasOwnProperty(p)) {
            addedPropsMapInSandbox.set(p, value);
          } else if (!modifiedPropsOriginalValueMapInSandbox.has(p)) {
            // 如果当前 window 对象存在该属性，且 record map 中未记录过，则记录该属性初始值
            // 当前子应用运行时更新的window属性
            const originalValue = (rawWindow as any)[p];
            modifiedPropsOriginalValueMapInSandbox.set(p, originalValue);
          }
          // 记录当前子应用自己的全局状态
          currentUpdatedPropsValueMap.set(p, value);
          // 必须重新设置 window 对象保证下次 get 时能拿到已更新的数据
          // eslint-disable-next-line no-param-reassign
          (rawWindow as any)[p] = value;

          this.latestSetProp = p;

          return true;
        }

        if (process.env.NODE_ENV === 'development') {
          console.warn(`[qiankun] Set window.${p.toString()} while sandbox destroyed or inactive in ${name}!`);
        }

        // 在 strict-mode 下，Proxy 的 handler.set 返回 false 会抛出 TypeError，在沙箱卸载的情况下应该忽略错误
        return true;
      },

      get(_: Window, p: PropertyKey): any {
        // avoid who using window.window or window.self to escape the sandbox environment to touch the really window
        // or use window.top to check if an iframe context
        // see https://github.com/eligrey/FileSaver.js/blob/master/src/FileSaver.js#L13
        if (p === 'top' || p === 'parent' || p === 'window' || p === 'self') {
          return proxy;
        }

        const value = (rawWindow as any)[p];
        return getTargetValue(rawWindow, value);
      },

      // trap in operator
      // see https://github.com/styled-components/styled-components/blob/master/packages/styled-components/src/constants.js#L12
      has(_: Window, p: string | number | symbol): boolean {
        return p in rawWindow;
      },

      getOwnPropertyDescriptor(_: Window, p: PropertyKey): PropertyDescriptor | undefined {
        const descriptor = Object.getOwnPropertyDescriptor(rawWindow, p);
        // A property cannot be reported as non-configurable, if it does not exists as an own property of the target object
        if (descriptor && !descriptor.configurable) {
          descriptor.configurable = true;
        }
        return descriptor;
      },
    });
    ```
- 子应用状态的激活和卸载
  ```ts
    active() {
      if (!this.sandboxRunning) {
        // 将子应用运行时状态恢复
        this.currentUpdatedPropsValueMap.forEach((v, p) => setWindowProp(p, v));
      }

      this.sandboxRunning = true;
    }

    inactive() {
      if (process.env.NODE_ENV === 'development') {
        console.info(`[qiankun:sandbox] ${this.name} modified global properties restore...`, [
          ...this.addedPropsMapInSandbox.keys(),
          ...this.modifiedPropsOriginalValueMapInSandbox.keys(),
        ]);
      }
      
      // renderSandboxSnapshot = snapshot(currentUpdatedPropsValueMapForSnapshot);
      // restore global props to initial snapshot
      // 还原运行时修改的全局状态
      this.modifiedPropsOriginalValueMapInSandbox.forEach((v, p) => setWindowProp(p, v));
      // 删除运行时新增的全局状态
      this.addedPropsMapInSandbox.forEach((_, p) => setWindowProp(p, undefined, true));

      this.sandboxRunning = false;
    }
  ```
##### 3.3.2 proxySandBox (一个主应用、多个子应用，即微前端模块)
```ts
  const proxy = new Proxy(fakeWindow, {
      set: (target: FakeWindow, p: PropertyKey, value: any): boolean => {
        if (this.sandboxRunning) {
          // We must kept its description while the property existed in rawWindow before
          if (!target.hasOwnProperty(p) && rawWindow.hasOwnProperty(p)) {
            const descriptor = Object.getOwnPropertyDescriptor(rawWindow, p);
            const { writable, configurable, enumerable } = descriptor!;
            if (writable) {
              Object.defineProperty(target, p, {
                configurable,
                enumerable,
                writable,
                value,
              });
            }
          } else {
            // @ts-ignore
            target[p] = value;
          }

          if (variableWhiteList.indexOf(p) !== -1) {
            // @ts-ignore
            rawWindow[p] = value;
          }
          // 用于删除时恢复fakeWindow
          updatedValueSet.add(p);

          this.latestSetProp = p;

          return true;
        }

        if (process.env.NODE_ENV === 'development') {
          console.warn(`[qiankun] Set window.${p.toString()} while sandbox destroyed or inactive in ${name}!`);
        }

        // 在 strict-mode 下，Proxy 的 handler.set 返回 false 会抛出 TypeError，在沙箱卸载的情况下应该忽略错误
        return true;
      },

      get(target: FakeWindow, p: PropertyKey): any {
        if (p === Symbol.unscopables) return unscopables;

        // avoid who using window.window or window.self to escape the sandbox environment to touch the really window
        // see https://github.com/eligrey/FileSaver.js/blob/master/src/FileSaver.js#L13
        if (p === 'window' || p === 'self') {
          return proxy;
        }

        // hijack global accessing with globalThis keyword
        if (p === 'globalThis') {
          return proxy;
        }

        if (
          p === 'top' ||
          p === 'parent' ||
          (process.env.NODE_ENV === 'test' && (p === 'mockTop' || p === 'mockSafariTop'))
        ) {
          // if your master app in an iframe context, allow these props escape the sandbox
          if (rawWindow === rawWindow.parent) {
            return proxy;
          }
          return (rawWindow as any)[p];
        }

        // proxy.hasOwnProperty would invoke getter firstly, then its value represented as rawWindow.hasOwnProperty
        if (p === 'hasOwnProperty') {
          return hasOwnProperty;
        }

        // mark the symbol to document while accessing as document.createElement could know is invoked by which sandbox for dynamic append patcher
        if (p === 'document' || p === 'eval') {
          setCurrentRunningSandboxProxy(proxy);
          // FIXME if you have any other good ideas
          // remove the mark in next tick, thus we can identify whether it in micro app or not
          // this approach is just a workaround, it could not cover all complex cases, such as the micro app runs in the same task context with master in some case
          nextTick(() => setCurrentRunningSandboxProxy(null));
          switch (p) {
            case 'document':
              return document;
            case 'eval':
              // eslint-disable-next-line no-eval
              return eval;
            // no default
          }
        }

        // eslint-disable-next-line no-nested-ternary
        const value = propertiesWithGetter.has(p)
          ? (rawWindow as any)[p]
          : p in target
            ? (target as any)[p]
            : (rawWindow as any)[p];
        return getTargetValue(rawWindow, value);
      },

      // trap in operator
      // see https://github.com/styled-components/styled-components/blob/master/packages/styled-components/src/constants.js#L12
      has(target: FakeWindow, p: string | number | symbol): boolean {
        return p in unscopables || p in target || p in rawWindow;
      },

      getOwnPropertyDescriptor(target: FakeWindow, p: string | number | symbol): PropertyDescriptor | undefined {
        /*
         as the descriptor of top/self/window/mockTop in raw window are configurable but not in proxy target, we need to get it from target to avoid TypeError
         see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/handler/getOwnPropertyDescriptor
         > A property cannot be reported as non-configurable, if it does not exists as an own property of the target object or if it exists as a configurable own property of the target object.
         */
        if (target.hasOwnProperty(p)) {
          const descriptor = Object.getOwnPropertyDescriptor(target, p);
          descriptorTargetMap.set(p, 'target');
          return descriptor;
        }

        if (rawWindow.hasOwnProperty(p)) {
          const descriptor = Object.getOwnPropertyDescriptor(rawWindow, p);
          descriptorTargetMap.set(p, 'rawWindow');
          // A property cannot be reported as non-configurable, if it does not exists as an own property of the target object
          if (descriptor && !descriptor.configurable) {
            descriptor.configurable = true;
          }
          return descriptor;
        }

        return undefined;
      },

      // trap to support iterator with sandbox
      ownKeys(target: FakeWindow): ArrayLike<string | symbol> {
        return uniq(Reflect.ownKeys(rawWindow).concat(Reflect.ownKeys(target)));
      },

      defineProperty(target: Window, p: PropertyKey, attributes: PropertyDescriptor): boolean {
        const from = descriptorTargetMap.get(p);
        /*
         Descriptor must be defined to native window while it comes from native window via Object.getOwnPropertyDescriptor(window, p),
         otherwise it would cause a TypeError with illegal invocation.
         */
        switch (from) {
          case 'rawWindow':
            return Reflect.defineProperty(rawWindow, p, attributes);
          default:
            return Reflect.defineProperty(target, p, attributes);
        }
      },

      deleteProperty(target: FakeWindow, p: string | number | symbol): boolean {
        if (target.hasOwnProperty(p)) {
          // @ts-ignore
          delete target[p];
          updatedValueSet.delete(p);

          return true;
        }

        return true;
      },
    });
```
- 子应用激活和卸载
```ts
active() {
    if (!this.sandboxRunning) activeSandboxCount++;
    this.sandboxRunning = true;
  }

  inactive() {
    if (process.env.NODE_ENV === 'development') {
      console.info(`[qiankun:sandbox] ${this.name} modified global properties restore...`, [
        ...this.updatedValueSet.keys(),
      ]);
    }

    // 还原全局状态
    if (--activeSandboxCount === 0) {
      variableWhiteList.forEach((p) => {
        if (this.proxy.hasOwnProperty(p)) {
          // @ts-ignore
          delete window[p];
        }
      });
    }

    this.sandboxRunning = false;
  }
```
##### 3.3.3 SnapShotSandbox
- 当浏览器不支持proxy的时候就会改为SnapShotSandbox，它是通过快照的方式来记录和还原沙盒状态的
```ts
  // 子应用卸载时记录的变更的状态
  private modifyPropsMap: Record<any, any> = {};
  active() {
    // 记录当前快照
    this.windowSnapshot = {} as Window;
    iter(window, (prop) => {
      this.windowSnapshot[prop] = window[prop];
    });

    // 恢复之前的变更
    Object.keys(this.modifyPropsMap).forEach((p: any) => {
      window[p] = this.modifyPropsMap[p];
    });

    this.sandboxRunning = true;
  }

  inactive() {
    this.modifyPropsMap = {};

    iter(window, (prop) => {
      if (window[prop] !== this.windowSnapshot[prop]) {
        // 记录变更，恢复环境
        this.modifyPropsMap[prop] = window[prop];
        window[prop] = this.windowSnapshot[prop];
      }
    });

    if (process.env.NODE_ENV === 'development') {
      console.info(`[qiankun:sandbox] ${this.name} origin window restore...`, Object.keys(this.modifyPropsMap));
    }

    this.sandboxRunning = false;
  }
```
##### 3.3.4 创建新的window
```ts
function createFakeWindow(global: Window) {
  // map always has the fastest performance in has check scenario
  // see https://jsperf.com/array-indexof-vs-set-has/23
  const propertiesWithGetter = new Map<PropertyKey, boolean>();
  const fakeWindow = {} as FakeWindow;

  /*
   copy the non-configurable property of global to fakeWindow
   see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/handler/getOwnPropertyDescriptor
   > A property cannot be reported as non-configurable, if it does not exists as an own property of the target object or if it exists as a configurable own property of the target object.
   */

  Object.getOwnPropertyNames(global)
    .filter((p) => {
      // 比如window.location, window.document
      const descriptor = Object.getOwnPropertyDescriptor(global, p);
      return !descriptor?.configurable;
    })
    .forEach((p) => {
      const descriptor = Object.getOwnPropertyDescriptor(global, p);
      if (descriptor) {
        const hasGetter = Object.prototype.hasOwnProperty.call(descriptor, 'get');

        /*
         make top/self/window property configurable and writable, otherwise it will cause TypeError while get trap return.
         see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/handler/get
         > The value reported for a property must be the same as the value of the corresponding target object property if the target object property is a non-writable, non-configurable data property.
         */
        if (
          p === 'top' ||
          p === 'parent' ||
          p === 'self' ||
          p === 'window' ||
          (process.env.NODE_ENV === 'test' && (p === 'mockTop' || p === 'mockSafariTop'))
        ) {
          descriptor.configurable = true;
          /*
           The descriptor of window.window/window.top/window.self in Safari/FF are accessor descriptors, we need to avoid adding a data descriptor while it was
           Example:
            Safari/FF: Object.getOwnPropertyDescriptor(window, 'top') -> {get: function, set: undefined, enumerable: true, configurable: false}
            Chrome: Object.getOwnPropertyDescriptor(window, 'top') -> {value: Window, writable: false, enumerable: true, configurable: false}
           */
          if (!hasGetter) {
            descriptor.writable = true;
          }
        }

        if (hasGetter) propertiesWithGetter.set(p, true);

        // freeze the descriptor to avoid being modified by zone.js
        // see https://github.com/angular/zone.js/blob/a5fe09b0fac27ac5df1fa746042f96f05ccb6a00/lib/browser/define-property.ts#L71
        rawObjectDefineProperty(fakeWindow, p, Object.freeze(descriptor));
      }
    });

  return {
    fakeWindow,
    propertiesWithGetter,
  };
}
``` 



#### 4. 加载子应用
- 利用了缓存机制来实现更快加载
利用container 的name + [XPath](https://www.w3school.com.cn/xpath/xpath_syntax.asp) 来保存已经加载好的应用。
```ts

export function loadMicroApp<T extends ObjectType>(
  app: LoadableApp<T>,
  configuration?: FrameworkConfiguration,
  lifeCycles?: FrameworkLifeCycles<T>,
): MicroApp {
  const { props, name } = app;

 /** 获取container Xpath路径 */
  const getContainerXpath = (container: string | HTMLElement): string | void => {
    const containerElement = getContainer(container);
    if (containerElement) {
      return getXPathForElement(containerElement, document);
    }

    return undefined;
  };
  /** 返回配置结果 */
  const wrapParcelConfigForRemount = (config: ParcelConfigObject): ParcelConfigObject => {
    return {
      ...config,
      // empty bootstrap hook which should not run twice while it calling from cached micro app
      bootstrap: () => Promise.resolve(),
    };
  };

  /**
  *  重点： 如果name + xpath已经被加载过了， 则这个微应用的生命周期函数将不会在再次执行
   * using name + container xpath as the micro app instance id,
   * it means if you rendering a micro app to a dom which have been rendered before,
   * the micro app would not load and evaluate its lifecycles again
   */
  const memorizedLoadingFn = async (): Promise<ParcelConfigObject> => {
    const userConfiguration = configuration ?? { ...frameworkConfiguration, singular: false };
    const { $$cacheLifecycleByAppName } = userConfiguration;
    const container = 'container' in app ? app.container : undefined;

    if (container) {
      // using appName as cache for internal experimental scenario
      if ($$cacheLifecycleByAppName) {
        /** 利用缓存 */
        const parcelConfigGetterPromise = appConfigPromiseGetterMap.get(name);
        if (parcelConfigGetterPromise) return wrapParcelConfigForRemount((await parcelConfigGetterPromise)(container));
      }

      const xpath = getContainerXpath(container);
      if (xpath) {
        const parcelConfigGetterPromise = appConfigPromiseGetterMap.get(`${name}-${xpath}`);
        if (parcelConfigGetterPromise) return wrapParcelConfigForRemount((await parcelConfigGetterPromise)(container));
      }
    }

    const parcelConfigObjectGetterPromise = loadApp(app, userConfiguration, lifeCycles);
    /** 存储loadApp 结果， set 缓存 */
    if (container) {
      if ($$cacheLifecycleByAppName) {
        appConfigPromiseGetterMap.set(name, parcelConfigObjectGetterPromise);
      } else {
        const xpath = getContainerXpath(container);
        if (xpath) appConfigPromiseGetterMap.set(`${name}-${xpath}`, parcelConfigObjectGetterPromise);
      }
    }

    return (await parcelConfigObjectGetterPromise)(container);
  };

  if (!started) {
    // We need to invoke start method of single-spa as the popstate event should be dispatched while the main app calling pushState/replaceState automatically,
    // but in single-spa it will check the start status before it dispatch popstate
    // see https://github.com/single-spa/single-spa/blob/f28b5963be1484583a072c8145ac0b5a28d91235/src/navigation/navigation-events.js#L101
    // ref https://github.com/umijs/qiankun/pull/1071
    startSingleSpa({ urlRerouteOnly: frameworkConfiguration.urlRerouteOnly ?? defaultUrlRerouteOnly });
  }

  return mountRootParcel(memorizedLoadingFn, { domElement: document.createElement('div'), ...props });
}
```
#### 5. 生命周期-链式调用
- 更优雅的写出生命周期函数
```js
// 注册
registerApplication({
    app: async () => {
        loader(true);
       
        const { mount, ...otherMicroAppConfigs } = (
            await loadApp({ name, props, ...appConfig }, frameworkConfiguration, lifeCycles)
        )();

        return {
           // 重点看mount
            mount: [async () => loader(true), ...toArray(mount), async () => loader(false)],
            ...otherMicroAppConfigs,
        };
    }
})

// 生命周期配置结果
const parcelConfig = {
    mount: [
      async () => {
        if (process.env.NODE_ENV === 'development') {
          const marks = performanceGetEntriesByName(markName, 'mark');
          // mark length is zero means the app is remounting
          if (marks && !marks.length) {
            performanceMark(markName);
          }
        }
      },
      async () => {
        if ((await validateSingularMode(singular, app)) && prevAppUnmountedDeferred) {
          return prevAppUnmountedDeferred.promise;
        }

        return undefined;
      },
      // 添加 mount hook, 确保每次应用加载前容器 dom 结构已经设置完毕
      async () => {
        const useNewContainer = remountContainer !== initialContainer;
        if (useNewContainer || !appWrapperElement) {
          // element will be destroyed after unmounted, we need to recreate it if it not exist
          // or we try to remount into a new container
          appWrapperElement = createElement(appContent, strictStyleIsolation, scopedCSS, appName);
          syncAppWrapperElement2Sandbox(appWrapperElement);
        }

        render({ element: appWrapperElement, loading: true, container: remountContainer }, 'mounting');
      },
      mountSandbox,

      // 重点：优雅的按顺序执行一些钩子
      // 使用方法    
      // beforeMount: [
      //   app => {
      //     console.log('[LifeCycle] before mount %c%s', 'color: green;', app.name);
      //   },
      // ],
      // exec the chain after rendering to keep the behavior with beforeLoad
      async () => execHooksChain(toArray(beforeMount), app, global),
      async (props) => mount({ ...props, container: appWrapperGetter(), setGlobalState, onGlobalStateChange }),
      // finish loading after app mounted
      async () => render({ element: appWrapperElement, loading: false, container: remountContainer }, 'mounted'),
      async () => execHooksChain(toArray(afterMount), app, global),
      // initialize the unmount defer after app mounted and resolve the defer after it unmounted
      async () => {
        if (await validateSingularMode(singular, app)) {
          prevAppUnmountedDeferred = new Deferred();
        }
      },
      async () => {
        if (process.env.NODE_ENV === 'development') {
          const measureName = `[qiankun] App ${appInstanceId} Loading Consuming`;
          performanceMeasure(measureName, markName);
        }
      },
    ],
    unmount: [
      async () => execHooksChain(toArray(beforeUnmount), app, global),
      async (props) => unmount({ ...props, container: appWrapperGetter() }),
      unmountSandbox,
      async () => execHooksChain(toArray(afterUnmount), app, global),
      async () => {
        render({ element: null, loading: false, container: remountContainer }, 'unmounted');
        offGlobalStateChange(appInstanceId);
        // for gc
        appWrapperElement = null;
        syncAppWrapperElement2Sandbox(appWrapperElement);
      },
      async () => {
        if ((await validateSingularMode(singular, app)) && prevAppUnmountedDeferred) {
          prevAppUnmountedDeferred.resolve();
        }
      },
    ],
  };  
```
- 如何解析？
```js
/** 重点 按顺序执行钩子1 */
function execHooksChain<T extends ObjectType>(
  hooks: Array<LifeCycleFn<T>>,
  app: LoadableApp<T>,
  global = window,
): Promise<any> {
  if (hooks.length) {
    return hooks.reduce((chain, hook) => chain.then(() => hook(app, global)), Promise.resolve());
  }

  return Promise.resolve();
}
/** 重点 按顺序执行函数2 */
function flattenFnArray(app, lifecycle) {
    let fns = app[lifecycle] || [];

    fns = Array.isArray(fns) ? fns : [fns];
    if (fns.length === 0) {
        fns = [() => Promise.resolve()];
    }

    return function (props) {
        return fns.reduce((resultPromise, fn, index) => {
            return resultPromise.then(() => {
                const thisPromise = fn(props);
                return smellsLikePromise(thisPromise) ? thisPromise :
                    Promise.reject(`Within ${app.name} the lifecycle function ${lifecycle} at array index ${index} did not return a promise`)
            })
        }, Promise.resolve());
    }

}
export function smellsLikeAPromise(promise) {
    return (
        promise &&
        typeof promise.then === "function" &&
        typeof promise.catch === "function"
    );
}





```

#### 6. 当然还有更多
- 如何搭配webpack实现变量注入（用于获取资源等）getAddOn
- 如何兼容不同的路由模式以及历史沙盒实现
- 如何维护全局变量和依赖 initGlobalState
- 以上等等都可以在源码中知晓


#### 分享结束，谢谢大家