export function throwError(message: string): never {
  throw new Error(`Pegase Error: ${message}`);
}
