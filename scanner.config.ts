import sonarjsPlugin from "eslint-plugin-sonarjs";
import securityPlugin from "eslint-plugin-security";
import angularPlugin from "@angular-eslint/eslint-plugin";
import angularTemplatePlugin from "@angular-eslint/eslint-plugin-template";
import typescriptEslint from "typescript-eslint";
import js from "@eslint/js";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import type { ProfileName, RuleCategories, Thresholds, Legend } from "./src/scanner/types.js";
import { angularSecurityPlugin } from "./src/scanner/eslint/angularSecurityPlugin.js";
import { lambdaPlugin } from "./src/scanner/eslint/lambdaPlugin.js";
import { ConfigError } from "./src/scanner/errors.js";

interface TypescriptRule {
  meta?: { docs?: { requiresTypeChecking?: boolean } };
}

const TYPESCRIPT_RULES = (
  typescriptEslint.plugin as unknown as {
    rules: Record<string, TypescriptRule>;
  }
).rules;
const REACT_HOOK_RULES = reactHooksPlugin.rules as Record<string, unknown>;
const CORE_RULES = js.configs.all.rules;

function asWarning(configuration: unknown): unknown {
  if (Array.isArray(configuration)) return ["warn", ...configuration.slice(1)];
  return configuration === "off" || configuration === 0 ? "off" : "warn";
}

export const UNTYPED_TYPESCRIPT_RULES: Record<string, unknown> = Object.fromEntries(
  Object.entries(
    Object.assign({}, ...typescriptEslint.configs.recommended.map((config) => config.rules ?? {})),
  ).map(([ruleId, configuration]) => [ruleId, asWarning(configuration)]),
);
// Explicit `any` is often a deliberate migration or integration boundary. It is
// too subjective and high-volume for the portable baseline; strict teams can
// enable it through a rule override.
UNTYPED_TYPESCRIPT_RULES["@typescript-eslint/no-explicit-any"] = "off";

const CORE_RECOMMENDED_RULES: Record<string, unknown> = Object.fromEntries(
  Object.entries(js.configs.recommended.rules).map(([ruleId, configuration]) => [
    ruleId,
    asWarning(configuration),
  ]),
);

export const REACT_RULES: Record<string, unknown> = Object.fromEntries(
  Object.entries(reactHooksPlugin.configs.flat.recommended.rules).map(([ruleId, configuration]) => [
    ruleId,
    asWarning(configuration),
  ]),
);

/**
 * SonarJS does not expose its SonarQube vulnerability/security-hotspot type in
 * ESLint rule metadata. Keep the mapping explicit so a wording change in a
 * rule description cannot silently change report categories.
 */
const SONAR_SECURITY_RULE_NAMES = new Set([
  "aws-apigateway-public-api",
  "aws-ec2-unencrypted-ebs-volume",
  "aws-ec2-rds-dms-public",
  "aws-efs-unencrypted",
  "aws-iam-public-access",
  "aws-iam-privilege-escalation",
  "aws-opensearchservice-domain",
  "aws-rds-unencrypted-databases",
  "aws-s3-bucket-insecure-http",
  "aws-s3-bucket-public-access",
  "aws-sagemaker-unencrypted-notebook",
  "aws-sns-unencrypted-topics",
  "aws-sqs-unencrypted-queue",
  "content-security-policy",
  "cookie-no-httponly",
  "cors",
  "csrf",
  "dompurify-unsafe-config",
  "dynamically-constructed-templates",
  "encryption-secure-mode",
  "file-permissions",
  "frame-ancestors",
  "hardcoded-secret-signatures",
  "hashing",
  "insecure-cookie",
  "insecure-jwt-token",
  "no-angular-bypass-sanitization",
  "no-clear-text-protocols",
  "no-hardcoded-passwords",
  "no-hardcoded-secrets",
  "no-intrusive-permissions",
  "no-mixed-content",
  "no-os-command-from-path",
  "no-referrer-policy",
  "no-session-cookies-on-static-assets",
  "no-weak-cipher",
  "no-weak-keys",
  "os-command",
  "post-message",
  "pseudo-random",
  "publicly-writable-directories",
  "session-regeneration",
  "sql-queries",
  "strict-transport-security",
  "web-sql-database",
  "xml-parser-xxe",
]);

