$(document).ready(function(){
  window.squire_editors = [];
  setTimeout(initEditors, 100);
  // setTimeout(updateCursor, 100);
});

var initEditors = function(){
    console.info("making editor");
  $("iframe").each(function(index, iframe){
    window.r = null
    window.iframe = iframe;
    window.idoc = iframe.contentDocument;
    var editor = new Squire(iframe.contentDocument);
    squire_editors.push(editor);
    window.editor = editor;
    $(document).ready(function(){
      vd = new ViewDom(editor._doc.body)
    })
    $("#increase-list-level").click(function(e){
      // editor.increaseListLevel()
      editor.increaseListLevel();updateCursor()
    })
    $("#decrease-list-level").click(function(e){
      // editor.increaseListLevel()
      editor.decreaseListLevel();updateCursor()
    })
    $("#make-list").click(function(e){
      // editor.increaseListLevel()
      editor.makeOrderedList();updateCursor()
    })
    $("#remove-list").click(function(e){
      // editor.increaseListLevel()
      editor.removeList();updateCursor()
    })

    $("not-editable-insert").click(insertNotEditable)

    // editor.addEventListener("pathChange", function(newPath){
    //   console.info("pathchange")
    //   console.info("newpath")
    // });
    editor.addEventListener("focus", function(){
    });

    editor.addEventListener("keyup", function(e){
      setTimeout(updateCursor, 20)
    });
    editor.addEventListener("keydown", function(e){
      // console.info(e)
      // console.info("keydown")
    });
    // editor.addEventListener("keypress", function(e){
    //   console.info("keypress")
    //   e.preventDefault()
    //   console.info(e)
    // });
    // editor.addEventListener("input", function(e){
    //   console.info("input")
    //   console.info(e)
    // });
    editor.addEventListener("mouseup", function(){
      setTimeout(updateCursor, 20)
    });

    testSetup()

    quickTest()

    // runTests()
    // testGetHTML()
    // testInlineNodeNames()
    // testCleaner()
    // testLists()
    // testTables()
    // testInsertHTML()
    testResults()

    setTimeout(updateCursor, 20)
  });
}

quickTest = function(){
  // prepareTest("<div>a<br></div><div><br></div><div>b<br></div>")
  // editor.addEventListener('squire::up-on-first-line', function(e){
  //   console.info('UP EVENT')
  //   console.info(e)
  //   window.e = e
  // })
  // editor.addEventListener('squire::down-on-last-line', function(e){
  //   console.info('UP EVENT')
  //   console.info(e)
  //   window.e = e
  // })
  console.info("starting quick test")
  keyEvent = new KeyboardEvent("keydown", {key : "a", keyCode: 65, code: "KeyA", cancelable: true});
  prepareTest("<div>a<br></div><div><br></div><div>b<br></div>")
  // editor.moveRight(editor, keyEvent, range);updateCursor()
  // editor.moveRight(editor, keyEvent, range);updateCursor()
  // editor.moveRight(editor, keyEvent, range);updateCursor()
  // editor.moveRight(editor, keyEvent, range);updateCursor()
  // testBlock(SquireRange.getNextBlock(firstLine), "right arrow from end of text at end of line")

  console.info("ended quick test")
}

var updateCursor = function(){
  window.r = editor.getSelection()
  window.sc = r.startContainer
  window.so = r.startOffset
  vd.parseRoot()
  // range = editor._doc.getSelection().getRangeAt(0)
  range = editor.getSelection()
  vd.highlightRange(vd._r, range)
}

document.addEventListener('ViewDom::NodeClicked', function (e) {
  var node = e.detail.node
  var source = e.detail.sourceNode
  var target = e.detail.targetNode

  editor.focus()
  var r = editor.getSelection()

  /* Every time we set the start node we should also set the end node to make it easy to collapse ranges */
  if(e.detail.startOfRange){
    if(e.detail.link){
      var index = source.children.indexOf(target)
      r.setStart(source.node, index)
      r.setEnd(source.node, index)
    }
    else if(node){
      r.setStart(node, 0)
      r.setEnd(node, 0)
    }
  }
  else{
    if(e.detail.link){
      var index = source.children.indexOf(target)
      r.setEnd(source.node, index)
    }
    else if(node){
      r.setEnd(node, 0)
    }
  }
  editor.setSelection(r)
  vd.highlightRange(vd._r, r)
  updateCursor()

});

