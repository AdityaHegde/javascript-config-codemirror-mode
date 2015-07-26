(function(mod) {
  if (typeof exports == "object" && typeof module == "object") // CommonJS
    mod(require("../../lib/codemirror"));
  else if (typeof define == "function" && define.amd) // AMD
    define(["../../lib/codemirror"], mod);
  else // Plain browser env
    mod(CodeMirror);
})(function(CodeMirror) {

  function State(options) {
    options = options || {};

    this.token = options.token || {
      state      : "beg",
      stateStack : [],
      curLine    : -1,
      tokens     : [],
    };

    this.structure = options.structure || {
      state              : "beg",
      stateStack         : [],
      value              : null,
      curObj             : null,
      objsStack          : [],
      curObjDetailed     : null,
      detailedObjsStack  : [],
      detailedObjsPosMap : [],
      detailedObjsKeyMap : {},
      objsStack          : [],
      curKey             : null,
      curIndent          : 0,
      keysStack          : [],
      tokensIdx          : 0,
    };

    this.validator = options.validator || (options.validatorConfig && new ValidateConfig(options.validatorConfig));
  }

  State.TOKEN_STATES = {
    "beg" : [{
      regex : /{/,
      token : "OpenCurlyBrace",
      to : "object",
    }, {
      regex : /\[/,
      token : "OpenSquareBrace",
      to : "array",
    }, {
      regex : /\s+/,
      token : "Space",
    }],
    "object" : [{
      regex : /([a-zA-Z_][a-zA-Z0-9_]*)/,
      token : "Key",
    }, {
      regex : /"/,
      token : "String",
      to : "double_quote",
    }, {
      regex : /'/,
      token : "String",
      to : "singe_quote",
    }, {
      regex : /([0-9]+)/,
      token : "Number",
    }, {
      regex : /(true|false)/,
      token : "Boolean",
    }, {
      regex : /:/,
      token : "KeyValueSeperator",
    }, {
      regex : /,/,
      token : "KeysSeperator",
    }, {
      regex : /{/,
      token : "OpenCurlyBrace",
      to : "object",
    }, {
      regex : /\[/,
      token : "OpenSquareBrace",
      to : "array",
    }, {
      regex : /}/,
      token : "CloseCurlyBrace",
      to : "back",
    }, {
      regex : /\s+/,
      token : "Space",
    }],
    "array" : [{
      regex : /"/,
      token : "String",
      to : "double_quote",
    }, {
      regex : /'/,
      token : "String",
      to : "singe_quote",
    }, {
      regex : /([0-9]+)/,
      token : "Number",
    }, {
      regex : /(true|false)/,
      token : "Boolean",
    }, {
      regex : /,/,
      token : "ElementsSeperator",
    }, {
      regex : /{/,
      token : "OpenCurlyBrace",
      to : "object",
    }, {
      regex : /\[/,
      token : "OpenSquareBrace",
      to : "array",
    }, {
      regex : /\]/,
      token : "CloseSquareBrace",
      to : "back",
    }, {
      regex : /\s+/,
      token : "Space",
    }],
    double_quote : [{
      regex : /"/,
      token : "String",
      to : "back",
      endLexer : true,
    }, {
      //TODO : handle escaped quote
      regex : /([^"]+)/,
      token : "String",
    }],
    singe_quote : [{
      regex : /'/,
      token : "String",
      to : "back",
      endLexer : true,
    }, {
      //TODO : handle escaped quote
      regex : /([^']+)/,
      token : "String",
    }],
  };
  State.MERGE_TOKENS = {
    Key    : 1,
    String : 1,
    Number : 1,
    Space  : 1,
  };

  State.prototype.addToken = function(token) {
    var topToken = this.token.tokens[this.token.tokens.length - 1];
    if(topToken && topToken.type === token.type && State.MERGE_TOKENS[topToken.type]) {
      topToken.value += token.value;
    }
    else {
      this.token.tokens.push(token);
    }
  };

  State.prototype.extractTokens = function(stream) {
    var
    end = false, tokens = [], lastTokenType = null;
    if(stream.sol()) {
      this.token.curLine++;
    }
    while(!end) {
      var
      stateObj = State.TOKEN_STATES[this.token.state];
      end = true;
      for(var i = 0; i < stateObj.length; i++) {
        var
        ch = stream.column() + stream.pos - stream.indentation(),
        match = stream.match(stateObj[i].regex);
        if(match) {
          if(lastTokenType && lastTokenType !== stateObj[i].token) {
            stream.backUp(match[0].length);
            break;
          }
          lastTokenType = stateObj[i].token;

          this.addToken({
            type  : stateObj[i].token,
            value : match[1] || "",
            line  : this.token.curLine,
            ch    : ch,
          });
          tokens.push(stateObj[i].token);
          if(stateObj[i].to) {
            if(stateObj[i].to === "back") {
              this.token.state = this.token.stateStack.pop();
            }
            else {
              this.token.stateStack.push(this.token.state);
              this.token.state = stateObj[i].to;
            }
          }
          if(!stateObj[i].endLexer) {
            end = false;
          }
          break;
        }
      }
    }
    if(tokens.length === 0) {
      stream.skipToEnd();
      tokens.push("error");
    }
  };


  State.STRUCTURE_STATES = {
    beg : {
      OpenCurlyBrace : {
        to : "object",
        oprn : "startObject",
        indent : 1,
      },
      OpenSquareBrace : {
        to : "array",
        oprn : "startArray",
        indent : 1,
      },
      Object : {
        to : "end",
      },
      Array : {
        to : "end",
      },
      Space : {},
    },
    object : {
      Key : {
        to : "key",
        oprn : "addKey",
        codemirrorToken : "property",
      },
      Number : {
        to : "key",
        oprn : "addKey",
        codemirrorToken : "property",
      },
      Boolean : {
        to : "key",
        oprn : "addKey",
        codemirrorToken : "property",
      },
      String : {
        to : "key",
        oprn : "addKey",
        codemirrorToken : "property string",
      },
      CloseCurlyBrace : {
        to : "back",
        replaceToken : "Object",
        oprn : "popCurObj",
        indent : -1,
      },
      Space : {},
    },
    array : {
      String : {
        to : "array_value",
        oprn : "pushValue",
        valueType : "string",
        codemirrorToken : "string",
      },
      Number : {
        to : "array_value",
        oprn : "pushValue",
        valueType : "number",
        codemirrorToken : "number",
      },
      Boolean : {
        to : "array_value",
        oprn : "pushValue",
        valueType : "boolean",
        codemirrorToken : "boolean",
      },
      OpenCurlyBrace : {
        to : "object",
        oprn : "pushObject",
        indent : 1,
      },
      Object : {
        to : "array_value",
      },
      OpenSquareBrace : {
        to : "array",
        oprn : "pushArray",
        indent : 1,
      },
      Array : {
        to : "array_value",
      },
      CloseSquareBrace : {
        to : "back",
        replaceToken : "Array",
        oprn : "popCurObj",
        indent : -1,
      },
      Space : {},
    },
    array_value : {
      ElementsSeperator : {
        to : "back",
      },
      CloseCurlyBrace : {
        to : "back",
        moveTokensIdx : -1,
      },
      Space : {},
    },
    key : {
      KeyValueSeperator : {
        to : "value",
      },
      Value : {},
      KeysSeperator : {
        to : "back",
        oprn : "popCurKey",
      },
      //closing braces without trailing 'KeysSeperator'
      CloseCurlyBrace : {
        to : "back",
        //oprn : "popCurKey",
        moveTokensIdx : -1,
      },
      CloseSquareBrace : {
        to : "back",
        //oprn : "popCurKey",
        moveTokensIdx : -1,
      },
      Space : {},
    },
    value : {
      String : {
        to : "back",
        replaceToken : "Value",
        oprn : "addValue",
        valueType : "string",
        codemirrorToken : "string",
      },
      Number : {
        to : "back",
        replaceToken : "Value",
        oprn : "addValue",
        valueType : "number",
        codemirrorToken : "number",
      },
      Boolean : {
        to : "back",
        replaceToken : "Value",
        oprn : "addValue",
        valueType : "boolean",
        codemirrorToken : "boolean",
      },
      OpenCurlyBrace : {
        to : "object",
        oprn : "addObject",
        indent : 1,
      },
      OpenSquareBrace : {
        to : "array",
        oprn : "addArray",
        indent : 1,
      },
      Object : {
        to : "back",
        replaceToken : "Value",
        //oprn : "popCurObj",
      },
      Array : {
        to : "back",
        replaceToken : "Value",
        //oprn : "popCurObj",
      },
      Space : {},
    },
    end : {},
  };
  State.STRUCTURE_OPERATIONS = {
    startObject : function(state, token, curStateData) {
      state.structure.curObj = state.structure.value = {};
      state.structure.curObjDetailed = {
        key   : "$",
        pkey  : "",
        value : state.structure.curObj,
        line  : token.line,
        ch    : token.ch,
        childValues : {},
      };
      state.structure.detailedObjsPosMap[token.line] = state.structure.curObjDetailed;
      state.structure.detailedObjsKeyMap["$"] = state.structure.curObjDetailed;
    },

    startArray : function(state, token, curStateData) {
      state.structure.curObj = state.structure.value = [];
      state.structure.curObjDetailed = {
        key   : "$",
        pkey  : "",
        value : state.structure.curObj,
        line  : token.line,
        ch    : token.ch,
        childValues : {},
      };
      state.structure.detailedObjsPosMap[token.line] = state.structure.curObjDetailed;
      state.structure.detailedObjsKeyMap["$"] = state.structure.curObjDetailed;
    },

    addKey : function(state, token, curStateData) {
      if(state.structure.curKey) {
        state.structure.keysStack.push(state.structure.curKey);
      }
      state.structure.curKey = token.value;

      var fullKey = state.structure.curObjDetailed.key + "." + state.structure.curKey;

      if(state.validator.invalidKeys.all[fullKey]) {
        state.validator.invalidKeys.unmarkAs(state.validator.invalidKeys.all[fullKey].invalidType, fullKey);
      }
      state.validator.goToKey(state.structure.curObjDetailed.key);
      state.validator.objectKeyValidator(state.structure.curObjDetailed.value, state.structure.curKey, "", true);
      state.structure.curObjDetailed.invalidObject = state.validator.invalidKeys.mandatoryKeyMissing[fullKey] || state.validator.invalidKeys.extraKey[fullKey];

      return state.validator.curValidator && state.structure.curObjDetailed.invalidObject ? "error" : "";
    },

    popCurKey : function(state, token, curStateData) {
      state.structure.curKey = state.structure.keysStack.pop();
    },

    addValue : function(state, token, curStateData) {
      var val = token.value;
      switch(curStateData.valueType) {
        case "number"  : val = Number(val); break;
        case "boolean" : val = val === "true" ? true : false; break;
        case "string"  :
        default        : break;
      }

      state.structure.curObj[state.structure.curKey] = val;
      return state.addDetailedObject(val, state.structure.curKey, token);
    },

    addObject : function(state, token, curStateData) {
      var
      obj = {};
      state.structure.objsStack.push(state.structure.curObj);
      state.structure.curObj[state.structure.curKey] = obj;
      state.structure.curObj = obj;
      return state.addDetailedObject(obj, state.structure.curKey, token, true);
    },

    addArray : function(state, token, curStateData) {
      var
      arr = [];
      state.structure.objsStack.push(state.structure.curObj);
      state.structure.curObj[state.structure.curKey] = arr;
      state.structure.curObj = arr;
      return state.addDetailedObject(arr, state.structure.curKey, token, true);
    },

    pushValue : function(state, token, curStateData) {
      var val = token.value, retval;
      switch(curStateData.valueType) {
        case "number"  : val = Number(val); break;
        case "boolean" : val = val === "true" ? true : false; break;
        case "string"  :
        default        : break;
      }

      retval = state.addDetailedObject(val, state.structure.curObj.length, token);
      state.structure.curObj.push(val);
      return retval;
    },

    pushObject : function(state, token, curStateData) {
      var
      obj = {}, retval;
      state.structure.objsStack.push(state.structure.curObj);
      retval = state.addDetailedObject(obj, state.structure.curObj.length, token, true);
      state.structure.curObj.push(obj);
      state.structure.curObj = obj;
      return retval;
    },

    pushArray : function(state, token, curStateData) {
      var
      arr = [], retval;
      state.structure.objsStack.push(state.structure.curObj);
      retval = state.addDetailedObject(arr, state.structure.curObj.length, token, true);
      state.structure.curObj.push(arr);
      state.structure.curObj = arr;
      return retval;
    },

    popCurObj : function(state, token, curStateData) {
      state.structure.curObj = state.structure.objsStack.pop();
      state.structure.curObjDetailed = state.structure.detailedObjsStack.pop();
      state.structure.detailedObjsPosMap[token.line] = state.structure.curObjDetailed;
    },
  };

  State.prototype.addDetailedObject = function(value, key, token, isDeepObj) {
    var
    fullKey = this.structure.curObjDetailed.key + "." + key,
    detailedObj = {
      key   : fullKey,
      pkey  : this.structure.curObjDetailed.key,
      value : value,
      line  : token.line,
      ch    : token.ch,
    };

    if(isDeepObj) {
      detailedObj.childValues = {};
      this.structure.detailedObjsStack.push(this.structure.curObjDetailed);
    }

    this.structure.curObjDetailed.childValues[key] = detailedObj;
    this.structure.detailedObjsPosMap[token.line] = detailedObj;
    this.structure.detailedObjsKeyMap[detailedObj.key] = detailedObj;

    this.validator.goToKey(fullKey);
    if(this.validator.invalidKeys.all[fullKey] && this.validator.curValidator) {
      this.validator.invalidKeys.unmarkAs(this.validator.invalidKeys.all[fullKey].invalidType, fullKey);
    }
    this.validator.validateKey(this.structure.curObjDetailed.value, key, value);

    if(isDeepObj) {
      this.structure.curObjDetailed = detailedObj;
    }

    detailedObj.invalidObject = this.validator.invalidKeys.all[fullKey];

    return this.validator.curValidator && detailedObj.invalidObject ? "error" : "";
  };

  State.prototype.updateStructure = function() {
    var
    stateObj = State.STRUCTURE_STATES[this.structure.state],
    i, codemirrorTokens = null;
    for(i = this.structure.tokensIdx; i < this.token.tokens.length; i++) {
      if(stateObj[this.token.tokens[i].type]) {
        var tokenStateObj = stateObj[this.token.tokens[i].type];

        if(tokenStateObj.oprn) {
          var codemirrorTokensFromOprn = State.STRUCTURE_OPERATIONS[tokenStateObj.oprn](this, this.token.tokens[i], tokenStateObj);
          if(codemirrorTokensFromOprn) {
            codemirrorTokens = (codemirrorTokens ? codemirrorTokens + " " : "") + codemirrorTokensFromOprn;
          }
        }

        if(tokenStateObj.moveTokensIdx) {
          i += tokenStateObj.moveTokensIdx;
        }

        if(tokenStateObj.replaceToken) {
          this.token.tokens.splice(i + 1, 0, {
            type  : tokenStateObj.replaceToken,
            value : "",
          });
        }

        if(tokenStateObj.to) {
          if(tokenStateObj.to === "back") {
            this.structure.state = this.structure.stateStack.pop();
          }
          else {
            this.structure.stateStack.push(this.structure.state);
            this.structure.state = tokenStateObj.to;
          }
        }

        if(tokenStateObj.indent) {
          this.structure.curIndent += tokenStateObj.indent;
        }

        if(tokenStateObj.codemirrorToken) {
          codemirrorTokens = (codemirrorTokens ? codemirrorTokens + " " : "") + tokenStateObj.codemirrorToken;
        }
      }
      else {
        break;
      }
      stateObj = State.STRUCTURE_STATES[this.structure.state];
    }
    this.structure.tokensIdx = i;
    return codemirrorTokens;
  };

  State.prototype.parse = function(stream) {
    this.extractTokens(stream);
    return this.updateStructure();
  };

  State.prototype.getDetailedObject = function(pos, objectOnly) {
    for(var l = pos.line; l >= 0; l--) {
      if(this.structure.detailedObjsPosMap[l]) {
        var ret = this.structure.detailedObjsPosMap[l];
        if(objectOnly && !this.structure.detailedObjsPosMap[l].childValues) {
          ret = this.structure.detailedObjsKeyMap[this.structure.detailedObjsPosMap[l].pkey];
        }
        return ret;
      }
    }
    return null;
  };

  CodeMirror.defineMode("javascript-config", function(config, parserConfig) {
    var conf = config;
    return {
      startState : function() {
        return new State({
          validatorConfig : _.cloneDeep(parserConfig.validatorConfig),
        });
      },

      token : function(stream, state) {
        return state.parse(stream);
      },

      blankLine : function(state) {
        state.curLine++;
      },

      indent : function(state, textAfter) {
        return (state.structure.curIndent - (textAfter.match(/\]|}/) ? 1 : 0) ) * conf.indentUnit;
      },

      copyState : function(state) {
        return new State({
          token           : _.cloneDeep(state.token),
          structure       : _.cloneDeep(state.structure),
          validatorConfig : _.cloneDeep(parserConfig.validatorConfig),
        });
      },
    };
  });

  CodeMirror.registerHelper("hint", "javascript-config", function(editor, options) {
    var
    pos = editor.getCursor(),
    state = editor.getStateAfter(pos.line);
    if(state.validator) {
      var
      detailedObj = state.getDetailedObject(pos, true),
      lastKey = state.token.tokens[state.structure.tokensIdx - 1],
      from;

      state.validator.goToKey(detailedObj.key);

      if(lastKey.type === "Key") {
        from = new CodeMirror.Pos(lastKey.line, lastKey.ch);
      }
      else if(lastKey.type === "String") {
        from = new CodeMirror.Pos(lastKey.line, lastKey.ch + 1);
      }
      else {
        from = pos;
      }

      var
      keys = state.validator.curValidator && state.validator.curValidator.keys ? _.keys(state.validator.curValidator.keys) : [];

      if(lastKey) {
        var reg = new RegExp(lastKey.value, "i");
        keys = keys.filter(function(key) {
          return key.match(reg);
        });
      }

      return {
        list : keys,
        from : from,
        to   : pos,
      };
    }
    return null;
  });

});
