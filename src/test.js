function anonymous(options, links) {
  var nochild = links.nochild;
  var skip = links.skip;
  var trace = links.trace;
  var _b = links._b;
  var _c = links._c;
  var _e = links._e;
  var _f = links._f;
  var _s = links._s;
  var _t = links._t;
  var _v = links._v;
  var _w = links._w;
  var _10 = links._10;
  var _11 = links._11;
  var _12 = links._12;
  var _0;

  function r_expr() {
    var _1;

    if (options.trace) {
      _1 = trace("term", options, function () {
        return r_term();
      });
    } else {
      _1 = r_term();
    }

    if (_1 !== null) {
      var _3 = options.from;
      var _2 = _1.concat();

      options.from = options.to;

      var _5 = options.from;
      function _i() {
        var _a = options.from;

        if (!skip(options)) _1 = null;
        else {
          options.to = options.from + _e.length;
          var _g = options.input.substring(options.from, options.to);
          if (options.ignoreCase ? _e === _g.toLowerCase() : _e === _g)
            _1 = nochild;
          else {
            options.log && options._ffExpect(options.from, _f);
            _1 = null;
          }
        }

        if (_1 === null) {
          options.from = _a;

          if (!skip(options)) _1 = null;
          else {
            options.to = options.from + _b.length;
            var _d = options.input.substring(options.from, options.to);
            if (options.ignoreCase ? _b === _d.toLowerCase() : _b === _d)
              _1 = nochild;
            else {
              options.log && options._ffExpect(options.from, _c);
              _1 = null;
            }
          }

          if (_1 === null) {
            options.from = _a;
          }
        }

        if (_1 !== null) {
          var _9 = options.from;
          var _8 = _1.concat();

          options.from = options.to;

          if (options.trace) {
            _1 = trace("term", options, function () {
              return r_term();
            });
          } else {
            _1 = r_term();
          }

          if (_1 !== null) {
            _8.push.apply(_8, _1);

            options.from = _9;
            _1 = _8;
          }
        }
      }
      _i();
      if (_1 !== null) {
        _5 = options.from;
        var _6 = options.to;
        var _7 = _1.concat();

        while (true) {
          options.from = _6;
          _i();
          if (_1 === null) break;
          _7.push.apply(_7, _1);
          _6 = options.to;
        }

        options.from = _5;
        options.to = _6;
        _1 = _7;
      } else {
        options.from = options.to = _5;
        _1 = nochild;
      }

      if (_1 !== null) {
        _2.push.apply(_2, _1);

        options.from = _3;
        _1 = _2;
      }
    }

    return _1;
  }

  function r_term() {
    var _1;

    if (options.trace) {
      _1 = trace("fact", options, function () {
        return r_fact();
      });
    } else {
      _1 = r_fact();
    }

    if (_1 !== null) {
      var _k = options.from;
      var _j = _1.concat();

      options.from = options.to;

      var _m = options.from;
      function _z() {
        var _r = options.from;

        if (!skip(options)) _1 = null;
        else {
          options.to = options.from + _v.length;
          var _x = options.input.substring(options.from, options.to);
          if (options.ignoreCase ? _v === _x.toLowerCase() : _v === _x)
            _1 = nochild;
          else {
            options.log && options._ffExpect(options.from, _w);
            _1 = null;
          }
        }

        if (_1 === null) {
          options.from = _r;

          if (!skip(options)) _1 = null;
          else {
            options.to = options.from + _s.length;
            var _u = options.input.substring(options.from, options.to);
            if (options.ignoreCase ? _s === _u.toLowerCase() : _s === _u)
              _1 = nochild;
            else {
              options.log && options._ffExpect(options.from, _t);
              _1 = null;
            }
          }

          if (_1 === null) {
            options.from = _r;
          }
        }

        if (_1 !== null) {
          var _q = options.from;
          var _p = _1.concat();

          options.from = options.to;

          if (options.trace) {
            _1 = trace("fact", options, function () {
              return r_fact();
            });
          } else {
            _1 = r_fact();
          }

          if (_1 !== null) {
            _p.push.apply(_p, _1);

            options.from = _q;
            _1 = _p;
          }
        }
      }

      _z();
      if (_1 !== null) {
        _m = options.from;
        var _n = options.to;
        var _o = _1.concat();

        while (true) {
          options.from = _n;
          _z();
          if (_1 === null) break;
          _o.push.apply(_o, _1);
          _n = options.to;
        }

        options.from = _m;
        options.to = _n;
        _1 = _o;
      } else {
        options.from = options.to = _m;
        _1 = nochild;
      }

      if (_1 !== null) {
        _j.push.apply(_j, _1);

        options.from = _k;
        _1 = _j;
      }
    }

    return _1;
  }

  function r_fact() {
    var _1;

    if (!skip(options)) _1 = null;
    else {
      var _13 = options.ignoreCase ? _11 : _10;
      _13.lastIndex = options.from;
      var _14 = _13.exec(options.input);
      if (_14 !== null) {
        if (_14.groups) Object.assign(options.captures, _14.groups);
        options.to = options.from + _14[0].length;
        _1 = _14.slice(1);
      } else {
        options.log && options._ffExpect(options.from, _12);
        _1 = null;
      }
    }

    return _1;
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
