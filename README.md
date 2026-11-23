# NexaMind AI — Frontend (`nexamind-ai-frontend`)

Enterprise Generative AI Knowledge & Workflow Automation SaaS Dashboard built with React, strict TypeScript, Vite, Tailwind CSS, TanStack Query, React Router, React Hook Form, and Zod.

## Architecture Notes
- **Independent Repository:** No monorepo coupling with `nexamind-ai-backend`.
- **Zero-localStorage Auth:** Authenticates with Laravel Sanctum via `HttpOnly` session cookies (`credentials: 'include'`) and CSRF cookies through the Vite `/api` + `/sanctum` dev proxy (or same-site domain in Azure).
- **Strict TypeScript:** `strict: true`, `noUncheckedIndexedAccess: true`, `noUnusedLocals: true`.
- **Role-Aware UX + Backend Enforcement:** Client-side permission checks improve usability; every authorization decision is independently enforced by Laravel backend policies.

## Local Development (Memory-Conscious Profile)
Because local Docker runs SQL Server + Laravel API inside the Docker VM, run the Vite dev server natively on the host machine:

```bash
cp .env.example .env
npm ci
npm run dev
```

Vite serves on `http://127.0.0.1:5173` and proxies `/api/*` and `/sanctum/*` to `http://127.0.0.1:8000`.

## Quality Commands
```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Production Container Build
```bash
docker build -t nexamind-ai-frontend:local .
docker run --rm -p 8080:8080 nexamind-ai-frontend:local
```
