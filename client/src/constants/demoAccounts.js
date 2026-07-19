/**
 * Centralized Demo Account Credentials for Manual Testing, Cypress/Playwright E2E Tests, and UI Testing
 */
export const DEMO_ACCOUNTS = [
  {
    role: 'Student',
    roleKey: 'student',
    studentId: 'STU1001',
    email: 'student@bookbuddy.com',
    password: 'Demo@123',
    dashboardRoute: '/student-dashboard',
    description: 'Access to catalog, book reservations, loan tracking, e-resources, reading lists, lab bookings, achievements & streak system.'
  },
  {
    role: 'General User',
    roleKey: 'general',
    studentId: 'GEN4001',
    email: 'general@bookbuddy.com',
    password: 'Demo@123',
    dashboardRoute: '/general-dashboard',
    description: 'Access to public search, e-resources, saved bookmarks, and general library catalog features.'
  },
  {
    role: 'College Admin',
    roleKey: 'college-admin',
    studentId: 'COL3001',
    email: 'collegeadmin@bookbuddy.com',
    password: 'Demo@123',
    dashboardRoute: '/college-admin',
    description: 'Access to patron management, circulation desk, cataloging, digital assets, inventory, finances, facilities, and analytics.'
  },
  {
    role: 'Super Admin',
    roleKey: 'super-admin',
    studentId: 'LIB2001',
    email: 'admin@bookbuddy.com',
    password: 'Demo@123',
    dashboardRoute: '/admin-portal',
    description: 'Access to system-wide overview, college admin management, global content moderation, audit logs, and system settings.'
  }
];

export default DEMO_ACCOUNTS;