const CLEANLINESS_RULE_NAMES = [
  "no-commented-code",
  "fixme-tag",
  "todo-tag",
  "no-unused-vars",
  "unused-import",
  "no-unused-function-argument",
  "no-dead-store",
  "no-redundant-parentheses",
  "no-useless-catch",
  "no-empty-collection",
  "no-unused-collection",
  "no-gratuitous-expressions",
  "no-ignored-return",
  "no-ignored-exceptions",
  "no-sonar-comments",
];

const METRIC_RULES = new Set([
  "complexity",
  "sonarjs/cognitive-complexity",
  "sonarjs/nested-control-flow",
  "sonarjs/expression-complexity",
]);

const GENERIC_SONAR_RULES = [
  "no-all-duplicated-branches",
  "no-collapsible-if",
  "no-dead-store",
  "no-duplicated-branches",
  "no-element-overwrite",
  "no-empty-collection",
  "no-gratuitous-expressions",
  "no-identical-conditions",
  "no-identical-expressions",
  "no-identical-functions",
  "no-ignored-exceptions",
  "no-ignored-return",
  "no-inverted-boolean-check",
  "no-nested-conditional",
  "no-nested-switch",
  "no-redundant-boolean",
  "no-redundant-jump",
  "no-small-switch",
  "no-unused-collection",
  "no-use-of-empty-return-value",
  "no-useless-catch",
  "prefer-immediate-return",
  "prefer-single-boolean-return",
] as const;

const STRICT_SONAR_RULES = [
  "arrow-function-convention",
  "function-name",
  "max-lines",
  "no-commented-code",
  "no-duplicate-string",
  "no-nested-functions",
  "no-wildcard-import",
] as const;

const PORTABLE_SECURITY_RULES = [
  "detect-child-process",
  "detect-disable-mustache-escape",
  "detect-eval-with-expression",
  "detect-new-buffer",
  "detect-no-csrf-before-method-override",
  "detect-pseudoRandomBytes",
  "detect-possible-timing-attacks",
] as const;

const LAMBDA_SECURITY_RULES = [
  "aws-iam-privilege-escalation",
  "hardcoded-secret-signatures",
  "no-hardcoded-passwords",
  "no-hardcoded-secrets",
  "no-weak-cipher",
  "no-weak-keys",
  "os-command",
  "sql-queries",
] as const;

