<div align="center">

# ✨ Real-Time Client Project Dashboard

### 🚀 Production-style full-stack app for managing clients, projects, tasks, dashboards & real-time collaboration

<p align="center">
  <img src="https://img.shields.io/badge/Frontend-React%20%2B%20TypeScript-blue?style=for-the-badge&logo=react" />
  <img src="https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-black?style=for-the-badge&logo=node.js" />
  <img src="https://img.shields.io/badge/Database-PostgreSQL-316192?style=for-the-badge&logo=postgresql" />
  <img src="https://img.shields.io/badge/ORM-Prisma-2D3748?style=for-the-badge&logo=prisma" />
  <img src="https://img.shields.io/badge/Realtime-Socket.io-010101?style=for-the-badge&logo=socket.io" />
  <img src="https://img.shields.io/badge/Auth-JWT%20%2B%20Cookies-success?style=for-the-badge" />
</p>

</div>

---

# 🌐 Live Demo

👉 Frontend:  
https://real-time-team-collaboration-platfo.vercel.app  

---

# 🚀 Overview

This is a **production-style real-time collaboration platform** built to manage:

- Clients  
- Projects  
- Tasks  
- Users  
- Notifications  
- Live Activity Feed  

It demonstrates **secure authentication, role-based access control, real-time updates, and scalable backend architecture**.

---

# ⚡ Quick Start

## 1. Start PostgreSQL (Docker)

```bash
docker compose up -d postgres
2. Install dependencies
npm install
npm --prefix backend install
3. Setup environment
cp .env.example .env
cp backend/.env.example backend/.env
4. Setup database
npm --prefix backend run prisma:generate
npm --prefix backend exec prisma migrate dev --name init
npm --prefix backend run db:seed
5. Run app
npm run dev:full
🧰 Tech Stack
Frontend
React
TypeScript
Vite
Backend
Node.js
Express
TypeScript
Database
PostgreSQL
Prisma ORM
Real-time
Socket.io
Auth
JWT (Access + Refresh)
HttpOnly cookies
👥 Roles
🛡️ Admin
Full access
Manage users, clients, projects
📌 Project Manager
Manage own projects & tasks
💻 Developer
Work on assigned tasks only
✨ Features
Secure authentication system
Role-based access control (RBAC)
Real-time activity updates
Notification system with unread count
Dashboard analytics
Task management with filters
Activity logs stored in database
Cron-based overdue task alerts
🧪 Demo Accounts

(Passwords come from .env)

Admin → admin@agency.local
PM → pm1@agency.local
Developer → dev1@agency.local
🧱 Project Structure
clientproject/
  src/ (frontend)
  backend/
    prisma/
    src/
🐳 Docker
Included
PostgreSQL
Not included
Backend container
Frontend container
🔐 Environment Variables
Frontend (.env)
VITE_API_URL=http://localhost:4000/api
VITE_SOCKET_URL=http://localhost:4000
Backend (backend/.env)
PORT=4000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/clientproject?schema=public

JWT_ACCESS_SECRET=your_secret
JWT_REFRESH_SECRET=your_secret

ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL_DAYS=7

REFRESH_COOKIE_NAME=clientproject_refresh_token

SEED_ADMIN_PASSWORD=admin123
SEED_PM_PASSWORD=pm123
SEED_DEVELOPER_PASSWORD=dev123
🌱 Seed Data

Creates:

1 Admin
1 PM
1 Developer
Sample client
Sample project
Tasks + notifications + activity logs

Run:

npm --prefix backend run db:seed
🗃️ Database Design

Core Models:

User
Client
Project
Task
ActivityLog
Notification
Session
🧠 Architecture Decisions
WebSockets → Socket.io
Rooms
Reconnect support
Simpler real-time handling
Jobs → node-cron
Lightweight scheduling
No heavy queue needed
Auth → JWT + Cookies
Access token → frontend memory
Refresh token → HttpOnly cookie
Session stored in DB
ORM → Prisma
Type safety
Easy schema management
⚡ Real-Time System
Task update → activity saved in DB
Event emitted via Socket.io
Live UI updates instantly
Reconnect sync supported
🔒 Security
Password hashing (bcrypt)
JWT authentication
HttpOnly cookies
Backend RBAC enforcement
Zod validation
Rate-limited login
⚠️ Known Limitations
Full Docker setup not implemented
Single-instance socket system
No Redis scaling
No email/SMS notifications
No ER diagram image
🚀 Deployment
Frontend (Vercel)
VITE_API_URL=https://your-backend.onrender.com/api
VITE_SOCKET_URL=https://your-backend.onrender.com
Backend (Render)
PORT=4000
NODE_ENV=production
CLIENT_URL=https://real-time-team-collaboration-platfo.vercel.app
DATABASE_URL=your_render_db_url
JWT_ACCESS_SECRET=your_secret
JWT_REFRESH_SECRET=your_secret
