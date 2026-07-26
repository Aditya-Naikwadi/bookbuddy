import {
  BookOpen,
  Users,
  Library,
  Receipt,
  CreditCard,
  FileText,
  ListPlus,
  Award,
  Bookmark,
  Monitor,
  MessageSquare,
  Sparkles,
  BarChart3,
  Bell,
  HelpCircle,
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
};

export const getEnabledFeaturesList = (userEnabledIds) => {
  if (
    !userEnabledIds ||
    !Array.isArray(userEnabledIds) ||
    userEnabledIds.length === 0
  ) {
    return Object.keys(FEATURE_REGISTRY);
  }
  const enabledSet = new Set(userEnabledIds);
  // Ensure core features are always included
  Object.values(FEATURE_REGISTRY).forEach((feat) => {
    if (feat.isCore) enabledSet.add(feat.id);
  });
  return Array.from(enabledSet);
};
