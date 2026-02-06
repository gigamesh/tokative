const DEBUG = false;

export const logger = {
  log: (...args: unknown[]) => { if (DEBUG) console.log(...args); },
  warn: (...args: unknown[]) => { if (DEBUG) console.warn(...args); },
  error: (...args: unknown[]) => { console.error(...args); },
};
