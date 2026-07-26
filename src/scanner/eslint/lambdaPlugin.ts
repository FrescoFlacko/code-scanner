import type { ESLint, Rule } from "eslint";

type NamedNode = Rule.Node & { id?: { name?: string }; async?: boolean; params?: unknown[] };
type CallNode = Rule.Node & { callee: unknown; arguments: Rule.Node[] };
type NewNode = Rule.Node & { callee: unknown };
type Member = {
  type?: string;
  object?: unknown;
  property?: { type?: string; name?: string; value?: unknown };
  computed?: boolean;
};
type VariableDeclarator = Rule.Node & { id?: unknown; init?: unknown };
type AssignmentExpression = Rule.Node & { left?: unknown; right?: unknown };

function identifierName(value: unknown): string | null {
  const identifier = value as { type?: string; name?: string } | null;
  return identifier?.type === "Identifier" ? (identifier.name ?? null) : null;
}

function memberName(value: unknown): string | null {
  const member = value as Member | null;
  if (!member || member.type !== "MemberExpression") return null;
  if (!member.computed) return member.property?.name ?? null;
  return typeof member.property?.value === "string" ? member.property.value : null;
}

function isCommonJsHandlerExport(value: unknown): boolean {
  const member = value as Member | null;
  if (memberName(member) !== "handler") return false;
  if (identifierName(member?.object) === "exports") return true;

  const object = member?.object as Member | null;
  return memberName(object) === "exports" && identifierName(object?.object) === "module";
}

function isHandler(node: Rule.Node, context: Rule.RuleContext): boolean {
  const named = node as NamedNode;
  if (named.id?.name === "handler") return true;

  const parent = context.sourceCode.getAncestors(node).at(-1);
  if (parent?.type === "VariableDeclarator") {
    const variable = parent as VariableDeclarator;
    return variable.init === node && identifierName(variable.id) === "handler";
  }
  if (parent?.type === "AssignmentExpression") {
    const assignment = parent as AssignmentExpression;
    return assignment.right === node && isCommonJsHandlerExport(assignment.left);
  }
  return false;
}

function isInsideHandler(node: Rule.Node, context: Rule.RuleContext): boolean {
  return context.sourceCode
    .getAncestors(node)
    .some(
      (ancestor) =>
        ["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"].includes(
          ancestor.type,
        ) && isHandler(ancestor as unknown as Rule.Node, context),
    );
}

const clientInHandler: Rule.RuleModule = {
  meta: {
    type: "suggestion",
    docs: { description: "Create reusable service clients outside Lambda handlers" },
    schema: [],
    messages: {
      clientInHandler:
        "Create this service client outside the Lambda handler so warm invocations can reuse it.",
    },
  },
  create(context) {
    return {
      NewExpression(node: Rule.Node) {
        const name = identifierName((node as NewNode).callee);
        if (name?.endsWith("Client") && isInsideHandler(node, context)) {
          context.report({ node, messageId: "clientInHandler" });
        }
      },
    };
  },
};

const asyncCallbackHandler: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: { description: "Do not mix async Lambda handlers with callback completion" },
    schema: [],
    messages: {
      mixedCompletion:
        "This async Lambda handler also declares a callback parameter; use one completion model.",
    },
  },
  create(context) {
    function check(node: Rule.Node): void {
      const fn = node as NamedNode;
      if (fn.async && (fn.params?.length ?? 0) >= 3 && isHandler(node, context)) {
        context.report({ node, messageId: "mixedCompletion" });
      }
    }
    return {
      FunctionDeclaration: check,
      FunctionExpression: check,
      ArrowFunctionExpression: check,
    };
  },
};

const sensitiveEventLogging: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: { description: "Review logging of complete Lambda event or request objects" },
    schema: [],
    messages: {
      sensitiveLog:
        "Review logging of this event/request value; it may contain credentials or personal data.",
    },
  },
  create(context) {
    return {
      CallExpression(node: Rule.Node) {
        const call = node as CallNode;
        const callee = call.callee as Member;
        if (identifierName(callee.object) !== "console") return;
        if (!["log", "info", "warn", "error", "debug"].includes(memberName(callee) ?? "")) return;
        const sensitive = call.arguments.some(
          (argument) =>
            /^(event|request|record)$/.test(identifierName(argument) ?? "") ||
            /\b(event|request|record)\.(body|headers|authorization|token|password|records?)\b/i.test(
              context.sourceCode.getText(argument),
            ),
        );
        if (sensitive) context.report({ node, messageId: "sensitiveLog" });
      },
    };
  },
};

const eventDerivedUrl: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: { description: "Review outbound URLs derived directly from Lambda events" },
    schema: [],
    messages: { eventUrl: "Validate and allowlist event-derived outbound URLs to prevent SSRF." },
  },
  create(context) {
    return {
      CallExpression(node: Rule.Node) {
        const call = node as CallNode;
        const directCall = identifierName(call.callee);
        const member = call.callee as Member;
        const method = memberName(member);
        const client = identifierName(member.object);
        const isHttpCall =
          directCall === "fetch" ||
          (["axios", "http", "https"].includes(client ?? "") &&
            ["get", "post", "request"].includes(method ?? ""));
        if (!isHttpCall || call.arguments.length === 0) return;
        if (/\b(event|request)\b/.test(context.sourceCode.getText(call.arguments[0]))) {
          context.report({ node, messageId: "eventUrl" });
        }
      },
    };
  },
};

const processExit: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: { description: "Do not terminate the shared Lambda runtime process" },
    schema: [],
    messages: {
      processExit:
        "Do not call process.exit() in a Lambda handler; throw or return an error instead.",
    },
  },
  create(context) {
    return {
      CallExpression(node: Rule.Node) {
        const call = node as CallNode;
        const callee = call.callee as Member;
        if (
          identifierName(callee.object) === "process" &&
          memberName(callee) === "exit" &&
          isInsideHandler(node, context)
        ) {
          context.report({ node, messageId: "processExit" });
        }
      },
    };
  },
};

export const lambdaPlugin: ESLint.Plugin = {
  meta: { name: "code-scanner-lambda", version: "1.0.0" },
  rules: {
    "no-client-construction-in-handler": clientInHandler,
    "no-async-callback-handler": asyncCallbackHandler,
    "no-sensitive-event-logging": sensitiveEventLogging,
    "no-event-derived-outbound-url": eventDerivedUrl,
    "no-process-exit-in-handler": processExit,
  },
};
