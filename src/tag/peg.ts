import {
  createMetaparser,
  defaultExtension,
  Extension,
  log,
  Parser,
  pegSkipper
} from "../index.js";

export interface TagOptions {
  trace: boolean;
  extensions: Extension[];
}

export type Any =
  | null
  | undefined
  | string
  | number
  | boolean
  | symbol
  | bigint
  | object
  | ((...args: any[]) => any); // no "implicit any" error

// createTag

export function createTag(options?: Partial<TagOptions>) {
  const metaparser = createMetaparser();
  const opts: TagOptions = {
    trace: false,
    extensions: [defaultExtension],
    ...options
  };

  function peg<Context = any>(
    chunks: TemplateStringsArray | string,
    ...args: Any[]
  ): Parser<Context> {
    const result = metaparser.parse(
      typeof chunks === "string"
        ? chunks
        : chunks.raw.reduce(
            (acc, chunk, index) => acc + `~${index - 1}` + chunk
          ),
      {
        skipper: pegSkipper,
        trace: opts.trace,
        context: { extensions: opts.extensions, args }
      }
    );
    if (!result.success) {
      throw new Error(log(result));
    }
    return result.children[0].compile();
  }

  return peg;
}
