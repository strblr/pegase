function anonymous(options, links) {
  var nochild = links.nochild;
  var assign = links.assign;
  var skip = links.skip;
  var trace = links.trace;
  var _b = links._b;
  var _c = links._c;
  var _f = links._f;
  var _g = links._g;
  var _0;
  var _1 = {};

  function r_a() {
    var _2;
    var _3 = {};

    if (options.trace) {
      _2 = trace("b", options, function () {
        return r_b();
      });
    } else {
      _2 = r_b();
    }

    return _2;
  }

  function r_b() {
    var _2;
    var _3 = {};

    if (!skip(options)) _2 = null;
    else {
      var _5 = options.skip;
      options.skip = false;

      function r_u() {
        var _7;
        var _8 = {};

        if (!skip(options)) _7 = null;
        else {
          options.to = options.from + _b.length;
          var _d = options.input.substring(options.from, options.to);
          if (options.ignoreCase ? _b === _d.toLowerCase() : _b === _d)
            _7 = nochild;
          else {
            _7 = null;
            options.log && options._ffExpect(options.from, _c);
          }
        }

        if (_7 !== null) {
          var _a = options.from;
          var _9 = _7.concat();

          options.from = options.to;

          if (options.trace) {
            _7 = trace("v", options, function () {
              return r_v();
            });
          } else {
            _7 = r_v();
          }

          if (_7 !== null) {
            _9.push.apply(_9, _7);

            options.from = _a;
            _7 = _9;
          }
        }

        return _7;
      }

      function r_v() {
        var _7;
        var _8 = {};

        if (!skip(options)) _7 = null;
        else {
          options.to = options.from + _f.length;
          var _h = options.input.substring(options.from, options.to);
          if (options.ignoreCase ? _f === _h.toLowerCase() : _f === _h)
            _7 = nochild;
          else {
            _7 = null;
            options.log && options._ffExpect(options.from, _g);
          }
        }

        return _7;
      }

      if (options.trace) {
        _2 = trace("u", options, function () {
          return r_u();
        });
      } else {
        _2 = r_u();
      }

      options.skip = _5;
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