export const TYPED_APPLICATION_RULES: Record<string, unknown> = {
  "@typescript-eslint/await-thenable": "warn",
  "@typescript-eslint/no-floating-promises": "warn",
  "@typescript-eslint/no-for-in-array": "warn",
  "@typescript-eslint/no-misused-promises": "warn",
  "@typescript-eslint/no-unnecessary-type-assertion": "warn",
  "@typescript-eslint/no-unsafe-argument": "warn",
  "@typescript-eslint/no-unsafe-assignment": "warn",
  "@typescript-eslint/no-unsafe-call": "warn",
  "@typescript-eslint/no-unsafe-member-access": "warn",
  "@typescript-eslint/no-unsafe-return": "warn",
  "@typescript-eslint/switch-exhaustiveness-check": "warn",
  "@typescript-eslint/no-unused-vars": [
    "warn",
    { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
  ],
};

const ANGULAR_MAINTAINABILITY_RULES = [
  "no-async-lifecycle-method",
  "no-conflicting-lifecycle",
  "no-duplicates-in-metadata-arrays",
  "no-empty-lifecycle-method",
  "no-implicit-take-until-destroyed",
  "no-lifecycle-call",
  "no-pipe-impure",
  "no-uncalled-signals",
  "prefer-output-readonly",
  "use-injectable-provided-in",
] as const;

const ANGULAR_SECURITY_RULES = [
  "dompurify-unsafe-config",
  "dynamically-constructed-templates",
  "no-angular-bypass-sanitization",
  "no-clear-text-protocols",
  "post-message",
] as const;

const ANGULAR_TEMPLATE_ADDITIONAL_RULES: Record<string, unknown> = {
  "@angular-eslint/template/button-has-type": "warn",
  "@angular-eslint/template/conditional-complexity": ["warn", { maxComplexity: 4 }],
  "@angular-eslint/template/cyclomatic-complexity": ["warn", { maxComplexity: 12 }],
  "@angular-eslint/template/no-duplicate-attributes": [
    "warn",
    { allowStylePrecedenceDuplicates: true },
  ],
  "@angular-eslint/template/no-empty-control-flow": "warn",
  "@angular-eslint/template/prefer-ngsrc": "warn",
  "@angular-eslint/template/use-track-by-function": "warn",
};

export interface ResolvedRuleConfiguration {
  rules: Record<string, unknown>;
  categories: RuleCategories;
  profiles: ProfileName[];
  effectiveRuleCount: number;
}

export const RULE_MANIFEST = {
  schemaVersion: 4,
  plugins: {
    eslint: "10.7.0",
    eslintJs: "10.0.1",
    sonarjs: "4.1.0",
    security: "4.0.1",
    angular: "21.4.0",
    angularTemplate: "21.4.0",
    angularTemplateParser: "21.4.0",
    typescriptEslint: "8.63.0",
    typescriptParser: "8.63.0",
    reactHooks: "7.1.1",
    globals: "17.7.0",
  },
  inventory: {
    sonarjs: 268,
    security: 14,
    angular: 49,
    angularTemplate: 39,
    typescriptEslint: 134,
    reactHooks: 29,
  },
} as const;

export function getRuleInventory(): Record<keyof typeof RULE_MANIFEST.inventory, number> {
  return {
    sonarjs: Object.keys(sonarjsPlugin.rules).length,
    security: Object.keys(securityPlugin.rules).length,
    angular: Object.keys(angularPlugin.rules).length,
    angularTemplate: Object.keys(angularTemplatePlugin.rules).length,
    typescriptEslint: Object.keys(TYPESCRIPT_RULES).length,
    reactHooks: Object.keys(REACT_HOOK_RULES).length,
  };
}

function isSecurityRule(ruleName: string): boolean {
  return SONAR_SECURITY_RULE_NAMES.has(ruleName);
}

function isCleanlinessRule(ruleName: string): boolean {
  return CLEANLINESS_RULE_NAMES.includes(ruleName);
}

/** Adds SonarJS rules to their scanner reporting categories. */
function addSonarCategories(categories: RuleCategories): void {
  for (const name of Object.keys(sonarjsPlugin.rules)) {
    const ruleId = `sonarjs/${name}`;
    if (isSecurityRule(name)) categories.security.push(ruleId);
    else if (isCleanlinessRule(name)) categories.cleanliness.push(ruleId);
    else categories.maintainability.push(ruleId);
  }
}

/** Adds rule identifiers with a namespace prefix to one category. */
function addPrefixedRules(
  category: string[],
  rules: Record<string, unknown>,
  prefix: string,
): void {
  for (const name of Object.keys(rules)) category.push(`${prefix}${name}`);
}

/** Adds ESLint core rules to cleanliness or maintainability categories. */
function addCoreCategories(categories: RuleCategories): void {
  const cleanlinessRules = ["no-unused-vars", "no-unreachable", "no-unreachable-loop"];
  for (const name of Object.keys(CORE_RULES)) {
    const category = cleanlinessRules.includes(name)
      ? categories.cleanliness
      : categories.maintainability;
    category.push(name);
  }
}

/** Adds TypeScript rules to cleanliness or maintainability categories. */
function addTypescriptCategories(categories: RuleCategories): void {
  const cleanlinessRules = ["no-unused-vars", "no-unused-expressions", "no-unnecessary-condition"];
  for (const name of Object.keys(TYPESCRIPT_RULES)) {
    const category = cleanlinessRules.includes(name)
      ? categories.cleanliness
      : categories.maintainability;
    category.push(`@typescript-eslint/${name}`);
  }
}

/** Adds Lambda plugin rules to security or maintainability categories. */
function addLambdaCategories(categories: RuleCategories): void {
  const securityRules = ["no-sensitive-event-logging", "no-event-derived-outbound-url"];
  for (const name of Object.keys(lambdaPlugin.rules ?? {})) {
    const category = securityRules.includes(name)
      ? categories.security
      : categories.maintainability;
    category.push(`code-scanner-lambda/${name}`);
  }
}

/** Builds the rule-to-report-category manifest. */
export function buildRuleCategorization(): RuleCategories {
  const categories: RuleCategories = {
    security: [],
    maintainability: [],
    cleanliness: [],
    metrics: [...METRIC_RULES],
  };

  addSonarCategories(categories);
  addPrefixedRules(
    categories.security,
    securityPlugin.rules as Record<string, unknown>,
    "security/",
  );
  categories.maintainability.push("complexity");
  addCoreCategories(categories);
  addPrefixedRules(categories.maintainability, angularPlugin.rules, "@angular-eslint/");
  addPrefixedRules(
    categories.maintainability,
    angularTemplatePlugin.rules,
    "@angular-eslint/template/",
  );
  addTypescriptCategories(categories);
  addPrefixedRules(
    categories.security,
    angularSecurityPlugin.rules ?? {},
    "code-scanner-angular-security/",
  );
  addLambdaCategories(categories);
  addPrefixedRules(categories.maintainability, REACT_HOOK_RULES, "react-hooks/");
  return categories;
}

function addRule(
  rules: Record<string, unknown>,
  ruleId: string,
  configuration: unknown = "warn",
): void {
  rules[ruleId] = configuration;
}

function validateRules(rules: Record<string, unknown>): void {
  const knownRules = new Set([
    "complexity",
    ...Object.keys(CORE_RULES),
    ...Object.keys(sonarjsPlugin.rules).map((name) => `sonarjs/${name}`),
    ...Object.keys(securityPlugin.rules).map((name) => `security/${name}`),
    ...Object.keys(angularPlugin.rules).map((name) => `@angular-eslint/${name}`),
    ...Object.keys(angularTemplatePlugin.rules).map((name) => `@angular-eslint/template/${name}`),
    ...Object.keys(TYPESCRIPT_RULES).map((name) => `@typescript-eslint/${name}`),
    ...Object.keys(angularSecurityPlugin.rules ?? {}).map(
      (name) => `code-scanner-angular-security/${name}`,
    ),
    ...Object.keys(lambdaPlugin.rules ?? {}).map((name) => `code-scanner-lambda/${name}`),
    ...Object.keys(REACT_HOOK_RULES).map((name) => `react-hooks/${name}`),
  ]);
  const unknown = Object.keys(rules).filter((ruleId) => !knownRules.has(ruleId));
  if (unknown.length > 0)
    throw new ConfigError(`Unknown configured rule(s): ${unknown.join(", ")}`);
}

/** Returns whether a TypeScript ESLint rule requires parser type information. */
export function isTypeAwareTypescriptRule(ruleId: string): boolean {
  const prefix = "@typescript-eslint/";
  if (!ruleId.startsWith(prefix)) return false;
  const rule = TYPESCRIPT_RULES[ruleId.slice(prefix.length)];
  return rule?.meta?.docs?.requiresTypeChecking === true;
}

function validateOverrideProfiles(
  profiles: ProfileName[],
  overrides: Record<string, unknown>,
): void {
  const requirements: Array<[prefix: string, profile: ProfileName]> = [
    ["react-hooks/", "react"],
    ["@angular-eslint/", "angular"],
    ["code-scanner-angular-security/", "angular"],
    ["code-scanner-lambda/", "lambda"],
  ];
  const typedApplicationEnabled = profiles.some((profile) =>
    ["typed", "angular", "lambda"].includes(profile),
  );
  const incompatible = Object.entries(overrides).flatMap(([ruleId, configuration]) => {
    if (
      isRuleEnabled(configuration) &&
      isTypeAwareTypescriptRule(ruleId) &&
      !typedApplicationEnabled
    ) {
      return [`${ruleId} requires the typed, angular, or lambda profile`];
    }
    const requirement = requirements.find(([prefix]) => ruleId.startsWith(prefix));
    return requirement && !profiles.includes(requirement[1])
      ? [`${ruleId} requires the ${requirement[1]} profile`]
      : [];
  });
  if (incompatible.length > 0)
    throw new ConfigError(`Profile-incompatible rule override(s): ${incompatible.join(", ")}`);
}

function isRuleEnabled(configuration: unknown): boolean {
  const severity = Array.isArray(configuration) ? configuration[0] : configuration;
  return severity !== "off" && severity !== 0;
}

export function buildAngularTemplateRules(
  profiles: ProfileName[],
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  if (!profiles.includes("angular")) return {};
  return {
    ...angularTemplatePlugin.configs.recommended.rules,
    ...angularTemplatePlugin.configs.accessibility.rules,
    ...ANGULAR_TEMPLATE_ADDITIONAL_RULES,
    ...Object.fromEntries(
      Object.entries(overrides).filter(([ruleId]) =>
        ruleId.startsWith("@angular-eslint/template/"),
      ),
    ),
  };
}

/** Enables a list of namespaced rules at warning severity. */
function addNamedRules(
  rules: Record<string, unknown>,
  names: readonly string[],
  prefix: string,
): void {
  for (const name of names) addRule(rules, `${prefix}${name}`);
}

/** Applies the optional strict-profile rules. */
function applyStrictProfile(rules: Record<string, unknown>, profiles: ProfileName[]): void {
  if (!profiles.includes("strict")) return;
  for (const name of STRICT_SONAR_RULES) {
    const configuration = name === "no-duplicate-string" ? ["warn", { threshold: 5 }] : "warn";
    addRule(rules, `sonarjs/${name}`, configuration);
  }
}

/** Applies Lambda security, reliability, and custom rules. */
function applyLambdaProfile(rules: Record<string, unknown>, profiles: ProfileName[]): void {
  if (!profiles.includes("lambda")) return;
  addNamedRules(rules, LAMBDA_SECURITY_RULES, "sonarjs/");
  Object.assign(rules, TYPED_APPLICATION_RULES);
  addNamedRules(rules, Object.keys(lambdaPlugin.rules ?? {}), "code-scanner-lambda/");
}

/** Applies Angular framework, security, reliability, and custom rules. */
function applyAngularProfile(rules: Record<string, unknown>, profiles: ProfileName[]): void {
  if (!profiles.includes("angular")) return;
  Object.assign(rules, angularPlugin.configs.recommended.rules);
  addNamedRules(rules, ANGULAR_MAINTAINABILITY_RULES, "@angular-eslint/");
  addNamedRules(rules, ANGULAR_SECURITY_RULES, "sonarjs/");
  Object.assign(rules, TYPED_APPLICATION_RULES);
  addNamedRules(
    rules,
    Object.keys(angularSecurityPlugin.rules ?? {}),
    "code-scanner-angular-security/",
  );
}

/** Builds the effective ESLint rules for selected profiles. */
export function buildEslintRules(
  profiles: ProfileName[] = ["generic"],
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  validateRules(overrides);
  validateOverrideProfiles(profiles, overrides);
  const rules: Record<string, unknown> = {
    ...CORE_RECOMMENDED_RULES,
    complexity: ["warn", { max: 0 }],
    "sonarjs/cognitive-complexity": ["warn", 0],
    "sonarjs/nested-control-flow": ["warn", { maximumNestingLevel: 0 }],
    "sonarjs/expression-complexity": ["warn", { max: 0 }],
  };

  addNamedRules(rules, GENERIC_SONAR_RULES, "sonarjs/");
  addNamedRules(rules, PORTABLE_SECURITY_RULES, "security/");
  applyStrictProfile(rules, profiles);
  applyLambdaProfile(rules, profiles);
  if (profiles.includes("typed")) Object.assign(rules, TYPED_APPLICATION_RULES);
  if (profiles.includes("react")) Object.assign(rules, REACT_RULES);
  applyAngularProfile(rules, profiles);
  Object.assign(
    rules,
    Object.fromEntries(
      Object.entries(overrides).filter(
        ([ruleId]) => !ruleId.startsWith("@angular-eslint/template/"),
      ),
    ),
  );
  return rules;
}

export function resolveRuleConfiguration(
  requestedProfiles: ProfileName[] = [],
  overrides: Record<string, unknown> = {},
): ResolvedRuleConfiguration {
  const additionalProfiles = [...new Set(requestedProfiles)]
    .filter((profile) => profile !== "generic")
    .sort();
  const profiles: ProfileName[] = ["generic", ...additionalProfiles];
  const rules = buildEslintRules(profiles, overrides);
  const templateRules = buildAngularTemplateRules(profiles, overrides);
  const javascriptRules = Object.fromEntries(
    Object.entries(rules).filter(
      ([ruleId]) =>
        !ruleId.startsWith("@typescript-eslint/") &&
        !ruleId.startsWith("@angular-eslint/") &&
        !ruleId.startsWith("code-scanner-angular-security/"),
    ),
  );
  const typescriptRules = {
    ...rules,
    ...UNTYPED_TYPESCRIPT_RULES,
    ...Object.fromEntries(
      Object.entries(rules).filter(([ruleId]) => ruleId.startsWith("@typescript-eslint/")),
    ),
  };
  const enabledRuleIds = new Set<string>();
  for (const ruleSet of [javascriptRules, typescriptRules, templateRules]) {
    for (const [ruleId, configuration] of Object.entries(ruleSet)) {
      if (isRuleEnabled(configuration)) enabledRuleIds.add(ruleId);
    }
  }
  return {
    profiles,
    rules,
    categories: buildRuleCategorization(),
    effectiveRuleCount: enabledRuleIds.size,
  };
}

export function categorizeRule(
  ruleId: string | null,
  categories: RuleCategories,
): "security" | "maintainability" | "cleanliness" | "other" {
  if (!ruleId) return "other";
  if (categories.metrics.includes(ruleId)) return "other";
  if (categories.security.includes(ruleId)) return "security";
  if (categories.cleanliness.includes(ruleId)) return "cleanliness";
  if (categories.maintainability.includes(ruleId)) return "maintainability";
  if (ruleId.startsWith("security/")) return "security";
  return "other";
}

export const THRESHOLDS: Thresholds = {
  cognitive: {
    low: 10,
    medium: 15,
    high: 25,
  },
  cyclomatic: {
    low: 10,
    medium: 15,
    high: 20,
  },
  security: {
    low: 0,
    medium: 0,
    high: 0,
  },
  maintainability: {
    low: 5,
    medium: 10,
    high: 20,
  },
  cleanliness: {
    low: 3,
    medium: 5,
    high: 10,
  },
};

export const LEGEND: Legend = {
  cognitive: {
    name: "Cognitive Complexity",
    description:
      "Measures how difficult the code is to understand. Accounts for nesting, breaks in linear flow, and logical complexity.",
    interpretation: {
      "0-10": "Easy to understand",
      "11-15": "Moderate complexity, consider refactoring",
      "16-25": "High complexity, should refactor",
      "25+": "Very high complexity, must refactor",
    },
  },
  cyclomatic: {
    name: "Cyclomatic Complexity",
    description:
      "Counts the number of independent paths through the code. Each branch (if, case, loop) adds to the count.",
    interpretation: {
      "1-10": "Simple, low risk",
      "11-20": "Moderate complexity",
      "21-50": "High complexity, high risk",
      "50+": "Untestable, very high risk",
    },
  },
  security: {
    name: "Security Issues",
    description:
      "Count of potential security vulnerabilities detected. Includes hardcoded secrets, injection risks, weak crypto, and unsafe patterns.",
    interpretation: {
      "0": "No issues detected",
      "1+": "Review required - any security issue should be investigated",
    },
    examples: [
      "Hardcoded passwords or API keys",
      "SQL injection vulnerabilities",
      "Use of eval() with variables",
      "Weak cryptographic algorithms",
      "Missing CSRF protection",
      "Insecure cookie settings",
    ],
  },
  maintainability: {
    name: "Maintainability Issues",
    description:
      "Count of code smells that make the code harder to maintain. Includes duplication, excessive nesting, and redundant code.",
    interpretation: {
      "0-5": "Good maintainability",
      "6-10": "Some issues, consider cleanup",
      "11-20": "Needs attention",
      "20+": "Significant technical debt",
    },
    examples: [
      "Duplicated code blocks",
      "Deeply nested conditionals",
      "Collapsible if statements",
      "Redundant boolean expressions",
      "Identical function implementations",
    ],
  },
  cleanliness: {
    name: "Cleanliness Issues",
    description:
      "Count of code hygiene issues. Includes dead code, unused variables, and leftover TODOs.",
    interpretation: {
      "0-3": "Clean code",
      "4-5": "Minor cleanup needed",
      "6-10": "Noticeable clutter",
      "10+": "Significant cleanup needed",
    },
    examples: [
      "Commented-out code",
      "TODO/FIXME comments",
      "Unused imports or variables",
      "Dead stores (assigned but never read)",
      "Empty catch blocks",
    ],
  },
  commentRatio: {
    name: "Comment Ratio",
    description:
      "Percentage of lines in the file that are comments. Indicates documentation level and potential code smell from commented-out code.",
    interpretation: {
      "<5%": "Too few comments, add more documentation",
      "5-30%": "Healthy comment ratio",
      ">30%": "Too many comments or contains commented-out code",
    },
  },
};

export function printLegend(): void {
  console.log("\n" + "=".repeat(80));
  console.log("METRIC LEGEND");
  console.log("=".repeat(80));

  for (const [, info] of Object.entries(LEGEND)) {
    console.log(`\n📊 ${info.name.toUpperCase()}`);
    console.log(`   ${info.description}`);
    console.log("\n   Interpretation:");
    for (const [range, meaning] of Object.entries(info.interpretation)) {
      console.log(`   • ${range.padEnd(8)} → ${meaning}`);
    }
    if (info.examples) {
      console.log("\n   Examples of issues detected:");
      info.examples.forEach((ex: string) => console.log(`   • ${ex}`));
    }
  }
  console.log("\n" + "=".repeat(80));
}

// Re-export plugins for ESLint configuration
export { sonarjsPlugin, securityPlugin };
