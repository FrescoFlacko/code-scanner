import sonarjsPlugin from "eslint-plugin-sonarjs";
import securityPlugin from "eslint-plugin-security";
import type { RuleCategories, Thresholds, Legend } from "./src/scanner/types.js";

const SECURITY_KEYWORDS = [
  "security-sensitive",
  "injection",
  "vulnerability",
  "xxe",
  "xss",
  "csrf",
];

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

interface RuleMeta {
  docs?: {
    description?: string;
  };
}

function isSecurityRule(_ruleName: string, ruleMeta: RuleMeta | undefined): boolean {
  const description = (ruleMeta?.docs?.description || "").toLowerCase();
  return SECURITY_KEYWORDS.some((keyword) => description.includes(keyword));
}

function isCleanlinessRule(ruleName: string): boolean {
  return CLEANLINESS_RULE_NAMES.includes(ruleName);
}

export function buildRuleCategorization(): RuleCategories {
  const categories: RuleCategories = {
    security: [],
    maintainability: [],
    cleanliness: [],
  };

  const sonarRules = sonarjsPlugin.rules as Record<string, { meta?: RuleMeta }>;
  for (const [name, rule] of Object.entries(sonarRules)) {
    const fullName = `sonarjs/${name}`;
    if (isSecurityRule(name, rule.meta)) {
      categories.security.push(fullName);
    } else if (isCleanlinessRule(name)) {
      categories.cleanliness.push(fullName);
    } else {
      categories.maintainability.push(fullName);
    }
  }

  const securityRules = securityPlugin.rules as Record<string, unknown>;
  for (const name of Object.keys(securityRules)) {
    categories.security.push(`security/${name}`);
  }

  categories.maintainability.push("complexity");

  return categories;
}

export function buildEslintRules(): Record<string, unknown> {
  const rules: Record<string, unknown> = {
    complexity: ["warn", { max: 0 }],
    "sonarjs/cognitive-complexity": ["warn", 0],
    "sonarjs/nested-control-flow": ["warn", { maximumNestingLevel: 0 }],
    "sonarjs/expression-complexity": ["warn", { max: 0 }],
    "sonarjs/no-duplicate-string": ["warn", { threshold: 2 }],
  };

  const sonarRules = sonarjsPlugin.rules as Record<string, unknown>;
  for (const name of Object.keys(sonarRules)) {
    const fullName = `sonarjs/${name}`;
    if (!rules[fullName]) {
      rules[fullName] = "warn";
    }
  }

  const securityRules = securityPlugin.rules as Record<string, unknown>;
  for (const name of Object.keys(securityRules)) {
    rules[`security/${name}`] = "warn";
  }

  return rules;
}

export function categorizeRule(ruleId: string | null, categories: RuleCategories): "security" | "maintainability" | "cleanliness" | "other" {
  if (!ruleId) return "other";
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
