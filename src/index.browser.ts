import * as pegase from ".";

if (typeof window !== "undefined") {
  const w = window as any;
  w.peg = pegase.peg;
  w.$from = pegase.$from;
  w.$to = pegase.$to;
  w.$children = pegase.$children;
  w.$value = pegase.$value;
  w.$raw = pegase.$raw;
  w.$options = pegase.$options;
  w.$context = pegase.$context;
  w.$warn = pegase.$warn;
  w.$fail = pegase.$fail;
  w.$expected = pegase.$expected;
  w.$commit = pegase.$commit;
  w.$emit = pegase.$emit;
  w.$node = pegase.$node;
  w.$visit = pegase.$visit;
  w.$parent = pegase.$parent;
}
