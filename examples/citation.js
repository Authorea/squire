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

    editor.addEventListener("pathChange", function(newPath){
    });
    editor.addEventListener("focus", function(){
    });

    editor.addEventListener("keyup", function(e){
      setTimeout(updateCursor, 20)
    });    
    editor.addEventListener("mouseup", function(){
      setTimeout(updateCursor, 20)
    });

    
    var citation4 = '<cite contenteditable="false"><a href="#">Jen</a> </cite> this is a <div>div</div> and'
    // editor.setHTML("is <span contentEditable='false'>non</span> edit or " + citation4 + " something else")
    //editor.setHTML("is " + citation4 + " som" + "<div>abc</div><div>xy<b>bd</b>z</div>")
    //editor.setHTML("<div>abc</div><div>xy<b>bd</b>z</div>")
    var citation5 = '<cite contenteditable="false"><a href="#">Jenkins</a>   </cite>'
    // var citation5 = '&#8203;<cite contenteditable="false"><a href="#">Jenkins</a> </cite>&#8203;'
    // editor.setHTML("<div>a b c</div>" + "<div>" + citation5 + "</div>")
    // editor.setHTML('<div>f<cite contenteditable="false"><a href="#20366120">(Jenkins 2009)</a></cite>&nbsp; This is after<br></div>')
    // editor.setHTML('<div>&nbsp;f<cite contenteditable="false"><a href="#20366120">(Jenkins 2009)</a></cite><br></div>')
    editor.setHTML('<div>a<span contenteditable="false"><span><math><semantics><mrow><mi>x</mi><mo>=</mo><mn>5</mn></mrow><annotation>x=5</annotation></semantics></math></span><span><span></span><span></span><span><span>x</span><span>=</span><span>5</span></span></span></span>d<br></div>')
    editor.setHTML('<div>Lib<span class="a">a<span class="b">b<span class="c">c<span class="d">d&nbsp;for<span class="e">e&nbsp;</span></span></span></span></span><br></div><div><br></div>')
    setTimeout(updateCursor, 20)
  });
}

var updateCursor = function(){
  window.r = editor.getSelection()
  window.sc = r.startContainer
  window.so = r.startOffset
  vd.parseRoot()
  range = editor._doc.getSelection().getRangeAt(0)
  vd.highlightRange(vd._r, range)
}



