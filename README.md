# BookBuddy

BookBuddy is a comprehensive, multi-tenant library management and student engagement platform. It features distinct role-based portals for Super Admins, College Admins, and Students, alongside a general discovery interface. 

## 🚀 Features

### 🎓 Student Dashboard
* **Extensive Catalog & Search:** Discover physical and digital resources.
* **Loans & Fines Management:** Track borrowed items, due dates, and pending fines.
* **Digital Patron Card:** A virtual card for easy identification and circulation.
* **E-Resources & Ebook Reader:** Access and read digital content directly within the platform.
* **Personalized Experience:** Reading lists, saved bookmarks, and AI-driven recommendations.
* **Facilities Management:** Book labs and other campus facilities.
* **Gamification:** Earn streaks and stickers for reading milestones.
* **Support System:** Submit feedback, file complaints, and make book suggestions.

### 🏛️ College Admin Portal
* **Patron Management:** Oversee student and staff accounts.
* **Circulation & Cataloging:** Manage the core operations of lending and adding resources.
* **Digital Assets & Inventory:** Keep track of physical and digital inventory.
* **Finances:** Handle fines, fees, and financial reporting.
* **Facilities & Helpdesk:** Manage lab bookings and respond to student support tickets.
* **Analytics:** Gain insights through comprehensive dashboards and reports.
* **System Configuration:** Customize settings for the specific college or library.

### 🌐 Admin Portal (Super Admin)
* **System Overview:** High-level metrics across all registered colleges and institutions.
* **College Admin Manager:** Onboard and manage college administrative accounts.
* **Global Content Moderation:** Ensure platform safety and appropriate content.
* **Audit Logs:** Track system-wide activities for security and compliance.
* **System Settings:** Global configurations for the BookBuddy platform.

## 🛠️ Technology Stack

BookBuddy is built using a modern, scalable, and high-performance stack:

### 💻 Frontend
* **Core Framework:** React 19
* **Build Tooling:** Vite
* **Styling & Design:** Tailwind CSS v4
* **State Management:** Zustand (lightweight global client state)
* **Data Fetching & Caching:** TanStack React Query v5
* **Routing:** React Router v7
* **Form Validation:** React Hook Form & Zod
* **Animations & UX:** Framer Motion (for smooth micro-interactions) & Lenis (for smooth scrolling)
* **Real-time WebSockets:** Socket.io Client (chat and notifications)
* **Ebook Engine:** Epub.js (digital ebook reader integration)

### ⚙️ Backend & Database
* **Runtime & Web Framework:** Node.js & Express.js (RESTful APIs)
* **Real-time Engine:** Socket.io (bi-directional client-server connection)
* **Database & ODM:** MongoDB & Mongoose
* **Security & Auth:** JSON Web Tokens (JWT) & Bcrypt
* **Request Validation:** Zod schema validation
* **Caching:** Node-Cache (in-memory caching)
* **Background Tasks:** Node-Cron (scheduling for fine calculations and reminders)

### ☁️ Hosting & Infrastructure
* **Frontend Hosting:** Vercel
* **API Server Hosting:** Render / custom Node hosting
* **Database Hosting:** MongoDB Atlas

---

## 🚀 Backend Architecture Summary
The backend follows a tenant-scoped multi-layered architectural pattern:
* **Routes & Controller Layer**: Receives HTTP requests, executes strict Input Validation (via Zod), verifies credentials and authorization roles (via Auth middleware), scopes queries based on `collegeId` (via ScopeToTenant middleware), and logs successful admin mutations (via AuditLog middleware).
* **Service Layer**: Implements core business rules (e.g. Loan calculations, Hold Queue promotions, Streak checks, and Notifications) in isolation from transport mechanisms.
* **Database Model Layer**: Manages data mapping (Mongoose) with optimal compound and text indices to ensure performance.
* **Background Tasks**: Periodic cron jobs (CronService) execute fine accruals, queue sweeps, and user streak resets at local midnights.

---

## 🛠️ Local Setup & Running
1. **Clone and navigate to the project directory**:
   ```bash
   cd BookBuddy
   ```
2. **Setup environment variables**:
   Create a `.env` file inside the `server/` directory. (Refer to the `server/PRODUCTION_ENV_CHECKLIST.md` for description of each parameter).
   ```bash
   cp server/.env.example server/.env
   ```
3. **Install Dependencies**:
   ```bash
   cd server && npm install
   ```
4. **Run the Development Server**:
   ```bash
   npm run dev
   ```

---

## 🐳 Docker Compose (Single Command Launch)
To spin up both the MongoDB database and the backend server in isolated containers:
```bash
cd server
docker-compose up --build
```
This runs MongoDB at `localhost:27017` and the Express Server at `localhost:5000`.

---

## 🧪 Running Integration & E2E Tests
To run all 8 Jest integration test suites covering auth, library, personalization, engagement, real-time sockets, cron schedules, super admin portal, and the E2E user journey:
```bash
cd server
npm test
```
To generate coverage reports:
```bash
npm test -- --coverage
```


