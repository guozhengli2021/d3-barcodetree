(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('d3-array')) :
    typeof define === 'function' && define.amd ? define(['exports', 'd3-array'], factory) :
    (factory((global.d3 = global.d3 || {}),global.d3Array));
}(this, function (exports,d3Array) { 'use strict';

    var bctNodeHeight = 40;
    var bctNodeWidth = 10;
    var bctRootNodeWidth = 20;
    var bctLeafNodeWidth = 2;
    var bctLevelAttrArray = [];
    var bctLevelDisplayArray = [];
    var bctNodeArray = [];
    var bctElementArray = [];
    var collapsedArray = [];
    var spacing = 5;
    var triangleMaxWidth = 0;
    var triangleMaxHeight = 0;
    var triangleWidthScale = {};
    var triangleHeightScale = {};
    var bctNodeColor = "black";
    var structureCueSpacing = bctNodeHeight * 0.05;
    var structureCueHeight = bctNodeHeight * 0.1;
    var structureCueStroke = bctNodeHeight * 0.025;
    var colourScheme = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"];
    var barcodeTreeType = 'bct_w';
    var valueEncoding = 'color';
    var descendantSegment = true;
    var barcodetreeG = null;
    var transitionDuration = 1000;
    var dataset = null;
    var hoveringTrigger = function(){}
    var unhoveringTrigger = function(){}
    var clickTrigger = function(){}

    function barcodetree() {
        /*
         * dispatch the click and dbclick event
         */
        function clickcancel() {
          // we want to a distinguish single/double click
          // details http://bl.ocks.org/couchand/6394506
          var dispatcher = d3.dispatch('click', 'dblclick');
          function cc(selection) {
              var down, tolerance = 5, last, wait = null, args;
              // euclidean distance
              function dist(a, b) {
                  return Math.sqrt(Math.pow(a[0] - b[0], 2), Math.pow(a[1] - b[1], 2));
              }
              selection.on('mousedown', function() {
                  down = d3.mouse(document.body);
                  last = +new Date();
                  args = arguments;
              });
              selection.on('mouseup', function() {
                  if (dist(down, d3.mouse(document.body)) > tolerance) {
                      return;
                  } else {
                      if (wait) {
                          window.clearTimeout(wait);
                          wait = null;
                          dispatcher.apply("dblclick", this, args);
                      } else {
                          wait = window.setTimeout((function() {
                              return function() {
                                  dispatcher.apply("click", this, args);
                                  wait = null;
                              };
                          })(), 300);
                      }
                  }
              });
          };
          // Copies a variable number of methods from source to target.
          var d3rebind = function(target, source) {
            var i = 1, n = arguments.length, method;
            while (++i < n) target[method = arguments[i]] = d3_rebind(target, source, source[method]);
            return target;
          };
          // Method is assumed to be a standard D3 getter-setter:
          // If passed with no arguments, gets the value.
          // If passed with arguments, sets the value and returns the target.
          function d3_rebind(target, source, method) {
            return function() {
              var value = method.apply(source, arguments);
              return value === source ? target : value;
            };
          }
          return d3rebind(cc, dispatcher, 'on');
        }
        /**
         * 点击barcode收缩时先判断动画是否结束
         */
        function endall(transition, callback) {
          if (transition.size() === 0) {
            callback()
          }
          var n = 0;
          transition
            .each(function () {
              ++n;
            })
            .each("end", function () {
              if (!--n) callback.apply(this, arguments);
            });
        }
        /*
         * the function to render the barcodetree
         */
        function barcodetree(selection, paras) {
            if ((selection == null) || (typeof(selection) === 'undefined')) {
                console.log('barcodetree')
                return
            }
            // var svg = d3.select(selection)
            var svg = selection
            //  if the container are not empty, 
            //  then we can append the g which has the class container
            if(svg.select('.container').empty()) {
                barcodetreeG = svg.append('g')
                    .attr('class', 'container')
            } else {
                barcodetreeG = svg.select('.container')
            }
            if (dataset == null) {
                 return 0
            }
            //  only the paras is 'create', then the data will be updated
            if (paras === 'create') {
                compute_triangle_attr(dataset)
                bctElementArray = dfs(dataset)
                //  compute the maximum attribute of the triangle
                for (var bI = 0;bI < bctElementArray.length;bI++) {
                    var t_obj = bctElementArray[bI].t_obj
                    var t_height = t_obj.t_height
                    var t_width = t_obj.t_width
                    if (triangleMaxWidth < t_width) {
                        triangleMaxWidth = t_width
                    }
                    if (triangleMaxHeight < t_height) {
                        triangleMaxHeight = t_height
                    }
                }
                var nodeDepthRange = d3.extent(bctElementArray, function(obj){
                    return +obj.depth
                })
                //  setting the variables about whether to show the nodes at different levels of BCT
                //  if the variable bctLevelDisplayArray are empty, then the nodes of every level show be displayed
                if (bctLevelDisplayArray.length === 0) {
                    for (var dI = nodeDepthRange[0]; dI <= nodeDepthRange[1]; dI++) {
                        bctLevelDisplayArray.push(true)
                    }
                }
                for (var bI = 0; bI < bctElementArray.length; bI++) {
                    bctElementArray[bI].collapse_display = true
                }
            } 
            //  when the paras is "update", render the barcodeTree directly
            //  setting the variable “display” about whether to show the nodes
            for (var bI = 0; bI < bctElementArray.length; bI++) {
                bctElementArray[bI].level_display = bctLevelDisplayArray[bctElementArray[bI].depth]
            }            
            //  compute the scale of the triangle width and height
            triangleWidthScale = d3.scaleLinear().domain([0, triangleMaxWidth]).range([0, bctRootNodeWidth])
            triangleHeightScale = d3.scaleLinear().domain([0, triangleMaxHeight]).range([0, bctNodeHeight / 5])
            //  the function to layout the nodes of BarcodeTree        
            bctNodeArray = layout_barcodetree()
            //  the function to render the BarcodeTree
            render_barcodetree(bctNodeArray)
            update_triangle()
            console.log('bctNodeArray', bctNodeArray)
            var maxX = compute_max_x(bctNodeArray)
            return maxX
        }
        //  for the same data, only update the style of the BarcodeTree nodes
        function update_barcodetree(selection) {
            //  the function to layout the nodes of BarcodeTree        
            bctNodeArray = layout_barcodetree()
            //  the function to render the BarcodeTree
            render_barcodetree(bctNodeArray)
            update_triangle()
            var maxX = compute_max_x(bctNodeArray)
            return maxX
        }   
        //  compute the triangle attribute of the collapsed subtree
        function compute_triangle_attr(dataset) {
            dataset.t_obj = traversal_dataset(dataset)
            function traversal_dataset(dataset) {
                if (typeof(dataset.children) !== 'undefined') {
                    //  the initial sumnodes is 1, because it need to add the root node of the subtree
                    var sumNode = 1
                    var subtreeDepth = 0
                    for (var cI = 0;cI < dataset.children.length;cI++) {
                        var triangleAttrObj = traversal_dataset(dataset.children[cI])
                        dataset.children[cI].t_obj = triangleAttrObj
                        sumNode = sumNode + triangleAttrObj.t_width * triangleAttrObj.t_height
                        if (triangleAttrObj.t_height > subtreeDepth) {
                            subtreeDepth = triangleAttrObj.t_height
                        }
                    }
                    subtreeDepth = subtreeDepth + 1
                    var subtreeWidth = sumNode / subtreeDepth
                    return {t_width: subtreeWidth, t_height: subtreeDepth}
                } else {
                    //  then node is the leaf nodes => Both the width and height is 1 
                    return {t_width: 1, t_height: 1}
                }
            }
        }
        //  layout barcodeTree
        function layout_barcodetree() {
            //  计算barcodeTree节点的深度范围
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
                if (bctLevelAttrArray.length === 0) { // 当用户没有指定映射深度属性的数组中的数值时，需要计算得到；否则使用用户指定的属性数值
                    bctLevelAttrArray = bct_width_array(bctRootNodeWidth, bctLeafNodeWidth, nodeDepthRange)                    
                }
                console.log('bctNodeHeight', bctNodeHeight)
                bctNodeArray = bct_w_encode(bctElementArray, bctLevelAttrArray, bctNodeHeight, spacing, valueScale, colorScale, valueEncoding)
            } else if(barcodeTreeType === 'bct_h') {
                if (bctLevelAttrArray.length === 0) { // 当用户没有指定映射深度属性的数组中的数值时，需要计算得到；否则使用用户指定的属性数值
                    bctLevelAttrArray = bct_height_array(bctNodeHeight, nodeDepthRange) 
                }
                bctNodeArray = bct_h_encode(bctElementArray, bctNodeWidth, bctLevelAttrArray, spacing, valueScale, colorScale, valueEncoding)
            }
            return bctNodeArray
        }
        //  render barcodeTree
        function render_barcodetree(bctNodeArray) {
                //  get the object to control the dbclick and click
                var cc = clickcancel()
                var barcodeTreeNodesG = barcodetreeG.selectAll('.barcodetree-node-g')
                    .data(bctNodeArray)
                barcodeTreeNodesG.enter()
                    .append('g')
                    .attr('class', 'barcodetree-node-g')
                    .attr('id', function(d) {
                        return d.name
                    })
                    .attr('transform', function(d, i){
                        return 'translate(' + d.x + ',' + d.y + ')'
                    })
                    .append('rect')
                    .attr('class', function(d, i) {
                        var barcodeTreeNodeClass = 'barcodetree-node'
                        if (typeof(d.existed) !== 'undefined') {
                            if (!d.existed) {
                                barcodeTreeNodeClass = barcodeTreeNodeClass + ' non-existed'
                            }
                        }
                        return barcodeTreeNodeClass
                    })            
                    .attr('id', function(d) {
                        return d.name
                    })
                    .attr('width', function(d) {
                        if (!((d.collapse_display) && (d.level_display))) {
                            return 0
                        }
                        return d.width
                    })
                    .attr('height', function(d) {
                        return d.height
                    })
                    .attr('fill', function(d) {
                        //  if the existed attribute is false => the fill of the nodes is white
                        if (typeof(d.existed) !== 'undefined') {
                            if (!d.existed) {
                                return 'white'
                            }
                        }
                        return d.color
                    })
                    .style('stroke', function(d) {
                        return bctNodeColor
                    })
                    .style('stroke-width', function(d) {
                        //  if the existed attribute is false => the stroke width of the nodes is d.width / 5
                        if (typeof(d.existed) !== 'undefined') {
                            if (!d.existed) {
                                var strokeWidth = d.width / 5 > 1 ? 1 : d.width / 5
                                return strokeWidth
                            }
                        }
                        //  if the existed attribute of the node is true => the stroke width of the nodes is 0
                        return 0
                    })
                    .on('mouseover', function(d, i) {
                        add_descendant_structure_cue(d, i, bctNodeArray)
                        add_ancestor_structure_cue(d, i, bctNodeArray)
                        add_sibling_structure_cue(d, i, bctNodeArray)
                    })
                    .on('mouseout', function(d, i) {
                        remove_structure_cue()
                    })
                    .call(cc)
                barcodeTreeNodesG.transition()
                    .duration(transitionDuration)
                    .attr('transform', function(d) {
                        return 'translate(' + d.x + ',' + d.y + ')'
                    })      
                barcodeTreeNodesG.exit().remove()
                /**
                 * update the node style of BarcodeTree
                 */
                var barcodeTreeNodes = barcodetreeG.selectAll('.barcodetree-node')
                    .data(bctNodeArray)
                barcodeTreeNodes.transition()
                    .duration(transitionDuration)
                    .attr('width', function(d) {
                        if (!((d.collapse_display) && (d.level_display))) {
                            return 0
                        }
                        return d.width
                    })
                    .attr('height', function(d) {
                        return d.height
                    })
                    .attr('fill', function(d) {
                        //  if the existed attribute is false => the fill of the nodes is white
                        if (typeof(d.existed) !== 'undefined') {
                            if (!d.existed) {
                                return 'white'
                            }
                        }
                        return d.color
                    })
                    .style('stroke', function(d) {
                        return bctNodeColor
                    })
                    .style('stroke-width', function(d) {
                        //  if the existed attribute is false => the stroke width of the nodes is d.width / 5
                        if (typeof(d.existed) !== 'undefined') {
                            if (!d.existed) {
                                var strokeWidth = d.width / 5 > 1 ? 1 : d.width / 5
                                return strokeWidth
                            }
                        }
                        //  if the existed attribute of the node is true => the stroke width of the nodes is 0
                        return 0
                    })
                    .each(function(d, i) {
                        var nodeName = d.name
                        //  if the display attribute of the nodes is false => hide the triangle on the bottom of the node
                        if (!((d.collapse_display) && (d.level_display))) {
                            barcodetreeG.select('#triangle-' + nodeName)
                                .remove()
                            var bctNodeNameIndex = collapsedArray.indexOf(nodeName)
                            if (bctNodeNameIndex !== -1) {
                                collapsedArray.splice(bctNodeNameIndex, 1)
                            }
                        }
                    })
                barcodeTreeNodes.exit().remove()
                //  the event for click and dblclick
                cc.on('click', function() {
                    console.log('click')
                    clickTrigger()
                })
                cc.on('dblclick', function(d, i) {
                    console.log('dblclick')
                    console.log('d', d)
                    dblclick(d, i)
                })
        }
        //  double click the nodes in BCT to collapse the subtree, double click the nodes will stretch the subtree
        function dblclick(d, i) {
            var bctNodeObj = bctNodeArray[i]
            var bctNodeDepth = bctNodeObj.depth
            var bctNodeName = d.name
            var bctNodeNameIndex = collapsedArray.indexOf(bctNodeName)
            for (var bI = (i + 1); bI < bctNodeArray.length; bI++) {
                var nodeObj = bctNodeArray[bI]
                //  change all the attribute for the nodes
                if (nodeObj.depth <= bctNodeDepth) {
                    break
                }
                //  when the attribute of barcodeTree node is true => it will change to false
                if (bctNodeNameIndex === -1) {
                    //  if the descendants of this node is not collapsed, then change the display attribute to false
                    bctNodeArray[bI].collapse_display = false
                } else {
                    //  if the descendants of this node is collapsed, then change the display attribute to true
                    bctNodeArray[bI].collapse_display = true
                }
            }
            if (bctNodeNameIndex === -1) {
                //  if the descendants of this node is not collapsed, then add the bctNodeName to the array
                collapsedArray.push(bctNodeName)
                //  add the triangle on the bottom of the clicked triangle
                render_triangle(bctNodeObj)
            } else {
                //  if the descendants of this node is collapsed, then remove the bctNodeName from the array
                collapsedArray.splice(bctNodeNameIndex, 1)
                //  remove the triangle on the bottom of the clicked triangle
                remove_triangle(bctNodeObj)
            }   
            bctNodeArray = layout_barcodetree()
            //  update the barcodeTree
            render_barcodetree(bctNodeArray)
        }
        //  add the triangle on the bottom of the barcodeTree node
        function render_triangle (bctNodeObj) {
            //  get the subtree depth of the collapsed subtree
            //  计算barcodeTree节点的深度范围
            var bctNodeSubtreeName = bctNodeObj.name
            var bctNodeSubtreeWidth = bctNodeObj.width
            var bctNodeSubtreeHeight = bctNodeObj.height
            var t_obj = bctNodeObj.t_obj
            var tHeight = triangleHeightScale(t_obj.t_height)
            var tWidth = triangleWidthScale(t_obj.t_width)
            barcodetreeG.select('.barcodetree-node-g#' + bctNodeSubtreeName)
                .append("polygon")
                .attr('class', 'triangle')
                .attr('id', 'triangle-' + bctNodeSubtreeName)
                .attr("points",function(d) {
                  var left = (bctNodeSubtreeWidth - tWidth) / 2
                  var top = bctNodeSubtreeHeight
                  var bottom = bctNodeSubtreeHeight + tHeight
                  return left + ',' + bottom + ' '
                     + (left + tWidth / 2) + ',' + top + ' '
                     + (left + tWidth) + ',' + bottom;
                })
                .attr("fill","red")
        }
        //  update the triangle on the bottom of the BarcodeTree node
        function update_triangle () {
            console.log('update_triangle')
            barcodetreeG.selectAll('.triangle')
                .each(function(d, i) {
                    console.log('d', d)
                    var bctNodeSubtreeName = d.name
                    var bctNodeSubtreeWidth = d.width
                    var bctNodeSubtreeHeight = d.height
                    var t_obj = d.t_obj
                    var tHeight = triangleHeightScale(t_obj.t_height)
                    var tWidth = triangleWidthScale(t_obj.t_width)
                    barcodetreeG.select('#triangle-' + bctNodeSubtreeName)
                        .transition()
                        .duration(transitionDuration)
                        .attr("points",function(d) {
                          var left = (bctNodeSubtreeWidth - tWidth) / 2
                          var top = bctNodeSubtreeHeight
                          var bottom = bctNodeSubtreeHeight + tHeight
                          return left + ',' + bottom + ' '
                             + (left + tWidth / 2) + ',' + top + ' '
                             + (left + tWidth) + ',' + bottom;
                        })
                })
        }
        //  remove the triangle on the bottom of the BarcodeTree node
        function remove_triangle (bctNodeObj) {
            var bctNodeSubtreeName = bctNodeObj.name
            barcodetreeG.select('.barcodetree-node-g#' + bctNodeSubtreeName)
                .select('.triangle')
                .remove()
        }
        //  compute the maximum width of the BarcodeTree
        function compute_max_x(bctNodeArray) {
            if(typeof(bctNodeArray) !== 'undefined') {
                var maxX = bctNodeArray[bctNodeArray.length - 1].x + bctNodeArray[bctNodeArray.length - 1].width
                return maxX
            }
        } 
        //  remove all the structure cue when unhovering the nodes
        function remove_structure_cue(g) {
            barcodetreeG.selectAll('.structure-cue')
            .remove()     
        }
        //  add the descendant structure cue to the hovering nodes
        function add_descendant_structure_cue(nodeobj, index, bctNodeArray) {
            var descendantStructureCueArray = compute_descendant_structure_cue(nodeobj, index, bctNodeArray)
            var barcodetreeNodeBottomY = nodeobj.y + nodeobj.height        
            var structureCueY = barcodetreeNodeBottomY + structureCueSpacing + structureCueHeight / 2
            for (var dI = 0;dI < descendantStructureCueArray.length;dI++) {
                var descendantStructureCue = descendantStructureCueArray[dI]
                var startX = descendantStructureCue.start_x
                var endX = descendantStructureCue.end_x
                barcodetreeG.append('line')
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
            console.log('bctNodeArray', bctNodeArray)
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
                    if ((barcodeTreeNode.collapse_display) && (barcodeTreeNode.level_display)) {
                        childrenNodeArray.push(barcodeTreeNode)
                    } 
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
                    if ((bctNodeArray[bI].collapse_display) && (barcodeTreeNode.level_display)) {
                        descendantNodeArray.push(bctNodeArray[bI])
                    }             
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
        function add_ancestor_structure_cue(nodeobj, index, bctNodeArray) {
            var ancestorStructureCueArray = compute_ancestor_structure_cue(nodeobj, index, bctNodeArray)
            var barcodetreeNodeBottomY = nodeobj.y + nodeobj.height        
            var structureCueY = barcodetreeNodeBottomY + structureCueSpacing + structureCueHeight / 2
            for (var dI = 0;dI < ancestorStructureCueArray.length;dI++) {
                var ancestorStructureCue = ancestorStructureCueArray[dI]
                var startX = ancestorStructureCue.start_x
                var endX = ancestorStructureCue.end_x
                barcodetreeG.append('line')
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
                if((nodeObj.depth == findNodeDepth) && (nodeObj.collapse_display) && (nodeObj.level_display)) {
                    var ancestorNodeArray = [nodeObj]
                    var ancestorStructureCue = compute_structure_cue_range(ancestorNodeArray)
                    ancestorStructureCueArray.push(ancestorStructureCue)
                    findNodeDepth = findNodeDepth - 1
                }
            }
            return ancestorStructureCueArray
        }
        //  add the structure cue of the sibling nodes
        function add_sibling_structure_cue(nodeobj, index, bctNodeArray) {
            var siblingStructureCueArray = compute_sibling_structure_cue(nodeobj, index, bctNodeArray)
            var barcodetreeNodeBottomY = nodeobj.y + nodeobj.height   
            var siblingStructureCueTopY = barcodetreeNodeBottomY + structureCueSpacing
            var siblingStructureCueBottomY = barcodetreeNodeBottomY + structureCueSpacing + structureCueHeight
            for (var dI = 0;dI < siblingStructureCueArray.length;dI++) {
                var siblingStructureCueX = siblingStructureCueArray[dI]
                barcodetreeG.append('line')
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
                if ((barcodeNode.depth === nodeDepth) && (barcodeNode.collapse_display) && (barcodeNode.level_display)) {
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
                if ((barcodeNode.depth === nodeDepth) && (barcodeNode.collapse_display) && (barcodeNode.level_display)) {
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
                element.color = bctNodeColor
                if (valueEncoding === 'color') {
                    element.color = colorScale(valueScale(elementValue))
                } else if (valueEncoding === 'height') {
                    element.height = valueScale(elementValue) * height
                    element.y = height - element.height
                }
                if ((bctLevelDisplayArray[elementDepth]) && (element.collapse_display) && (element.level_display)) { 
                    xValue = xValue + element.width + spacing                
                }
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
                element.color = bctNodeColor
                if (valueEncoding === 'color') {
                    element.color = colorScale(valueScale(elementValue))
                }
                if ((bctLevelDisplayArray[elementDepth]) && (element.collapse_display) && (element.level_display)) {
                    xValue = xValue + element.width + spacing                
                }
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
            if (typeof(value) !== 'object') {
                console.warn('invalid value for width', margin)
                return
            }
            margin = value
            return barcodetree        
        }
        //  change the node height of barcodeTree
        barcodetree.bctNodeHeight = function(value) {
            if (!arguments.length) return bctNodeHeight
            if (typeof(value) !== 'number') {
                console.warn('invalid value for width', bctNodeHeight)
                return
            }
            bctNodeHeight = value
            structureCueSpacing = bctNodeHeight * 0.05
            structureCueHeight = bctNodeHeight * 0.1
            structureCueStroke = bctNodeHeight * 0.025
            return barcodetree        
        }
        //  this the average node width of BarcodeTree
        barcodetree.bctNodeWidth = function(value) {
            if (!arguments.length) return bctNodeWidth
            if (typeof(value) !== 'number') {
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
            if (typeof(value) !== 'number') {
                console.warn('invalid value for width', bctLeafNodeWidth)
                return
            }
            bctLeafNodeWidth = value
            return barcodetree        
        }  
        //  this is the spacing of between the nodes in BarcodeTree
        barcodetree.spacing  = function(value) {
            if (!arguments.length) return spacing
            if (typeof(value) !== 'number') {
                console.warn('invalid value for width', spacing)
                return
            }
            spacing = value
            return barcodetree
        } 
        //  this is the color schema of BarcodeTree when encoding the value to node color
        barcodetree.colourScheme  = function(value) {
            if (!arguments.length) return colourScheme
            if (typeof(value) !== 'object') {
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
            if (typeof(value) !== 'string') {
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
            if (typeof(value) !== 'string') {
                console.warn('invalid value for width', valueEncoding)
                return
            }
            valueEncoding = value
            return barcodetree
        }
        //  this is the trigger function when hovering on BarcodeTree
        barcodetree.hoveringTrigger  = function(value) {
            if (!arguments.length) return hoveringTrigger
            if (typeof(value) !== 'object') {
                console.warn('invalid value for width', hoveringTrigger)
                return
            }
            hoveringTrigger = value
            return barcodetree
        } 
        //  this is the trigger function when unhovering on the node of BarcodeTree
        barcodetree.unhoveringTrigger = function(value) {
            if (!arguments.length) return unhoveringTrigger
            if (typeof(value) !== 'string') {
                console.warn('invalid value for width', unhoveringTrigger)
                return
            }
            unhoveringTrigger = value
            return barcodetree
        }
        //  this is the trigger function when users click the nodes of BarcodeTree
        barcodetree.clickTrigger = function(value) {
            if (!arguments.length) return clickTrigger
            if (typeof(value) !== 'string') {
                console.warn('invalid value for width', clickTrigger)
                return
            }
            clickTrigger = value
            return barcodetree
        }
        //  this is the spacing of the structure cue on the bottom of the barcodeTree
        barcodetree.structureCueSpacing  = function(value) {
            if (!arguments.length) return structureCueSpacing
            if (typeof(value) !== 'number') {
                console.warn('invalid value for width', structureCueSpacing)
                return
            }
            structureCueSpacing = value
            return barcodetree
        }
        //   bctLevelAttrArray is the variable for the attribute of different levels 
        //   For BCT_W, it determine the node width; For BCT_H, it determine the node height
        barcodetree.bctLevelAttrArray = function (value) {
            if (!arguments.length) return bctLevelAttrArray
            if (typeof (value) !== 'object') {
                console.warn('invalid value for width', bctLevelAttrArray)
                return
            }
            bctLevelAttrArray = value
            return barcodetree
        }
        //  this is default color of the BCT,
        //  the default color of BCT is black, and users can specify the node color of BCT
        barcodetree.bctNodeColor = function(value) {
            if (!arguments.length) return bctNodeColor
            if (typeof (value) !== 'object') {
                console.warn('invalid value for width', bctNodeColor)
                return
            }
            bctNodeColor = value
            return barcodetree
        }
        //  this is the color schema of BCT
        barcodetree.colourScheme = function(value) {
            if (!arguments.length) return colourScheme
            if (typeof (value) !== 'object') {
                console.warn('invalid value for colourScheme', colourScheme)
                return
            }
            colourScheme = value
            return barcodetree
        }
        //  this variable controls the nodes display of different levels
        barcodetree.bctLevelDisplayArray = function(value) { 
            if (!arguments.length) return bctLevelDisplayArray
            if (typeof (value) !== 'object') {
                console.warn('invalid value for bctLevelDisplayArray', bctLevelDisplayArray)
                return
            }
            bctLevelDisplayArray = value
            return barcodetree
        }
        //  this variable controls the original data of BCT
        barcodetree.dataset = function(value) {
            if (!arguments.length) return dataset
            if (typeof (value) !== 'object') {
                console.warn('invalid value for bctLevelDisplayArray', dataset)
                return
            }
            console.log('value', value)
            dataset = value
            return barcodetree
        }
        return barcodetree
    };

    exports.barcodetree = barcodetree;

    Object.defineProperty(exports, '__esModule', { value: true });

}));