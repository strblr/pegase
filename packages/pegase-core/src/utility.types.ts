export interface Range {
  from: Location;
  to: Location;
}

export interface Location {
  input: string;
  index: number;
  line: number;
  column: number;
}
