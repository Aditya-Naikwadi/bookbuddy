import {
  BookOpen,
  Users,
  Library,
  Receipt,
  FileText,
  ListPlus,
  Award,
  Monitor,
  Sparkles,
  BarChart3,
  HelpCircle,
  ShoppingBag,
  Globe,
  Eye,
  HardDrive,
  TrendingUp,
  ShieldAlert,
  FileSearch,
  QrCode,
  Bot,
} from "lucide-react";

export const FEATURE_CATEGORIES = {
  CORE: {
    key: "Core",
    label: "Core Foundation",
    description:
      "Essential systems required for cataloging and patron identity.",
  },
  CONTENT: {
    key: "Content",
    label: "Library & Digital Content",
    description: "Cataloging, borrowing, e-books, and curated reading lists.",
  },
  FACILITIES: {
    key: "Facilities",
    label: "Facilities & Campus Spaces",
    description: "Lab equipment and study room reservation management.",
  },
  FINANCIALS: {
    key: "Financials",
    label: "Financials & Ledgers",
    description: "Late return fines, fee structures, and collection ledgers.",
  },
  ENGAGEMENT: {
    key: "Engagement",
    label: "Student Engagement",
    description: "Gamified reading streaks, achievements, and recommendations.",
  },
  COMMUNICATION: {
    key: "Communication",
    label: "Communication & Support",
    description: "Support helpdesk, ticketing, and campus announcements.",
  },
};

