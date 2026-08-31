export interface RetryOptions {
    maxAttempts: number;
    initialDelay: number;
    backoffFactor?: number;
}
