const _ = require('./util')

function Element(tagName, props, children) {
  if (!(this instanceof Element)) {
    // 兼容第三个参数不是数组的情况，则将第三个参数后面的参数都作为children
    if (!_.isArray(children) && children !== null) {
      children = _.slice(arguments, 2).filter(_.truthy)
    }
    return new Element(tagName, props, children)
  }

  // 兼容第二个参数是数组的情况，则将第二个参数作为children
  if (_.isArray(props)) {
    children = props
    props = {}
  }

  this.tagName = tagName
  this.props = props || {}
  this.children = children || []

  this.key = props ? props.key : void 666

  let count = 0
  // 计算整颗树的节点数量
  _.each(this.children, function (child, i) {
    if (child instanceof Element) {
      count += child.count
    } else {
      children[i] = '' + child
    }
    count++
  })

  this.count = count
}
// 将虚拟dom转化为真实DOM
Element.prototype.render = function () {
  const el = document.createElement(this.tagName)
  const props = this.props
  // 给dom加属性
  for (const propName in props) {
    const propValue = props[propName]
    _.setAttr(el, propName, propValue)
  }
  // 将子节点也进行render
  _.each(this.children, function (child) {
    const childEl = (child instanceof Element) ? child.render() : document.createTextNode(child)
    el.appendChild(childEl)
  })

  return el
}

module.exports = Element
