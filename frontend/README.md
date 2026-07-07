# Frontend — Next.js Application

**Why this package exists:** All user-facing UI, Clerk authentication, Prisma database access, and TradingView charts live here. Deployed to Vercel.

## Structure

```
src/
├── app/              # Next.js App Router — pages and layouts
├── components/
│   ├── ui/           # shadcn/ui primitives (Button, Card, Dialog, …)
│   ├── charts/       # TradingView Lightweight Charts wrappers
│   ├── layout/       # Shell, sidebar, header, footer
│   └── features/     # Domain components (portfolio, scanner, analysis, …)
├── hooks/            # Custom React hooks (useWatchlist, useQuote, …)
├── lib/              # API client, utils, constants, Clerk helpers
├── stores/           # Client state (Zustand or React Context)
├── types/            # TypeScript interfaces
└── styles/           # Global CSS, Tailwind extensions
prisma/               # Schema and migrations (PostgreSQL)
public/               # Static assets
```

## Environment

Copy `.env.example` to `.env.local` before running.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment file and add Clerk keys from [dashboard.clerk.com](https://dashboard.clerk.com):

```bash
cp .env.example .env.local
```

3. Start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app runs without Clerk keys (setup banner shown); auth requires valid `pk_` / `sk_` keys.

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server with Turbopack |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | ESLint |

## Milestone 2 deliverables

- Next.js 15 App Router + TypeScript + Tailwind
- shadcn/ui (Button, Card, Badge, Skeleton, Separator)
- Clerk auth with graceful fallback when keys are missing
- Dark Bloomberg-inspired theme with glassmorphism utilities
- Landing page, dashboard shell, loading skeletons
- Placeholder pages for all planned routes
