// Single source of truth mapping feature-flag keys to page vs embedded definitions
export const FEATURE_REGISTRY = {
  catalog: {
    type: "page",
    label: "Catalog & Search",
    icon: "Search",
    route: "/catalog",
  },
  loans: {
    type: "page",
    label: "My Borrowing",
    icon: "Library",
    route: "/loans",
  },
  fines: {
    type: "page",
    label: "Fines & Dues",
    icon: "Receipt",
    route: "/fines",
  },
  finePayments: {
    type: "page",
    label: "Fines & Dues",
    icon: "Receipt",
    route: "/fines",
  },
  "patron-card": {
    type: "page",
    label: "Patron Card",
    icon: "CreditCard",
    route: "/patron-card",
  },
  patronCard: {
    type: "page",
    label: "Patron Card",
    icon: "CreditCard",
    route: "/patron-card",
  },
  "e-resources": {
    type: "page",
    label: "E-Resources",
    icon: "FileText",
    route: "/e-resources",
  },
  eResources: {
    type: "page",
    label: "E-Resources",
    icon: "FileText",
    route: "/e-resources",
  },
  "reading-lists": {
    type: "page",
    label: "Reading Lists",
    icon: "ListPlus",
    route: "/reading-lists",
  },
  readingLists: {
    type: "page",
    label: "My Shelves",
    icon: "Bookmark",
    route: "/shelves",
  },
  reviews: { type: "page", label: "Reviews", icon: "Star", route: "/reviews" },
  bulletinBoard: {
    type: "page",
    label: "Campus Feed",
    icon: "Megaphone",
    route: "/feed",
  },
  crossCollegeILL: {
    type: "page",
    label: "Inter-College",
    icon: "Share2",
    route: "/cross-college",
  },
  helpCenter: {
    type: "page",
    label: "Help & Support",
    icon: "HelpCircle",
    route: "/support",
  },
  support: {
    type: "page",
    label: "Help & Support",
    icon: "MessageSquare",
    route: "/support",
  },
  facilities: {
    type: "page",
    label: "Lab Booking",
    icon: "Monitor",
    route: "/lab-booking",
  },
  labBooking: {
    type: "page",
    label: "Lab Booking",
    icon: "Monitor",
    route: "/lab-booking",
  },
  gamification: {
    type: "page",
    label: "Achievements",
    icon: "Award",
    route: "/achievements",
  },
  badgesLeaderboard: {
    type: "page",
    label: "Leaderboard",
    icon: "Trophy",
    route: "/achievements",
  },
  saved: {
    type: "page",
    label: "Saved Bookmarks",
    icon: "Bookmark",
    route: "/saved",
  },
  offlineDownload: {
    type: "page",
    label: "Downloads",
    icon: "Download",
    route: "/downloads",
  },
  downloads: {
    type: "page",
    label: "Downloads",
    icon: "Download",
    route: "/downloads",
  },
  recommendations: { type: "embedded" },
  notifyMe: { type: "embedded" },
  eReaderSync: { type: "embedded" },
  "vernacular-i18n": { type: "embedded" },
  "accessibility-mode": { type: "embedded" },
  "reading-debt-nudges": { type: "embedded" },
  "offline-sync": {
    type: "page",
    label: "Offline Sync",
    icon: "HardDrive",
    route: "/student/offline-sync",
  },
  "predictive-alerts": {
    type: "page",
    label: "Predictive Alerts",
    icon: "TrendingUp",
    route: "/college-admin/predictive-alerts",
  },
  "analytics-expansion": {
    type: "page",
    label: "Advanced Analytics",
    icon: "BarChart3",
    route: "/college-admin/analytics-expansion",
  },
  "anomaly-detection": {
    type: "page",
    label: "Anomaly Detection",
    icon: "ShieldAlert",
    route: "/college-admin/anomaly-detection",
  },
  "syllabus-scanner": {
    type: "page",
    label: "Syllabus Scanner",
    icon: "FileSearch",
    route: "/college-admin/syllabus-scanner",
  },
  "qr-shelf-nav": {
    type: "page",
    label: "QR Shelf Navigation",
    icon: "QrCode",
    route: "/college-admin/qr-shelf-nav",
  },
  "rag-ask-this-book": {
    type: "page",
    label: "Ask This Book",
    icon: "Bot",
    route: "/student/ask-this-book",
  },
};

export const getPageTypeFeatures = () => {
  const pageFeatures = {};
  Object.entries(FEATURE_REGISTRY).forEach(([key, spec]) => {
    if (spec.type === "page") {
      pageFeatures[key] = spec;
    }
  });
  return pageFeatures;
};
