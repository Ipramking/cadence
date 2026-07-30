# Cadence

**An agentic money OS you run by chatting — with security built so you can actually trust an AI to move your money.**

Cadence is an AI money agent for cross-border earners. You tell it what you want in plain language — *"send my sister ₦20k from my dollars," "pay my electricity bill," "convert $100 to naira"* — and it interprets the intent, picks the best currency route, converts and settles through **BMONI**, and hands you a receipt with a plain-English reasoning trail.

Built for the **NITHUB Innovation Fair Hackathon 2026** — theme *Intelligent Money for Everyone*.

- **Live app:** https://cadence-dun-five.vercel.app
- **API:** https://cadence-api-fn11.onrender.com
- **Pitch deck:** `docs/Cadence.pptx`

---

## The problem

Cross-border earners in emerging markets — freelancers, remote workers, and families receiving support — earn in one currency (USD) but live in another (naira). To receive, convert, budget, and spend, they juggle several banks, wallets, and FX apps by hand. It's slow, cognitively heavy, and expensive — a hidden FX spread is taken on every conversion. AI could automate all of it, but nobody hands an AI their wallet without proof it's safe. Cadence exists to make *affordable, trustworthy money automation* accessible to the people who need it most.

## Core journey

1. **Sign up** with email + password (real multi-user auth).
2. **Onboard** — wallets are ready instantly; pick an autonomy mode; set a **PIN + safe-word**.
3. **Chat an instruction** → the agent fills in any missing details conversationally.
4. **Review the confirm card** — amount, recipient, live FX route via BMONI.
5. **Approve** with your PIN (or safe-word if the payment is flagged risky).
6. **Watch the reasoning timeline** → receive a **persistent receipt**.

Three **autonomy modes** — *Automatic · Hybrid · Manual* — let each user choose how much Cadence runs on its own. Balances, guardrails, and receipts persist; the chat itself is ephemeral by design.

## Trust Architecture — *autonomy without surrender*

The reason you can hand Cadence your money. Seven layers keep control provably human:

| # | Layer | What it does |
|---|-------|--------------|
| 1 | **AI never holds the keys** | The model only emits a *structured intent*; a separate deterministic engine validates and signs. A jailbreak or prompt-injection cannot move money — the AI has no signing authority. |
| 2 | **Spending guardrails** | Per-payment cap, daily cap, and a known-recipients allow-list fence every action — even in Automatic mode. |
| 3 | **Risk-based step-up** | A risk scorer (amount, new recipient, odd hour) escalates unusual payments to stronger auth. |
| 4 | **Safe-word** | Defeats coercion and impersonation; high-risk payments require it. |
| 5 | **Prompt-injection defense** | Screenshots and pasted text are treated as data, never as commands. |
| 6 | **Explainable payments** | Every action shows its reasoning trail and writes an immutable receipt. |
| 7 | **Freeze switch** | One tap halts all agent money movement instantly. |

## BMONI integration

BMONI is the financial engine under the agent, not a bolt-on:

- **Managed smart wallets** — a USDB (dollars) + CNGN (naira) pair, owned via an **owner-proof challenge/signature** flow (`viem`).
- **Live FX** — cross-currency payments use BMONI's real exchange rate and conversion.
- **On-chain settlement** — signed with the user's **AES-256-GCM–encrypted owner key**.

The AI is the interface; BMONI is the rails. Money endpoints are **real-BMONI-first**; if the sandbox is momentarily unreachable, the app silently falls back to seeded simulated balances so a demo never hard-breaks.

## AI

A conversational money agent (Google **Gemini**) handles natural-language intent understanding + slot-filling (turning *"send Musa 20k from my dollars"* into a structured, validated payment), currency-routing, and reading payment details out of screenshots/photos (vision). LLM outputs are validated server-side; on low confidence the agent asks instead of guessing. Responsibility is enforced by the Trust Architecture above — the model proposes, it can never sign.

## Tech stack

- **Frontend:** Next.js 14 (App Router) · Tailwind CSS · token-backed session
- **Backend:** Node + TypeScript · Fastify (ESM) · Prisma + SQLite
- **AI:** Google Gemini (`gemini-flash-latest`) — agent + vision
- **Money:** BMONI Embedded sandbox API · `viem` for owner-key signing
- **Auth/crypto:** scrypt passwords · JWT · AES-256-GCM key encryption
- **Deploy:** Vercel (web) · Render (API, `render.yaml` blueprint)

## Repository structure

```
apps/web            Next.js + Tailwind frontend
apps/api            Fastify + TypeScript backend (routes, auth, BMONI, sim, Prisma)
packages/shared     Shared domain types + the BmoniClient interface
docs/               Pitch deck (Cadence.pptx), pitch content, submission package
```

## Getting started

```bash
npm install
npm run dev          # runs web (:3000) and api (:4000)
```

Create `apps/api/.env` (never commit it):

```
DATABASE_URL="file:./dev.db"
PORT=4000
BMONI_BASE_URL=https://embedded-dev.bmoni.com
BMONI_API_KEY=...            # BMONI sandbox key
BMONI_USER_ID=...            # funded sandbox account id
BMONI_OWNER_KEY=...          # sandbox owner key (throwaway, test funds only)
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-flash-latest
APP_SECRET=...               # signs JWTs + encrypts owner keys
# BMONI_PROVISION=on         # optional: provision a real BMONI account per user
```

The frontend reads `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:4000`).

Apply the database schema:

```bash
cd apps/api && npx prisma migrate dev
```

## Deployment

- **API** deploys to Render via `render.yaml`. Build generates the Prisma client; the start command runs `prisma migrate deploy` before booting. Secrets are set in the Render dashboard (`sync: false`), never committed.
- **Web** deploys to Vercel; set `NEXT_PUBLIC_API_URL` to the API URL.

## What's real vs. simulated

In the spirit of honest disclosure:

- **Real:** multi-user auth · BMONI managed wallets, live FX, and conversion · owner-key signing · persistent receipts · the full Trust Architecture.
- **Simulated (test data only):** where the live sandbox can't provision or settle in the moment, Cadence faithfully simulates the same operations against seeded balances. No real funds or personal financial data are ever used.

## Security

Secrets live server-side only — never in the repo, bundle, deck, or video. Passwords are scrypt-hashed, owner keys are AES-256-GCM encrypted at rest, and sessions use JWTs. All money movement runs on sandbox/test data.

---

*Built solo by [Ipramking](https://github.com/Ipramking).*
