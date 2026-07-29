# Cadence

An AI money agent for cross-border earners. Cadence takes charge of every dollar the moment it lands — guarding it against scams, converting it at the best rate, and putting it to work: a steady monthly salary, self-funding goals, family support, and a hedge against currency devaluation.

## Why

Freelancers and remote workers earn in USD but are underserved by banks: opaque FX, slow conversions, and no easy way to hold or time their income. Cadence is the intelligence layer that manages it for them.

## Structure

```
apps/web      Next.js + Tailwind frontend
apps/api      Node + TypeScript (Fastify) backend
packages/shared   Shared domain types + the money-provider interface
```

## Getting started

```bash
npm install
npm run dev
```

## Money provider

All money operations go through the `BmoniClient` interface in `packages/shared`. A mock implementation powers local development and demos against test data; a sandbox implementation swaps in when API credentials are available. No provider is ever called directly outside the adapter.
