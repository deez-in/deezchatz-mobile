/**
 * Utility for retrying async functions with exponential backoff.
 */

import { RetryOptions } from "@/src/models/helpers";


export class BailoutError extends Error {
  constructor(public originalError: any) {
    super('Bailed out of retry loop');
    this.name = 'BailoutError';
  }
}

export async function withRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const { maxAttempts, initialDelay, backoffFactor = 1.5 } = options;
  let attempt = 1;

  while (true) {
    try {
      return await operation(attempt);
    } catch (error) {
      if (error instanceof BailoutError) {
        throw error.originalError;
      }
      if (attempt >= maxAttempts) {
        throw error;
      }
      const delay = initialDelay * Math.pow(backoffFactor, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
      attempt++;
    }
  }
}
