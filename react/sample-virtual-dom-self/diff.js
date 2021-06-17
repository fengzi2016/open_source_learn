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
    // 这个使得自顶向下的排序不会重复记录子节点变更，因为diffs.children是排序后的节点
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
