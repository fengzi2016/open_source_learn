//app1.js
let domEl;
export function bootstrap(props) {
    return Promise
        .resolve()
        .then(() => {
            domEl = document.createElement('div');
            domEl.id = 'app2';
            document.body.appendChild(domEl);
        });
}
export function mount(props) {
    return Promise
        .resolve()
        .then(() => {
            // 在这里通常使用框架将ui组件挂载到dom。请参阅https://single-spa.js.org/docs/ecosystem.html。
            domEl.textContent = 'App 2 is mounted!'
            /** JS污染，相应的样式也会污染*/
            console.log("app2", window.app1)
        });
}
export function unmount(props) {
    return Promise
        .resolve()
        .then(() => {
            // 在这里通常是通知框架把ui组件从dom中卸载。参见https://single-spa.js.org/docs/ecosystem.html
            domEl.textContent = '';
        })
}