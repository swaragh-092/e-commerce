# E-Commerce Platform

> Reusable, fully customizable e-commerce platform — one codebase, one instance per client.

## Tech Stack

| Layer    | Technology              |
| -------- | ----------------------- |
| Frontend | React 18 (Vite) + MUI 5 |
| Backend  | Node.js + Express       |
| Database | PostgreSQL + Sequelize  |
| Payments | Stripe                  |
| Email    | Nodemailer              |
| Deploy   | Docker + Docker Compose |

## Quick Start

### 1. Clone & Configure
```bash
git clone <repo-url> my-store
cd my-store
cp .env.example .env   # Edit with your DB, JWT, Stripe, SMTP credentials
```

### 2. Install Dependencies
```bash
cd server && npm install
cd ../client && npm install
```

### 3. Setup Database
```bash
cd server
npx sequelize-cli db:create
npm run migrate
npm run seed
```

### 4. Run Development
```bash
# Terminal 1 — Backend
cd server && npm run dev     # → http://localhost:5000

# Terminal 2 — Frontend
cd client && npm run dev     # → http://localhost:3000
```

### 5. Docker (Production)
```bash
docker-compose up --build
```

## Project Structure

```
e-commerce/
├── client/              # React frontend (Vite + MUI)
├── server/              # Express backend (Sequelize + PostgreSQL)
├── config/              # Fallback config (default.json)
├── scripts/             # Setup CLI
├── docs/                # Architecture documentation
└── docker-compose.yml
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — Full system design
- [Database Schema](docs/DATABASE.md) — SQL schemas + constraints
- [API Reference](docs/API.md) — All endpoints
- [Deployment](docs/DEPLOYMENT.md) — Docker, security, backups
- [Edge Cases](docs/EDGE-CASES.md) — Known issues & resolutions

## Default Login (after seeding)

| Role        | Email              | Password     |
| ----------- | ------------------ | ------------ |
| Super Admin | admin@store.com    | Admin123!    |
| Customer    | customer@store.com | Customer123! |

## License

ISC
