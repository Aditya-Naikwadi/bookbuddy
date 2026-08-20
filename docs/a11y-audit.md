# Accessibility Audit & Prioritized Remediation Roadmap (WCAG 2.1 AA)

## Executive Summary
This document provides a prioritized accessibility audit across all general dashboard pages of the BookBuddy system, scoping **F8.4 (Keyboard Navigation & Focus Control)** and **F8.5 (Contrast & ARIA Labeling Pass)**.

---

## 1. Priority 1 — Keyboard Navigation & Focus Control (F8.4 Scope)
> **Impact**: Critical — Keyboard traps block assistive technology users completely from submitting or exiting overlays.

### Findings & Actions
1. **Global Focus Ring Visual Indicators**:
   - *Issue*: Custom buttons and glassmorphism interactive elements lacked clear high-contrast focus rings when tabbed into.
   - *Fix*: Apply `:focus-visible { outline: 2px solid #6366f1; outline-offset: 2px; }` globally in `index.css`.
2. **Modal Escape Key & Focus Trap**:
   - *Issue*: Overlay modals (e.g., Feed Creation Modal, Book Details Modal) did not close when pressing `Escape` or retain focus inside the dialog.
   - *Fix*: Add `keydown` event listener for `Escape` key close and trap focus using `Tab` key cycling inside active modals.
3. **Interactive Control Accessibility**:
   - *Issue*: Clickable `<div>` or `<span>` cards without `tabIndex={0}` or `onKeyDown` handlers could not be triggered via keyboard `Enter` / `Space`.
   - *Fix*: Add `tabIndex={0}` and keyboard trigger handlers to interactive card elements.

---

## 2. Priority 2 — Color Contrast Pass (F8.5 Scope)
> **Impact**: High — Low-contrast text on dark backgrounds causes severe readability issues for visually impaired users.

### Findings & Actions
1. **Body & Muted Text Contrast**:
   - *Issue*: Tailwind text utilities `text-slate-500` (ratio 2.8:1) and `text-slate-600` (ratio 2.1:1) on dark background `bg-slate-950` fail the WCAG AA minimum 4.5:1 contrast requirement.
   - *Fix*: Upgrade body muted text to `text-slate-300` (ratio 7.2:1) or `text-slate-400` (ratio 4.8:1).
2. **Button & Pill Text Contrast**:
   - *Issue*: Low-contrast indigo/purple text on dark tinted badges.
   - *Fix*: Increase text brightness (e.g., `text-indigo-300` on `bg-indigo-950`).

---

## 3. Priority 3 — ARIA Labeling & Roles (F8.5 Scope)
> **Impact**: Medium — Screen readers cannot announce the function of icon-only buttons or status changes without ARIA labels.

### Findings & Actions
1. **Icon-Only Buttons**:
   - *Issue*: Close buttons (`X`), search buttons (`Search`), theme toggles, and trash icons lack text descriptions for screen readers.
   - *Fix*: Add `aria-label="Close modal"`, `aria-label="Search catalog"`, `aria-label="Delete offline download"`.
2. **Interactive Toggles & Modals**:
   - *Issue*: Filter dropdowns and collapsible sidebars lack `aria-expanded` and `aria-haspopup`.
   - *Fix*: Add `aria-expanded={isOpen}` and `aria-haspopup="true"`.
3. **Decorative Icons**:
   - *Issue*: Lucide SVG icons announced as empty focusable elements.
   - *Fix*: Add `aria-hidden="true"` to decorative icons.

---

## 4. Priority 4 — Focus Order & Structural Landmarks
> **Impact**: Low/Medium — Ensures logical reading order and landmarks for navigation.

### Findings & Actions
- Ensure main content containers use `<main id="main-content">`, headers use `<header>`, and sidebars use `<nav aria-label="Main Navigation">`.
