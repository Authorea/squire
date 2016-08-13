/*jshint strict:false, undef:false, unused:false */

var keys = {
    8: 'backspace',
    9: 'tab',
    13: 'enter',
    32: 'space',
    33: 'pageup',
    34: 'pagedown',
    37: 'left',
    39: 'right',
    46: 'delete',
    219: '[',
    221: ']',
    40:  'down',
    38:  'up'

};

// Ref: http://unixpapa.com/js/key.html
var onKey = function ( event ) {
    window.k = event

    var code = event.keyCode,
        key = keys[ code ],
        modifiers = '',
        range = this.getSelection();
    var sc = range.startContainer
    var so = range.startOffset
    if(isZWNBS(sc)){
        console.info("INSIDE ZWNBS")
    }

    if ( event.defaultPrevented ) {
        return;
    }

    if ( !key ) {
        key = String.fromCharCode( code ).toLowerCase();
        // Only reliable for letters and numbers
        if ( !/^[A-Za-z0-9]$/.test( key ) ) {
            key = '';
        }
    }

    // On keypress, delete and '.' both have event.keyCode 46
    // Must check event.which to differentiate.
    if ( isPresto && event.which === 46 ) {
        key = '.';
    }

    // Function keys
    if ( 111 < code && code < 124 ) {
        key = 'f' + ( code - 111 );
    }

    // We need to apply the backspace/delete handlers regardless of
    // control key modifiers.
    if ( key !== 'backspace' && key !== 'delete' ) {
        if ( event.altKey  ) { modifiers += 'alt-'; }
        if ( event.ctrlKey ) { modifiers += 'ctrl-'; }
        if ( event.metaKey ) { modifiers += 'meta-'; }
    }
    // However, on Windows, shift-delete is apparently "cut" (WTF right?), so
    // we want to let the browser handle shift-delete.
    if ( event.shiftKey ) { modifiers += 'shift-'; }

    key = modifiers + key;

    if ( this._keyHandlers[ key ] ) {
        this._keyHandlers[ key ]( this, event, range );
    } else if ( key.length === 1 && !range.collapsed ) {
        // Record undo checkpoint.
        this._recordUndoState( range );
        this._getRangeAndRemoveBookmark( range );
        // Delete the selection
        deleteContentsOfRange( range );
        this._ensureBottomLine();
        this.setSelection( range );
        this._updatePath( range, true );
    }

};

var mapKeyTo = function ( method ) {
    return function ( self, event ) {
        event.preventDefault();
        self[ method ]();
    };
};

var mapKeyToFormat = function ( tag, remove ) {
    remove = remove || null;
    return function ( self, event ) {
        event.preventDefault();
        var range = self.getSelection();
        if ( self.hasFormat( tag, null, range ) ) {
            self.changeFormat( null, { tag: tag }, range );
        } else {
            self.changeFormat( { tag: tag }, remove, range );
        }
    };
};

// If you delete the content inside a span with a font styling, Webkit will
// replace it with a <font> tag (!). If you delete all the text inside a
// link in Opera, it won't delete the link. Let's make things consistent. If
// you delete all text inside an inline tag, remove the inline tag.
var afterDelete = function ( self, range ) {
    // console.info("after delete")
    try {
        ensureBrAtEndOfAllLines(self._body)
        ensurePreZNodesForContentEditable(self._body)
        removeDanglingZNodes(self._body)
        removeEmptyInlines( self._body )

        if ( !range ) { range = self.getSelection(); }
        var node = range.startContainer,
            parent;
        // Climb the tree from the focus point while we are inside an empty
        // inline element
        if ( node.nodeType === TEXT_NODE ) {
            node = node.parentNode;
        }
        parent = node;
        window.p44 = parent
        window.n44 = node
        while ( isInline( parent ) &&
                ( !parent.textContent || parent.textContent === ZWS ) ) {
            node = parent;
            parent = node.parentNode;
        }
        window.p55 = parent
        window.n55 = parent

        // If focussed in empty inline element
        if ( node !== parent ) {
            console.info("removing empty inline")
            // Move focus to just before empty inline(s)
            range.setStart( parent,
                indexOf.call( parent.childNodes, node ) );
            range.collapse( true );
            // Remove empty inline(s)
            parent.removeChild( node );
            // Fix cursor in block
            if ( !isBlock( parent ) ) {
                parent = getPreviousBlock( parent );
            }
            fixCursor( parent );
            // Move cursor into text node
            console.info("moving range down tree")
            moveRangeBoundariesDownTree( range );
        }
        // If you delete the last character in the sole <div> in Chrome,
        // it removes the div and replaces it with just a <br> inside the
        // body. Detach the <br>; the _ensureBottomLine call will insert a new
        // block.
        if ( node.nodeName === 'BODY' &&
                ( node = node.firstChild ) && node.nodeName === 'BR' ) {
            detach( node );
        }
        self._ensureBottomLine();
        self.setSelection( range );
        self._updatePath( range, true );
    } catch ( error ) {
        self.didError( error );
    }
};

