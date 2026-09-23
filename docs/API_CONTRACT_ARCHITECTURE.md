# BookBuddy API Contract Architecture & Anti-Drift System

## 1. Executive Summary & The Motivating Incident

In earlier development iterations of BookBuddy, the e-resource content moderation flow experienced silent contract drift:
- The backend moderation controller and database schema were updated to expect `{ status: 'approved' | 'rejected', note: string }` where `note` was mandatory upon rejection.
- The frontend admin interface (`GlobalContentModeration.jsx`) continued transmitting a legacy payload `{ status: 'rejected', reason: '...' }` using the legacy property key `reason` instead of `note`.
- Because the frontend and backend maintained independent, unlinked assumptions about the request body shape without a single source of truth, the mismatch resulted in unhandled `400 Bad Request` errors in production that were only discoverable via manual user testing.
- Similarly, payment order creation experienced an AppSec trust boundary hazard where client requests could attempt to specify `amount` or `clientAmount`.

To solve this permanently, BookBuddy established a **Single Source of Truth Shared Contract Layer** (`@bookbuddy/shared`).

---

## 2. Architecture & Packaging Decision

### Monorepo Structure
BookBuddy is organized as an npm workspace monorepo:
- **`shared/` (`@bookbuddy/shared`)**: Canonical repository for request/response Zod schemas and TypeScript/JSDoc contracts.
- **`backend/`**: Node.js / Express API server. Consumes `@bookbuddy/shared` via `"@bookbuddy/shared": "file:../shared"` and npm workspaces.
- **`frontend/`**: React 19 + Vite client. Consumes `@bookbuddy/shared` via Vite aliases (`@shared` and `@bookbuddy/shared`) and package dependencies.

### Why this approach?
1. **Zero Transpilation Overhead**: Pure JavaScript Zod definitions run directly in Node.js CommonJS without a separate `tsc` or `babel` watch process.
2. **Dual-Environment Compatibility**: Express routes import schemas directly (`const { moderateEResourceRouteSchema } = require('@bookbuddy/shared/schemas/moderation');`), while Vite bundles schemas natively into frontend chunks.
3. **Deployment Safety & Portability**: Vercel serverless builds (`vercel.json`) and containerized Render deployments run `npm install --prefix backend` independently. Local `file:../shared` references guarantee proper symlinking without fragile manual junctions.

---

## 3. The Canonical Pattern for Endpoints

Every API endpoint must follow this strict three-step lifecycle:

```
                  ┌────────────────────────────────────────┐
                  │          @bookbuddy/shared             │
                  │   (e.g., shared/src/schemas/foo.js)    │
                  └──────────────────┬─────────────────────┘
                                     │
                  ┌──────────────────┴─────────────────────┐
                  │                                        │
                  ▼                                        ▼
    ┌───────────────────────────┐            ┌───────────────────────────┐
    │      Backend Route        │            │    Frontend API Client    │
    │  (validate(fooRouteSchema))│           │   (fooBodySchema.parse()) │
    └───────────────────────────┘            └───────────────────────────┘
```

### Step 1: Define the Shared Schema
In `shared/src/schemas/<domain>.js`:
```javascript
const { z } = require('zod');
const { objectIdSchema } = require('./common');

const moderateEResourceBodySchema = z
  .object({
    status: z.enum(['approved', 'rejected'], {
      errorMap: () => ({ message: "Status must be either 'approved' or 'rejected'." }),
    }),
    note: z.string().trim().optional().default(''),
  })
  .refine(
    (data) => {
      if (data.status === 'rejected') {
        return typeof data.note === 'string' && data.note.trim().length > 0;
      }
      return true;
    },
    {
      message: 'Rejection reason (note) is required when rejecting a resource.',
      path: ['note'],
    }
  );

const moderateEResourceRouteSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: moderateEResourceBodySchema,
});

module.exports = {
  moderateEResourceBodySchema,
  moderateEResourceRouteSchema,
};
```

### Step 2: Validate on the Backend Route
In `backend/src/routes/<domain>Routes.js`:
```javascript
const validate = require('../middlewares/validate');
const { moderateEResourceRouteSchema } = require('@bookbuddy/shared/schemas/moderation');

router.put('/eresources/:id/moderate', protect, validate(moderateEResourceRouteSchema), handler);
```

### Step 3: Validate in the Frontend Client / Component
In `frontend/src/api/<domain>Api.js` or component:
```javascript
import { moderateEResourceBodySchema } from '@shared/schemas/moderation';

export const moderateEResource = async (id, payload) => {
  const validated = moderateEResourceBodySchema.parse(payload);
  const { data } = await apiClient.put(`/admin-portal/eresources/${id}/moderate`, validated);
  return data;
};
```

---

## 4. AppSec Trust Boundary Hardening (Payment Orders)

Client applications must never be trusted to dictate financial amounts.
In `shared/src/schemas/payments.js`:
```javascript
const createPaymentOrderBodySchema = z
  .object({
    fineId: objectIdSchema.optional(),
    fineIds: z.array(objectIdSchema).optional(),
    currency: z.enum(['INR']).default('INR').optional(),
  })
  .strict({
    message: 'Client-supplied payment amounts or custom receipt parameters are forbidden. Amounts are computed server-side.',
  });
```
- `.strict()` ensures any payload containing `amount`, `clientAmount`, or `receipt` immediately fails at the route validation boundary with a `400 Validation Error`.
- The Express payment controller computes payable amounts directly from database `Fine` records.

---

## 5. Automated CI Prevention & Enforcement

Two layers of automated CI checks prevent recurrence of contract drift:

1. **Structural Enforcement Script (`scripts/testing/check-contract-layer.js`)**:
   - Runs during `npm run check:contracts` and `npm run ci:check` in `backend/`.
   - Scans all 56 route files.
   - Rejects any inline schemas (`validate(z.object(...))`).
   - Rejects any imports from local `validations/` folders.
   - Enforces that 100% of validated endpoints import their schemas from `@bookbuddy/shared`.

2. **Frontend Contract Drift Test Suite (`frontend/src/tests/contractDriftSafety.test.js`)**:
   - Runs in CI via `npm test` in `frontend/` (Vitest).
   - Simulates payloads constructed by frontend API clients (`adminApi`, `collegeAdminApi`, `facilitiesApi`, `paymentApi`, `registrationApi`).
   - Contains deliberate drift negative tests proving that re-introducing `{ reason }` instead of `{ note }` or client `{ amount }` fails CI tests immediately before deployment.
