function anonymous(options, links) {
  var nochild = links.nochild;
  var skip = links.skip;
  var trace = links.trace;
  var _9 = links._9;
  var _a = links._a;
  var _f = links._f;
  var _g = links._g;
  var _i = links._i;
  var _0;

  function r_list() {
    var _1;

    var _2;
    function _6() {
      if (options.trace) {
        _1 = trace("int", options, function () {
          return r_int();
        });
      } else {
        _1 = r_int();
      }
    }
    _6();
    if (_1 !== null) {
      _2 = options.from;
      var _3 = options.to;
      var _4 = _1.concat();

      while (true) {
        options.from = _3;
        _6();
        if (_1 === null) break;
        _4.push.apply(_4, _1);
        _3 = options.to;
      }

      options.from = _2;
      options.to = _3;
      _1 = _4;
    }

    return _1;
  }

  function r_int() {
    var _1;

    if (!skip(options)) _1 = null;
    else {
      var _7 = options.skip;
      options.skip = false;

      var _8 = options.log;
      options.log = false;

      var _b = _a(options);

      var _c;
      function _k() {
        if (!skip(options)) _1 = null;
        else {
          var _h = options.ignoreCase ? _g : _f;
          _h.lastIndex = options.from;
          var _j = _h.exec(options.input);
          if (_j !== null) {
            if (_j.groups) Object.assign(options.captures, _j.groups);
            options.to = options.from + _j[0].length;
            _1 = _j.slice(1);
          } else {
            _1 = null;
            options.log && options._ffExpect(options.from, _i);
          }
        }
      }
      _k();
      if (_1 !== null) {
        _c = options.from;
        var _d = options.to;
        var _e = _1.concat();

        while (true) {
          options.from = _d;
          _k();
          if (_1 === null) break;
          _e.push.apply(_e, _1);
          _d = options.to;
        }

        options.from = _c;
        options.to = _d;
        _1 = _e;
      }

      _1 = _b(_1);

      options.log = _8;
      if (_1 === null && _8) options._ffExpect(options.from, _9);

      options.skip = _7;
    }

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
