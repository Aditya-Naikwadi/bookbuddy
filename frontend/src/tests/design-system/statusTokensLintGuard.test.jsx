import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * CI Guardrail Test: Enforces that no component re-introduces ad-hoc status badge helper
 * functions or hardcoded status badge classes outside the canonical design token files.
 */
describe("Design System Guardrail: No Rogue Status Badges", () => {
  const srcDir = path.resolve(__dirname, "../../");

  function getFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        if (!fullPath.includes("node_modules") && !fullPath.includes("tests")) {
          getFiles(fullPath, fileList);
        }
      } else if (/\.(jsx|tsx)$/.test(file)) {
        fileList.push(fullPath);
      }
    }
    return fileList;
  }

  const allComponents = getFiles(path.join(srcDir, "components")).concat(
    getFiles(path.join(srcDir, "pages")),
  );

  it("No component defines a local ad-hoc getStatusBadge function", () => {
    const violations = [];

    for (const filePath of allComponents) {
      const content = fs.readFileSync(filePath, "utf-8");
      if (
        /const\s+getStatusBadge\s*=/i.test(content) ||
        /function\s+getStatusBadge\s*\(/i.test(content)
      ) {
        violations.push(path.relative(srcDir, filePath));
      }
    }

    expect(
      violations,
      `Found ad-hoc getStatusBadge in:\n${violations.join("\n")}\nUse <StatusBadge /> instead!`,
    ).toEqual([]);
  });

  it("All status indicators use StatusBadge or StatusDot rather than ad-hoc status pills", () => {
    const violations = [];

    for (const filePath of allComponents) {
      const content = fs.readFileSync(filePath, "utf-8");
      // Detect rogue status-pill pattern: inline status switch returning ad-hoc badge colors
      if (
        /case\s+['"](active|pending|approved|rejected|fulfilled)['"]\s*:\s*return\s*['"][^'"]*bg-(blue|green|emerald|rose|amber)-\d+/i.test(
          content,
        )
      ) {
        violations.push(path.relative(srcDir, filePath));
      }
    }

    expect(
      violations,
      `Found inline status color switches in:\n${violations.join("\n")}\nUse <StatusBadge /> and statusRegistry.js instead!`,
    ).toEqual([]);
  });
});