var ensureOutsideOfNotEditable = function ( self ){
    var range = self.getSelection()
    moveRangeOutOfNotEditable(range)
    self.setSelection(range)
};

var keyHandlers = {
    enter: function ( self, event, range ) {
        var block, parent, nodeAfterSplit;

        // We handle this ourselves
        event.preventDefault();

        // Save undo checkpoint and add any links in the preceding section.
        // Remove any zws so we don't think there's content in an empty
        // block.
        self._recordUndoState( range );
        addLinks( range.startContainer );
        self._removeZWS();
        self._getRangeAndRemoveBookmark( range );

        // Selected text is overwritten, therefore delete the contents
        // to collapse selection.
        if ( !range.collapsed ) {
            deleteContentsOfRange( range );
        }

        block = getStartBlockOfRange( range );

        // If this is a malformed bit of document or in a table;
        // just play it safe and insert a <br>.
        if ( !block || /^T[HD]$/.test( block.nodeName ) ) {
            insertNodeInRange( range, self.createElement( 'BR' ) );
            range.collapse( false );
            self.setSelection( range );
            self._updatePath( range, true );
            return;
        }

        // If in a list, we'll split the LI instead.
        if ( parent = getNearest( block, 'LI' ) ) {
            block = parent;
        }

        if ( !block.textContent ) {
            // Break list
            if ( getNearest( block, 'UL' ) || getNearest( block, 'OL' ) ) {
                return self.modifyBlocks( decreaseListLevel, range );
            }
            // Break blockquote
            else if ( getNearest( block, 'BLOCKQUOTE' ) ) {
                return self.modifyBlocks( removeBlockQuote, range );
            }
        }
        // Otherwise, split at cursor point.
        nodeAfterSplit = splitBlock( self, block,
            range.startContainer, range.startOffset );

        // Clean up any empty inlines if we hit enter at the beginning of the
        // block
        removeZWS( block );
        removeEmptyInlines( block );
        fixCursor( block );

        // Focus cursor
        // If there's a <b>/<i> etc. at the beginning of the split
        // make sure we focus inside it.
        while ( nodeAfterSplit.nodeType === ELEMENT_NODE ) {
            var child = nodeAfterSplit.firstChild,
                next;

            // Don't continue links over a block break; unlikely to be the
            // desired outcome.
            if ( nodeAfterSplit.nodeName === 'A' &&
                    ( !nodeAfterSplit.textContent ||
                        nodeAfterSplit.textContent === ZWS ) ) {
                child = self._doc.createTextNode( '' );
                replaceWith( nodeAfterSplit, child );
                nodeAfterSplit = child;
                break;
            }


            if ( nodeAfterSplit.nodeType !== TEXT_NODE && notEditable(nodeAfterSplit)) {
                break;
            }
            while ( child && child.nodeType === TEXT_NODE && !child.data ) {
                next = child.nextSibling;
                if ( !next || next.nodeName === 'BR' ) {
                    break;
                }
                detach( child );
                child = next;
            }

            // 'BR's essentially don't count; they're a browser hack.
            // If you try to select the contents of a 'BR', FF will not let
            // you type anything!
            if ( !child || child.nodeName === 'BR' ||
                    ( child.nodeType === TEXT_NODE && !isPresto ) ) {
                break;
            }
            nodeAfterSplit = child;
        }
        range = self._createRange( nodeAfterSplit, 0 );
        self.setSelection( range );
        self._updatePath( range, true );

        // Scroll into view
        if ( nodeAfterSplit.nodeType === TEXT_NODE ) {
            nodeAfterSplit = nodeAfterSplit.parentNode;
        }
        var doc = self._doc,
            body = self._body;
        if ( nodeAfterSplit.offsetTop + nodeAfterSplit.offsetHeight >
                ( doc.documentElement.scrollTop || body.scrollTop ) +
                body.offsetHeight ) {
            nodeAfterSplit.scrollIntoView( false );
        }
    },
    backspace: function ( self, event, range ) {
        self.backspace(self, event, range)
    },
    'delete': function ( self, event, range ) {
        console.info("deleting")
        self._removeZWS();
        // Record undo checkpoint.
        self._recordUndoState( range );
        self._getRangeAndRemoveBookmark( range );
        // If not collapsed, delete contents
        if ( !range.collapsed ) {
            console.info("deleting contents of range")
            event.preventDefault();
            deleteContentsOfRange( range );
            afterDelete( self, range );
        }
        // If at end of block, merge next into this block
        else if ( rangeDoesEndAtBlockBoundary( range ) ) {
            console.info("ends at block boundary")
            event.preventDefault();
            var current = getStartBlockOfRange( range ),
                next = current && getNextBlock( current );
            // Must not be at the very end of the text area.
            if ( next ) {
                // If not editable, just delete whole block.
                if ( notEditable(next) ) {
                    detach( next );
                    return;
                }
                // Otherwise merge.
                mergeWithBlock( current, next, range );
                // If deleted line between containers, merge newly adjacent
                // containers.
                next = current.parentNode;
                while ( next && !next.nextSibling ) {
                    next = next.parentNode;
                }
                if ( next && ( next = next.nextSibling ) ) {
                    mergeContainers( next );
                }
                self.setSelection( range );
                self._updatePath( range, true );
            }
        }
        else {
            var sc = range.startContainer
            var so = range.startOffset
            if(sc.nodeType === ELEMENT_NODE){
                var ch = sc.childNodes[so]
                if(notEditable(ch)){
                    detach( next );
                }
            }
            //else leave it to browser
            setTimeout( function () { afterDelete( self ); }, 0 );
        }
    },
    tab: function ( self, event, range ) {
        var node, parent;
        self._removeZWS();
        // If no selection and in an empty block
        if ( range.collapsed &&
                rangeDoesStartAtBlockBoundary( range ) &&
                rangeDoesEndAtBlockBoundary( range ) ) {
            node = getStartBlockOfRange( range );
            // Iterate through the block's parents
            while ( parent = node.parentNode ) {
                // If we find a UL or OL (so are in a list, node must be an LI)
                if ( parent.nodeName === 'UL' || parent.nodeName === 'OL' ) {
                    // AND the LI is not the first in the list
                    if ( node.previousSibling ) {
                        // Then increase the list level
                        event.preventDefault();
                        self.modifyBlocks( increaseListLevel, range );
                    }
                    break;
                }
                node = parent;
            }
            event.preventDefault();
        }
        // otherwise if the range is collapsed just insert a normal tab
        else if( range.collapsed ) {
          console.info("inserting tab")
          var node = self._doc.createTextNode(TAB)
          // insert the element into squire
          window.r1 = range
          self.insertNodeInRange(
              range,
              node
          )
          // mergeInlines(node.parentNode)
          window.n = node
          console.info(node)
          // self.setSelectionToNode(node)
          window.r2 = self.getSelection()
          event.preventDefault();
        }
    },
    space: function ( self, _, range ) {
        var node, parent;
        // Nate: This record/bookmark has a side effect of putting a BR tag at the end of a line, which
        // currently is ok with me
        self._recordUndoState( range );
        addLinks( range.startContainer );
        self._getRangeAndRemoveBookmark( range );

        // If the cursor is at the end of a link (<a>foo|</a>) then move it
        // outside of the link (<a>foo</a>|) so that the space is not part of
        // the link text.
        node = range.endContainer;
        parent = node.parentNode;
        if ( range.collapsed && parent.nodeName === 'A' &&
                !node.nextSibling && range.endOffset === getLength( node ) ) {
            range.setStartAfter( parent );
        }

        self.setSelection( range );
    },
    right: function(self, event, range){
        self.moveRight(self, event, range)
    },
    left: function ( self, event, range ) {
        self.moveLeft(self, event, range)
    },
    up: function ( self, event, range ) {
        self.moveUp(self, event, range)
    },
    down: function ( self, event, range ) {
        self.moveDown(self, event, range)
    }

};

