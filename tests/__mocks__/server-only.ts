// Mock for the `server-only` package used in tests.
// In production this package throws if imported on the client.
// For tests we treat it as a no-op so server-only modules can be imported.
export {};
