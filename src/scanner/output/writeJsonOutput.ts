import fs from "fs/promises";
import path from "path";
import type { ScanJsonOutput } from "../types.js";

export async function writeJsonOutput(filePath: string, data: ScanJsonOutput): Promise<void> {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);

  const dir = path.dirname(absolutePath);
  await fs.mkdir(dir, { recursive: true });

  await fs.writeFile(absolutePath, JSON.stringify(data, null, 2), "utf-8");
}
