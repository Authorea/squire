// LINE_DIFF_MARGIN is the difference, in pixels, which is used to decide if two bouding
// rectangles are at the same height.  Turns out the cursor position changes slightly
// at the end of a line.
var LINE_DIFF_MARGIN = 1.0

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



// The line below the current line can be one of two things:
// 1. The next block.
// 2. The same block but on the following word-wrapped line.
// In the former case, we first get the next block and then we advance the cursor in that block
// until it surpasses the x-coord of the current cursor.
// In the latter case, we advance the cursor in the current block until it reaches the next word-wrapped
// line, and then we advance the cursor in that block
// until it surpasses the x-coord of the current cursor.
var moveRangeDownLine = function(range, root){
  var sc    = range.startContainer
  var so    = range.startOffset
  // We are going to collapse the range, in the long term there might be operations where this is not
  // desirable but it simplifies the problem.
  range.setEnd(sc, so)
  var cursorRect  = range.getBoundingClientRect()
  var walker = new TreeWalker(root, SHOW_TEXT, function(){return true})
  walker.currentNode = sc
  var currentOffset = so

  // Nate: a bit buggy at the moment, sometimes the range passed in is not focused on a text node, we can fix that
  // easily, however there is a tricky bit to take into account.  If the current node is on an equation, it might
  // have a cursorRect of 0,0,0,0 (I believe this is due to hidden nodes) which will confuse the algorithm.
  // In that case we can set the position to the end of the previous text node.  In most cases this will work,
  // I assume there are edge cases where the cursor movement might be strange.
  if(walker.currentNode.nodeType !== Node.TEXT_NODE){
    walker.currentNode = walker.previousNode()
    if(!walker.currentNode){
      return range
    }
    range.setStart(walker.currentNode, walker.currentNode.length)
    range.setEnd(walker.currentNode, walker.currentNode.length)
    cursorRect  = range.getBoundingClientRect()
    so = walker.currentNode.length
  }

  var found = false
  var onNextLine = false
  var currentRect  = range.getBoundingClientRect()
  var nextLineBottom
  while(onNextLine === false){
    while(currentOffset < walker.currentNode.length - 1){
      range.setStart(walker.currentNode, currentOffset)
      range.setEnd(walker.currentNode, currentOffset)
      currentRect = range.getBoundingClientRect()
      currentOffset += 1
      if(currentRect.height > 0 && Math.abs(currentRect.bottom - cursorRect.bottom) > LINE_DIFF_MARGIN){
        onNextLine = true
        nextLineBottom = currentRect.bottom
        break
      }
    }
    if(onNextLine){
      break
    }
    walker.nextNode()
    currentOffset = 0
  }
  var previousNode = walker.currentNode
  var currentNode  = walker.currentNode
  while(!found){
    if(!currentNode){
      range.setStart(previousNode, previousNode.length)
      range.setEnd(previousNode, previousNode.length)
      found = true
      break
    }
    while(currentOffset < currentNode.length - 1){
      range.setStart(currentNode, currentOffset)
      range.setEnd(currentNode, currentOffset)
      currentRect = range.getBoundingClientRect()
      if(currentRect.height > 0 && currentRect.left >= cursorRect.left){
        found = true
        break
      }
      if(currentRect.height > 0 && Math.abs(currentRect.bottom - nextLineBottom) > LINE_DIFF_MARGIN){
        if(currentOffset === 0){
          range.setStart(previousNode, previousNode.length)
          range.setEnd(previousNode, previousNode.length)

        }
        else{
          range.setStart(currentNode, currentOffset-1)
          range.setEnd(currentNode, currentOffset-1)
        }
        found = true
        break
      }
      currentOffset += 1
    }
    if(found){
      break
    }
    previousNode = currentNode
    currentNode  = walker.nextNode()
    currentOffset = 0
  }

  return range
}

