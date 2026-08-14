// Mock for next/headers used in tests.
export function cookies() {
  return {
    get: () => undefined,
    getAll: () => [],
    set: () => {},
    delete: () => {},
  };
}

export function headers() {
  return new Headers();
}