test = function(t, message){
  if(t){
    passedTests++
    console.info("%cPASSED: " + message, 'color: green;')
  }
  else{
    failedTests++
    console.warn("%cFAILED: " + message, 'color: red;')
  }
}

testResults = function(){
  if(failedTests === 0){
    console.info("%cALL TESTS PASSED", 'color: green;')
  }
  else{
    console.info("%cTHERE ARE FAILED TESTS", 'color: red;')

  }
}
testSetup = function(){
  passedTests = 0
  failedTests = 0
}

prepareTest = function(html){
  editor.setHTML(html)
  updateCursor()
  editor.focus()
  // range = editor.getSelection()
  // firstLine = editor._doc.body.childNodes[0]
}

testContent = function(content, offset, message){
  var r = editor.getSelection()
  var offsetMatches

  offsetMatches = (typeof(offset) === "number") ? (r.startOffset === offset) : true
  message = (typeof(offset) === "number") ? message : offset
  test(r.startContainer.data === content && offsetMatches, message)
}

testContainer = function(container, offset, message){
  var r = editor.getSelection()
  var offsetMatches

  offsetMatches = (typeof(offset) === "number") ? (r.startOffset === offset) : true
  test(r.startContainer === container && offsetMatches, message)
}

testBlock = function(block, message){
  test(editor.getCurrentStartBlock() === block, message)
}

testPreviousSibling = function(func, message){
  var r = editor.getSelection()
  var sc = r.startContainer
  var so = r.startOffset
  var ps = null
  if(Squire.Node.isText(sc)){
    ps = sc.previousSibling
  }
  else{
    if(sc.childNodes && so < sc.childNodes.length - 1){
      ps = sc.childNodes[so]
    }
  }
  window.ps = ps
  test(func(ps), message)
}

testNode = function(node, func, message){
  test(func(node), message)
}