// Firefox incorrectly handles Cmd-left/Cmd-right on Mac:
// it goes back/forward in history! Override to do the right
// thing.
// https://bugzilla.mozilla.org/show_bug.cgi?id=289384
if ( isMac && isGecko ) {
      keyHandlers[ 'meta-left' ] = function ( self, event ) {
      event.preventDefault();
      if (self._sel && self._sel.modify) {
        self._sel.modify( 'move', 'backward', 'lineboundary' );
      }
    };
    keyHandlers[ 'meta-right' ] = function ( self, event ) {
        event.preventDefault();
      if (self._sel && self._sel.modify) {
        self._sel.modify( 'move', 'forward', 'lineboundary' );
      }
    };
}

// System standard for page up/down on Mac is to just scroll, not move the
// cursor. On Linux/Windows, it should move the cursor, but some browsers don't
// implement this natively. Override to support it.
if ( !isMac ) {
    keyHandlers.pageup = function ( self ) {
        self.moveCursorToStart();
    };
    keyHandlers.pagedown = function ( self ) {
        self.moveCursorToEnd();
    };
}

keyHandlers[ ctrlKey + 'b' ] = mapKeyToFormat( 'B' );
keyHandlers[ ctrlKey + 'i' ] = mapKeyToFormat( 'I' );
keyHandlers[ ctrlKey + 'u' ] = mapKeyToFormat( 'U' );
keyHandlers[ ctrlKey + 'shift-7' ] = mapKeyToFormat( 'S' );
keyHandlers[ ctrlKey + 'shift-5' ] = mapKeyToFormat( 'SUB', { tag: 'SUP' } );
keyHandlers[ ctrlKey + 'shift-6' ] = mapKeyToFormat( 'SUP', { tag: 'SUB' } );
keyHandlers[ ctrlKey + 'shift-8' ] = mapKeyTo( 'makeUnorderedList' );
keyHandlers[ ctrlKey + 'shift-9' ] = mapKeyTo( 'makeOrderedList' );
keyHandlers[ ctrlKey + '[' ] = mapKeyTo( 'decreaseQuoteLevel' );
keyHandlers[ ctrlKey + ']' ] = mapKeyTo( 'increaseQuoteLevel' );
keyHandlers[ ctrlKey + 'y' ] = mapKeyTo( 'redo' );
keyHandlers[ ctrlKey + 'z' ] = mapKeyTo( 'undo' );
keyHandlers[ ctrlKey + 'shift-z' ] = mapKeyTo( 'redo' );

