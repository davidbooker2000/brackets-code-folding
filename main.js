/**
 * main file for code folding in brackets based on Code mirror's code folding addon feature
 * @author Patrick Oladimeji
 * @date 4/14/13 17:19:25 PM
 */
/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, document, require, $, brackets, window, MouseEvent, CodeMirror */

define(function (require, exports, module) {
    "use strict";
    var CommandManager          = brackets.getModule("command/CommandManager"),
        DocumentManager         = brackets.getModule("document/DocumentManager"),
        EditorManager            = brackets.getModule("editor/EditorManager"),
        Menus                   = brackets.getModule("command/Menus"),
        KeyEvent                = brackets.getModule("utils/KeyEvent"),
        ExtensionUtils          = brackets.getModule("utils/ExtensionUtils"),
        braceRangeFinder        = require("braceRangeFinder"),
        tagRangeFinder          = require("tagRangeFinder");
    
    var foldCode                = "javascript.code.folding",
        enabled                 = true;
    var _activeRangeFinder, foldFunc, _commentOrString = /^(comment|string)/;
    var _expandedChar = "\u25bc", _collapsedChar = "\u25b6", _foldMarker = "\u2194",
        _braceCollapsibleExtensions = [".js", ".css", ".less"],
        _tagCollapsibleExtensions   = [".xml", ".html", ".xhtml", ".htm"];
    
    function _createMarker(html, className) {
        var marker = document.createElement("div");
        marker.innerHTML = html;
        marker.className = className;
        return marker;
    }
    
    function _createCollapsedMarker(lineNum) {
        return _createMarker(lineNum + _collapsedChar, "cm-thehogfather-codefolding-collapsed CodeMirror-linenumber");
    }
    
    function _createExpandedMarker(lineNum) {
        return _createMarker(lineNum + _expandedChar, "cm-thehogfather-codefolding-expanded CodeMirror-linenumber");
    }
    
    function _getCollapsibleLines(cm, rangeFinder) {
        var viewport = cm.getViewport(), lines = [], i;
        for (i = viewport.from; i < viewport.to; i++) {
            var canFold = rangeFinder.canFold(cm.getLine(i));
            if (canFold) {
                lines.push(i);
            }
        }
        return lines;
    }
    
    function _toggleLineMarker(cm, line) {
        var marks = cm.findMarksAt(CodeMirror.Pos(line + 1, 0)), i;
        if (marks.length > 0) {
            //if we find any fold marks on this line then create an expand marker
            for (i = 0; i < marks.length; i++) {
                if (marks[i].__isFold) {
                    cm.setGutterMarker(line, "CodeMirror-linenumbers", _createCollapsedMarker(line + 1));
                    break;
                }
            }
        } else {
            //no marks on this line meaning it might not be collapsible or it is expanded
            //so only decorate it if it is already expanded
            var lInfo = cm.lineInfo(line);
            if (lInfo.gutterMarkers) {
                if (lInfo.gutterMarkers["CodeMirror-linenumbers"].textContent.indexOf(_collapsedChar) > -1) {
                    cm.setGutterMarker(line, "CodeMirror-linenumbers", _createExpandedMarker(line + 1));
                }
            } else { //no gutter markers on this line
                cm.setGutterMarker(line, "CodeMirror-linenumbers", _createExpandedMarker(line + 1));
            }
        }
    }
    
    //define new fold function 
    CodeMirror.newFoldFunction = function (rangeFinder, widget) {
        if (!widget) {
            widget = _foldMarker;
        }
        if (typeof widget === "string") {
            var text = document.createTextNode(widget);
            widget = document.createElement("span");
            widget.appendChild(text);
            widget.className = "CodeMirror-foldmarker";
        }
    
        return function (cm, pos) {
            if (typeof pos === "number") {
                pos = CodeMirror.Pos(pos, 0);
            }
            var range = rangeFinder(cm, pos);
            if (!range) {
                return;
            }
    
            var present = cm.findMarksAt(range.from), cleared = 0, i;
            for (i = 0; i < present.length; ++i) {
                if (present[i].__isFold) {
                    ++cleared;
                    present[i].clear();
                }
            }
            if (cleared) {
                return;
            }
            var myWidget = widget.cloneNode(true);
            var myRange = cm.markText(range.from, range.to, {
                replacedWith: myWidget,
                clearOnEnter: true,
                __isFold: true
            });
            CodeMirror.on(widget, "mousedown", function () {
                console.log(myRange);
                myRange.clear();
            });
            CodeMirror.on(myRange, "clear", function () {
                _toggleLineMarker(cm, pos.line);
            });
        };
    };
       
     /**
     * goes through the visible part of the document and decorates the line numbers with icons for
     * colapsing and expanding code sections
     */
    function _decorateGutters(cm) {
        var collapsibleLines = _getCollapsibleLines(cm, _activeRangeFinder);
        collapsibleLines.forEach(function (lineNum) {
            _toggleLineMarker(cm, lineNum);
        });
    }
    
    function _undecorateGutters(cm) {
        cm.clearGutter("CodeMirror-linenumbers");
    }
 
    function _handleGutterClick(cm, n) {
        var editor = EditorManager.getCurrentFullEditor();
        cm.off("scroll", _decorateGutters);
        foldFunc(cm, n);
        _toggleLineMarker(cm, n);
        cm.on("scroll", _decorateGutters);
    }
    
    function _registerHandlers(editor, fileType) {
        var cm = editor._codeMirror, doc = editor.document;
        $(doc).on("change", _decorateGutters);
        if (cm) {
            cm.on("scroll", _decorateGutters);
            //create the appropriate folding function based on the file that was opened
            var ext = doc.file.fullPath.slice(doc.file.fullPath.lastIndexOf(".")).toLowerCase();
            if (_braceCollapsibleExtensions.indexOf(ext) > -1) {
                _activeRangeFinder = braceRangeFinder;
            } else if (_tagCollapsibleExtensions.indexOf(ext) > -1) {
                _activeRangeFinder = tagRangeFinder;
            }
            foldFunc = CodeMirror.newFoldFunction(_activeRangeFinder.rangeFinder);
            cm.on("gutterClick", _handleGutterClick);
        }
        _decorateGutters(cm);
    }
    
    function _deregisterHandlers(editor) {
        var cm = editor._codeMirror;
        $(editor.document).off("change", _decorateGutters);
        if (cm) {
            cm.off("gutterClick", _handleGutterClick);
            cm.off("scroll", _decorateGutters);
        }
        _undecorateGutters(cm);
    }
    
    function _toggleExtension() {
        var editor = EditorManager.getCurrentFullEditor();
        enabled = !enabled;
        CommandManager.get(foldCode).setChecked(enabled);
        if (enabled) {
            _registerHandlers(editor);
        } else {
            _deregisterHandlers(editor);
        }
    }
   
    $(EditorManager).on("activeEditorChange", function (event, current, previous) {
        if (enabled) {
            if (previous) {
                _deregisterHandlers(previous);
            }
            if (current) {
                _registerHandlers(current);
            }
        }
    });
    
    //Load stylesheet
    ExtensionUtils.loadStyleSheet(module, "main.less");
    
    CommandManager.register("Enable Code Folding", foldCode, _toggleExtension);
    Menus.getMenu(Menus.AppMenuBar.VIEW_MENU).addMenuItem(foldCode);
    CommandManager.get(foldCode).setChecked(enabled);
});