import { describe, expect, it } from "vitest";
import fs from "fs";
import { ConfigError } from "./errors.js";
import {
  buildAngularTemplateRules,
  buildEslintRules,
  buildRuleCategorization,
  getRuleInventory,
  resolveRuleConfiguration,
  RULE_MANIFEST,
} from "../../scanner.config.js";

describe("buildRuleCategorization", () => {
  it.each([
    "no-hardcoded-passwords",
    "sql-queries",
    "os-command",
    "encryption-secure-mode",
    "no-weak-cipher",
    "aws-ec2-rds-dms-public",
    "aws-iam-public-access",
    "aws-s3-bucket-insecure-http",
    "aws-s3-bucket-public-access",
    "frame-ancestors",
    "no-mixed-content",
    "publicly-writable-directories",
  ])("classifies sonarjs/%s as security", (ruleName) => {
    expect(buildRuleCategorization().security).toContain(`sonarjs/${ruleName}`);
  });

  it("keeps ordinary code-smell rules in maintainability", () => {
    expect(buildRuleCategorization().maintainability).toContain("sonarjs/no-identical-functions");
  });

  it("separates metric probes from issue categories", () => {
    const categories = buildRuleCategorization();
    expect(categories.metrics).toEqual(
      expect.arrayContaining(["complexity", "sonarjs/cognitive-complexity"]),
    );
  });

  it("uses the ESLint correctness baseline without enabling opinionated style rules", () => {
    const rules = buildEslintRules();
    expect(rules["no-undef"]).toBe("warn");
    expect(rules["no-unreachable"]).toBe("warn");
    expect(rules["sonarjs/no-identical-functions"]).toBe("warn");
    expect(rules["sonarjs/file-header"]).toBeUndefined();
    expect(Object.keys(rules).length).toBeLessThan(120);
  });

  it("composes typed, environment, framework, and strict profiles", () => {
    expect(
      resolveRuleConfiguration(["typed"]).rules["@typescript-eslint/no-floating-promises"],
    ).toBe("warn");
    expect(resolveRuleConfiguration(["node"]).rules["no-undef"]).toBe("warn");
    expect(resolveRuleConfiguration(["browser"]).rules["no-undef"]).toBe("warn");
    expect(resolveRuleConfiguration(["react"]).rules["react-hooks/rules-of-hooks"]).toBeDefined();
    expect(resolveRuleConfiguration(["lambda"]).rules["sonarjs/no-hardcoded-secrets"]).toBe("warn");
    expect(
      resolveRuleConfiguration(["lambda"]).rules["@typescript-eslint/no-floating-promises"],
    ).toBe("warn");
    expect(
      resolveRuleConfiguration(["lambda"]).rules[
        "code-scanner-lambda/no-client-construction-in-handler"
      ],
    ).toBe("warn");
    expect(
      resolveRuleConfiguration(["angular"]).rules["@angular-eslint/prefer-standalone"],
    ).toBeDefined();
    expect(
      resolveRuleConfiguration(["angular"]).rules["@typescript-eslint/no-floating-promises"],
    ).toBe("warn");
    expect(
      resolveRuleConfiguration(["angular"]).rules["sonarjs/no-angular-bypass-sanitization"],
    ).toBe("warn");
    expect(
      resolveRuleConfiguration(["angular"]).rules[
        "code-scanner-angular-security/no-direct-dom-html-sinks"
      ],
    ).toBe("warn");
    expect(resolveRuleConfiguration(["strict"]).rules["sonarjs/no-duplicate-string"]).toEqual([
      "warn",
      { threshold: 5 },
    ]);
  });

  it("categorizes Angular security and TypeScript cleanliness rules", () => {
    const categories = buildRuleCategorization();
    expect(categories.security).toContain("sonarjs/no-angular-bypass-sanitization");
    expect(categories.cleanliness).toContain("@typescript-eslint/no-unused-vars");
    expect(categories.security).toContain(
      "code-scanner-angular-security/no-sensitive-browser-storage",
    );
    expect(categories.security).toContain("code-scanner-lambda/no-sensitive-event-logging");
    expect(categories.maintainability).toContain(
      "code-scanner-lambda/no-client-construction-in-handler",
    );
  });

  it("rejects unknown rule overrides after a plugin upgrade or config typo", () => {
    expect(() => buildEslintRules([], { "sonarjs/not-a-real-rule": "warn" })).toThrow(
      /Unknown configured rule/,
    );
  });

  it("applies overrides only within a compatible plugin scope", () => {
    const override = { "@angular-eslint/template/button-has-type": "off" };
    expect(resolveRuleConfiguration(["angular"], override).rules).not.toHaveProperty(
      "@angular-eslint/template/button-has-type",
    );
    expect(
      buildAngularTemplateRules(["generic", "angular"], override)[
        "@angular-eslint/template/button-has-type"
      ],
    ).toBe("off");
    expect(() => resolveRuleConfiguration([], { "react-hooks/rules-of-hooks": "warn" })).toThrow(
      /requires the react profile/,
    );
    expect(() =>
      resolveRuleConfiguration([], {
        "code-scanner-lambda/no-async-callback-handler": "warn",
      }),
    ).toThrow(/requires the lambda profile/);
  });

  it("requires a typed application profile for enabled type-aware TypeScript overrides", () => {
    const override = { "@typescript-eslint/no-floating-promises": "warn" };

    expect(() => resolveRuleConfiguration([], override)).toThrow(ConfigError);
    expect(() => resolveRuleConfiguration([], override)).toThrow(
      /requires the typed, angular, or lambda profile/,
    );
    expect(resolveRuleConfiguration(["typed"], override).rules).toMatchObject(override);
  });

  it("allows type-aware TypeScript overrides to remain disabled without a typed profile", () => {
    const override = { "@typescript-eslint/no-floating-promises": "off" };

    expect(resolveRuleConfiguration([], override).rules).toMatchObject(override);
  });

  it("counts only rules that are enabled in at least one linting scope", () => {
    const baseline = resolveRuleConfiguration([]).effectiveRuleCount;
    expect(resolveRuleConfiguration([], { "no-undef": "off" }).effectiveRuleCount).toBe(
      baseline - 1,
    );
    expect(
      resolveRuleConfiguration([], {
        "@typescript-eslint/no-explicit-any": "warn",
      }).effectiveRuleCount,
    ).toBe(baseline + 1);
    expect(
      resolveRuleConfiguration([], {
        "@typescript-eslint/no-unused-vars": "off",
      }).effectiveRuleCount,
    ).toBe(baseline - 1);
  });

  it("fails visibly when plugin versions or exported rule inventories drift", () => {
    const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8")) as {
      packages: Record<string, { version?: string }>;
    };
    expect(getRuleInventory()).toEqual(RULE_MANIFEST.inventory);
    expect(lock.packages["node_modules/eslint-plugin-sonarjs"].version).toBe(
      RULE_MANIFEST.plugins.sonarjs,
    );
    expect(lock.packages["node_modules/eslint-plugin-security"].version).toBe(
      RULE_MANIFEST.plugins.security,
    );
    expect(lock.packages["node_modules/@angular-eslint/eslint-plugin"].version).toBe(
      RULE_MANIFEST.plugins.angular,
    );
    expect(lock.packages["node_modules/typescript-eslint"].version).toBe(
      RULE_MANIFEST.plugins.typescriptEslint,
    );
    expect(lock.packages["node_modules/eslint-plugin-react-hooks"].version).toBe(
      RULE_MANIFEST.plugins.reactHooks,
    );
    expect(lock.packages["node_modules/globals"].version).toBe(RULE_MANIFEST.plugins.globals);
  });
});
