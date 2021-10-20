function anonymous(options, links) {
  var nochild = links.nochild;
  var assign = links.assign;
  var skip = links.skip;
  var trace = links.trace;
  var _6 = links._6;
  var _7 = links._7;
  var _9 = links._9;
  var _a = links._a;
  var _0;

  function r_list(r_item, r_test) {
    var _1;
    var _2 = options.captures;
    options.captures = {};

    function _4() {
      var _3;

      if (!skip(options)) _3 = null;
      else {
        options.to = options.from + _6.length;
        var _8 = options.input.substring(options.from, options.to);
        if (options.ignoreCase ? _6 === _8.toLowerCase() : _6 === _8)
          _3 = nochild;
        else {
          _3 = null;
          options.log && options._ffExpect(options.from, _7);
        }
      }

      return _3;
    }

    function _5() {
      var _3;

      if (!skip(options)) _3 = null;
      else {
        options.to = options.from + _9.length;
        var _b = options.input.substring(options.from, options.to);
        if (options.ignoreCase ? _9 === _b.toLowerCase() : _9 === _b)
          _3 = nochild;
        else {
          _3 = null;
          options.log && options._ffExpect(options.from, _a);
        }
      }

      return _3;
    }

    if (options.trace) {
      _1 = trace("list", options, function () {
        return r_list(_4, void 0, _5);
      });
    } else {
      _1 = r_list(_4, void 0, _5);
    }

    options.captures = _2;
    return _1;
  }

  if (options.trace) {
    _0 = trace("list", options, function () {
      return r_list();
    });
  } else {
    _0 = r_list();
  }

  return _0;
}