var getLineNumber = function(root, node){
  if(node.parentNode === root){
    return indexOf.call(root.childNodes, node)
  }
  else{
    return getLineNumber(root, node.parentNode)
  }
}

var findNextBRTag = function(root, node){
    var w = new TreeWalker(root, NodeFilter.SHOW_ALL, function(node){
                        return ( node.nodeName === "BR" )
    } );
    window.w = w
    w.currentNode = node;
    return w.nextNONode()
}

var findPreviousBRTag = function(root, node){
    var w = new TreeWalker(root, NodeFilter.SHOW_ALL, function(node){
                        return ( node.nodeName === "BR" )
    } );
    window.w = w
    w.currentNode = node;
    return w.previousNode()
}

var findNextTextOrNotEditable = function(root, node){
    var w = new TreeWalker(root, NodeFilter.SHOW_ALL, function(node){
        return ( (isText(node) && !isZWNBS(node)) || notEditable(node) )
    } );
    window.w = w
    w.currentNode = node;
    return w.nextNONode(notEditable)
}

var findPreviousTextOrNotEditable = function(root, node){
    var w = new TreeWalker(root, NodeFilter.SHOW_ALL, function(node){
        return ( (isText(node) && !isZWNBS(node)) || notEditable(node) )
    } );
    window.w = w
    w.currentNode = node;
    return w.previousNode(notEditable)
}

