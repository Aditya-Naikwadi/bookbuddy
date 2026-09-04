# Developer Tooling Integrations (BookBuddy)

This repository is equipped with three complementary AI developer tooling integrations designed to streamline codebase navigation, architectural analysis, and role-specific development workflows.

---

## 1. Graft (Codebase Graph & Context Rules)

- **What it is**: A deterministic, zero-cost codebase graph and instruction layer generated locally in `.local/graft/` or `graft/`.
- **How it triggers**: 
  - **Automatic Context**: Automatically loaded into agent conversations via `AGENTS.md` and `.agents/rules/graft.md`.
  - **CLI Commands**:
    - `graft ask "<question>" --source` — Query nodes with relevant source spans inlined.
    - `graft skeleton <file>` — View signature-only API surface of a file.
    - `graft callers <symbol>` — Find exact callers or callees of a function/class.
    - `graft build` — Re-build the context graph after making major code changes ($0 cost, local).
- **What NOT to do**:
  - **Do NOT** manually read entire source files when Graft's `covers:` spans pinpoint exact line numbers.
  - **Do NOT** commit local `graft/` directory (it is git-ignored as a local cache).

---

## 2. Agency Agents (Custom Agent Personas)

- **What it is**: Specialized expert personas stored in `.agents/agents/` covering core tech divisions:
  - **Engineering**: `Frontend Developer`, `Backend Architect`, `DevOps Automator`, `Software Architect`, `Database Reliability Engineer`, `RAG Pipeline Engineer`, `Senior Developer`, `SRE`, `Technical Writer`, `Minimal Change Engineer`, `Git Workflow Master`, etc.
  - **Design**: `UI Designer`, `UX Architect`, `UX Researcher`, `Brand Guardian`, `Persona Walkthrough`, `Visual Storyteller`, `Whimsy Injector`, etc.
  - **Product**: `Product Manager`, `Sprint Prioritizer`, `Feedback Synthesizer`, `Behavioral Nudge Engine`, `Trend Researcher`.
  - **Testing**: `Test Automation Engineer`, `API Tester`, `Performance Benchmarker`, `Accessibility Auditor`, `Reality Checker`, `Evidence Collector`, etc.
  - **Security**: `AppSec Engineer`, `Security Architect`, `Cloud Security Architect`, `Penetration Tester`, `Threat Detection Engineer`, `Credential Engineer`, `SecOps`, etc.
  - **Support**: `Support Responder`, `Infrastructure Maintainer`, `Legal Compliance Checker`, `Finance Tracker`, `Analytics Reporter`, etc.

---

## 3. Codebase Memory MCP (Structural Knowledge Graph)

- **What it is**: A high-performance structural code indexer exposing 15 MCP tools over `stdio` (`codebase-memory`).
- **How it triggers**:
  - Ask structural graph questions targeting Codebase Memory MCP (e.g., *"Use codebase-memory MCP to find all callers of `getBooks`"*).
  - Call MCP tools directly: `search_code`, `query_graph`, `trace_path`, `get_architecture`, `get_code_snippet`, `index_repository`, `check_index_coverage`.

---

## Quick Reference Summary

| Tool | Primary Purpose | How to Invoke | Action Needed for Setup |
| :--- | :--- | :--- | :--- |
| **Graft** | Instant context & file line spans | Automatic (via `AGENTS.md`) or `graft ask` | None (runs automatically) |
| **Agency Agents** | Expert specialized personas | Type `/agents` or name persona | Picked personas in `.agents/agents/` |
| **Codebase Memory MCP** | Deep structural queries & call traces | Ask for graph query or call MCP tools | Initial `index_repository` run |
