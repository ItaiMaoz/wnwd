// Retry utility with exponential backoff and jitter

export interface RetryOptions {
  maxRetries: number;
  baseDelay: number;      // milliseconds
  maxDelay: number;       // milliseconds
  jitterFactor: number;   // 0-1 (e.g., 0.1 = 10% jitter)
}

export class RetryExhaustedError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly lastError: Error
  ) {
    super(message);
    this.name = 'RetryExhaustedError';
  }
}

function calculateDelay(attempt: number, options: RetryOptions): number {
  const exponentialDelay = options.baseDelay * Math.pow(2, attempt);
  const cappedDelay = Math.min(exponentialDelay, options.maxDelay);

  // Add jitter: randomize ±jitterFactor
  const jitterRange = cappedDelay * options.jitterFactor;
  const jitter = (Math.random() - 0.5) * 2 * jitterRange;

  return Math.max(0, cappedDelay + jitter);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions,
  isRetryable: (error: Error) => boolean
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry non-retryable errors
      if (!isRetryable(lastError)) {
        throw lastError;
      }

      // Don't delay after last attempt
      if (attempt < options.maxRetries) {
        const delay = calculateDelay(attempt, options);
        await sleep(delay);
      }
    }
  }

  throw new RetryExhaustedError(
    `Operation failed after ${options.maxRetries + 1} attempts`,
    options.maxRetries + 1,
    lastError!
  );
}

// Common retry predicates
export function isNetworkError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes('timeout') ||
    message.includes('econnrefused') ||
    message.includes('enotfound') ||
    message.includes('network')
  );
}

export function isHttpRetryable(statusCode?: number): boolean {
  if (!statusCode) return false;
  return (
    statusCode === 429 ||  // Too Many Requests
    statusCode >= 500      // Server errors
  );
}
