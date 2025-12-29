import { ESLint, Linter } from "eslint";
import tsParser from "@typescript-eslint/parser";
import {
  buildEslintRules,
  sonarjsPlugin,
  securityPlugin,
} from "../../../scanner.config.js";

export function createEslintInstance(targetPath: string): ESLint {
  return new ESLint({
    cwd: targetPath,
    overrideConfig: {
      files: ["**/*.js", "**/*.ts", "**/*.jsx", "**/*.tsx"],
      languageOptions: {
        parser: tsParser,
        sourceType: "module",
        parserOptions: {
          ecmaVersion: "latest",
        },
      },
      plugins: {
        sonarjs: sonarjsPlugin,
        security: securityPlugin,
      },
      rules: buildEslintRules() as Linter.RulesRecord,
    },
    overrideConfigFile: true,
  });
}
