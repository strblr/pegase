function anonymous(options, links) {
  var nochild = links.nochild;
  var assign = links.assign;
  var skip = links.skip;
  var trace = links.trace;
  var _l = links._l;
  var _m = links._m;
  var _n = links._n;
  var _p = links._p;
  var _q = links._q;
  var _r = links._r;
  var _t = links._t;
  var _u = links._u;
  var _v = links._v;
  var _x = links._x;
  var _y = links._y;
  var _z = links._z;
  var _13 = links._13;
  var _14 = links._14;
  var _16 = links._16;
  var _17 = links._17;
  var _19 = links._19;
  var _0;
  var _1 = {};

  function r_expr(r_num) {
    var _2;
    var _3 = {};

    r_num =
      r_num !== void 0
        ? r_num
        : function () {
            var _2;

            if (options.trace) {
              _2 = trace("number", options, function () {
                return r_number();
              });
            } else {
              _2 = r_number();
            }

            return _2;
          };

    var _5 = options.from;
    var _6;
    var _7 = false;

    _6 = {};

    if (options.trace) {
      _2 = trace("num", options, function () {
        return r_num();
      });
    } else {
      _2 = r_num();
    }

    if (_2 === null && !_7) {
      options.from = _5;

      _6 = {};

      if (options.trace) {
        _2 = trace("operator", options, function () {
          return r_operator();
        });
      } else {
        _2 = r_operator();
      }

      if (_2 !== null) {
        var _9 = options.from;
        var _8 = _2.concat();

        options.from = options.to;

        _7 = true;
        options.to = options.from;
        _2 = nochild;

        if (_2 !== null) {
          _8.push.apply(_8, _2);

          options.from = options.to;

          function _f() {
            var _e;

            if (options.trace) {
              _e = trace("num", options, function () {
                return r_num();
              });
            } else {
              _e = r_num();
            }

            return _e;
          }

          if (options.trace) {
            _2 = trace("expr", options, function () {
              return r_expr(_f);
            });
          } else {
            _2 = r_expr(_f);
          }

          if (_2 !== null) {
            _8.push.apply(_8, _2);

            options.from = options.to;

            function _c() {
              var _b;

              if (options.trace) {
                _b = trace("num", options, function () {
                  return r_num();
                });
              } else {
                _b = r_num();
              }

              return _b;
            }

            if (options.trace) {
              _2 = trace("expr", options, function () {
                return r_expr(_c);
              });
            } else {
              _2 = r_expr(_c);
            }

            if (_2 !== null) {
              _8.push.apply(_8, _2);

              options.from = _9;
              _2 = _8;
            }
          }
        }
      }

      if (_2 === null && !_7) {
        options.from = _5;
      }
    }

    return _2;
  }

  function r_operator() {
    var _2;
    var _3 = {};

    var _i = options.from;
    var _j;
    var _k = false;

    _j = {};

    if (!skip(options)) _2 = null;
    else {
      options.to = options.from + _x.length;
      var _10 = options.input.substring(options.from, options.to);
      if (options.ignoreCase ? _x === _10.toLowerCase() : _x === _10) _2 = _y;
      else {
        _2 = null;
        options.log && options._ffExpect(options.from, _z);
      }
    }

    if (_2 === null && !_k) {
      options.from = _i;

      _j = {};

      if (!skip(options)) _2 = null;
      else {
        options.to = options.from + _t.length;
        var _w = options.input.substring(options.from, options.to);
        if (options.ignoreCase ? _t === _w.toLowerCase() : _t === _w) _2 = _u;
        else {
          _2 = null;
          options.log && options._ffExpect(options.from, _v);
        }
      }

      if (_2 === null && !_k) {
        options.from = _i;

        _j = {};

        if (!skip(options)) _2 = null;
        else {
          options.to = options.from + _p.length;
          var _s = options.input.substring(options.from, options.to);
          if (options.ignoreCase ? _p === _s.toLowerCase() : _p === _s) _2 = _q;
          else {
            _2 = null;
            options.log && options._ffExpect(options.from, _r);
          }
        }

        if (_2 === null && !_k) {
          options.from = _i;

          _j = {};

          if (!skip(options)) _2 = null;
          else {
            options.to = options.from + _l.length;
            var _o = options.input.substring(options.from, options.to);
            if (options.ignoreCase ? _l === _o.toLowerCase() : _l === _o)
              _2 = _m;
            else {
              _2 = null;
              options.log && options._ffExpect(options.from, _n);
            }
          }

          if (_2 === null && !_k) {
            options.from = _i;
          }
        }
      }
    }

    return _2;
  }

  function r_number() {
    var _2;
    var _3 = {};

    if (!skip(options)) _2 = null;
    else {
      var _11 = options.skip;
      options.skip = false;

      var _12 = options.log;
      options.log = false;

      var _15 = _14(options, _3);

      if (!skip(options)) _2 = null;
      else {
        var _18 = options.ignoreCase ? _17 : _16;
        _18.lastIndex = options.from;
        var _1a = _18.exec(options.input);
        if (_1a !== null) {
          if (_1a.groups) assign(_3, _1a.groups);
          options.to = options.from + _1a[0].length;
          _2 = _1a.slice(1);
        } else {
          _2 = null;
          options.log && options._ffExpect(options.from, _19);
        }
      }

      _2 = _15(_2);

      options.log = _12;
      if (_2 === null && _12) options._ffExpect(options.from, _13);

      options.skip = _11;
    }

    return _2;
  }

  if (options.trace) {
    _0 = trace("expr", options, function () {
      return r_expr();
    });
  } else {
    _0 = r_expr();
  }

  return _0;
}
