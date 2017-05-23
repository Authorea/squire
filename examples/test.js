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

    runTests()
    testGetHTML()
    testInlineNodeNames()
    testCleaner()
    // testLists()
    testTables()
    testInsertHTML()
    testHeader()
    testIncreaseListLevel()
    testResults()

    setTimeout(updateCursor, 20)
  });
}
testHeader = function(){
  prepareTest('<h1>test</h1>');


  var textNode = editor._doc.body.childNodes[0].childNodes[0]

  var r = editor.getSelection()
  r.setStart(textNode, 4 )
  r.setEnd(textNode, 4 )
  editor.setSelection(r);
  updateCursor();

  keyEvent = new KeyboardEvent("keydown", {key : "Backspace", keyCode: 8, code: "Backspace", cancelable: true});
  editor.backspace(editor, keyEvent, range);
  updateCursor();

  // make sure new lines were added under the header:
  test(editor._doc.body.childNodes.length == 1, 'header is added with no new lines')

}
testIncreaseListLevel = function(){
  prepareTest("<div>test<br></div>")
  var textNode = editor._doc.body.childNodes[0].childNodes[0]
  var r = editor.getSelection()
  r.setStart(textNode, 0 )
  r.setEnd(textNode, 0 )
  editor.setSelection(r);
  editor.increaseIndentLevel()
  var html = editor.getHTML()
  test(html.includes('blockquote'), 'indent level increased')

  editor.setHTML(html)
  test(editor.getHTML(html) == html, 'indent survives cleaner')
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
  // prepareTest("<div>a<br></div><div><br></div><div>b<br></div>")
  prepareTest('<div>ab<span class="not-editable">c</span>d</div>')
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
  console.info('%c.......................................','color: green;');
  console.info('%c.......................................','color: green;');
  console.info('%cRESULTS:','color: green;');
  if(failedTests === 0){
    console.info("%cALL " + passedTests + " TESTS PASSED", 'color: green;')
  }
  else{
    console.info("%cTHERE ARE " + failedTests + " FAILED TESTS", 'color: red;')
    console.info("%cTHERE ARE " + passedTests + " PASSED TESTS", 'color: green;')

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
  editor.setHTML('<div>ab<span class=not-editable>citation with link</span>fwe</div>')
  updateCursor()
  editor.focus()
  return
  range = editor.getSelection()
  firstLine = editor._doc.body.childNodes[0]
  keyEvent = new KeyboardEvent("keydown", {key : "a", keyCode: 65, code: "KeyA", cancelable: true});

  // RIGHT ARROW
  editor.moveRight(editor, keyEvent, range);
  editor.moveRight(editor, keyEvent, range);
  editor.moveRight(editor, keyEvent, range);
  testContent("d", 0, "right arrow over non-editable")
  editor.moveLeft(editor, keyEvent, range);
  editor.moveRight(editor, keyEvent, range);
  testContent("d", "right arrow after non-editable")
  range.setStart(firstLine, 0); range.setEnd(firstLine, 0)
  editor.setSelection(range)
  editor.moveRight(editor, keyEvent, range)
  testContent("ab", "right arrow when child is text")

  // LEFT ARROW
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
}

testTables = function(){
  prepareTest('')
  s = '<table  contenteditable="false" data-toggle="context" data-target="#tableContextMenu" class="ltx_tabular ltx_tabular_fullpage"><tbody><tr><td class="ltx_framed ltx_align_center">x</td></tr></tbody></table>'
  t = $(s)[0]
  editor.insertNodeInRange(editor.getSelection(), t)
  test(editor._root.childNodes[0] === t, "can insert table")
}
testLists = function(next){
  function makeListTest() {
    prepareTest("a")
    editor.makeOrderedList()
    var s1 = '<ol><li>a<br></li></ol><div><br></div>'
    setTimeout(function () {
      test(editor.getHTML() === s1, "can make list")
      increaseListLevelTest()
    },500)
  }
  function increaseListLevelTest() {
    editor.increaseListLevel()
    var s2 = '<ol><li><ol><li>a<br></li></ol></li></ol><div><br></div>'
    setTimeout(function () {
      test(editor.getHTML() === s2, "can increase list level")
      decreaseListLevelTest()
    },500)
  }
  function decreaseListLevelTest(){
    var s1 = '<ol><li>a<br></li></ol><div><br></div>'
    editor.decreaseListLevel()
    setTimeout(function () {
      test(editor.getHTML() === s1, "can decrease list level")
      removeListTest()
    }, 500)
  }
  function removeListTest() {
    editor.removeList()
    setTimeout(function () {
      var s = '<div>a<br></div><div><br></div>'
      test(editor.getHTML() === s, "can remove list")
      next()
    }, 500)
  }
  makeListTest()
  return
}

testGetHTML = function(){
  prepareTest("<div>a</div>")
  test(editor.getHTML() === "<div>a<br></div>", "getHTML basic")
  test(editor.getHTML({stripEndBrs: 1}) === "<div>a</div>", "getHTML without EOL BRs")
  test(editor.getHTML() === "<div>a<br></div>", "getHTML puts back BRs")
  test(editor.getHTML({withBookMark: 1}).match("squire"), "getHTML can bookmark cursor")
  // NOTE: failing, but I don't see anyhthing in getHTML about keeping contentEditable. Outtdated test?
  // prepareTest("<span contentEditable=false>a</span>")
  // test(editor.getHTML({cleanContentEditable: 1, stripEndBrs: 1}) === '<div><span contenteditable="false">a</span></div>', "getHTML cleans up contenteditable")
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

  // NOTE: again, contenteditable tests outdated?
  // el = editor.createElement("span", {contenteditable: "false"})
  // Squire.Clean.stylesRewriters["SPAN"](el, el.parentNode)
  // test(el.getAttribute("contenteditable") === "false", "allows contenteditable attr")

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
  test(editor._root.childNodes[0].nodeName === "DIV", "p tags are converted to divs")
}

debuggingTests = function(){
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
  var node = $("<span class=not-editable>NE</span>")[0]
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
