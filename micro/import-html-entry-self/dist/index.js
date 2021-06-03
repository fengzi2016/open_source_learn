import _slicedToArray from "@babel/runtime/helpers/slicedToArray";
import _typeof from "@babel/runtime/helpers/typeof";
import processTpl from './process-tpl';
var defaultFetch = window.fetch.bind(window);
var embedHTMLCache = {}; // 通过new URL 把 entry参数规范化
// new URL https://developer.mozilla.org/en-US/docs/Web/API/URL/URL

export function defaultGetPublicPath(entry) {
  if (_typeof(entry) === 'object') {
    return '/';
  }

  try {
    // URL 构造函数不支持使用 // 前缀的 url
    var _URL = new URL(entry.startsWith('//') ? "".concat(location.protocol).concat(entry) : entry, location.href),
        origin = _URL.origin,
        pathname = _URL.pathname;

    var paths = pathname.split('/'); // 移除最后一个元素

    paths.pop();
    return "".concat(origin).concat(paths.join('/'), "/");
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
  } // 如果没headers，发生在test环境下的mock数据，为兼容原有测试用例


  if (!response.headers) {
    return response.text();
  } // 如果没返回content-type，走默认逻辑


  var contentType = response.headers.get('Content-Type');

  if (!contentType) {
    return response.text();
  } // 解析content-type内的charset
  // Content-Type: text/html; charset=utf-8
  // Content-Type: multipart/form-data; boundary=something
  // GET请求下不会出现第二种content-type


  var charset = 'utf-8';
  var parts = contentType.split(';');

  if (parts.length === 2) {
    var _parts$1$split = parts[1].split('='),
        _parts$1$split2 = _slicedToArray(_parts$1$split, 2),
        value = _parts$1$split2[1];

    var encoding = value && value.trim();

    if (encoding) {
      charset = encoding;
    }
  } // 如果还是utf-8，那么走默认，兼容原有逻辑，这段代码删除也应该工作


  if (charset.toUpperCase() === 'UTF-8') {
    return response.text();
  } // 走流读取，编码可能是gbk，gb2312等，比如sofa 3默认是gbk编码


  return response.blob().then(function (file) {
    return new Promise(function (resolve, reject) {
      var reader = new window.FileReader();

      reader.onload = function () {
        resolve(reader.result);
      };

      reader.onerror = reject;
      reader.readAsText(file, charset);
    });
  });
}

function importHTML(url) {
  var opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  var fetch = defaultFetch;
  /** 是否开启自动检测， 从用户配置里拿*/

  var autoDecodeResponse = false;
  var getPublicPath = defaultGetPublicPath;
  var getTemplate = defaultGetTemplate;
  return embedHTMLCache[url] || (embedHTMLCache[url] = fetch(url).then(function (response) {
    console.log('response', response);
    readResAsString(response, autoDetectCharset);
  })).then(function (html) {
    var assetPublicPath = getPublicPath(url);

    var _processTpl = processTpl(getTemplate(html), assetPublicPath),
        template = _processTpl.template,
        scripts = _processTpl.scripts,
        entry = _processTpl.entry,
        styles = _processTpl.styles;

    console.log("template", template, scripts, entry, styles);
  });
}