# MonitoringSystem

React + Vite + Supabase only project (no CodeIgniter).

## Requirements

- Node.js 18+ (includes npm)

## Setup

1. Open terminal in this folder:
   - `cd MonitoringSystem`
2. Install packages:
   - `npm install`
3. Create `.env` file from `.env.example` and set your Supabase values:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. In Supabase SQL Editor, run:
   - `supabase-schema.sql`
5. In Supabase Auth settings, enable Email/Password sign-in.
6. Start dev server:
   - `npm run dev`

## Features included

- Sign up and sign in (Supabase Auth)
- Sign out
- Protected dashboard view
- Event CRUD using Supabase table `events`
- RLS-ready schema and policies (users can only access their own rows)

## Build

- `npm run build`
- `npm run preview`