/* Very simple way of testing.  Values are global so that you can leave the test in a specific state and the execute
** by hand commands such as: editor.moveLeft(editor, keyEvent, range);updateCursor()
*/
runTests = function(){
  editor.setHTML('<div>ab<span contentEditable="false">c</span>d</div>')
  updateCursor()
  editor.focus()
  range = editor.getSelection()
  firstLine = editor._doc.body.childNodes[0]
  keyEvent = new KeyboardEvent("keydown", {key : "a", keyCode: 65, code: "KeyA", cancelable: true});

  // RIGHT ARROW
  editor.moveRight(editor, keyEvent, range);
  editor.moveRight(editor, keyEvent, range);
  editor.moveRight(editor, keyEvent, range);
  return
  testContent("d", 0, "right arrow over non-editable")
  editor.moveLeft(editor, keyEvent, range);
  editor.moveRight(editor, keyEvent, range);
  testContent("d", "right arrow after non-editable")
  range.setStart(firstLine, 0); range.setEnd(firstLine, 0)
  editor.setSelection(range)
  editor.moveRight(editor, keyEvent, range)
  testContent("ab", "right arrow when child is text")

  // LEFT ARROW
  //TODO: without ZWS<Z> this was childNodes[2], 1
  range.setStart(firstLine.childNodes[4], 1); range.setEnd(firstLine.childNodes[4], 1)
  editor.setSelection(range)
  editor.moveLeft(editor, keyEvent, range);updateCursor()
  testContent("d", 0, "left arrow in text element")
  editor.moveLeft(editor, keyEvent, range);updateCursor()
  //TODO: without ZWS this was index 1
  testContainer(firstLine, 3, "left arrow onto non-editable")
  editor.moveLeft(editor, keyEvent, range);updateCursor()
  testContent("ab", 1, "left arrow off of non-editable")

  prepareTest("<div>a<br></div><div><br></div><div>b<br></div>")
  editor.moveRight(editor, keyEvent, range);updateCursor()
  editor.moveRight(editor, keyEvent, range);updateCursor()
  testBlock(SquireRange.getNextBlock(firstLine), "right arrow from end of text at end of line")
  editor.moveRight(editor, keyEvent, range);updateCursor()
  testContent("b",0, "right arrow from blank line")
  editor.moveLeft(editor, keyEvent, range);updateCursor()
  testBlock(SquireRange.getNextBlock(firstLine), "left arrow from beg of text at beg of line")
  editor.moveLeft(editor, keyEvent, range);updateCursor()
  testContent("a", 1, "left")

  prepareTest("<div><span contentEditable=false>ne</span><br></div>")
  editor.moveRight(editor, keyEvent, range);updateCursor()
  testContainer(firstLine, 3, "right arrow before content editable on single line")
  prepareTest('<div>L<span><span class="colour" style="color:rgb(51, 51, 51)"> <span class="font" style="font-family:Helvetica, Times, serif"> <span class="size" style="font-size:16px">&nbsp;f <span class="Apple-converted-space">&nbsp;</span> </span> </span> </span></span><br></div>')
  prepareTest('<div>L<span><span class="colour" style="color:rgb(51, 51, 51)"><span class="font" style="font-family:Helvetica, Times, serif"><span class="size" style="font-size:16px">f<span class="Apple-converted-space">&nbsp;</span></span></span></span></span><br></div>')
  editor.setSelectionToNode(editor._body.childNodes[0].childNodes[2])
  // There is for some reason a delay to setting the selection, so we need to wait for a few moments, very ugly
  // NATE: Commenting this test out for now, it is unreliable
  // setTimeout(function(){
  //   editor.backspace(editor, keyEvent, range);
  //   setTimeout(function(){testContent("f", 1, "blah");updateCursor()}, 100)
  // }, 100)

  // NATE: this was content that alberto was having trouble with and is useful for debugging
  // prepareTest('<div>Libraries and institutions (our customers in academia) love to see an alternative to traditional publishers. In the corporate market, we haven\'t done enough research to understand the timeliness of Authorea, but given the interest we are receiving and the requirements we are gathering, we have noticed that there is a growing need for a tool<span class="highlight" style="background-color: rgb(255, 255, 255)"><span class="colour" style="color:rgb(51, 51, 51)">  <span class="font" style="font-family:Helvetica, Times, serif">     <span class="size" style="font-size:16px">&nbsp;for technical writing and auditing purposes)       <span class="Apple-converted-space">&nbsp;</span>     </span>   </span> </span></span><br></div><div><br></div>')
  // prepareTest('<div class="remove_me"><span class="katex ltx_Math" contenteditable="false" data-equation="x"><span class="katex-mathml"><math><semantics><mrow><mi>x</mi></mrow><annotation encoding="application/x-tex">x</annotation></semantics></math></span><span class="katex-html" aria-hidden="true"><span class="strut" style="height:0.43056em;"></span><span class="strut bottom" style="height:0.43056em;vertical-align:0em;"></span><span class="base textstyle uncramped"><span class="mord mathit">x</span></span></span></span><br></div>')

  prepareTest('')
  s = '<span class="katex ltx_Math" contenteditable="false" data-equation="x"><span class="katex-mathml"><math><semantics><mrow><mi>x</mi></mrow><annotation encoding="application/x-tex">x</annotation></semantics></math></span><span class="katex-html" aria-hidden="true"><span class="strut" style="height:0.43056em;"></span><span class="strut bottom" style="height:0.43056em;vertical-align:0em;"></span><span class="base textstyle uncramped"><span class="mord mathit">x</span></span></span></span><br>'
  prepareTest("<math>x</math>")
  test(firstLine.childNodes[0].nodeName === "math", "can insert math")

  firstLine = editor._doc.body.childNodes[0]
  keyEvent = new KeyboardEvent("keydown", {key : "a", keyCode: 65, code: "KeyA", cancelable: true});

  prepareTest("a<z></z>b<z></z>c")
  editor.removeAllZNodes(editor._body);updateCursor()
  editor.moveRight(editor, keyEvent, range);updateCursor()
  editor.moveRight(editor, keyEvent, range);updateCursor()
  testContent("b", 1, "moves right properly between two next nodes")
  editor.moveLeft(editor, keyEvent, range);updateCursor()
  editor.moveLeft(editor, keyEvent, range);updateCursor()
  testContent("a", 0, "moves right properly between two next nodes")
  prepareTest("abcc<span contentEditable=false>blah</span><span contentEditable=false>blah</span>")

  prepareTest("a<b>b</b>c")
  editor.moveRight(editor, keyEvent, range);updateCursor()
  editor.moveRight(editor, keyEvent, range);updateCursor()
  testContent("b", 1, "moves right properly between two next nodes")
  editor.moveLeft(editor, keyEvent, range);updateCursor()
  editor.moveLeft(editor, keyEvent, range);updateCursor()
  testContent("a", 0, "moves right properly between two next nodes")
  editor.moveRight(editor, keyEvent, range);updateCursor()
  editor.moveRight(editor, keyEvent, range);updateCursor()
  editor.moveRight(editor, keyEvent, range);updateCursor()
  editor.moveLeft(editor, keyEvent, range);updateCursor()
  editor.backspace(editor, keyEvent, range);updateCursor()
  testPreviousSibling(function(node){return (node.nodeName !== 'B')}, "properly cleans up when backspace")
  prepareTest("")
  insertNotEditable(); updateCursor()
  return
  testNode(firstLine, function(node){
    var fc = node.firstChild
    var ns = fc.nextSibling
    return(Squire.Node.isZWNBS(fc) && (ns && ns.nodeName === "Z"))},
    "inserts ZWS and Z node before notEditable when insertNodeInRange")
}

