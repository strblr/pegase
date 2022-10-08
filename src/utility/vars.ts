/**
 * Creates an identifier factory and symbol table (used to compile parsers)
 */

export class IdGenerator {
  private counter = 0;
  private table = new Map<{}, string>();
  private create = () => `_${(this.counter++).toString(36)}`;

  generate<T extends {}>(value?: T) {
    if (value === undefined) {
      return this.create();
    }
    let memo = this.table.get(value);
    if (memo === undefined) {
      this.table.set(value, (memo = this.create()));
    }
    return memo;
  }

  entries() {
    return [...this.table.entries()].map(
      ([value, key]) => [key, value] as const
    );
  }
}
