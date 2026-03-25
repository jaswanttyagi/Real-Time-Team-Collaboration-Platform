# Real-Time Client Project Dashboard

Production-style technical assessment app for managing agency clients, projects, tasks, dashboards, notifications, and a live activity feed with strict role-based access control.

Key review areas for evaluators:

- Backend-enforced RBAC and ownership checks
- JWT access tokens with refresh-token rotation
- Real-time updates with Socket.io
- DB-backed activity logs and notifications

## Quick Start

For the fastest evaluation path:

1. Start PostgreSQL with Docker:

```bash
docker compose up -d postgres
``` make the seed data 

2. Install dependencies:

```bash
npm install
npm --prefix backend install
```

3. Create env files:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
```

If `cp` is not available in your shell, create the files manually from the `.example` files.

4. Update `backend/.env` with real secrets and a valid database connection string.

If you use the included Docker PostgreSQL service, this local connection string will work:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/clientproject?schema=public
```

5. Generate Prisma client, run migrations, and seed demo data:

```bash
npm --prefix backend run prisma:generate
npm --prefix backend exec prisma migrate dev --name init
npm --prefix backend run db:seed
```

6. Run the app:

```bash
npm run dev:full
```

7. Sign in with one of the seeded emails listed below and the matching password you set in `backend/.env`.

## Stack

- Frontend: React + TypeScript + Vite
- Backend: Node.js + Express + TypeScript
- Database: PostgreSQL
- ORM: Prisma
- Real-time: Socket.io
- Background jobs: node-cron
- Auth: JWT access token + refresh token in HttpOnly cookie

## Roles

### Admin

- Full access
- Manage users, clients, projects
- View all dashboards and live activity
- See online users count in real time

### Project Manager

- Create and manage only projects they created
- Create and manage tasks only inside their own projects
- View only their own project activity
- Receive notification when a developer moves a task to `IN_REVIEW`

### Developer

- View only assigned tasks
- Update only assigned task status
- Receive notification when a task is assigned

## Features Implemented

- Secure login, refresh, logout, and current-user endpoints
- Refresh token rotation with DB-backed sessions
- API-level RBAC and project/task ownership checks
- Clients, projects, tasks, user management
- DB-backed activity logs for task status changes
- Live activity feed with missed-event sync on reconnect
- DB-backed in-app notifications with real-time unread badge updates
- Admin, PM, and Developer dashboards
- Task filtering with shareable query params
- Overdue scheduler job using `node-cron`
- Assessment-ready seed data

## Project Structure

```txt
clientproject/
  src/                 # frontend app
  backend/
    prisma/
      schema.prisma
      seed.ts
    src/               # backend app
  docker-compose.yml
  .env.example
```

## Docker

Docker support is currently partial by design.

- Dockerized today: PostgreSQL only, via `docker-compose.yml`
- Not dockerized yet: frontend and backend application services
- Current workflow: run the database with Docker, then run frontend/backend locally with `npm`

This keeps local setup lightweight and predictable for an evaluator without claiming a full containerized deployment.

The included Docker Compose file starts:

- PostgreSQL 16
- A persistent named volume for database data

The Compose file uses local development credentials for convenience:

- Database: `clientproject`
- User: `postgres`
- Password: `postgres`

That setup is intended for local evaluation only, not production.

Future improvement:

- Add Dockerfiles for the frontend and backend
- Add full-stack Compose services so the entire app can be started with one command

## Local Setup

### 1. Install dependencies

```bash
npm install
npm --prefix backend install
```

### 2. Start PostgreSQL (Docker preferred)

Option A: Docker

```bash
docker compose up -d postgres
```

Option B: your own PostgreSQL instance

Make sure it matches the `DATABASE_URL` in `backend/.env`.

If your database password contains special characters such as `@`, encode them in the URL.
Example: `mypass@123` becomes `mypass%40123`.

### 3. Create env files

Frontend:

```bash
cp .env.example .env
```

Backend:

```bash
cp backend/.env.example backend/.env
```

See the Environment Variables section below for the required values.

### 4. Generate Prisma client and run migrations

```bash
npm --prefix backend run prisma:generate
npm --prefix backend exec prisma migrate dev --name init
```

### 5. Seed the database

```bash
npm --prefix backend run db:seed
```

See the Seed Script section below for exactly what gets created.

### 6. Run the app

Backend:

```bash
npm run server:dev
```

Frontend:

```bash
npm run dev
```

Or together:

```bash
npm run dev:full
```

### 7. Log in with a seeded account

Do not use your personal email until you create it from the admin side. The seeded login emails are:

- `admin@agency.local`
- `pm1@agency.local`
- `dev1@agency.local`

Use the passwords you set in:

- `SEED_ADMIN_PASSWORD`
- `SEED_PM_PASSWORD`
- `SEED_DEVELOPER_PASSWORD`

## Environment Variables

### Frontend (`.env`)

- `VITE_API_URL`: API base URL used by the frontend build. Example: `http://localhost:4000/api`
- `VITE_SOCKET_URL`: Socket.io base URL used by the frontend. Example: `http://localhost:4000`

### Backend (`backend/.env`)

- `PORT`: Backend server port. Default local value: `4000`
- `NODE_ENV`: Runtime environment, typically `development` for local setup
- `CLIENT_URL`: Allowed frontend origin for CORS and Socket.io
- `DATABASE_URL`: PostgreSQL connection string used by Prisma and the API
- `JWT_ACCESS_SECRET`: Secret used to sign and verify access tokens
- `JWT_REFRESH_SECRET`: Secret used to sign and verify refresh tokens
- `ACCESS_TOKEN_TTL`: Access token lifetime
- `REFRESH_TOKEN_TTL_DAYS`: Refresh-token session lifetime in days
- `REFRESH_COOKIE_NAME`: Name of the HttpOnly refresh-token cookie
- `SEED_ADMIN_PASSWORD`: Password assigned to the seeded admin account
- `SEED_PM_PASSWORD`: Password assigned to the seeded PM account
- `SEED_DEVELOPER_PASSWORD`: Password assigned to the seeded developer account

