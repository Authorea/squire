/* Copyright © 2011-2015 by Neil Jenkins. MIT Licensed. */

( function ( doc, undefined ) {

"use strict";

var DOCUMENT_POSITION_PRECEDING = 2; // Node.DOCUMENT_POSITION_PRECEDING
var ELEMENT_NODE = 1;                // Node.ELEMENT_NODE;
var TEXT_NODE = 3;                   // Node.TEXT_NODE;
var DOCUMENT_NODE = 9;               // Node.DOCUMENT_NODE;
var DOCUMENT_FRAGMENT_NODE = 11;     // Node.DOCUMENT_FRAGMENT_NODE;
var SHOW_ELEMENT = 1;                // NodeFilter.SHOW_ELEMENT;
var SHOW_TEXT = 4;                   // NodeFilter.SHOW_TEXT;

var START_TO_START = 0; // Range.START_TO_START
var START_TO_END = 1;   // Range.START_TO_END
var END_TO_END = 2;     // Range.END_TO_END
var END_TO_START = 3;   // Range.END_TO_START

var HIGHLIGHT_CLASS = 'highlight';
var COLOUR_CLASS = 'colour';
var FONT_FAMILY_CLASS = 'font';
var FONT_SIZE_CLASS = 'size';

var ZWS       = '\u200B';
var NBSP      = '\u00A0'
var TAB       = NBSP + NBSP + NBSP + NBSP
var TAB_SIZE  = 4

var win = doc.defaultView;

var ua = navigator.userAgent;

var isIOS = /iP(?:ad|hone|od)/.test( ua );
var isMac = /Mac OS X/.test( ua );

var isAndroid = /Android/.test( ua );

var isGecko = /Gecko\//.test( ua );
var isIElt11 = /Trident\/[456]\./.test( ua );
var isPresto = !!win.opera;
var isEdge = /Edge\//.test( ua );
var isWebKit = !isEdge && /WebKit\//.test( ua );

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
// NATE: We now assume the breakoutFunction can take root as second argument
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
           if(breakoutFunction && breakoutFunction(node, root)){
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

// NATE: the breakoutFunction takes (node, root)
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
           if(breakoutFunction && breakoutFunction(node, root)){
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

var inlineNodeNames  = /^(?:#text|A(?:BBR|CRONYM)?|B(?:R|D[IO])?|C(?:ITE|ODE)|D(?:ATA|EL|FN)|EM|FONT|HR|I(?:FRAME|MG|NPUT|NS)?|KBD|Q|R(?:P|T|UBY)|S(?:AMP|MALL|PAN|TR(?:IKE|ONG)|U[BP])?|TABLE|TD|TR|TBODY|U|VAR|WBR|Z)$/;

var leafNodeNames = {
    BR: 1,
    HR: 1,
    IFRAME: 1,
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

function isLeaf ( node, root ) {
    //NATE: TODO: replace all occurrences of isLeaf(node) with isLeaf(node, root)
    if (typeof root === 'undefined'){
      // console.warn("UNDEFINED ROOT IN isLeaf")
      // console.warn(node)
      // console.warn(console.trace())
      root = document.body
    }
    return (node.nodeType === ELEMENT_NODE &&
        (!!leafNodeNames[ node.nodeName ]) || notEditable(node, root));
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

function notEditable( node, root ){
  //NATE: TODO: replace all occurrences of notEditable(node) with notEditable(node, root)
  if(typeof root === 'undefined'){
    // console.warn("UNDEFINED ROOT IN notEditable")
    root = document.body
  }
  if($(node).hasClass('not-editable')){
    return true
  }
  if(node === root){
    return false
  }
  if(!node){
      return false
  }
  else{
      return(notEditable(node.parentNode, root))
  }
}

function isText( node ){
    if(!node){
        return false
    }
    return (node.nodeType === TEXT_NODE)
}

function getBlockWalker ( node, root ) {
    var walker = new TreeWalker( root, SHOW_ELEMENT, function (node) {
      return(isBlock(node)  && !notEditable(node))
    });
    walker.currentNode = node;
    return walker;
}
function getPreviousBlock ( node, root ) {
    node = getBlockWalker( node, root ).previousNode();
    return node !== root ? node : null;
}
function getNextBlock ( node, root ) {
    node = getBlockWalker( node, root ).nextNode();
    return node !== root ? node : null;
}

function areAlike ( node, node2, root ) {
    return !isLeaf( node, root ) && (
        node.nodeType === node2.nodeType &&
        node.nodeName === node2.nodeName &&
        node.nodeName !== 'A' &&
        node.className === node2.className &&
        ( ( !node.style && !node2.style ) ||
          node.style.cssText === node2.style.cssText )
    );
}
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
function getNearest ( node, root, tag, attributes ) {
    while ( node && node !== root ) {
        if ( hasTagAttributes( node, tag, attributes ) ) {
            return node;
        }
        node = node.parentNode;
    }
    return null;
}
function isOrContains ( parent, node ) {
    while ( node ) {
        if ( node === parent ) {
            return true;
        }
        node = node.parentNode;
    }
    return false;
}

function getPath ( node, root, options ) {
    if(!options) {
      options = {}
    }
    var path = '';
    var id, className, classNames, dir;
    if ( node && node !== root ) {
        path = getPath( node.parentNode, root );
        if ( node.nodeType === ELEMENT_NODE ) {
            path += ( path ? '>' : '' ) + node.nodeName;
            if (options['include_attributes']){
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
              if ( classNames ) {
                  if ( indexOf.call( classNames, HIGHLIGHT_CLASS ) > -1 ) {
                      path += '[backgroundColor=' +
                          node.style.backgroundColor.replace( / /g,'' ) + ']';
                  }
                  if ( indexOf.call( classNames, COLOUR_CLASS ) > -1 ) {
                      path += '[color=' +
                          node.style.color.replace( / /g,'' ) + ']';
                  }
                  if ( indexOf.call( classNames, FONT_FAMILY_CLASS ) > -1 ) {
                      path += '[fontFamily=' +
                          node.style.fontFamily.replace( / /g,'' ) + ']';
                  }
                  if ( indexOf.call( classNames, FONT_SIZE_CLASS ) > -1 ) {
                      path += '[fontSize=' + node.style.fontSize + ']';
                  }
              }
            }
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

function fixCursor ( node, root ) {
    // In Webkit and Gecko, block level elements are collapsed and
    // unfocussable if they have no content. To remedy this, a <BR> must be
    // inserted. In Opera and IE, we just need a textnode in order for the
    // cursor to appear.
    var doc = node.ownerDocument,
        originalNode = node,
        fixer, child;

    if ( node === root ) {
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

    if ( node.nodeType === TEXT_NODE ) {
        return originalNode;
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
        try {
            node.appendChild( fixer );
        } catch ( error ) {
            getSquireInstance( doc ).didError({
                name: 'Squire: fixCursor – ' + error,
                message: 'Parent: ' + node.nodeName + '/' + node.innerHTML +
                    ' appendChild: ' + fixer.nodeName
            });
        }
    }

    return originalNode;
}

// Recursively examine container nodes and wrap any inline children.
function fixContainer ( container, root ) {
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
            fixCursor( wrapper, root );
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
            fixContainer( child, root );
        }
    }
    if ( wrapper ) {
        container.appendChild( fixCursor( wrapper, root ) );
    }
    return container;
}

function split ( node, offset, stopNode, root ) {
    var nodeType = node.nodeType,
        parent, clone, next;
    if ( nodeType === TEXT_NODE && node !== stopNode ) {
        return split(
            node.parentNode, node.splitText( offset ), stopNode, root );
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
        if ( node.nodeName === 'OL' &&
                getNearest( node, root, 'BLOCKQUOTE' ) ) {
            clone.start = ( +node.start || 1 ) + node.childNodes.length - 1;
        }

        // DO NOT NORMALISE. This may undo the fixCursor() call
        // of a node lower down the tree!

        // We need something in the element in order for the cursor to appear.
        fixCursor( node, root );
        fixCursor( clone, root );

        // Inject clone after original node
        if ( next = node.nextSibling ) {
            parent.insertBefore( clone, next );
        } else {
            parent.appendChild( clone );
        }

        // Keep on splitting up the tree
        return split( parent, clone, stopNode, root );
    }
    return offset;
}

function _mergeInlines ( node, fakeRange, root ) {
    var children = node.childNodes,
        l = children.length,
        frags = [],
        child, prev, len;
    while ( l-- ) {
        child = children[l];
        prev = l && children[ l - 1 ];
        if ( l && isInline( child ) && areAlike( child, prev, root ) &&
                !leafNodeNames[ child.nodeName ] ) {
            if ( fakeRange.startContainer === child ) {
                fakeRange.startContainer = prev;
                fakeRange.startOffset += getLength( prev );
            }
            if ( fakeRange.endContainer === child ) {
                fakeRange.endContainer = prev;
                fakeRange.endOffset += getLength( prev );
            }
            if ( fakeRange.startContainer === node ) {
                if ( fakeRange.startOffset > l ) {
                    fakeRange.startOffset -= 1;
                }
                else if ( fakeRange.startOffset === l ) {
                    fakeRange.startContainer = prev;
                    fakeRange.startOffset = getLength( prev );
                }
            }
            if ( fakeRange.endContainer === node ) {
                if ( fakeRange.endOffset > l ) {
                    fakeRange.endOffset -= 1;
                }
                else if ( fakeRange.endOffset === l ) {
                    fakeRange.endContainer = prev;
                    fakeRange.endOffset = getLength( prev );
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
            _mergeInlines( child, fakeRange, root );
        }
    }
}

function mergeInlines ( node, range, root ) {
    if ( node.nodeType === TEXT_NODE ) {
        node = node.parentNode;
    }
    if ( node.nodeType === ELEMENT_NODE ) {
        var fakeRange = {
            startContainer: range.startContainer,
            startOffset: range.startOffset,
            endContainer: range.endContainer,
            endOffset: range.endOffset
        };
        _mergeInlines( node, fakeRange, root );
        range.setStart( fakeRange.startContainer, fakeRange.startOffset );
        range.setEnd( fakeRange.endContainer, fakeRange.endOffset );
    }
}

function mergeWithBlock ( block, next, range ) {
    var container = next,
        last, offset;
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

    block.appendChild( empty( next ) );

    range.setStart( block, offset );
    range.collapse( true );
    mergeInlines( block, range );

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

function mergeContainers ( node, root ) {
    var prev = node.previousSibling,
        first = node.firstChild,
        doc = node.ownerDocument,
        isListItem = ( node.nodeName === 'LI' ),
        needsFix, block;

    // Do not merge LIs, unless it only contains a UL
    if ( isListItem && ( !first || !/^[OU]L$/.test( first.nodeName ) ) ) {
        return;
    }

    if ( prev && areAlike( prev, node, root ) ) {
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
            fixContainer( prev, root );
        }
        if ( first ) {
            mergeContainers( first, root );
        }
    } else if ( isListItem ) {
        prev = createElement( doc, 'DIV' );
        node.insertBefore( prev, first );
        fixCursor( prev, root );
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

var insertNodeInRange = function ( range, node, root ) {
    if (!root && !(this && this._root)) {
      throw new Error('No document root!')
    }
  
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

    if ( startOffset === childCount ) {
        startContainer.appendChild( node );
    } else {
        startContainer.insertBefore( node, children[ startOffset ] );
    }

    if ( startContainer === endContainer ) {
        endOffset += children.length - childCount;
    }

    range.setStart( startContainer, startOffset );
    range.setEnd( endContainer, endOffset );
    ensureBrAtEndOfAllLines( root || this._root )
};

var extractContentsOfRange = function ( range, common, root ) {
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

    var endNode = split( endContainer, endOffset, common, root ),
        startNode = split( startContainer, startOffset, common, root ),
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

    fixCursor( common, root );

    return frag;
};

var deleteContentsOfRange = function ( range, root ) {
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
    var frag = extractContentsOfRange( range, null, root );

    // Move boundaries back down tree so that they are inside the blocks.
    // If we don't do this, the range may be collapsed to a point between
    // two blocks, so get(Start|End)BlockOfRange will return null.
    moveRangeBoundariesDownTree( range );

    // If we split into two different blocks, merge the blocks.
    startBlock = getStartBlockOfRange( range, root );
    if ( needsMerge ) {
        endBlock = getEndBlockOfRange( range, root );
        if ( startBlock && endBlock && startBlock !== endBlock ) {
            mergeWithBlock( startBlock, endBlock, range );
        }
    }

    // Ensure block has necessary children
    if ( startBlock ) {
        fixCursor( startBlock, root );
    }

    // Ensure root has a block-level element in it.
    var child = root.firstChild;
    if ( !child || child.nodeName === 'BR' ) {
        fixCursor( root, root );
        range.selectNodeContents( root.firstChild );
    } else {
        range.collapse( false );
    }
    return frag;
};

// ---

var insertTreeFragmentIntoRange = function ( range, frag, root ) {
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
        deleteContentsOfRange( range, root );
    }

    // Move range down into text nodes
    moveRangeBoundariesDownTree( range );

    if ( allInline ) {
        // If inline, just insert at the current position.
        insertNodeInRange( range, frag, root );
        if ( range.startContainer !== range.endContainer ) {
            mergeInlines( range.endContainer, range );
        }
        mergeInlines( range.startContainer, range );
        range.collapse( false );
    } else {
        // Otherwise...
        // 1. Split up to blockquote (if a parent) or root
        var splitPoint = range.startContainer,
            nodeAfterSplit = split(
                splitPoint,
                range.startOffset,
                getNearest( splitPoint.parentNode, root, 'BLOCKQUOTE' ) || root,
                root
            ),
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
        while ( node = getNextBlock( node, root ) ) {
            fixCursor( node, root );
        }
        parent.insertBefore( frag, nodeAfterSplit );

        // 4. Remove empty nodes created either side of split, then
        // merge containers at the edges.
        next = nodeBeforeSplit.nextSibling;
        node = getPreviousBlock( next, root );
        if ( node && !/\S/.test( node.textContent ) ) {
            do {
                parent = node.parentNode;
                parent.removeChild( node );
                node = parent;
            } while ( node && !node.lastChild && node !== root );
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
            mergeContainers( next, root );
        }

        prev = nodeAfterSplit.previousSibling;
        node = isBlock( nodeAfterSplit ) ?
            nodeAfterSplit : getNextBlock( nodeAfterSplit, root );
        if ( node && !/\S/.test( node.textContent ) ) {
            do {
                parent = node.parentNode;
                parent.removeChild( node );
                node = parent;
            } while ( node && !node.lastChild && node !== root );
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
            mergeContainers( nodeAfterSplit, root );
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
        return
    }
    // This loop goes down and to the left of the tree
    while ( startContainer.nodeType !== TEXT_NODE ) {
        child = startContainer.childNodes[ startOffset ];
        if ( !child || isLeaf( child )) {
            break;
        }
        if (  notEditable( child ) ){
            break;
        }
        startContainer = child;
        startOffset = 0;
    }
    // If the endOffset is nonzero, this goes down and to the right of the tree starting at the node just before the end offset
    if ( endOffset ) {
        while ( endContainer.nodeType !== TEXT_NODE ) {
            child = endContainer.childNodes[ endOffset - 1 ];
            if ( !child || isLeaf( child ) ) {
                break;
            }
            if (  notEditable( child ) ){
                break;
            }
            endContainer = child;
            endOffset = getLength( endContainer );
        }
    } else {
        while ( endContainer.nodeType !== TEXT_NODE ) {
            child = endContainer.firstChild;
            if ( !child || isLeaf( child ) ) {
                break;
            }
            if (  notEditable( child ) ){
                break;
            }
            endContainer = child;
        }
    }

    // If collapsed, this algorithm finds the nearest text node positions
    // *outside* the range rather than inside, but also it flips which is
    // assigned to which.
    if ( range.collapsed ) {
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

var moveNodeOutOfNotEditable = function( node, nodeOffset ){
    var startContainer = node
    var moveRight = false
    var nextSibling
    var currentParent = startContainer.parentNode
    var newParent     = currentParent
    var textLength, startOffset, offset

    if(startContainer.nodeType === TEXT_NODE){
        textLength = startContainer.data.length
        // if we are for some reason, likely an up or down arrow, finding ourselves in the middle of a
        // text area that isn't editable, we need to decide if we should be in front of that element
        // or to the right of it.  At the moment this will only work for a single text element in a series
        // of non-editable structures, but it can be extended to work for all cases if necessary.
        if(nodeOffset > textLength/2){
            moveRight = true
        }
    }
    else{
      currentParent = startContainer.parentNode
      newParent = currentParent
    }
    while(notEditable(newParent)){
        currentParent = newParent
        if(moveRight){
            if(nextSibling = currentParent.nextSibling){
                currentParent = nextSibling
            }
        }
        newParent = currentParent.parentNode
        startOffset = indexOf.call( newParent.childNodes, currentParent );
    }
    if(newParent !== currentParent){
        offset = indexOf.call( newParent.childNodes, currentParent )
        return([newParent, offset])
    }
    else{
      return([node, nodeOffset])
    }

}
window.moveNodeOutOfNotEditable = moveNodeOutOfNotEditable

// Nate: This has no root argument, but I would think it needs to terminate at
// the root node if nothing is found
var moveRangeOutOfNotEditable = function( range ){
  var sc = range.startContainer
  var so = range.startOffset
  var ec = range.endContainer
  var eo = range.endOffset
  var newStart = moveNodeOutOfNotEditable(sc, so)
  var newEnd   = moveNodeOutOfNotEditable(ec, eo)
  range.setStart(newStart[0], newStart[1])
  range.setEnd(newEnd[0], newEnd[1])
}
window.moveRangeOutOfNotEditable = moveRangeOutOfNotEditable

// Returns the first block at least partially contained by the range,
// or null if no block is contained by the range.
var getStartBlockOfRange = function ( range, root ) {
    var container = range.startContainer,
        block;

    // If inline, get the containing block.
    if ( isInline( container ) ) {
        block = getPreviousBlock( container, root );
    } else if ( isBlock( container ) ) {
        block = container;
    } else {
        block = getNodeBefore( container, range.startOffset );
        block = getNextBlock( block, root );
    }
    // Check the block actually intersects the range
    return block && isNodeContainedInRange( range, block, true ) ? block : null;
};
window.gsbor = getStartBlockOfRange

// Returns the last block at least partially contained by the range,
// or null if no block is contained by the range.
var getEndBlockOfRange = function ( range, root ) {
    var container = range.endContainer,
        block, child;

    // If inline, get the containing block.
    if ( isInline( container ) ) {
        block = getPreviousBlock( container, root );
    } else if ( isBlock( container ) ) {
        block = container;
    } else {
        block = getNodeAfter( container, range.endOffset );
        if ( !block || !isOrContains( root, block ) ) {
            block = root;
            while ( child = block.lastChild ) {
                block = child;
            }
        }
        block = getPreviousBlock( block, root );
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

var rangeDoesStartAtBlockBoundary = function ( range, root ) {
    var startContainer = range.startContainer;
    var startOffset = range.startOffset;
    var nodeAfterCursor;

    // If in the middle or end of a text node, we're not at the boundary.
    contentWalker.root = null;
    if ( startContainer.nodeType === TEXT_NODE ) {
        if ( startOffset ) {
            return false;
        }
        nodeAfterCursor = startContainer;
    } else {
        nodeAfterCursor = getNodeAfter( startContainer, startOffset );
        if ( nodeAfterCursor && !isOrContains( root, nodeAfterCursor ) ) {
            nodeAfterCursor = null;
        }
        // The cursor was right at the end of the document
        if ( !nodeAfterCursor ) {
            nodeAfterCursor = getNodeBefore( startContainer, startOffset );
            if ( nodeAfterCursor.nodeType === TEXT_NODE &&
                    nodeAfterCursor.length ) {
                return false;
            }
        }
    }

    // Otherwise, look for any previous content in the same block.
    contentWalker.currentNode = nodeAfterCursor;
    contentWalker.root = getStartBlockOfRange( range, root );

    return !contentWalker.previousNode();
};
window.rdsabb = rangeDoesStartAtBlockBoundary

var rangeDoesEndAtBlockBoundary = function ( range, root ) {
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
    contentWalker.root = getEndBlockOfRange( range, root );

    return !contentWalker.nextNode();
};
window.rdeabb = rangeDoesEndAtBlockBoundary

var expandRangeToBlockBoundaries = function ( range, root ) {
    var start = getStartBlockOfRange( range, root ),
        end = getEndBlockOfRange( range, root ),
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
// NATE: These are useful for debugging
// window.mrbd = moveRangeBoundariesDownTree
// window.mrup = moveRangeBoundariesUpTree
// window.pr   = printRange

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
    var nodeOffset = rect.top
    var parentOffset = parentBlock.getBoundingClientRect().top
    if(nodeOffset === parentOffset){
      return {firstLine: true, lastLine: true}
    }
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
    var code = event.keyCode,
        key = keys[ code ],
        modifiers = '',
        range = this.getSelection();
    var sc = range.startContainer
    var so = range.startOffset

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
        // NATE: saveUndoState was causing odd behavior near non-editable nodes.
        // My guess is that it is a similar problem to backspace, where I had to
        // add in a moveRangeBoundariesDownTree for it to function properly.
        // Record undo checkpoint.
        // this.saveUndoState( range );
        // Delete the selection
        deleteContentsOfRange( range, this._root );
        this._ensureBottomLine();
        this.setSelection( range );
        this._updatePath( range, true );

    } else {
      // Record undo checkpoint.
      // this.saveUndoState( range );

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
    try {
        ensureBrAtEndOfAllLines(self._root)
        removeEmptyInlines( self._root )

        if ( !range ) { range = self.getSelection(); }
        var node = range.startContainer,
            parent;
        // Climb the tree from the focus point while we are inside an empty
        // inline element
        if ( node.nodeType === TEXT_NODE ) {
            node = node.parentNode;
        }
        parent = node;
        while ( isInline( parent ) &&
                ( !parent.textContent || parent.textContent === ZWS ) ) {
            node = parent;
            parent = node.parentNode;
        }

        // If focused in empty inline element
        if ( node !== parent ) {
            // Move focus to just before empty inline(s)
            range.setStart( parent,
                indexOf.call( parent.childNodes, node ) );
            range.collapse( true );
            // Remove empty inline(s)
            parent.removeChild( node );
            // Fix cursor in block
            if ( !isBlock( parent ) ) {
                parent = getPreviousBlock( parent, self._root );
            }
            fixCursor( parent, self._root );
            // Move cursor into text node
            moveRangeBoundariesDownTree( range );
        }
        // If you delete the last character in the sole <div> in Chrome,
        // it removes the div and replaces it with just a <br> inside the
        // root. Detach the <br>; the _ensureBottomLine call will insert a new
        // block.
        if ( node === self._root &&
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
        var root = self._root;
        var block, parent, nodeAfterSplit;

        // We handle this ourselves
        event.preventDefault();

        // Save undo checkpoint and add any links in the preceding section.
        // Remove any zws so we don't think there's content in an empty
        // block.
        self._recordUndoState( range );
        addLinks( range.startContainer, root, self );
        self._removeZWS();
        self._getRangeAndRemoveBookmark( range );

        // Selected text is overwritten, therefore delete the contents
        // to collapse selection.
        if ( !range.collapsed ) {
            deleteContentsOfRange( range, root );
        }

        block = getStartBlockOfRange( range, root );

        // If this is a malformed bit of document or in a table;
        // just play it safe and insert a <br>.
        if ( !block || /^T[HD]$/.test( block.nodeName ) ) {
            self.insertNodeInRange( range, self.createElement( 'BR' ));
            range.collapse( false );
            self.setSelection( range );
            self._updatePath( range, true );
            return;
        }

        // If in a list, we'll split the LI instead.
        if ( parent = getNearest( block, root, 'LI' ) ) {
            block = parent;
        }

        if ( !block.textContent ) {
            // Break list
            if ( getNearest( block, root, 'UL' ) ||
                    getNearest( block, root, 'OL' ) ) {
                return self.modifyBlocks( decreaseListLevel, range );
            }
            // Break blockquote
            else if ( getNearest( block, root, 'BLOCKQUOTE' ) ) {
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
        fixCursor( block, root );

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


            if ( nodeAfterSplit.nodeType !== TEXT_NODE && notEditable(nodeAfterSplit, root)) {
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
    },
    backspace: function ( self, event, range ) {
        self.backspace(self, event, range)
    },
    'delete': function ( self, event, range ) {
        var root = self._root;
        var current, next;
        self._removeZWS();
        // Record undo checkpoint.
        self.saveUndoState( range );
        // If not collapsed, delete contents
        if ( !range.collapsed ) {
            event.preventDefault();
            deleteContentsOfRange( range, root );
            afterDelete( self, range );
        }
        // If at end of block, merge next into this block
        else if ( rangeDoesEndAtBlockBoundary( range, root ) ) {
            event.preventDefault();
            current = getStartBlockOfRange( range, root );
            if ( !current ) {
                return;
            }
            // In case inline data has somehow got between blocks.
            fixContainer( current.parentNode, root );
            // Now get next block
            next = getNextBlock( current, root );
            // Must not be at the very end of the text area.
            if ( next ) {
                // If not editable, just delete whole block.
                if ( notEditable(next, root) ) {
                    detach( next );
                    return;
                }
                // Otherwise merge.
                mergeWithBlock( current, next, range );
                // If deleted line between containers, merge newly adjacent
                // containers.
                next = current.parentNode;
                while ( next !== root && !next.nextSibling ) {
                    next = next.parentNode;
                }
                if ( next !== root && ( next = next.nextSibling ) ) {
                    mergeContainers( next, root );
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
                if(notEditable(ch, root)){
                    event.preventDefault();
                    detach( ch );
                }
            }
            //else leave it to browser
            setTimeout( function () { afterDelete( self ); }, 0 );
        }
    },
    tab: function ( self, event, range ) {
        var root = self._root;
        var node, parent;
        var startContainer = range.startContainer,
            startOffset = range.startOffset,
            endContainer = range.endContainer,
            endOffset = range.endOffset;
        var insideList = false;
        self._removeZWS();
        // If no selection and at start of block
        if ( range.collapsed && rangeDoesStartAtBlockBoundary( range, root ) ) {
            node = getStartBlockOfRange( range, root );
            // Iterate through the block's parents
            while ( parent = node.parentNode ) {
                // If we find a UL or OL (so are in a list, node must be an LI)
                if ( parent.nodeName === 'UL' || parent.nodeName === 'OL' ) {
                    // AND the LI is not the first in the list
                    if ( node.previousSibling ) {
                        // Then increase the list level
                        event.preventDefault();
                        self.modifyBlocks( increaseListLevel, range );
                        insideList = true;
                    }
                    break;
                }
                node = parent;
            }
            if(!insideList){
              event.preventDefault()
              insertTab(self, range)
              moveRangeBoundariesDownTree(range)
              // The previous command will select the entire node
              // instead of returning a collapsed range so we need
              // to move the start up to the end of the selection
              range.setStart(range.endContainer, range.endOffset)
              self.setSelection(range)
            }
        }
        // otherwise if the range is collapsed just insert a normal tab
        else if( range.collapsed  ) {
          insertTab(self, range)
          range.setStart(startContainer, startOffset + TAB_SIZE)
          range.setEnd(endContainer, endOffset + TAB_SIZE)
          self.setSelection(range)
          event.preventDefault();
        }
        else{
          console.info("range not collapsed, ignoring tab")
        }
    },
    'shift-tab': function ( self, event, range ) {
        var root = self._root;
        var node;
        self._removeZWS();
        // If no selection and at start of block
        if ( range.collapsed && rangeDoesStartAtBlockBoundary( range, root ) ) {
            // Break list
            node = range.startContainer;
            if ( getNearest( node, root, 'UL' ) ||
                    getNearest( node, root, 'OL' ) ) {
                event.preventDefault();
                self.modifyBlocks( decreaseListLevel, range );
            }
        }
    },
    space: function ( self, _, range ) {
        var node, parent;
        // Nate: This record/bookmark has a side effect of putting a BR tag at the end of a line, which
        // currently is ok with me
        self._recordUndoState( range );
        addLinks( range.startContainer, self._root, self );
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
        // Delete the selection if not collapsed
        else if ( !range.collapsed ) {
            deleteContentsOfRange( range, self._root );
            self._ensureBottomLine();
            self.setSelection( range );
            self._updatePath( range, true );
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

// Firefox pre v29 incorrectly handles Cmd-left/Cmd-right on Mac:
// it goes back/forward in history! Override to do the right
// thing.
// https://bugzilla.mozilla.org/show_bug.cgi?id=289384
if ( isMac && isGecko ) {
    keyHandlers[ 'meta-left' ] = function ( self, event ) {
        event.preventDefault();
        var sel = getWindowSelection( self );
        if ( sel && sel.modify ) {
            sel.modify( 'move', 'backward', 'lineboundary' );
        }
    };
    keyHandlers[ 'meta-right' ] = function ( self, event ) {
        event.preventDefault();
        var sel = getWindowSelection( self );
        if ( sel && sel.modify ) {
            sel.modify( 'move', 'forward', 'lineboundary' );
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

var insertTab = function(self, range){
  var node = self._doc.createTextNode(TAB)
  self.insertNodeInRange(
      range,
      node
  )
  mergeInlines(node.parentNode, range)
}

var findNextBRTag = function(root, node){
    var w = new TreeWalker(root, NodeFilter.SHOW_ALL, function(node){
                        return ( node.nodeName === "BR" )
    } );
    w.currentNode = node;
    return w.nextNONode()
}

var findPreviousBRTag = function(root, node){
    var w = new TreeWalker(root, NodeFilter.SHOW_ALL, function(node){
                        return ( node.nodeName === "BR" )
    } );
    w.currentNode = node;
    return w.previousNode()
}

var findNextTextOrNotEditable = function(root, node){
    var w = new TreeWalker(root, NodeFilter.SHOW_ALL, function(node, root){
        return ( isText(node) || notEditable(node, root) )
    } );
    w.currentNode = node;
    //NATE: TODO: call this with root
    return w.nextNONode(notEditable)
}

var findPreviousTextOrNotEditable = function(root, node){
    var w = new TreeWalker(root, NodeFilter.SHOW_ALL, function(node, root){
        return ( isText(node) || notEditable(node, root) )
    } );
    w.currentNode = node;
    return w.previousNode(notEditable)
}

Squire.prototype.backspace = function(self, event, range){
    self  = self  ? self  : this
    var root = self._root;
    event && event.preventDefault()
    range = range ? range : self.getSelection()
    self._removeZWS();
    // Record undo checkpoint.
    self._recordUndoState( range );
    // var newRange = self._getRangeAndRemoveBookmark( range );
    // NATE: there is a possibility that during getRangeAndRemoveBookmark,
    // that the node with the current selection is removed from the dom,
    // and this causes unexpected behavior with the current selection.  The
    // range returned will be correct, it all happens in mergeInlines, and
    // that function fixes the range at the end.  We should probably reset
    // the selection every time we call getRangeAndRemoveBookmark.
    range = self._getRangeAndRemoveBookmark( range );
    // TODO: NATE: we might want to move this back into getRangeAndRemoveBookmark
    moveRangeBoundariesDownTree( range );

    // If not collapsed, delete contents
    var block = getStartBlockOfRange(range)
    if ( !range.collapsed ) {
        deleteContentsOfRange( range, self._root );
        afterDelete( self, range );
    }
    // If at beginning of block, merge with previous
  else if ( rangeDoesStartAtBlockBoundary( range, self._root ) ) {
        var current = getStartBlockOfRange( range ),
            previous = current && getPreviousBlock( current, self._root );
        // Must not be at the very beginning of the text area.
        if ( previous ) {
            // If not editable, just delete whole block.
            if ( notEditable(previous, root) ) {
                detach( previous );
                return;
            }
            // Otherwise merge.
            mergeWithBlock( previous, current, range );
            // If deleted line between containers, merge newly adjacent
            // containers.
            current = previous.parentNode;
            while ( current && !current.nextSibling && current !== root ) {
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
        var rootNodeOfClean = null;

        if((sc.nodeType === TEXT_NODE)){
            if(so>1){
                sc.deleteData(so-1, 1)
                parent = sc.parentNode
                rootNodeOfClean = parent

            }
            else if(so===1){
                sc.deleteData(so-1, 1)
            }
            else{ //so === 0
                pn = findPreviousTextOrNotEditable(block, sc)
                var previousParent = pn.parentNode
                if(pn.nodeType === TEXT_NODE){
                    if(pn.length>0){
                        pn.deleteData(pn.length - 1, 1)
                    }
                    else{
                        detach(pn);
                    }
                }
                else if(notEditable(pn, root)){
                    detach(pn);
                }
                rootNodeOfClean = previousParent
            }
        }
        else {
            var child = sc.childNodes[so]
            pn = findPreviousTextOrNotEditable(block, child)
            if(pn){
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
                else if(notEditable(pn, root)){
                    detach(pn);
                }
            }

            //Nate: Todo: Currently cleaning from this node results in the range not getting moved down the tree, not good
            rootNodeOfClean = sc
        }

        // if(rootNodeOfClean){
        //     //CleanTree will trim whitespace, but it won't do this if there is a <br> tag at the end of the line
        //     //We want to preserve whitespace that the user has entered so calling ensureBr is necessary
        //     ensureBrAtEndOfAllLines(self._root)
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
    ensureBrAtEndOfAllLines(self._root)
    event && event.preventDefault()
    range = range ? range : self.getSelection()
    self._removeZWS();
    var so = range.startOffset
    var sc = range.startContainer
    var ec = range.endContainer
    var eo = range.endOffset
    var parent = sc.parent
    var root = self._root
    var nn
    var block = getStartBlockOfRange(range, root)

    if(rangeDoesEndAtBlockBoundary(range, root)){
        var nextBlock = block && getNextBlock(block, root)

        if(nextBlock){
           self.setSelectionToNode(nextBlock)
           var newRange = self.getSelection()
           moveRangeBoundariesDownTree(newRange)
           self.setSelection(newRange)
        }
        else{
            console.info("no block found")
            if(isLastLine(self)){
              console.info("on last line")
              event && event.preventDefault()
              var e = new CustomEvent('squire::down-on-last-line', { 'detail': {range: range} });
              root.dispatchEvent(e);
              // return
            }
        }
    }
    else if(sc.nodeType === TEXT_NODE){
        var l = sc.length
        var skippedNode = false
        //If we are in a text node and not at the end, move one character to the right
        if(so < l){
            so += 1
            range.setStart(sc, so)
            self.setSelection(range)
        }
        else{
            nn = findNextTextOrNotEditable(root, sc)

            // The right cursor has a special case where it should skip over the first notEditable node,
            // otherwise it will take two right presses to go from text->notEditable->text
            if(nn){
                if(notEditable(nn, root)){
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
  ensureBrAtEndOfAllLines(self._root)
  range = range ? range : self.getSelection()
  self._removeZWS();
  var so = range.startOffset
  var sc = range.startContainer
  var root = self._root

  if(isFirstLine(self)){
    console.info("on line 0")
    event && event.preventDefault()
    var e = new CustomEvent('squire::up-on-first-line', { 'detail': {range: range} });
    root.dispatchEvent(e);
    // return
  }
  setTimeout( function () { ensureOutsideOfNotEditable( self ); }, 0 );
}


Squire.prototype.moveDown = function(self, event, range){
  self  = self  ? self  : this
  //TODO: stop looking for BR tags to designate end of lines
  ensureBrAtEndOfAllLines(self._root)
  range = range ? range : self.getSelection()
  self._removeZWS();
  var so = range.startOffset
  var sc = range.startContainer
  var root = self._root


  if(isLastLine(self)){
    console.info("on last line")
    event && event.preventDefault()
    var e = new CustomEvent('squire::down-on-last-line', { 'detail': {range: range} });
    root.dispatchEvent(e);
    // return
  }
  setTimeout( function () { ensureOutsideOfNotEditable( self ); }, 0 );
}

Squire.prototype.moveLeft = function(self, event, range){
    self  = self  ? self  : this
    //TODO: stop looking for BR tags to designate end of lines
    ensureBrAtEndOfAllLines(self._root)
    event && event.preventDefault()
    range = range ? range : self.getSelection()

    self._removeZWS();
    var so = range.startOffset
    var sc = range.startContainer
    var ec = range.endContainer
    var eo = range.endOffset
    var parent = sc.parent
    var root = self._root
    var nn
    var block = getStartBlockOfRange(range, root)
    if(!isText(sc) && (so > sc.childNodes.length - 1) ){
        console.info("range is out of bounds")
        so = so - 1
        range.setStart(sc, so)
        self.setSelection(range)
    }
    if(rangeDoesStartAtBlockBoundary(range, root)){
        var block = getStartBlockOfRange(range)

        var previousBlock = block && getPreviousBlock(block, root)
        if(block && previousBlock){
            self.setSelectionToNode(previousBlock)
            var newRange = self.getSelection()
            newRange.setStart(newRange.endContainer, newRange.endContainer.childNodes.length-1)
            newRange.setEnd(newRange.endContainer, newRange.endContainer.childNodes.length-1)
            moveRangeBoundariesDownTree(newRange)
            self.setSelection(newRange)
        }
        else{
          console.info("no block found")
          if(isFirstLine(self)){
            console.info("on line 0")
            event && event.preventDefault()
            var e = new CustomEvent('squire::up-on-first-line', { 'detail': {range: range} });
            root.dispatchEvent(e);
            // return
          }
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

var styleToSemantic = {
    backgroundColor: {
        regexp: notWS,
        replace: function ( doc, colour ) {
            return createElement( doc, 'SPAN', {
                'class': HIGHLIGHT_CLASS,
                style: 'background-color:' + colour
            });
        }
    },
    color: {
        regexp: notWS,
        replace: function ( doc, colour ) {
            return createElement( doc, 'SPAN', {
                'class': COLOUR_CLASS,
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
                'class': FONT_FAMILY_CLASS,
                style: 'font-family:' + family
            });
        }
    },
    fontSize: {
        regexp: notWS,
        replace: function ( doc, size ) {
            return createElement( doc, 'SPAN', {
                'class': FONT_SIZE_CLASS,
                style: 'font-size:' + size
            });
        }
    },
    textDecoration: {
        regexp: /^underline/i,
        replace: function ( doc ) {
            return createElement( doc, 'U' );
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
         if(whiteList[c] || c.match(/^au/) || c.match(/^ltx_/) || c.match(/^v\d+/)){
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
        "ltx_Math": 1,
        "math": 1,
        "not-editable": 1,
        "ltx_cite": 1,
        "squire-citation": 1,
        "rendered": 1,
        "raw": 1
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
        "data": 1
    }
    return filterAttributes(span, whiteList)
}

var replaceStyles = function ( node, parent ) {
  //NATE: TODO: whitelist of classes for span
  node.removeAttribute("style")
  filterSpanClasses(node)
  filterSpanAttributes(node)
  return node
  // NATE: I want to leave one line of the old code in as a reminder, this is the line that was causing
  // one span to get broken out into many spans, but it was kind of clever and we might want to use the idea
  // at a later time.  It looked at if something had a large font or a certain color and tried to guess what the
  // element was and add a semantic class to the span.  For each attribute there was a separate class.  Although
  // we don't want a bunch of spans with classes, we might want to re-order a span with certain attributes into
  // more sensible elements
  // for ( attr in spanToSemantic )
};
//NATE: I like the stylesRewriters, we should have sane defaults for all the elements as a first pass, and then
// any additional complicated filtering can be done by registering filters with squire that will be executed during
// insertHTML
var stylesRewriters = {
    SPAN: replaceStyles,
    CITE: replaceStyles,
    STRONG: replaceWithTag( 'B' ),
    EM: replaceWithTag( 'I' ),
    INS: replaceWithTag( 'U' ),
    STRIKE: replaceWithTag( 'S' ),
    P: replaceWithTag('DIV'),
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
        filterAttributes(node, {data: 1, class: 1})
        return node
    },
    A: function ( node, parent ){
        filterClasses(node, {})
        filterAttributes(node, {"href": 1, "target": 1})
        return node
    },
    // NATE: probably want to check if it is a squire cursor bookmark
    // before applying the general filter
    INPUT: function ( node, parent ){
        filterAttributes(node, {"id": 1, "type": 1})
        return node
    }
    //TODO: NATE: We probably want to map p tags to divs, it might be done already but I'm not 100% sure
};

var allowedBlock = /^(?:A(?:DDRESS|RTICLE|SIDE|UDIO)|BLOCKQUOTE|CAPTION|D(?:[DLT]|IV)|F(?:IGURE|IGCAPTION|OOTER)|H[1-6]|HEADER|L(?:ABEL|EGEND|I)|O(?:L|UTPUT)|P(?:RE)?|SECTION|T(?:ABLE|BODY|D|FOOT|H|HEAD|R)|UL)$/;

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
var cleanTree = function cleanTree ( node, preserveWS ) {
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
                cleanTree( child, preserveWS || ( nodeName === 'PRE' ) );
            }
        } else {
            if ( nodeType === TEXT_NODE ) {
                data = child.data;
                startsWithWS = !notWS.test( data.charAt( 0 ) );
                endsWithWS = !notWS.test( data.charAt( data.length - 1 ) );
                if ( preserveWS || ( !startsWithWS && !endsWithWS ) ) {
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
                    data = data.replace( /^\s+/g, sibling ? ' ' : '' );
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
                    data = data.replace( /\s+$/g, sibling ? ' ' : '' );
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

var removeEmptyInlines = function removeEmptyInlines ( node ) {
    var children = node.childNodes,
        l = children.length,
        child;
    while ( l-- ) {
        child = children[l];
        if ( child.nodeType === ELEMENT_NODE && !isLeaf( child ) ) {
            removeEmptyInlines( child );
            if ( isInline( child ) && !child.firstChild ) {
                node.removeChild( child );
            }
        } else if ( child.nodeType === TEXT_NODE && !child.data ) {
            node.removeChild( child );
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

var ensureBrAtEndOfAllTags = function (root, tags){
    if(!tags){
      tags = ['div', 'li', 'ol', 'ul']
    }
    var elements = $(root).find(tags.join(", "))
    var lastChild, br
    elements.each(function(i, element){
        lastChild = element.lastChild
        if(!lastChild || lastChild.nodeName !== 'BR'){
            br = createElement( element.ownerDocument, 'BR' )
            element.appendChild(br)
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

var removeAllBrs = function (root){
    $(root).find("br").detach()
}

// ---
// TODO: NATE: add root to this function
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
var cleanupBRs = function ( node, root ) {
    var brs = node.querySelectorAll( 'BR' ),
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
            fixContainer( parent, root );
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
Squire.prototype.removeEmptyInlines = removeEmptyInlines
Squire.prototype.collapseSimpleSpans = collapseSimpleSpans
Squire.prototype.ensureBrAtEndOfAllLines = ensureBrAtEndOfAllLines

Squire.Clean.stylesRewriters = stylesRewriters

var onCut = function ( event ) {
    var clipboardData = event.clipboardData;
    var range = this.getSelection();
    var node = this.createElement( 'div' );
    var root = this._root;
    var self = this;

    // Save undo checkpoint
    this.saveUndoState( range );

    // Edge only seems to support setting plain text as of 2016-03-11.
    // Mobile Safari flat out doesn't work:
    // https://bugs.webkit.org/show_bug.cgi?id=143776
    if ( !isEdge && !isIOS && clipboardData ) {
        moveRangeBoundariesUpTree( range, root );
        node.appendChild( deleteContentsOfRange( range, root ) );
        clipboardData.setData( 'text/html', node.innerHTML );
        clipboardData.setData( 'text/plain',
            node.innerText || node.textContent );
        event.preventDefault();
    } else {
        setTimeout( function () {
            try {
                // If all content removed, ensure div at start of root.
                self._ensureBottomLine();
            } catch ( error ) {
                self.didError( error );
            }
        }, 0 );
    }

    this.setSelection( range );
};

var onCopy = function ( event ) {
    var clipboardData = event.clipboardData;
    var range = this.getSelection();
    var node = this.createElement( 'div' );

    var commonAncestor = range.commonAncestorContainer
    var whitelist = /^(i|b)$/
    var outerTagName;
    var outerHTML;

    // Edge only seems to support setting plain text as of 2016-03-11.
    // Mobile Safari flat out doesn't work:
    // https://bugs.webkit.org/show_bug.cgi?id=143776
    if ( !isEdge && !isIOS && clipboardData ) {
        node.appendChild( range.cloneContents() );
        if(commonAncestor && commonAncestor.parentNode) {
          outerTagName = commonAncestor.parentNode.tagName.toLowerCase()
          outerHTML = commonAncestor.parentNode.outerHTML

          if(whitelist.test(outerTagName)) {
            node.innerHTML = '<' + outerTagName + '>' + node.innerHTML + '</' + outerTagName + '>'
          }
        }

        clipboardData.setData( 'text/html', node.innerHTML );
        clipboardData.setData( 'text/plain',
            node.innerText || node.textContent );
        event.preventDefault();
    }
};

var onPaste = function ( event ) {
    console.info("PASTING")
    var clipboardData = event.clipboardData,
        items = clipboardData && clipboardData.items,
        fireDrop = false,
        hasImage = false,
        plainItem = null,
        self = this,
        l, item, type, types, data;
    // Current HTML5 Clipboard interface
    // ---------------------------------
    // https://html.spec.whatwg.org/multipage/interaction.html

    // Edge only provides access to plain text as of 2016-03-11.
    if ( !isEdge && items ) {
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
    // Firefox is even worse: it doesn't even let you know that there might be
    // an RTF version on the clipboard, but it will also convert to HTML if you
    // let the browser insert the content. I've filed
    // https://bugzilla.mozilla.org/show_bug.cgi?id=1254028
    types = clipboardData && clipboardData.types;
    if ( !isEdge && types && (
            indexOf.call( types, 'text/html' ) > -1 || (
                !isGecko &&
                indexOf.call( types, 'text/plain' ) > -1 &&
                indexOf.call( types, 'text/rtf' ) < 0 )
            )) {
        console.info("old interface")
        event.preventDefault();
        // Abiword on Linux copies a plain text and html version, but the HTML
        // version is the empty string! So always try to get HTML, but if none,
        // insert plain text instead. On iOS, Facebook (and possibly other
        // apps?) copy links as type text/uri-list, but also insert a **blank**
        // text/plain item onto the clipboard. Why? Who knows.
        if (( data = clipboardData.getData( 'text/html' ) )) {
            this.insertHTML( data, true );
        } else if (
                ( data = clipboardData.getData( 'text/plain' ) ) ||
                ( data = clipboardData.getData( 'text/uri-list' ) ) ) {
            this.insertPlainText( data, true );
        }
        return;
    }

    // No interface. Includes all versions of IE :(
    // --------------------------------------------

    this._awaitingPaste = true;

    var body = this._doc.body,
        range = this.getSelection(),
        startContainer = range.startContainer,
        startOffset = range.startOffset,
        endContainer = range.endContainer,
        endOffset = range.endOffset;

    // We need to position the pasteArea in the visible portion of the screen
    // to stop the browser auto-scrolling.
    var pasteArea = this.createElement( 'DIV', {
        contenteditable: 'true',
        style: 'position:fixed; overflow:hidden; top:0; right:100%; width:1px; height:1px;'
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

// On Windows you can drag an drop text. We can't handle this ourselves, because
// as far as I can see, there's no way to get the drop insertion point. So just
// save an undo state and hope for the best.
var onDrop = function ( event ) {
    var types = event.dataTransfer.types;
    var l = types.length;
    var hasPlain = false;
    var hasHTML = false;
    while ( l-- ) {
        switch ( types[l] ) {
        case 'text/plain':
            hasPlain = true;
            break;
        case 'text/html':
            hasHTML = true;
            break;
        default:
            return;
        }
    }
    if ( hasHTML || hasPlain ) {
        this.saveUndoState();
    }
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

function mergeObjects ( base, extras, mayOverride ) {
    var prop, value;
    if ( !base ) {
        base = {};
    }
    if ( extras ) {
        for ( prop in extras ) {
            if ( mayOverride || !( prop in base ) ) {
                value = extras[ prop ];
                base[ prop ] = ( value && value.constructor === Object ) ?
                    mergeObjects( base[ prop ], value, mayOverride ) :
                    value;
            }
        }
    }
    return base;
}

function Squire ( root, config ) {
  if ( root.nodeType === DOCUMENT_NODE ) {
        root = root.body;
    }
    var doc = root.ownerDocument;
    var win = doc.defaultView;
    var mutation;

    this._win = win;
    this._doc = doc;
    this._root = root;

    this._events = {};

    this._isFocused = false;
    this._lastSelection = null;

    // IE loses selection state of iframe on blur, so make sure we
    // cache it just before it loses focus.
    if ( losesSelectionOnBlur ) {
        this.addEventListener( 'beforedeactivate', this.getSelection );
    }

    // The keypress event listener is useful since it doesn't fire for
    // arrow or modifier keys, whereas keydown fires for everything.
    // Currently this get fired after the onkey handler in keyhandlers,
    // so there might have already been some processing on the range
    // before arriving here.
    this.addEventListener("keypress", function(e){
        var r = this.getSelection()
        var sc = r.startContainer
        var so = r.startOffset
        var child = sc.childNodes && sc.childNodes[so]
        var previous
        var root = this._root

        if(notEditable(child)){
            console.info("NOT EDITABLE need to move range")
            ensureOutsideOfNotEditable( this )
            r = this.getSelection()
            sc = r.startContainer
            so = r.startOffset
            child = sc.childNodes && sc.childNodes[so]
            if(notEditable(child)){
              var previousSibling = child.previousSibling
              if(isText(previousSibling)){
                  var length = previousSibling.length
                  this.setSelectionToNode(previousSibling, length ? length : 0)
              }
              else{
                  console.info("Previous sibling not text node, creating text node")
                  e.preventDefault()
                  var tn = this._doc.createTextNode(String.fromCharCode(e.charCode))
                  sc.insertBefore(tn, child)
                  this.setSelectionToNode(tn, 1)
              }
            }
        }

        if(sc.nodeType === TEXT_NODE){
          if(so === 0){
            previous = findPreviousTextOrNotEditable(root, sc)
            if(notEditable(previous, root)){
              // TODO: nate: could possibly just insert the char here
              sc.insertData(0, ZWS)
              r.setStart(sc, 1)
              this.setSelection(r)
            }
          }
        }
        else{
          console.info("NOT TEXT NODE")
          previous = findPreviousTextOrNotEditable(root, child)
          if(notEditable(previous, root)){
            console.info("prev not edit")
            // TODO: nate: could possibly just insert the char here
            var node = this._doc.createTextNode(ZWS)
            sc.insertBefore(node, child)
            r.setStart(node, 1)
            // r.setEnd(node, 1)
            this.setSelection(r)
            // mergeInlines(node.parentNode, range)
          }
        }
    });

    this._hasZWS = false;

    this._lastAnchorNode = null;
    this._lastFocusNode = null;
    this._path = '';
    this._willUpdatePath = false;

    // NATE: We are resorting to the old way of handling changes since we need to move out of noteditable nodes.
    // To do this with the 'selectionchange' event is trickier since our current procedure triggers a selection change
    // nodes.  To do this with the 'selectionchange' event is trickier since our current procedure triggers
    // a selection change
    // if ( 'onselectionchange' in doc ) {
    //   this.addEventListener( 'selectionchange', this._updatePathOnEvent );
    // } else {
      this.addEventListener( 'keyup', this._updatePathOnEvent );
      this.addEventListener( 'mouseup', this._updatePathOnEvent );
      this._selectionClick = false
      this.addEventListener('mousedown', function (e) {
        var range = this.getSelection()
        this._selectionClick = !range.collapsed
      })
      this.addEventListener( 'mouseup', function(){
          var range = this.getSelection()
          moveRangeOutOfNotEditable(range)
          // Only set selection in the editor if there was no selection on click; otherwise, clear it will clear.
          if(!this._selectionClick){
            this.setSelection(range)
          }
          this._selectionClick = false
      } );
    // }

    this._undoIndex = -1;
    this._undoStack = [];
    this._undoStackLength = 0;
    this._isInUndoState = false;
    this._ignoreChange = false;
    this._ignoreAllChanges = false;

    if ( canObserveMutations ) {
        mutation = new MutationObserver( this._docWasChanged.bind( this ) );
        mutation.observe( root, {
            childList: true,
            attributes: true,
            characterData: true,
            subtree: true
        });
        this._mutation = mutation;
    } else {
        this.addEventListener( 'keyup', this._keyUpDetectChange );
    }

    // On blur, restore focus except if the user taps or clicks to focus a
    // specific point. Can't actually use click event because focus happens
    // before click, so use mousedown/touchstart
    this._restoreSelection = false;
    this.addEventListener( 'blur', enableRestoreSelection );
    this.addEventListener( 'mousedown', disableRestoreSelection );
    this.addEventListener( 'touchstart', disableRestoreSelection );
    this.addEventListener( 'focus', restoreSelection );

    // IE sometimes fires the beforepaste event twice; make sure it is not run
    // again before our after paste function is called.
    this._awaitingPaste = false;
    this.addEventListener( isIElt11 ? 'beforecut' : 'cut', onCut );
    this.addEventListener( 'copy', onCopy );
    // NATE: we are implementing paste in the main app.
    // this.addEventListener( isIElt11 ? 'beforepaste' : 'paste', onPaste );
    this.addEventListener( 'drop', onDrop );

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

    root.setAttribute( 'contenteditable', 'true' );

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
            li: null,
            a: null
        },
        undo: {
            documentSizeThreshold: -1, // -1 means no threshold
            undoLimit: -1 // -1 means no limit
        }
    }, config, true );

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
        this.createElement( config.blockTag, config.blockAttributes, children ),
        this._root
    );
};

proto.didError = function ( error ) {
    console.error( error );
};

proto.getDocument = function () {
    return this._doc;
};
proto.getRoot = function () {
    return this._root;
};

proto.modifyDocument = function ( modificationCallback ) {
    this._ignoreAllChanges = true;
    if ( this._mutation ) {
        this._mutation.disconnect();
    }

    modificationCallback();

    this._ignoreAllChanges = false;
    if ( this._mutation ) {
        this._mutation.observe( this._root, {
            childList: true,
            attributes: true,
            characterData: true,
            subtree: true
        });
    }
};

// --- Events ---

// Subscribing to these events won't automatically add a listener to the
// document node, since these events are fired in a custom manner by the
// editor code.
var customEvents = {
    pathChange: 1, select: 1, input: 1, undoStateChange: 1
};

proto.fireEvent = function ( type, event ) {
    var handlers = this._events[ type ];
    var isFocused, l, obj;
    // UI code, especially modal views, may be monitoring for focus events and
    // immediately removing focus. In certain conditions, this can cause the
    // focus event to fire after the blur event, which can cause an infinite
    // loop. So we detect whether we're actually focused/blurred before firing.
    if ( /^(?:focus|blur)/.test( type ) ) {
        isFocused = isOrContains( this._root, this._doc.activeElement );
        if ( type === 'focus' ) {
            if ( !isFocused || this._isFocused ) {
                return this;
            }
            this._isFocused = true;
        } else {
            if ( isFocused || !this._isFocused ) {
                return this;
            }
            this._isFocused = false;
        }
    }
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
    var l = instances.length;
    var events = this._events;
    var type;

    for ( type in events ) {
        this.removeEventListener( type );
    }
    if ( this._mutation ) {
        this._mutation.disconnect();
    }
    while ( l-- ) {
        if ( instances[l] === this ) {
            instances.splice( l, 1 );
        }
    }

    // Destroy undo stack
    this._undoIndex = -1;
    this._undoStack = [];
    this._undoStackLength = 0;
};

proto.handleEvent = function ( event ) {
    this.fireEvent( event.type, event );
};

proto.addEventListener = function ( type, fn ) {
    var handlers = this._events[ type ];
    var target = this._root;
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
            if ( type === 'selectionchange' ) {
                target = this._doc;
            }
            target.addEventListener( type, this, true );
        }
    }
    handlers.push( fn );
    return this;
};

proto.removeEventListener = function ( type, fn ) {
    var handlers = this._events[ type ];
    var target = this._root;
    var l;
    if ( handlers ) {
        if ( fn ) {
            l = handlers.length;
            while ( l-- ) {
                if ( handlers[l] === fn ) {
                    handlers.splice( l, 1 );
                }
            }
        } else {
            handlers.length = 0;
        }
        if ( !handlers.length ) {
            delete this._events[ type ];
            if ( !customEvents[ type ] ) {
                if ( type === 'selectionchange' ) {
                    target = this._doc;
                }
                target.removeEventListener( type, this, true );
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

proto.getCursorPosition = function ( range ) {
    if ( ( !range && !( range = this.getSelection() ) ) ||
            !range.getBoundingClientRect ) {
        return null;
    }
    // Get the bounding rect
    var rect = range.getBoundingClientRect();
    var node, parent;
    if ( rect && !rect.top ) {
        this._ignoreChange = true;
        node = this._doc.createElement( 'SPAN' );
        node.textContent = ZWS;
        this.insertNodeInRange( range, node );
        rect = node.getBoundingClientRect();
        parent = node.parentNode;
        parent.removeChild( node );
        mergeInlines( parent, range );
    }
    return rect;
};

proto._moveCursorTo = function ( toStart ) {
    var root = this._root,
        range = this._createRange( root, toStart ? 0 : root.childNodes.length );
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

var getWindowSelection = function ( self ) {
    return self._win.getSelection() || null;
};

proto.setSelection = function ( range ) {
    if ( range ) {
        this._lastSelection = range;
        // If we're setting selection, that automatically, and synchronously, // triggers a focus event. So just store the selection and mark it as
        // needing restore on focus.
        if ( !this._isFocused ) {
            enableRestoreSelection.call( this );
        } else if ( isAndroid && !this._restoreSelection ) {
            // Android closes the keyboard on removeAllRanges() and doesn't
            // open it again when addRange() is called, sigh.
            // Since Android doesn't trigger a focus event in setSelection(),
            // use a blur/focus dance to work around this by letting the
            // selection be restored on focus.
            // Need to check for !this._restoreSelection to avoid infinite loop
            enableRestoreSelection.call( this );
            this.blur();
            this.focus();
        } else {
            // iOS bug: if you don't focus the iframe before setting the
            // selection, you can end up in a state where you type but the input
            // doesn't get directed into the contenteditable area but is instead
            // lost in a black hole. Very strange.
            if ( isIOS ) {
                this._win.focus();
            }
            var sel = getWindowSelection( this );
            if ( sel ) {
                sel.removeAllRanges();
                sel.addRange( range );
            }
        }
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
    var sel = getWindowSelection( this );
    var root = this._root;
    var selection, startContainer, endContainer;
    if ( sel && sel.rangeCount ) {
        selection  = sel.getRangeAt( 0 ).cloneRange();
        startContainer = selection.startContainer;
        endContainer = selection.endContainer;
        // FF can return the selection as being inside an <img>. WTF?
        if ( startContainer && isLeaf( startContainer, root ) ) {
            selection.setStartBefore( startContainer );
        }
        if ( endContainer && isLeaf( endContainer, root ) ) {
            selection.setEndBefore( endContainer );
        }
    }
    if ( selection &&
            isOrContains( root, selection.commonAncestorContainer ) ) {
        this._lastSelection = selection;
    } else {
        selection = this._lastSelection;
    }
    if ( !selection ) {
        selection = this._createRange( root.firstChild, 0 );
    }
    return selection;
};

function enableRestoreSelection () {
    this._restoreSelection = true;
}
function disableRestoreSelection () {
    this._restoreSelection = false;
}
function restoreSelection () {
    if ( this._restoreSelection ) {
        this.setSelection( this._lastSelection );
    }
}

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
                    walker.currentNode = parent;
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
    removeZWS( this._root );
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
            getPath( focus, this._root ) : '(selection)' : '';
        if ( this._path !== newPath ) {
            this._path = newPath;
            this.fireEvent( 'pathChange', { path: newPath } );
        }
    }
    if ( !range.collapsed ) {
        this.fireEvent( 'select' );
    }
};

// selectionchange is fired synchronously in IE when removing current selection
// and when setting new selection; keyup/mouseup may have processing we want
// to do first. Either way, send to next event loop.
proto._updatePathOnEvent = function () {
    var self = this;
    if ( !self._willUpdatePath ) {
        self._willUpdatePath = true;
        setTimeout( function () {
            self._willUpdatePath = false;
            self._updatePath( self.getSelection() );
        }, 0 );
    }
};

// --- Focus ---

proto.focus = function () {
    this._root.focus();
    return this;
};

proto.blur = function () {
    this._root.blur();
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

    this.insertNodeInRange( range, startNode );
    range.collapse( false );
    this.insertNodeInRange( range, endNode );

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
    var root = this._root,
        start = root.querySelector( '#' + startSelectionId ),
        end = root.querySelector( '#' + endSelectionId );

    if ( start && end ) {
        var startContainer = start.parentNode,
            endContainer = end.parentNode,
            startOffset = indexOf.call( startContainer.childNodes, start ),
            endOffset = indexOf.call( endContainer.childNodes, end );

        if ( startContainer === endContainer ) {
            endOffset -= 1;
        }

        detach( start );
        detach( end );

        if ( !range ) {
            range = this._doc.createRange();
        }
        range.setStart( startContainer, startOffset );
        range.setEnd( endContainer, endOffset );

        // Merge any text nodes we split
        mergeInlines( startContainer, range );
        if ( startContainer !== endContainer ) {
            mergeInlines( endContainer, range );
        }

        // If we didn't split a text node, we should move into any adjacent
        // text node to current selection point
        if ( range.collapsed ) {
            startContainer = range.startContainer;
            if ( startContainer.nodeType === TEXT_NODE ) {
                endContainer = startContainer.childNodes[ range.startOffset ];
                if ( !endContainer || endContainer.nodeType !== TEXT_NODE ) {
                    endContainer =
                        startContainer.childNodes[ range.startOffset - 1 ];
                }
                if ( endContainer && endContainer.nodeType === TEXT_NODE ) {
                    range.setStart( endContainer, 0 );
                    range.collapse( true );
                }
            }
        }
    }

    // TODO: NATE: we might want to move this back into getRangeAndRemoveBookmark.  I need
    // it for backspace to function properly.  I'm not sure why it was removed as it used
    // to be part of this function
    // moveRangeBoundariesDownTree( range );
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
            ( code < 33 || code > 45 ) ) {
        this._docWasChanged();
    }
};

proto._docWasChanged = function () {
    if ( this._ignoreAllChanges ) {
        return;
    }

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
        var undoIndex = this._undoIndex += 1;
        var undoStack = this._undoStack;
        var undoConfig = this._config.undo;
        var undoThreshold = undoConfig.documentSizeThreshold;
        var undoLimit = undoConfig.undoLimit;
        var html;

        // Truncate stack if longer (i.e. if has been previously undone)
        if ( undoIndex < this._undoStackLength ) {
            undoStack.length = this._undoStackLength = undoIndex;
        }

        // Get data
        if ( range ) {
            this._saveRangeToBookmark( range );
        }
        html = this._getHTML();

        // If this document is above the configured size threshold,
        // limit the number of saved undo states.
        // Threshold is in bytes, JS uses 2 bytes per character
        if ( undoThreshold > -1 && html.length * 2 > undoThreshold ) {
            if ( undoLimit > -1 && undoIndex > undoLimit ) {
                undoStack.splice( 0, undoIndex - undoLimit );
                undoIndex = this._undoIndex = undoLimit;
                this._undoStackLength = undoLimit;
            }
        }

        // Save data
        undoStack[ undoIndex ] = html;
        this._undoStackLength += 1;
        this._isInUndoState = true;
    }
};

proto.saveUndoState = function ( range ) {
    if ( range === undefined ) {
        range = this.getSelection();
    }
    if ( !this._isInUndoState ) {
        this._recordUndoState( range );
        this._getRangeAndRemoveBookmark( range );
    }
    return this;
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

    // Sanitize range to prevent weird IE artifacts
    if ( !range.collapsed &&
            range.startContainer.nodeType === TEXT_NODE &&
            range.startOffset === range.startContainer.length &&
            range.startContainer.nextSibling ) {
        range.setStartBefore( range.startContainer.nextSibling );
    }
    if ( !range.collapsed &&
            range.endContainer.nodeType === TEXT_NODE &&
            range.endOffset === 0 &&
            range.endContainer.previousSibling ) {
        range.setEndAfter( range.endContainer.previousSibling );
    }

    // If the common ancestor is inside the tag we require, we definitely
    // have the format.
    var root = this._root;
    var common = range.commonAncestorContainer;
    var walker, node;
    if ( getNearest( common, root, tag, attributes ) ) {
        return true;
    }

    // If common ancestor is a text node and doesn't have the format, we
    // definitely don't have it.
    if ( common.nodeType === TEXT_NODE ) {
        return false;
    }

    // Otherwise, check each text node at least partially contained within
    // the selection and make sure all of them have the format we want.
    walker = new TreeWalker( common, SHOW_TEXT, function ( node ) {
        return isNodeContainedInRange( range, node, true );
    }, false );

    var seenNode = false;
    while ( node = walker.nextNode() ) {
        if ( !getNearest( node, root, tag, attributes ) ) {
            return false;
        }
        seenNode = true;
    }

    return seenNode;
};

// Extracts the font-family and font-size (if any) of the element
// holding the cursor. If there's a selection, returns an empty object.
proto.getFontInfo = function ( range ) {
    var fontInfo = {
        color: undefined,
        backgroundColor: undefined,
        family: undefined,
        size: undefined
    };
    var seenAttributes = 0;
    var element, style, attr;

    if ( !range && !( range = this.getSelection() ) ) {
        return fontInfo;
    }

    element = range.commonAncestorContainer;
    if ( range.collapsed || element.nodeType === TEXT_NODE ) {
        if ( element.nodeType === TEXT_NODE ) {
            element = element.parentNode;
        }
        while ( seenAttributes < 4 && element ) {
            if ( style = element.style ) {
                if ( !fontInfo.color && ( attr = style.color ) ) {
                    fontInfo.color = attr;
                    seenAttributes += 1;
                }
                if ( !fontInfo.backgroundColor &&
                        ( attr = style.backgroundColor ) ) {
                    fontInfo.backgroundColor = attr;
                    seenAttributes += 1;
                }
                if ( !fontInfo.family && ( attr = style.fontFamily ) ) {
                    fontInfo.family = attr;
                    seenAttributes += 1;
                }
                if ( !fontInfo.size && ( attr = style.fontSize ) ) {
                    fontInfo.size = attr;
                    seenAttributes += 1;
                }
            }
            element = element.parentNode;
        }
    }
    return fontInfo;
};

proto._addFormat = function ( tag, attributes, range ) {
    // If the range is collapsed we simply insert the node by wrapping
    // it round the range and focus it.
    var root = this._root;
    var el, walker, startContainer, endContainer, startOffset, endOffset,
        node, needsFormat;

    if ( range.collapsed ) {
        el = fixCursor( this.createElement( tag, attributes ), root );
        this.insertNodeInRange( range, el );
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

        // IMG tags are included because we may want to create a link around them,
        // and adding other styles is harmless.
        walker = new TreeWalker(
            range.commonAncestorContainer,
            SHOW_TEXT|SHOW_ELEMENT,
            function ( node ) {
                return ( node.nodeType === TEXT_NODE ||
                        node.nodeName === 'IMG'
                    ) && isNodeContainedInRange( range, node, true );
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
            needsFormat = !getNearest( node, root, tag, attributes );
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
        this.insertNodeInRange( range, fixer );
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
    mergeInlines( root, range );

    return range;
};

proto.changeFormat = function ( add, remove, range, partial ) {
    // Normalise the arguments and get selection
    if ( !range && !( range = this.getSelection() ) ) {
        return this;
    }

    // Save undo checkpoint
    this.saveUndoState( range );

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
        nodeAfterSplit = split( node, offset, block.parentNode, self._root ),
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

proto.splitBlockAtCursor = function () {
  var block, node, offset, range
  range = this.getSelection()
  if(!range){
    console.warn("invalid cursor position in splitBlockAtCursor")
  }
  node = range.startContainer
  split ( node, range.startOffset, this._root, this._root )
};

proto.forEachBlock = function ( fn, mutates, range ) {
    if ( !range && !( range = this.getSelection() ) ) {
        return this;
    }

    // Save undo checkpoint
    if ( mutates ) {
        this.saveUndoState( range );
    }

    var root = this._root;
    var start = getStartBlockOfRange( range, root );
    var end = getEndBlockOfRange( range, root );
    if ( start && end ) {
        do {
            if ( fn( start ) || start === end ) { break; }
        } while ( start = getNextBlock( start, root ) );
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

    var root = this._root;
    var frag;

    // 2. Expand range to block boundaries
    expandRangeToBlockBoundaries( range, root );
    // 3. Remove range.
    moveRangeBoundariesUpTree( range, root );
    frag = extractContentsOfRange( range, root, root );

    // 4. Modify tree of fragment and reinsert.
    this.insertNodeInRange( range, modify.call( this, frag ) );
    // return

    // 5. Merge containers at edges
    if ( range.endOffset < range.endContainer.childNodes.length ) {
        mergeContainers( range.endContainer.childNodes[ range.endOffset ], root );
    }
    mergeContainers( range.startContainer.childNodes[ range.startOffset ], root );

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

var increaseIndentLevel = function ( frag ) {
  var props = this._config.tagAttributes.blockquote || {};

  props.class = 'no-left-border';

  return this.createElement( 'BLOCKQUOTE', props, [frag])
}

var decreaseBlockQuoteLevel = function ( frag ) {
    var root = this._root;
    var blockquotes = frag.querySelectorAll( 'blockquote' );
    Array.prototype.filter.call( blockquotes, function ( el ) {
        return !getNearest( el.parentNode, root, 'BLOCKQUOTE' );
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
    var walker = getBlockWalker( frag, self._root ),
        node, tag, prev, newLi,
        tagAttributes = self._config.tagAttributes,
        listAttrs = tagAttributes[ type.toLowerCase() ],
        listItemAttrs = tagAttributes.li;
    var div = frag.childNodes[0]

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
            newLi.appendChild( empty( node ) );
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
        fixContainer( listFrag, this._root );
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
    var root = this._root;
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
            parent = split( parent, item, newParent, root );
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
            split( newParent, first, newParent.parentNode, root );
        }
        while ( item !== frag && !item.childNodes.length ) {
            parent = item.parentNode;
            parent.removeChild( item );
            item = parent;
        }
    }, this );
    fixContainer( frag, root );
    return frag;
};

proto._ensureBottomLine = function () {
    var root = this._root;
    var last = root.lastElementChild;
    if ( !last ||
            last.nodeName !== this._config.blockTag || !isBlock( last ) ) {
        root.appendChild( this.createDefaultBlock() );
    }
};

// --- Keyboard interaction ---

proto.setKeyHandler = function ( key, fn ) {
    this._keyHandlers[ key ] = fn;
    return this;
};

// --- Get/Set data ---

proto._getHTML = function () {
    return this._root.innerHTML;
};

proto._setHTML = function ( html ) {
    var root = this._root;
    var node = root;
    node.innerHTML = html;
    do {
        fixCursor( node, root );
    } while ( node = getNextBlock( node, root ) );
    this._ignoreChange = true;
};

/*
options =
{
    withBookMark: 1, //will include tags for cursor position
    stripEndBrs: 1, //remove BRs from the end of block elements
}

*/

proto.getHTML = function ( options ) {
    if(!options){
        options = {}
    }
    var brs = [],
        root, node, fixer, html, l, range;
    var withBookMark = options["withBookMark"]
    var root = this._root

    // saving the range to a bookmark needs to come first since it will put back
    // many of the br tags that have been removed
    if ( withBookMark && ( range = this.getSelection() ) ) {
        this._saveRangeToBookmark( range );
    }

    // two options here with the first being more drastic
    if(options["stripAllBrs"]){
        removeAllBrs(root)
    }
    else if(options["stripEndBrs"]){
        removeBrAtEndOfAllLines(root)
    }

    if ( useTextFixer ) {
        root = this._root;
        node = root;
        while ( node = getNextBlock( node, root ) ) {
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
    // TODO: NATE: might need to extend this to li elements.  Squire uses BR tags
    // internally to correct some browser behavior but we don't necessarily wants
    // these tags in the html we are saving on the server.
    if(options["stripEndBrs"]){
        ensureBrAtEndOfAllLines(root)
    }
    else if(options["stripAllBrs"]){
        ensureBrAtEndOfAllTags(root, ['div', 'li'])
    }
    return html;
};

// options["focus"]: call this.focus and set selection to range
proto.setHTML = function ( html, options ) {
    if(!options){
        options = {}
    }
    var frag = this._doc.createDocumentFragment();
    var div = this.createElement( 'DIV' );
    var root = this._root;
    var child;

    // Parse HTML into DOM tree
    div.innerHTML = html;
    frag.appendChild( empty( div ) );

    cleanTree( frag );
    cleanupBRs( frag, root );

    fixContainer( frag, root );

    // Fix cursor
    var node = frag;
    while ( node = getNextBlock( node, root ) ) {
        fixCursor( node, root );
    }

    // Don't fire an input event
    this._ignoreChange = true;

    // Remove existing root children
    while ( child = root.lastChild ) {
        root.removeChild( child );
    }

    // And insert new content
    root.appendChild( frag );
    fixCursor( root, root );

    // Reset the undo stack
    this._undoIndex = -1;
    this._undoStack.length = 0;
    this._undoStackLength = 0;
    this._isInUndoState = false;
    // Record undo state
    var range = this._getRangeAndRemoveBookmark() ||
        this._createRange( root.firstChild, 0 );
    this.saveUndoState( range );
    // IE will also set focus when selecting text so don't use
    // setSelection. Instead, just store it in lastSelection, so if
    // anything calls getSelection before first focus, we have a range
    // to return.
    this._lastSelection = range;
    enableRestoreSelection.call( this );
    this._updatePath( range, true );
    if(options["focus"]){
      this.focus()
      this.setSelection(range)
    }
    return this;
};

proto.insertElement = function ( el, range ) {
    if ( !range ) { range = this.getSelection(); }
    range.collapse( true );
    if ( isInline( el ) ) {
        this.insertNodeInRange( range, el );
        range.setStartAfter( el );
    } else {
        // Get containing block node.
        var root = this._root;
        var splitNode = getStartBlockOfRange( range, root ) || root;
        var parent, nodeAfterSplit;
        // While at end of container node, move up DOM tree.
        while ( splitNode !== root && !splitNode.nextSibling ) {
            splitNode = splitNode.parentNode;
        }
        // If in the middle of a container node, split up to root.
        if ( splitNode !== root ) {
            parent = splitNode.parentNode;
            nodeAfterSplit = split( parent, splitNode.nextSibling, root, root );
        }
        if ( nodeAfterSplit ) {
            root.insertBefore( el, nodeAfterSplit );
        } else {
            root.appendChild( el );
            // Insert blank line below block.
            nodeAfterSplit = this.createDefaultBlock();
            root.appendChild( nodeAfterSplit );
        }
        range.setStart( nodeAfterSplit, 0 );
        range.setEnd( nodeAfterSplit, 0 );
        moveRangeBoundariesDownTree( range );
    }
    this.focus();
    this.setSelection( range );
    this._updatePath( range );

    if ( !canObserveMutations ) {
        this._docWasChanged();
    }

    return this;
};

proto.insertImage = function ( src, attributes ) {
    var img = this.createElement( 'IMG', mergeObjects({
        src: src
    }, attributes, true ));
    this.insertElement( img );
    return img;
};

var linkRegExp = /\b((?:(?:ht|f)tps?:\/\/|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,}\/)(?:[^\s()<>]+|\([^\s()<>]+\))+(?:\((?:[^\s()<>]+|(?:\([^\s()<>]+\)))*\)|[^\s`!()\[\]{};:'".,<>?«»“”‘’]))|([\w\-.%+]+@(?:[\w\-]+\.)+[A-Z]{2,}\b)/i;

var addLinks = function ( frag, root, self ) {
    var doc = frag.ownerDocument,
        walker = new TreeWalker( frag, SHOW_TEXT,
                function ( node ) {
            return !getNearest( node, root, 'A' );
        }, false ),
        defaultAttributes = self._config.tagAttributes.a,
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
            child = self.createElement( 'A', mergeObjects({
                href: match[1] ?
                    /^(?:ht|f)tps?:/.test( match[1] ) ?
                        match[1] :
                        'http://' + match[1] :
                    'mailto:' + match[2]
            }, defaultAttributes, false ));
            child.textContent = data.slice( index, endIndex );
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
    var range = this.getSelection();
    var doc = this._doc;
    var startFragmentIndex, endFragmentIndex;
    var div, frag, root, node, event;

    // Edge doesn't just copy the fragment, but includes the surrounding guff
    // including the full <head> of the page. Need to strip this out. If
    // available use DOMPurify to parse and sanitise.
    if ( typeof DOMPurify !== 'undefined' && DOMPurify.isSupported ) {
        frag = DOMPurify.sanitize( html, {
            WHOLE_DOCUMENT: false,
            RETURN_DOM: true,
            RETURN_DOM_FRAGMENT: true
        });
        frag = doc.importNode( frag, true );
    } else {
        if ( isPaste ) {
            startFragmentIndex = html.indexOf( '<!--StartFragment-->' );
            endFragmentIndex = html.lastIndexOf( '<!--EndFragment-->' );
            if ( startFragmentIndex > -1 && endFragmentIndex > -1 ) {
                html = html.slice( startFragmentIndex + 20, endFragmentIndex );
            }
        }
        // Parse HTML into DOM tree
        div = this.createElement( 'DIV' );
        div.innerHTML = html;
        frag = doc.createDocumentFragment();
        frag.appendChild( empty( div ) );
    }

    // Record undo checkpoint
    this.saveUndoState( range );

    try {
        root = this._root;
        node = frag;
        event = {
            fragment: frag,
            preventDefault: function () {
                this.defaultPrevented = true;
            },
            defaultPrevented: false
        };

        addLinks( frag, frag, this );
        cleanTree( frag );
        collapseSimpleSpans( frag )
        mergeInlines( frag, range )
        cleanupBRs( frag, null );
        removeEmptyInlines( frag );
        frag.normalize();
        ensureBrAtEndOfAllLines(frag)
        //NATE: This is a clear spot to do something of the sort:
        // registeredFilters.each(function(filter){filter(frag)})

        while ( node = getNextBlock( node, frag ) ) {
            fixCursor( node, null );
        }

        if ( isPaste ) {
            this.fireEvent( 'willPaste', event );
        }

        if ( !event.defaultPrevented ) {
            insertTreeFragmentIntoRange( range, event.fragment, root );
            if ( !canObserveMutations ) {
                this._docWasChanged();
            }
            range.collapse( false );
            this._ensureBottomLine();
        }

        this.setSelection( range );
        this._updatePath( range, true );
        // Safari sometimes loses focus after paste. Weird.
        if ( isPaste ) {
            this.focus();
        }
    } catch ( error ) {
        this.didError( error );
    }
    return this;
};

var escapeHTMLFragement = function ( text ) {
    return text.split( '&' ).join( '&amp;' )
               .split( '<' ).join( '&lt;'  )
               .split( '>' ).join( '&gt;'  )
               .split( '"' ).join( '&quot;'  );
};

proto.insertPlainText = function ( plainText, isPaste ) {
    var lines = plainText.split( '\n' );
    var config = this._config;
    var tag = config.blockTag;
    var attributes = config.blockAttributes;
    var closeBlock  = '</' + tag + '>';
    var openBlock = '<' + tag;
    var attr, i, l, line;

    for ( attr in attributes ) {
        openBlock += ' ' + attr + '="' +
            escapeHTMLFragement( attributes[ attr ] ) +
        '"';
    }
    openBlock += '>';

    for ( i = 0, l = lines.length; i < l; i += 1 ) {
        line = lines[i];
        line = escapeHTMLFragement( line ).replace( / (?= )/g, '&nbsp;' );
        // Wrap all but first/last lines in <div></div>
        if ( i && i + 1 < l ) {
            line = openBlock + ( line || '<BR>' ) + closeBlock;
        }
        lines[i] = line;
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
        this.insertNodeInRange(
            range,
            this._doc.createTextNode( url.slice( protocolEnd ) )
        );
    }
    attributes = mergeObjects(
        mergeObjects({
            href: url
        }, attributes, true ),
        this._config.tagAttributes.a,
        false
    );

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
    this.changeFormat( name ? {
        tag: 'SPAN',
        attributes: {
            'class': 'font',
            style: 'font-family: ' + name + ', sans-serif;'
        }
    } : null, {
        tag: 'SPAN',
        attributes: { 'class': 'font' }
    });
    return this.focus();
};
proto.setFontSize = function ( size ) {
    this.changeFormat( size ? {
        tag: 'SPAN',
        attributes: {
            'class': 'size',
            style: 'font-size: ' +
                ( typeof size === 'number' ? size + 'px' : size )
        }
    } : null, {
        tag: 'SPAN',
        attributes: { 'class': 'size' }
    });
    return this.focus();
};

proto.setTextColour = function ( colour ) {
    this.changeFormat( colour ? {
        tag: 'SPAN',
        attributes: {
            'class': 'colour',
            style: 'color:' + colour
        }
    } : null, {
        tag: 'SPAN',
        attributes: { 'class': 'colour' }
    });
    return this.focus();
};

proto.setHighlightColour = function ( colour ) {
    this.changeFormat( colour ? {
        tag: 'SPAN',
        attributes: {
            'class': 'highlight',
            style: 'background-color:' + colour
        }
    } : colour, {
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
            if ( node.nodeType === TEXT_NODE || node.nodeName === 'BR' || node.nodeName === 'IMG' ) {
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

    var root = this._root;
    var stopNode = range.commonAncestorContainer;
    while ( stopNode && !isBlock( stopNode ) ) {
        stopNode = stopNode.parentNode;
    }
    if ( !stopNode ) {
        expandRangeToBlockBoundaries( range, root );
        stopNode = root;
    }
    if ( stopNode.nodeType === TEXT_NODE ) {
        return this;
    }

    // Record undo point
    this.saveUndoState( range );

    // Avoid splitting where we're already at edges.
    moveRangeBoundariesUpTree( range, stopNode );

    // Split the selection up to the block, or if whole selection in same
    // block, expand range boundaries to ends of block and split up to root.
    var doc = stopNode.ownerDocument;
    var startContainer = range.startContainer;
    var startOffset = range.startOffset;
    var endContainer = range.endContainer;
    var endOffset = range.endOffset;

    // Split end point first to avoid problems when end and start
    // in same container.
    var formattedNodes = doc.createDocumentFragment();
    var cleanNodes = doc.createDocumentFragment();
    var nodeAfterSplit = split( endContainer, endOffset, stopNode, root );
    var nodeInSplit = split( startContainer, startOffset, stopNode, root );
    var nextNode, childNodes;

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
    range.setStart( stopNode, startOffset );
    range.setEnd( stopNode, endOffset );
    mergeInlines( stopNode, range );

    // And move back down the tree
    moveRangeBoundariesDownTree( range );

    this.setSelection( range );
    this._updatePath( range, true );

    return this.focus();
};

proto.increaseQuoteLevel = command( 'modifyBlocks', increaseBlockQuoteLevel );
proto.decreaseQuoteLevel = command( 'modifyBlocks', decreaseBlockQuoteLevel );

proto.increaseIndentLevel = command( 'modifyBlocks', increaseIndentLevel )
// TODO: NATE: should this be decreaseListLevel?
proto.decreaseIndentLevel = proto.decreaseQuoteLevel

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
