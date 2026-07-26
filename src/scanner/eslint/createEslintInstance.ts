import angularPlugin from "@angular-eslint/eslint-plugin";
import angularTemplatePlugin from "@angular-eslint/eslint-plugin-template";
import angularTemplateParser from "@angular-eslint/template-parser";
import tsParser from "@typescript-eslint/parser";
import { ESLint, type Linter } from "eslint";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import environmentGlobals from "globals";
import typescriptEslint from "typescript-eslint";
import {
  buildAngularTemplateRules,
  isTypeAwareTypescriptRule,
  resolveRuleConfiguration,
  securityPlugin,
  sonarjsPlugin,
  UNTYPED_TYPESCRIPT_RULES,
  type ResolvedRuleConfiguration,
} from "../../../scanner.config.js";
import { SUPPORTED_EXTENSIONS } from "../constants.js";
import type { ProfileName } from "../types.js";
import { angularSecurityPlugin } from "./angularSecurityPlugin.js";
import { lambdaPlugin } from "./lambdaPlugin.js";

interface FilePatterns {
  javascript: string;
  typescript: string;
  generated: string[];
  generatedHtml: string[];
  specifications: string[];
  configurations: string[];
}

interface EslintContext {
  targetPath: string;
  overrides: Record<string, unknown>;
  resolved: ResolvedRuleConfiguration;
  angularEnabled: boolean;
  lambdaEnabled: boolean;
  reactEnabled: boolean;
  typedProfileEnabled: boolean;
  javascriptRules: Record<string, unknown>;
  untypedRules: Record<string, unknown>;
  globals: Linter.Globals;
  patterns: FilePatterns;
}

/** Formats a list of file extensions as an ESLint brace glob. */
function extensionGlob(extensions: readonly string[]): string {
  return `{${extensions.map((extension) => extension.slice(1)).join(",")}}`;
}

/** Builds the source, generated, test, and configuration file patterns. */
function createFilePatterns(): FilePatterns {
  const typescriptExtensions = SUPPORTED_EXTENSIONS.filter(
    (extension) => extension.endsWith("ts") || extension.endsWith("tsx"),
  );
  const javascriptExtensions = SUPPORTED_EXTENSIONS.filter(
    (extension) => !typescriptExtensions.includes(extension),
  );
  const allExtensions = extensionGlob(SUPPORTED_EXTENSIONS);
  return {
    javascript: `**/*.${extensionGlob(javascriptExtensions)}`,
    typescript: `**/*.${extensionGlob(typescriptExtensions)}`,
    generated: [
      `**/generated/**/*.${allExtensions}`,
      `**/*.generated.${allExtensions}`,
      `**/generated-api/**/*.${allExtensions}`,
    ],
    generatedHtml: ["**/generated/**/*.html", "**/*.generated.html", "**/generated-api/**/*.html"],
    specifications: [
      `**/*.spec.${allExtensions}`,
      `**/*.test.${allExtensions}`,
      `**/__tests__/**/*.${allExtensions}`,
    ],
    configurations: [`**/*.config.${allExtensions}`],
  };
}

/** Composes the portable TypeScript baseline with profile-specific rules. */
function composeTypescriptRules(baseRules: Record<string, unknown>): Linter.RulesRecord {
  return {
    ...baseRules,
    ...UNTYPED_TYPESCRIPT_RULES,
    ...Object.fromEntries(
      Object.entries(baseRules).filter(([ruleId]) => ruleId.startsWith("@typescript-eslint/")),
    ),
  } as Linter.RulesRecord;
}

/** Removes plugin overrides that cannot run in an untyped test scope. */
function getUntypedOverrides(overrides: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(overrides).filter(
      ([ruleId]) =>
        !ruleId.startsWith("@angular-eslint/") &&
        !ruleId.startsWith("code-scanner-angular-security/") &&
        !ruleId.startsWith("code-scanner-lambda/") &&
        !isTypeAwareTypescriptRule(ruleId),
    ),
  );
}

/** Selects rules that can execute against JavaScript files. */
function getJavascriptRules(rules: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(rules).filter(
      ([ruleId]) =>
        !ruleId.startsWith("@typescript-eslint/") &&
        !ruleId.startsWith("@angular-eslint/") &&
        !ruleId.startsWith("code-scanner-angular-security/"),
    ),
  );
}

/** Builds environment globals selected by scanner profiles. */
function createGlobals(
  resolved: ResolvedRuleConfiguration,
  reactEnabled: boolean,
  angularEnabled: boolean,
): Linter.Globals {
  return {
    ...(resolved.profiles.includes("node") ? environmentGlobals.node : {}),
    ...(resolved.profiles.includes("browser") || reactEnabled || angularEnabled
      ? environmentGlobals.browser
      : {}),
  };
}

/** Resolves shared state used by every flat ESLint configuration block. */
function createContext(
  targetPath: string,
  profiles: ProfileName[],
  overrides: Record<string, unknown>,
): EslintContext {
  const resolved = resolveRuleConfiguration(profiles, overrides);
  const angularEnabled = resolved.profiles.includes("angular");
  const lambdaEnabled = resolved.profiles.includes("lambda");
  const reactEnabled = resolved.profiles.includes("react");
  const typedProfileEnabled =
    angularEnabled || lambdaEnabled || resolved.profiles.includes("typed");
  const untypedProfiles = resolved.profiles.filter(
    (profile) => !["angular", "lambda", "typed"].includes(profile),
  );
  const untypedRules = resolveRuleConfiguration(
    untypedProfiles,
    getUntypedOverrides(overrides),
  ).rules;
  return {
    targetPath,
    overrides,
    resolved,
    angularEnabled,
    lambdaEnabled,
    reactEnabled,
    typedProfileEnabled,
    javascriptRules: getJavascriptRules(resolved.rules),
    untypedRules,
    globals: createGlobals(resolved, reactEnabled, angularEnabled),
    patterns: createFilePatterns(),
  };
}

