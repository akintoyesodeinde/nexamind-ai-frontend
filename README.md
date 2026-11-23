# NexaMind AI — Frontend (`nexamind-ai-frontend`)

Enterprise Generative AI Knowledge & Workflow Automation SaaS Dashboard built with **React 19**, **strict TypeScript**, **Vite**, **Tailwind CSS**, **Radix UI primitives**, **TanStack Query v5**, **React Router v7**, **React Hook Form**, and **Zod**.

> **Independent Repository Architecture:** `nexamind-ai-frontend` and [`nexamind-ai-backend`](https://github.com/akintoyesodeinde/nexamind-ai-backend) are maintained as two completely independent Git repositories with independent CI/CD pipelines.

---

## Implemented Enterprise Screens (18 / 18 Complete)
- **Identity & Tenancy:** Login & Registration, Organization Onboarding, Main Analytics Dashboard, User & Role Administration, Tenant Settings, User Profile & Preferences
- **Knowledge & RAG:** Knowledge Base Management (with ACL matrix), Document Upload & Ingestion Status (with SAS downloads & versioning), Document Intelligence Workspace (`Summarize`, `Classify`, `Extract`, `Compare`), AI Knowledge Assistant Chat (live SSE streaming + Verified Citation Evidence Drawer + Safe Abstention), Conversation History
- **Automation & Governance:** AI Agent Studio (allowlisted safe tools & step caps), Agent Execution History (step-by-step validated JSON trace), Workflow Management (flagship AI Compliance Report Workflow), Approval Inbox (idempotent Approve/Reject with draft & citations inspector), AI Usage & Cost Analytics (`DECIMAL(18,6)` gauges & trends), AI Evaluation Dashboard (`>= 95%` citation benchmark), Security Audit Dashboard (SHA-256 hash-chain verifier & security events)

---

## Security & Architecture Highlights
- **Zero-`localStorage` Auth:** Authenticates via Laravel Sanctum `HttpOnly` cookies (`credentials: 'include'`) and CSRF cookies (`X-XSRF-TOKEN`).
- **Strict TypeScript:** `strict: true`, `noUncheckedIndexedAccess: true`, `noUnusedLocals: true`.
- **Idempotent Mutations:** Workflow launches, agent runs, and approval decisions automatically attach `Idempotency-Key` headers.

---

## Local Development (Memory-Conscious Profile)
Run the Vite dev server natively on your workstation while the backend API runs in Docker:

```bash
cp .env.example .env
npm ci
npm run dev
```

Vite serves on `http://127.0.0.1:5173` and proxies `/api/*` and `/sanctum/*` to `http://127.0.0.1:8000`.

## Quality & Verification Commands
```bash
npm run typecheck
npm run lint
npm test
npm run build
npm audit --omit=dev --audit-level=critical
```

## CI/CD & Azure Linux VM Deployment
- **CI (`.github/workflows/ci.yml`):** `npm ci`, production `npm audit --omit=dev --audit-level=critical`, workflow YAML validation, ESLint, strict TypeScript, 11/11 Vitest tests, Vite production bundle, non-root `nginx:1.31.10-alpine` SPA Docker build, live `/healthz` smoke test, and Trivy CRITICAL scan.
- **CD & Rollback (`.github/workflows/deploy.yml`, `.github/workflows/rollback.yml`):** Publishes immutable `sha-` / SemVer tags to **Docker Hub**, authenticates to Azure via keyless **Microsoft Entra ID OIDC** (`azure/login@v2`), deploys safely via **Azure VM Run Command** (no inbound SSH from GitHub runners), verifies HTTPS SPA + backend connectivity, and supports one-click rollback.
