# Security Architecture & Hardening Guide — "Day Companion / صاحب يومك"

This document outlines the end-to-end security architecture, threat model, secrets policy, authentication model, account transfer mechanism, and production deployment requirements for **Day Companion (صاحب يومك)**.

---

## 1. Threat Model & Mitigations

| Threat Vector | Risk Level | Mitigation Strategy |
| :--- | :--- | :--- |
| **SQL Injection (SQLi)** | Critical | 100% parameterized SQL queries with `?` place-holders across all Drizzle ORM and libSQL client operations. No raw string concatenation. |
| **Token Leakage & Spoofing** | High | Cryptographically secure installation tokens stored in secure local storage / IndexedDB. Server validates token and enforces `anonymous_user_id` ownership on every query (IDOR prevention). |
| **Transfer Code Brute-Force** | High | 8-digit secure random transfer codes with SHA-256 server-side hashing, 15-minute strict expiration, and atomic single-use consumption (`DELETE ... RETURNING`). Rate-limited strictly to 5 attempts/min and 20 attempts/hr per IP. |
| **Cross-Site Scripting (XSS)** | Medium | Strict Content-Security-Policy (CSP) headers, React automatic DOM escaping, and sanitization of text inputs. |
| **CSRF & CORS Misconfiguration** | Medium | Strict CORS origin allowlist (`ALLOWED_ORIGINS`) and request method restriction. |
| **Oversized / Malicious Payloads** | Medium | 100kb Express JSON payload body limits and Zod/manual request validation across all API endpoints. |
| **Stale / Compromised Credentials** | Low | Anonymous installation identity without passwords, emails, or personal data collection, minimizing personal data footprint (Privacy by Design). |

---

## 2. Secrets Policy

1. **Server-Only Secrets**:
   - `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` (along with any other backend credentials) are strictly server-side environment variables.
   - **Never prefix server secrets with `VITE_`**. Any `VITE_*` variable is automatically bundled into the client-side JavaScript and exposed to the browser.
2. **Client Safe Variables**:
   - Only `VITE_API_BASE_URL` (public HTTPS backend endpoint) is permitted to carry the `VITE_` prefix.
3. **Source Code Hygiene**:
   - No API keys, passwords, or tokens are hardcoded in source files. Environment variables are loaded securely via `dotenv` on the server and `import.meta.env` on Vite.

---

## 3. Authentication Model

- **Anonymous Installation Identity**:
  - Designed with privacy-first principles. Users are assigned a unique `anonymous_user_id` and a cryptographically signed installation token upon first launch.
  - No registration, email verification, password hashes, or third-party trackers are required.
  - All database queries enforce strict ownership isolation (`WHERE anonymous_user_id = ?`), preventing Insecure Direct Object Reference (IDOR).

---

## 4. Transfer Model (Cross-Device Sync)

When a user switches devices or reinstalls the app:
1. **Device A (Source)**:
   - Requests a temporary 8-digit transfer code (`POST /api/sync/transfer/generate`).
   - Server invalidates any prior code for this user, generates a secure random 8-digit code, hashes it using **SHA-256**, stores the hash with a **15-minute expiration**, and returns the plaintext code to Device A.
2. **Device B (Target)**:
   - Inputs the 8-digit code (`POST /api/sync/transfer/claim`).
   - Server hashes the submitted code, performs an **atomic single-use claim** (`DELETE FROM transfer_codes WHERE code_hash = ? AND expires_at >= ? RETURNING anonymous_user_id`), and issues a permanent installation credential to Device B.
3. **Security Properties**:
   - The transfer code is **hashed** in the database (plaintext is never stored).
   - Claiming is **atomic** (prevents race conditions where two devices claim the same code simultaneously).
   - Rate-limited against brute-force attacks.

---

## 5. Production Deployment Requirements

1. **Environment Variables**:
   - Set `NODE_ENV=production`.
   - Provide valid `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`.
   - Configure `ALLOWED_ORIGINS` to match your exact production domain (e.g., `https://yourdomain.com`).
   - Set `TRUST_PROXY=1` when deployed behind a reverse proxy (Google Cloud Run, Nginx, Cloudflare) for correct client IP detection in rate limiting.
2. **HTTPS & Transport Security**:
   - Production must run exclusively over HTTPS with HSTS headers enabled.
3. **Database Migrations**:
   - Automatic migration runner executes on server startup (`server/db/migrate.ts`) using atomic transactions and idempotent DDL (`IF NOT EXISTS`).
