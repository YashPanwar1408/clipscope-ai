// Registers the @/ alias resolver for test runs.
import { register } from "node:module";

register("./resolve-alias.mjs", import.meta.url);
