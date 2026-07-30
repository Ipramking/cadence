# Cadence — NITHUB Innovation Fair Hackathon 2026 · Submission Package

> Deadline: **Thu 30 Jul 2026, 9:00 p.m. WAT**. Submit at https://nithub.unilag.edu.ng/hackathons
> Copy each field below into the form. Links must open **signed-out / incognito**.

## Links
- **Working prototype (MVP):** https://cadence-dun-five.vercel.app  *(sign up with any email — no gated setup; the full journey is testable)*
- **Public GitHub repo:** https://github.com/Ipramking/cadence
- **Pitch deck:** `<Google Drive link — upload docs/Cadence.pptx, share "Anyone with the link · Viewer">`
- **Product video:** `<Google Drive link — record per the script below, share "Anyone with the link · Viewer">`

---

## Project summary
**Name:** Cadence

**One-line:** Cadence is an AI money agent for cross-border earners — pay bills, send money, and convert across currencies just by chatting, with bank-grade safety controls, powered by BMONI.

## Problem statement *(rubric: User problem + financial-inclusion value — 20)*
Cross-border earners in emerging markets — freelancers, remote workers, and families receiving support — earn in one currency (USD) but live in another (naira). To receive, convert, budget, and spend, they juggle several banks, wallets, and FX apps by hand. It's slow, cognitively heavy, and expensive: a hidden FX spread is taken on every conversion. AI could automate all of it, but people won't hand an AI their wallet without proof it's safe — so the people who would benefit most stay locked out of intelligent money management. Here, financial inclusion isn't only access to an account; it's access to **affordable, trustworthy money automation**.

## Solution summary *(rubric: Working prototype — 20)*
Cadence is an agentic money OS you operate by chatting. You say what you want — *"send my sister ₦20k from my dollars," "pay my electricity bill," "convert $100 to naira"* — and Cadence interprets the intent, picks the best currency route, converts through BMONI, executes, and returns a receipt with a plain-English reasoning trail. Three autonomy modes (Automatic / Hybrid / Manual) let each user choose how much it runs.

**Core user journey:** Sign up → lite onboarding provisions your dollar + naira wallets → choose an autonomy mode and set a PIN + safe-word → chat an instruction → review the confirm card (amount, recipient, live FX route) → approve with your PIN (or safe-word if the payment is flagged risky) → watch the reasoning timeline → receive a persistent receipt. Balances, guardrails, and receipts persist; the chat itself is ephemeral by design.

## BMONI use *(rubric: BMONI API integration — 15)*
BMONI is the financial engine under the agent, not a bolt-on. At onboarding, Cadence provisions each user a BMONI **managed smart-wallet pair** — USDB (dollars) and CNGN (naira) — using an **owner-proof challenge/signature** flow (viem) so the wallet is cryptographically owned by the user. Cross-currency payments use **BMONI's live exchange rate and conversion**; settlement is signed with the user's **encrypted owner key**. The AI is the interface; BMONI is the rails.

*Honest scope note (per the responsible-disclosure rule):* the real BMONI sandbox integration is implemented end-to-end (provisioning, FX, owner-key signing). Where the live sandbox cannot provision or settle in the moment, Cadence falls back to a faithful **simulation of the same BMONI operations** so the judge-testable journey never breaks — clearly a simulation, using **test data only**.

## AI use *(rubric: Useful + responsible AI — 15; also Privacy/security — 10)*
The AI (Google Gemini) is a **conversational money agent**. It performs natural-language intent understanding + slot-filling (turning *"send Musa 20k from my dollars"* into a structured, validated payment), currency-routing decisions, and reads payment details out of screenshots/photos (vision). This is the right tool because money tasks arrive as messy natural language across many rails (send, bills, airtime, convert); an LLM collapses that into one conversational surface — exactly the accessibility unlock for non-expert users.