testTables = function(){
  prepareTest('')
  s = '<table  contenteditable="false" data-toggle="context" data-target="#tableContextMenu" class="ltx_tabular ltx_tabular_fullpage"><tbody><tr><td class="ltx_framed ltx_align_center">x</td></tr></tbody></table>'
  t = $(s)[0]
  editor.insertNodeInRange(editor.getSelection(), t)
  test(editor._body.childNodes[0].childNodes[2] === t, "can insert table")
  test(editor._body.childNodes[0].childNodes[1].nodeName === 'Z', "table has pre Z node")
}
testLists = function(){
  prepareTest("a")
  editor.makeOrderedList();updateCursor()
  s1 = '<ol><li><div>a<br></div></li></ol><div><br></div>'
  test(editor.getHTML() === s1, "can make list")
  editor.increaseListLevel();updateCursor()
  s2 = '<ol><li><ol><li><div>a<br></div></li></ol></li></ol><div><br></div>'
  test(editor.getHTML() === s2, "can increase list level")
  editor.decreaseListLevel();updateCursor()
  test(editor.getHTML() === s1, "can decrease list level")
  editor.removeList();updateCursor()
  s = '<div>a<br></div><div><br></div>'
  test(editor.getHTML() === s, "can remove list")
  return


  // editor.insertHTML(s)
  // editor.moveRight()
  // editor.moveRight()

  // df = document.createDocumentFragment()
  // df.appendChild(editor._body.childNodes[0])
  // w = Squire.Node.getBlockWalker( df )
}

testGetHTML = function(){
  prepareTest("<div>a</div>")
  test(editor.getHTML() === "<div>a<br></div>", "getHTML basic")
  test(editor.getHTML({stripEndBrs: 1}) === "<div>a</div>", "getHTML without EOL BRs")
  test(editor.getHTML() === "<div>a<br></div>", "getHTML puts back BRs")
  test(editor.getHTML({withBookMark: 1}).match("squire"), "getHTML can bookmark cursor")
  prepareTest("<span contentEditable=false>a</span>")
  test(editor.getHTML({cleanContentEditable: 1, stripEndBrs: 1}) === '<div><span contenteditable="false">a</span></div>', "getHTML cleans up contenteditable")
  test(editor.getHTML() === '<div>﻿<z></z><span contenteditable="false">a</span><br></div>', "getHTML cleans up contenteditable")
  prepareTest("<span data-name=a>a</span>")
  test(editor.getHTML().match('data-name'), "spans can have data attributes")
  prepareTest("<math data-name=a>a</math>")
  test(editor.getHTML().match('data-name'), "other nodes can have data attributes")


}

