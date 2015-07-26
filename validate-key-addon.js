(function(mod) {
  if (typeof exports == "object" && typeof module == "object") // CommonJS
    mod(require("../../lib/codemirror"));
  else if (typeof define == "function" && define.amd) // AMD
    define(["../../lib/codemirror"], mod);
  else // Plain browser env
    mod(CodeMirror);
})(function(CodeMirror) {
  var templates = {
    "mandatory" : Handlebars.compile('' +
      '<div class="modal-content">' +
        '<div class="modal-header">' +
          '<button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>' +
          '<div class="modal-title">' +
            'Mandatory Parameter Missing' +
          '</div>' +
        '</div>' +
        '<div class="modal-body"></div>' +
      '</div>' +
      '<div class="clearfix"></div>' +
    ''),
    "type" : Handlebars.compile('' +
      '<div class="modal-content">' +
        '<div class="modal-header">' +
          '<button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>' +
          '<div class="modal-title">' +
            'Expected {{details.validator.type}}, Got {{details.actualType}}' +
          '</div>' +
        '</div>' +
        '<div class="modal-body"></div>' +
      '</div>' +
      '<div class="clearfix"></div>' +
    ''),
    "value" : Handlebars.compile('' +
      '<div class="modal-content">' +
        '<div class="modal-header">' +
          '<button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>' +
          '<div class="modal-title">' +
            'Expected {{details.validator.message}}, Got {{details.actualValue}}' +
          '</div>' +
        '</div>' +
        '<div class="modal-body"></div>' +
      '</div>' +
      '<div class="clearfix"></div>' +
    ''),
    "extra" : Handlebars.compile('' +
      '<div class="modal-content">' +
        '<div class="modal-header">' +
          '<button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>' +
          '<div class="modal-title">' +
            'Extra Parameter' +
          '</div>' +
        '</div>' +
        '<div class="modal-body">' +
          '{{#if details.matches}} Did you mean {{#each details.matches}}{{this}}{{#unless @last}} or {{/unless}}{{/each}} ?<br>{{/if}}' +
          '{{#if details.otherLoc}} Did you meant to add it at {{#each details.otherLoc}}{{this}}{{#unless @last}} or {{/unless}}{{/each}} ?{{/if}}' +
        '</div>' +
      '</div>' +
      '<div class="clearfix"></div>' +
    ''),
  },
  classNameMap = {
    warn  : "glyphicon-warning-sign text-warning",
    error : "glyphicon-remove text-danger",
  };

  CodeMirror.defineInitHook(function(editor) {
    editor.on("renderLine", function(editor, lineHandler, element) {
      var
      state = lineHandler.stateAfter,
      lineNum = lineHandler.lineNo(),
      detailedObj = state.structure.detailedObjsPosMap[lineNum];
      if(detailedObj && detailedObj.invalidObject) {
        element.className += " cm-javascript-validation-" + detailedObj.invalidObject.type;
      }
      else {
        element.className += " cm-javascript-validation-pass";
      }
    });

    function updateLines(editor, fromLineNo, toLineNo, linesMap) {
      for(var l = fromLineNo; l <= toLineNo; l++) {
        if(!linesMap[l]) {
          var
          state = editor.getStateAfter(l),
          lineInfo = editor.lineInfo(l),
          ele = document.createElement("span"),
          detailedObj = state.structure.detailedObjsPosMap[l];
          if(detailedObj && detailedObj.invalidObject) {
            ele.className = "glyphicon validation " + classNameMap[detailedObj.invalidObject.type];
          }
          editor.setGutterMarker(l, "CodeMirror-keyinfo", ele);
          linesMap[l] = 1;
        }
      }
    }

    editor.on("changes", function(editor, changes) {
      var
      linesMap = {};

      for(var i = 0; i < changes.length; i++) {
        var
        fromEffective = changes[i].from.line,
        toEffective = changes[i].to.line + (changes[i].text.length - changes[i].removed.length);
        updateLines(editor, fromEffective, toEffective, linesMap);
      }
    });

    editor.on("gutterClick", function(editor, line, gutter, e) {
      if(gutter === "CodeMirror-keyinfo") {
        var
        state = editor.getStateAfter(line),
        detailedObj = state.structure.detailedObjsPosMap[line];

        if(detailedObj && detailedObj.invalidObject) {
          if(editor.keyInfoWidget) {
            editor.keyInfoWidget.remove();
          }

          var widget = document.createElement("div");
          widget.innerHTML = templates[detailedObj.invalidObject.invalidType](detailedObj.invalidObject);
          widget.className = "cm-javascript-validation-keyinfo";

          editor.addWidget({line : line, ch : 0}, widget, true);
          editor.keyInfoWidget = widget;

          $(widget).find("button.close").click(function() {
            widget.remove();
            editor.keyInfoWidget = null;
          });
        }
      }
    });

    editor.on("mousedown", function(editor, e) {
      if(editor.keyInfoWidget && !editor.keyInfoWidget.contains(e.target)) {
        editor.keyInfoWidget.remove();
      }
    });
  });
});
