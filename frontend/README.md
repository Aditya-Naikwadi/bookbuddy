# BookBuddy Frontend Client

### Modern Single Page Application (SPA) dashboard for BookBuddy built with React 19, Vite 8, Zustand 5, React Query 5, and Tailwind CSS v4.

---

## 🚀 Features & Modules

The frontend contains dedicated view portals styled dynamically using a glassmorphic dark theme:

1. **Student Dashboard**: Main viewport housing the Patron Card, loans overview, pending fines, ebook repository, and the active streak tracker.
2. **Ebook Reader**: Fullscreen, distraction-free Epub.js reader with table of contents sidebar, bookmarks support, and progress persistence.
3. **College Admin Portal**: Circulation controls (book lend/receive), catalog manager, student patron registry, lab booking planner, and analytics reports.
4. **Super Admin Portal**: Global content moderation queue, college onboarding manager, and central read-only audit log viewer.

---

## 🛠️ Technology Stack

- **Core Library**: React 19 (Concurrent rendering, Suspense lazy load boundaries)
- **Bundler**: Vite 8 (Fast dev-server compilation)
- **Styling**: Tailwind CSS v4 (Utility classes configured with custom variables)
- **Animations**: Framer Motion (page transitions) & Lenis (smooth inertial scrolling)
- **State Management**:
  - _Client state_: Zustand (with localStorage persistence)
  - _Server state_: TanStack React Query (fetching, caching, and mutation loading states)
- **Routing**: React Router v7 (nested router guard locks)
- **Form Handling**: React Hook Form + Zod resolvers

---

## 📁 Directory Structure

```
client/src/
├── api/             # Axios client connection instances (interceptors for JWT)
├── components/      # Shared components (buttons, input fields, error boundaries)
├── context/         # React context providers (Lenis context, Theme context)
├── features/        # Business feature modules (streak widgets)
├── layouts/         # High-level layouts (DashboardLayout, AuthLayout)
├── pages/           # Lazy-loaded page components
└── store/           # Zustand store definitions (authStore.js)
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: `v20.x` or later
- **Package Manager**: `npm`

### Environment Variables

Create a `.env` file in the `client/` root folder:

```env
VITE_API_URL=http://localhost:5000/api       # Backend API base endpoint
VITE_SOCKET_URL=http://localhost:5000     # Backend WebSocket URL
```

### Installation & Execution

1. Install client dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.
3. Build for production:
   ```bash
   npm run build
   ```
   The compiled assets will be output to `client/dist`.

---

## 🔌 API Integration Guidelines

All server communications go through the central Axios client (`client/src/api/client.js`).

- JWT tokens are attached automatically in requests via a request interceptor reading from Zustand local persistence.
- Any request receiving a `401 Unauthorized` response will automatically purge the Zustand auth state and redirect the user back to the login screen.
- WebSocket interactions are handled in `socketClient.js` with manual connections established only after successful user authentication.

---

## 🏗️ Technical Architecture Details

For the detailed frontend design documentation, check the architecture guides located in the repository root:

- [Frontend Architecture Design Doc](../docs/architecture/frontend-design.md)
