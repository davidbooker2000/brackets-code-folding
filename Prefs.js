/**
 * Wrapper around brackets pref system to ensure preferences are stored in in one single object instead of using multiple keys. This is to make it easy for the user who edits their preferences file to easily manage the potentially numerous lines of preferences generated by the persisting code-folding state.
 * @author Patrick Oladimeji
 * @date 3/22/14 20:39:53 PM
 */
/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, brackets*/
define(function (require, exports, module) {
    "use strict";
    var PreferencesManager      = brackets.getModule("preferences/PreferencesManager"),
        _newAPI                 = PreferencesManager.getExtensionPrefs ? true : false,
        _prefs                  = _newAPI ? PreferencesManager.getExtensionPrefs("code-folding") :
                PreferencesManager.getPreferenceStorage(module),
        store = {},
        folds = "folds";
    
    module.exports = {
        get: function (id) {
            store = _newAPI ? (_prefs.get(folds) || {}) : (_prefs.getValue(folds) || {});
            return store[id];
        },
        set: function (id, value) {
            store[id] = value;
            return _newAPI ? _prefs.set(folds, store) : _prefs.setValue(folds, store);
        }
    };

});
