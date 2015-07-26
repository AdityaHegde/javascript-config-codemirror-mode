(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module unless amdModuleId is set
    define(["deep_keys_lib"], function (a0) {
      return (root['validate_config'] = factory(a0));
    });
  } else if (typeof exports === 'object') {
    // Node. Does not work with strict CommonJS, but
    // only CommonJS-like environments that support module.exports,
    // like Node.
    module.exports = factory(require("deep-keys-lib"));
  } else {
    root['ValidateConfig'] = factory(DeepKeysLib);
  }
}(this, function (deep_keys_lib) {

var invalidKeys, typeOf, validators_arrayValidator, validators_arrayElementValidator, validators_numberValidator, validators_regexValidator, validators_validator, levenshteinDistance, validators_extraParamsValidator, validators_mandatoryParamsValidator, validators_objectValidator, validators_objectKeyValidator, validators_typeValidator, validators_validators, morph_config_morphKey, morph_config_morphNumberType, morph_config_morphStringType, morph_config_morphObjectType, morph_config_morphArrayType, morph_config_morphType, morph_config_morphObjectValue, morph_config_morphValue, morph_config_morphConfigs, setValidator, validate_config;
invalidKeys = function () {
  var invalidTypeMap = {
    'type': 'invalidType',
    'value': 'invalidValue',
    'extra': 'extraKey',
    'mandatory': 'mandatoryKeyMissing'
  };
  function InvalidKeys() {
    for (var k in invalidTypeMap) {
      this[invalidTypeMap[k]] = {};
    }
    this.all = {};
  }
  InvalidKeys.prototype.markAs = function (invalidType, key, type, details) {
    if (invalidTypeMap[invalidType]) {
      var ik = invalidTypeMap[invalidType];
      this.all[key] = this[ik][key] = {
        type: type,
        details: details,
        invalidType: invalidType
      };
    }
  };
  InvalidKeys.prototype.unmarkAs = function (invalidType, key) {
    if (invalidTypeMap[invalidType]) {
      var ik = invalidTypeMap[invalidType];
      delete this[ik][key];
      delete this.all[key];
    }
  };
  return InvalidKeys;
}();
typeOf = function (obj) {
  return {}.toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase();
};
validators_arrayValidator = function (obj, key, val, isStream) {
  if (!isStream) {
    for (var i = 0; i < val.length; i++) {
      this.arrayElementValidator(val, i, val[i], isStream);
    }
  }
  return true;
};
validators_arrayElementValidator = function (arr, i, val, isStream) {
  this.hierarchy.pushToHierarchy(i, this.curValidator.placeholderKey);
  this.curValidator = this.curValidator.elementsValidator;
  var newVal = this.morphKey(arr, i, arr[i], true);
  arr[i] = newVal;
  this.validator(arr, i, newVal, isStream);
  this.hierarchy.popFromHierarchy();
  this.curValidator = this.curValidator.parentValidator;
  return true;
};
validators_numberValidator = function (obj, key, val, isStream) {
  if (this.curValidator.min && val < this.curValidator.min || this.curValidator.max && val > this.curValidator.max) {
    this.invalidKeys.markAs('value', this.hierarchy.fullHierarchyStr, 'error', {
      key: key,
      actualValue: val,
      validator: this.curValidator,
      hierarchyStr: this.hierarchy.hierarchyStr
    });
    return false;
  }
  return true;
};
validators_regexValidator = function (obj, key, val) {
  var result = true;
  if (this.curValidator.regex) {
    result = !!val.match(this.curValidator.regex);
  }
  if (!result) {
    this.invalidKeys.markAs('value', this.hierarchy.fullHierarchyStr, 'error', {
      key: key,
      actualValue: val,
      validator: this.curValidator,
      hierarchyStr: this.hierarchy.hierarchyStr
    });
  }
  return result;
};
validators_validator = function (typeOf) {
  typeToValidatorMap = {
    'object': 'objectValidator',
    'array': 'arrayValidator',
    'string': 'regexValidator',
    'number': 'numberValidator',
    '__default__': 'regexValidator'
  };
  return function (obj, key, val, isStream) {
    if (this.typeValidator(obj, key, val, isStream)) {
      var validatorFun = typeToValidatorMap[this.curValidator.type] || typeToValidatorMap['__default__'];
      this[validatorFun](obj, key, val, isStream);
    }
    return true;
  };
}(typeOf);
levenshteinDistance = function () {
  var registry = {}, LevenshteinDistanceMain = function (s1, l1, s2, l2, meta) {
      var key = s1 + '__' + l1 + '__' + s2 + '__' + l2, val;
      if (registry[key]) {
        val = registry[key].val;
      } else {
        if (l1 === 0) {
          val = l2;
        } else if (l2 === 0) {
          val = l1;
        } else {
          var cost = s1.charAt(l1 - 1) === s2.charAt(l2 - 1) ? 0 : 1;
          val = Math.min(LevenshteinDistanceMain(s1, l1 - 1, s2, l2, meta) + 1, LevenshteinDistanceMain(s1, l1, s2, l2 - 1, meta) + 1, LevenshteinDistanceMain(s1, l1 - 1, s2, l2 - 1, meta) + cost);
        }
        registry[key] = { val: val };
      }
      return val;
    }, LevenshteinDistance = function (s1, s2) {
      var st;
      if (s1 > s2) {
        st = s1;
        s1 = s2;
        s2 = st;
      }
      return LevenshteinDistanceMain(s1, s1.length, s2, s2.length);
    };
  return LevenshteinDistance;
}();
validators_extraParamsValidator = function (typeOf, LevenshteinDistance) {
  return function (obj, key, val, isStream) {
    var matches = [], matcheObjs = [], otherLoc = [];
    for (var ck in this.curValidator.keys) {
      var ckl = ck.length, kl = key.length, ld = LevenshteinDistance(ck, key);
      if (ld <= 0.25 * kl) {
        matcheObjs.push({
          ld: ld,
          ck: ck
        });
      }
    }
    matches = matcheObjs.sort(function (a, b) {
      return a.ld - b.ld;
    }).map(function (e) {
      return e.ck;
    });
    if (this.fullKeysSet[key]) {
      for (var i = 0; i < this.fullKeysSet[key].length; i++) {
        var hierarchy = this.hierarchy.replacePlaceholders(this.fullKeysSet[key][i]).join('.');
        otherLoc.push(hierarchy);
      }
    }
    this.invalidKeys.markAs('extra', this.hierarchy.fullHierarchyStr, 'warn', {
      key: key,
      val: val,
      validator: this.curValidator,
      hierarchyStr: this.hierarchy.hierarchyStr,
      matches: matches,
      otherLoc: otherLoc
    });
    return true;
  };
}(typeOf, levenshteinDistance);
validators_mandatoryParamsValidator = function (obj, key, val, isStream) {
  this.invalidKeys.markAs('mandatory', this.hierarchy.fullHierarchyStr, 'error', {
    key: key,
    validator: this.curValidator,
    hierarchyStr: this.hierarchy.hierarchyStr
  });
  return true;
};
validators_objectValidator = function (obj, key, val, isStream) {
  var validated = {};
  if (!isStream) {
    for (var k in val) {
      this.objectKeyValidator(val, k, val[k], isStream);
      validated[k] = 1;
    }
  }
  for (var vk in this.curValidator.keys) {
    this.curValidator = this.curValidator.keys[vk];
    if (!validated[vk]) {
      var v = this.morphKey(val, vk, null, false);
      if (v !== null && v !== undefined) {
        val[vk] = v;
      }
    }
    this.hierarchy.pushToHierarchy(vk, vk);
    if ((val[vk] === null || val[vk] === undefined) && this.curValidator.isMandatory) {
      this.mandatoryParamsValidator(obj, vk, null, isStream);
    }
    this.hierarchy.popFromHierarchy();
    this.curValidator = this.curValidator.parentValidator;
  }
  return true;
};
validators_objectKeyValidator = function (obj, key, val, isStream) {
  this.hierarchy.pushToHierarchy(key, key);
  if (!this.curValidator.keys[key]) {
    this.extraParamsValidator(obj, key, val, isStream);
  } else {
    this.curValidator = this.curValidator.keys[key];
    var newVal = this.morphKey(obj, key, val, val !== null && val !== undefined);
    obj[key] = newVal;
    this.validator(obj, key, newVal, isStream);
    this.curValidator = this.curValidator.parentValidator;
  }
  this.hierarchy.popFromHierarchy();
  return newVal;
};
validators_typeValidator = function (obj, key, val, isStream) {
  if (typeOf(val) !== this.curValidator.type) {
    this.invalidKeys.markAs('type', this.hierarchy.fullHierarchyStr, 'error', {
      key: key,
      actualType: typeOf(val),
      validator: this.curValidator,
      hierarchyStr: this.hierarchy.hierarchyStr
    });
    return false;
  }
  return true;
};
validators_validators = function (arrayValidator, arrayElementValidator, numberValidator, regexValidator, validator, extraParamsValidator, mandatoryParamsValidator, objectValidator, objectKeyValidator, typeValidator) {
  return {
    arrayValidator: arrayValidator,
    arrayElementValidator: arrayElementValidator,
    numberValidator: numberValidator,
    regexValidator: regexValidator,
    validator: validator,
    extraParamsValidator: extraParamsValidator,
    mandatoryParamsValidator: mandatoryParamsValidator,
    objectValidator: objectValidator,
    objectKeyValidator: objectKeyValidator,
    typeValidator: typeValidator
  };
}(validators_arrayValidator, validators_arrayElementValidator, validators_numberValidator, validators_regexValidator, validators_validator, validators_extraParamsValidator, validators_mandatoryParamsValidator, validators_objectValidator, validators_objectKeyValidator, validators_typeValidator);
morph_config_morphKey = {
  morphKey: function (obj, key, val, isPresent) {
    var newVal = val;
    if (isPresent) {
      if (this.curValidator.morph) {
        newVal = this.morphType(obj, key, newVal, isPresent);
      }
      newVal = this.morphValue(obj, key, newVal, isPresent);
    } else {
      if (this.curValidator.morph && this.curValidator.morph.hasOwnProperty('default')) {
        newVal = this.curValidator.morph.default;
      }
    }
    return newVal;
  }
};
morph_config_morphNumberType = {
  'string': function (obj, key, val) {
    var retVal = val;
    switch (this.curValidator.morph.type) {
    case 'parse':
    default:
      retVal = Number(val);
      if (isNaN(retVal)) {
        retVal = val;
      }
      break;
    }
    return retVal;
  },
  'boolean': function (obj, key, val) {
    return val ? 1 : 0;
  },
  '__default__': function (obj, key, val) {
    return val;
  }
};
morph_config_morphStringType = {
  'number': function (obj, key, val) {
    return val + '';
  },
  'boolean': function (obj, key, val) {
    return val + '';
  },
  'array': function (obj, key, val) {
    var retVal = val;
    switch (this.curValidator.morph.type) {
    case 'join':
      retVal = val.join(this.curValidator.morph.joinStr || ',');
      break;
    case 'stringify':
    default:
      retVal = JSON.stringify(val);
      break;
    }
    return retVal;
  },
  'object': function (obj, key, val) {
    var retVal = val;
    switch (this.curValidator.morph.type) {
    default:
    case 'stringify':
      retVal = JSON.stringify(val);
      break;
    }
    return retVal;
  },
  '__default__': function (obj, key, val) {
    return val;
  }
};
morph_config_morphObjectType = {
  'string': function (obj, key, val) {
    var retVal = val;
    switch (this.curValidator.morph.type) {
    case 'parse':
    default:
      try {
        retVal = JSON.parse(val);
      } catch (e) {
        this.logger.error('InvalidValue', {
          key: key,
          actualValue: val,
          validator: this.curValidator,
          hierarchyStr: this.hierarchy.hierarchyStr
        });
      }
      break;
    }
    return retVal;
  },
  'array': function (obj, key, val) {
    var retObj = val;
    switch (this.curValidator.morph.type) {
    case 'indexToKeys':
    default:
      var i = 0;
      retObj = {};
      for (; i < val.length; i++) {
        if (this.curValidator.morph.indexToKeys.length > i) {
          retObj[this.curValidator.morph.indexToKeys[i].key] = val[i];
        }
      }
      for (; i < this.curValidator.morph.indexToKeys.length; i++) {
        if (this.curValidator.morph.indexToKeys[i].default) {
          retObj[this.curValidator.morph.indexToKeys[i].key] = this.curValidator.morph.indexToKeys[i].default;
        }
      }
      break;
    }
    return retObj;
  },
  '__default__': function (obj, key, val) {
    return val;
  }
};
morph_config_morphArrayType = {
  'string': function (obj, key, val) {
    var retVal = val;
    switch (this.curValidator.morph.type) {
    case 'split':
      var splitRegex = new RegExp(this.curValidator.morph.splitStr || ',');
      retVal = val.split(splitRegex);
      break;
    case 'parse':
    default:
      try {
        retVal = JSON.parse(val);
      } catch (e) {
        this.logger.error('InvalidValue', {
          key: key,
          actualValue: val,
          validator: this.curValidator,
          hierarchyStr: this.hierarchy.hierarchyStr
        });
      }
      break;
    }
    return retVal;
  },
  'array': function (obj, key, val) {
    return val;
  },
  '__default__': function (obj, key, val) {
    if (val !== null || val !== undefined) {
      return [val];
    }
    return val;
  }
};
morph_config_morphType = function (typeOf, morphNumberType, morphStringType, morphObjectType, morphArrayType) {
  var typeToMorphTypeMap = {
    'number': morphNumberType,
    'string': morphStringType,
    'object': morphObjectType,
    'array': morphArrayType,
    '__default__': {
      '__default__': function () {
        return null;
      }
    }
  };
  return {
    morphType: function (obj, key, val) {
      var morphSet = typeToMorphTypeMap[this.curValidator.type] || typeToMorphTypeMap['__default__'], morphFn = morphSet[typeOf(val)] || morphSet['__default__'];
      return morphFn.call(this, obj, key, val);
    }
  };
}(typeOf, morph_config_morphNumberType, morph_config_morphStringType, morph_config_morphObjectType, morph_config_morphArrayType);
morph_config_morphObjectValue = function (DeepKeysLib) {
  return {
    'seperateKeys': function (obj, key, val) {
      return val;
    },
    'mergeKeys': function (obj, key, val) {
      if (this.curValidator.morph.mergeKeys) {
        for (var k in this.curValidator.morph.mergeKeys) {
          if (val[k] !== null && val[k] !== undefined) {
            DeepKeysLib.assignValue(val, this.curValidator.morph.mergeKeys[k].toKey, val[k], this.curValidator.morph.dontReplaceExisting, this.curValidator.morph.mergeKeys[k].expandKeys);
            delete val[k];
          }
        }
      }
      return val;
    },
    '__default__': function (obj, key, val) {
      return val;
    }
  };
}(deep_keys_lib);
morph_config_morphValue = function (typeOf, morphObjectValue) {
  var typeToMorphValueMap = { 'object': morphObjectValue };
  return {
    morphValue: function (obj, key, val) {
      if (this.curValidator.morph) {
        var morphSet = typeToMorphValueMap[this.curValidator.type], morphFn = morphSet && (morphSet[this.curValidator.morph.valueMorphType] || morphSet['__default__']);
        if (morphFn) {
          return morphFn.call(this, obj, key, val);
        }
      }
      return val;
    }
  };
}(typeOf, morph_config_morphObjectValue);
morph_config_morphConfigs = function (morphKey, morphType, morphValue) {
  var morphModules = [
      morphKey,
      morphType,
      morphValue
    ], MorphConfig = {};
  for (var i = 0; i < morphModules.length; i++) {
    for (var k in morphModules[i]) {
      MorphConfig[k] = morphModules[i][k];
    }
  }
  return MorphConfig;
}(morph_config_morphKey, morph_config_morphType, morph_config_morphValue);
setValidator = {
  _prepareValidator: function (validator) {
    if (validator.type === 'object') {
      for (var k in validator.keys) {
        this.hierarchy.pushToHierarchy(k);
        this._prepareValidator(validator.keys[k]);
        validator.keys[k].parentValidator = validator;
        if (!this.fullKeysSet[k]) {
          this.fullKeysSet[k] = [];
        }
        this.fullKeysSet[k].push(this.hierarchy.hierarchyPlaceholder.slice());
        this.hierarchy.popFromHierarchy();
      }
    } else if (validator.type === 'array') {
      this.hierarchy.pushToHierarchy('arrayElement', '*');
      validator.placeholderKey = '*';
      validator.elementsValidator.parentValidator = validator;
      this._prepareValidator(validator.elementsValidator);
      this.hierarchy.popFromHierarchy();
    }
    if (validator.morph && typeOf(validator.morph) === 'boolean') {
      validator.morph = {};
    }
    this.validatorKeyMap[this.hierarchy.fullHierarchyPlaceholderStr] = validator;
  },
  setValidator: function (validator) {
    this._prepareValidator(validator);
    this.validatorConfig = validator;
    this.curValidator = validator;
  }
};
validate_config = function (InvalidKeys, DeepKeysLib, validators, morphConfigs, setValidator) {
  function ValidateConfig(validator) {
    this.fullReset();
    if (validator) {
      this.setValidator(validator);
    }
  }
  ValidateConfig.prototype.resetValidation = function () {
    this.hierarchy = new DeepKeysLib.HierarchyManager();
    this.hierarchy.pushToHierarchy('$', '$');
    this.invalidKeys = new InvalidKeys();
    this.curValidator = this.validatorConfig;
    this.validatorKeyMap = {};
  };
  ValidateConfig.prototype.fullReset = function () {
    this.resetValidation();
    this.fullKeysSet = {};
  };
  ValidateConfig.prototype.validate = function (config) {
    this.resetValidation();
    this.validator(null, '$', config);
  };
  ValidateConfig.prototype.goToKey = function (key) {
    var updateKey;
    if (key.match && key.match(/\./) || key === '$') {
      updateKey = key;
    } else {
      updateKey = this.hierarchy.fullHierarchyStr + '.' + key;
    }
    this.hierarchy.updateHierarchy(updateKey);
    this.curValidator = this.validatorKeyMap[this.hierarchy.fullHierarchyPlaceholderStr];
  };
  ValidateConfig.prototype.validateKey = function (obj, key, val) {
    if (this.curValidator) {
      this.validator(obj, key, val, true);
    }
  };
  var modules = [
    validators,
    morphConfigs,
    setValidator
  ];
  for (var i = 0; i < modules.length; i++) {
    for (var k in modules[i]) {
      ValidateConfig.prototype[k] = modules[i][k];
    }
  }
  return ValidateConfig;
}(invalidKeys, deep_keys_lib, validators_validators, morph_config_morphConfigs, setValidator);
return validate_config;

}));
