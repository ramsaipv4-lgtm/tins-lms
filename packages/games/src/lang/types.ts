// Public types of the Snek interpreter (SPEC §13.4) and the internal error classes.

export type SnekErrorKind =
  | 'SyntaxError' | 'IndentationError' | 'NameError' | 'TypeError' | 'ValueError' | 'IndexError'
  | 'KeyError' | 'ZeroDivisionError' | 'AttributeError' | 'OverflowError' | 'EOFError' | 'RuntimeError'
  | 'AssertionError' | 'Exception'
  | 'TooManySteps' | 'TooDeep' | 'TooBig' | 'NotAllowed';

export interface SnekError { kind: SnekErrorKind; line: number; col: number; message: string }

export interface Program { readonly snek: 'program' }

export type Compiled = { ok: true; program: Program } | { ok: false; error: SnekError };

export interface RunOpts {
  input?: string[];
  globals?: Record<string, unknown | ((...args: unknown[]) => unknown)>;
  maxOps?: number;
  maxDepth?: number;
  maxCells?: number;
}

export type RunResult =
  | { ok: true; value: unknown; stdout: string; ops: number; peakCells: number }
  | { ok: false; error: SnekError; stdout: string; ops: number; peakCells: number };

export type StepEvent =
  | { kind: 'line'; line: number; vars: Record<string, unknown> }
  | { kind: 'call'; line: number; name: string; args: unknown[] };

// Thrown by the lexer, parser and resolver.
export class CompileError {
  kind: SnekErrorKind;
  line: number;
  col: number;
  message: string;
  constructor(kind: SnekErrorKind, line: number, col: number, message: string) {
    this.kind = kind;
    this.line = line;
    this.col = col;
    this.message = message;
  }
}

// ---- AST ----
export interface Node {
  k: string;
  line: number;
  col: number;
  [key: string]: any;
}
