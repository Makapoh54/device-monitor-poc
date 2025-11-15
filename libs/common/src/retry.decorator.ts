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
      let attempt = 0;
      let lastError: unknown;

      // eslint-disable-next-line no-constant-condition
      while (true) {
        try {
          return await originalMethod.apply(this, args);
        } catch (error) {
          lastError = error;
          attempt += 1;

          if (attempt >= maxAttempts) {
            throw lastError;
          }

          const delay =
            Array.isArray(delaysMs) && delaysMs.length > 0
              ? delaysMs[Math.min(attempt - 1, delaysMs.length - 1)] ?? 0
              : (delaysMs as number);

          if (delay > 0) {
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }
    };

    return descriptor;
  };
}
