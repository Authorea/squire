/*jshint strict:false, undef:false, unused:false */

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
         if(whiteList[c]){
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
        filterAttributes(node, {data: 1})
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

/*
    Two purposes:

    1. Remove nodes we don't want, such as weird <o:p> tags, comment nodes
       and whitespace nodes.
    2. Convert inline tags into our preferred format.

    Nate:  This is currenty used by setHTML when importing html, which was its original useage,
    and by the backspace key to clean up any inconsistencies.  We should look at whether or not
    calling it from backspace is really useful.
*/
var cleanTree = function cleanTree ( node ) {
    var children = node.childNodes,
        nonInlineParent, i, l, child, nodeName, nodeType, rewriter, childLength,
        startsWithWS, endsWithWS, data, sibling;

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

// NATE: TODO: make sure this does not apply to other blocks
var ensureBrAtEndOfAllLines = function (root){
    var lines = root.childNodes
    var i = 0
    var div, lastChild, br
    for(i=0; i<lines.length; i++){
        div = lines[i]
        if(div.nodeName === 'DIV'){
            lastChild = div.lastChild
            if(!lastChild || lastChild.nodeName !== 'BR'){
                br = createElement( div.ownerDocument, 'BR' )
                div.appendChild(br)
            }
        }
    }
}

// NATE: TODO: make sure this does not apply to other blocks
var removeBrAtEndOfAllLines = function (root){
    var lines = root.childNodes
    var i = 0
    var div, lastChild, br
    for(i=0; i<lines.length; i++){
        div = lines[i]
        if(div.nodeName === 'DIV'){
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

Squire.Clean.stylesRewriters = stylesRewriters
