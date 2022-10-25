export * from "./utility/index.js";
export * from "./parser/index.js";
export * from "./tag/index.js";

import { createTag } from "./tag";

export const peg = createTag();
export default peg;
