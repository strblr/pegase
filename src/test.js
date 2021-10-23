function anonymous(options, links) {
  var nochild = links.nochild;
  var assign = links.assign;
  var skip = links.skip;
  var trace = links.trace;
  var _6 = links._6;
  var _7 = links._7;
  var _c = links._c;
  var _d = links._d;
  var _0;
  var _1 = {};

  function r_a() {
    var _2;
    var _3 = {};

    if (!skip(options)) _2 = null;
    else {
      options.to = options.from + _6.length;
      var _8 = options.input.substring(options.from, options.to);
      if (options.ignoreCase ? _6 === _8.toLowerCase() : _6 === _8)
        _2 = nochild;
      else {
        _2 = null;
        options.log && options._ffExpect(options.from, _7);
      }
    }

    if (_2 !== null) {
      var _5 = options.from;
      var _4 = _2.concat();

      options.from = options.to;

      if (options.trace) {
        _2 = trace("b", options, function () {
          return r_b();
        });
      } else {
        _2 = r_b();
      }

      if (_2 !== null) {
        _4.push.apply(_4, _2);

        options.from = _5;
        _2 = _4;
      }
    }

    return _2;
  }

  function r_b() {
    var _2;
    var _3 = {};

    if (!skip(options)) _2 = null;
    else {
      options.to = options.from + _c.length;
      var _e = options.input.substring(options.from, options.to);
      if (options.ignoreCase ? _c === _e.toLowerCase() : _c === _e)
        _2 = nochild;
      else {
        _2 = null;
        options.log && options._ffExpect(options.from, _d);
      }
    }

    if (_2 !== null) {
      var _b = options.from;
      var _a = _2.concat();

      options.from = options.to;

      if (options.trace) {
        _2 = trace("c", options, function () {
          return r_c();
        });
      } else {
        _2 = r_c();
      }

      if (_2 !== null) {
        _a.push.apply(_a, _2);

        options.from = _b;
        _2 = _a;
      }
    }

    return _2;
  }

  if (options.trace) {
    _0 = trace("a", options, function () {
      return r_a();
    });
  } else {
    _0 = r_a();
  }

  return _0;
}