export const FEATURE_REGISTRY = {
  catalog: {
    id: "catalog",
    name: "Books Catalog & Search",
    category: FEATURE_CATEGORIES.CORE.key,
    description:
      "Centralized cataloging for physical books, ISBN lookup, and inventory search.",
    icon: BookOpen,
    isCore: true,
    requires: [],
  },
  patrons: {
    id: "patrons",
    name: "Patron Management & Digital ID",
    category: FEATURE_CATEGORIES.CORE.key,
    description:
      "Digital patron membership cards, roll number verification, and student profiles.",
    icon: Users,
    isCore: true,
    requires: [],
  },
  loans: {
    id: "loans",
    name: "Circulation & Borrowing",
    category: FEATURE_CATEGORIES.CONTENT.key,
    description:
      "Track book checkouts, return queues, renewals, and due-date ledgers.",
    icon: Library,
    isCore: false,
    requires: ["catalog", "patrons"],
  },
  "e-resources": {
    id: "e-resources",
    name: "Digital E-Resources & E-Books",
    category: FEATURE_CATEGORIES.CONTENT.key,
    description:
      "Provide digital PDFs, research papers, and embedded e-pub reader access.",
    icon: FileText,
    isCore: false,
    requires: [],
  },
  "reading-lists": {
    id: "reading-lists",
    name: "Curated Reading Lists",
    category: FEATURE_CATEGORIES.CONTENT.key,
    description:
      "Allow faculty and librarians to build subject reading lists and course syllabus books.",
    icon: ListPlus,
    isCore: false,
    requires: ["catalog"],
  },
  facilities: {
    id: "facilities",
    name: "Lab & Study Room Reservations",
    category: FEATURE_CATEGORIES.FACILITIES.key,
    description:
      "Let students reserve computer lab seats, quiet study desks, and equipment slots.",
    icon: Monitor,
    isCore: false,
    requires: [],
  },
  fines: {
    id: "fines",
    name: "Fine Management & Fee Ledgers",
    category: FEATURE_CATEGORIES.FINANCIALS.key,
    description:
      "Automated daily overdue fine calculation, payment status, and fee waivers.",
    icon: Receipt,
    isCore: false,
    requires: ["loans"],
  },
  gamification: {
    id: "gamification",
    name: "Reading Streaks & Gamification",
    category: FEATURE_CATEGORIES.ENGAGEMENT.key,
    description:
      "Reward students with badges, reading streaks, and milestone achievements.",
    icon: Award,
    isCore: false,
    requires: [],
  },
  leaderboards: {
    id: "leaderboards",
    name: "Campus Leaderboards",
    category: FEATURE_CATEGORIES.ENGAGEMENT.key,
    description:
      "Display top student readers and department-wide reading leaderboard rankings.",
    icon: Sparkles,
    isCore: false,
    requires: ["gamification"],
  },
  support: {
    id: "support",
    name: "Helpdesk & Ticket System",
    category: FEATURE_CATEGORIES.COMMUNICATION.key,
    description:
      "Manage student inquiries, lost book reporting, and librarian support tickets.",
    icon: HelpCircle,
    isCore: false,
    requires: [],
  },
  analytics: {
    id: "analytics",
    name: "Circulation Analytics & Reports",
    category: FEATURE_CATEGORIES.COMMUNICATION.key,
    description:
      "Export circulation statistics, peak library usage hours, and monthly reports.",
    icon: BarChart3,
    isCore: false,
    requires: [],
  },
  acquisitions: {
    id: "acquisitions",
    name: "Acquisitions & Serials Procurement",
    category: FEATURE_CATEGORIES.FINANCIALS.key,
    description:
      "Purchase orders, vendor invoice management, budget code allocation, and receiving workflows.",
    icon: ShoppingBag,
    isCore: false,
    requires: [],
  },
  "student.shelves": {
    id: "student.shelves",
    name: "Custom Student Bookshelves",
    category: FEATURE_CATEGORIES.CONTENT.key,
    description:
      "Allow students to build and organize custom book collections.",
    icon: ListPlus,
    isCore: false,
    requires: [],
  },
  "student.bookRequests": {
    id: "student.bookRequests",
    name: "Book Acquisition Requests",
    category: FEATURE_CATEGORIES.CONTENT.key,
    description:
      "Let students request new physical/digital titles for library addition.",
    icon: BookOpen,
    isCore: false,
    requires: [],
  },
  "student.itemReports": {
    id: "student.itemReports",
    name: "Lost / Damaged Item Reporting",
    category: FEATURE_CATEGORIES.COMMUNICATION.key,
    description:
      "Direct student self-service reporting for damaged or missing loans.",
    icon: HelpCircle,
    isCore: false,
    requires: [],
  },
  "student.renewal": {
    id: "student.renewal",
    name: "Self-Service Book Renewals",
    category: FEATURE_CATEGORIES.CONTENT.key,
    description:
      "Enable online loan extensions with real-time hold queue checks.",
    icon: Library,
    isCore: false,
    requires: [],
  },
  "student.notificationPrefs": {
    id: "student.notificationPrefs",
    name: "Notification Preferences Panel",
    category: FEATURE_CATEGORIES.COMMUNICATION.key,
    description: "Student control over email, push, and in-app alert channels.",
    icon: HelpCircle,
    isCore: false,
    requires: [],
  },
  "student.finePayment": {
    id: "student.finePayment",
    name: "Online Fine Payment Gateway",
    category: FEATURE_CATEGORIES.FINANCIALS.key,
    description: "Seamless online clearing of overdue library fines.",
    icon: Receipt,
    isCore: false,
    requires: [],
  },
  "student.stats": {
    id: "student.stats",
    name: "Personal Reading Analytics",
    category: FEATURE_CATEGORIES.ENGAGEMENT.key,
    description: "Visual charts for reading history and checkout velocity.",
    icon: BarChart3,
    isCore: false,
    requires: [],
  },
  "student.digitalCard": {
    id: "student.digitalCard",
    name: "Digital Patron QR Library Card",
    category: FEATURE_CATEGORIES.CORE.key,
    description: "Time-bound signed QR code for instant scanner check-ins.",
    icon: Users,
    isCore: false,
    requires: [],
  },
  "vernacular-i18n": {
    id: "vernacular-i18n",
    name: "Vernacular i18n Localization",
    category: FEATURE_CATEGORIES.COMMUNICATION.key,
    description:
      "Multilingual interface supporting Hindi (hi) and Marathi (mr) alongside English and Spanish.",
    icon: Globe,
    isCore: false,
    requires: [],
  },
  "accessibility-mode": {
    id: "accessibility-mode",
    name: "Accessibility & Assistive Mode",
    category: FEATURE_CATEGORIES.CORE.key,
    description:
      "High-contrast tokens, dyslexia-friendly typography, and Web Speech text-to-speech audio reader.",
    icon: Eye,
    isCore: false,
    requires: [],
  },
  "offline-sync": {
    id: "offline-sync",
    name: "Offline-First Queue & Sync",
    category: FEATURE_CATEGORIES.CONTENT.key,
    description:
      "IndexedDB client action queuing with automatic idempotent replay and conflict resolution.",
    icon: HardDrive,
    isCore: false,
    requires: [],
  },
  "reading-debt-nudges": {
    id: "reading-debt-nudges",
    name: "Reading Debt Nudges & Skill Badges",
    category: FEATURE_CATEGORIES.ENGAGEMENT.key,
    description:
      "Constructive non-punitive nudges and milestone skill badges built on loans, fines, and reading streaks.",
    icon: Award,
    isCore: false,
    requires: ["loans"],
  },
  "predictive-alerts": {
    id: "predictive-alerts",
    name: "Predictive Stock-Out Alerts",
    category: FEATURE_CATEGORIES.CONTENT.key,
    description:
      "Automated stock-out warnings powered by borrowing velocity from daily metric snapshots.",
    icon: TrendingUp,
    isCore: false,
    requires: ["catalog", "loans"],
  },
  "analytics-expansion": {
    id: "analytics-expansion",
    name: "Advanced Analytics & Daily Snapshots",
    category: FEATURE_CATEGORIES.COMMUNICATION.key,
    description:
      "Circulation velocity, fine collection, and campus utilization metrics with streamed CSV exports.",
    icon: BarChart3,
    isCore: false,
    requires: ["loans"],
  },
  "anomaly-detection": {
    id: "anomaly-detection",
    name: "Security Anomaly Detection",
    category: FEATURE_CATEGORIES.CORE.key,
    description:
      "Automated threshold audits for impersonation bursts, off-hours admin actions, and fee waivers.",
    icon: ShieldAlert,
    isCore: false,
    requires: [],
  },
  "syllabus-scanner": {
    id: "syllabus-scanner",
    name: "Syllabus Course Scanner",
    category: FEATURE_CATEGORIES.FINANCIALS.key,
    description:
      "Client-side Web Worker OCR scanner for course syllabus ISBN extraction and acquisitions reconciliation.",
    icon: FileSearch,
    isCore: false,
    requires: ["acquisitions"],
  },
  "qr-shelf-nav": {
    id: "qr-shelf-nav",
    name: "QR Physical Shelf Navigation",
    category: FEATURE_CATEGORIES.CONTENT.key,
    description:
      "Printable QR codes deep-linking physical library stacks to tenant catalog shelf locations.",
    icon: QrCode,
    isCore: false,
    requires: ["catalog"],
  },
  "rag-ask-this-book": {
    id: "rag-ask-this-book",
    name: "Ask This Book RAG Gateway",
    category: FEATURE_CATEGORIES.CONTENT.key,
    description:
      "Retrieval-augmented grounding architecture for public-domain books with exact citation spans.",
    icon: Bot,
    isCore: false,
    requires: ["e-resources"],
  },
};

export const getEnabledFeaturesList = (userEnabledIds) => {
  if (
    !userEnabledIds ||
    !Array.isArray(userEnabledIds) ||
    userEnabledIds.length === 0
  ) {
    return Object.values(FEATURE_REGISTRY)
      .filter((feat) => feat.isCore)
      .map((feat) => feat.id);
  }
  const enabledSet = new Set(userEnabledIds);
  // Ensure core features are always included
  Object.values(FEATURE_REGISTRY).forEach((feat) => {
    if (feat.isCore) enabledSet.add(feat.id);
  });
  return Array.from(enabledSet);
};
