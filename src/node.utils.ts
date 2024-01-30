import { Node } from ".";

// Reduce visitor

export interface ReduceVisitor<T> {
  [label: string]: (data: any, node: Node) => T;
}

export interface ReduceOptions {
  silent: boolean;
  context: any;
}

// Transform visitor

export interface TransformVisitor {
  keys?: {
    [label: string]: string | string[] | ((node: Node) => string | string[]);
  };
  transform: {
    [label: string]:
      | ((data: any, node: Node) => Node | void)
      | {
          enter?: (data: any, node: Node) => Node | void;
          exit?: (data: any, node: Node) => Node | void;
        };
  };
}

export interface TransformPath {
  path: string[];
  inArray: boolean;
  index: number;
  replace(node: Node): void;
  remove(): void;
  skip(): void;
  stop(): void;
  parent(): Node | undefined;
  sibling: {
    all: Node[];
    prev: Node | undefined;
    next: Node | undefined;
    at(index: number): Node;
    push(node: Node, index?: number): void;
    pop(index?: number): Node | undefined;
  };
}

export interface TransformOptions {
  silent: boolean;
  context: any;
}

const $value = (...args: any[]) => 5;

let visitor: any = {
  keys: {},
  visit: {
    OP: (data: any) => {
      // using an internal Map<Node, any[]> cache
      // How to pass context data DOWN ?
      return () => $value(data.left) + $value(data.right);
    },
    NUM: () => (data: any) => data.value
  }
};
