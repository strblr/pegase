import * as pegase from ".";

if (typeof window !== "undefined") {
  const w = window as any;
  w.peg = pegase.peg;
  w._ = pegase;
}
