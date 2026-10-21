import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { isSafeRelativePath } from "../../pages/Login";
import { SectionErrorBoundary } from "../../components/common/SectionErrorBoundary";
import { OfflineBanner } from "../../components/common/OfflineBanner";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Checklist 12: Security & Checklist 13: Error Handling & Resilience", () => {
  describe("12. Security Verification", () => {
    it("1. isSafeRelativePath strictly validates login redirect target against open-redirects", () => {
      // Malicious targets that MUST be rejected
      expect(isSafeRelativePath("https://evil.com")).toBe(false);
      expect(isSafeRelativePath("http://attacker.com/steal-session")).toBe(
        false,
      );
      expect(isSafeRelativePath("//evil.com")).toBe(false);
      expect(isSafeRelativePath("//evil.com/path")).toBe(false);
      expect(isSafeRelativePath("/\\evil.com")).toBe(false);
      expect(isSafeRelativePath("\\evil.com")).toBe(false);
      expect(isSafeRelativePath("javascript:alert(document.cookie)")).toBe(
        false,
      );
      expect(
        isSafeRelativePath("data:text/html,<script>alert(1)</script>"),
      ).toBe(false);
      expect(isSafeRelativePath("vbscript:msgbox(1)")).toBe(false);
      expect(isSafeRelativePath(null)).toBe(false);
      expect(isSafeRelativePath(undefined)).toBe(false);
      expect(isSafeRelativePath(12345)).toBe(false);
      expect(isSafeRelativePath("")).toBe(false);

      // Safe internal relative routes that MUST be accepted
      expect(isSafeRelativePath("/student")).toBe(true);
      expect(isSafeRelativePath("/student/catalog")).toBe(true);
      expect(
        isSafeRelativePath("/student/catalog?bookId=64a1f2b3c4d5e6f7a8b9c0d1"),
      ).toBe(true);
      expect(isSafeRelativePath("/general-dashboard")).toBe(true);
      expect(isSafeRelativePath("/#catalog-search")).toBe(true);
    });

    it("2. Verifies vercel.json contains complete production security headers (CSP, HSTS, X-Frame-Options, etc.)", () => {
      const vercelJsonPath = path.resolve(__dirname, "../../../../vercel.json");
      const vercelConfig = JSON.parse(fs.readFileSync(vercelJsonPath, "utf-8"));

      const catchAllHeaderGroup = vercelConfig.headers.find(
        (h) => h.source === "/(.*)",
      );
      expect(catchAllHeaderGroup).toBeDefined();

      const headers = catchAllHeaderGroup.headers;
      const getHeaderVal = (key) => headers.find((h) => h.key === key)?.value;

      expect(getHeaderVal("X-Content-Type-Options")).toBe("nosniff");
      expect(getHeaderVal("X-Frame-Options")).toBe("DENY");
      expect(getHeaderVal("Strict-Transport-Security")).toContain(
        "max-age=31536000",
      );
      expect(getHeaderVal("Strict-Transport-Security")).toContain(
        "includeSubDomains",
      );
      expect(getHeaderVal("Strict-Transport-Security")).toContain("preload");
      expect(getHeaderVal("Referrer-Policy")).toBe(
        "strict-origin-when-cross-origin",
      );
      expect(getHeaderVal("Permissions-Policy")).toContain("camera=()");
      expect(getHeaderVal("Content-Security-Policy")).toContain(
        "default-src 'self'",
      );
      expect(getHeaderVal("Content-Security-Policy")).toContain(
        "frame-ancestors 'none'",
      );
    });

    it("3. Verifies backend CORS avoids wildcard and enforces strict origin checks", () => {
      const appJsPath = path.resolve(
        __dirname,
        "../../../../backend/src/app.js",
      );
      const appJsContent = fs.readFileSync(appJsPath, "utf-8");

      expect(appJsContent).not.toContain("origin: '*'");
      expect(appJsContent).not.toContain('origin: "*"');
      expect(appJsContent).toContain("allowedOrigins.includes(origin)");
      expect(appJsContent).toContain("vercelDomainRegex.test(origin)");
      expect(appJsContent).toContain("bookBuddySubdomainRegex.test(origin)");
    });
  });

  describe("13. Error Handling & Resilience Verification", () => {
    // Component that deliberately crashes for error boundary testing
    const CrashingComponent = ({ shouldThrow }) => {
      if (shouldThrow) {
        throw new Error("Simulated component explosion");
      }
      return <div data-testid="healthy-section">Section content intact</div>;
    };

    it("1. SectionErrorBoundary catches section failure without blanking the whole page", () => {
      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      const { rerender } = render(
        <div>
          <div data-testid="page-header">Main Header</div>
          <SectionErrorBoundary sectionName="Catalog Search">
            <CrashingComponent shouldThrow={true} />
          </SectionErrorBoundary>
          <div data-testid="page-footer">Main Footer</div>
        </div>,
      );

      // Parent components outside the crashing boundary remain fully intact
      expect(screen.getByTestId("page-header")).toBeInTheDocument();
      expect(screen.getByTestId("page-footer")).toBeInTheDocument();

      // Graceful error UI is presented
      expect(
        screen.getByText("Temporarily unable to load Catalog Search"),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /retry section/i }),
      ).toBeInTheDocument();

      // Clicking Retry Section resets error state
      rerender(
        <div>
          <div data-testid="page-header">Main Header</div>
          <SectionErrorBoundary sectionName="Catalog Search">
            <CrashingComponent shouldThrow={false} />
          </SectionErrorBoundary>
          <div data-testid="page-footer">Main Footer</div>
        </div>,
      );

      fireEvent.click(screen.getByRole("button", { name: /retry section/i }));
      expect(screen.getByTestId("healthy-section")).toBeInTheDocument();

      consoleWarnSpy.mockRestore();
    });

    it("2. OfflineBanner displays graceful message when browser loses connectivity", () => {
      render(<OfflineBanner />);

      // Initially online - banner should be hidden
      expect(screen.queryByText(/offline mode/i)).not.toBeInTheDocument();

      // Dispatch offline event
      act(() => {
        window.dispatchEvent(new Event("offline"));
      });

      expect(screen.getByText(/offline mode/i)).toBeInTheDocument();
      expect(
        screen.getByText(/You are currently browsing offline/i),
      ).toBeInTheDocument();

      // Dispatch online event
      act(() => {
        window.dispatchEvent(new Event("online"));
      });

      expect(screen.queryByText(/offline mode/i)).not.toBeInTheDocument();
    });

    it("3. Verifies CatalogSearch and EResources API requests include bounded timeouts", () => {
      const catalogPath = path.resolve(
        __dirname,
        "../../sections/CatalogSearch.tsx",
      );
      const eresourcesPath = path.resolve(
        __dirname,
        "../../sections/EResources.tsx",
      );

      const catalogContent = fs.readFileSync(catalogPath, "utf-8");
      const eresourcesContent = fs.readFileSync(eresourcesPath, "utf-8");

      expect(catalogContent).toContain("timeout: 8000");
      expect(eresourcesContent).toContain("timeout: 8000");
    });
  });
});