/** Returns plugins shared by JavaScript configuration blocks. */
function createJavascriptPlugins(context: EslintContext): Linter.Config["plugins"] {
  return {
    sonarjs: sonarjsPlugin,
    security: securityPlugin,
    ...(context.lambdaEnabled ? { "code-scanner-lambda": lambdaPlugin } : {}),
    ...(context.reactEnabled
      ? {
          "react-hooks": reactHooksPlugin as unknown as ESLint.Plugin,
        }
      : {}),
  };
}

/** Returns plugins shared by TypeScript configuration blocks. */
function createTypescriptPlugins(
  context: EslintContext,
  includeApplicationPlugins: boolean,
): Linter.Config["plugins"] {
  return {
    sonarjs: sonarjsPlugin,
    security: securityPlugin,
    "@typescript-eslint": typescriptEslint.plugin as unknown as ESLint.Plugin,
    ...(includeApplicationPlugins && context.angularEnabled
      ? {
          "@angular-eslint": angularPlugin as unknown as ESLint.Plugin,
          "code-scanner-angular-security": angularSecurityPlugin,
        }
      : {}),
    ...(includeApplicationPlugins && context.lambdaEnabled
      ? { "code-scanner-lambda": lambdaPlugin }
      : {}),
    ...(context.reactEnabled
      ? {
          "react-hooks": reactHooksPlugin as unknown as ESLint.Plugin,
        }
      : {}),
  };
}

/** Builds the JavaScript linting block. */
function createJavascriptConfig(context: EslintContext): Linter.Config {
  return {
    files: [context.patterns.javascript],
    ignores: context.patterns.generated,
    languageOptions: {
      parser: tsParser,
      sourceType: "module",
      parserOptions: { ecmaVersion: "latest", ecmaFeatures: { jsx: true } },
      globals: context.globals,
    },
    plugins: createJavascriptPlugins(context),
    rules: context.javascriptRules as Linter.RulesRecord,
  };
}

/** Builds the application TypeScript linting block. */
function createTypescriptConfig(context: EslintContext): Linter.Config {
  return {
    files: [context.patterns.typescript],
    ignores: [
      ...context.patterns.specifications,
      ...context.patterns.configurations,
      ...context.patterns.generated,
    ],
    languageOptions: {
      parser: tsParser,
      sourceType: "module",
      parserOptions: {
        ecmaVersion: "latest",
        ecmaFeatures: { jsx: true },
        ...(context.typedProfileEnabled
          ? { projectService: true, tsconfigRootDir: context.targetPath }
          : {}),
      },
      globals: context.globals,
    },
    plugins: createTypescriptPlugins(context, true),
    ...(context.angularEnabled
      ? {
          processor: angularTemplatePlugin.processors[
            "extract-inline-html"
          ] as unknown as Linter.Processor,
        }
      : {}),
    rules: composeTypescriptRules(context.resolved.rules),
  };
}

/** Builds the untyped test and tool configuration block. */
function createTestConfig(context: EslintContext): Linter.Config {
  return {
    files: [...context.patterns.specifications, ...context.patterns.configurations],
    languageOptions: {
      parser: tsParser,
      sourceType: "module",
      parserOptions: { ecmaVersion: "latest", ecmaFeatures: { jsx: true } },
      globals: context.globals,
    },
    plugins: createTypescriptPlugins(context, false),
    rules: composeTypescriptRules(context.untypedRules),
  };
}

/** Builds the rule-disabled generated-source block. */
function createGeneratedConfig(context: EslintContext): Linter.Config {
  const allKnownRules = {
    ...context.resolved.rules,
    ...UNTYPED_TYPESCRIPT_RULES,
  };
  return {
    files: context.patterns.generated,
    languageOptions: { parser: tsParser, sourceType: "module" },
    plugins: createTypescriptPlugins(context, true),
    rules: Object.fromEntries(Object.keys(allKnownRules).map((ruleId) => [ruleId, "off"])),
  };
}

/** Builds Angular template blocks for source and generated HTML. */
function createAngularTemplateConfigs(context: EslintContext): Linter.Config[] {
  const rules = buildAngularTemplateRules(context.resolved.profiles, context.overrides);
  const plugins = {
    "@angular-eslint/template": angularTemplatePlugin as unknown as ESLint.Plugin,
  };
  return [
    {
      files: ["**/*.html"],
      ignores: context.patterns.generatedHtml,
      languageOptions: { parser: angularTemplateParser },
      plugins,
      rules: rules as Linter.RulesRecord,
    },
    {
      files: context.patterns.generatedHtml,
      languageOptions: { parser: angularTemplateParser },
      plugins,
      rules: Object.fromEntries(Object.keys(rules).map((ruleId) => [ruleId, "off"])),
    },
  ];
}

/** Creates an ESLint instance configured for selected scanner profiles. */
export function createEslintInstance(
  targetPath: string,
  profiles: ProfileName[] = [],
  overrides: Record<string, unknown> = {},
): ESLint {
  const context = createContext(targetPath, profiles, overrides);
  const configs: Linter.Config[] = [
    createJavascriptConfig(context),
    createTypescriptConfig(context),
    createTestConfig(context),
    createGeneratedConfig(context),
    {
      files: ["**/*.cjs", "**/*.cts"],
      languageOptions: { sourceType: "commonjs" },
    },
  ];
  if (context.angularEnabled) {
    configs.push(...createAngularTemplateConfigs(context));
  }
  return new ESLint({
    cwd: targetPath,
    overrideConfig: configs,
    overrideConfigFile: true,
  });
}
