import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import { scan } from "../src/scanner/index.js";
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { ConfigError } from "../src/scanner/errors.js";
import type { ScanJsonOutput } from "../src/scanner/types.js";

let fixturesPath: string;
let logSpy: ReturnType<typeof vi.spyOn>;

describe("scanner integration", () => {
  beforeAll(() => {
    fixturesPath = fs.mkdtempSync(path.join(os.tmpdir(), "code-scanner-integration-"));
    fs.writeFileSync(
      path.join(fixturesPath, "clean.ts"),
      "export function add(a: number, b: number): number { return a + b; }\n",
    );
    fs.writeFileSync(path.join(fixturesPath, "nested.ts"), "export const answer = 42;\n");
  });

  afterAll(() => fs.rmSync(fixturesPath, { recursive: true, force: true }));
  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
  });
  afterEach(() => logSpy.mockRestore());

  it("scans a directory and returns concrete file metrics", async () => {
    const result = await scan({ targetPath: fixturesPath });

    expect(result.report.map((file) => file.relativePath).sort()).toEqual([
      "clean.ts",
      "nested.ts",
    ]);
    expect(result.totals).toMatchObject({
      security: expect.any(Number),
      maintainability: expect.any(Number),
      cleanliness: expect.any(Number),
    });
    for (const file of result.report) {
      expect(file).toMatchObject({
        file: expect.any(String),
        relativePath: expect.any(String),
        cognitive: expect.any(Number),
        cyclomatic: expect.any(Number),
        security: expect.any(Number),
        maintainability: expect.any(Number),
        cleanliness: expect.any(Number),
        grade: expect.stringMatching(/^[ABCDF]$/),
        issues: expect.any(Array),
      });
    }
  });

  it("respects exclude patterns", async () => {
    const result = await scan({
      targetPath: fixturesPath,
      excludes: ["**/*.ts"],
    });
    expect(result).toEqual({ report: [], totals: null });
  });

  it("writes a current empty JSON artifact and effective config excludes", async () => {
    const emptyPath = fs.mkdtempSync(path.join(os.tmpdir(), "code-scanner-empty-"));
    const outputPath = path.join(emptyPath, "results.json");
    fs.writeFileSync(
      path.join(emptyPath, ".scannerrc.json"),
      JSON.stringify({ exclude: ["**/*.ts"] }),
    );

    const result = await scan({
      targetPath: emptyPath,
      excludes: ["generated/**"],
      saveAsJson: outputPath,
    });
    const output = JSON.parse(fs.readFileSync(outputPath, "utf8")) as ScanJsonOutput;

    expect(result.totals).toEqual({
      security: 0,
      maintainability: 0,
      cleanliness: 0,
      scannerErrors: 0,
      avgCognitive: 0,
      avgCyclomatic: 0,
    });
    expect(output.report).toEqual([]);
    expect(output.options.excludes).toEqual(["generated/**", "**/*.ts"]);
    expect(output.priorities.items).toEqual([]);
    fs.rmSync(emptyPath, { recursive: true, force: true });
  });

  it("ignores malformed history and replaces it with versioned state", async () => {
    const historyPath = path.join(fixturesPath, ".scanner-history.json");
    fs.writeFileSync(historyPath, "{}");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const result = await scan({ targetPath: fixturesPath });
    const history = JSON.parse(fs.readFileSync(historyPath, "utf8")) as Record<string, unknown>;

    expect(result.trends).toBeUndefined();
    expect(history.version).toBe(3);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Ignoring incompatible or invalid"));
    warn.mockRestore();
  });

  it("creates history on a full scan and compares a subsequent full scan", async () => {
    fs.rmSync(path.join(fixturesPath, ".scanner-history.json"), {
      force: true,
    });
    const first = await scan({ targetPath: fixturesPath });
    const second = await scan({ targetPath: fixturesPath });

    expect(first.trends).toBeUndefined();
    expect(second.trends).toMatchObject({
      improved: [],
      regressed: [],
      new: [],
      removed: [],
    });
  });

  it("does not compare history created by a different profile set", async () => {
    fs.rmSync(path.join(fixturesPath, ".scanner-history.json"), {
      force: true,
    });
    await scan({ targetPath: fixturesPath, quiet: true });

    const changedProfile = await scan({
      targetPath: fixturesPath,
      profiles: ["strict"],
      quiet: true,
    });

    expect(changedProfile.trends).toBeUndefined();
    const history = JSON.parse(
      fs.readFileSync(path.join(fixturesPath, ".scanner-history.json"), "utf8"),
    ) as { profiles: string[] };
    expect(history.profiles).toEqual(["generic", "strict"]);
  });

  it("invalidates history when an Angular template override changes", async () => {
    const angularPath = fs.mkdtempSync(path.join(os.tmpdir(), "code-scanner-template-history-"));
    fs.writeFileSync(
      path.join(angularPath, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: { strict: true, target: "ES2022", module: "ES2022" },
        include: ["*.ts"],
      }),
    );
    fs.writeFileSync(path.join(angularPath, "component.ts"), "export class Component {}\n");
    fs.writeFileSync(path.join(angularPath, "component.html"), "<button>Save</button>\n");
    fs.writeFileSync(
      path.join(angularPath, ".scannerrc.json"),
      JSON.stringify({ profiles: ["angular"] }),
    );
    await scan({ targetPath: angularPath, quiet: true });

    fs.writeFileSync(
      path.join(angularPath, ".scannerrc.json"),
      JSON.stringify({
        profiles: ["angular"],
        rules: { "@angular-eslint/template/button-has-type": "off" },
      }),
    );
    const changedConfiguration = await scan({
      targetPath: angularPath,
      quiet: true,
    });

    expect(changedConfiguration.trends).toBeUndefined();
    fs.rmSync(angularPath, { recursive: true, force: true });
  });

  it("does not compare or overwrite full history during a partial Git scan", async () => {
    const repository = fs.mkdtempSync(path.join(os.tmpdir(), "code-scanner-git-history-"));
    fs.writeFileSync(path.join(repository, "first.ts"), "export const first = 1;\n");
    fs.writeFileSync(path.join(repository, "second.ts"), "export const second = 2;\n");
    execFileSync("git", ["init", "-q"], { cwd: repository });
    execFileSync("git", ["add", "."], { cwd: repository });
    execFileSync(
      "git",
      [
        "-c",
        "user.name=Scanner Test",
        "-c",
        "user.email=scanner@example.test",
        "commit",
        "-qm",
        "fixture",
      ],
      { cwd: repository },
    );
    await scan({ targetPath: repository });
    const historyPath = path.join(repository, ".scanner-history.json");
    const baseline = fs.readFileSync(historyPath, "utf8");
    fs.writeFileSync(path.join(repository, "first.ts"), "export const first = 10;\n");

    const partial = await scan({
      targetPath: repository,
      scanGitChanges: true,
    });

    expect(partial.report.map((file) => file.relativePath)).toEqual(["first.ts"]);
    expect(partial.trends).toBeUndefined();
    expect(fs.readFileSync(historyPath, "utf8")).toBe(baseline);
    fs.rmSync(repository, { recursive: true, force: true });
  });

  it("returns an empty result for help", async () => {
    expect(await scan({ help: true })).toEqual({ report: [], totals: null });
  });

  it("supports a quiet, history-free programmatic scan", async () => {
    fs.rmSync(path.join(fixturesPath, ".scanner-history.json"), {
      force: true,
    });
    const result = await scan({
      targetPath: fixturesPath,
      quiet: true,
      persistHistory: false,
    });

    expect(result.report).toHaveLength(2);
    expect(logSpy).not.toHaveBeenCalled();
    expect(fs.existsSync(path.join(fixturesPath, ".scanner-history.json"))).toBe(false);
  });

  it("finds JavaScript correctness and TypeScript cleanliness defects in the generic profile", async () => {
    const genericPath = fs.mkdtempSync(path.join(os.tmpdir(), "code-scanner-generic-positive-"));
    fs.writeFileSync(
      path.join(genericPath, "broken.js"),
      "export function broken() { return missingName; const unreachable = 1; }\n",
    );
    fs.writeFileSync(
      path.join(genericPath, "dirty.ts"),
      "const unusedValue = 1;\nexport const answer: number = 42;\n",
    );

    const result = await scan({
      targetPath: genericPath,
      quiet: true,
      persistHistory: false,
    });
    const rules = result.report.flatMap((file) => file.issues.map((issue) => issue.rule));

    expect(rules).toEqual(
      expect.arrayContaining(["no-undef", "no-unreachable", "@typescript-eslint/no-unused-vars"]),
    );
    expect(rules).not.toContain("scanner-error");
    fs.rmSync(genericPath, { recursive: true, force: true });
  });

  it("exposes parser failures separately from code findings", async () => {
    const invalidPath = fs.mkdtempSync(path.join(os.tmpdir(), "code-scanner-parser-failure-"));
    fs.writeFileSync(path.join(invalidPath, "invalid.ts"), "export const value: = 1;\n");

    const result = await scan({
      targetPath: invalidPath,
      quiet: true,
      persistHistory: false,
    });

    expect(result.totals).toMatchObject({
      security: 0,
      maintainability: 0,
      cleanliness: 0,
      scannerErrors: 1,
    });
    expect(result.report[0]).toMatchObject({ grade: "F", scannerErrors: 1 });
    expect(result.report[0].issues).toEqual([
      expect.objectContaining({ rule: "scanner-error", category: "other" }),
    ]);
    fs.rmSync(invalidPath, { recursive: true, force: true });
  });

  it("recognizes Node and browser globals only when their environment profiles are selected", async () => {
    const environmentPath = fs.mkdtempSync(path.join(os.tmpdir(), "code-scanner-environments-"));
    fs.writeFileSync(path.join(environmentPath, "node.js"), "export const cwd = process.cwd();\n");
    fs.writeFileSync(
      path.join(environmentPath, "browser.js"),
      "export const title = document.title;\n",
    );

    const generic = await scan({
      targetPath: environmentPath,
      quiet: true,
      persistHistory: false,
    });
    const configured = await scan({
      targetPath: environmentPath,
      profiles: ["node", "browser"],
      quiet: true,
      persistHistory: false,
    });

    expect(generic.report.flatMap((file) => file.issues.map((issue) => issue.rule))).toContain(
      "no-undef",
    );
    expect(
      configured.report.flatMap((file) => file.issues.map((issue) => issue.rule)),
    ).not.toContain("no-undef");
    fs.rmSync(environmentPath, { recursive: true, force: true });
  });

  it("includes Node globals in the Lambda profile", async () => {
    const lambdaPath = fs.mkdtempSync(path.join(os.tmpdir(), "code-scanner-lambda-globals-"));
    fs.writeFileSync(
      path.join(lambdaPath, "handler.js"),
      [
        "exports.handler = async () => {",
        "  console.log(process.env.AWS_REGION);",
        '  return Buffer.from("ok");',
        "};",
      ].join("\n"),
    );

    const result = await scan({
      targetPath: lambdaPath,
      profiles: ["lambda"],
      quiet: true,
      persistHistory: false,
    });

    expect(result.report.flatMap((file) => file.issues.map((issue) => issue.rule))).not.toContain(
      "no-undef",
    );
    fs.rmSync(lambdaPath, { recursive: true, force: true });
  });

  it("detects typed promise handling and React hook defects in opt-in profiles", async () => {
    const applicationPath = fs.mkdtempSync(path.join(os.tmpdir(), "code-scanner-typed-react-"));
    fs.writeFileSync(
      path.join(applicationPath, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          strict: true,
          target: "ES2022",
          module: "ES2022",
          jsx: "preserve",
        },
        include: ["*.tsx"],
      }),
    );
    fs.writeFileSync(
      path.join(applicationPath, "component.tsx"),
      [
        "declare function useState<T>(initial: T): [T, (value: T) => void];",
        "async function persist(): Promise<void> {}",
        "export function Component({ enabled }: { enabled: boolean }) {",
        "  persist();",
        "  if (enabled) useState(0);",
        "  return null;",
        "}",
      ].join("\n"),
    );

    const result = await scan({
      targetPath: applicationPath,
      profiles: ["typed", "browser", "react"],
      quiet: true,
      persistHistory: false,
    });
    const rules = result.report.flatMap((file) => file.issues.map((issue) => issue.rule));

    expect(rules).toEqual(
      expect.arrayContaining([
        "@typescript-eslint/no-floating-promises",
        "react-hooks/rules-of-hooks",
      ]),
    );
    expect(rules).not.toContain("scanner-error");
    fs.rmSync(applicationPath, { recursive: true, force: true });
  });

  it("rejects an enabled type-aware rule override without a typed application profile", async () => {
    const applicationPath = fs.mkdtempSync(
      path.join(os.tmpdir(), "code-scanner-untyped-override-"),
    );
    fs.writeFileSync(
      path.join(applicationPath, ".scannerrc.json"),
      JSON.stringify({
        rules: { "@typescript-eslint/no-floating-promises": "warn" },
      }),
    );
    fs.writeFileSync(path.join(applicationPath, "application.ts"), "export const answer = 42;\n");

    await expect(
      scan({
        targetPath: applicationPath,
        quiet: true,
        persistHistory: false,
      }),
    ).rejects.toThrow(ConfigError);
    fs.rmSync(applicationPath, { recursive: true, force: true });
  });

  it("scans Angular TypeScript and HTML templates with the explicit profile", async () => {
    const angularPath = fs.mkdtempSync(path.join(os.tmpdir(), "code-scanner-angular-"));
    fs.writeFileSync(path.join(angularPath, "component.ts"), "export class ExampleComponent {}\n");
    fs.writeFileSync(
      path.join(angularPath, "component.html"),
      '<button type="button">Save</button>\n',
    );
    fs.writeFileSync(
      path.join(angularPath, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: { strict: true, target: "ES2022", module: "ES2022" },
        include: ["*.ts"],
      }),
    );

    const result = await scan({
      targetPath: angularPath,
      profiles: ["angular"],
      quiet: true,
      persistHistory: false,
    });

    expect(result.report.map((file) => file.relativePath).sort()).toEqual([
      "component.html",
      "component.ts",
    ]);
    expect(
      result.report
        .flatMap((file) => file.issues)
        .filter((issue) => issue.rule === "scanner-error"),
    ).toEqual([]);
    fs.rmSync(angularPath, { recursive: true, force: true });
  });

  it("detects Angular security, typed reliability, cleanliness, and template defects while ignoring generated findings", async () => {
    const angularPath = fs.mkdtempSync(path.join(os.tmpdir(), "code-scanner-angular-positive-"));
    fs.writeFileSync(
      path.join(angularPath, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: { strict: true, target: "ES2022", module: "ES2022" },
        include: ["**/*.ts"],
      }),
    );
    fs.writeFileSync(
      path.join(angularPath, "unsafe.ts"),
      [
        "class Sanitizer { bypassSecurityTrustHtml(value: string): unknown { return value; } }",
        "const sanitizer = new Sanitizer();",
        "export function trust(input: string) { sanitizer.bypassSecurityTrustHtml(input); }",
        "async function persist(): Promise<void> {}",
        "persist();",
        "const unused = 1;",
        "document.body.innerHTML = inputFromUser();",
        "localStorage.setItem('authToken', inputFromUser());",
        "withNoXsrfProtection();",
        "declare function inputFromUser(): string;",
        "declare function withNoXsrfProtection(): void;",
      ].join("\n"),
    );
    fs.writeFileSync(path.join(angularPath, "unsafe.html"), "<button>Save</button>\n");
    fs.mkdirSync(path.join(angularPath, "generated"));
    fs.writeFileSync(
      path.join(angularPath, "generated", "client.ts"),
      "const generatedUnused = 1;\n",
    );
    fs.writeFileSync(
      path.join(angularPath, "generated", "client.html"),
      "<button>Generated</button>\n",
    );

    const result = await scan({
      targetPath: angularPath,
      profiles: ["angular"],
      quiet: true,
      persistHistory: false,
    });
    const rules = result.report.flatMap((file) => file.issues.map((issue) => issue.rule));
    const generated = result.report.find((file) => file.relativePath === "generated/client.ts");
    const generatedTemplate = result.report.find(
      (file) => file.relativePath === "generated/client.html",
    );

    expect(rules).toEqual(
      expect.arrayContaining([
        "sonarjs/no-angular-bypass-sanitization",
        "@typescript-eslint/no-floating-promises",
        "@typescript-eslint/no-unused-vars",
        "@angular-eslint/template/button-has-type",
        "code-scanner-angular-security/no-direct-dom-html-sinks",
        "code-scanner-angular-security/no-sensitive-browser-storage",
        "code-scanner-angular-security/no-disabled-xsrf-protection",
      ]),
    );
    expect(generated?.issues).toEqual([]);
    expect(generatedTemplate?.issues).toEqual([]);
    fs.rmSync(angularPath, { recursive: true, force: true });
  });

  it("applies Angular template overrides to the HTML linting scope", async () => {
    const angularPath = fs.mkdtempSync(path.join(os.tmpdir(), "code-scanner-angular-override-"));
    fs.writeFileSync(
      path.join(angularPath, ".scannerrc.json"),
      JSON.stringify({
        profiles: ["angular"],
        rules: { "@angular-eslint/template/button-has-type": "off" },
      }),
    );
    fs.writeFileSync(
      path.join(angularPath, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: { strict: true, target: "ES2022", module: "ES2022" },
        include: ["*.ts"],
      }),
    );
    fs.writeFileSync(path.join(angularPath, "component.ts"), "export class ExampleComponent {}\n");
    fs.writeFileSync(path.join(angularPath, "component.html"), "<button>Save</button>\n");

    const result = await scan({
      targetPath: angularPath,
      quiet: true,
      persistHistory: false,
    });
    const rules = result.report.flatMap((file) => file.issues.map((issue) => issue.rule));

    expect(rules).not.toContain("@angular-eslint/template/button-has-type");
    expect(rules).not.toContain("scanner-error");
    fs.rmSync(angularPath, { recursive: true, force: true });
  });

  it("composes Angular and Lambda JavaScript rules without dropping Lambda findings", async () => {
    const applicationPath = fs.mkdtempSync(path.join(os.tmpdir(), "code-scanner-angular-lambda-"));
    fs.writeFileSync(
      path.join(applicationPath, "handler.js"),
      [
        "class S3Client {}",
        "export const handler = async (_event, _context, callback) => {",
        "  const client = new S3Client();",
        "  callback();",
        "  return client;",
        "};",
      ].join("\n"),
    );

    const result = await scan({
      targetPath: applicationPath,
      profiles: ["angular", "lambda"],
      quiet: true,
      persistHistory: false,
    });
    const rules = result.report.flatMap((file) => file.issues.map((issue) => issue.rule));

    expect(rules).toEqual(
      expect.arrayContaining([
        "code-scanner-lambda/no-client-construction-in-handler",
        "code-scanner-lambda/no-async-callback-handler",
      ]),
    );
    expect(rules).not.toContain("scanner-error");
    fs.rmSync(applicationPath, { recursive: true, force: true });
  });

  it("uses untyped scopes for every supported spec, config, and generated extension", async () => {
    const applicationPath = fs.mkdtempSync(
      path.join(os.tmpdir(), "code-scanner-extension-scopes-"),
    );
    const extensions = ["js", "mjs", "cjs", "ts", "mts", "cts", "jsx", "tsx"];
    fs.writeFileSync(
      path.join(applicationPath, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          strict: true,
          target: "ES2022",
          module: "NodeNext",
          moduleResolution: "NodeNext",
        },
        include: ["main.ts"],
      }),
    );
    fs.writeFileSync(path.join(applicationPath, "main.ts"), "export const main = 1;\n");
    for (const extension of extensions) {
      fs.writeFileSync(
        path.join(applicationPath, `example-${extension}.spec.${extension}`),
        "const specValue = 1;\n",
      );
      fs.writeFileSync(
        path.join(applicationPath, `tool-${extension}.config.${extension}`),
        "const configValue = 1;\n",
      );
      fs.writeFileSync(
        path.join(applicationPath, `client-${extension}.generated.${extension}`),
        "const generatedValue = 1;\n",
      );
    }

    const result = await scan({
      targetPath: applicationPath,
      profiles: ["typed"],
      quiet: true,
      persistHistory: false,
    });
    const scannerErrors = result.report
      .flatMap((file) => file.issues)
      .filter((issue) => issue.rule === "scanner-error");
    const generatedReports = result.report.filter((file) =>
      file.relativePath.includes(".generated."),
    );

    expect(scannerErrors).toEqual([]);
    expect(generatedReports).toHaveLength(extensions.length);
    expect(generatedReports.every((file) => file.issues.length === 0)).toBe(true);
    fs.rmSync(applicationPath, { recursive: true, force: true });
  });

  it("detects Lambda runtime, security, typed reliability, and cleanliness defects", async () => {
    const lambdaPath = fs.mkdtempSync(path.join(os.tmpdir(), "code-scanner-lambda-positive-"));
    fs.writeFileSync(
      path.join(lambdaPath, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: { strict: true, target: "ES2022", module: "ES2022" },
        include: ["**/*.ts"],
      }),
    );
    fs.writeFileSync(
      path.join(lambdaPath, "handler.ts"),
      [
        "class S3Client {}",
        "declare const process: { exit(code: number): never };",
        "declare function fetch(url: string): Promise<unknown>;",
        "declare const db: { get(key: string): void };",
        "async function persist(): Promise<void> {}",
        "export const handler = async (event: { url: string }, _context: unknown, callback: () => void) => {",
        "  const client = new S3Client();",
        "  console.log(event);",
        "  await fetch(event.url);",
        "  db.get(event.url);",
        "  persist();",
        "  const unused = client;",
        "  callback();",
        "  process.exit(1);",
        "};",
      ].join("\n"),
    );

    const result = await scan({
      targetPath: lambdaPath,
      profiles: ["lambda"],
      quiet: true,
      persistHistory: false,
    });
    const rules = result.report.flatMap((file) => file.issues.map((issue) => issue.rule));

    expect(rules).toEqual(
      expect.arrayContaining([
        "code-scanner-lambda/no-client-construction-in-handler",
        "code-scanner-lambda/no-async-callback-handler",
        "code-scanner-lambda/no-sensitive-event-logging",
        "code-scanner-lambda/no-event-derived-outbound-url",
        "code-scanner-lambda/no-process-exit-in-handler",
        "@typescript-eslint/no-floating-promises",
        "@typescript-eslint/no-unused-vars",
      ]),
    );
    expect(
      rules.filter((rule) => rule === "code-scanner-lambda/no-event-derived-outbound-url"),
    ).toHaveLength(1);
    fs.rmSync(lambdaPath, { recursive: true, force: true });
  });
});
