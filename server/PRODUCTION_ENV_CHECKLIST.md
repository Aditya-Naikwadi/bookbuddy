# BookBuddy — Production Environment Variables Checklist

This document details all environment variables required to run the BookBuddy backend in a production environment.

| Variable Name | Required | Example Value | Description |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | **Yes** | `production` | Set to `production` to activate production logging, secure helmet modes, and enable strict secret strength validations at startup. |
| `PORT` | **Yes** | `5000` | The network port the server listens on inside the container. |
| `MONGO_URI` | **Yes** | `mongodb+srv://user:pass@cluster.mongodb.net/bookbuddy` | The production MongoDB connection string. Ensure replica sets are used if transaction-level concurrency (LabBookings) is needed. |
| `JWT_SECRET` | **Yes** | `[A-Long-Secure-Random-Cryptographic-Key]` | The secret key used to sign access tokens. Startup validation will crash the process if set to a weak default. |
| `JWT_REFRESH_SECRET` | **Yes** | `[A-Long-Secure-Random-Cryptographic-Key]` | The secret key used to sign refresh tokens. Startup validation will crash the process if set to a weak default. |
| `JWT_ACCESS_EXPIRY` | **Yes** | `15m` | Expiration time for access tokens (e.g. `15m` for 15 minutes). |
| `JWT_REFRESH_EXPIRY` | **Yes** | `7d` | Expiration time for refresh tokens (e.g. `7d` for 7 days). |
| `CLIENT_ORIGIN` | **Yes** | `https://bookbuddy.yourcollege.edu` | The origin url of the frontend client app, used for CORS configuration. |
| `ERROR_WEBHOOK_URL` | No | `https://hooks.slack.com/services/...` | Slack/Discord webhook URL to receive real-time notifications on unexpected backend errors. |
| `LOAN_PERIOD_DAYS` | No | `14` | The loan period in days. Defaults to `14`. |
| `MAX_RENEWALS` | No | `2` | Max times a loan can be renewed by a student. Defaults to `2`. |
| `FINE_RATE_PER_DAY` | No | `5` | Fine rate accrued per overdue day. Defaults to `5` (e.g. $5/day). |
| `FINE_MAX_AMOUNT` | No | `100` | Max ceiling amount for a single loan fine. Defaults to `100` (e.g. $100). |
| `UNPAID_FINE_LIMIT` | No | `100` | Maximum accumulated fine amount allowed before checkout blocks are triggered. Defaults to `100`. |
| `HOLD_PICKUP_WINDOW_HOURS`| No | `48` | Time duration for holds in ready_for_pickup status before they expire. Defaults to `48` hours. |
| `DUE_REMINDER_DAYS_BEFORE` | No | `2` | Number of days before due date to issue automatic student reminders. Defaults to `2`. |
| `STREAK_REMINDER_HOURS_BEFORE` | No | `3` | Hours before local midnight to warn a student of an expiring daily streak. Defaults to `3`. |
| `LAB_START_HOUR` | No | `8` | Lab operating start hour (local 24h format). Defaults to `8` (8 AM). |
| `LAB_END_HOUR` | No | `20` | Lab operating end hour (local 24h format). Defaults to `20` (8 PM). |
| `REDIS_URL` | No | `redis://localhost:6379` | Shared Redis cache URL for multi-instance distributed rate limiting. Defaults to none (uses in-memory store if missing). |
| `RATE_LIMIT_GLOBAL_MAX` | No | `100` | Max requests allowed per global window per IP (or per-user if authenticated). Defaults to `100`. |
| `RATE_LIMIT_GLOBAL_WINDOW_MS` | No | `60000` | Time duration for global rate limiting window (in milliseconds). Defaults to `60000` (1 minute). |
| `RATE_LIMIT_AUTH_MAX` | No | `5` | Max auth attempts per IP + Email/ID combination. Defaults to `5`. |
| `RATE_LIMIT_AUTH_IP_MAX` | No | `20` | Max auth attempts per IP address. Defaults to `20`. |
| `RATE_LIMIT_AUTH_EMAIL_MAX` | No | `5` | Max auth attempts per Email/ID across all IPs. Defaults to `5`. |
| `RATE_LIMIT_AUTH_WINDOW_MS` | No | `900000` | Time duration for auth rate limiting window (in milliseconds). Defaults to `900000` (15 minutes). |
| `RATE_LIMIT_USER_MAX` | No | `100` | Max requests allowed per user per window. Defaults to `100`. |
| `RATE_LIMIT_USER_WINDOW_MS` | No | `60000` | Time duration for per-user rate limiting window (in milliseconds). Defaults to `60000` (1 minute). |
| `RATE_LIMIT_EXPENSIVE_MAX` | No | `10` | Max requests allowed per window for expensive routes. Defaults to `10`. |
| `RATE_LIMIT_EXPENSIVE_WINDOW_MS` | No | `60000` | Time duration for expensive rate limiting window (in milliseconds). Defaults to `60000` (1 minute). |

