import type { ESLint, Rule } from "eslint";

type Member = { object: unknown; property: { name?: string }; computed?: boolean };
type Call = {
  callee: unknown;
  arguments: Array<{ type?: string; value?: unknown; name?: string }>;
};
type Assignment = { left: unknown };

function memberName(value: unknown): string | null {
  const member = value as Member | null;
  return member && typeof member === "object" && member.property && !member.computed
    ? (member.property.name ?? null)
    : null;
}

function identifierName(value: unknown): string | null {
  const identifier = value as { type?: string; name?: string } | null;
  return identifier?.type === "Identifier" ? (identifier.name ?? null) : null;
}

const directDomSinks: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: { description: "Review direct DOM HTML sinks that bypass Angular template sanitization" },
    schema: [],
    messages: {
      unsafeDomSink:
        "Review this direct DOM HTML sink and sanitize untrusted values before assignment.",
    },
  },
  create(context) {
    return {
      AssignmentExpression(node: Rule.Node) {
        const property = memberName((node as unknown as Assignment).left);
        if (["innerHTML", "outerHTML", "srcdoc"].includes(property ?? "")) {
          context.report({ node, messageId: "unsafeDomSink" });
        }
      },
      CallExpression(node: Rule.Node) {
        const callee = (node as unknown as Call).callee;
        const property = memberName(callee);
        const receiver = (callee as Member | null)?.object;
        const isDocumentWrite =
          ["write", "writeln"].includes(property ?? "") && identifierName(receiver) === "document";
        if (property === "insertAdjacentHTML" || isDocumentWrite) {
          context.report({ node, messageId: "unsafeDomSink" });
        }
      },
    };
  },
};

const disabledXsrf: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: { description: "Review explicit disabling of Angular HttpClient XSRF protection" },
    schema: [],
    messages: {
      disabledXsrf:
        "Angular XSRF protection is explicitly disabled; verify the server and client threat model.",
    },
  },
  create(context) {
    return {
      CallExpression(node: Rule.Node) {
        const callee = (node as unknown as Call).callee;
        if (
          identifierName(callee) === "withNoXsrfProtection" ||
          memberName(callee) === "withNoXsrfProtection"
        ) {
          context.report({ node, messageId: "disabledXsrf" });
        }
      },
    };
  },
};

const sensitiveBrowserStorage: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: { description: "Review credential-like values persisted in browser storage" },
    schema: [],
    messages: {
      sensitiveStorage:
        "Review storage of authentication or credential-like data in browser storage.",
    },
  },
  create(context) {
    return {
      CallExpression(node: Rule.Node) {
        const call = node as unknown as Call;
        if (memberName(call.callee) !== "setItem") return;
        const member = call.callee as Member;
        const storage = identifierName(member.object);
        if (storage !== "localStorage" && storage !== "sessionStorage") return;
        const key = call.arguments[0];
        const keyText = typeof key?.value === "string" ? key.value : (key?.name ?? "");
        if (/token|auth|session|secret|jwt|credential/i.test(keyText)) {
          context.report({ node, messageId: "sensitiveStorage" });
        }
      },
    };
  },
};

export const angularSecurityPlugin: ESLint.Plugin = {
  meta: { name: "code-scanner-angular-security", version: "1.0.0" },
  rules: {
    "no-direct-dom-html-sinks": directDomSinks,
    "no-disabled-xsrf-protection": disabledXsrf,
    "no-sensitive-browser-storage": sensitiveBrowserStorage,
  },
};