testCleaner = function(){
  prepareTest("")
  s = '<span class="katex ltx_Math"><span class="strut" style="height:1em;">a</span></span>'
  editor.insertHTML(s)
  s2 = editor.getHTML()
  test(s2 === '<div><span class="katex ltx_Math"><span class="strut" style="height:1em;">a</span></span><br></div>', "does not filter math elements")

  el = editor.createElement("span", {style: 'background-color: blue', class: "a b c"})
  Squire.Clean.stylesRewriters["SPAN"](el, el.parentNode)
  test(el.attributes["style"]===undefined, "Removes styles from span")
  test(el.attributes["class"]===undefined, "Removes non whitelisted classes from span")

  el = editor.createElement("span", {style: 'background-color: blue', class: "ltx_Math katex"})
  Squire.Clean.stylesRewriters["SPAN"](el, el.parentNode)
  test(el.className==="ltx_Math katex", "keeps whitelisted classes")

  el = editor.createElement("span", {style: 'background-color: blue', class: "ltx_blah"})
  Squire.Clean.stylesRewriters["SPAN"](el, el.parentNode)
  test(el.className==="ltx_blah", "keeps random latexML classes")

  el = editor.createElement("span", {style: 'background-color: blue', class: "au-blah"})
  Squire.Clean.stylesRewriters["SPAN"](el, el.parentNode)
  test(el.className==="au-blah", "keeps random authorea classes")

  el = editor.createElement("span", {contenteditable: "false"})
  Squire.Clean.stylesRewriters["SPAN"](el, el.parentNode)
  test(el.getAttribute("contenteditable") === "false", "allows contenteditable attr")

  el = editor.createElement("span", {r1: "true", r2: "false", r3: "blah", class:"katex"})
  Squire.Clean.stylesRewriters["SPAN"](el, el.parentNode)
  test(!!el.getAttribute("r1") === false, "removes random attr")

  el = editor.createElement("div", {r1: "true", r2: "false", r3: "blah", class:"katex"})
  var rewriter = Squire.Clean.stylesRewriters[el.nodeName] ||
  Squire.Clean.stylesRewriters["SPAN"](el, el.parentNode)
  test(!!el.getAttribute("r1") === false, "removes random attr")

  el = $("<div><span><span>a</span><span>b</span><span>c</span></span></div>")[0]
  Squire.Clean.collapseSimpleSpans(el)
  test(el.innerHTML === "abc", "collapses simple spans")
}

testInsertHTML = function(){
  prepareTest('')
  editor.insertHTML("<p>p tag</p>")
  test(editor._body.childNodes[0].nodeName === "DIV", "p tags are converted to divs")
}

