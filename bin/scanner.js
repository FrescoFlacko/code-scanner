#!/usr/bin/env node

import { scan } from "../dist/src/scanner/index.js";
import { UserError, ScannerError } from "../dist/src/scanner/errors.js";

scan({ fromCli: true }).catch((err) => {
  if (err instanceof UserError) {
    console.error(`❌ ${err.message}`);
    process.exit(2);
  }
  if (err instanceof ScannerError) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }
  console.error(`❌ Unexpected error: ${err.message || err}`);
  process.exit(1);
});