**Responsible AI — our differentiator (the "Trust Architecture"):**
- **The AI proposes, it can never pay.** It only emits a structured intent; a separate deterministic engine validates and signs it. A jailbreak or prompt-injection cannot move money — the model has no signing authority.
- **Prompt-injection defense:** screenshots/pasted text are treated as data, never commands.
- **Spending guardrails:** per-payment and daily caps + a known-recipients allow-list fence every action, even in Automatic mode.
- **Risk-based step-up:** a risk scorer escalates unusual payments (large / new recipient / odd hour) to stronger auth (PIN + safe-word).
- **Safe-word** defeats coercion and impersonation; a **freeze switch** halts the agent instantly.
- Model outputs are validated server-side; on low confidence the agent asks instead of guessing.

## Impact, feasibility & adoption *(rubric — 15)*
- **Impact:** cuts the cost (hidden FX spreads) and manual effort of cross-border money for ordinary earners, and makes autonomy *safe enough to adopt* — the real unlock for agentic finance.
- **Feasibility:** already a working product on real infrastructure (real multi-user auth, BMONI wallets/FX, persistent receipts). Built on managed rails (BMONI) and standard cloud (Vercel/Render).
- **Adoption path:** conversational UX needs no financial literacy; corridor-agnostic — scales to any BMONI-supported currency pair. Next step: complete live KYC-gated per-user settlement and add more bill rails.

## Privacy, security & accessibility *(rubric — 10)*
Test/sandbox data only; no real funds or personal financial data. Secrets (BMONI key, Gemini key, app secret) are **server-side only** — never in the repo, bundle, deck, or video. Passwords are scrypt-hashed; owner keys are AES-256-GCM encrypted at rest; sessions use JWTs. The Trust Architecture above covers financial safety. Accessibility: a plain-language chat interface removes the need for financial expertise; the UI works on phone and desktop.

## Disclosures *(required)*
- Built **fresh for this hackathon** — no reused prior project. Sole author: Ipramking.
- **Model:** Google Gemini (`gemini-flash-latest`) via REST — conversational agent + vision.
- **APIs / SDKs:** BMONI Embedded **sandbox** API (wallets, FX, settlement); `viem` (owner-key signing); open-source libraries — Next.js, Fastify, Prisma, Tailwind CSS; `react-icons` (MIT) for deck icons.
- **Data:** sandbox/test data only. Simulated balances are seeded **test values** ($50 / ₦10,000). No real funds, no real personal financial data.
- **No** external datasets, paid templates, or purchased assets. Design system is custom.

---

## Product video — script & shot list (aim 60–90s; ≤2 min)
1. **(0:00–0:08) Hook:** "Everyone wants an AI to run their money. Nobody wants to hand an AI their wallet. Cadence solves both." *(title slide)*
2. **(0:08–0:20) Sign up + onboarding:** create account → wallets provision → pick Automatic → set PIN + safe-word.
3. **(0:20–0:35) Chat a payment:** type *"send ₦20,000 to Musa from my dollars"* → show the confirm card (amount, recipient, live FX route via BMONI).
4. **(0:35–0:45) Approve + reasoning + receipt:** enter PIN → reasoning timeline → receipt ("powered by BMONI").
5. **(0:45–1:00) Trust Architecture live:** trigger a large/unusual payment → **risk step-up asks for the safe-word**; open Settings → **freeze the agent** → show a payment blocked.
6. **(1:00–1:15) Wallet + BMONI:** open Wallet → balances, on-chain wallet addresses, conversion.
7. **(1:15–1:30) Close:** "The AI proposes; it can never sign. Autonomy without surrender. That's Cadence — powered by BMONI." Show the live URL.
> Use test data only. Keep the video as backup even though the live app works.

## Tonight's checklist (before 9:00 p.m. WAT)
- [ ] Upload `docs/Cadence.pptx` to Google Drive → Share → **Anyone with the link · Viewer** → paste link in form.
- [ ] Record the product video → upload to Drive → **Anyone with the link · Viewer** → paste link.
- [x] GitHub repo is **Public** (verified) and `main` has the judged work.
- [x] Prototype opens signed-out and the signup→pay→receipt journey works (verified in prod).
- [ ] Fill every form field from this doc (participant details, summary, problem, solution, BMONI, AI, disclosures, all 4 links).
- [ ] Open **every** link in an incognito window to confirm access.
- [ ] Submit, then watch inbox + spam for the selection email.
