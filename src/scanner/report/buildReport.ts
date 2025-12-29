import path from "path";
import { calculateCommentRatio } from "../metrics/calculateCommentRatio.js";
import { categorizeRule } from "../../../scanner.config.js";
import { calculateGrade } from "../grading/calculateGrade.js";
import type { FileReport, RuleCategories, ESLintResult, Issue, Grade } from "../types.js";

function parseRuleMessage(ruleId: string | null, message: string): string {
  if (ruleId === "sonarjs/cyclomatic-complexity" && message.startsWith("{")) {
    try {
      const parsed = JSON.parse(message);
      return parsed.message || message;
    } catch {
      return message;
    }
  }
  return message;
}

export function buildReport(eslintResults: ESLintResult[], categories: RuleCategories, targetPath: string): FileReport[] {
  const report: FileReport[] = [];

  eslintResults.forEach((result) => {
    const relativePath = path.relative(targetPath, result.filePath);
    
    // Build metrics first (without grade)
    const metrics = {
      cognitive: 0,
      cyclomatic: 0,
      security: 0,
      maintainability: 0,
      cleanliness: 0,
      commentRatio: calculateCommentRatio(result.filePath),
    };
    
    const issueMap = new Map<string, Issue>();

    result.messages.forEach((msg) => {
      if (msg.ruleId === "complexity") {
        const match = msg.message.match(/complexity of (\d+)/);
        if (match) metrics.cyclomatic = Math.max(metrics.cyclomatic, parseInt(match[1], 10));
      }

      if (msg.ruleId === "sonarjs/cognitive-complexity") {
        const match = msg.message.match(/Complexity from (\d+)/);
        if (match) metrics.cognitive = Math.max(metrics.cognitive, parseInt(match[1], 10));
      }

      const category = categorizeRule(msg.ruleId, categories);
      
      if (category === "security") {
        metrics.security++;
      } else if (category === "maintainability") {
        metrics.maintainability++;
      } else if (category === "cleanliness") {
        metrics.cleanliness++;
      }

      if (category === "security" || category === "maintainability" || category === "cleanliness") {
        const displayMessage = parseRuleMessage(msg.ruleId, msg.message);

        const key = `${msg.line}::${category}::${msg.ruleId}::${displayMessage}`;
        
        if (issueMap.has(key)) {
          issueMap.get(key)!.count++;
        } else {
          issueMap.set(key, {
            rule: msg.ruleId || "",
            category,
            line: msg.line,
            message: displayMessage,
            count: 1,
          });
        }
      }
    });

    const issues = Array.from(issueMap.values()).sort((a, b) => {
      if (a.line !== b.line) return a.line - b.line;
      return a.rule.localeCompare(b.rule);
    });

    // Calculate grade based on all metrics
    const grade: Grade = calculateGrade(metrics);

    const fileData: FileReport = {
      file: path.basename(result.filePath),
      relativePath,
      ...metrics,
      grade,
      issues,
    };

    report.push(fileData);
  });

  return report;
}
