(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('d3-array')) :
    typeof define === 'function' && define.amd ? define(['exports', 'd3-array'], factory) :
    (factory((global.d3 = global.d3 || {}),global.d3Array));
}(this, function (exports,d3Array) { 'use strict';

    function barcodetree() {
        //  the parameters of the BarcodeTree
        var width = 600,
            height = 350,
    	    margin = {right: width * 0.02, left: width * 0.02, top: height * 0.02, bottom: height * 0.02},
            bctNodeHeight = 40,
            bctNodeWidth = 10,
            bctRootNodeWidth = 20,
            bctLeafNodeWidth = 2,
            bctNodeWidthArray = [],
            bctNodeHeightArray = [],
            spacing = 5,
            structureCueSpacing = bctNodeHeight * 0.05,
            structureCueHeight = bctNodeHeight * 0.1,
            structureCueStroke = bctNodeHeight * 0.025,
            colourScheme = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"],
            barcodeTreeType = 'bct_h', // 'bct_w' or "bct_h"
            valueEncoding = 'color', // 'null' or 'color' or 'height'
            descendantSegment = true // the structure cue of the descendants nodes are segmented or not
        var hoveringTrigger = function(){}
        var unhoveringTrigger = function(){}

        function barcodetree(selection, dataset) {
            if ((selection == null) || (typeof(selection) === 'undefined')) {
                console.log('barcodetree')
                return
            }
            var svg = d3.select(selection)
                .attr('width', width + margin.left + margin.right)
                .attr('height', height + margin.top + margin.bottom)
            var g = svg.selectAll('.container')
                .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')	
            var bctElementArray = dfs(dataset)
            var bctNodeArray = []
            var nodeDepthRange = d3.extent(bctElementArray, function(obj){
                return +obj.depth
            })
            var nodeMaxValue = d3.max(bctElementArray, function(obj){
                return +obj.value
            })
            var valueScale = d3.scaleLinear()
                .domain([0, nodeMaxValue])
                .range([0, 1])
            //  compute the color scale of the barcode node value
            var colorArray = ["#ffffcc", "#ffeda0", '#fed976', '#feb24c', '#fd8d3c', '#fc4e2a', '#e31a1c', '#bd0026', '#800026']
            var colorDomainArray = []
            var colorNum = colorArray.length
            for (var cI = 0; cI < colorNum; cI++) {
                colorDomainArray.push(cI / colorNum)
            }
            var colorScale = d3.scaleLinear().domain(colorDomainArray).range(colorArray)   
            //  compute the barcode node attribute array according to the configuration          
            if (barcodeTreeType === 'bct_w') {
                var bctNodeWidthArray = bct_width_array(bctRootNodeWidth, bctLeafNodeWidth, nodeDepthRange)
                bctNodeArray = bct_w_encode(bctElementArray, bctNodeWidthArray, bctNodeHeight, spacing, valueScale, colorScale, valueEncoding)
            } else if(barcodeTreeType === 'bct_h') {
                var bctNodeHeightArray = bct_height_array(bctNodeHeight, nodeDepthRange)
                bctNodeArray = bct_h_encode(bctElementArray, bctNodeWidth, bctNodeHeightArray, spacing, valueScale, colorScale, valueEncoding)
            }
            var barcodeTreeNodes = g.selectAll('.barcodetree-node')
                .data(bctNodeArray)
            barcodeTreeNodes.enter()
                .append('rect')
                .attr('id', function(d) {
                    return d.name
                })
                .attr('x', function(d) {
                    return d.x
                })
                .attr('y', function(d) {
                    return d.y
                })
                .attr('width', function(d) {
                    return d.width
                })
                .attr('height', function(d) {
                    return d.height
                })
                .attr('fill', function(d) {
                    return d.color
                })
                .on('mouseover', function(d, i) {
                    add_descendant_structure_cue(d, i, bctNodeArray, g)
                    add_ancestor_structure_cue(d, i, bctNodeArray, g)
                    add_sibling_structure_cue(d, i, bctNodeArray, g)
                })
                .on('mouseout', function(d, i) {
                    remove_structure_cue(g)
                })
            barcodeTreeNodes.attr('x', function(d) {
                    return d.x
                })
                .attr('y', function(d) {
                    return d.y
                })
                .attr('width', function(d){
                    return d.width
                })
                .attr('height', function(d){
                    return d.height
                })
                .attr('fill', function(d){
                    return d.color
                })
            barcodeTreeNodes.exit().remove()
        }
        //  remove all the structure cue when unhovering the nodes
        function remove_structure_cue(g) {
            g.selectAll('.structure-cue')
            .remove()     
        }
        //  add the descendant structure cue to the hovering nodes
        function add_descendant_structure_cue(nodeobj, index, bctNodeArray, g) {
            var descendantStructureCueArray = compute_descendant_structure_cue(nodeobj, index, bctNodeArray)
            var barcodetreeNodeBottomY = nodeobj.y + nodeobj.height        
            var structureCueY = barcodetreeNodeBottomY + structureCueSpacing + structureCueHeight / 2
            for (var dI = 0;dI < descendantStructureCueArray.length;dI++) {
                var descendantStructureCue = descendantStructureCueArray[dI]
                var startX = descendantStructureCue.start_x
                var endX = descendantStructureCue.end_x
                g.append('line')
                    .attr('class', 'structure-cue')
                    .attr("x1", startX)
                    .attr("y1", structureCueY)
                    .attr("x2", endX)
                    .attr("y2", structureCueY)
                    .style('stroke', 'red')
                    .style('stroke-width', structureCueStroke + 'px')
            }
        }
        //  compute the structure cue of the descendant nodes
        function compute_descendant_structure_cue (nodeobj, index, bctNodeArray) {
            var nodeDepth = nodeobj.depth
            var childNodeDepth = nodeDepth + 1
            var descendantStructureCueArray = []
            if (descendantSegment) {
                // the structure cue of descendant nodes are segmented
                var childrenNodeArray = []
                //  if the structure cue of the children nodes are segmented, 
                //  compute each structure cue for each children of the hovering nodes
                for (var bI = (index + 1); bI < bctNodeArray.length; bI++) {
                    var barcodeTreeNode = bctNodeArray[bI] 
                    //  if the node depth is the depth of the children nodes           
                    if (barcodeTreeNode.depth === childNodeDepth) {
                        if (childrenNodeArray.length !== 0) {
                            var descendantStructureCue = compute_structure_cue_range(childrenNodeArray)
                            descendantStructureCueArray.push(descendantStructureCue)
                            childrenNodeArray = []
                        }
                    }
                    //  if the node depth is the depth of the root nodes           
                    if (barcodeTreeNode.depth === nodeDepth) {
                        if (childrenNodeArray.length !== 0) {
                            var descendantStructureCue = compute_structure_cue_range(childrenNodeArray)
                            descendantStructureCueArray.push(descendantStructureCue)
                            childrenNodeArray = []
                        }                  
                        break
                    }
                    childrenNodeArray.push(barcodeTreeNode)
                }
                //  when finish the traversal, add the structure cue of the descendant nodes
                if (childrenNodeArray.length !== 0) {
                    var descendantStructureCue = compute_structure_cue_range(childrenNodeArray)
                    descendantStructureCueArray.push(descendantStructureCue)
                    childrenNodeArray = []
                }            
            } else {
                //  the structure cue of the children nodes are not segmented
                var descendantNodeArray = []
                for (var bI = (index + 1); bI < bctNodeArray.length; bI++) {    
                    descendantNodeArray.push(bctNodeArray[bI])
                    //  only get the descendant nodes of the hovering items
                    if (barcodeTreeNode.depth === nodeDepth) {
                        break
                    }
                }
                //  only compute one structure cue of the children nodes
                var descendantStructureCue = compute_structure_cue_range(descendantNodeArray)
                descendantStructureCueArray.push(descendantStructureCue)
            }
            return descendantStructureCueArray
        }
        //  add the ancestor structure cue to the hovering nodes
        //  specifically, the ancestor node include the hovering node
        function add_ancestor_structure_cue(nodeobj, index, bctNodeArray, g) {
            var ancestorStructureCueArray = compute_ancestor_structure_cue(nodeobj, index, bctNodeArray)
            var barcodetreeNodeBottomY = nodeobj.y + nodeobj.height        
            var structureCueY = barcodetreeNodeBottomY + structureCueSpacing + structureCueHeight / 2
            for (var dI = 0;dI < ancestorStructureCueArray.length;dI++) {
                var ancestorStructureCue = ancestorStructureCueArray[dI]
                var startX = ancestorStructureCue.start_x
                var endX = ancestorStructureCue.end_x
                g.append('line')
                    .attr('class', 'structure-cue')
                    .attr("x1", startX)
                    .attr("y1", structureCueY)
                    .attr("x2", endX)
                    .attr("y2", structureCueY)
                    .style('stroke', 'red')
                    .style('stroke-width', structureCueStroke + 'px')
            }
        }
        //  compute the structure cue of the ancestor nodes, the ancestor node also include the hovering node
        //  specifically, the ancesotr node include the hovering node
        function compute_ancestor_structure_cue (nodeobj, index, bctNodeArray) {
            var findNodeDepth = nodeobj.depth
            var ancestorStructureCueArray = []
            for (var bI = index; bI >= 0; bI--) {
                var nodeObj = bctNodeArray[bI]
                if(nodeObj.depth == findNodeDepth) {
                    var ancestorNodeArray = [nodeObj]
                    var ancestorStructureCue = compute_structure_cue_range(ancestorNodeArray)
                    ancestorStructureCueArray.push(ancestorStructureCue)
                    findNodeDepth = findNodeDepth - 1
                }
            }
            return ancestorStructureCueArray
        }
        //  add the structure cue of the sibling nodes
        function add_sibling_structure_cue(nodeobj, index, bctNodeArray, g) {
            var siblingStructureCueArray = compute_sibling_structure_cue(nodeobj, index, bctNodeArray)
            var barcodetreeNodeBottomY = nodeobj.y + nodeobj.height   
            var siblingStructureCueTopY = barcodetreeNodeBottomY + structureCueSpacing
            var siblingStructureCueBottomY = barcodetreeNodeBottomY + structureCueSpacing + structureCueHeight
            for (var dI = 0;dI < siblingStructureCueArray.length;dI++) {
                var siblingStructureCueX = siblingStructureCueArray[dI]
                g.append('line')
                    .attr('class', 'structure-cue')
                    .attr("x1", siblingStructureCueX)
                    .attr("y1", siblingStructureCueTopY)
                    .attr("x2", siblingStructureCueX)
                    .attr("y2", siblingStructureCueBottomY)
                    .style('stroke', 'red')
                    .style('stroke-width', structureCueStroke + 'px')
            }
        }
        //  compute the structure cue of the sibling nodes
        function compute_sibling_structure_cue (nodeobj, index, bctNodeArray) {
            var nodeDepth = nodeobj.depth
            var parentNodeDepth = nodeobj.depth - 1
            var siblingNodeArray = []
            var siblingStructureCueArray = []
            //  to avoid dulicate the hovering nodes in the sibling nodes, 
            //  the first traversal starts from index, and ascendant to bctNodeArray.length
            for (var bI = index;bI < bctNodeArray.length;bI++) {
                var barcodeNode = bctNodeArray[bI]
                if (barcodeNode.depth === nodeDepth) {
                    var siblingStructureCue = compute_sibling_structure_cue_x(barcodeNode)
                    siblingStructureCueArray.push(siblingStructureCue)
                }
                if (barcodeNode.depth === parentNodeDepth) {
                    break
                }
            }
            //  the second traversal starts from the (index - 1), and descendant to 0
            for (var bI = (index - 1);bI >= 0;bI--) {
                var barcodeNode = bctNodeArray[bI]
                if (barcodeNode.depth === nodeDepth) {
                    var siblingStructureCue = compute_sibling_structure_cue_x(barcodeNode)
                    siblingStructureCueArray.push(siblingStructureCue)
                }
                if (barcodeNode.depth === parentNodeDepth) {
                    break
                }           
            }
            return siblingStructureCueArray
        }
        //  compute the hovering sibling cue
        function compute_sibling_structure_cue_x (barcode_node) {
            var barcodeNodeX = barcode_node.x
            var barcodeNodeWidth = barcode_node.width
            var barcodeNodeSiblingX = barcodeNodeX + barcodeNodeWidth / 2
            return barcodeNodeSiblingX
        }
        //  compute the range of the nodes in the node array
        function compute_structure_cue_range(barcode_node_array) {
            var minX = 10000000
            var maxX = 0
            for (var bI = 0; bI < barcode_node_array.length; bI++) {
                var nodeObj = barcode_node_array[bI]
                var nodeStartX = nodeObj.x
                var nodeEndX = nodeObj.x + nodeObj.width
                if (nodeStartX < minX) {
                    minX = nodeStartX
                }
                if (nodeEndX > maxX) {
                    maxX = nodeEndX
                }
            }
            var structureCueRange = {
                start_x: minX,
                end_x: maxX
            }
            return structureCueRange
        }
        //  dfs traversal the hierarchical data to get the sequence of the elements
        function dfs(data) {
            var elementArray = []
            inner_dfs(data, elementArray)
            return elementArray
            function inner_dfs(data, elementArray) {
                elementArray.push(data)
                if (typeof(data.children) !== 'undefined') {
                    for (var cI = 0;cI < data.children.length;cI++) {
                        var childElement = data.children[cI]
                        inner_dfs(childElement, elementArray)
                    }
                }
            }
        }
        //  encode the hierarchical data information according to bct_w, including the node depth and node attribute
        function bct_w_encode(element_array, width_array, height, spacing, valueScale, colorScale, valueEncoding) { 
            var xValue = 0
            for (var eI = 0;eI < element_array.length;eI++) {
                var element = element_array[eI]
                var elementDepth = element.depth
                var elementValue = element.value
                element.height = height
                element.width = width_array[elementDepth]
                element.x = xValue
                element.y = 0
                element.color = 'black'
                if (valueEncoding === 'color') {
                    element.color = colorScale(valueScale(elementValue))
                } else if (valueEncoding === 'height') {
                    element.height = valueScale(elementValue) * height
                    element.y = height - element.height
                }
                xValue = xValue + element.width + spacing
            }
            return element_array
        }
        //  encode the hierarchical data information to bct_h, including the node depth and attribute
        function bct_h_encode(element_array, width, height_array, spacing, valueScale, colorScale, valueEncoding) {
            var xValue = 0
            var rootNodeHeight = height_array[0]
            for (var eI = 0;eI < element_array.length;eI++) {
                var element = element_array[eI]
                var elementDepth = element.depth
                var elementValue = element.value
                element.width = width
                element.height = height_array[elementDepth]
                element.x = xValue
                element.y = rootNodeHeight - element.height
                element.color = 'black'
                if (valueEncoding === 'color') {
                    element.color = colorScale(valueScale(elementValue))
                }
                xValue = xValue + element.width + spacing
            }
            return element_array
        }
        //  compute the barcodeTree node width array
        function bct_width_array (bctRootNodeWidth, bctLeafNodeWidth, nodeDepthRange) {
            var bctNodeWidthArray = []
            var maxDepth = nodeDepthRange[1]
            var depthRange = nodeDepthRange[1] - nodeDepthRange[0]
            var nodeWidthGradient = (bctRootNodeWidth - bctLeafNodeWidth) / depthRange
            for (var dI = 0; dI <= maxDepth; dI++) {
                var widthIndex = maxDepth - dI
                bctNodeWidthArray.push(bctLeafNodeWidth + nodeWidthGradient * widthIndex)
            }
            return bctNodeWidthArray
        }
        //  compute the barcodeTree node height array
        function bct_height_array (bctNodeHeight, nodeDepthRange) {
            var bctNodeHeightArray = []
            var maxDepth = nodeDepthRange[1] + 1
            var depthRange = maxDepth - nodeDepthRange[0]
            var nodeHeightGradient = bctNodeHeight / depthRange
            for (var dI = 0; dI < maxDepth; dI++) {
                bctNodeHeightArray.push(bctNodeHeight - nodeHeightGradient * dI)
            }
            return bctNodeHeightArray
        }
        /**
         * The following function is to change the parameters of the view
         */
        //  change the width of the view
        barcodetree.width = function(value) {
            if (!arguments.length) return width
            if (typeof(value) !== 'number') {
                console.warn('invalid value for width', value)
                return
            }
            width = value
            return barcodetree        
        }
        //  change the height of the view
        barcodetree.height = function(value) {
            if (!arguments.length) return height
            if (typeof(value) !== 'number') {
                console.warn('invalid value for width', value)
                return
            }
            height = value
            return barcodetree        
        }
        //  change the margin of the view
        barcodetree.margin = function(value) {
            if (!arguments.length) return margin
            if (typeof(margin) !== 'object') {
                console.warn('invalid value for width', margin)
                return
            }
            margin = value
            return barcodetree        
        }
        //  change the node height of barcodeTree
        barcodetree.bctNodeHeight = function(value) {
            if (!arguments.length) return bctNodeHeight
            if (typeof(bctNodeHeight) !== 'number') {
                console.warn('invalid value for width', bctNodeHeight)
                return
            }
            bctNodeHeight = value
            return barcodetree        
        }
        //  this the average node width of BarcodeTree
        barcodetree.bctNodeWidth = function(value) {
            if (!arguments.length) return bctNodeWidth
            if (typeof(bctNodeWidth) !== 'number') {
                console.warn('invalid value for width', bctNodeWidth)
                return
            }
            bctNodeWidth = value
            return barcodetree        
        }
        //  this is the root node width of BarcodeTree
        barcodetree.bctRootNodeWidth = function(value) {
            if (!arguments.length) return bctRootNodeWidth
            if (typeof(bctRootNodeWidth) !== 'number') {
                console.warn('invalid value for width', bctRootNodeWidth)
                return
            }
            bctRootNodeWidth = value
            return barcodetree        
        }    
        //  this is the leaf node width of BarcodeTree
        barcodetree.bctLeafNodeWidth = function(value) {
            if (!arguments.length) return bctLeafNodeWidth
            if (typeof(bctLeafNodeWidth) !== 'number') {
                console.warn('invalid value for width', bctLeafNodeWidth)
                return
            }
            bctLeafNodeWidth = value
            return barcodetree        
        }  
        //  this is the spacing of between the nodes in BarcodeTree
        barcodetree.spacing  = function(value) {
            if (!arguments.length) return spacing
            if (typeof(spacing) !== 'number') {
                console.warn('invalid value for width', spacing)
                return
            }
            spacing = value
            return barcodetree
        } 
        //  this is the color schema of BarcodeTree when encoding the value to node color
        barcodetree.colourScheme  = function(value) {
            if (!arguments.length) return colourScheme
            if (typeof(colourScheme) !== 'object') {
                console.warn('invalid value for width', colourScheme)
                return
            }
            colourScheme = value
            return barcodetree
        } 
        //  this determine the category of BarcodeTree, 
        //  encoding node depth to width => bct_w, encoding node depth to height => bct_h
        barcodetree.barcodeTreeType  = function(value) {
            if (!arguments.length) return barcodeTreeType
            if (typeof(barcodeTreeType) !== 'string') {
                console.warn('invalid value for width', barcodeTreeType)
                return
            }
            barcodeTreeType = value
            return barcodetree
        } 
        //  this determine whether encoding the node value to BarcodeTree, or utilize which kind of encoding approach
        //  not encoding node value => null, encoding node value to height => height, encoding node value to color => color
        barcodetree.valueEncoding  = function(value) {
            if (!arguments.length) return valueEncoding
            if (typeof(valueEncoding) !== 'string') {
                console.warn('invalid value for width', valueEncoding)
                return
            }
            valueEncoding = value
            return barcodetree
        }
        //  this is the trigger function when hovering on BarcodeTree
        barcodetree.hoveringTrigger  = function(value) {
            if (!arguments.length) return hoveringTrigger
            if (typeof(hoveringTrigger) !== 'object') {
                console.warn('invalid value for width', hoveringTrigger)
                return
            }
            hoveringTrigger = value
            return barcodetree
        } 
        //  this is the trigger function when unhovering on the node of BarcodeTree
        barcodetree.unhoveringTrigger = function(value) {
            if (!arguments.length) return unhoveringTrigger
            if (typeof(unhoveringTrigger) !== 'string') {
                console.warn('invalid value for width', unhoveringTrigger)
                return
            }
            unhoveringTrigger = value
            return barcodetree
        }
        //  this is the spacing of the structure cue on the bottom of the barcodeTree
        barcodetree.structureCueSpacing  = function(value) {
            if (!arguments.length) return structureCueSpacing
            if (typeof(structureCueSpacing) !== 'number') {
                console.warn('invalid value for width', structureCueSpacing)
                return
            }
            structureCueSpacing = value
            return barcodetree
        }
        return barcodetree
    };

    exports.barcodetree = barcodetree;

    Object.defineProperty(exports, '__esModule', { value: true });

}));