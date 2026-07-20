#!/usr/bin/env node

import console from "node:console";
import process from "node:process";
import { scan } from "../dist/src/scanner/index.js";
import { UserError, ScannerError } from "../dist/src/scanner/errors.js";

scan({ fromCli: true })
  .then((result) => {
    if ((result.totals?.scannerErrors ?? 0) > 0) process.exitCode = 1;
  })
  .catch((err) => {
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
