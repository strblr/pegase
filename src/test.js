function anonymous(options, links) {
  var nochild = links.nochild;
  var assign = links.assign;
  var skip = links.skip;
  var trace = links.trace;
  var _b = links._b;
  var _c = links._c;
  var _d = links._d;
  var _f = links._f;
  var _g = links._g;
  var _h = links._h;
  var _q = links._q;
  var _r = links._r;
  var _s = links._s;
  var _u = links._u;
  var _v = links._v;
  var _w = links._w;
  var _13 = links._13;
  var _14 = links._14;
  var _16 = links._16;
  var _17 = links._17;
  var _1d = links._1d;
  var _1e = links._1e;
  var _1l = links._1l;
  var _1m = links._1m;
  var _1t = links._1t;
  var _1u = links._1u;
  var _1z = links._1z;
  var _20 = links._20;
  var _22 = links._22;
  var _28 = links._28;
  var _29 = links._29;
  var _2b = links._2b;
  var _2e = links._2e;
  var _0;
  var _1 = {};

  function r_expr() {
    var _2;
    var _3 = {};

    function _5() {
      var _4;

      if (options.trace) {
        _4 = trace("term", options, function () {
          return r_term();
        });
      } else {
        _4 = r_term();
      }

      return _4;
    }

    function _6() {
      var _4;

      var _8 = options.from;
      var _9;
      var _a = false;

      _9 = {};

      if (!skip(options)) _4 = null;
      else {
        options.to = options.from + _f.length;
        var _i = options.input.substring(options.from, options.to);
        if (options.ignoreCase ? _f === _i.toLowerCase() : _f === _i) _4 = _g;
        else {
          _4 = null;
          options.log && options._ffExpect(options.from, _h);
        }
      }

      if (_4 === null && !_a) {
        options.from = _8;

        _9 = {};

        if (!skip(options)) _4 = null;
        else {
          options.to = options.from + _b.length;
          var _e = options.input.substring(options.from, options.to);
          if (options.ignoreCase ? _b === _e.toLowerCase() : _b === _e) _4 = _c;
          else {
            _4 = null;
            options.log && options._ffExpect(options.from, _d);
          }
        }

        if (_4 === null && !_a) {
          options.from = _8;
        }
      }

      return _4;
    }

    if (options.trace) {
      _2 = trace("operation", options, function () {
        return r_operation(_5, _6);
      });
    } else {
      _2 = r_operation(_5, _6);
    }

    return _2;
  }

  function r_term() {
    var _2;
    var _3 = {};

    function _k() {
      var _j;

      if (options.trace) {
        _j = trace("fact", options, function () {
          return r_fact();
        });
      } else {
        _j = r_fact();
      }

      return _j;
    }

    function _l() {
      var _j;

      var _n = options.from;
      var _o;
      var _p = false;

      _o = {};

      if (!skip(options)) _j = null;
      else {
        options.to = options.from + _u.length;
        var _x = options.input.substring(options.from, options.to);
        if (options.ignoreCase ? _u === _x.toLowerCase() : _u === _x) _j = _v;
        else {
          _j = null;
          options.log && options._ffExpect(options.from, _w);
        }
      }

      if (_j === null && !_p) {
        options.from = _n;

        _o = {};

        if (!skip(options)) _j = null;
        else {
          options.to = options.from + _q.length;
          var _t = options.input.substring(options.from, options.to);
          if (options.ignoreCase ? _q === _t.toLowerCase() : _q === _t) _j = _r;
          else {
            _j = null;
            options.log && options._ffExpect(options.from, _s);
          }
        }

        if (_j === null && !_p) {
          options.from = _n;
        }
      }

      return _j;
    }

    if (options.trace) {
      _2 = trace("operation", options, function () {
        return r_operation(_k, _l);
      });
    } else {
      _2 = r_operation(_k, _l);
    }

    return _2;
  }

  function r_fact() {
    var _2;
    var _3 = {};

    var _y = options.from;
    var _z;
    var _10 = false;

    _z = {};

    if (options.trace) {
      _2 = trace("$number", options, function () {
        return r_$number();
      });
    } else {
      _2 = r_$number();
    }

    if (_2 === null && !_10) {
      options.from = _y;

      _z = {};

      if (!skip(options)) _2 = null;
      else {
        options.to = options.from + _13.length;
        var _15 = options.input.substring(options.from, options.to);
        if (options.ignoreCase ? _13 === _15.toLowerCase() : _13 === _15)
          _2 = nochild;
        else {
          _2 = null;
          options.log && options._ffExpect(options.from, _14);
        }
      }

      if (_2 !== null) {
        var _12 = options.from;
        var _11 = _2.concat();

        options.from = options.to;

        if (options.trace) {
          _2 = trace("expr", options, function () {
            return r_expr();
          });
        } else {
          _2 = r_expr();
        }

        if (_2 !== null) {
          _11.push.apply(_11, _2);

          options.from = options.to;

          if (!skip(options)) _2 = null;
          else {
            options.to = options.from + _16.length;
            var _18 = options.input.substring(options.from, options.to);
            if (options.ignoreCase ? _16 === _18.toLowerCase() : _16 === _18)
              _2 = nochild;
            else {
              _2 = null;
              options.log && options._ffExpect(options.from, _17);
            }
          }

          if (_2 !== null) {
            _11.push.apply(_11, _2);

            options.from = _12;
            _2 = _11;
          }
        }
      }

      if (_2 === null && !_10) {
        options.from = _y;
      }
    }

    return _2;
  }

  function r_$number() {
    var _2;
    var _3 = {};

    if (!skip(options)) _2 = null;
    else {
      var _1b = options.skip;
      options.skip = false;

      var _1c = options.log;
      options.log = false;

      var _1f = _1e(options, _3);

      var _1i = options.from;

      if (!skip(options)) _2 = null;
      else {
        options.to = options.from + _1l.length;
        var _1n = options.input.substring(options.from, options.to);
        if (options.ignoreCase ? _1l === _1n.toLowerCase() : _1l === _1n)
          _2 = nochild;
        else {
          _2 = null;
          options.log && options._ffExpect(options.from, _1m);
        }
      }

      if (_2 === null) {
        options.from = options.to = _1i;
        _2 = nochild;
      }

      if (_2 !== null) {
        var _1h = options.from;
        var _1g = _2.concat();

        options.from = options.to;

        var _25;
        function _2d() {
          if (!skip(options)) _2 = null;
          else {
            var _2a = options.ignoreCase ? _29 : _28;
            _2a.lastIndex = options.from;
            var _2c = _2a.exec(options.input);
            if (_2c !== null) {
              if (_2c.groups) assign(_3, _2c.groups);
              options.to = options.from + _2c[0].length;
              _2 = _2c.slice(1);
            } else {
              _2 = null;
              options.log && options._ffExpect(options.from, _2b);
            }
          }
        }
        _2d();
        if (_2 !== null) {
          _25 = options.from;
          var _26 = options.to;
          var _27 = _2.concat();

          while (true) {
            options.from = _26;
            _2d();
            if (_2 === null) break;
            _27.push.apply(_27, _2);
            _26 = options.to;
          }

          options.from = _25;
          options.to = _26;
          _2 = _27;
        }

        if (_2 !== null) {
          _1g.push.apply(_1g, _2);

          options.from = options.to;

          var _1o = options.from;

          if (!skip(options)) _2 = null;
          else {
            options.to = options.from + _1t.length;
            var _1v = options.input.substring(options.from, options.to);
            if (options.ignoreCase ? _1t === _1v.toLowerCase() : _1t === _1v)
              _2 = nochild;
            else {
              _2 = null;
              options.log && options._ffExpect(options.from, _1u);
            }
          }

          if (_2 !== null) {
            var _1s = options.from;
            var _1r = _2.concat();

            options.from = options.to;

            var _1w = options.from;
            function _24() {
              if (!skip(options)) _2 = null;
              else {
                var _21 = options.ignoreCase ? _20 : _1z;
                _21.lastIndex = options.from;
                var _23 = _21.exec(options.input);
                if (_23 !== null) {
                  if (_23.groups) assign(_3, _23.groups);
                  options.to = options.from + _23[0].length;
                  _2 = _23.slice(1);
                } else {
                  _2 = null;
                  options.log && options._ffExpect(options.from, _22);
                }
              }
            }
            _24();
            if (_2 !== null) {
              _1w = options.from;
              var _1x = options.to;
              var _1y = _2.concat();

              while (true) {
                options.from = _1x;
                _24();
                if (_2 === null) break;
                _1y.push.apply(_1y, _2);
                _1x = options.to;
              }

              options.from = _1w;
              options.to = _1x;
              _2 = _1y;
            } else {
              options.from = options.to = _1w;
              _2 = nochild;
            }

            if (_2 !== null) {
              _1r.push.apply(_1r, _2);

              options.from = _1s;
              _2 = _1r;
            }
          }

          if (_2 === null) {
            options.from = options.to = _1o;
            _2 = nochild;
          }

          if (_2 !== null) {
            _1g.push.apply(_1g, _2);

            options.from = _1h;
            _2 = _1g;
          }
        }
      }

      _2 = _1f(_2);

      options.log = _1c;
      if (_2 === null && _1c) options._ffExpect(options.from, _1d);

      options.skip = _1b;
    }

    return _2;
  }

  function r_operation(r_operand, r_operator) {
    var _2;
    var _3 = {};

    var _2f = _2e(options, _3);

    if (options.trace) {
      _2 = trace("operand", options, function () {
        return r_operand();
      });
    } else {
      _2 = r_operand();
    }

    if (_2 !== null) {
      var _2h = options.from;
      var _2g = _2.concat();

      options.from = options.to;

      var _2j = options.from;
      function _2q() {
        if (options.trace) {
          _2 = trace("operator", options, function () {
            return r_operator();
          });
        } else {
          _2 = r_operator();
        }

        if (_2 !== null) {
          var _2n = options.from;
          var _2m = _2.concat();

          options.from = options.to;

          if (options.trace) {
            _2 = trace("operand", options, function () {
              return r_operand();
            });
          } else {
            _2 = r_operand();
          }

          if (_2 !== null) {
            _2m.push.apply(_2m, _2);

            options.from = _2n;
            _2 = _2m;
          }
        }
      }
      _2q();
      if (_2 !== null) {
        _2j = options.from;
        var _2k = options.to;
        var _2l = _2.concat();

        while (true) {
          options.from = _2k;
          _2q();
          if (_2 === null) break;
          _2l.push.apply(_2l, _2);
          _2k = options.to;
        }

        options.from = _2j;
        options.to = _2k;
        _2 = _2l;
      } else {
        options.from = options.to = _2j;
        _2 = nochild;
      }

      if (_2 !== null) {
        _2g.push.apply(_2g, _2);

        options.from = _2h;
        _2 = _2g;
      }
    }

    _2 = _2f(_2);

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