var printRange = function(range, message){
    console.info("MESSAGE: " + message)
    console.info(range.startContainer, range.startOffset, range.endContainer, range.endOffset)
}

Squire.prototype.backspace = function(self, event, range){
    self  = self  ? self  : this
    event && event.preventDefault()
    range = range ? range : self.getSelection()
    self._removeZWS();
    // Record undo checkpoint.
    self._recordUndoState( range );
    self._getRangeAndRemoveBookmark( range );
    // If not collapsed, delete contents
    var block = getStartBlockOfRange(range)
    window.block = block
    if ( !range.collapsed ) {
        console.info("range not collapsed")
        deleteContentsOfRange( range );
        afterDelete( self, range );
    }
    // If at beginning of block, merge with previous
    else if ( rangeDoesStartAtBlockBoundary( range ) ) {
        console.info("range starts at block boundary")
        var current = getStartBlockOfRange( range ),
            previous = current && getPreviousBlock( current );
        // Must not be at the very beginning of the text area.
        if ( previous ) {
            // If not editable, just delete whole block.
            if ( notEditable(previous) ) {
                detach( previous );
                return;
            }
            // Otherwise merge.
            mergeWithBlock( previous, current, range );
            // If deleted line between containers, merge newly adjacent
            // containers.
            current = previous.parentNode;
            while ( current && !current.nextSibling ) {
                current = current.parentNode;
            }
            if ( current && ( current = current.nextSibling ) ) {
                mergeContainers( current );
            }
            self.setSelection( range );
        }
        // If at very beginning of text area, allow backspace
        // to break lists/blockquote.
        else if ( current ) {
            // Break list
            if ( getNearest( current, 'UL' ) ||
                    getNearest( current, 'OL' ) ) {
                return self.modifyBlocks( decreaseListLevel, range );
            }
            // Break blockquote
            else if ( getNearest( current, 'BLOCKQUOTE' ) ) {
                return self.modifyBlocks( decreaseBlockQuoteLevel, range );
            }
            self.setSelection( range );
            self._updatePath( range, true );
        }
    }
    // Nate: previously this was left to the browser but had issues with non-editable spans.  Furthermore
    // firefox had an odd bug where it is confused by non-editable spans causing spaces to be added
    // inside the non-editable block rather than deleting the appropriate character inside editable
    // text.  There is some information on what is probably the same bug here:
    // https://bugzilla.mozilla.org/show_bug.cgi?id=685445
    else {
        var sc = range.startContainer;
        var so = range.startOffset;
        var pn = null;
        var pOffset
        var parent = null;
        window.sc33 = sc
        window.so33 = so
        window.r33 = range
        window.pn = pn
        var rootNodeOfClean = null;

        if((sc.nodeType === TEXT_NODE)){
            if(so>1){
                sc.deleteData(so-1, 1)
                parent = sc.parentNode
                // pn = w.previousNode(notEditable)
                // console.info(pn)
                rootNodeOfClean = parent

            }
            else if(so===1){
                sc.deleteData(so-1, 1)
            }
            else{ //so === 0
                pn = findPreviousTextOrNotEditable(block, sc)
                var previousParent = pn.parentNode
                window.previousParent = previousParent
                if(pn.nodeType === TEXT_NODE){
                    if(pn.length>0){
                        pn.deleteData(pn.length - 1, 1)
                    }
                    else{
                        detach(pn);
                    }
                }
                else if(notEditable(pn)){
                    detach(pn);
                }
                rootNodeOfClean = previousParent
            }
        }
        else {
            var child = sc.childNodes[so]
            pn = findPreviousTextOrNotEditable(block, child)
            if(pn){
                window.pn33 = pn
                if(pn.nodeType === TEXT_NODE){
                    if(pn.length>0){
                        pn.deleteData(pn.length - 1, 1)
                        pOffset = pn.length
                        range.setStart(pn, pOffset)
                        range.setEnd(pn, pOffset)
                        self.setSelectionToNode(pn, pOffset)
                    }
                    else{
                        detach(pn)
                    }

                }
                else if(notEditable(pn)){
                    detach(pn);
                }
            }

            //Nate: Todo: Currently cleaning from this node results in the range not getting moved down the tree, not good
            rootNodeOfClean = sc
        }

        // if(rootNodeOfClean){
        //     window.rootNodeOfClean = rootNodeOfClean
        //     //CleanTree will trim whitespace, but it won't do this if there is a <br> tag at the end of the line
        //     //We want to preserve whitespace that the user has entered so calling ensureBr is necessary
        //     ensureBrAtEndOfAllLines(self._body)
        //     cleanTree(rootNodeOfClean)
        //     replaceDoubleSpace(rootNodeOfClean, range)
        //     replaceTrailingSingleSpace(rootNodeOfClean, range)
        // }
        self.setSelection( range );
        // setTimeout( function () { afterDelete( self ); }, 0 );
        afterDelete( self )
    }
}

