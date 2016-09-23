
var getLineNumber = function(node, root){
  if(root === node.parentNode) {
    return indexOf.call(root.childNodes, node)
  }
  else {
    return getLineNumber(node.parentNode, root)
  }
}

var numberOfLines = function(root){
  return root.childNodes.length
}

var lineNumberWithinParentBlock = function(node, parent){
  var nodeOffset = node.offsetTop
  var parentOffset = parent.offsetTop
  if(nodeOffset === parentOffset){
    return 0
  }
  nodeOffset = nodeOffset - parentOffset
  var lineHeight = window.getComputedStyle(parent, null)["line-height"]
  lineHeight = parseInt(lineHeight)
  var lineNumber = Math.round(nodeOffset/lineHeight)
  return lineNumber
}

var numberOfLinesWithinParentBlock = function(parent){
  var parentHeight = parent.offsetHeight
  var lineHeight = window.getComputedStyle(parent, null)["line-height"]
  lineHeight = parseInt(lineHeight)
  var numLines = Math.round(parentHeight/lineHeight)
  return numLines
}

// NATE: this is kind of tricky since there is no browser way of getting
// the current text cursor position in xy coordinates (as far as
// I can tell).  So instead we insert a span, figure out its line number
// within the parent block, and figure out the parent block line number
// within the editor.
var firstOrLastLine = function(self){
  var root = self._root
  var range = self.getSelection()
  var parentBlock = getStartBlockOfRange(range)
  var cursorNode = self.createElement( 'SPAN', {
            id: 'cursor-start'
  });
  var numLines = numberOfLines(root)

  insertNodeInRange( range, cursorNode );
  var parentBlockLineNumber   = getLineNumber(parentBlock, root)
  var lineNumberWithinParent  = lineNumberWithinParentBlock(cursorNode, parentBlock)
  var numLinesParentBlock    = numberOfLinesWithinParentBlock(parentBlock)
  detach(cursorNode)
  mergeInlines( range.startContainer, range );
  if(parentBlockLineNumber === 0 && lineNumberWithinParent === 0){
    if(numLines === 1 && numLinesParentBlock === 1){
      return {firstLine: true, lastLine: true}
    }
    else{
      return {firstLine: true, lastLine: false}
    }
  }
  else if(parentBlockLineNumber  === numLines-1 &&
          lineNumberWithinParent === numLinesParentBlock-1){
    return {firstLine: false, lastLine: true}
  }
  else{
    return {firstLine: false, lastLine: false}
  }
}

var isFirstLine = function(self){
  var res = firstOrLastLine(self)
  return res["firstLine"]
}

var isLastLine = function(self){
  var res = firstOrLastLine(self)
  return res["lastLine"]
}
