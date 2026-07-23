/**
 * Centralized Demo Account Credentials for Backend Integration Tests, Unit Tests, and Database Seeding
 */
const DEMO_ACCOUNTS = [
  {
    studentId: 'STU1001',
    name: 'Demo Student',
    email: 'student@bookbuddy.com',
    password: 'Demo@123',
    role: 'student',
    major: 'Computer Science',
    dashboardRoute: '/student-dashboard',
  },
  {
    studentId: 'GEN4001',
    name: 'General User',
    email: 'general@bookbuddy.com',
    password: 'Demo@123',
    role: 'general',
    dashboardRoute: '/general-dashboard',
  },
  {
    studentId: 'COL3001',
    name: 'College Admin',
    email: 'collegeadmin@bookbuddy.com',
    password: 'Demo@123',
    role: 'college-admin',
    dashboardRoute: '/college-admin',
  },
  {
    studentId: 'LIB2001',
    name: 'Super Admin',
    email: 'SuperAdmin@bookbuddy.com',
    password: 'superadmin',
    role: 'super-admin',
    dashboardRoute: '/admin-portal',
  },
];

module.exports = DEMO_ACCOUNTS;
