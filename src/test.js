/*
    {
      nochild: [],
      skip: [Function: skip],
      _2: 'A',
      _3: 'a',
      _4: { type: 'LITERAL', literal: 'A' },
      _a: 'b',
      _b: { type: 'LITERAL', literal: 'b' },
      _d: [Function (anonymous)],
      _f: 'c',
      _g: { type: 'LITERAL', literal: 'c' }
    }

 */

function anonymous(options, links) {
  var nochild = links.nochild;
  var skip = links.skip;
  var _2 = links._2;
  var _3 = links._3;
  var _4 = links._4;
  var _a = links._a;
  var _b = links._b;
  var _d = links._d;
  var _f = links._f;
  var _g = links._g;
  var _0;

  function r_expr(r_a) {
    r_a =
      r_a !== void 0
        ? r_a
        : function () {
            var _1;

            if (!skip(options)) _1 = null;
            else {
              options.to = options.from + _2.length;
              var _5 = options.input.substring(options.from, options.to);
              if (options.ignoreCase ? _3 === _5.toLowerCase() : _2 === _5)
                _1 = nochild;
              else {
                options.log && options._ffExpect(options.from, _4);
                _1 = null;
              }
            }

            return _1;
          };

    var _1;

    _1 = r_a();

    if (_1 !== null) {
      var _7 = options.from;
      var _6 = _1.concat();

      options.from = options.to;

      if (!skip(options)) _1 = null;
      else {
        options.to = options.from + _a.length;
        var _c = options.input.substring(options.from, options.to);
        if (options.ignoreCase ? _a === _c.toLowerCase() : _a === _c)
          _1 = nochild;
        else {
          options.log && options._ffExpect(options.from, _b);
          _1 = null;
        }
      }

      if (_1 !== null) {
        _6.push.apply(_6, _1);

        options.from = options.to;

        _1 = r_term();

        if (_1 !== null) {
          _6.push.apply(_6, _1);

          options.from = _7;
          _1 = _6;
        }
      }
    }

    return _1;
  }

  function r_term() {
    var _1;

    var _e = _d(options);

    if (!skip(options)) _1 = null;
    else {
      options.to = options.from + _f.length;
      var _h = options.input.substring(options.from, options.to);
      if (options.ignoreCase ? _f === _h.toLowerCase() : _f === _h)
        _1 = nochild;
      else {
        options.log && options._ffExpect(options.from, _g);
        _1 = null;
      }
    }

    _1 = _e(_1);

    return _1;
  }

  _0 = r_expr();

  return _0;
}
