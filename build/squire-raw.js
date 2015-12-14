/* Copyright © 2011-2015 by Neil Jenkins. MIT Licensed. */

( function ( doc, undefined ) {

"use strict";

var DOCUMENT_POSITION_PRECEDING = 2; // Node.DOCUMENT_POSITION_PRECEDING
var ELEMENT_NODE = 1;                // Node.ELEMENT_NODE;
var TEXT_NODE = 3;                   // Node.TEXT_NODE;
var DOCUMENT_FRAGMENT_NODE = 11;     // Node.DOCUMENT_FRAGMENT_NODE;
var SHOW_ELEMENT = 1;                // NodeFilter.SHOW_ELEMENT;
var SHOW_TEXT = 4;                   // NodeFilter.SHOW_TEXT;

var START_TO_START = 0; // Range.START_TO_START
var START_TO_END = 1;   // Range.START_TO_END
var END_TO_END = 2;     // Range.END_TO_END
var END_TO_START = 3;   // Range.END_TO_START

var ZWS = '\u200B';
var ZWNBS = '\uFEFF'

var win = doc.defaultView;

var ua = navigator.userAgent;

var isIOS = /iP(?:ad|hone|od)/.test( ua );
var isMac = /Mac OS X/.test( ua );

var isGecko = /Gecko\//.test( ua );
var isIElt11 = /Trident\/[456]\./.test( ua );
var isPresto = !!win.opera;
var isWebKit = /WebKit\//.test( ua );

var ctrlKey = isMac ? 'meta-' : 'ctrl-';

var useTextFixer = isIElt11 || isPresto;
var cantFocusEmptyTextNodes = isIElt11 || isWebKit;
var losesSelectionOnBlur = isIElt11;

var canObserveMutations = typeof MutationObserver !== 'undefined';

// Use [^ \t\r\n] instead of \S so that nbsp does not count as white-space
var notWS = /[^ \t\r\n]/;

var indexOf = Array.prototype.indexOf;

// Polyfill for FF3.5
if ( !Object.create ) {
    Object.create = function ( proto ) {
        var F = function () {};
        F.prototype = proto;
        return new F();
    };
}

/*
    Native TreeWalker is buggy in IE and Opera:
    * IE9/10 sometimes throw errors when calling TreeWalker#nextNode or
      TreeWalker#previousNode. No way to feature detect this.
    * Some versions of Opera have a bug in TreeWalker#previousNode which makes
      it skip to the wrong node.

    Rather than risk further bugs, it's easiest just to implement our own
    (subset) of the spec in all browsers.
*/

var typeToBitArray = {
    // ELEMENT_NODE
    1: 1,
    // ATTRIBUTE_NODE
    2: 2,
    // TEXT_NODE
    3: 4,
    // COMMENT_NODE
    8: 128,
    // DOCUMENT_NODE
    9: 256,
    // DOCUMENT_FRAGMENT_NODE
    11: 1024
};

function TreeWalker ( root, nodeType, filter ) {
    this.root = this.currentNode = root;
    this.nodeType = nodeType;
    this.filter = filter;
}

// There is a javascript TreeWalker already that I don't want to write over
window.STreeWalker = TreeWalker

TreeWalker.prototype.nextNode = function () {
    var current = this.currentNode,
        root = this.root,
        nodeType = this.nodeType,
        filter = this.filter,
        node;
    while ( true ) {
        node = current.firstChild;
        while ( !node && current ) {
            if ( current === root ) {
                break;
            }
            node = current.nextSibling;
            if ( !node ) { current = current.parentNode; }
        }
        if ( !node ) {
            return null;
        }
      
        if ( ( typeToBitArray[ node.nodeType ] & nodeType ) &&
                filter( node ) ) {
            this.currentNode = node;
            return node;
        }
        current = node;
    }
};

// Nate:  The best way to think of this traversal is that starting from the current node it goes up one level
// and then down one level to the right if possible, then from there down and to the left as far as possible.
//      r
//   a     b
//  d  e  f g
//
// If the currentNode is d, nextNONode will return e.  Calling it again returns 'a' since there are no more branches
// of a.  Calling again gives f, then g, b, and finally r.  I'm not certain if this is post order so I refrained from
// using a completely analogous name to previousPONode.
TreeWalker.prototype.nextNONode = function (breakoutFunction) {
    var current = this.currentNode,
        root = this.root,
        nodeType = this.nodeType,
        filter = this.filter,
        node;
    while ( true ) {
        if ( current === root ) {
            return null;
        }
        node = current.nextSibling;
        //modified to let us break on an element satisfying the breakoutFunction
        if ( node ) {
           if(breakoutFunction && breakoutFunction(node)){
               this.currentNode = node;
               return node;
           }
           else{
               while ( current = node.firstChild ) {
                   node = current;
               }
           }
        } else {
            node = current.parentNode;
        }
        if ( !node ) {
            return null;
        }
        if ( ( typeToBitArray[ node.nodeType ] & nodeType ) &&
                filter( node ) ) {
            this.currentNode = node;
            return node;
        }
        current = node;
    }
};

TreeWalker.prototype.previousNode = function (breakoutFunction) {
    var current = this.currentNode,
        root = this.root,
        nodeType = this.nodeType,
        filter = this.filter,
        node;
    while ( true ) {
        if ( current === root ) {
            return null;
        }
        node = current.previousSibling;
        //modified to let us break on an element satisfying the breakoutFunction
        if ( node ) {
           if(breakoutFunction && breakoutFunction(node)){
               this.currentNode = node;
               return node;
           }
           else{
               while ( current = node.lastChild ) {
                   node = current;
               }
           }
        } else {
            node = current.parentNode;
        }
        if ( !node ) {
            return null;
        }
        if ( ( typeToBitArray[ node.nodeType ] & nodeType ) &&
                filter( node ) ) {
            this.currentNode = node;
            return node;
        }
        current = node;
    }
};

// Previous node in post-order.
// Nate:  Analogous to nextNONode, this function goes up one level, then down one level to the left, 
// and then down and to the right as far as possible.
TreeWalker.prototype.previousPONode = function () {
    var current = this.currentNode,
        root = this.root,
        nodeType = this.nodeType,
        filter = this.filter,
        node;
    while ( true ) {
        node = current.lastChild;
        while ( !node && current ) {
            if ( current === root ) {
                break;
            }
            node = current.previousSibling;
            if ( !node ) { current = current.parentNode; }
        }
        if ( !node ) {
            return null;
        }
        if ( ( typeToBitArray[ node.nodeType ] & nodeType ) &&
                filter( node ) ) {
            this.currentNode = node;
            return node;
        }
        current = node;
    }
};

var inlineNodeNames  = /^(?:#text|A(?:BBR|CRONYM)?|B(?:R|D[IO])?|C(?:ITE|ODE)|D(?:ATA|EL|FN)|EM|FONT|HR|I(?:MG|NPUT|NS)?|KBD|Q|R(?:P|T|UBY)|S(?:AMP|MALL|PAN|TR(?:IKE|ONG)|U[BP])?|TABLE|TD|TR|TBODY|U|VAR|WBR|Z)$/;
window.inn = inlineNodeNames
var leafNodeNames = {
    BR: 1,
    IMG: 1,
    INPUT: 1,
    CITE: 1,
    Z: 1,
    TABLE: 1
};

var mathMLNodeNames = {
    MATH:1,
    MACTION:1,
    MALIGNGROUP:1,
    MALIGNMARK:1,
    MENCLOSE:1,
    MERROR:1,
    MFENCED:1,
    MFRAC:1,
    MGLYPH:1,
    MI:1,
    MLABELEDTR:1,
    MLONGDIV:1,
    MMULTISCRIPTS:1,
    MN:1,
    MO:1,
    MOVER:1,
    MPADDED:1,
    MPHANTOM:1,
    MROOT:1,
    MROW:1,
    MS:1,
    MSCARRIES:1,
    MSCARRY:1,
    MSGROUP:1,
    MSLINE:1,
    MSPACE:1,
    MSQRT:1,
    MSROW:1,
    MSTACK:1,
    MSTYLE:1,
    MSUB:1,
    MSUP:1,
    MSUBSUP:1,
    math:1,
    maction:1,
    maligngroup:1,
    malignmark:1,
    menclose:1,
    merror:1,
    mfenced:1,
    mfrac:1,
    mglyph:1,
    mi:1,
    mlabeledtr:1,
    mlongdiv:1,
    mmultiscripts:1,
    mn:1,
    mo:1,
    mover:1,
    mpadded:1,
    mphantom:1,
    mroot:1,
    mrow:1,
    ms:1,
    mscarries:1,
    mscarry:1,
    msgroup:1,
    msline:1,
    mspace:1,
    msqrt:1,
    msrow:1,
    mstack:1,
    mstyle:1,
    msub:1,
    msup:1,
    msubsup:1
}

function every ( nodeList, fn ) {
    var l = nodeList.length;
    while ( l-- ) {
        if ( !fn( nodeList[l] ) ) {
            return false;
        }
    }
    return true;
}

// ---

function hasTagAttributes ( node, tag, attributes ) {
    if ( node.nodeName !== tag ) {
        return false;
    }
    for ( var attr in attributes ) {
        if ( node.getAttribute( attr ) !== attributes[ attr ] ) {
            return false;
        }
    }
    return true;
}
function areAlike ( node, node2 ) {
    return !isLeaf( node ) && (
        node.nodeType === node2.nodeType &&
        node.nodeName === node2.nodeName &&
        node.className === node2.className &&
        ( ( !node.style && !node2.style ) ||
          node.style.cssText === node2.style.cssText )
    );
}

function isLeaf ( node ) {
    return (node.nodeType === ELEMENT_NODE &&
        (!!leafNodeNames[ node.nodeName ]) || notEditable(node));
}
function isInline ( node ) {
    return (inlineNodeNames.test( node.nodeName ) || mathMLNodeNames[node.nodeName]);
}
function isBlock ( node ) {
    var type = node.nodeType;
    return ( type === ELEMENT_NODE || type === DOCUMENT_FRAGMENT_NODE ) &&
        !isInline( node ) && every( node.childNodes, isInline );
}
function isContainer ( node ) {
    var type = node.nodeType;
    return ( type === ELEMENT_NODE || type === DOCUMENT_FRAGMENT_NODE ) &&
        !isInline( node ) && !isBlock( node );
}
function isZWS ( node ) {
    return (isText(node) && node.data === ZWS)
}
function isZWNBS ( node ) {
    return (isText(node) && node.data === ZWNBS)
}
function isZ ( node ) {
    return (node && node.nodeName === 'Z')
}

// Not all nodes have isContentEditable defined, but once we find a node with it defined
// it will search up the parentNode list for us and figure out if any are not editable
function notEditable( node ){
    if(!node){
        return false
    }
    //likely a text node
    if(node.isContentEditable === undefined){
        return(notEditable(node.parentNode))
    }
    // chrome has a bug that will return false for isContentEditable if the node is not visible on the
    // page: https://code.google.com/p/chromium/issues/detail?id=313082, thus we have to check for the
    // attribute
    else{
        // return (node.isContentEditable === false)
        if(node.hasAttribute('contenteditable')){
            if(node.getAttribute('contenteditable') === "false"){
                return true
            }
            else{
                return false
            }
        }
        else{
            return(notEditable(node.parentNode))
        }
    }
}

function isText( node ){
    if(!node){
        return false
    }
    return (node.nodeType === TEXT_NODE)
}

function getBlockWalker ( node ) {
    var doc = node.ownerDocument,
        walker = new TreeWalker(
            doc.body, SHOW_ELEMENT, function(node){
                return(isBlock(node)  && !notEditable(node))
            }, false );
    walker.currentNode = node;
    return walker;
}

function getPreviousBlock ( node ) {
    return getBlockWalker( node ).previousNode();
}

function getNextBlock ( node ) {
    return getBlockWalker( node ).nextNode();
}

function getNearest ( node, tag, attributes ) {
    do {
        if ( hasTagAttributes( node, tag, attributes ) ) {
            return node;
        }
    } while ( node = node.parentNode );
    return null;
}

function getPath ( node ) {
    var parent = node.parentNode,
        path, id, className, classNames, dir;
    if ( !parent || node.nodeType !== ELEMENT_NODE ) {
        path = parent ? getPath( parent ) : '';
    } else {
        path = getPath( parent );
        path += ( path ? '>' : '' ) + node.nodeName;
        if ( id = node.id ) {
            path += '#' + id;
        }
        if ( className = node.className.trim() ) {
            classNames = className.split( /\s\s*/ );
            classNames.sort();
            path += '.';
            path += classNames.join( '.' );
        }
        if ( dir = node.dir ) {
            path += '[dir=' + dir + ']';
        }
    }
    return path;
}

function getLength ( node ) {
    var nodeType = node.nodeType;
    return nodeType === ELEMENT_NODE ?
        node.childNodes.length : node.length || 0;
}

function detach ( node ) {
    var parent = node.parentNode;
    if ( parent ) {
        parent.removeChild( node );
    }
    return node;
}
function replaceWith ( node, node2 ) {
    var parent = node.parentNode;
    if ( parent ) {
        parent.replaceChild( node2, node );
    }
}
function empty ( node ) {
    var frag = node.ownerDocument.createDocumentFragment(),
        childNodes = node.childNodes,
        l = childNodes ? childNodes.length : 0;
    while ( l-- ) {
        frag.appendChild( node.firstChild );
    }
    return frag;
}

function createElement ( doc, tag, props, children ) {
    var el = doc.createElement( tag ),
        attr, value, i, l;
    if ( props instanceof Array ) {
        children = props;
        props = null;
    }
    if ( props ) {
        for ( attr in props ) {
            value = props[ attr ];
            if ( value !== undefined ) {
                el.setAttribute( attr, props[ attr ] );
            }
        }
    }
    if ( children ) {
        for ( i = 0, l = children.length; i < l; i += 1 ) {
            el.appendChild( children[i] );
        }
    }
    return el;
}

function fixCursor ( node ) {
    // In Webkit and Gecko, block level elements are collapsed and
    // unfocussable if they have no content. To remedy this, a <BR> must be
    // inserted. In Opera and IE, we just need a textnode in order for the
    // cursor to appear.
    var doc = node.ownerDocument,
        root = node,
        fixer, child;

    if ( node.nodeName === 'BODY' ) {
        if ( !( child = node.firstChild ) || child.nodeName === 'BR' ) {
            fixer = getSquireInstance( doc ).createDefaultBlock();
            if ( child ) {
                node.replaceChild( fixer, child );
            }
            else {
                node.appendChild( fixer );
            }
            node = fixer;
            fixer = null;
        }
    }

    if ( isInline( node ) ) {
        child = node.firstChild;
        while ( cantFocusEmptyTextNodes && child &&
                child.nodeType === TEXT_NODE && !child.data ) {
            node.removeChild( child );
            child = node.firstChild;
        }
        if ( !child ) {
            if ( cantFocusEmptyTextNodes ) {
                fixer = doc.createTextNode( ZWS );
                getSquireInstance( doc )._didAddZWS();
            } else {
                fixer = doc.createTextNode( '' );
            }
        }
    } else {
        if ( useTextFixer ) {
            while ( node.nodeType !== TEXT_NODE && !isLeaf( node ) ) {
                child = node.firstChild;
                if ( !child ) {
                    fixer = doc.createTextNode( '' );
                    break;
                }
                node = child;
            }
            if ( node.nodeType === TEXT_NODE ) {
                // Opera will collapse the block element if it contains
                // just spaces (but not if it contains no data at all).
                if ( /^ +$/.test( node.data ) ) {
                    node.data = '';
                }
            } else if ( isLeaf( node ) ) {
                node.parentNode.insertBefore( doc.createTextNode( '' ), node );
            }
        }
        else if ( !node.querySelector( 'BR' ) ) {
            fixer = createElement( doc, 'BR' );
            while ( ( child = node.lastElementChild ) && !isInline( child ) ) {
                node = child;
            }
        }
    }
    if ( fixer ) {
        node.appendChild( fixer );
    }

    return root;
}

// Recursively examine container nodes and wrap any inline children.
function fixContainer ( container ) {
    var children = container.childNodes,
        doc = container.ownerDocument,
        wrapper = null,
        i, l, child, isBR,
        config = getSquireInstance( doc )._config;

    for ( i = 0, l = children.length; i < l; i += 1 ) {
        child = children[i];
        isBR = child.nodeName === 'BR';
        if ( !isBR && isInline( child ) ) {
            if ( !wrapper ) {
                 wrapper = createElement( doc,
                    config.blockTag, config.blockAttributes );
            }
            wrapper.appendChild( child );
            i -= 1;
            l -= 1;
        } else if ( isBR || wrapper ) {
            if ( !wrapper ) {
                wrapper = createElement( doc,
                    config.blockTag, config.blockAttributes );
            }
            fixCursor( wrapper );
            if ( isBR ) {
                container.replaceChild( wrapper, child );
            } else {
                container.insertBefore( wrapper, child );
                i += 1;
                l += 1;
            }
            wrapper = null;
        }
        if ( isContainer( child ) ) {
            fixContainer( child );
        }
    }
    if ( wrapper ) {
        container.appendChild( fixCursor( wrapper ) );
    }
    return container;
}

function split ( node, offset, stopNode ) {
    var nodeType = node.nodeType,
        parent, clone, next;
    if ( nodeType === TEXT_NODE && node !== stopNode ) {
        return split( node.parentNode, node.splitText( offset ), stopNode );
    }
    if ( nodeType === ELEMENT_NODE ) {
        if ( typeof( offset ) === 'number' ) {
            offset = offset < node.childNodes.length ?
                node.childNodes[ offset ] : null;
        }
        if ( node === stopNode ) {
            return offset;
        }

        // Clone node without children
        parent = node.parentNode;
        clone = node.cloneNode( false );

        // Add right-hand siblings to the clone
        while ( offset ) {
            next = offset.nextSibling;
            clone.appendChild( offset );
            offset = next;
        }

        // Maintain li numbering if inside a quote.
        if ( node.nodeName === 'OL' && getNearest( node, 'BLOCKQUOTE' ) ) {
            clone.start = ( +node.start || 1 ) + node.childNodes.length - 1;
        }

        // DO NOT NORMALISE. This may undo the fixCursor() call
        // of a node lower down the tree!

        // We need something in the element in order for the cursor to appear.
        fixCursor( node );
        fixCursor( clone );

        // Inject clone after original node
        if ( next = node.nextSibling ) {
            parent.insertBefore( clone, next );
        } else {
            parent.appendChild( clone );
        }

        // Keep on splitting up the tree
        return split( parent, clone, stopNode );
    }
    return offset;
}

function mergeInlines ( node, range ) {
    if ( node.nodeType !== ELEMENT_NODE ) {
        return;
    }
    var children = node.childNodes,
        l = children.length,
        frags = [],
        child, prev, len;
    while ( l-- ) {
        child = children[l];
        prev = l && children[ l - 1 ];
        if ( l && isInline( child ) && !isZWNBS(child) && areAlike( child, prev ) &&
                !leafNodeNames[ child.nodeName ] ) {
            if(range){
                if ( range.startContainer === child ) {
                    range.startContainer = prev;
                    range.startOffset += getLength( prev );
                }
                if ( range.endContainer === child ) {
                    range.endContainer = prev;
                    range.endOffset += getLength( prev );
                }
                if ( range.startContainer === node ) {
                    if ( range.startOffset > l ) {
                        range.startOffset -= 1;
                    }
                    else if ( range.startOffset === l ) {
                        range.startContainer = prev;
                        range.startOffset = getLength( prev );
                    }
                }
                if ( range.endContainer === node ) {
                    if ( range.endOffset > l ) {
                        range.endOffset -= 1;
                    }
                    else if ( range.endOffset === l ) {
                        range.endContainer = prev;
                        range.endOffset = getLength( prev );
                    }
                }
            }
            detach( child );
            if ( child.nodeType === TEXT_NODE ) {
                prev.appendData( child.data );
            }
            else {
                frags.push( empty( child ) );
            }
        }
        else if ( child.nodeType === ELEMENT_NODE ) {
            len = frags.length;
            while ( len-- ) {
                child.appendChild( frags.pop() );
            }
            mergeInlines( child, range );
        }
    }
}

function mergeWithBlock ( block, next, range ) {
    var container = next,
        last, offset, _range;
    while ( container.parentNode.childNodes.length === 1 ) {
        container = container.parentNode;
    }
    detach( container );

    offset = block.childNodes.length;

    // Remove extra <BR> fixer if present.
    last = block.lastChild;
    if ( last && last.nodeName === 'BR' ) {
        block.removeChild( last );
        offset -= 1;
    }

    _range = {
        startContainer: block,
        startOffset: offset,
        endContainer: block,
        endOffset: offset
    };

    block.appendChild( empty( next ) );
    mergeInlines( block, _range );

    range.setStart( _range.startContainer, _range.startOffset );
    range.collapse( true );

    // Opera inserts a BR if you delete the last piece of text
    // in a block-level element. Unfortunately, it then gets
    // confused when setting the selection subsequently and
    // refuses to accept the range that finishes just before the
    // BR. Removing the BR fixes the bug.
    // Steps to reproduce bug: Type "a-b-c" (where - is return)
    // then backspace twice. The cursor goes to the top instead
    // of after "b".
    if ( isPresto && ( last = block.lastChild ) && last.nodeName === 'BR' ) {
        block.removeChild( last );
    }
}

function mergeContainers ( node ) {
    var prev = node.previousSibling,
        first = node.firstChild,
        doc = node.ownerDocument,
        isListItem = ( node.nodeName === 'LI' ),
        needsFix, block;

    // Do not merge LIs, unless it only contains a UL
    if ( isListItem && ( !first || !/^[OU]L$/.test( first.nodeName ) ) ) {
        return;
    }

    if ( prev && areAlike( prev, node ) ) {
        if ( !isContainer( prev ) ) {
            if ( isListItem ) {
                block = createElement( doc, 'DIV' );
                block.appendChild( empty( prev ) );
                prev.appendChild( block );
            } else {
                return;
            }
        }
        detach( node );
        needsFix = !isContainer( node );
        prev.appendChild( empty( node ) );
        if ( needsFix ) {
            fixContainer( prev );
        }
        if ( first ) {
            mergeContainers( first );
        }
    } else if ( isListItem ) {
        prev = createElement( doc, 'DIV' );
        node.insertBefore( prev, first );
        fixCursor( prev );
    }
}

Squire.Node = function(){}
Squire.Node.isInline = isInline
Squire.Node.getBlockWalker = getBlockWalker
Squire.Node.isText = isText
Squire.Node.notEditable = notEditable
Squire.Node.getPreviousBlock = getPreviousBlock
Squire.Node.getNextBlock = getNextBlock
Squire.Node.isBlock = isBlock
Squire.Node.isZWS = isZWS
Squire.Node.isZWNBS = isZWNBS
Squire.Node.empty = empty
Squire.Node.isLeaf = isLeaf

var getNodeBefore = function ( node, offset ) {
    var children = node.childNodes;
    while ( offset && node.nodeType === ELEMENT_NODE ) {
        node = children[ offset - 1 ];
        children = node.childNodes;
        offset = children.length;
    }
    return node;
};

var getNodeAfter = function ( node, offset ) {
    if ( node.nodeType === ELEMENT_NODE ) {
        var children = node.childNodes;
        if ( offset < children.length ) {
            node = children[ offset ];
        } else {
            while ( node && !node.nextSibling ) {
                node = node.parentNode;
            }
            if ( node ) { node = node.nextSibling; }
        }
    }
    return node;
};

// ---

var insertNodeInRange = function ( range, node ) {
    // Insert at start.
    var startContainer = range.startContainer,
        startOffset = range.startOffset,
        endContainer = range.endContainer,
        endOffset = range.endOffset,
        parent, children, childCount, afterSplit;

    // If part way through a text node, split it.
    if ( startContainer.nodeType === TEXT_NODE ) {
        parent = startContainer.parentNode;
        children = parent.childNodes;
        if ( startOffset === startContainer.length ) {
            startOffset = indexOf.call( children, startContainer ) + 1;
            if ( range.collapsed ) {
                endContainer = parent;
                endOffset = startOffset;
            }
        } else {
            if ( startOffset ) {
                afterSplit = startContainer.splitText( startOffset );
                if ( endContainer === startContainer ) {
                    endOffset -= startOffset;
                    endContainer = afterSplit;
                }
                else if ( endContainer === parent ) {
                    endOffset += 1;
                }
                startContainer = afterSplit;
            }
            startOffset = indexOf.call( children, startContainer );
        }
        startContainer = parent;
    } else {
        children = startContainer.childNodes;
    }

    childCount = children.length;

    if ( startOffset === childCount) {
        startContainer.appendChild( node );
    } else {
        startContainer.insertBefore( node, children[ startOffset ] );
    }

    if ( startContainer === endContainer ) {
        endOffset += children.length - childCount;
    }

    range.setStart( startContainer, startOffset );
    range.setEnd( endContainer, endOffset );
    ensurePreZNodesForContentEditable( node.ownerDocument.body )
    ensureBrAtEndOfAllLines( node.ownerDocument.body )
};

var extractContentsOfRange = function ( range, common ) {
    var startContainer = range.startContainer,
        startOffset = range.startOffset,
        endContainer = range.endContainer,
        endOffset = range.endOffset;

    if ( !common ) {
        common = range.commonAncestorContainer;
    }

    if ( common.nodeType === TEXT_NODE ) {
        common = common.parentNode;
    }

    var endNode = split( endContainer, endOffset, common ),
        startNode = split( startContainer, startOffset, common ),
        frag = common.ownerDocument.createDocumentFragment(),
        next, before, after;

    // End node will be null if at end of child nodes list.
    while ( startNode !== endNode ) {
        next = startNode.nextSibling;
        frag.appendChild( startNode );
        startNode = next;
    }

    startContainer = common;
    startOffset = endNode ?
        indexOf.call( common.childNodes, endNode ) :
        common.childNodes.length;

    // Merge text nodes if adjacent. IE10 in particular will not focus
    // between two text nodes
    after = common.childNodes[ startOffset ];
    before = after && after.previousSibling;
    if ( before &&
            before.nodeType === TEXT_NODE &&
            after.nodeType === TEXT_NODE ) {
        startContainer = before;
        startOffset = before.length;
        before.appendData( after.data );
        detach( after );
    }

    range.setStart( startContainer, startOffset );
    range.collapse( true );

    fixCursor( common );

    return frag;
};

var deleteContentsOfRange = function ( range ) {
    // Move boundaries up as much as possible to reduce need to split.
    // But we need to check whether we've moved the boundary outside of a
    // block. If so, the entire block will be removed, so we shouldn't merge
    // later.
    moveRangeBoundariesUpTree( range );

    var startBlock = range.startContainer,
        endBlock = range.endContainer,
        needsMerge = ( isInline( startBlock ) || isBlock( startBlock ) ) &&
            ( isInline( endBlock ) || isBlock( endBlock ) );

    // Remove selected range
    extractContentsOfRange( range );

    // Move boundaries back down tree so that they are inside the blocks.
    // If we don't do this, the range may be collapsed to a point between
    // two blocks, so get(Start|End)BlockOfRange will return null.
    moveRangeBoundariesDownTree( range );

    // If we split into two different blocks, merge the blocks.
    if ( needsMerge ) {
        startBlock = getStartBlockOfRange( range );
        endBlock = getEndBlockOfRange( range );
        if ( startBlock && endBlock && startBlock !== endBlock ) {
            mergeWithBlock( startBlock, endBlock, range );
        }
    }

    // Ensure block has necessary children
    if ( startBlock ) {
        fixCursor( startBlock );
    }

    // Ensure body has a block-level element in it.
    var body = range.endContainer.ownerDocument.body,
        child = body.firstChild;
    if ( !child || child.nodeName === 'BR' ) {
        fixCursor( body );
        range.selectNodeContents( body.firstChild );
    } else {
        range.collapse( false );
    }
};

// ---

var insertTreeFragmentIntoRange = function ( range, frag ) {
    // Check if it's all inline content
    var allInline = true,
        children = frag.childNodes,
        l = children.length;
    while ( l-- ) {
        if ( !isInline( children[l] ) ) {
            allInline = false;
            break;
        }
    }

    // Delete any selected content
    if ( !range.collapsed ) {
        deleteContentsOfRange( range );
    }

    // Move range down into text nodes
    moveRangeBoundariesDownTree( range );

    if ( allInline ) {
        // If inline, just insert at the current position.
        insertNodeInRange( range, frag );
        range.collapse( false );
    } else {
        // Otherwise...
        // 1. Split up to blockquote (if a parent) or body
        var splitPoint = range.startContainer,
            nodeAfterSplit = split( splitPoint, range.startOffset,
                getNearest( splitPoint.parentNode, 'BLOCKQUOTE' ) ||
                splitPoint.ownerDocument.body ),
            nodeBeforeSplit = nodeAfterSplit.previousSibling,
            startContainer = nodeBeforeSplit,
            startOffset = startContainer.childNodes.length,
            endContainer = nodeAfterSplit,
            endOffset = 0,
            parent = nodeAfterSplit.parentNode,
            child, node, prev, next, startAnchor;

        // 2. Move down into edge either side of split and insert any inline
        // nodes at the beginning/end of the fragment
        while ( ( child = startContainer.lastChild ) &&
                child.nodeType === ELEMENT_NODE ) {
            if ( child.nodeName === 'BR' ) {
                startOffset -= 1;
                break;
            }
            startContainer = child;
            startOffset = startContainer.childNodes.length;
        }
        while ( ( child = endContainer.firstChild ) &&
                child.nodeType === ELEMENT_NODE &&
                child.nodeName !== 'BR' ) {
            endContainer = child;
        }
        startAnchor = startContainer.childNodes[ startOffset ] || null;
        while ( ( child = frag.firstChild ) && isInline( child ) ) {
            startContainer.insertBefore( child, startAnchor );
        }
        while ( ( child = frag.lastChild ) && isInline( child ) ) {
            endContainer.insertBefore( child, endContainer.firstChild );
            endOffset += 1;
        }

        // 3. Fix cursor then insert block(s) in the fragment
        node = frag;
        while ( node = getNextBlock( node ) ) {
            fixCursor( node );
        }
        parent.insertBefore( frag, nodeAfterSplit );

        // 4. Remove empty nodes created either side of split, then
        // merge containers at the edges.
        next = nodeBeforeSplit.nextSibling;
        node = getPreviousBlock( next );
        if ( !/\S/.test( node.textContent ) ) {
            do {
                parent = node.parentNode;
                parent.removeChild( node );
                node = parent;
            } while ( parent && !parent.lastChild &&
                parent.nodeName !== 'BODY' );
        }
        if ( !nodeBeforeSplit.parentNode ) {
            nodeBeforeSplit = next.previousSibling;
        }
        if ( !startContainer.parentNode ) {
            startContainer = nodeBeforeSplit || next.parentNode;
            startOffset = nodeBeforeSplit ?
                nodeBeforeSplit.childNodes.length : 0;
        }
        // Merge inserted containers with edges of split
        if ( isContainer( next ) ) {
            mergeContainers( next );
        }

        prev = nodeAfterSplit.previousSibling;
        node = isBlock( nodeAfterSplit ) ?
            nodeAfterSplit : getNextBlock( nodeAfterSplit );
        if ( !/\S/.test( node.textContent ) ) {
            do {
                parent = node.parentNode;
                parent.removeChild( node );
                node = parent;
            } while ( parent && !parent.lastChild &&
                parent.nodeName !== 'BODY' );
        }
        if ( !nodeAfterSplit.parentNode ) {
            nodeAfterSplit = prev.nextSibling;
        }
        if ( !endOffset ) {
            endContainer = prev;
            endOffset = prev.childNodes.length;
        }
        // Merge inserted containers with edges of split
        if ( nodeAfterSplit && isContainer( nodeAfterSplit ) ) {
            mergeContainers( nodeAfterSplit );
        }

        range.setStart( startContainer, startOffset );
        range.setEnd( endContainer, endOffset );
        moveRangeBoundariesDownTree( range );
    }
};

// ---

var isNodeContainedInRange = function ( range, node, partial ) {
    var nodeRange = node.ownerDocument.createRange();

    nodeRange.selectNode( node );

    if ( partial ) {
        // Node must not finish before range starts or start after range
        // finishes.
        var nodeEndBeforeStart = ( range.compareBoundaryPoints(
                END_TO_START, nodeRange ) > -1 ),
            nodeStartAfterEnd = ( range.compareBoundaryPoints(
                START_TO_END, nodeRange ) < 1 );
        return ( !nodeEndBeforeStart && !nodeStartAfterEnd );
    }
    else {
        // Node must start after range starts and finish before range
        // finishes
        var nodeStartAfterStart = ( range.compareBoundaryPoints(
                START_TO_START, nodeRange ) < 1 ),
            nodeEndBeforeEnd = ( range.compareBoundaryPoints(
                END_TO_END, nodeRange ) > -1 );
        return ( nodeStartAfterStart && nodeEndBeforeEnd );
    }
};

// If the starting and ending range offsets are collapsed and on the first element in the container, this will 
// move down and to the left, otherwise it will move down and to the right
var moveRangeBoundariesDownTree = function ( range ) {
    var startContainer = range.startContainer,
        startOffset = range.startOffset,
        endContainer = range.endContainer,
        endOffset = range.endOffset,
        child;

    if( notEditable(startContainer)){
        // console.info("start container not editable, stopping here")
        return
    }
    // This loop goes down and to the left of the tree
    while ( startContainer.nodeType !== TEXT_NODE ) {
        child = startContainer.childNodes[ startOffset ];
        // console.info("child")
        // console.info(child)
        if ( !child || isLeaf( child )) {
            // console.info("start breaking on")
            // console.info(child)
            break;
        }
        if (  notEditable( child ) ){
            // console.info("child not editable, stopping")
            break;
        }
        startContainer = child;
        startOffset = 0;
    }
    // If the endOffset is nonzero, this goes down and to the right of the tree starting at the node just before the end offset
    if ( endOffset ) {
        // console.info("end offset")
        while ( endContainer.nodeType !== TEXT_NODE ) {
            // console.info(endContainer)
            child = endContainer.childNodes[ endOffset - 1 ];
            if ( !child || isLeaf( child ) ) {
                // console.info("breaking on")
                console.info(child)
                break;
            }
            if (  notEditable( child ) ){
                // console.info("child not editable, stopping")
                break;
            }
            endContainer = child;
            endOffset = getLength( endContainer );
        }
    } else {
        // console.info("not end offset")
        while ( endContainer.nodeType !== TEXT_NODE ) {
            child = endContainer.firstChild;
            if ( !child || isLeaf( child ) ) {
                break;
            }
            if (  notEditable( child ) ){
                // console.info("child not editable, stopping")
                break;
            }
            endContainer = child;
        }
    }

    // If collapsed, this algorithm finds the nearest text node positions
    // *outside* the range rather than inside, but also it flips which is
    // assigned to which.
    if ( range.collapsed ) {
        // console.info("collapsed range flipping start and end")
        range.setStart( endContainer, endOffset );
        range.setEnd( endContainer, endOffset );
        //Nate:  I don't think it makes sense to have the start and end different on a collapsed range
        // range.setEnd( startContainer, startOffset );
    } else {
        range.setStart( startContainer, startOffset );
        range.setEnd( endContainer, endOffset );
    }
};

var moveRangeBoundariesUpTree = function ( range, common ) {
    var startContainer = range.startContainer,
        startOffset = range.startOffset,
        endContainer = range.endContainer,
        endOffset = range.endOffset,
        parent;

    if ( !common ) {
        common = range.commonAncestorContainer;
    }

    while ( startContainer !== common && !startOffset ) {
        parent = startContainer.parentNode;
        startOffset = indexOf.call( parent.childNodes, startContainer );
        startContainer = parent;
    }

    while ( endContainer !== common &&
            endOffset === getLength( endContainer ) ) {
        parent = endContainer.parentNode;
        endOffset = indexOf.call( parent.childNodes, endContainer ) + 1;
        endContainer = parent;
    }

    range.setStart( startContainer, startOffset );
    range.setEnd( endContainer, endOffset );
};

var moveRangeOutOfNotEditable = function( range ){
    
    var startContainer = range.startContainer
    var endContainer = range.endContainer
    var moveRight = false
    var nextSibling
    if(range.collapsed){
        if(startContainer.nodeType === TEXT_NODE){
            var currentParent = startContainer.parentNode
            var newParent = currentParent
            var textLength = startContainer.data.length
            // if we are for some reason, likely an up or down arrow, finding ourselves in the middle of a 
            // text area that isn't editable, we need to decide if we should be in front of that element
            // or to the right of it.  At the moment this will only work for a single text element in a series
            // of non-editable structures, but it can be extended to work for all cases if necessary.
            if(range.startOffset > textLength/2){
                moveRight = true
            }
            while(notEditable(newParent)){
                currentParent = newParent
                if(moveRight){
                    if(nextSibling = currentParent.nextSibling){
                        currentParent = nextSibling
                    }
                }
                newParent = currentParent.parentNode
                var startOffset = indexOf.call( newParent.childNodes, currentParent );
            }
            if(newParent !== currentParent){
                var offset = indexOf.call( newParent.childNodes, currentParent )
                range.setStart( newParent, offset );
                range.setEnd( newParent, offset );
            }
        } 
    }
}
window.moveRangeOutOfNotEditable = moveRangeOutOfNotEditable

// Returns the first block at least partially contained by the range,
// or null if no block is contained by the range.
var getStartBlockOfRange = function ( range ) {
    var container = range.startContainer,
        block;

    // If inline, get the containing block.
    if ( isInline( container ) ) {
        block = getPreviousBlock( container );
    } else if ( isBlock( container ) ) {
        block = container;
    } else {
        block = getNodeBefore( container, range.startOffset );
        block = getNextBlock( block );
    }
    // Check the block actually intersects the range
    return block && isNodeContainedInRange( range, block, true ) ? block : null;
};
window.gsbor = getStartBlockOfRange

// Returns the last block at least partially contained by the range,
// or null if no block is contained by the range.
var getEndBlockOfRange = function ( range ) {
    var container = range.endContainer,
        block, child;

    // If inline, get the containing block.
    if ( isInline( container ) ) {
        block = getPreviousBlock( container );
    } else if ( isBlock( container ) ) {
        block = container;
    } else {
        block = getNodeAfter( container, range.endOffset );
        if ( !block ) {
            block = container.ownerDocument.body;
            while ( child = block.lastChild ) {
                block = child;
            }
        }
        block = getPreviousBlock( block );

    }
    // Check the block actually intersects the range
    return block && isNodeContainedInRange( range, block, true ) ? block : null;
};

var contentWalker = new TreeWalker( null,
    SHOW_TEXT|SHOW_ELEMENT,
    function ( node ) {
        return node.nodeType === TEXT_NODE ?
            notWS.test( node.data ) :
            node.nodeName === 'IMG';
    }
);

var rangeDoesStartAtBlockBoundary = function ( range ) {
    var startContainer = range.startContainer,
        startOffset = range.startOffset;

    // If in the middle or end of a text node, we're not at the boundary.
    contentWalker.root = null;
    if ( startContainer.nodeType === TEXT_NODE ) {
        if ( startOffset ) {
            return false;
        }
        contentWalker.currentNode = startContainer;
    } else {
        contentWalker.currentNode = getNodeAfter( startContainer, startOffset );
    }

    // Otherwise, look for any previous content in the same block.
    contentWalker.root = getStartBlockOfRange( range );

    return !contentWalker.previousNode();
};
window.rdsabb = rangeDoesStartAtBlockBoundary

var rangeDoesEndAtBlockBoundary = function ( range ) {
    var endContainer = range.endContainer,
        endOffset = range.endOffset,
        length;

    // If in a text node with content, and not at the end, we're not
    // at the boundary
    contentWalker.root = null;
    if ( endContainer.nodeType === TEXT_NODE ) {
        length = endContainer.data.length;
        if ( length && endOffset < length ) {
            return false;
        }
        contentWalker.currentNode = endContainer;
    } else {
        contentWalker.currentNode = getNodeBefore( endContainer, endOffset );
    }

    // Otherwise, look for any further content in the same block.
    contentWalker.root = getEndBlockOfRange( range );

    return !contentWalker.nextNode();
};
window.rdeabb = rangeDoesEndAtBlockBoundary

var expandRangeToBlockBoundaries = function ( range ) {
    var start = getStartBlockOfRange( range ),
        end = getEndBlockOfRange( range ),
        parent;

    if ( start && end ) {
        parent = start.parentNode;
        range.setStart( parent, indexOf.call( parent.childNodes, start ) );
        parent = end.parentNode;
        range.setEnd( parent, indexOf.call( parent.childNodes, end ) + 1 );
    }
};

function SquireRange(){};
SquireRange.getNextBlock = getNextBlock
SquireRange.getPreviousBlock = getPreviousBlock
window.SquireRange = SquireRange

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
    up: function ( self, event ) {
        self._removeZWS();
        setTimeout( function () { ensureOutsideOfNotEditable( self ); }, 0 );
    },
    down: function ( self, event ) {
        self._removeZWS();
        setTimeout( function () { ensureOutsideOfNotEditable( self ); }, 0 );
    }

};

// Firefox incorrectly handles Cmd-left/Cmd-right on Mac:
// it goes back/forward in history! Override to do the right
// thing.
// https://bugzilla.mozilla.org/show_bug.cgi?id=289384
if ( isMac && isGecko && win.getSelection().modify ) {
    keyHandlers[ 'meta-left' ] = function ( self, event ) {
        event.preventDefault();
        self._sel.modify( 'move', 'backward', 'lineboundary' );
    };
    keyHandlers[ 'meta-right' ] = function ( self, event ) {
        event.preventDefault();
        self._sel.modify( 'move', 'forward', 'lineboundary' );
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

var fontSizes = {
    1: 10,
    2: 13,
    3: 16,
    4: 18,
    5: 24,
    6: 32,
    7: 48
};

var spanToSemantic = {
    backgroundColor: {
        regexp: notWS,
        replace: function ( doc, colour ) {
            return createElement( doc, 'SPAN', {
                'class': 'highlight',
                style: 'background-color: ' + colour
            });
        }
    },
    color: {
        regexp: notWS,
        replace: function ( doc, colour ) {
            return createElement( doc, 'SPAN', {
                'class': 'colour',
                style: 'color:' + colour
            });
        }
    },
    fontWeight: {
        regexp: /^bold/i,
        replace: function ( doc ) {
            return createElement( doc, 'B' );
        }
    },
    fontStyle: {
        regexp: /^italic/i,
        replace: function ( doc ) {
            return createElement( doc, 'I' );
        }
    },
    fontFamily: {
        regexp: notWS,
        replace: function ( doc, family ) {
            return createElement( doc, 'SPAN', {
                'class': 'font',
                style: 'font-family:' + family
            });
        }
    },
    fontSize: {
        regexp: notWS,
        replace: function ( doc, size ) {
            return createElement( doc, 'SPAN', {
                'class': 'size',
                style: 'font-size:' + size
            });
        }
    }
};

var replaceWithTag = function ( tag ) {
    return function ( node, parent ) {
        var el = createElement( node.ownerDocument, tag );
        parent.replaceChild( el, node );
        el.appendChild( empty( node ) );
        return el;
    };
};


var filterClasses = function(node, whiteList){
     var classes = node.classList
     var newClasses = []

     //classes are not the same in firefox and chrome, the latter returns an array, the former an object
     if(!classes.forEach){
         classes = $.map(classes, function(c){return c})
     }
     classes.forEach(function(c){
         if(whiteList[c] || c.match(/^au/) || c.match(/^ltx_/)){
             newClasses.push(c)
         }
     })
     node.className = newClasses.join(" ")
     if(node.className === ""){
         node.removeAttribute("class")
     }   
     return node
}

var filterSpanClasses = function(span){
    var whiteList = {
        "katex": 1,
        "ltx_Math": 1
    }
    return filterClasses(span, whiteList)
}

// removes any attributes not matching whiteList
// whiteList = {"class":1, "x":2}
var filterAttributes = function(node, whiteList){
    var attrs = node.attributes
    var attrsToRemove = []
    $.each(attrs, function(k, v){
        if(whiteList[v.name]){
        }
        else{
            if(whiteList["data"] && v.name.match(/^data-/)){

            }
            else{
                // cannot do this in place because it alters the attributes array
                attrsToRemove.push(v.name)
            }
        }
    })

    attrsToRemove.forEach(function(a){
        node.removeAttribute(a)
    })  
    return node  
}
var filterSpanAttributes = function(span){
    var whiteList = {
        "class": 1,
        "contenteditable": 1,
        "data": 1
    }
    return filterAttributes(span, whiteList)
}

//NATE: I lke the stylesRewriters, we should have sane defaults for all the elements as a first pass, and then
// any additional complicated filtering can be done by registering filters with squire that will be executed during
// insertHTML
var stylesRewriters = {
    SPAN: function ( span, parent ) {
        //NATE: TODO: whitelist of classes for span
        span.removeAttribute("style")
        filterSpanClasses(span)
        filterSpanAttributes(span)
        return span
        // NATE: I want to leave one line of the old code in as a reminder, this is the line that was causing
        // one span to get broken out into many spans, but it was kind of clever and we might want to use the idea
        // at a later time.  It looked at if something had a large font or a certain color and tried to guess what the
        // element was and add a semantic class to the span.  For each attribute there was a separate class.  Although
        // we don't want a bunch of spans with classes, we might want to re-order a span with certain attributes into 
        // more sensible elements
        // for ( attr in spanToSemantic ) 
    },
    STRONG: replaceWithTag( 'B' ),
    EM: replaceWithTag( 'I' ),
    STRIKE: replaceWithTag( 'S' ),
    FONT: function ( node, parent ) {
        var face = node.face,
            size = node.size,
            colour = node.color,
            doc = node.ownerDocument,
            fontSpan, sizeSpan, colourSpan,
            newTreeBottom, newTreeTop;
        if ( face ) {
            fontSpan = createElement( doc, 'SPAN', {
                'class': 'font',
                style: 'font-family:' + face
            });
            newTreeTop = fontSpan;
            newTreeBottom = fontSpan;
        }
        if ( size ) {
            sizeSpan = createElement( doc, 'SPAN', {
                'class': 'size',
                style: 'font-size:' + fontSizes[ size ] + 'px'
            });
            if ( !newTreeTop ) {
                newTreeTop = sizeSpan;
            }
            if ( newTreeBottom ) {
                newTreeBottom.appendChild( sizeSpan );
            }
            newTreeBottom = sizeSpan;
        }
        if ( colour && /^#?([\dA-F]{3}){1,2}$/i.test( colour ) ) {
            if ( colour.charAt( 0 ) !== '#' ) {
                colour = '#' + colour;
            }
            colourSpan = createElement( doc, 'SPAN', {
                'class': 'colour',
                style: 'color:' + colour
            });
            if ( !newTreeTop ) {
                newTreeTop = colourSpan;
            }
            if ( newTreeBottom ) {
                newTreeBottom.appendChild( colourSpan );
            }
            newTreeBottom = colourSpan;
        }
        if ( !newTreeTop ) {
            newTreeTop = newTreeBottom = createElement( doc, 'SPAN' );
        }
        parent.replaceChild( newTreeTop, node );
        newTreeBottom.appendChild( empty( node ) );
        return newTreeBottom;
    },
    TT: function ( node, parent ) {
        var el = createElement( node.ownerDocument, 'SPAN', {
            'class': 'font',
            style: 'font-family:menlo,consolas,"courier new",monospace'
        });
        parent.replaceChild( el, node );
        el.appendChild( empty( node ) );
        return el;
    },
    //NATE:  I added a default rewriter so that we filter elements not specified here with a strict set of classes and attributes.
    // Basically for the moment if we don't know what it is it will have no classes and no attributes.  
    DEFAULT_REWRITER: function ( node, parent ){
        filterClasses(node, {})
        filterAttributes(node, {data: 1, class: 1, contenteditable: 1})
        return node
    },
    A: function ( node, parent ){
        filterClasses(node, {})
        filterAttributes(node, {"href": 1})
        return node
    }
    //TODO: NATE: We probably want to map p tags to divs, it might be done already but I'm not 100% sure
};

var allowedBlock = /^(?:A(?:DDRESS|RTICLE|SIDE|UDIO)|BLOCKQUOTE|CAPTION|D(?:[DLT]|IV)|F(?:IGURE|OOTER)|H[1-6]|HEADER|L(?:ABEL|EGEND|I)|O(?:L|UTPUT)|P(?:RE)?|SECTION|T(?:ABLE|BODY|D|FOOT|H|HEAD|R)|UL)$/;

var blacklist = /^(?:HEAD|META|STYLE)/;

var walker = new TreeWalker( null, SHOW_TEXT|SHOW_ELEMENT, function () {
    return true;
});

var doNotCleanNode = function(node){
    // The easiest thing to determine whether or not we should clean something is if it is editable or not.
    // return notEditable(node).  Unfortunately I have introduced a jquery dependence here but the inconsistencies
    // between firefox and chrome have broken me down.
    return $(node).hasClass("ltx_Math")
}

/*
    Two purposes:

    1. Remove nodes we don't want, such as weird <o:p> tags, comment nodes
       and whitespace nodes.
    2. Convert inline tags into our preferred format.

    Nate:  This is currenty used by setHTML when importing html, which was its original useage,
    and by the backspace key to clean up any inconsistencies.  We should look at whether or not
    calling it from backspace is really useful.

    Nate:  There are certain nodes which would be very difficult to clean as we do not have a well-defined
    structure for them.  I am adding a function 'doNotCleanNode' which simply returns the node if true.
    That function in principle could be replaced by a user-supplied function.
*/
var cleanTree = function cleanTree ( node ) {
    var children = node.childNodes,
        nonInlineParent, i, l, child, nodeName, nodeType, rewriter, childLength,
        startsWithWS, endsWithWS, data, sibling;

    if(doNotCleanNode(node)){
        return node
    }
    nonInlineParent = node;
    while ( isInline( nonInlineParent ) ) {
        nonInlineParent = nonInlineParent.parentNode;
    }
    walker.root = nonInlineParent;

    for ( i = 0, l = children.length; i < l; i += 1 ) {
        child = children[i];
        nodeName = child.nodeName;
        nodeType = child.nodeType;
        rewriter = stylesRewriters[ nodeName ];
        if ( nodeType === ELEMENT_NODE ) {
            childLength = child.childNodes.length;
            if ( rewriter ) {
                // TODO: child could technically change here and I think childLength needs to be recalculated
                child = rewriter( child, node );
            }
            else{
                child = stylesRewriters[ 'DEFAULT_REWRITER' ](child, node);
            } 
            if ( blacklist.test( nodeName ) ) {
                node.removeChild( child );
                i -= 1;
                l -= 1;
                continue;
            } else if ( !allowedBlock.test( nodeName ) && !isInline( child ) ) {
                i -= 1;
                l += childLength - 1;
                node.replaceChild( empty( child ), child );
                continue;
            }
            if ( childLength ) {
                cleanTree( child );
            }
        } else {
            if ( nodeType === TEXT_NODE ) {
                data = child.data;
                startsWithWS = !notWS.test( data.charAt( 0 ) );
                endsWithWS = !notWS.test( data.charAt( data.length - 1 ) );
                if ( !startsWithWS && !endsWithWS ) {
                    continue;
                }
                // Iterate through the nodes; if we hit some other content
                // before the start of a new block we don't trim
                if ( startsWithWS ) {
                    walker.currentNode = child;
                    while ( sibling = walker.previousPONode() ) {
                        nodeName = sibling.nodeName;
                        if ( nodeName === 'IMG' ||
                                ( nodeName === '#text' &&
                                    /\S/.test( sibling.data ) ) ) {
                            break;
                        }
                        if ( !isInline( sibling ) ) {
                            sibling = null;
                            break;
                        }
                    }
                    if ( !sibling ) {
                        data = data.replace( /^\s+/g, '' );
                    }
                }
                if ( endsWithWS ) {
                    walker.currentNode = child;
                    while ( sibling = walker.nextNode() ) {
                        if ( nodeName === 'IMG' ||
                                ( nodeName === '#text' &&
                                    /\S/.test( sibling.data ) ) ) {
                            break;
                        }
                        if ( !isInline( sibling ) ) {
                            sibling = null;
                            break;
                        }
                    }
                    if ( !sibling ) {
                        data = data.replace( /^\s+/g, '' );
                    }
                }
                if ( data ) {
                    //TODO: This is resetting the range info for the editor, I had a pointer to that range 
                    //inside of backspace.  Calls to cleanTree were causing the cursor to jump around 
                    //if a space was at the end of an element even though data and child.data were the same,
                    //ie this was a no-op.  cleanTree should probably store a clone of the range initially,
                    //and at the end of execution either restore the range or figure out what the knew range 
                    //should be based on the cleanup actions taken.
                    if(child.data !== data){
                        child.data = data
                    }
                    continue;
                }
            }
            node.removeChild( child );
            i -= 1;
            l -= 1;
        }
    }
    return node;
};

// ---

var removeEmptyInlines = function removeEmptyInlines ( root ) {
    var children = root.childNodes,
        l = children.length,
        child;
    while ( l-- ) {
        child = children[l];
        if ( child.nodeType === ELEMENT_NODE && !isLeaf( child ) ) {
            removeEmptyInlines( child );
            if ( isInline( child ) && !child.firstChild ) {
                root.removeChild( child );
            }
        } else if ( child.nodeType === TEXT_NODE && !child.data ) {
            root.removeChild( child );
        }
    }
};

// chrome doesn't like consecutive spaces, it will only show one of them.  We need to replace '  ' with
// '$nbsp; '.  Also, if a range happens to contain a node as its start or end and the data is altered in
// that range, the offset will be set to 0.  I don't know how to prevent that other than replacing it
// afterwards.
var replaceDoubleSpace = function replaceDoubleSpace ( root, range ) {
    var walker = new TreeWalker(root, SHOW_TEXT, function(){return true})
    var node = walker.currentNode
    var startNode = range.startContainer
    var endNode = range.endContainer
    var startOffset = range.startOffset
    var endOffset = range.endOffset
    while(node){
        if (node.nodeType === TEXT_NODE && !isLeaf( node ) ) {
            var text = node.data
            if(text){
                node.data = text.replace('  ', "\u00A0 ")
                if(startNode === node){
                    range.setStart(startNode, startOffset)
                }
                else if(endNode === node){
                    range.setEnd(endNode, endOffset)
                }
            }
        }
        node = walker.nextNode()
    }
};

var replaceTrailingSingleSpace = function replaceTrailingSingleSpace ( root, range ) {
    var walker = new TreeWalker(root, SHOW_TEXT, function(){return true})
    var node = walker.currentNode
    var startNode = range.startContainer
    var endNode = range.endContainer
    var startOffset = range.startOffset
    var endOffset = range.endOffset
    while(node){
        if (node.nodeType === TEXT_NODE && !isLeaf( node ) ) {
            var text = node.data
            if(text){
                // Nate: Chrome does not do well with trailing spaces
                if(node.data[node.data.length-1] === ' '){
                    node.replaceData(node.data.length-1, 1, "\u00A0")
                
                    if(startNode === node){
                        range.setStart(startNode, startOffset)
                    }
                    else if(endNode === node){
                        range.setEnd(endNode, endOffset)
                    }
                }
            }
        }
        node = walker.nextNode()
    }
};

// Nate:  The hack I found to get chrome happy with noneditable containers is to place a zero-width-space and 
// a dummy <z> container in front of them.  This ZWS can sometimes be absorbed by the text element preceding it.  
// They are impossible to see.
var removeTrailingZWS = function removeTrailingZWS ( root ) {
    var walker = new TreeWalker(root, SHOW_TEXT, function(){return true})
    var node = walker.currentNode
    while(node){
        if (isText(node) && !isLeaf( node ) ) {
            if(node.data){
                if(node.data.length > 1 && node.data[node.data.length-1] === ZWNBS){
                    node.replaceData(node.data.length-1, 1, "")
                
                }
            }
        }
        node = walker.nextNode()
    }
};

var ensureBrAtEndOfAllLines = function (root){
    //NATE: even divs which are not lines need to have brs at their end for chrome to happily play with spaces
    ensureBrAtEndOfAllDivs(root)
    var lines = root.childNodes
    var i = 0
    var div, lastChild, br
    for(i=0; i<lines.length; i++){
        div = lines[i]
        if(isBlock(div)){
            lastChild = div.lastChild
            if(!lastChild || lastChild.nodeName !== 'BR'){
                br = createElement( div.ownerDocument, 'BR' )
                div.appendChild(br)
            }
        }
    }
}
var ensureBrAtEndOfAllDivs = function (root){
    var divs = $(root).find("div")
    var lastChild, br
    divs.each(function(i, div){
        lastChild = div.lastChild
        if(!lastChild || lastChild.nodeName !== 'BR'){
            br = createElement( div.ownerDocument, 'BR' )
            div.appendChild(br)
        }
    })
}


// NATE: TODO: make sure this does not apply to other blocks
var removeBrAtEndOfAllLines = function (root){
    var lines = root.childNodes
    var i = 0
    var div, lastChild, br
    for(i=0; i<lines.length; i++){
        div = lines[i]
        if(isBlock(div)){
            lastChild = div.lastChild
            if(lastChild && lastChild.nodeName === 'BR'){
                detach(lastChild)
            }
        }
    }
}

// The only purpose of the Z node is to protect a following non-editable container, removing it
// if it's neighbor is missing or editable
var removeDanglingZNodes = function(root){
    var walker = new TreeWalker(root, SHOW_ELEMENT, function(){return true})
    var node = walker.currentNode
    var nodesToRemove = []
    var ps

    while(node){
        if (node.nodeName === 'Z' ) {
            if(!notEditable(node.nextSibling)){
                nodesToRemove.push(node)
                ps = node.previousSibling
                if(isZWNBS(ps)){
                    nodesToRemove.push(ps)
                }
            }
        }
        node = walker.nextNode()
    }
    nodesToRemove.forEach(function(node){
        detach(node)
    })
};

var removeAllZNodes = function(root){
    var walker = new TreeWalker(root, SHOW_ELEMENT, function(){return true})
    var node = walker.currentNode
    var ps
    var nodesToRemove = []

    while(node){
        if (node.nodeName === 'Z' ) {
            nodesToRemove.push(node)
            ps = node.previousSibling
            if(isZWNBS(ps)){
                nodesToRemove.push(ps)
            }
        }
        node = walker.nextNode()
    }
    nodesToRemove.forEach(function(node){
        detach(node)
    })
};
var ensurePreZNodesForContentEditable = function(root){
    //only uppermost not editables need the Z tag, because the lower nodes will be inaccessible
    var walker = new TreeWalker(root, SHOW_ELEMENT, function(node){return (notEditable(node) && !notEditable(node.parentNode) )})
    var node = walker.currentNode
    var doc = node.ownerDocument
    if(!walker.filter(node)){
        node = walker.nextNode()
    }
    var previousNode, zwsNode
    var n, t

    while(node){
        previousNode = node.previousSibling
        if(!(previousNode && previousNode.nodeName === "Z")){
            n = doc.createElement("z")
            // node.parentNode.insertBefore(t, node)
            node.parentNode.insertBefore(n, node)
        }
        else{
            n = previousNode
        }
        zwsNode = n && n.previousSibling
        if(!isZWNBS(zwsNode)){
            t = doc.createTextNode( ZWNBS )
            // node.parentNode.insertBefore(t, node)
            n.parentNode.insertBefore(t, n)
        }
        
        node = walker.nextNode()
    }
}


// ---

var notWSTextNode = function ( node ) {
    return node.nodeType === ELEMENT_NODE ?
        node.nodeName === 'BR' :
        notWS.test( node.data );
};
var isLineBreak = function ( br ) {
    var block = br.parentNode,
        walker;
    while ( isInline( block ) ) {
        block = block.parentNode;
    }
    walker = new TreeWalker(
        block, SHOW_ELEMENT|SHOW_TEXT, notWSTextNode );
    walker.currentNode = br;
    return !!walker.nextNode();
};

// <br> elements are treated specially, and differently depending on the
// browser, when in rich text editor mode. When adding HTML from external
// sources, we must remove them, replacing the ones that actually affect
// line breaks by wrapping the inline text in a <div>. Browsers that want <br>
// elements at the end of each block will then have them added back in a later
// fixCursor method call.
var cleanupBRs = function ( root ) {
    var brs = root.querySelectorAll( 'BR' ),
        brBreaksLine = [],
        l = brs.length,
        i, br, parent;

    // Must calculate whether the <br> breaks a line first, because if we
    // have two <br>s next to each other, after the first one is converted
    // to a block split, the second will be at the end of a block and
    // therefore seem to not be a line break. But in its original context it
    // was, so we should also convert it to a block split.
    for ( i = 0; i < l; i += 1 ) {
        brBreaksLine[i] = isLineBreak( brs[i] );
    }
    while ( l-- ) {
        br = brs[l];
        // Cleanup may have removed it
        parent = br.parentNode;
        if ( !parent ) { continue; }
        // If it doesn't break a line, just remove it; it's not doing
        // anything useful. We'll add it back later if required by the
        // browser. If it breaks a line, wrap the content in div tags
        // and replace the brs.
        if ( !brBreaksLine[l] ) {
            detach( br );
        } else if ( !isInline( parent ) ) {
            fixContainer( parent );
        }
    }
};

// If a span has no special attribute or class name, replace it with its children
var collapseSimpleSpans = function collapseSimpleSpans( node ) {
    if(node.nodeType === TEXT_NODE){
        return;
    }
    var children = node.childNodes
    var parent   = node.parentNode
    var child, nextChild, frag
    var i

    var length = node.childNodes.length
    for(i=length-1; i>-1; i--){
        collapseSimpleSpans(node.childNodes[i])
    }

    if(node.nodeName === "SPAN"){
        // if the span has no attributes (which includes class), remove it from the dom and replace it with its children
        if(node.attributes.length === 0){
            child = node.firstChild
            while(child){
                nextChild = child.nextSibling
                parent.insertBefore(child, node)
                child = nextChild
            }
            parent.removeChild(node)
        }    
    }
  
}

Squire.Clean = function(){}
//NATE: normally I use the editor.collapseSimpleSpans but for testing I would like to have it available from Squire.Clean
Squire.Clean.collapseSimpleSpans = collapseSimpleSpans
Squire.prototype.cleanTree = cleanTree
Squire.prototype.removeDanglingZNodes = removeDanglingZNodes
Squire.prototype.ensurePreZNodesForContentEditable = ensurePreZNodesForContentEditable
Squire.prototype.removeAllZNodes = removeAllZNodes
Squire.prototype.removeEmptyInlines = removeEmptyInlines
Squire.prototype.collapseSimpleSpans = collapseSimpleSpans
Squire.prototype.ensureBrAtEndOfAllLines = ensureBrAtEndOfAllLines

Squire.Clean.stylesRewriters = stylesRewriters

var onCut = function () {
    // Save undo checkpoint
    var range = this.getSelection();
    var self = this;
    this._recordUndoState( range );
    this._getRangeAndRemoveBookmark( range );
    this.setSelection( range );
    setTimeout( function () {
        try {
            // If all content removed, ensure div at start of body.
            self._ensureBottomLine();
        } catch ( error ) {
            self.didError( error );
        }
    }, 0 );
};

var onPaste = function ( event ) {
    console.info("PASTING")
    var clipboardData = event.clipboardData,
        items = clipboardData && clipboardData.items,
        fireDrop = false,
        hasImage = false,
        plainItem = null,
        self = this,
        l, item, type, data;
    // Current HTML5 Clipboard interface
    // ---------------------------------
    // https://html.spec.whatwg.org/multipage/interaction.html

    if ( items ) {
        console.info("has items")
        event.preventDefault();
        l = items.length;
        while ( l-- ) {
            item = items[l];
            window.item = item
            type = item.type;
            if ( type === 'text/html' ) {
                console.info("html item")
                /*jshint loopfunc: true */
                item.getAsString( function ( html ) {
                    // self.s = html
                    // console.info(html)
                    self.insertHTML( html, true );
                });
                /*jshint loopfunc: false */
                return;
            }
            if ( type === 'text/plain' ) {
                console.info("plain item")
                plainItem = item;
            }
            if ( /^image\/.*/.test( type ) ) {
                console.info("image")
                hasImage = true;
            }
        }
        // Treat image paste as a drop of an image file.
        if ( hasImage ) {
            this.fireEvent( 'dragover', {
                dataTransfer: clipboardData,
                /*jshint loopfunc: true */
                preventDefault: function () {
                    fireDrop = true;
                }
                /*jshint loopfunc: false */
            });
            if ( fireDrop ) {
                this.fireEvent( 'drop', {
                    dataTransfer: clipboardData
                });
            }
        } else if ( plainItem ) {
            item.getAsString( function ( text ) {
                self.insertPlainText( text, true );
            });
        }
        return;
    }

    // Old interface
    // -------------

    // Safari (and indeed many other OS X apps) copies stuff as text/rtf
    // rather than text/html; even from a webpage in Safari. The only way
    // to get an HTML version is to fallback to letting the browser insert
    // the content. Same for getting image data. *Sigh*.
    if ( clipboardData && (
            indexOf.call( clipboardData.types, 'text/html' ) > -1 || (
            indexOf.call( clipboardData.types, 'text/plain' ) > -1 &&
            indexOf.call( clipboardData.types, 'text/rtf' ) < 0 ) ) ) {
        console.info("old interface")
        event.preventDefault();
        // Abiword on Linux copies a plain text and html version, but the HTML
        // version is the empty string! So always try to get HTML, but if none,
        // insert plain text instead.
        if (( data = clipboardData.getData( 'text/html' ) )) {
            this.insertHTML( data, true );
        } else if (( data = clipboardData.getData( 'text/plain' ) )) {
            this.insertPlainText( data, true );
        }
        return;
    }

    // No interface :(
    // ---------------

    this._awaitingPaste = true;

    var body = this._body,
        range = this.getSelection(),
        startContainer = range.startContainer,
        startOffset = range.startOffset,
        endContainer = range.endContainer,
        endOffset = range.endOffset,
        startBlock = getStartBlockOfRange( range );

    // We need to position the pasteArea in the visible portion of the screen
    // to stop the browser auto-scrolling.
    var pasteArea = this.createElement( 'DIV', {
        style: 'position: absolute; overflow: hidden; top:' +
            ( body.scrollTop +
                ( startBlock ? startBlock.getBoundingClientRect().top : 0 ) ) +
            'px; right: 150%; width: 1px; height: 1px;'
    });
    body.appendChild( pasteArea );
    range.selectNodeContents( pasteArea );
    this.setSelection( range );

    // A setTimeout of 0 means this is added to the back of the
    // single javascript thread, so it will be executed after the
    // paste event.
    setTimeout( function () {
        try {
            // IE sometimes fires the beforepaste event twice; make sure it is
            // not run again before our after paste function is called.
            self._awaitingPaste = false;

            // Get the pasted content and clean
            var html = '',
                next = pasteArea,
                first, range;

            // #88: Chrome can apparently split the paste area if certain
            // content is inserted; gather them all up.
            while ( pasteArea = next ) {
                next = pasteArea.nextSibling;
                detach( pasteArea );
                // Safari and IE like putting extra divs around things.
                first = pasteArea.firstChild;
                if ( first && first === pasteArea.lastChild &&
                        first.nodeName === 'DIV' ) {
                    pasteArea = first;
                }
                html += pasteArea.innerHTML;
            }

            range = self._createRange(
                startContainer, startOffset, endContainer, endOffset );
            self.setSelection( range );

            if ( html ) {
                self.insertHTML( html, true );
            }
        } catch ( error ) {
            self.didError( error );
        }
    }, 0 );
};

var instances = [];

function getSquireInstance ( doc ) {
    var l = instances.length,
        instance;
    while ( l-- ) {
        instance = instances[l];
        if ( instance._doc === doc ) {
            return instance;
        }
    }
    return null;
}

function mergeObjects ( base, extras ) {
    var prop, value;
    if ( !base ) {
        base = {};
    }
    for ( prop in extras ) {
        value = extras[ prop ];
        base[ prop ] = ( value && value.constructor === Object ) ?
            mergeObjects( base[ prop ], value ) :
            value;
    }
    return base;
}

function Squire ( doc, config ) {
    var win = doc.defaultView;
    var body = doc.body;
    var mutation;

    this._win = win;
    this._doc = doc;
    this._body = body;

    this._events = {};

    this._sel = win.getSelection();
    this._lastSelection = null;

    // IE loses selection state of iframe on blur, so make sure we
    // cache it just before it loses focus.
    if ( losesSelectionOnBlur ) {
        this.addEventListener( 'beforedeactivate', this.getSelection );
    }

    this.addEventListener("keypress", function(e){
        var r = this.getSelection()
        var sc = r.startContainer
        var so = r.startOffset
        var child = sc.childNodes && sc.childNodes[so]
        // NATE: if the child is not editable we need to set the cursor position to behind the to protective chars, ZWNBS<Z>.
        // So we look back to see if they exist, and to see if there is already a text node behind them.  If so then set the
        // range to the end of that text node, otherwise insert a new text node containing the character in the keypress.
        // I tried not inserting the char, instead starting with a blank string, but chrome will then insert the char 
        // into the ZWNBS text, amazingly.
        if(notEditable(child)){
            console.info("NOT EDITABLE need to move range")
            var z = child.previousSibling
            var zwnbs = isZ(z) && z.previousSibling
            var beforeZwnbs = isZWNBS(zwnbs) && zwnbs.previousSibling
            if(isText(beforeZwnbs)){
                var length = beforeZwnbs.length
                this.setSelectionToNode(beforeZwnbs, length ? length : 0)
            }
            else if(isZWNBS(zwnbs)){
                e.preventDefault()
                var tn = this._doc.createTextNode(String.fromCharCode(e.charCode))
                sc.insertBefore(tn, zwnbs)
                this.setSelectionToNode(tn, 1)

            }
        }
        else if(isZWNBS(child) || isZWNBS(sc)){
           console.info("currrently focued on zwnbs")
           var zwnbs = isZWNBS(child) && child || sc
           var beforeZwnbs = zwnbs.previousSibling
           var parent = (zwnbs === child) ? sc : sc.parentNode
           if(isText(beforeZwnbs)){
               var length = beforeZwnbs.length
               this.setSelectionToNode(beforeZwnbs, length ? length : 0)
           }
           else{

               e.preventDefault()
               var tn = this._doc.createTextNode(String.fromCharCode(e.charCode))
               parent.insertBefore(tn, zwnbs)
               this.setSelectionToNode(tn, 1)

           }
        }     
    });  

    this._hasZWS = false;

    this._lastAnchorNode = null;
    this._lastFocusNode = null;
    this._path = '';

    this.addEventListener( 'keyup', this._updatePathOnEvent );
    this.addEventListener( 'mouseup', this._updatePathOnEvent );
    this.addEventListener( 'mouseup', function(){
        var range = this.getSelection()
        moveRangeOutOfNotEditable(range)
        this.setSelection(range)
    } );

    win.addEventListener( 'focus', this, false );
    win.addEventListener( 'blur', this, false );

    this._undoIndex = -1;
    this._undoStack = [];
    this._undoStackLength = 0;
    this._isInUndoState = false;
    this._ignoreChange = false;

    if ( canObserveMutations ) {
        mutation = new MutationObserver( this._docWasChanged.bind( this ) );
        mutation.observe( body, {
            childList: true,
            attributes: true,
            characterData: true,
            subtree: true
        });
        this._mutation = mutation;
    } else {
        this.addEventListener( 'keyup', this._keyUpDetectChange );
    }

    // IE sometimes fires the beforepaste event twice; make sure it is not run
    // again before our after paste function is called.
    this._awaitingPaste = false;
    this.addEventListener( isIElt11 ? 'beforecut' : 'cut', onCut );
    this.addEventListener( isIElt11 ? 'beforepaste' : 'paste', onPaste );

    // Opera does not fire keydown repeatedly.
    this.addEventListener( isPresto ? 'keypress' : 'keydown', onKey );

    // Add key handlers
    this._keyHandlers = Object.create( keyHandlers );

    // Override default properties
    this.setConfig( config );

    // Fix IE<10's buggy implementation of Text#splitText.
    // If the split is at the end of the node, it doesn't insert the newly split
    // node into the document, and sets its value to undefined rather than ''.
    // And even if the split is not at the end, the original node is removed
    // from the document and replaced by another, rather than just having its
    // data shortened.
    // We used to feature test for this, but then found the feature test would
    // sometimes pass, but later on the buggy behaviour would still appear.
    // I think IE10 does not have the same bug, but it doesn't hurt to replace
    // its native fn too and then we don't need yet another UA category.
    if ( isIElt11 ) {
        win.Text.prototype.splitText = function ( offset ) {
            var afterSplit = this.ownerDocument.createTextNode(
                    this.data.slice( offset ) ),
                next = this.nextSibling,
                parent = this.parentNode,
                toDelete = this.length - offset;
            if ( next ) {
                parent.insertBefore( afterSplit, next );
            } else {
                parent.appendChild( afterSplit );
            }
            if ( toDelete ) {
                this.deleteData( offset, toDelete );
            }
            return afterSplit;
        };
    }

    body.setAttribute( 'contenteditable', 'true' );

    // Remove Firefox's built-in controls
    try {
        doc.execCommand( 'enableObjectResizing', false, 'false' );
        doc.execCommand( 'enableInlineTableEditing', false, 'false' );
    } catch ( error ) {}

    instances.push( this );

    // Need to register instance before calling setHTML, so that the fixCursor
    // function can lookup any default block tag options set.
    this.setHTML( '' );
}

var proto = Squire.prototype;

proto.setConfig = function ( config ) {
    config = mergeObjects({
        blockTag: 'DIV',
        blockAttributes: null,
        tagAttributes: {
            blockquote: null,
            ul: null,
            ol: null,
            li: null
        }
    }, config );

    // Users may specify block tag in lower case
    config.blockTag = config.blockTag.toUpperCase();

    this._config = config;

    return this;
};

proto.createElement = function ( tag, props, children ) {
    return createElement( this._doc, tag, props, children );
};

proto.createDefaultBlock = function ( children ) {
    var config = this._config;
    return fixCursor(
        this.createElement( config.blockTag, config.blockAttributes, children )
    );
};

proto.didError = function ( error ) {
    console.log( error );
};

proto.getDocument = function () {
    return this._doc;
};

// --- Events ---

// Subscribing to these events won't automatically add a listener to the
// document node, since these events are fired in a custom manner by the
// editor code.
var customEvents = {
    focus: 1, blur: 1,
    pathChange: 1, select: 1, input: 1, undoStateChange: 1
};

proto.fireEvent = function ( type, event ) {
    var handlers = this._events[ type ],
        l, obj;
    if ( handlers ) {
        if ( !event ) {
            event = {};
        }
        if ( event.type !== type ) {
            event.type = type;
        }
        // Clone handlers array, so any handlers added/removed do not affect it.
        handlers = handlers.slice();
        l = handlers.length;
        while ( l-- ) {
            obj = handlers[l];
            try {
                if ( obj.handleEvent ) {
                    obj.handleEvent( event );
                } else {
                    obj.call( this, event );
                }
            } catch ( error ) {
                error.details = 'Squire: fireEvent error. Event type: ' + type;
                this.didError( error );
            }
        }
    }
    return this;
};

proto.destroy = function () {
    var win = this._win,
        doc = this._doc,
        events = this._events,
        type;
    win.removeEventListener( 'focus', this, false );
    win.removeEventListener( 'blur', this, false );
    for ( type in events ) {
        if ( !customEvents[ type ] ) {
            doc.removeEventListener( type, this, true );
        }
    }
    if ( this._mutation ) {
        this._mutation.disconnect();
    }
    var l = instances.length;
    while ( l-- ) {
        if ( instances[l] === this ) {
            instances.splice( l, 1 );
        }
    }
};

proto.handleEvent = function ( event ) {
    this.fireEvent( event.type, event );
};

proto.addEventListener = function ( type, fn ) {
    var handlers = this._events[ type ];
    if ( !fn ) {
        this.didError({
            name: 'Squire: addEventListener with null or undefined fn',
            message: 'Event type: ' + type
        });
        return this;
    }
    if ( !handlers ) {
        handlers = this._events[ type ] = [];
        if ( !customEvents[ type ] ) {
            this._doc.addEventListener( type, this, true );
        }
    }
    handlers.push( fn );
    return this;
};

proto.removeEventListener = function ( type, fn ) {
    var handlers = this._events[ type ],
        l;
    if ( handlers ) {
        l = handlers.length;
        while ( l-- ) {
            if ( handlers[l] === fn ) {
                handlers.splice( l, 1 );
            }
        }
        if ( !handlers.length ) {
            delete this._events[ type ];
            if ( !customEvents[ type ] ) {
                this._doc.removeEventListener( type, this, false );
            }
        }
    }
    return this;
};

// --- Selection and Path ---

proto._createRange =
        function ( range, startOffset, endContainer, endOffset ) {
    if ( range instanceof this._win.Range ) {
        return range.cloneRange();
    }
    var domRange = this._doc.createRange();
    domRange.setStart( range, startOffset );
    if ( endContainer ) {
        domRange.setEnd( endContainer, endOffset );
    } else {
        domRange.setEnd( range, startOffset );
    }
    return domRange;
};

proto._moveCursorTo = function ( toStart ) {
    var body = this._body,
        range = this._createRange( body, toStart ? 0 : body.childNodes.length );
    moveRangeBoundariesDownTree( range );
    this.setSelection( range );
    return this;
};
proto.moveCursorToStart = function () {
    return this._moveCursorTo( true );
};
proto.moveCursorToEnd = function () {
    return this._moveCursorTo( false );
};

proto.setSelection = function ( range ) {
    if ( range ) {
        // iOS bug: if you don't focus the iframe before setting the
        // selection, you can end up in a state where you type but the input
        // doesn't get directed into the contenteditable area but is instead
        // lost in a black hole. Very strange.
        if ( isIOS ) {
            this._win.focus();
        }
        var sel = this._sel;
        sel.removeAllRanges();
        sel.addRange( range );
    }
    return this;
};

proto.setSelectionToNode = function (node, startOffset){
    var range = this._doc.createRange()
    range.setStart(node, startOffset)
    range.setEnd(node, startOffset)
    this.setSelection(range)
}

proto.getSelection = function () {
    var sel = this._sel,
        selection, startContainer, endContainer;
    if ( sel.rangeCount ) {
        selection  = sel.getRangeAt( 0 ).cloneRange();
        startContainer = selection.startContainer;
        endContainer = selection.endContainer;
        // FF can return the selection as being inside an <img>. WTF?
        if ( startContainer && isLeaf( startContainer ) ) {
            selection.setStartBefore( startContainer );
        }
        if ( endContainer && isLeaf( endContainer ) ) {
            selection.setEndBefore( endContainer );
        }
        this._lastSelection = selection;
    } else {
        selection = this._lastSelection;
    }
    if ( !selection ) {
        selection = this._createRange( this._body.firstChild, 0 );
    }
    return selection;
};

proto.getCurrentStartBlock = function() {
    var r = this.getSelection()
    return getStartBlockOfRange(r)
}

proto.getSelectedText = function () {
    var range = this.getSelection(),
        walker = new TreeWalker(
            range.commonAncestorContainer,
            SHOW_TEXT|SHOW_ELEMENT,
            function ( node ) {
                return isNodeContainedInRange( range, node, true );
            }
        ),
        startContainer = range.startContainer,
        endContainer = range.endContainer,
        node = walker.currentNode = startContainer,
        textContent = '',
        addedTextInBlock = false,
        value;

    if ( !walker.filter( node ) ) {
        node = walker.nextNode();
    }

    while ( node ) {
        if ( node.nodeType === TEXT_NODE ) {
            value = node.data;
            if ( value && ( /\S/.test( value ) ) ) {
                if ( node === endContainer ) {
                    value = value.slice( 0, range.endOffset );
                }
                if ( node === startContainer ) {
                    value = value.slice( range.startOffset );
                }
                textContent += value;
                addedTextInBlock = true;
            }
        } else if ( node.nodeName === 'BR' ||
                addedTextInBlock && !isInline( node ) ) {
            textContent += '\n';
            addedTextInBlock = false;
        }
        node = walker.nextNode();
    }

    return textContent;
};

proto.getPath = function () {
    return this._path;
};

// --- Workaround for browsers that can't focus empty text nodes ---

// WebKit bug: https://bugs.webkit.org/show_bug.cgi?id=15256

var removeZWS = function ( root ) {
    var walker = new TreeWalker( root, SHOW_TEXT, function () {
            return true;
        }, false ),
        parent, node, index;
    while ( node = walker.nextNode() ) {
        while ( ( index = node.data.indexOf( ZWS ) ) > -1 ) {
            if ( node.length === 1 ) {
                do {
                    parent = node.parentNode;
                    parent.removeChild( node );
                    node = parent;
                } while ( isInline( node ) && !getLength( node ) );
                break;
            } else {
                node.deleteData( index, 1 );
            }
        }
    }
};

proto._didAddZWS = function () {
    this._hasZWS = true;
};
proto._removeZWS = function () {
    if ( !this._hasZWS ) {
        return;
    }
    removeZWS( this._body );
    this._hasZWS = false;
};

// --- Path change events ---

proto._updatePath = function ( range, force ) {
    var anchor = range.startContainer,
        focus = range.endContainer,
        newPath;
    if ( force || anchor !== this._lastAnchorNode ||
            focus !== this._lastFocusNode ) {
        this._lastAnchorNode = anchor;
        this._lastFocusNode = focus;
        newPath = ( anchor && focus ) ? ( anchor === focus ) ?
            getPath( focus ) : '(selection)' : '';
        if ( this._path !== newPath ) {
            this._path = newPath;
            this.fireEvent( 'pathChange', { path: newPath } );
        }
    }
    if ( !range.collapsed ) {
        this.fireEvent( 'select' );
    }
};

proto._updatePathOnEvent = function () {
    this._updatePath( this.getSelection() );
};

// --- Focus ---

proto.focus = function () {
    // FF seems to need the body to be focussed (at least on first load).
    // Chrome also now needs body to be focussed in order to show the cursor
    // (otherwise it is focussed, but the cursor doesn't appear).
    // Opera (Presto-variant) however will lose the selection if you call this!
    if ( !isPresto ) {
        this._body.focus();
    }
    this._win.focus();
    return this;
};

proto.blur = function () {
    // IE will remove the whole browser window from focus if you call
    // win.blur() or body.blur(), so instead we call top.focus() to focus
    // the top frame, thus blurring this frame. This works in everything
    // except FF, so we need to call body.blur() in that as well.
    if ( isGecko ) {
        this._body.blur();
    }
    top.focus();
    return this;
};

// --- Bookmarking ---

var startSelectionId = 'squire-selection-start';
var endSelectionId = 'squire-selection-end';

proto._saveRangeToBookmark = function ( range ) {
    var startNode = this.createElement( 'INPUT', {
            id: startSelectionId,
            type: 'hidden'
        }),
    endNode = this.createElement( 'INPUT', {
            id: endSelectionId,
            type: 'hidden'

        }),
        temp;

    insertNodeInRange( range, startNode );
    range.collapse( false );
    insertNodeInRange( range, endNode );

    // In a collapsed range, the start is sometimes inserted after the end!
    if ( startNode.compareDocumentPosition( endNode ) &
            DOCUMENT_POSITION_PRECEDING ) {
        startNode.id = endSelectionId;
        endNode.id = startSelectionId;
        temp = startNode;
        startNode = endNode;
        endNode = temp;
    }

    range.setStartAfter( startNode );
    range.setEndBefore( endNode );
};

proto._getRangeAndRemoveBookmark = function ( range ) {
    var doc = this._doc,
        start = doc.getElementById( startSelectionId ),
        end = doc.getElementById( endSelectionId );

    if ( start && end ) {
        var startContainer = start.parentNode,
            endContainer = end.parentNode,
            collapsed;

        var _range = {
            startContainer: startContainer,
            endContainer: endContainer,
            startOffset: indexOf.call( startContainer.childNodes, start ),
            endOffset: indexOf.call( endContainer.childNodes, end )
        };

        if ( startContainer === endContainer ) {
            _range.endOffset -= 1;
        }

        detach( start );
        detach( end );

        // Merge any text nodes we split
        mergeInlines( startContainer, _range );
        if ( startContainer !== endContainer ) {
            mergeInlines( endContainer, _range );
        }

        if ( !range ) {
            range = doc.createRange();
        }
        range.setStart( _range.startContainer, _range.startOffset );
        range.setEnd( _range.endContainer, _range.endOffset );
        collapsed = range.collapsed;

        moveRangeBoundariesDownTree( range );
        if ( collapsed ) {
            range.collapse( true );
        }
    }
    return range || null;
};

// --- Undo ---

proto._keyUpDetectChange = function ( event ) {
    var code = event.keyCode;
    // Presume document was changed if:
    // 1. A modifier key (other than shift) wasn't held down
    // 2. The key pressed is not in range 16<=x<=20 (control keys)
    // 3. The key pressed is not in range 33<=x<=45 (navigation keys)
    if ( !event.ctrlKey && !event.metaKey && !event.altKey &&
            ( code < 16 || code > 20 ) &&
            ( code < 33 || code > 45 ) )  {
        this._docWasChanged();
    }
};

proto._docWasChanged = function () {
    if ( canObserveMutations && this._ignoreChange ) {
        this._ignoreChange = false;
        return;
    }
    if ( this._isInUndoState ) {
        this._isInUndoState = false;
        this.fireEvent( 'undoStateChange', {
            canUndo: true,
            canRedo: false
        });
    }
    this.fireEvent( 'input' );
};

// Leaves bookmark
proto._recordUndoState = function ( range ) {
    // Don't record if we're already in an undo state
    if ( !this._isInUndoState ) {
        // Advance pointer to new position
        var undoIndex = this._undoIndex += 1,
            undoStack = this._undoStack;

        // Truncate stack if longer (i.e. if has been previously undone)
        if ( undoIndex < this._undoStackLength) {
            undoStack.length = this._undoStackLength = undoIndex;
        }

        // Write out data
        if ( range ) {
            this._saveRangeToBookmark( range );
        }
        undoStack[ undoIndex ] = this._getHTML();
        this._undoStackLength += 1;
        this._isInUndoState = true;
    }
};

proto.undo = function () {
    // Sanity check: must not be at beginning of the history stack
    if ( this._undoIndex !== 0 || !this._isInUndoState ) {
        // Make sure any changes since last checkpoint are saved.
        this._recordUndoState( this.getSelection() );

        this._undoIndex -= 1;
        this._setHTML( this._undoStack[ this._undoIndex ] );
        var range = this._getRangeAndRemoveBookmark();
        if ( range ) {
            this.setSelection( range );
        }
        this._isInUndoState = true;
        this.fireEvent( 'undoStateChange', {
            canUndo: this._undoIndex !== 0,
            canRedo: true
        });
        this.fireEvent( 'input' );
    }
    return this;
};

proto.redo = function () {
    // Sanity check: must not be at end of stack and must be in an undo
    // state.
    var undoIndex = this._undoIndex,
        undoStackLength = this._undoStackLength;
    if ( undoIndex + 1 < undoStackLength && this._isInUndoState ) {
        this._undoIndex += 1;
        this._setHTML( this._undoStack[ this._undoIndex ] );
        var range = this._getRangeAndRemoveBookmark();
        if ( range ) {
            this.setSelection( range );
        }
        this.fireEvent( 'undoStateChange', {
            canUndo: true,
            canRedo: undoIndex + 2 < undoStackLength
        });
        this.fireEvent( 'input' );
    }
    return this;
};

// --- Inline formatting ---

// Looks for matching tag and attributes, so won't work
// if <strong> instead of <b> etc.
proto.hasFormat = function ( tag, attributes, range ) {
    // 1. Normalise the arguments and get selection
    tag = tag.toUpperCase();
    if ( !attributes ) { attributes = {}; }
    if ( !range && !( range = this.getSelection() ) ) {
        return false;
    }

    // If the common ancestor is inside the tag we require, we definitely
    // have the format.
    var root = range.commonAncestorContainer,
        walker, node;
    if ( getNearest( root, tag, attributes ) ) {
        return true;
    }

    // If common ancestor is a text node and doesn't have the format, we
    // definitely don't have it.
    if ( root.nodeType === TEXT_NODE ) {
        return false;
    }

    // Otherwise, check each text node at least partially contained within
    // the selection and make sure all of them have the format we want.
    walker = new TreeWalker( root, SHOW_TEXT, function ( node ) {
        return isNodeContainedInRange( range, node, true );
    }, false );

    var seenNode = false;
    while ( node = walker.nextNode() ) {
        if ( !getNearest( node, tag, attributes ) ) {
            return false;
        }
        seenNode = true;
    }

    return seenNode;
};

proto._addFormat = function ( tag, attributes, range ) {
    // If the range is collapsed we simply insert the node by wrapping
    // it round the range and focus it.
    var el, walker, startContainer, endContainer, startOffset, endOffset,
        node, needsFormat;

    if ( range.collapsed ) {
        el = fixCursor( this.createElement( tag, attributes ) );
        insertNodeInRange( range, el );
        range.setStart( el.firstChild, el.firstChild.length );
        range.collapse( true );
    }
    // Otherwise we find all the textnodes in the range (splitting
    // partially selected nodes) and if they're not already formatted
    // correctly we wrap them in the appropriate tag.
    else {
        // Create an iterator to walk over all the text nodes under this
        // ancestor which are in the range and not already formatted
        // correctly.
        //
        // In Blink/WebKit, empty blocks may have no text nodes, just a <br>.
        // Therefore we wrap this in the tag as well, as this will then cause it
        // to apply when the user types something in the block, which is
        // presumably what was intended.
        // Nate:  I've tried this out in chrome and firefox and neither seems to need BR tags as children of a format.
        // I have thus removed the inclusion of br nodes in the formatting
        walker = new TreeWalker(
            range.commonAncestorContainer,
            SHOW_TEXT|SHOW_ELEMENT,
            function ( node ) {
                return ( node.nodeType === TEXT_NODE ) &&
                    isNodeContainedInRange( range, node, true );
            },
            false
        );

        // Start at the beginning node of the range and iterate through
        // all the nodes in the range that need formatting.
        startContainer = range.startContainer;
        startOffset = range.startOffset;
        endContainer = range.endContainer;
        endOffset = range.endOffset;

        // Make sure we start with a valid node.
        walker.currentNode = startContainer;
        if ( !walker.filter( startContainer ) ) {
            startContainer = walker.nextNode();
            startOffset = 0;
        }

        // If there are no interesting nodes in the selection, abort
        if ( !startContainer ) {
            return range;
        }

        do {
            node = walker.currentNode;
            needsFormat = !getNearest( node, tag, attributes );
            if ( needsFormat ) {
                // <br> can never be a container node, so must have a text node
                // if node == (end|start)Container
                if ( node === endContainer && node.length > endOffset ) {
                    node.splitText( endOffset );
                }
                if ( node === startContainer && startOffset ) {
                    node = node.splitText( startOffset );
                    if ( endContainer === startContainer ) {
                        endContainer = node;
                        endOffset -= startOffset;
                    }
                    startContainer = node;
                    startOffset = 0;
                }
                el = this.createElement( tag, attributes );
                replaceWith( node, el );
                el.appendChild( node );
            }
        } while ( walker.nextNode() );

        // If we don't finish inside a text node, offset may have changed.
        if ( endContainer.nodeType !== TEXT_NODE ) {
            if ( node.nodeType === TEXT_NODE ) {
                endContainer = node;
                endOffset = node.length;
            } else {
                // If <br>, we must have just wrapped it, so it must have only
                // one child
                endContainer = node.parentNode;
                endOffset = 1;
            }
        }

        // Now set the selection to as it was before
        range = this._createRange(
            startContainer, startOffset, endContainer, endOffset );
    }
    return range;
};

proto._removeFormat = function ( tag, attributes, range, partial ) {
    // Add bookmark
    this._saveRangeToBookmark( range );

    // We need a node in the selection to break the surrounding
    // formatted text.
    var doc = this._doc,
        fixer;
    if ( range.collapsed ) {
        if ( cantFocusEmptyTextNodes ) {
            fixer = doc.createTextNode( ZWS );
            this._didAddZWS();
        } else {
            fixer = doc.createTextNode( '' );
        }
        insertNodeInRange( range, fixer );
    }

    // Find block-level ancestor of selection
    var root = range.commonAncestorContainer;
    while ( isInline( root ) ) {
        root = root.parentNode;
    }

    // Find text nodes inside formatTags that are not in selection and
    // add an extra tag with the same formatting.
    var startContainer = range.startContainer,
        startOffset = range.startOffset,
        endContainer = range.endContainer,
        endOffset = range.endOffset,
        toWrap = [],
        examineNode = function ( node, exemplar ) {
            // If the node is completely contained by the range then
            // we're going to remove all formatting so ignore it.
            if ( isNodeContainedInRange( range, node, false ) ) {
                return;
            }

            var isText = ( node.nodeType === TEXT_NODE ),
                child, next;

            // If not at least partially contained, wrap entire contents
            // in a clone of the tag we're removing and we're done.
            if ( !isNodeContainedInRange( range, node, true ) ) {
                // Ignore bookmarks and empty text nodes
                if ( node.nodeName !== 'INPUT' &&
                        ( !isText || node.data ) ) {
                    toWrap.push([ exemplar, node ]);
                }
                return;
            }

            // Split any partially selected text nodes.
            if ( isText ) {
                if ( node === endContainer && endOffset !== node.length ) {
                    toWrap.push([ exemplar, node.splitText( endOffset ) ]);
                }
                if ( node === startContainer && startOffset ) {
                    node.splitText( startOffset );
                    toWrap.push([ exemplar, node ]);
                }
            }
            // If not a text node, recurse onto all children.
            // Beware, the tree may be rewritten with each call
            // to examineNode, hence find the next sibling first.
            else {
                for ( child = node.firstChild; child; child = next ) {
                    next = child.nextSibling;
                    examineNode( child, exemplar );
                }
            }
        },
        formatTags = Array.prototype.filter.call(
            root.getElementsByTagName( tag ), function ( el ) {
                return isNodeContainedInRange( range, el, true ) &&
                    hasTagAttributes( el, tag, attributes );
            }
        );

    if ( !partial ) {
        formatTags.forEach( function ( node ) {
            examineNode( node, node );
        });
    }

    // Now wrap unselected nodes in the tag
    toWrap.forEach( function ( item ) {
        // [ exemplar, node ] tuple
        var el = item[0].cloneNode( false ),
            node = item[1];
        replaceWith( node, el );
        el.appendChild( node );
    });
    // and remove old formatting tags.
    formatTags.forEach( function ( el ) {
        replaceWith( el, empty( el ) );
    });

    // Merge adjacent inlines:
    this._getRangeAndRemoveBookmark( range );
    if ( fixer ) {
        range.collapse( false );
    }
    var _range = {
        startContainer: range.startContainer,
        startOffset: range.startOffset,
        endContainer: range.endContainer,
        endOffset: range.endOffset
    };
    mergeInlines( root, _range );
    range.setStart( _range.startContainer, _range.startOffset );
    range.setEnd( _range.endContainer, _range.endOffset );

    return range;
};

proto.changeFormat = function ( add, remove, range, partial ) {
    // Normalise the arguments and get selection
    if ( !range && !( range = this.getSelection() ) ) {
        return;
    }

    // Save undo checkpoint
    this._recordUndoState( range );
    this._getRangeAndRemoveBookmark( range );

    if ( remove ) {
        range = this._removeFormat( remove.tag.toUpperCase(),
            remove.attributes || {}, range, partial );
    }
    if ( add ) {
        range = this._addFormat( add.tag.toUpperCase(),
            add.attributes || {}, range );
    }

    this.setSelection( range );
    this._updatePath( range, true );

    // We're not still in an undo state
    if ( !canObserveMutations ) {
        this._docWasChanged();
    }

    return this;
};

// --- Block formatting ---

var tagAfterSplit = {
    DT:  'DD',
    DD:  'DT',
    LI:  'LI'
};

var splitBlock = function ( self, block, node, offset ) {
    var splitTag = tagAfterSplit[ block.nodeName ],
        splitProperties = null,
        nodeAfterSplit = split( node, offset, block.parentNode ),
        config = self._config;

    if ( !splitTag ) {
        splitTag = config.blockTag;
        splitProperties = config.blockAttributes;
    }

    // Make sure the new node is the correct type.
    if ( !hasTagAttributes( nodeAfterSplit, splitTag, splitProperties ) ) {
        block = createElement( nodeAfterSplit.ownerDocument,
            splitTag, splitProperties );
        if ( nodeAfterSplit.dir ) {
            block.dir = nodeAfterSplit.dir;
        }
        replaceWith( nodeAfterSplit, block );
        block.appendChild( empty( nodeAfterSplit ) );
        nodeAfterSplit = block;
    }
    return nodeAfterSplit;
};

proto.forEachBlock = function ( fn, mutates, range ) {
    if ( !range && !( range = this.getSelection() ) ) {
        return this;
    }

    // Save undo checkpoint
    if ( mutates ) {
        this._recordUndoState( range );
        this._getRangeAndRemoveBookmark( range );
    }

    var start = getStartBlockOfRange( range ),
        end = getEndBlockOfRange( range );
    if ( start && end ) {
        do {
            if ( fn( start ) || start === end ) { break; }
        } while ( start = getNextBlock( start ) );
    }

    if ( mutates ) {
        this.setSelection( range );

        // Path may have changed
        this._updatePath( range, true );

        // We're not still in an undo state
        if ( !canObserveMutations ) {
            this._docWasChanged();
        }
    }
    return this;
};

proto.modifyBlocks = function ( modify, range ) {
    if ( !range && !( range = this.getSelection() ) ) {
        return this;
    }

    // 1. Save undo checkpoint and bookmark selection
    if ( this._isInUndoState ) {
        this._saveRangeToBookmark( range );
    } else {
        this._recordUndoState( range );
    }

    // 2. Expand range to block boundaries
    expandRangeToBlockBoundaries( range );
    // 3. Remove range.
    var body = this._body,
        frag;
    moveRangeBoundariesUpTree( range, body );
    frag = extractContentsOfRange( range, body );

    // 4. Modify tree of fragment and reinsert.
    insertNodeInRange( range, modify.call( this, frag ) );
    // return

    // 5. Merge containers at edges
    if ( range.endOffset < range.endContainer.childNodes.length ) {
        mergeContainers( range.endContainer.childNodes[ range.endOffset ] );
    }
    mergeContainers( range.startContainer.childNodes[ range.startOffset ] );

    // 6. Restore selection
    this._getRangeAndRemoveBookmark( range );
    this.setSelection( range );
    this._updatePath( range, true );

    // 7. We're not still in an undo state
    if ( !canObserveMutations ) {
        this._docWasChanged();
    }

    return this;
};

var increaseBlockQuoteLevel = function ( frag ) {
    return this.createElement( 'BLOCKQUOTE',
        this._config.tagAttributes.blockquote, [
            frag
        ]);
};

var decreaseBlockQuoteLevel = function ( frag ) {
    var blockquotes = frag.querySelectorAll( 'blockquote' );
    Array.prototype.filter.call( blockquotes, function ( el ) {
        return !getNearest( el.parentNode, 'BLOCKQUOTE' );
    }).forEach( function ( el ) {
        replaceWith( el, empty( el ) );
    });
    return frag;
};

var removeBlockQuote = function (/* frag */) {
    return this.createDefaultBlock([
        this.createElement( 'INPUT', {
            id: startSelectionId,
            type: 'hidden'
        }),
        this.createElement( 'INPUT', {
            id: endSelectionId,
            type: 'hidden'
        })
    ]);
};

var makeList = function ( self, frag, type ) {
    var walker = getBlockWalker( frag ),
        node, tag, prev, newLi,
        tagAttributes = self._config.tagAttributes,
        listAttrs = tagAttributes[ type.toLowerCase() ],
        listItemAttrs = tagAttributes.li;
    var div = frag.childNodes[0]
    var addedContentEditable = false
    // Nate: We need to do this due to an addition I made to isBlock, which returns false for noneditable nodes.
    // This function is dealing with a frag that has been removed from the editor dom, thus it loses the 
    // contenteditable=true inherited from the editor body.  I temporarily set that here and remove it again
    // at the end of the function once the frag has been re-inserted into the editor.
    if(div && !div.hasAttribute("contenteditable")){
        div.setAttribute("contenteditable", true)
        addedContentEditable = true
    }
    while ( node = walker.nextNode() ) {
        tag = node.parentNode.nodeName;
        if ( tag !== 'LI' ) {
            newLi = self.createElement( 'LI', listItemAttrs );
            if ( node.dir ) {
                newLi.dir = node.dir;
            }

            // Have we replaced the previous block with a new <ul>/<ol>?
            if ( ( prev = node.previousSibling ) &&
                    prev.nodeName === type ) {
                prev.appendChild( newLi );
            }
            // Otherwise, replace this block with the <ul>/<ol>
            else {
                replaceWith(
                    node,
                    self.createElement( type, listAttrs, [
                        newLi
                    ])
                );
            }
            newLi.appendChild( node );
        } else {
            node = node.parentNode.parentNode;
            tag = node.nodeName;
            if ( tag !== type && ( /^[OU]L$/.test( tag ) ) ) {
                replaceWith( node,
                    self.createElement( type, listAttrs, [ empty( node ) ] )
                );
            }
        }
    }
    if(addedContentEditable){
        div.removeAttribute("contenteditable")
    }
};

var makeUnorderedList = function ( frag ) {
    makeList( this, frag, 'UL' );
    return frag;
};

var makeOrderedList = function ( frag ) {
    makeList( this, frag, 'OL' );
    return frag;
};

var removeList = function ( frag ) {
    var lists = frag.querySelectorAll( 'UL, OL' ),
        i, l, ll, list, listFrag, children, child;
    for ( i = 0, l = lists.length; i < l; i += 1 ) {
        list = lists[i];
        listFrag = empty( list );
        children = listFrag.childNodes;
        ll = children.length;
        while ( ll-- ) {
            child = children[ll];
            replaceWith( child, empty( child ) );
        }
        fixContainer( listFrag );
        replaceWith( list, listFrag );
    }
    return frag;
};

var increaseListLevel = function ( frag ) {
    var items = frag.querySelectorAll( 'LI' ),
        i, l, item,
        type, newParent,
        tagAttributes = this._config.tagAttributes,
        listItemAttrs = tagAttributes.li,
        listAttrs;
    for ( i = 0, l = items.length; i < l; i += 1 ) {
        item = items[i];
        if ( !isContainer( item.firstChild ) ) {
            // type => 'UL' or 'OL'
            type = item.parentNode.nodeName;
            newParent = item.previousSibling;
            if ( !newParent || !( newParent = newParent.lastChild ) ||
                    newParent.nodeName !== type ) {
                listAttrs = tagAttributes[ type.toLowerCase() ];
                replaceWith(
                    item,
                    this.createElement( 'LI', listItemAttrs, [
                        newParent = this.createElement( type, listAttrs )
                    ])
                );
            }
            newParent.appendChild( item );
        }
    }
    return frag;
};

var decreaseListLevel = function ( frag ) {
    var items = frag.querySelectorAll( 'LI' );
    Array.prototype.filter.call( items, function ( el ) {
        return !isContainer( el.firstChild );
    }).forEach( function ( item ) {
        var parent = item.parentNode,
            newParent = parent.parentNode,
            first = item.firstChild,
            node = first,
            next;
        if ( item.previousSibling ) {
            parent = split( parent, item, newParent );
        }
        while ( node ) {
            next = node.nextSibling;
            if ( isContainer( node ) ) {
                break;
            }
            newParent.insertBefore( node, parent );
            node = next;
        }
        if ( newParent.nodeName === 'LI' && first.previousSibling ) {
            split( newParent, first, newParent.parentNode );
        }
        while ( item !== frag && !item.childNodes.length ) {
            parent = item.parentNode;
            parent.removeChild( item );
            item = parent;
        }
    }, this );
    fixContainer( frag );
    return frag;
};

proto._ensureBottomLine = function () {
    var body = this._body,
        last = body.lastElementChild;
    if ( !last ||
            last.nodeName !== this._config.blockTag || !isBlock( last ) ) {
        body.appendChild( this.createDefaultBlock() );
    }
};

// --- Keyboard interaction ---

proto.setKeyHandler = function ( key, fn ) {
    this._keyHandlers[ key ] = fn;
    return this;
};

// --- Get/Set data ---

proto._getHTML = function () {
    return this._body.innerHTML;
};

proto._setHTML = function ( html ) {
    var node = this._body;
    node.innerHTML = html;
    do {
        fixCursor( node );
    } while ( node = getNextBlock( node ) );
    this._ignoreChange = true;
};

/*
options = 
{
    withBookMark: 1, //will include tags for cursor position
    stripEndBrs: 1, //remove BRs from the end of block elements
    cleanContentEditable: 1, //remove contentEditable <ZWNBS><Z> tags
}

*/

proto.getHTML = function ( options ) {
    if(!options){
        options = {}
    }
    var brs = [],
        node, fixer, html, l, range;
    var withBookMark = options["withBookMark"]
    var root = this._doc.body

    if(options["stripEndBrs"]){
        removeBrAtEndOfAllLines(root)
    }
    if(options["cleanContentEditable"]){
        removeAllZNodes(root)
    }
    if ( withBookMark && ( range = this.getSelection() ) ) {
        this._saveRangeToBookmark( range );
    }
    if ( useTextFixer ) {
        node = this._body;
        while ( node = getNextBlock( node ) ) {
            if ( !node.textContent && !node.querySelector( 'BR' ) ) {
                fixer = this.createElement( 'BR' );
                node.appendChild( fixer );
                brs.push( fixer );
            }
        }
    }
    html = this._getHTML().replace( /\u200B/g, '' );
    if ( useTextFixer ) {
        l = brs.length;
        while ( l-- ) {
            detach( brs[l] );
        }
    }
    if ( range ) {
        this._getRangeAndRemoveBookmark( range );
    }
    if(options["stripEndBrs"]){
        ensureBrAtEndOfAllLines(root)
    }
    if(options["cleanContentEditable"]){
        ensurePreZNodesForContentEditable(root)
    }
    return html;
};

proto.setHTML = function ( html ) {
    var frag = this._doc.createDocumentFragment(),
        div = this.createElement( 'DIV' ),
        child;

    // Parse HTML into DOM tree
    div.innerHTML = html;
    frag.appendChild( empty( div ) );

    cleanTree( frag );
    cleanupBRs( frag );

    fixContainer( frag );

    // Fix cursor
    var node = frag;
    while ( node = getNextBlock( node ) ) {
        fixCursor( node );
    }

    // Don't fire an input event
    this._ignoreChange = true;

    // Remove existing body children
    var body = this._body;
    while ( child = body.lastChild ) {
        body.removeChild( child );
    }

    // And insert new content
    body.appendChild( frag );
    fixCursor( body );

    // Reset the undo stack
    this._undoIndex = -1;
    this._undoStack.length = 0;
    this._undoStackLength = 0;
    this._isInUndoState = false;

    // Record undo state
    var range = this._getRangeAndRemoveBookmark() ||
        this._createRange( body.firstChild, 0 );
    this._recordUndoState( range );
    this._getRangeAndRemoveBookmark( range );
    // IE will also set focus when selecting text so don't use
    // setSelection. Instead, just store it in lastSelection, so if
    // anything calls getSelection before first focus, we have a range
    // to return.
    if ( losesSelectionOnBlur ) {
        this._lastSelection = range;
    } else {
        this.setSelection( range );
    }
    this._updatePath( range, true );

    removeTrailingZWS(this._body)
    ensurePreZNodesForContentEditable( this._body )
    return this;
};

proto.insertElement = function ( el, range ) {
    if ( !range ) { range = this.getSelection(); }
    range.collapse( true );
    if ( isInline( el ) ) {
        insertNodeInRange( range, el );
        range.setStartAfter( el );
    } else {
        // Get containing block node.
        var body = this._body,
            splitNode = getStartBlockOfRange( range ) || body,
            parent, nodeAfterSplit;
        // While at end of container node, move up DOM tree.
        while ( splitNode !== body && !splitNode.nextSibling ) {
            splitNode = splitNode.parentNode;
        }
        // If in the middle of a container node, split up to body.
        if ( splitNode !== body ) {
            parent = splitNode.parentNode;
            nodeAfterSplit = split( parent, splitNode.nextSibling, body );
        }
        if ( nodeAfterSplit ) {
            body.insertBefore( el, nodeAfterSplit );
        } else {
            body.appendChild( el );
            // Insert blank line below block.
            nodeAfterSplit = this.createDefaultBlock();
            body.appendChild( nodeAfterSplit );
        }
        range.setStart( nodeAfterSplit, 0 );
        range.setEnd( nodeAfterSplit, 0 );
        moveRangeBoundariesDownTree( range );
    }
    this.focus();
    this.setSelection( range );
    this._updatePath( range );
    return this;
};

proto.insertImage = function ( src, attributes ) {
    var img = this.createElement( 'IMG', mergeObjects({
        src: src
    }, attributes ));
    this.insertElement( img );
    return img;
};

var linkRegExp = /\b((?:(?:ht|f)tps?:\/\/|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,}\/)(?:[^\s()<>]+|\([^\s()<>]+\))+(?:\((?:[^\s()<>]+|(?:\([^\s()<>]+\)))*\)|[^\s`!()\[\]{};:'".,<>?«»“”‘’]))|([\w\-.%+]+@(?:[\w\-]+\.)+[A-Z]{2,}\b)/i;

var addLinks = function ( frag ) {
    var doc = frag.ownerDocument,
        walker = new TreeWalker( frag, SHOW_TEXT,
                function ( node ) {
            return !getNearest( node, 'A' );
        }, false ),
        node, data, parent, match, index, endIndex, child;
    while ( node = walker.nextNode() ) {
        data = node.data;
        parent = node.parentNode;
        while ( match = linkRegExp.exec( data ) ) {
            index = match.index;
            endIndex = index + match[0].length;
            if ( index ) {
                child = doc.createTextNode( data.slice( 0, index ) );
                parent.insertBefore( child, node );
            }
            child = doc.createElement( 'A' );
            child.textContent = data.slice( index, endIndex );
            child.href = match[1] ?
                /^(?:ht|f)tps?:/.test( match[1] ) ?
                    match[1] :
                    'http://' + match[1] :
                'mailto:' + match[2];
            parent.insertBefore( child, node );
            node.data = data = data.slice( endIndex );
        }
    }
};

// Insert HTML at the cursor location. If the selection is not collapsed
// insertTreeFragmentIntoRange will delete the selection so that it is replaced
// by the html being inserted.
proto.insertHTML = function ( html, isPaste ) {
    console.info("INSERTHTML")
    var range = this.getSelection(),
        frag = this._doc.createDocumentFragment(),
        div = this.createElement( 'DIV' );

    // Parse HTML into DOM tree
    div.innerHTML = html;
    frag.appendChild( empty( div ) );
    // return

    // Record undo checkpoint
    this._recordUndoState( range );
    this._getRangeAndRemoveBookmark( range );

    try {
        var node = frag;
        var event = {
            fragment: frag,
            preventDefault: function () {
                this.defaultPrevented = true;
            },
            defaultPrevented: false
        };

        addLinks( frag );
        cleanTree( frag );
        collapseSimpleSpans( frag )
        mergeInlines( frag )
        cleanupBRs( frag );
        removeEmptyInlines( frag );
        frag.normalize();
        ensurePreZNodesForContentEditable(frag)
        ensureBrAtEndOfAllLines(frag)
        //NATE: This is a clear spot to do something of the sort:
        // registeredFilters.each(function(filter){filter(frag)})
        
        while ( node = getNextBlock( node ) ) {
            fixCursor( node );
        }

        if ( isPaste ) {
            this.fireEvent( 'willPaste', event );
        }

        if ( !event.defaultPrevented ) {
            insertTreeFragmentIntoRange( range, event.fragment );
            if ( !canObserveMutations ) {
                this._docWasChanged();
            }
            range.collapse( false );
            this._ensureBottomLine();
        }

        this.setSelection( range );
        this._updatePath( range, true );
    } catch ( error ) {
        this.didError( error );
    }
    return this;
};

proto.insertPlainText = function ( plainText, isPaste ) {
    var lines = plainText.split( '\n' ),
        i, l;
    for ( i = 1, l = lines.length - 1; i < l; i += 1 ) {
        lines[i] = '<DIV>' +
            lines[i].split( '&' ).join( '&amp;' )
                    .split( '<' ).join( '&lt;'  )
                    .split( '>' ).join( '&gt;'  )
                    .replace( / (?= )/g, '&nbsp;' ) +
        '</DIV>';
    }
    return this.insertHTML( lines.join( '' ), isPaste );
};

// --- Formatting ---

var command = function ( method, arg, arg2 ) {
    return function () {
        this[ method ]( arg, arg2 );
        return this.focus();
    };
};

proto.addStyles = function ( styles ) {
    if ( styles ) {
        var head = this._doc.documentElement.firstChild,
            style = this.createElement( 'STYLE', {
                type: 'text/css'
            });
        style.appendChild( this._doc.createTextNode( styles ) );
        head.appendChild( style );
    }
    return this;
};

proto.bold = command( 'changeFormat', { tag: 'B' } );
proto.italic = command( 'changeFormat', { tag: 'I' } );
proto.underline = command( 'changeFormat', { tag: 'U' } );
proto.strikethrough = command( 'changeFormat', { tag: 'S' } );
proto.subscript = command( 'changeFormat', { tag: 'SUB' }, { tag: 'SUP' } );
proto.superscript = command( 'changeFormat', { tag: 'SUP' }, { tag: 'SUB' } );

proto.removeBold = command( 'changeFormat', null, { tag: 'B' } );
proto.removeItalic = command( 'changeFormat', null, { tag: 'I' } );
proto.removeUnderline = command( 'changeFormat', null, { tag: 'U' } );
proto.removeStrikethrough = command( 'changeFormat', null, { tag: 'S' } );
proto.removeSubscript = command( 'changeFormat', null, { tag: 'SUB' } );
proto.removeSuperscript = command( 'changeFormat', null, { tag: 'SUP' } );

proto.makeLink = function ( url, attributes ) {
    var range = this.getSelection();
    if ( range.collapsed ) {
        var protocolEnd = url.indexOf( ':' ) + 1;
        if ( protocolEnd ) {
            while ( url[ protocolEnd ] === '/' ) { protocolEnd += 1; }
        }
        insertNodeInRange(
            range,
            this._doc.createTextNode( url.slice( protocolEnd ) )
        );
    }

    if ( !attributes ) {
        attributes = {};
    }
    attributes.href = url;

    this.changeFormat({
        tag: 'A',
        attributes: attributes
    }, {
        tag: 'A'
    }, range );
    return this.focus();
};
proto.removeLink = function () {
    this.changeFormat( null, {
        tag: 'A'
    }, this.getSelection(), true );
    return this.focus();
};

proto.setFontFace = function ( name ) {
    this.changeFormat({
        tag: 'SPAN',
        attributes: {
            'class': 'font',
            style: 'font-family: ' + name + ', sans-serif;'
        }
    }, {
        tag: 'SPAN',
        attributes: { 'class': 'font' }
    });
    return this.focus();
};
proto.setFontSize = function ( size ) {
    this.changeFormat({
        tag: 'SPAN',
        attributes: {
            'class': 'size',
            style: 'font-size: ' +
                ( typeof size === 'number' ? size + 'px' : size )
        }
    }, {
        tag: 'SPAN',
        attributes: { 'class': 'size' }
    });
    return this.focus();
};

proto.setTextColour = function ( colour ) {
    this.changeFormat({
        tag: 'SPAN',
        attributes: {
            'class': 'colour',
            style: 'color: ' + colour
        }
    }, {
        tag: 'SPAN',
        attributes: { 'class': 'colour' }
    });
    return this.focus();
};

proto.setHighlightColour = function ( colour ) {
    this.changeFormat({
        tag: 'SPAN',
        attributes: {
            'class': 'highlight',
            style: 'background-color: ' + colour
        }
    }, {
        tag: 'SPAN',
        attributes: { 'class': 'highlight' }
    });
    return this.focus();
};

proto.setTextAlignment = function ( alignment ) {
    this.forEachBlock( function ( block ) {
        block.className = ( block.className
            .split( /\s+/ )
            .filter( function ( klass ) {
                return !( /align/.test( klass ) );
            })
            .join( ' ' ) +
            ' align-' + alignment ).trim();
        block.style.textAlign = alignment;
    }, true );
    return this.focus();
};

proto.setTextDirection = function ( direction ) {
    this.forEachBlock( function ( block ) {
        block.dir = direction;
    }, true );
    return this.focus();
};

function removeFormatting ( self, root, clean ) {
    var node, next;
    for ( node = root.firstChild; node; node = next ) {
        next = node.nextSibling;
        if ( isInline( node ) ) {
            if ( node.nodeType === TEXT_NODE || isLeaf( node ) ) {
                clean.appendChild( node );
                continue;
            }
        } else if ( isBlock( node ) ) {
            clean.appendChild( self.createDefaultBlock([
                removeFormatting(
                    self, node, self._doc.createDocumentFragment() )
            ]));
            continue;
        }
        removeFormatting( self, node, clean );
    }
    return clean;
}

proto.removeAllFormatting = function ( range ) {
    if ( !range && !( range = this.getSelection() ) || range.collapsed ) {
        return this;
    }

    var stopNode = range.commonAncestorContainer;
    while ( stopNode && !isBlock( stopNode ) ) {
        stopNode = stopNode.parentNode;
    }
    if ( !stopNode ) {
        expandRangeToBlockBoundaries( range );
        stopNode = this._body;
    }
    if ( stopNode.nodeType === TEXT_NODE ) {
        return this;
    }

    // Record undo point
    this._recordUndoState( range );
    this._getRangeAndRemoveBookmark( range );


    // Avoid splitting where we're already at edges.
    moveRangeBoundariesUpTree( range, stopNode );

    // Split the selection up to the block, or if whole selection in same
    // block, expand range boundaries to ends of block and split up to body.
    var doc = stopNode.ownerDocument;
    var startContainer = range.startContainer;
    var startOffset = range.startOffset;
    var endContainer = range.endContainer;
    var endOffset = range.endOffset;

    // Split end point first to avoid problems when end and start
    // in same container.
    var formattedNodes = doc.createDocumentFragment();
    var cleanNodes = doc.createDocumentFragment();
    var nodeAfterSplit = split( endContainer, endOffset, stopNode );
    var nodeInSplit = split( startContainer, startOffset, stopNode );
    var nextNode, _range, childNodes;

    // Then replace contents in split with a cleaned version of the same:
    // blocks become default blocks, text and leaf nodes survive, everything
    // else is obliterated.
    while ( nodeInSplit !== nodeAfterSplit ) {
        nextNode = nodeInSplit.nextSibling;
        formattedNodes.appendChild( nodeInSplit );
        nodeInSplit = nextNode;
    }
    removeFormatting( this, formattedNodes, cleanNodes );
    cleanNodes.normalize();
    nodeInSplit = cleanNodes.firstChild;
    nextNode = cleanNodes.lastChild;

    // Restore selection
    childNodes = stopNode.childNodes;
    if ( nodeInSplit ) {
        stopNode.insertBefore( cleanNodes, nodeAfterSplit );
        startOffset = indexOf.call( childNodes, nodeInSplit );
        endOffset = indexOf.call( childNodes, nextNode ) + 1;
    } else {
        startOffset = indexOf.call( childNodes, nodeAfterSplit );
        endOffset = startOffset;
    }

    // Merge text nodes at edges, if possible
    _range = {
        startContainer: stopNode,
        startOffset: startOffset,
        endContainer: stopNode,
        endOffset: endOffset
    };
    mergeInlines( stopNode, _range );
    range.setStart( _range.startContainer, _range.startOffset );
    range.setEnd( _range.endContainer, _range.endOffset );

    // And move back down the tree
    moveRangeBoundariesDownTree( range );

    this.setSelection( range );
    this._updatePath( range, true );

    return this.focus();
};

proto.increaseQuoteLevel = command( 'modifyBlocks', increaseBlockQuoteLevel );
proto.decreaseQuoteLevel = command( 'modifyBlocks', decreaseBlockQuoteLevel );

proto.makeUnorderedList = command( 'modifyBlocks', makeUnorderedList );
proto.makeOrderedList = command( 'modifyBlocks', makeOrderedList );
proto.removeList = command( 'modifyBlocks', removeList );

proto.increaseListLevel = command( 'modifyBlocks', increaseListLevel );
proto.decreaseListLevel = command( 'modifyBlocks', decreaseListLevel );

proto.insertNodeInRange = insertNodeInRange;

if ( typeof exports === 'object' ) {
    module.exports = Squire;
} else if ( typeof define === 'function' && define.amd ) {
    define( function () {
        return Squire;
    });
} else {
    win.Squire = Squire;

    if ( top !== win &&
            doc.documentElement.getAttribute( 'data-squireinit' ) === 'true' ) {
        win.editor = new Squire( doc );
        if ( win.onEditorLoad ) {
            win.onEditorLoad( win.editor );
            win.onEditorLoad = null;
        }
    }
}

var console = window.console
Squire._debug = true
Squire.debug = function(bool){
    if(bool !== undefined){
        Squire._debug = bool
    }
    if(Squire._debug){
        window.console.info("enabling Squire console")
        console = window.console
    }
    else{
        window.console.info("disabling Squire console")
        console = {info: function(){return ''}}

    }
    return Squire._debug
}


}( document ) );
// (function(){Squire.debug()})()