Squire.prototype.moveRight = function(self, event, range){
    self  = self  ? self  : this
    //TODO: stop looking for BR tags to designate end of lines
    ensureBrAtEndOfAllLines(self._body)
    event && event.preventDefault()
    range = range ? range : self.getSelection()
    self._removeZWS();
    var so = range.startOffset
    var sc = range.startContainer
    var ec = range.endContainer
    var eo = range.endOffset
    var parent = sc.parent
    var root = self._body
    var nn
    var block = getStartBlockOfRange(range)
    window.sc = sc
    window.so = so
    window.r = range

    if(rangeDoesEndAtBlockBoundary(range)){
        window.b1 = block
        var nextBlock = block && getNextBlock(block)
        window.nb1 = nextBlock

        if(nextBlock){
           self.setSelectionToNode(nextBlock)
           var newRange = self.getSelection()
           moveRangeBoundariesDownTree(newRange)
           self.setSelection(newRange)
        }
        else{
            // console.info("no block found")
        }
    }
    else if(sc.nodeType === TEXT_NODE){
        var l = sc.length
        var skippedNode = false
        //If we are in a text node and not at the end, move one character to the right
        if(so < l && !isZWNBS(sc)){
            so += 1
            range.setStart(sc, so)
            self.setSelection(r)
        }
        else{
            nn = findNextTextOrNotEditable(root, sc)

            // The right cursor has a special case where it should skip over the first notEditable node,
            // otherwise it will take two right presses to go from text->notEditable->text
            if(nn){
                if(notEditable(nn)){
                    nn = findNextTextOrNotEditable(block, nn)
                    skippedNode = true
                }
                //if we jump over any nodes, we want to be at the beginning of the next text node, but if they are next to each other,
                //start one character in
                if(isText(nn) && !skippedNode){
                    self.setSelectionToNode(nn, nn.length>0 ? 1:0)

                }
                else if(nn){
                    self.setSelectionToNode(nn, 0)

                }
                else{
                    if(nn = findNextBRTag(root, sc)){
                        self.setSelectionToNode(nn, 0)
                    }
                }
            }
            else{
                if(nn = findNextBRTag(root, sc)){
                    self.setSelectionToNode(nn, 0)
                }
            }
        }
    }
    else{
        var child = sc.childNodes[so]
        if(child && isText(child)){
            self.setSelectionToNode(child, 0)
        }
        else{
            nn = findNextTextOrNotEditable(block, child)
            if(nn){
                self.setSelectionToNode(nn, 0)
            }
            else{
                if(nn = findNextBRTag(root, child)){
                    self.setSelectionToNode(nn, 0)
                }
            }
        }
    }
    //NATE TODO: There is a curious side-effect to this function which is also achieved
    //by self.setSelection(self.getSelection()).  If you are pointing to a non-editable
    //div or to a <BR> tag in firefox, you will not be able to enter in characters
    //unless you do the aforementioned or the following.  Woudl love to know why
    setTimeout( function () { ensureOutsideOfNotEditable( self ); }, 0 );
}