var moveRangeUpLine = function(range, root){
  var sc    = range.startContainer
  var so    = range.startOffset
  // We are going to collapse the range, in the long term there might be operations where this is not
  // desirable but it simplifies the problem.
  range.setEnd(sc, so)
  var cursorRect  = range.getBoundingClientRect()
  // We could have a walker skip all notEditable nodes, but it is only math which
  // has an issue and I think we can check for items which have no height and skip them
  // instead
  // var walker = new TreeWalker( root, SHOW_TEXT, function (node) {
  //   return(!notEditable(node))
  // })
  var walker = new TreeWalker(root, SHOW_TEXT, function(){return true})
  walker.currentNode = sc
  var currentOffset = so

  // Nate: a bit buggy at the moment, sometimes the range passed in is not focused on a text node, we can fix that
  // easily:
  if(walker.currentNode.nodeType !== Node.TEXT_NODE){
    walker.currentNode = walker.previousNode()
    if(!walker.currentNode){
      return range
    }
    range.setStart(walker.currentNode, walker.currentNode.length)
    range.setEnd(walker.currentNode, walker.currentNode.length)
    cursorRect  = range.getBoundingClientRect()
    so = walker.currentNode.length
  }

  var found = false
  var onNextLine = false
  var currentRect  = range.getBoundingClientRect()
  var nextLineBottom
  while(onNextLine === false){
    while(currentOffset > -1){
      range.setStart(walker.currentNode, currentOffset)
      range.setEnd(walker.currentNode, currentOffset)
      currentRect = range.getBoundingClientRect()
      currentOffset -= 1
      if(currentRect.height > 0 && Math.abs(currentRect.bottom - cursorRect.bottom) > LINE_DIFF_MARGIN){
        console.info("found previous line")
        console.info(currentRect.bottom)
        console.info(cursorRect.bottom)
        onNextLine = true
        nextLineBottom = currentRect.bottom
        break
      }
    }
    if(onNextLine){
      break
    }
    walker.previousNode()
    currentOffset = walker.currentNode && walker.currentNode.length
  }
  console.info("on previous line")
  var previousNode = walker.currentNode
  var currentNode  = walker.currentNode
  while(!found){
    if(!currentNode){
      console.info("!currentNode")
      range.setStart(previousNode, previousNode.length)
      range.setEnd(previousNode, previousNode.length)
      found = true
      break
    }
    while(currentOffset > -1){
      range.setStart(currentNode, currentOffset)
      range.setEnd(currentNode, currentOffset)
      currentRect = range.getBoundingClientRect()
      if(currentRect.height > 0 && currentRect.left <= cursorRect.left){
        console.info("currentRect.left <= cursorRect.left")
        found = true
        break
      }
      if( currentRect.height > 0 && Math.abs(currentRect.bottom - nextLineBottom) > LINE_DIFF_MARGIN ) {
        console.info("currentRect.bottom !== nextLineBottom")
        console.info(currentRect.bottom)
        console.info(nextLineBottom)
        if(currentOffset === currentNode.length){
          range.setStart(previousNode, previousNode.length)
          range.setEnd(previousNode, previousNode.length)

        }
        else{
          range.setStart(currentNode, currentOffset+1)
          range.setEnd(currentNode, currentOffset+1)
        }
        found = true
        break
      }
      currentOffset -= 1
    }
    if(found){
      break
    }
    previousNode = currentNode
    currentNode  = walker.previousNode()
    currentOffset = walker.currentNode && walker.currentNode.length
  }

  return range
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
var cursorInfo = function(self, options){
  var defaultOptions = {
    findNodeAbove: false,
    findNodeBelow: false
  }
  options = Object.assign({}, defaultOptions, options)
  var root  = self._root
  var range = self.getSelection()
  var sc    = range.startContainer
  var so    = range.startOffset
  var ec, eo
  var cursorInfo = {
    // parentBlock: null,
    // firstLine: false,
    // lastLine: false,
    // parentBlockLineNumber: 0,
    // numLineParentBlock: 0,
    // lineNumberWithinParent: 0
    // sc: null,
    // so: 0,
  }
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
  var rect
  var nodeOffset
  var parentOffset

  if(!range.collapsed){
    // TODO: UPDATE return vlue
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
      // NATE: this is the trick to figuring out if we are at the end of a word-wrapped
      // line, adding one character will make the selection overflow to the next line
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
    rect = range.getBoundingClientRect()
    nodeOffset = rect.top
    parentOffset = parentBlock.getBoundingClientRect().top
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
      cursorInfo.firstLine = true
      cursorInfo.lastLine  = true
    }
    else{
      cursorInfo.firstLine = true
      cursorInfo.lastLine  = false
    }
  }
  else if(parentBlockLineNumber  === numLines-1 &&
          lineNumberWithinParent === numLinesParentBlock-1){
    cursorInfo.firstLine = false
    cursorInfo.lastLine  = true
  }
  else{
    cursorInfo.firstLine = false
    cursorInfo.lastLine  = false
  }
  if(options.findNodeAbove){
    cursorInfo.rangeAbove = moveRangeUpLine(range, root)
  }
  if(options.findNodeBelow){
    cursorInfo.rangeBelow = moveRangeDownLine(range, root)
  }
  cursorInfo.parentBlock           = parentBlock
  cursorInfo.parentBlockLineNumber = parentBlockLineNumber
  cursorInfo.numLinesParentBlock   = numLinesParentBlock
  console.info(cursorInfo)
  return cursorInfo
}

var isFirstLine = function(self){
  var res = cursorInfo(self)
  return res["firstLine"]

}
var isLastLine = function(self){
  var res = cursorInfo(self)
  return res["lastLine"]
}
