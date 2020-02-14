
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


// NATE: there is a nasty edge case that is hard to account for.
// When you are on a word-wrapped line, just where the wrap occurs,
// you are "in between" two lines.  Normally your cursor will show on
// the second line.  The general strategy to get the cursor position
// will insert a zero width span at that point and get the bounding
// rect.  However this bounding rect will be wrong.  It will show the
// cursor as being at the end of the first line (if you look at the
// content of the div, the end of the first line and beginning of the
// second line in a word-wrapped line are the same).  getCursorPosition
// suffers from this bug.  It also suffers from a similar bug when the
// range is not collapsed but happens to span multiple inline elements.
// My solution here only returns true if a range
// is collapsed, this is a compromise that can eventually be improved upon.
// It increases the range to one character, moving both the start and end
// of the range into the nextSibling (if that exists).  Getting the bounding
// rect of this single character appears to return the proper rect.

var emptyDomRect = { x:0, y:0, width: 0, height: 0, top:0, right:0, bottom:0, left:0 }

var firstOrLastLine = function(self){
  var root  = self._root
  var range = self.getSelection()
  var sc    = range.startContainer
  var so    = range.startOffset
  var ec, eo
  if(sc === root){
    moveRangeBoundariesDownTree(range)
    var sc    = range.startContainer
    var so    = range.startOffset
  }
  var parentBlock = getStartBlockOfRange(range)
  if(parentBlock.nodeName == "LI"){
    parentBlock = parentBlock.parentElement
  }
  var numLines    = numberOfLines(root)

  var parentBlockLineNumber   = getLineNumber(parentBlock, root)
  var numLinesParentBlock     = numberOfLinesWithinParentBlock(parentBlock)
  var lineNumberWithinParent
  var lineHeight

  if(!range.collapsed){
    return {firstLine: false, lastLine: false}
  }



  if(sc === parentBlock && so === 0 && sc.childNodes[so].nodeName === "BR"){
    console.info("BR TAG IN OTHERWISE EMPTY DIV")
    lineHeight = window.getComputedStyle(parentBlock, null)["line-height"]
    lineHeight = parseInt(lineHeight)
    lineNumberWithinParent = 0
  }
  else{
    if(sc === parentBlock){
      console.info("MOVING RANGE DOWN TREE")
      moveRangeBoundariesDownTree(range)
      var sc    = range.startContainer
      var so    = range.startOffset
    }
    if(sc.nodeType === TEXT_NODE && so < sc.length){
      range.setEnd(sc, so+1)
    }
    else{
      var nextSibling = sc.nextSibling
      if(nextSibling){
        if(nextSibling.nodeName === "BR"){
          // do nothing, cursor is at the end of the line
        }
        else{
          range.setStart(nextSibling, 0)
          range.setEnd(nextSibling, 0)
          moveRangeBoundariesDownTree(range)
          ec = range.endContainer
          eo = range.endOffset
          if(ec.nodeType === TEXT_NODE && eo < ec.length){
            range.setEnd(ec, eo+1)
          }
        }
      }
    }

    // NATE: we could probably put some sanity checks on this rect.  It
    // should only contain one character thus the width and height should
    // both be reasonably small.
    var rect = range.getBoundingClientRect()
    var nodeOffset;
    // here we need to handle a browser issue where an empty DomRect gets returned by the range sometimes; 
    // in this case we fall back to using the startcontainer startcontainer
    if ( Object.keys(emptyDomRect).every(function(key) { return rect[key]===0}) ){
      nodeOffset = range.startContainer.getBoundingClientRect().top
    } else {
      nodeOffset = rect.top 
    }
    var parentOffset = parentBlock.getBoundingClientRect().top
    // NATE: removed by Daniel in fix-list-scroll.  This was put in place by me, apparently to fix the calculation
    // for empty divs, but it doesn't seem to be necessary.  Maybe that is because now authorea divs have a minimum
    // width and height, just a guess.
    // if(nodeOffset === parentOffset){
    //    return {firstLine: true, lastLine: true}
    // }
    nodeOffset = nodeOffset - parentOffset
    lineHeight = window.getComputedStyle(parentBlock, null)["line-height"]
    lineHeight = parseInt(lineHeight)
    lineNumberWithinParent = Math.round(nodeOffset/lineHeight)
  }

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
