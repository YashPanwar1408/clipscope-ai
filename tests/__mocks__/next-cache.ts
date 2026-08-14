// Mock for next/cache used in tests.
export function revalidatePath() {}
export function revalidateTag() {}
export function unstable_cache(fn: (...args: unknown[]) => unknown) {
  return fn;
}
