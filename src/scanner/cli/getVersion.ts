import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

let cachedVersion: string | null = null;

export function getVersion(): string {
  if (cachedVersion) {
    return cachedVersion;
  }

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const packagePath = path.resolve(__dirname, "../../../../package.json");

  try {
    const pkg = JSON.parse(readFileSync(packagePath, "utf-8")) as { version?: string };
    cachedVersion = pkg.version || "unknown";
    return cachedVersion;
  } catch {
    return "unknown";
  }
}
