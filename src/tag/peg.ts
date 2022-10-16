import {
  createMetaparser,
  defaultExtension,
  Extension,
  log,
  MetaContext,
  Parser,
  pegSkipper
} from "../index.js";

export interface TagOptions {
  metaparser: Parser<MetaContext>;
  trace: boolean;
  extensions: Extension[];
}

export interface Tag {
  <Context>(
    chunks: TemplateStringsArray | string,
    ...args: Any[]
  ): Parser<Context>;
  trace: Tag;
  extend(extensions: Extension | Extension[]): Tag;
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
  const opts: TagOptions = {
    metaparser: options?.metaparser ?? createMetaparser(),
    trace: options?.trace ?? false,
    extensions: options?.extensions ?? [defaultExtension]
  };

  function peg<Context = any>(
    chunks: TemplateStringsArray | string,
    ...args: Any[]
  ): Parser<Context> {
    const result = opts.metaparser.parse(
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

  const trace = (): Tag["trace"] => createTag({ ...opts, trace: true });

  const extend: Tag["extend"] = extensions =>
    createTag({
      ...opts,
      extensions: [
        ...opts.extensions,
        ...(Array.isArray(extensions) ? extensions : [extensions])
      ]
    });

  Object.defineProperties(peg, {
    trace: { get: trace },
    extend: { value: extend }
  });

  return peg as Tag;
}
