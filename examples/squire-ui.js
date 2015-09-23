document.addEventListener( 'click', function ( e ) {
  var editor = squire_editors[0];
  var id = e.target.id,
      value;
  console.info(id);
  if ( id && editor && editor[ id ] ) {
    if ( e.target.className === 'prompt' ) {
      value = prompt( 'Value:' );
    }
    editor[ id ]( value );
  }
}, false );

$(document).ready(function(){
  window.squire_editors = [];
  // setTimeout(initEditors, 100);

  var x = null;
  if(true){
    if(true){
      x = 4;
      var y = x;
      console.info(y)
    }
  }

});

var initEditors = function(){
    $("iframe").each(function(index, iframe){
    console.info(iframe);
    console.info("making editor");
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
    
    var citation4 = '<cite contenteditable="false"><a href="#">Jen</a> </cite> this is a <div>div</div> and'
    // editor.setHTML("is <span contentEditable='false'>non</span> edit or " + citation4 + " something else")
    editor.setHTML("is " + citation4 + " som" + "<div>abc</div><div>xy<b>bd</b>z</div>")
    // editor.setHTML("<div>abc</div><div>xy<b>bd</b>z</div>")
    // editor.setHTML("<div>a b c d e f</div>")
  
  });
}



