/** A minimal output sink so commands are pure and testable (no direct console). */
export interface IO {
  out(line: string): void;
  err(line: string): void;
}

export const consoleIO: IO = {
  out(line: string): void {
    process.stdout.write(`${line}\n`);
  },
  err(line: string): void {
    process.stderr.write(`${line}\n`);
  },
};

/** Collects output in memory — used by tests. */
export function createBufferIO(): IO & { readonly stdout: string[]; readonly stderr: string[] } {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    out: (line: string) => stdout.push(line),
    err: (line: string) => stderr.push(line),
  };
}
