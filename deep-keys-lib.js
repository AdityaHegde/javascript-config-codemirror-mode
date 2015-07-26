(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module unless amdModuleId is set
    define([], function () {
      return (root['deep_keys_lib'] = factory());
    });
  } else if (typeof exports === 'object') {
    // Node. Does not work with strict CommonJS, but
    // only CommonJS-like environments that support module.exports,
    // like Node.
    module.exports = factory();
  } else {
    root['DeepKeysLib'] = factory();
  }
}(this, function () {

var typeOf, notNone, assignValue, deleteKey, hierarchy, diff, getValue, deep_keys_lib, _deepSearch_, _exists_, _replaceKeys_, deepSearch, HierarchyManager;
typeOf = function (obj) {
  return {}.toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase();
};
notNone = function (val) {
  return null !== val && undefined !== val;
};
_deepSearch_ = deepSearch = function () {
  var getInsertObject = function (nextKey) {
      if (nextKey.match(/^\d+$/)) {
        return [];
      } else {
        return {};
      }
    }, deepSearch = function (obj, key, insert, expandKeys) {
      var keys = key.split(/\./), i = 0;
      for (i = 0; i < keys.length - 1; i++) {
        if (keys[i] === '*') {
          var results = [];
          if (typeOf(obj) === 'array' || typeOf(obj) === 'object') {
            var searchObj = obj;
            if (typeOf(obj) === 'object' && expandKeys && expandKeys.length > 0) {
              searchObj = expandKeys[0];
              expandKeys = expandKeys.splice(1);
            }
            for (var k in searchObj) {
              if (obj[k] !== null && obj[k] !== undefined) {
                var retResults = deepSearch(obj[k], keys.slice(i + 1).join('.'), insert, expandKeys);
                if (retResults) {
                  Array.prototype.push.apply(results, retResults);
                }
              }
            }
          }
          return results.length > 0 ? results : null;
        } else if (notNone(obj[keys[i]])) {
          obj = obj[keys[i]];
        } else if (insert) {
          obj[keys[i]] = getInsertObject(keys[i + 1]);
          obj = obj[keys[i]];
        } else {
          return null;
        }
      }
      if (keys[i] !== '') {
        if ((typeOf(obj) === 'array' && keys[i].match(/^\d*$/) || typeOf(obj) === 'object') && keys[i] !== '*') {
          return [[
              obj,
              keys[i],
              obj[keys[i]]
            ]];
        } else {
          return null;
        }
      } else {
        return [[
            obj,
            keys[i],
            obj
          ]];
      }
    };
  return deepSearch;
}();
assignValue = function () {
  return function (obj, key, value, dontReplace, expandKeys) {
    var deep = deepSearch(obj, key, true, expandKeys);
    if (deep) {
      for (var i = 0; i < deep.length; i++) {
        if (!dontReplace || (deep[i][0][deep[i][1]] === null || deep[i][0][deep[i][1]] === undefined)) {
          deep[i][0][deep[i][1]] = value;
        }
      }
    }
  };
}();
deleteKey = function () {
  return function (obj, key, expandKeys) {
    var deep = deepSearch(obj, key, false, expandKeys);
    if (deep) {
      for (var i = 0; i < deep.length; i++) {
        delete deep[i][0][deep[i][1]];
      }
    }
  };
}();
hierarchy = HierarchyManager = function () {
  function HierarchyManager() {
    this.hierarchy = [];
    this.hierarchyPlaceholder = [];
    this.hierarchyPlaceholders = [];
    this.hierarchyStr = '';
    this.hierarchyPlaceholderStr = '';
    this.fullHierarchyStr = '';
    this.fullHierarchyPlaceholderStr = '';
  }
  HierarchyManager.prototype.replacePlaceholders = function (srcHierarchyPlaceholder) {
    var retHierarchy = srcHierarchyPlaceholder.slice();
    for (var i = 0, j = 0; i < this.hierarchy.length && i < retHierarchy.length && j < this.hierarchyPlaceholders.length; i++) {
      if (i === this.hierarchyPlaceholders[j].index) {
        if (retHierarchy[i] === this.hierarchyPlaceholders[j].placeholder) {
          retHierarchy[i] = this.hierarchy[i];
          j++;
        } else {
          break;
        }
      } else if (this.hierarchy[i] !== retHierarchy[i]) {
        break;
      }
    }
    return retHierarchy;
  };
  HierarchyManager.prototype.pushToHierarchy = function (key, keyPlaceholder) {
    keyPlaceholder = keyPlaceholder || key;
    this.hierarchyStr = this.hierarchy.join('.');
    this.hierarchyPlaceholderStr = this.hierarchyPlaceholder.join('.');
    if (key !== keyPlaceholder) {
      this.hierarchyPlaceholders.push({
        placeholder: keyPlaceholder,
        index: this.hierarchyPlaceholder.length
      });
    }
    this.hierarchy.push(key);
    this.hierarchyPlaceholder.push(keyPlaceholder);
    this.fullHierarchyStr = this.hierarchy.join('.');
    this.fullHierarchyPlaceholderStr = this.hierarchyPlaceholder.join('.');
  };
  HierarchyManager.prototype.popFromHierarchy = function () {
    if (this.hierarchyPlaceholders.length > 0 && this.hierarchyPlaceholders[this.hierarchyPlaceholders.length - 1].index === this.hierarchyPlaceholder.length - 1) {
      this.hierarchyPlaceholders.pop();
    }
    this.hierarchy.pop();
    this.hierarchyPlaceholder.pop();
    this.hierarchyStr = this.hierarchy.slice(0, -1).join('.');
    this.hierarchyPlaceholderStr = this.hierarchyPlaceholder.slice(0, -1).join('.');
    this.fullHierarchyStr = this.hierarchy.join('.');
    this.fullHierarchyPlaceholderStr = this.hierarchyPlaceholder.join('.');
  };
  HierarchyManager.prototype.updateHierarchy = function (fullKey, fullPlaceholderKey) {
    var keys = fullKey.split(/\./), placeholderKeys = fullPlaceholderKey && fullPlaceholderKey.split(/\./), i, hlen = this.hierarchy.length;
    for (i = 0; i < keys.length && i < hlen && this.hierarchy[i] === keys[i]; i++);
    for (var j = i; j < hlen; j++) {
      this.popFromHierarchy();
    }
    for (var j = i; j < keys.length; j++) {
      var key = keys[j], pkey = placeholderKeys ? placeholderKeys[j] : key;
      if (key.match(/^\d*$/)) {
        key = Number(key);
        pkey = !placeholderKeys ? '*' : pkey;
      }
      this.pushToHierarchy(key, pkey);
    }
  };
  return HierarchyManager;
}();
diff = function () {
  var _diff = function (srcObj, tarObj, meta) {
    var diffObj, hasDiff = 0;
    if (typeOf(srcObj) === 'object') {
      if (typeOf(tarObj) === 'object') {
        diffObj = {};
        for (var k in tarObj) {
          meta.hierarchy.pushToHierarchy(k);
          var d = undefined;
          if (!meta.ignoreKeys[meta.hierarchy.fullHierarchyStr]) {
            d = _diff(srcObj[k], tarObj[k], meta);
          }
          meta.hierarchy.popFromHierarchy();
          if (d !== undefined) {
            diffObj[k] = d;
            hasDiff = 1;
          }
        }
      }
    } else if (typeOf(srcObj) === 'array') {
      if (typeOf(tarObj) === 'array') {
        diffObj = [];
        for (var i = 0; i < tarObj.length; i++) {
          meta.hierarchy.pushToHierarchy(i, '*');
          var d = undefined;
          if (!meta.ignoreKeys[meta.hierarchy.fullHierarchyStr]) {
            d = _diff(srcObj[i], tarObj[i], meta);
          }
          meta.hierarchy.popFromHierarchy();
          diffObj.push(d);
          if (d !== undefined) {
            hasDiff = 1;
          }
        }
      }
    } else {
      if (!meta.ignoreKeys[meta.hierarchy.fullHierarchyStr]) {
        if (srcObj !== tarObj) {
          diffObj = tarObj;
          hasDiff = 1;
        }
      }
    }
    return hasDiff === 1 ? diffObj : undefined;
  };
  return function (srcObj, tarObj, ignoreKeys) {
    return _diff(srcObj, tarObj, {
      ignoreKeys: ignoreKeys,
      hierarchy: new HierarchyManager()
    });
  };
}();
_exists_ = function () {
  return function (obj, key, or, expandKeys) {
    or = !!or;
    var val = deepSearch(obj, key, false, expandKeys), exists = !or;
    if (val) {
      for (var i = 0; i < val.length; i++) {
        var e = notNone(val[i][2]);
        exists = or && (exists || e) || !or && (exists && e);
      }
    } else {
      exists = false;
    }
    return exists;
  };
}();
getValue = function () {
  return function (obj, key, expandKeys) {
    var deep = deepSearch(obj, key, false, expandKeys), values = [];
    if (deep) {
      for (var i = 0; i < deep.length; i++) {
        values.push(deep[i][2]);
      }
    }
    return values.length > 0 ? values : null;
  };
}();
_replaceKeys_ = function () {
  var replaceKeys = function (obj, params) {
    if (typeOf(obj) === 'object' || typeOf(obj) === 'array') {
      for (var k in obj) {
        obj[k] = replaceKeys(obj[k], params);
      }
    } else {
      var parts = obj.match(/<.*?>/g) || [];
      for (var i = 0; i < parts.length; i++) {
        var val = getValue(params, parts[i].replace(/<(.*)>/, '$1')), regexp = new RegExp(parts[i].replace(/\./, '\\.'));
        if (val && notNone(val[0])) {
          obj = obj.replace(regexp, val[0]);
        }
      }
    }
    return obj;
  };
  return replaceKeys;
}();
deep_keys_lib = function (exists, replaceKeys, HierarchyManager) {
  var DeepKeysLib = {
    typeOf: typeOf,
    notNone: notNone,
    deepSearch: deepSearch,
    assignValue: assignValue,
    deleteKey: deleteKey,
    diff: diff,
    exists: exists,
    getValue: getValue,
    replaceKeys: replaceKeys,
    HierarchyManager: HierarchyManager
  };
  return DeepKeysLib;
}(_exists_, _replaceKeys_, hierarchy);
return deep_keys_lib;

}));
