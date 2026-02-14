import { captureException, captureMessage } from "./sentry";

const DEBUG = false;

export const logger = {
  log: (...args: unknown[]) => { if (DEBUG) console.log(...args); },
  warn: (...args: unknown[]) => { if (DEBUG) console.warn(...args); },
  error: (...args: unknown[]) => {
    console.error(...args);
    const err = args.find((a) => a instanceof Error);
    if (err) captureException(err);
    else captureMessage(args.map(String).join(" "));
  },
};