## Seed Script

The seed script lives at `backend/prisma/seed.ts` and is intended to give evaluators a ready-to-test workspace quickly.

Run it with:

```bash
npm --prefix backend run db:seed
```

What it creates or refreshes:

- 1 Admin user
- 1 PM user
- 1 Developer user
- 1 sample client
- 1 sample project
- Multiple sample tasks across different statuses
- Sample notifications
- Sample activity log entries

Important behavior:

- The seed is non-destructive. It updates the demo workspace without wiping users or projects you created manually later.
- Seeded passwords are not hardcoded in source. They come from `SEED_ADMIN_PASSWORD`, `SEED_PM_PASSWORD`, and `SEED_DEVELOPER_PASSWORD`.
- The seeded login emails stay stable for testing: `admin@agency.local`, `pm1@agency.local`, and `dev1@agency.local`.

Evaluator testing path:

- Log in as Admin to review user and client management
- Log in as PM to review project ownership, assignment, and notifications
- Log in as Developer to review assigned work, task updates, and real-time changes

## Database Schema Overview

The relational model is defined in `backend/prisma/schema.prisma` and centers on seven core tables:

- `User`: stores identities, roles, activation state, and links to created or assigned records
- `Client`: belongs to a creator and owns many projects
- `Project`: belongs to one client, has one project manager (`createdById`), and can be assigned to one developer
- `Task`: belongs to one project, can be assigned to one developer, and tracks workflow state, priority, and due dates
- `ActivityLog`: immutable audit and feed rows for task status changes, linked to a task, project, and actor
- `Notification`: in-app notifications for one recipient, with polymorphic `entityType` and `entityId` references
- `Session`: DB-backed refresh-token sessions with hashed refresh tokens and revocation metadata

High-level relationship view:

```txt
User 1 --- * Client
User 1 --- * Project (createdBy / PM)
User 1 --- * Project (assignedDeveloper)
User 1 --- * Task (createdBy / updatedBy / assignedDeveloper)
User 1 --- * ActivityLog (actor)
User 1 --- * Notification
User 1 --- * Session

Client 1 --- * Project
Project 1 --- * Task
Project 1 --- * ActivityLog
Task 1 --- * ActivityLog
```

## Seeded Accounts

- Admin: `admin@agency.local`
- PM: `pm1@agency.local`
- Developer: `dev1@agency.local`

Passwords are intentionally not hardcoded in source. The seed script reads them from:

- `SEED_ADMIN_PASSWORD`
- `SEED_PM_PASSWORD`
- `SEED_DEVELOPER_PASSWORD`

The seeded workspace is intentionally minimal for easier review:

- 1 Admin
- 1 Client
- 1 PM
- 1 Developer
- 1 Example project with tasks, activity, and notifications

Create additional PMs, developers, clients, and projects from the admin panel after login.

## Important API Notes

- Access token is sent in the `Authorization` header
- Refresh token is stored in an HttpOnly cookie
- All protected routes enforce authorization on the backend
- PM access is scoped by `projects.createdById`
- Developer access is scoped by `tasks.assignedDeveloperId`
- Activity feed is stored in the database, not derived in the frontend

## Architectural Decisions

- WebSocket library choice: Socket.io was chosen over native WebSocket because this app needs authenticated connections, room-based fan-out, reconnect handling, and missed-event recovery with less custom protocol code
- Job queue choice: `node-cron` is used instead of a full queue system because the current workload is a single recurring overdue and due-soon notification job. A queue such as BullMQ would be a better fit once retries, distributed workers, or heavier background processing are needed
- Token storage approach: access tokens are kept in frontend memory and sent in the `Authorization` header, while refresh tokens live in an HttpOnly cookie and are backed by hashed session rows in PostgreSQL. That keeps refresh tokens out of JavaScript-readable storage and supports rotation plus revocation
- ORM choice: Prisma keeps the schema explicit, gives typed queries, and makes it easier to evolve the data model safely during an assessment-sized build
- Database choice: PostgreSQL fits the relational shape of users, clients, projects, tasks, notifications, and sessions better than a document store for this workload

## Real-Time Behavior

- Task status changes create an activity row in PostgreSQL
- Relevant users receive `activity:new` over Socket.io immediately
- On reconnect or login, the client requests missed activity since the last seen timestamp
- Notification unread count updates live without polling
- Admin presence count is pushed in real time

## Security Notes

- Secrets live in `.env`
- Passwords are hashed with bcrypt
- Refresh tokens are hashed in the sessions table
- Role checks happen in the API, not just the UI
- Validation uses Zod
- Login route is rate-limited

## Known Limitations

- Docker is only used for PostgreSQL in local setup right now. The frontend and backend still run directly with `npm` instead of full containerized app services
- `node-cron` runs in-process, so in a multi-instance deployment the job would need coordination or replacement with a distributed queue or worker system
- Socket.io is currently configured for a single app instance. Horizontal scaling would need a shared adapter such as Redis for cross-instance room and event delivery
- Notifications are stored in the database, but there is no email or SMS delivery pipeline yet
- There is no generated ERD image checked in. This README includes a schema description instead

## Current Verification

- Backend TypeScript build passes: `npm --prefix backend run build`
- Frontend TypeScript check passes through `tsc -b`
- In this environment, the final Vite bundling step can require elevated permissions because of a local process-spawn restriction during config bundling
- The backend now fails fast on startup if PostgreSQL is not reachable instead of appearing healthy until the first login attempt
