/*jshint strict:false, undef:false, unused:false */

var inlineNodeNames  = /^(?:#text|A(?:BBR|CRONYM)?|B(?:R|D[IO])?|C(?:ITE|ODE)|D(?:ATA|EL|FN)|EM|FONT|HR|I(?:MG|NPUT|NS)?|KBD|Q|R(?:P|T|UBY)|S(?:AMP|MALL|PAN|TR(?:IKE|ONG)|U[BP])?|U|VAR|WBR|Z)$/;
window.inn = inlineNodeNames
var leafNodeNames = {
    BR: 1,
    IMG: 1,
    INPUT: 1,
    CITE: 1,
    Z: 1
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

// Not all nodes have isContentEditable defined, but once we find a node with it defined
// it will search up the parentNode list for us and figure out if any are not editable
function notEditable( node ){
    if(!node){
        return false
    }
    if(node.isContentEditable === undefined){
        return(notEditable(node.parentNode))
    }
    else{
        return (node.isContentEditable === false)
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
            doc.body, SHOW_ELEMENT, function(node){return(isBlock(node)  && !notEditable(node))}, false );
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
        if ( l && isInline( child ) && !isZWS(child) && areAlike( child, prev ) &&
                !leafNodeNames[ child.nodeName ] ) {
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