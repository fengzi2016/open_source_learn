(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
const _ = require('./util')
const patch = require('./patch')
const listDiff = require('list-diff2')

function diff(oldTree, newTree) {
  const index = 0
  const patches = {}
  dfsWalk(oldTree, newTree, index, patches)
  return patches
}

function dfsWalk(oldNode, newNode, index, patches) {
  const currentPatch = []

  //  节点被删除
  if (newNode === null) {
    // 这个dom将在排序的时候被删除，所以不需要做额外处理
    // Real DOM node will be removed when perform reordering, so has no needs to do anything in here
    // 节点被替换 TextNode content replacing
  } else if (_.isString(oldNode) && _.isString(newNode)) {
    if (newNode !== oldNode) {
      currentPatch.push({
        type: patch.TEXT, content: newNode
      })
    }
    // 节点相同，属性和子节点不同
    // nodes are same, diff old node's props and children
  } else if (oldNode.tagName === newNode.tagName && oldNode.key === newNode.key) {
    // diff props
    const propsPatches = diffProps(oldNode, newNode)
    if (propsPatches) {
      currentPatch.push({ type: patch.PROPS, props: propsPatches })
    }
    // Diff children. If the node has a `ignore` property, do not diff children
    if (!isIgnoreChildren(newNode)) {
      diffChildren(
        oldNode.children,
        newNode.children,
        index,
        patches,
        currentPatch
      )
    }
    // Nodes are not the same, replace the old node with new node
  } else {
    currentPatch.push({
      type: patch.REPLACE,
      node: newNode
    })
  }

  if (currentPatch.length) {
    patches[index] = currentPatch
  }
}

function diffProps(oldNode, newNode) {
  let count = 0
  const oldProps = oldNode.props
  const newProps = newNode.props

  const propsPatches = {}
  let key, value

  // Find out different properties
  for (key in oldProps) {
    value = oldProps[key]
    if (newProps[key] !== value) {
      count++
      propsPatches[key] = newProps[key]
    }
  }

  // Find out new property
  for (key in newProps) {
    value = newProps[key]
    if (!oldProps.hasOwnProperty(key)) {
      count++
      propsPatches[key] = value
    }
  }

  // If properties all are identical
  if (count === 0) {
    return null
  }

  return propsPatches
}

function isIgnoreChildren(node) {
  return (node.props && node.props.hasOwnProperty('ignore'))
}

function diffChildren(oldChildren, newChildren, index, patches, currentPatch) {
  const diffs = listDiff(oldChildren, newChildren, 'key')
  console.log('diffs', diffs);
  newChildren = diffs.children

  if (diffs.moves.length) {
    const reorderPatch = { type: patch.REORDER, moves: diffs.moves }
    currentPatch.push(reorderPatch)
  }

  let leftNode = null
  let currentNodeIndex = index

  _.each(oldChildren, function (child, i) {
    const newChild = newChildren[i]
    currentNodeIndex = (leftNode && leftNode.count) ? currentNodeIndex + leftNode.count + 1 : currentNodeIndex + 1
    console.log('leftNode', leftNode);
    dfsWalk(child, newChild, currentNodeIndex, patches)
    leftNode = child
  })
}

module.exports = diff

},{"./patch":6,"./util":8,"list-diff2":4}],2:[function(require,module,exports){
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

},{"./util":8}],3:[function(require,module,exports){
exports.el = require('./element')
exports.diff = require('./diff')
exports.patch = require('./patch')

},{"./diff":1,"./element":2,"./patch":6}],4:[function(require,module,exports){
module.exports = require('./lib/diff').diff

},{"./lib/diff":5}],5:[function(require,module,exports){
/**
 * Diff two list in O(N).
 * @param {Array} oldList - Original List
 * @param {Array} newList - List After certain insertions, removes, or moves
 * @return {Object} - {moves: <Array>}
 *                  - moves is a list of actions that telling how to remove and insert
 */
function diff (oldList, newList, key) {
  var oldMap = makeKeyIndexAndFree(oldList, key)
  var newMap = makeKeyIndexAndFree(newList, key)

  var newFree = newMap.free

  var oldKeyIndex = oldMap.keyIndex
  var newKeyIndex = newMap.keyIndex

  var moves = []

  // a simulate list to manipulate
  var children = []
  var i = 0
  var item
  var itemKey
  var freeIndex = 0

  // fist pass to check item in old list: if it's removed or not
  while (i < oldList.length) {
    item = oldList[i]
    itemKey = getItemKey(item, key)
    if (itemKey) {
      if (!newKeyIndex.hasOwnProperty(itemKey)) {
        children.push(null)
      } else {
        var newItemIndex = newKeyIndex[itemKey]
        children.push(newList[newItemIndex])
      }
    } else {
      var freeItem = newFree[freeIndex++]
      children.push(freeItem || null)
    }
    i++
  }

  var simulateList = children.slice(0)

  // remove items no longer exist
  i = 0
  while (i < simulateList.length) {
    if (simulateList[i] === null) {
      remove(i)
      removeSimulate(i)
    } else {
      i++
    }
  }

  // i is cursor pointing to a item in new list
  // j is cursor pointing to a item in simulateList
  var j = i = 0
  while (i < newList.length) {
    item = newList[i]
    itemKey = getItemKey(item, key)

    var simulateItem = simulateList[j]
    var simulateItemKey = getItemKey(simulateItem, key)

    if (simulateItem) {
      if (itemKey === simulateItemKey) {
        j++
      } else {
        // new item, just inesrt it
        if (!oldKeyIndex.hasOwnProperty(itemKey)) {
          insert(i, item)
        } else {
          // if remove current simulateItem make item in right place
          // then just remove it
          var nextItemKey = getItemKey(simulateList[j + 1], key)
          if (nextItemKey === itemKey) {
            remove(i)
            removeSimulate(j)
            j++ // after removing, current j is right, just jump to next one
          } else {
            // else insert item
            insert(i, item)
          }
        }
      }
    } else {
      insert(i, item)
    }

    i++
  }

  function remove (index) {
    var move = {index: index, type: 0}
    moves.push(move)
  }

  function insert (index, item) {
    var move = {index: index, item: item, type: 1}
    moves.push(move)
  }

  function removeSimulate (index) {
    simulateList.splice(index, 1)
  }

  return {
    moves: moves,
    children: children
  }
}

/**
 * Convert list to key-item keyIndex object.
 * @param {Array} list
 * @param {String|Function} key
 */
function makeKeyIndexAndFree (list, key) {
  var keyIndex = {}
  var free = []
  for (var i = 0, len = list.length; i < len; i++) {
    var item = list[i]
    var itemKey = getItemKey(item, key)
    if (itemKey) {
      keyIndex[itemKey] = i
    } else {
      free.push(item)
    }
  }
  return {
    keyIndex: keyIndex,
    free: free
  }
}

function getItemKey (item, key) {
  if (!item || !key) return void 666
  return typeof key === 'string'
    ? item[key]
    : key(item)
}

exports.makeKeyIndexAndFree = makeKeyIndexAndFree // exports for test
exports.diff = diff

},{}],6:[function(require,module,exports){
const _ = require('./util')

// 替换
const REPLACE = 0
// 改顺序
const REORDER = 1
// 变更props
const PROPS = 2
// 变更值
const TEXT = 3

function patch(node, patches) {
    console.log('node', node, patches);
    const walker = { index: 0 }
    dfsWalk(node, walker, patches)
}

function dfsWalk(node, walker, patches) {
    const currentPatches = patches[walker.index]

    const len = node.childNodes ? node.childNodes.length : 0
    for (let i = 0; i < len; i++) {
        const child = node.childNodes[i]
        walker.index++
        dfsWalk(child, walker, patches)
    }

    if (currentPatches) {
        applyPatches(node, currentPatches)
    }
}

function applyPatches(node, currentPatches) {
    _.each(currentPatches, function (currentPatch) {
        switch (currentPatch.type) {
            case REPLACE:
                const newNode = (typeof currentPatch.node === 'string')
                    ? document.createTextNode(currentPatch.node) : currentPatch.node.render()
                node.parentNode.replaceChild(newNode, node)
                break
            case REORDER:
                reorderChildren(node, currentPatch.moves)
                break
            case PROPS:
                setProps(node, currentPatch.props)
                break
            case TEXT:
                if (node.textContent) {
                    node.textContent = currentPatch.content
                } else {
                    // for ie
                    node.nodeValue = currentPatch.content
                }
                break
            default:
                throw new Error('Unknown patch type ' + currentPatch.type)
        }
    })
}

function reorderChildren(node, moves) {
    console.log('moves', node, moves);
    const staticNodeList = _.toArray(node.childNodes)
    const maps = {}

    _.each(staticNodeList, function (node) {
        if (node.nodeType === 1) {
            const key = node.getAttribute('key')
            if (key) {
                maps[key] = node
            }
        }
    })

    console.log('maps', maps);
    _.each(moves, function (move) {
        const index = move.index
        // remove item
        if (move.type === 0) {
            // maybe have been removed for inserting
            if (staticNodeList[index] === node.childNodes[index]) {
                node.removeChild(node.childNodes[index])
            }
            staticNodeList.splice(index, 1)
        } else if (move.type === 1) {
            // insert item
            const insertNode = maps[move.item.key] ? maps[move.item.key].cloneNode(true) // reuse old item
                : (typeof move.item === 'object') ? move.item.render() : document.createTextNode(move.item)

            staticNodeList.splice(index, 0, insertNode)
            node.insertBefore(insertNode, node.childNodes[index] || null)
        }
    })
}

function setProps(node, props) {
    for (const key in props) {
        if (props[key] === void 666) {
            node.removeAttribute(key)
        } else {
            const value = props[key]
            _.setAttr(node, key, value)
        }
    }
}

patch.REPLACE = REPLACE
patch.REORDER = REORDER
patch.PROPS = PROPS
patch.TEXT = TEXT

module.exports = patch

},{"./util":8}],7:[function(require,module,exports){
window.svd = require('./index')
},{"./index":3}],8:[function(require,module,exports){
const _ = exports

_.type = function (obj) {
  return Object.prototype.toString.call(obj).replace(/\[object\s|\]/g, '')
}

_.isArray = function isArray (list) {
  return _.type(list) === 'Array'
}

_.slice = function slice (arrayLike, index) {
  return Array.prototype.slice.call(arrayLike, index)
}

_.truthy = function truthy (value) {
  return !!value
}

_.isString = function isString (list) {
  return _.type(list) === 'String'
}

_.each = function each (array, fn) {
  for (let i = 0, len = array.length; i < len; i++) {
    fn(array[i], i)
  }
}

_.toArray = function toArray (listLike) {
  if (!listLike) {
    return []
  }

  const list = []

  for (let i = 0, len = listLike.length; i < len; i++) {
    list.push(listLike[i])
  }

  return list
}

_.setAttr = function setAttr (node, key, value) {
  switch (key) {
    case 'style':
      node.style.cssText = value
      break
    case 'value':
      var tagName = node.tagName || ''
      tagName = tagName.toLowerCase()
      if (
        tagName === 'input' || tagName === 'textarea'
      ) {
        node.value = value
      } else {
        // if it is not a input or textarea, use `setAttribute` to set
        node.setAttribute(key, value)
      }
      break
    default:
      node.setAttribute(key, value)
      break
  }
}

},{}]},{},[7]);
