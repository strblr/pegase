export function throwError(message: string): never {
  throw new Error(`QuickParser Error: ${message}`);
}
