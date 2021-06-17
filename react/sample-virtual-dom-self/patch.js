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