// Still using the default browser behavior unless we are on the first line, where
// we send an event notifying the up key on the first line, to be intercepted by
// a handler who will then set the previous block as active on the last line
Squire.prototype.moveUp = function(self, event, range){
  self  = self  ? self  : this
  //TODO: stop looking for BR tags to designate end of lines
  ensureBrAtEndOfAllLines(self._body)
  range = range ? range : self.getSelection()
  self._removeZWS();
  var so = range.startOffset
  var sc = range.startContainer
  var root = self._body

  var lineNumber = getLineNumber(root, sc)
  if(lineNumber === 0){
    console.info("on line 0")
    event && event.preventDefault()
    var e = new CustomEvent('squire::up-on-first-line', { 'detail': {range: range} });
    self._doc.dispatchEvent(e);
    // return
  }
  setTimeout( function () { ensureOutsideOfNotEditable( self ); }, 0 );
}


Squire.prototype.moveDown = function(self, event, range){
  self  = self  ? self  : this
  //TODO: stop looking for BR tags to designate end of lines
  ensureBrAtEndOfAllLines(self._body)
  range = range ? range : self.getSelection()
  self._removeZWS();
  var so = range.startOffset
  var sc = range.startContainer
  var root = self._body

  var lineNumber = getLineNumber(root, sc)
  if(lineNumber === root.childNodes.length - 1){
    console.info("on last line")
    event && event.preventDefault()
    var e = new CustomEvent('squire::down-on-last-line', { 'detail': {range: range} });
    self._doc.dispatchEvent(e);
    // return
  }
  setTimeout( function () { ensureOutsideOfNotEditable( self ); }, 0 );
}

Squire.prototype.moveLeft = function(self, event, range){
    self  = self  ? self  : this
    //TODO: stop looking for BR tags to designate end of lines
    ensureBrAtEndOfAllLines(self._body)
    event && event.preventDefault()
    range = range ? range : self.getSelection()
    self._removeZWS();
    var so = range.startOffset
    var sc = range.startContainer
    var ec = range.endContainer
    var eo = range.endOffset
    var parent = sc.parent
    var root = self._body
    var nn
    var block = getStartBlockOfRange(range)
    window.sc = sc
    window.so = so
    window.r = range
    if(!isText(sc) && (so > sc.childNodes.length - 1) ){
        console.info("range is out of bounds")
        so = so - 1
        range.setStart(sc, so)
        self.setSelection(range)
    }
    if(rangeDoesStartAtBlockBoundary(range)){
        var block = getStartBlockOfRange(range)

        var previousBlock = block && getPreviousBlock(block)
        if(block && previousBlock){
            self.setSelectionToNode(previousBlock)
            var newRange = self.getSelection()
            newRange.setStart(newRange.endContainer, newRange.endContainer.childNodes.length-1)
            newRange.setEnd(newRange.endContainer, newRange.endContainer.childNodes.length-1)
            moveRangeBoundariesDownTree(newRange)
            self.setSelection(newRange)
        }
        else{
            // console.info("no block found")
        }
    }
    else if(sc.nodeType === TEXT_NODE){
        var l = sc.length
        //If we are in a text node and not at the end, move one character to the right
        if(so > 0){
            so -= 1
            //TODO: looks like a pointless check
            if(so<0){
                so = 0
            }
            self.setSelectionToNode(sc, so)
        }
        else{
            nn = findPreviousTextOrNotEditable(block, sc)
            if(nn){
                if(isText(nn)){
                    var newOffset = nn.length - 1
                    if(newOffset<0){
                        newOffset = 0
                    }
                    self.setSelectionToNode(nn, newOffset)
                }
                else{
                    self.setSelectionToNode(nn, 0)
                }
            }
            else{
                nn = findPreviousBRTag(root, sc)
                if(nn){
                    self.setSelectionToNode(nn, 0)
                }
            }
        }
    }
    else{
        var child = sc.childNodes[so]
        if(false){
            self.setSelectionToNode(child, 0)
        }
        else{
            nn = findPreviousTextOrNotEditable(block, child)
            if(nn){
                if(isText(nn)){
                    var newOffset = nn.length -1
                    if(newOffset<0){
                        newOffset = 0
                    }
                    self.setSelectionToNode(nn, newOffset)
                }
                else{
                   self.setSelectionToNode(nn, 0)
                }

            }
            else{
                nn = findPreviousBRTag(root, child)
                if(nn){
                    self.setSelectionToNode(nn, 0)
                }
            }
        }
    }
    setTimeout( function () { ensureOutsideOfNotEditable( self ); }, 0 );
}