debuggingTests = function(){
  // var citation4 = '<cite contenteditable="false"><a href="#">Jen</a> </cite> this is a <div>div</div> and'
  // editor.setHTML("is <span contentEditable='false'>non</span> edit or " + citation4 + " something else")
  // editor.setHTML("is " + citation4 + " som" + "<div>abc</div><div>xy<b>bd</b>z</div>")
  // editor.setHTML("<div>abc</div><div>xy<b>bd</b>z</div>")
  // var citation5 = '<cite contenteditable="false"><a href="#">Jenkins</a>   </cite>'
  // var citation5 = '&#8203;<cite contenteditable="false"><a href="#">Jenkins</a> </cite>&#8203;'
  // editor.setHTML("<div>a b c</div>" + "<div>" + citation5 + "</div>")
  // editor.setHTML('<div>f<cite contenteditable="false"><a href="#20366120">(Jenkins 2009)</a></cite>&nbsp; This is after<br></div>')
  // editor.setHTML('<div>&nbsp;f<cite contenteditable="false"><a href="#20366120">(Jenkins 2009)</a></cite><br></div>')
  // editor.setHTML('<div>b<span contenteditable="false"><span><math><semantics><mrow><mi>x</mi><mo>=</mo><mn>5</mn></mrow><annotation>x=5</annotation></semantics></math></span><span><span></span><span></span><span><span>x</span><span>=</span><span>5</span></span></span></span><br></div>')
  // editor.setHTML('<div><b>b</b><span contenteditable="false">x</span><span contenteditable="false">y</span><span contenteditable="false">z</span>')
  // editor.setHTML('<div>Lib<span class="a">a<span class="b">b<span class="c">c<span class="d">d&nbsp;for<span class="e">e&nbsp;</span></span></span></span></span><br></div><div><br></div>')
  // editor.setHTML('abcd')
  // prepareTest('<div>tool<span class="highlight" style="background-color: rgb(255, 255, 255)"><span class="colour" style="color:rgb(51, 51, 51)">  <span class="font" style="font-family:Helvetica, Times, serif">     <span class="size" style="font-size:16px">f<span class="Apple-converted-space"></span></span></span> </span></span><br></div><div><br></div>')
  // prepareTest('<div>tool<span class="highlight" style="background-color: rgb(255, 255, 255)"><span class="colour" style="color:rgb(51, 51, 51)">  <span class="font" style="font-family:Helvetica, Times, serif"> <span class="size" style="font-size:16px"><span class="Apple-converted-space"></span></span></span> </span></span><br></div><div><br></div>')
  // prepareTest('<div>tool<span class="a"><span class="b">  <span class="f"> <span class="s"><span class="A"></span></span></span> </span></span><br></div><div><br></div>')
  // prepareTest('<div>tool<span class="a">a<span class="b">b<span class="f">c<span class="s"><span class="A"></span></span></span>d</span></span><br></div><div><br></div>')
  // prepareTest('<div>tool<span style="background-color: rgb(255, 255, 255)" class="highlight"><span style="color:rgb(51, 51, 51)" class="colour">&nbsp;<span style="font-family:Helvetica,Times,serif" class="font"><span style="font-size:16px" class="size"><span class="Apple-converted-space"></span></span></span></span></span><br></div>')
  // prepareTest('<div>tool<span style="background-color: rgb(255, 255, 255)" class="highlight"><span style="color:rgb(51, 51, 51)" class="colour">  <span style="font-family:Helvetica,Times,serif" class="font"><span style="font-size:16px" class="size"><span class="Apple-converted-space"></span></span></span></span></span><br></div>')
  // editor.setSelectionToNode(editor._body.childNodes[0].childNodes[2])

  // prepareTest('<div><span class="katex ltx_Math" contenteditable="false" data-equation="x=5"><span class="katex-mathml"><math><semantics><mrow><mi>x</mi><mo>=</mo><mn>5</mn></mrow><annotation encoding="application/x-tex">x=5</annotation></semantics></math></span><span class="katex-html" aria-hidden="true"><span class="strut" style="height:0.64444em;"></span><span class="strut bottom" style="height:0.64444em;vertical-align:0em;"></span><span class="base textstyle uncramped"><span class="mord mathit">x</span><span class="mrel">=</span><span class="mord mathrm">5</span></span></span></span><br></div>')

  // prepareTest("abc&#8203;&#8203;<span contentEditable=false>x</span>&#8203;&#8203;<span contentEditable=false>y</span>&#8203;&#8203;def")
  // prepareTest("a<z></z>b<z></z>c<z></z><span contentEditable=false>x</span><z></z><span contentEditable=false>y</span><z></z>def")
  // prepareTest("a<z></z>b<z></z>c<z></z><z></z><span contentEditable=false>blah</span><span contentEditable=false>blah</span>")
  // editor.removeAllZNodes(editor._body);updateCursor()
  // editor.ensurePreZNodesForContentEditable(editor._body)
  // var c = editor._body.childNodes[0].childNodes[3]
  // editor.setSelectionToNode(c)
  // editor._body.childNodes[0].insertBefore(document.createElement('Z'), c)
  // var tn = document.createTextNode('')
  // tn.innerHTML = '&#8203;&#8203;'
  // editor._body.childNodes[0].insertBefore(tn, c)

  // s = '<div class="remove_me"><span data-equation="x" class="ltx_Math" contenteditable="false"><span class="katex"><span class="katex-mathml">xx</span><span class="katex-html" aria-hidden="true"><span class="strut" style="height:0.43056em;"></span><span class="strut bottom" style="height:0.43056em;vertical-align:0em;"></span><span class="base textstyle uncramped"><span class="mord mathit">x</span></span></span></span></span>a<span data-equation="y" class="ltx_Math" contenteditable="false"><span class="katex"><span class="katex-mathml">yy</span><span class="katex-html" aria-hidden="true"><span class="strut" style="height:0.43056em;"></span><span class="strut bottom" style="height:0.625em;vertical-align:-0.19444em;"></span><span class="base textstyle uncramped"><span class="mord mathit" style="margin-right:0.03588em;">y</span></span></span></span></span>a<span data-equation="m" class="ltx_Math" contenteditable="false"><span class="katex"><span class="katex-mathml">mm</span><span class="katex-html" aria-hidden="true"><span class="strut" style="height:0.43056em;"></span><span class="strut bottom" style="height:0.43056em;vertical-align:0em;"></span><span class="base textstyle uncramped"><span class="mord mathit">m</span></span></span></span></span>a<span data-equation="z" class="ltx_Math" contenteditable="false"><span class="katex"><span class="katex-mathml">zz</span><span class="katex-html" aria-hidden="true"><span class="strut" style="height:0.43056em;"></span><span class="strut bottom" style="height:0.43056em;vertical-align:0em;"></span><span class="base textstyle uncramped"><span class="mord mathit" style="margin-right:0.04398em;">z</span></span></span></span></span></div><div class="remove_me">jiop ipji opjoip j<br></div>'
  // s = '<div class="remove_me"><span data-equation="x" class="ltx_Math" contenteditable="false"><span class="katex"><span class="katex-mathml">xx</span><span class="katex-html" aria-hidden="true"><span class="strut" style="height:0.43056em;"></span><span class="strut bottom" style="height:0.43056em;vertical-align:0em;"></span><span class="base textstyle uncramped"><span class="mord mathit">x</span></span></span></span></span>a<span data-equation="y" class="ltx_Math" contenteditable="false"><span class="katex"><span class="katex-mathml">yy</span><span class="katex-html" aria-hidden="true"><span class="strut" style="height:0.43056em;"></span><span class="strut bottom" style="height:0.625em;vertical-align:-0.19444em;"></span><span class="base textstyle uncramped"><span class="mord mathit" style="margin-right:0.03588em;">y</span></span></span></span></span>a<span data-equation="m" class="ltx_Math" contenteditable="false"><span class="katex"><span class="katex-mathml">mm</span><span class="katex-html" aria-hidden="true"><span class="strut" style="height:0.43056em;"></span><span class="strut bottom" style="height:0.43056em;vertical-align:0em;"></span><span class="base textstyle uncramped"><span class="mord mathit">m</span></span></span></span></span>a<span data-equation="z" class="ltx_Math" contenteditable="false"><span class="katex"><span class="katex-mathml">zz</span><span class="katex-html" aria-hidden="true"><span class="strut" style="height:0.43056em;"></span><span class="strut bottom" style="height:0.43056em;vertical-align:0em;"></span><span class="base textstyle uncramped"><span class="mord mathit" style="margin-right:0.04398em;">z</span></span></span></span></span></div><div class="remove_me">jiop ipji opjoip j<br></div>'
  // s = "<span class='a' contentEditable='false'>abcd</span><span class='b' contentEditable='false'>def</span>"
  // editor.insertNodeInRange(editor.getSelection(),$(s)[0])
  // editor.insertNodeInRange(editor.getSelection(),$(s)[0])
  // editor.insertNodeInRange(editor.getSelection(),$(s)[1])
  // prepareTest(s)
}



