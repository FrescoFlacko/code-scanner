import fs from "fs";
import { UserError } from "../errors.js";

export function validateTargetPath(targetPath: string): void {
  if (!fs.existsSync(targetPath)) {
    throw new UserError(`Path does not exist: ${targetPath}`);
  }

  const stats = fs.statSync(targetPath);
  if (!stats.isDirectory()) {
    throw new UserError(`Path is not a directory: ${targetPath}`);
  }
}
