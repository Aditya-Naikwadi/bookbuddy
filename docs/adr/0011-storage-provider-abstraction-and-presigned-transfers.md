# ADR 0011: Storage Provider Abstraction & Presigned Transfers

- **Status**: Accepted
- **Date**: 2026-10-22
- **Deciders**: @engineering-backend-architect, @security-appsec-engineer
- **Consulted**: @engineering-frontend-developer, @testing-test-automation-engineer

---

## Context and Problem Statement

1. **VM Network & Memory Saturation**: Serving textbook and e-resource bytes (typically 5MB–50MB) directly through the Node.js Express process consumes significant process memory and rapidly exhausts the VM's monthly outbound network bandwidth allowance (e.g. ~1 GB/month free egress on GCP Compute Engine).
2. **Reverse Proxy Payload Bottlenecks**: Large file uploads through Express or Cloudflare edge reverse proxies are constrained by payload limits (e.g. 100MB body limits, 4.5MB serverless limits on Vercel) and tie up API worker threads.
3. **Platform Storage Coupling**: The existing implementation relied directly on `BLOB_READ_WRITE_TOKEN` for Vercel Blob with an incomplete fallback, preventing seamless runtime parity between Vercel serverless preview deployments and standalone GCP Compute Engine VM environments.
4. **Audit and Range Compliance**: E-resource downloads lacked consistent multi-tenant download auditing (`DownloadLog` with `collegeId` and IP tracking), and external Project Gutenberg proxies lacked edge caching headers.

---

## Decision Drivers

1. **Zero-RAM E-Book Delivery**: Support short-lived presigned download URLs so users read and download files directly without proxying bytes through the API server memory.
2. **Direct-to-Storage Presigned Uploads**: Large e-resources upload directly to object storage via presigned URLs, bypassing Node.js and reverse proxies.
3. **Pluggable Storage Provider Interface**: Unified `StorageProvider` abstraction supporting `local` (self-hosted VM disk with HMAC signatures), `vercel-blob`, `gcs` (Google Cloud Storage), and `s3` (AWS S3).
4. **HTTP 206 Partial Content & Edge Caching**: Preserve standard HTTP Range request behavior (HTTP 206) for media streams and readers, and instruct Cloudflare edge caching for external Gutenberg assets (`s-maxage=604800`).
5. **Roster CSV Boundary**: Student roster CSV ingestion stays on the API with documented size limits (20MB / 25,000 rows max).

---

## Decision Outcome

1. **Unified Storage Abstraction (`backend/src/utils/storage.js`)**:
   - Implemented provider interface supporting `local`, `vercel-blob`, `gcs`, and `s3`.
   - Defaults to `vercel-blob` if `BLOB_READ_WRITE_TOKEN` is present, otherwise `local`.
   - Generates cryptographically signed, time-limited presigned upload and download URLs using HMAC SHA-256 (`operation:fileKey:expires`).
   - Constant-time verification (`crypto.timingSafeEqual`) prevents timing attack vulnerabilities.
   - Strict path traversal guards (`resolveStorageLocalPath`) prevent directory escape attacks.
2. **Direct Upload Receiver (`backend/src/routes/uploadRoutes.js`)**:
   - `PUT` and `POST` `/api/v1/uploads/direct/*` endpoints authenticate via HMAC query tokens.
   - Enforces a 50MB streaming limit without buffering the whole file in RAM.
   - Exempt from browser CSRF checking via cryptographic token verification.
3. **Direct Storage Download Endpoint (`backend/src/routes/storageRoutes.js`)**:
   - `GET /api/v1/storage/download/*` validates HMAC signatures and timestamp expiration before serving.
   - Delivers files with `X-Content-Type-Options: nosniff` and CSP sandboxing, supporting HTTP 206 Range requests.
4. **Audited E-Book Delivery (`readerController.js` & `eresourceController.js`)**:
   - Access control verifies institutional tenant boundaries and publication status.
   - Every download logs an audit entry to `DownloadLog` recording `userId`, `resourceId`, `collegeId`, `ipAddress`, and `downloadedAt`.
   - External Gutenberg content sets `Cache-Control: public, max-age=86400, s-maxage=604800` for Cloudflare edge caching.
   - Internal downloads return signed download URLs (`format=json` or `302 Redirect`) or stream with HTTP 206.
5. **Frontend Direct Upload Utility (`frontend/src/utils/directUpload.js`)**:
   - Enforces 50MB file size checks with clear human-readable error messages.
   - Requests presigned upload URLs and executes direct PUT transfers.
   - Integrated into student e-resource submissions and roster CSV upload validation (20MB limit).

---

## Verification

- Automated test suite `backend/src/tests/deploymentPhase5.test.js` covers:
  - Storage provider abstraction (`local`, `vercel-blob`, `gcs`).
  - Presigned upload URL generation and direct streaming uploads.
  - HMAC token validation (tampered tokens and expired tokens rejected with 403).
  - Path traversal attempt rejection.
  - Streaming size limit enforcement (413 Payload Too Large).
  - E-resource delivery, access checks, `DownloadLog` multi-tenant audit recording, and Gutenberg edge caching headers.
  - Direct-to-storage registration and roster size boundaries.
