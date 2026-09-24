# Turso / libSQL Database Architecture & Migrations

This directory contains the production database access layer, schema definitions, and migration runner for **صاحب يومك** (Day Companion).

---

## 🏗️ Architecture Overview

The system uses:
1. **Turso / libSQL**: Primary distributed relational database storing anonymous user installation records, preferences, tasks, events, reminders, notifications, and sync operations.
2. **Anonymous Installation Identity**: Generated client-side (`X-Anonymous-User-Id`), validated and registered in Turso via server-side middleware.
3. **Node.js/Express Sync API**: Validates incoming offline sync batches and executes strictly scoped SQL queries on Turso on behalf of the anonymous planner identity.

---

## 📁 Directory Structure

```
server/db/
├── client.ts             # Centralized libSQL/Turso client & query helpers
├── migrate.ts            # Migration runner and status checker
├── README.md             # This documentation file
└── migrations/
    └── 001_initial_schema.sql  # Relational schema (users, tasks, events, reminders, notifications, user_preferences, sync_operations)
```

---

## 🚀 Running Migrations

### 1. Initialize & Apply Pending Migrations
To execute all pending migrations against your database:
```bash
npm run migrate
```
This runs `tsx server/db/migrate.ts`, checks the `_migrations` table, and applies any pending `.sql` files in chronological order.

---

## 🔒 Security & Environment Variables

The browser never communicates directly with Turso or exposes database credentials. All cloud access happens through the Express API layer.

Required Server Environment Variables:
```env
# Remote Turso Production Database
TURSO_DATABASE_URL=libsql://daycompanion-user.turso.io
TURSO_AUTH_TOKEN=your-turso-auth-token

# For Local Development
TURSO_DATABASE_URL=file:dev.db
```
