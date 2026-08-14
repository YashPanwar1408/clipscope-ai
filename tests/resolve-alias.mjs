// Resolves the @/ path alias to the project root and appends .ts
// for extensionless specifiers so `node --experimental-strip-types`
// can import source modules in tests.
// Also mocks `server-only` and Next.js server-only modules so that
// server modules can be imported in unit tests.
import { pathToFileURL } from "node:url";

const projectRoot = pathToFileURL(process.cwd() + "/").href;
const mocksDir = new URL("./__mocks__/", import.meta.url).href;

const MOCKED_MODULES = new Map([
  ["server-only", "server-only.ts"],
  ["next/headers", "next-headers.ts"],
  ["next/cache", "next-cache.ts"],
]);

export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    let mapped = projectRoot + specifier.slice(2);
    // Append .ts for extensionless specifiers so Node can load them.
    if (!/\.[a-zA-Z0-9]+$/.test(mapped) && !mapped.endsWith("/")) {
      mapped = mapped + ".ts";
    }
    return nextResolve(mapped, context);
  }
  const mockFile = MOCKED_MODULES.get(specifier);
  if (mockFile) {
    return nextResolve(mocksDir + mockFile, context);
  }
  return nextResolve(specifier, context);
}
