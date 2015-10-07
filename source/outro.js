/*jshint ignore:start */

if ( typeof exports === 'object' ) {
    module.exports = Squire;
} else if ( typeof define === 'function' && define.amd ) {
    define( function () {
        return Squire;
    });
} else {
    win.Squire = Squire;

    if ( top !== win &&
            doc.documentElement.getAttribute( 'data-squireinit' ) === 'true' ) {
        win.editor = new Squire( doc );
        if ( win.onEditorLoad ) {
            win.onEditorLoad( win.editor );
            win.onEditorLoad = null;
        }
    }
}

var console = window.console
Squire._debug = true
Squire.debug = function(bool){
    if(bool !== undefined){
        Squire._debug = bool
    }
    if(Squire._debug){
        window.console.info("enabling Squire console")
        console = window.console
    }
    else{
        window.console.info("disabling Squire console")
        console = {info: function(){return ''}}

    }
    return Squire._debug
}


}( document ) );
// (function(){Squire.debug()})()
