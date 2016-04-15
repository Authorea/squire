( function ( doc, undefined ) {

var replaceMapping = {}
replaceMapping['\u200B'] = '*'
replaceMapping['\u200D'] = '\u00B7'
replaceMapping['\uFEFF'] = '\u00B7'
function replaceChars(s, mapping){
    var res = s
    var regEx
    $.each(mapping, function(k,v){
        regEx = new RegExp(k, 'g')
        res = res.replace(k, v)
    })
    return res
}
function d3NodeName(domNode){
    if(domNode.nodeType === Node.TEXT_NODE){
        // return "'" + domNode.data.replace(/[\u200B]/g, '*') + "'"
        return "'" + replaceChars(domNode.data, replaceMapping) + "'"
    }

    return domNode.nodeName
}

function parseElement(el){
    var res = {}
    var i
    var children = el.childNodes
    var childNode = null
    var numChildren = children.length
    res["name"] = d3NodeName(el)
    res["node"] = el
    res["children"] = new Array(numChildren)
    if(el.isContentEditable === undefined){
        res["isContentEditable"] = true
    }
    else{
        res["isContentEditable"] = el.isContentEditable
    }
    for(i=0; i<numChildren; i++){
        childNode = children[i]
        res["children"][i] = parseElement(childNode)
    }
    return res
}

function findD3Node(d3Tree, domNode){
    var res = null;
    var i
    var el = d3Tree.node
    if(el === domNode){
        return d3Tree
    }
    else if(el.nodeType === Node.TEXT_NODE){
        return null;
    }
    var children = d3Tree.children
    var numChildren = children && children.length || 0

    for(i=0; i<numChildren; i++){
        res = findD3Node(children[i], domNode)
        if(res){
            return res
        }
    }

    return null

}

function highlightRange(d3Tree, range){
    unHighlightAll(d3Tree)
    var sc = range.startContainer;
    var so = range.startOffset;
    var ec = range.endContainer;
    var eo = range.endOffset;
    var d3Node = findD3Node(d3Tree, sc);
    var d3EndNode = range.collapsed ? null : findD3Node(d3Tree, ec)
    var domNode;
    var tData;
    if(d3Node){
        domNode = d3Node.node
        d3Node.startOfRange = true
        if(domNode.nodeType === Node.TEXT_NODE){
            d3Node.highlighted = true
            tData = domNode.data
            d3Node.name = d3Node.name.substr(0, so+1) + '|' + d3Node.name.substr(so+1);

        }
        else{
            d3Node.highlighted = true
            if(d3Node.children && d3Node.children.length > 0){
                d3Node.highlightedChild = d3Node.children[so]
            }
        }

    }
    if(d3EndNode){
        domNode = d3EndNode.node
        d3EndNode.endOfRange = true
        if(domNode.nodeType === Node.TEXT_NODE){
            d3EndNode.highlighted = true
            tData = domNode.data
            // Name has already been updated by d3Node if statement
            if(d3EndNode === d3Node){
                //we'll make the assumption that the insertions are ordered with eo > so
                d3EndNode.name = d3EndNode.name.substr(0, eo+3) + '|' + d3EndNode.name.substr(eo+3);
            }
            else{
                d3EndNode.name = d3Node.name.substr(0, eo+1) + '|' + d3Node.name.substr(eo+1);
            }

        }
        else{
            d3EndNode.highlighted = true
            if(d3EndNode.children && ( d3EndNode.children.length > eo)){
                d3EndNode.highlightedEndChild = d3EndNode.children[eo]
            }
            else if(d3EndNode.children && ( d3EndNode.children.length > (eo - 1))   ){
               d3EndNode.highlightedEndChild = d3EndNode.children[eo-1]
            }
        }

    }
    update(d3Node)
}

function unHighlightAll(d3Tree){
    var i;
    if(d3Tree.highlighted){
        d3Tree.highlighted = false
        d3Tree.startOfRange = false
        d3Tree.endOfRange = false
        d3Tree.name = d3NodeName(d3Tree.node)
        d3Tree.highlightedChild = undefined
    }
    var children = d3Tree.children
    var numChildren = children && children.length || 0

    for(i=0; i<numChildren; i++){
        unHighlightAll(children[i])
    }
}

window.ViewDom = ViewDom;
function ViewDom ( domNode, options ) {
    this.self = this
    var replaceChars = {}
    replaceChars['\u200B'] = '*'
    replaceChars['\u200D'] = '\u00B7'
    this.options = {
        replaceChars: replaceChars
    }
    $(this.options).extend(options)
    this.rootNode = domNode
    var margin = {
        top: 20,
        right: 120,
        bottom: 20,
        left: 120
    },
    width = 960 - margin.right - margin.left,
    height = 800 - margin.top - margin.bottom;

    var root = parseElement(this.rootNode)

    var i = 0,
        duration = 200,
        rectW = 60,
        rectH = 30;

    var tree = d3.layout.tree().nodeSize([65, 50]);
    tree.separation(function(a, b){
      return a.parent == b.parent ? 1 : 1.2;

    })
    var diagonal = d3.svg.diagonal()
        .projection(function (d) {
        return [d.x + rectW / 2, d.y + rectH / 2];
    });

    var svg = d3.select("#d3").append("svg").attr("width", 1000).attr("height", 1000)
        .append("g").attr("transform", "translate(" + 350 + "," + 20 + ")");

    this._tree = tree
    this._svg = svg
    this._root = root
    this._r = root

    root.x0 = 0;
    root.y0 = height / 2;

    function collapse(d) {
        if (d.children) {
            d._children = d.children;
            d._children.forEach(collapse);
            d.children = null;
        }
    }

    this.update = update
    var self = this
    update(root);

    function update(source) {
        // Compute the new tree layout.
        var nodes = self._tree.nodes(self._root).reverse(),
            links = tree.links(nodes);

        // Normalize for fixed-depth.
        nodes.forEach(function (d) {
            d.y = d.depth * 50;
        });

        // Update the nodes…
        var node = svg.selectAll("g.node")
            .data(nodes, function (d) {
            return d.id || (d.id = ++i);
        });

        // Enter any new nodes at the parent's previous position.
        var nodeEnter = node.enter().append("g")
            .attr("class", "node")
            .attr("cursor", "pointer")
            .attr("transform", function (d) {
            return "translate(" + source.x0 + "," + source.y0 + ")";
        })
            .on("click", click);

        nodeEnter.append("rect")
            .attr("width", rectW)
            .attr("height", rectH)
            .attr("stroke", "black")
            .attr("stroke-width", 1)
            .style("fill", function (d) {
            return d._children ? "lightsteelblue" : "#fff";
        });

        nodeEnter.append("text")
            .attr("x", rectW / 2)
            .attr("y", rectH / 2)
            .attr("dy", ".35em")
            .attr("text-anchor", "middle")
            .attr({ "font-size": 12, "font-family": "Arial, Helvetica, sans-serif" })
            .text(function (d) {
            return d.name;
        });

        // Transition nodes to their new position.
        var nodeUpdate = node.transition()
            .duration(duration)
            .attr("transform", function (d) {
            return "translate(" + d.x + "," + d.y + ")";
        });

        nodeUpdate.select("rect")
            .attr("width", rectW)
            .attr("height", rectH)
            .attr("stroke", function (d) {
                if(d.highlighted && d.startOfRange && d.endOfRange){
                    return "purple"
                }
                else if(d.highlighted && d.startOfRange){
                    return "green"
                }
                else if(d.highlighted && d.endOfRange){
                    return "red"
                }
                return "black"
            })
            .attr("stroke-width", function (d) {
            return d.highlighted ? 3 : 1;
            })
            .style("fill", function (d) {
            return !d.isContentEditable ? "pink" : "#fff";
            });

        nodeUpdate.select("text")
            .style("fill-opacity", 1)
            .text(function (d) {
                return d.name;
            });

        // Transition exiting nodes to the parent's new position.
        var nodeExit = node.exit().transition()
            .duration(duration)
            .attr("transform", function (d) {
            return "translate(" + source.x + "," + source.y + ")";
        })
            .remove();

        nodeExit.select("rect")
            .attr("width", rectW)
            .attr("height", rectH)
            .attr("stroke", "black")
            .attr("stroke-width", 1);

        nodeExit.select("text");

        // Update the links…
        var link = svg.selectAll("path.link")
            .data(links, function (d) {
            return d.target.id;
        });

        // Enter any new links at the parent's previous position.
        link.enter().insert("path", "g")
            .attr("class", "link")
            .attr("x", rectW / 2)
            .attr("y", rectH / 2)
            .attr("cursor", "pointer")
            .attr("stroke-width", 1)
            .attr("stroke", "#ccc")
            .style("fill", "none")
            .attr("d", function (d) {
            var o = {
                x: source.x0,
                y: source.y0
            };
            return diagonal({
                source: o,
                target: o
            });
        }).on("click", click);

        // Transition links to their new position.
        link.transition()
            .duration(duration)
            .attr("stroke", function(d){
                if(d.source.highlighted && d.source.highlightedChild === d.target){
                        return "green"
                }
                else if(d.source.endOfRange && d.source.highlightedEndChild === d.target){
                    return "red"
                }
                return "#ccc"
            })
            .attr("stroke-width", function(d){
                if(d.source.highlighted && d.source.highlightedChild === d.target){
                    return 3
                }
                else if(d.source.endOfRange && d.source.highlightedEndChild === d.target){
                    return 3
                }
                return 3
            })
            .attr("d", diagonal);

        // Transition exiting nodes to the parent's new position.
        link.exit().transition()
            .duration(duration)
            .attr("d", function (d) {
            var o = {
                x: source.x,
                y: source.y
            };
            return diagonal({
                source: o,
                target: o
            });
        })
            .remove();

        // Stash the old positions for transition.
        nodes.forEach(function (d) {
            d.x0 = d.x;
            d.y0 = d.y;
        });
    }
    window.update = update

    function click(d) {
        var event = new CustomEvent('ViewDom::NodeClicked',
            { 'detail':
                {
                    'd3Node': d,
                    'link': d.source,
                    'node':d.node,
                    'sourceNode': d.source,
                    'targetNode': d.target,
                    'startOfRange': !(d3.event.ctrlKey || d3.event.shiftKey)
                }
        });

        document.dispatchEvent(event);
        update(d);
    }

    // IE loses selection state of iframe on blur, so make sure we
    // cache it just before it loses focus.
}

ViewDom.prototype.highlightRange = highlightRange;

ViewDom.prototype.parseRoot = function(){
    var domNode, oldNode
    this._new_root = parseElement(this.rootNode)
    var oldRoot = this._r
    this._new_nodes = this._tree.nodes(this._new_root)
    this._new_nodes.forEach(function(node){
        domNode = node.node
        oldNode = findD3Node(oldRoot, domNode)
        if(oldNode){
            node.id  = oldNode.id
            node.x   = oldNode.x
            node.x0  = oldNode.x0
            node.y   = oldNode.y
            node.y0  = oldNode.y0
        }
    })
    this._r = this._root = this._new_root
    this.update(this._new_root)
}

}( document ) );
