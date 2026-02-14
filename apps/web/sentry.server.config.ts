import * as Sentry from "@sentry/nextjs";
import { TokativeError } from "@tokative/shared";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  beforeSend(event, hint) {
    const error = hint?.originalException;
    if (error instanceof TokativeError) {
      event.tags = { ...event.tags, error_code: error.code };
      event.contexts = { ...event.contexts, tokative: error.context };
    }
    return event;
  },
});