testInlineNodeNames = function(){
  mathMLNames = ["math", "maction", "maligngroup", "malignmark", "menclose", "merror",
  "mfenced", "mfrac", "mglyph", "mi", "mlabeledtr", "mlongdiv", "mmultiscripts", "mn", "mo", "mover", "mpadded",
  "mphantom", "mroot", "mrow", "ms", "mscarries", "mscarry", "msgroup", "msline", "mspace", "msqrt", "msrow",
  "mstack", "mstyle", "msub", "msup", "msubsup"]
  var nodeNames = ["span"].concat(mathMLNames)
  nodeNames.forEach(function(n){
    test(Squire.Node.isInline($("<"+n+">")[0]), n + " is inline?")
  })
}

// Useful to see how the treewalker works
makeTreeWalker = function(){
  w = new STreeWalker(editor._body, NodeFilter.SHOW_ALL, function(node){
      return ( editor.isText(node) || editor.notEditable(node) )
  } );
  w2 = new STreeWalker(editor._body, NodeFilter.SHOW_ALL, function(node){
      return ( true )
  } );
  w2.currentNode = w2.root
}

insertNotEditable = function(e){
  range = editor.getSelection()
  var node = $("<span contentEditable=false>NE</span>")[0]
  // insert the element into squire
  editor.insertNodeInRange(
      range,
      node
  )
  // if the rich element was inserted at the current location
  if (!range) {
    // collapse the range
    range.collapse(false)
    // update the editor with the collapsed range
    this.rich_editor.setSelection(range)
  }
}
insertText = function(text){
  range = editor.getSelection()
  var node = editor._doc.createTextNode(text)
  // insert the element into squire
  editor.insertNodeInRange(
      range,
      node
  )
  // if the rich element was inserted at the current location
  if (!range) {
    // collapse the range
    range.collapse(false)
    // update the editor with the collapsed range
    this.rich_editor.setSelection(range)
  }
}




