import {
  hookStack,
  isImplicitTransformVisitor,
  Range,
  ReduceOptions,
  ReduceVisitor,
  TransformOptions,
  TransformVisitor
} from ".";

export class Node {
  label: string;
  data: any;
  range: Range;

  constructor(label: string, data: any, range: Range) {
    this.label = label;
    this.data = data;
    this.range = range;
  }

  new(label: string, data: any) {
    return new Node(label, data, this.range);
  }

  reduce<T>(visitor: ReduceVisitor<T>, options?: Partial<ReduceOptions>) {
    const callback = visitor[this.label] ?? visitor.$default;
    if (!callback) {
      throw new Error(`No visitor entry for ${this.label}`);
    }
    const { range } = this;
    hookStack.push({
      $range: () => range,
      $raw: () => range.from.input.slice(range.from.index, range.to.index),
      $options: () => options,
      $context: () => options?.context,
      $node: (label, data) => new Node(label, data, range),
      $reduce: (node: Node, opts?: Partial<ReduceOptions>) =>
        node.reduce(visitor, opts ? { ...options, ...opts } : options)
    });
    try {
      return callback(this.data, this);
    } finally {
      hookStack.pop();
    }
  }

  transform(visitor: TransformVisitor, options?: Partial<TransformOptions>) {
    if (isImplicitTransformVisitor(visitor)) {
      visitor = {
        $path: {
          $default: node => []
        },
        $transform: visitor
      };
    }
    return this;
  }
}
