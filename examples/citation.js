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
    window.source = $("#source");
    window.before = $("#before");
    window.after = $("#after");
    window.clone = $("#clone");

    // _.each
    editor.addEventListener("pathChange", function(newPath){
      // console.info('path changed');
      // console.info(newPath);
    });
    editor.addEventListener("focus", function(){
      // console.info('focus');
    });

    editor.addEventListener("keyup", function(e){
      setTimeout(updateCursor, 20)
      // console.info(e)
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
  });
}

var updateCursor = function(){
  // console.info("updating cursor")
  // setTimeout(updateCursor, 500);
  editor._saveRangeToBookmark(editor.getSelection())
  window.html = editor.getHTML();
  // window.html = after.html();
  html = html.replace('<input id="squire-selection-start" type="hidden">', '{')
  html = html.replace('<input id="squire-selection-end" type="hidden">', '}')
  before.text(html)
  editor._getRangeAndRemoveBookmark(editor.getSelection())
  window.r = editor.getSelection()
  window.sc = r.startContainer
  window.so = r.startOffset
}



