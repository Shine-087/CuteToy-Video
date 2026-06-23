export interface RetryOptions {
  attempts: number;
  delayMs?: number;
  onRetry?: (error: unknown, attempt: number) => void;
}

export async function retry<T>(operation: () => Promise<T>, options: RetryOptions): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === options.attempts) {
        break;
      }

      options.onRetry?.(error, attempt);

      if (options.delayMs && options.delayMs > 0) {
        await wait(options.delayMs);
      }
    }
  }

  throw lastError;
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
