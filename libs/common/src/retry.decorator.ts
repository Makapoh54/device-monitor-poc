import { setTimeout as sleep } from 'node:timers/promises';

function resolveDelay(delaysMs: number | number[], attempt: number): number {
  if (Array.isArray(delaysMs) && delaysMs.length > 0) {
    const index = Math.min(attempt - 1, delaysMs.length - 1);
    return delaysMs[index] ?? 0;
  }

  return delaysMs as number;
}

export function Retry(
  maxAttempts = 3,
  delaysMs: number | number[] = 0,
): MethodDecorator {
  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<any>,
  ): TypedPropertyDescriptor<any> | void => {
    const originalMethod = descriptor.value;

    if (!originalMethod || typeof originalMethod !== 'function') {
      return descriptor;
    }

    descriptor.value = async function (...args: any[]) {
      let lastError: unknown;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          return await originalMethod.apply(this, args);
        } catch (error) {
          lastError = error;

          if (attempt === maxAttempts) {
            throw lastError;
          }

          const delay = resolveDelay(delaysMs, attempt);

          if (delay > 0) {
            await sleep(delay);
          }
        }
      }

      throw lastError;
    };

    return descriptor;
  };
}
