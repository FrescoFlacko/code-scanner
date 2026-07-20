import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";
import { angularSecurityPlugin } from "./angularSecurityPlugin.js";

async function lint(code: string): Promise<string[]> {
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: [{
      files: ["**/*.js"],
      languageOptions: { ecmaVersion: "latest", sourceType: "module" },
      plugins: { angularSecurity: angularSecurityPlugin },
      rules: { "angularSecurity/no-direct-dom-html-sinks": "error" },
    }],
  });
  const [result] = await eslint.lintText(code, { filePath: "component.js" });
  return result.messages.map((message) => message.ruleId ?? "");
}

describe("Angular direct DOM sink rule", () => {
  it("reports actual DOM HTML sinks", async () => {
    const rules = await lint([
      "element.innerHTML = input;",
      "element.insertAdjacentHTML('beforeend', input);",
      "document.write(input);",
      "document.writeln(input);",
    ].join("\n"));

    expect(rules).toHaveLength(4);
    expect(new Set(rules)).toEqual(new Set(["angularSecurity/no-direct-dom-html-sinks"]));
  });

  it("does not report unrelated writer methods", async () => {
    expect(await lint([
      "writer.write('safe text');",
      "writer.writeln('safe text');",
      "response.write(body);",
      "logger.write(message);",
    ].join("\n"))).toEqual([]);
  });
});
