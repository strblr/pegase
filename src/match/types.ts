export type SemanticMatchReport<TContext> = any[] &
  Readonly<{
    input: string;
    from: number;
    to: number;
    raw: string;
    stack: string[];
    children: any[];
    context: TContext;
    warn(message: string): void;
    saveErrors(): void;
  }>;

export type SemanticAction<TContext> = (
  arg: SemanticMatchReport<TContext>,
  arg_: SemanticMatchReport<TContext>
) => any;
