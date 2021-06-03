//main.js
import * as singleSpa from './single-spa/index.js';
const name = 'app1';
/* loading 是一个返回 promise 的函数，用于 加载/解析 应用代码。
 * 它的目的是为延迟加载提供便利 —— single-spa 只有在需要时才会下载应用程序的代码。
 * 在这个示例中，在 webpack 中支持 import ()并返回 Promise，但是 single-spa 可以使用任何返回 Promise 的加载函数。
 */
const app = () => import('./app1.js');
/* Single-spa 配置顶级路由，以确定哪个应用程序对于指定 url 是活动的。
 * 您可以以任何您喜欢的方式实现此路由。
 * 一种有用的约定是在url前面加上活动应用程序的名称，以使顶层路由保持简单。
 */
const activeWhen = '/app1';
singleSpa.registerApplication(name, app, activeWhen);


const name2 = 'app2';
const app2 = () => import('./app2.js');
const activeWhen2 = '/app2';

singleSpa.registerApplication(name2, app2, activeWhen2);

singleSpa.start();