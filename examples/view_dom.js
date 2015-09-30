( function ( doc, undefined ) {

function d3NodeName(domNode){
    if(domNode.nodeType === Node.TEXT_NODE){
        return "'" + domNode.data + "'"
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
    for(i=0; i<numChildren; i++){
        childNode = children[i]        
        res["children"][i] = parseElement(childNode)
    }
    return res
}

function findD3Node(d3Tree, domNode){
    var res = null;
    var i
    el = d3Tree.node
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
    var d3Node = findD3Node(d3Tree, sc);
    var domNode;
    var tData;
    window.d3n = d3Node
    if(d3Node){
        // d3Node.name = "HIGHLIGHTED"
        domNode = d3Node.node
        if(domNode.nodeType === Node.TEXT_NODE){
            d3Node.highlighted = true
            tData = domNode.data
            d3Node.name = "'" + tData.substr(0, so) + '|' + tData.substr(so) + "'";

        }
        else{
            d3Node.highlighted = true
            if(d3Node.children && d3Node.children.length > 0){
                d3Node.highlightedChild = d3Node.children[so]
            }
        }
    }
    update(d3Node)
}

function unHighlightAll(d3Tree){
    var i;
    if(d3Tree.highlighted){
        d3Tree.highlighted = false
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
function ViewDom ( domNode ) {
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

    var tree = d3.layout.tree().nodeSize([70, 40]);
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
            return d.highlighted ? "green" : "black";
            })
            .attr("stroke-width", function (d) {
            return d.highlighted ? 3 : 1;
            })
            .style("fill", function (d) {
            return d._children ? "lightsteelblue" : "#fff";
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
        });

        // Transition links to their new position.
        link.transition()
            .duration(duration)
            .attr("stroke", function(d){
                if(d.source.highlighted && d.source.highlightedChild === d.target){
                    return "green"
                }
                return "#ccc"
            })
            .attr("stroke-width", function(d){
                if(d.source.highlighted && d.source.highlightedChild === d.target){
                    return 3
                }
                return 1
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

    // Toggle children on click.
    function click(d) {
        if (d.children) {
            d._children = d.children;
            d.children = null;
        } else {
            d.children = d._children;
            d._children = null;
        }
        update(d);
    }

    // IE loses selection state of iframe on blur, so make sure we
    // cache it just before it loses focus.
}

var proto = ViewDom.prototype;
proto.highlightRange = highlightRange;

proto.parseRoot = function(){
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