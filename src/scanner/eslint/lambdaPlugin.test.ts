import { ESLint, type Linter } from "eslint";
import { describe, expect, it } from "vitest";
import { lambdaPlugin } from "./lambdaPlugin.js";

const handlerRules: Linter.RulesRecord = {
  "lambda/no-client-construction-in-handler": "error",
  "lambda/no-async-callback-handler": "error",
  "lambda/no-process-exit-in-handler": "error",
};

async function lint(code: string): Promise<string[]> {
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ["**/*.js"],
        languageOptions: { ecmaVersion: "latest", sourceType: "module" },
        plugins: { lambda: lambdaPlugin },
        rules: handlerRules,
      },
    ],
  });
  const [result] = await eslint.lintText(code, { filePath: "handler.js" });
  return result.messages.map((message) => message.ruleId ?? "");
}

describe("Lambda handler rules", () => {
  it.each([
    "exports.handler = async (event, context, callback) => { new S3Client(); process.exit(1); };",
    "module.exports.handler = async function (event, context, callback) { new S3Client(); process.exit(1); };",
    "exports['handler'] = async (event, context, callback) => { new S3Client(); process.exit(1); };",
  ])("recognizes CommonJS handler exports", async (code) => {
    expect(await lint(code)).toEqual(
      expect.arrayContaining([
        "lambda/no-client-construction-in-handler",
        "lambda/no-async-callback-handler",
        "lambda/no-process-exit-in-handler",
      ]),
    );
  });

  it.each([
    "export const handler = async (event, context, callback) => { new S3Client(); process.exit(1); };",
    "export async function handler(event, context, callback) { new SQSClient(); process.exit(1); }",
  ])("continues to recognize ESM handler variables and declarations", async (code) => {
    expect(await lint(code)).toEqual(
      expect.arrayContaining([
        "lambda/no-client-construction-in-handler",
        "lambda/no-async-callback-handler",
        "lambda/no-process-exit-in-handler",
      ]),
    );
  });

  it("does not treat unrelated exports or nested functions as handlers", async () => {
    expect(
      await lint(
        [
          "exports.worker = async (event, context, callback) => { new S3Client(); process.exit(1); };",
          "export const handler = () => {",
          "  async function helper(first, second, third) { return [first, second, third]; }",
          "  return helper(1, 2, 3);",
          "};",
        ].join("\n"),
      ),
    ).toEqual([]);
  });
});
