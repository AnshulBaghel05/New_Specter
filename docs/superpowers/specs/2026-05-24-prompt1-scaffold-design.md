# SPECTER — Prompt 1: Project Scaffolding & Design System

**Date:** 2026-05-24
**Status:** Approved
**Phase:** Phase 0 — Pre-Development
**Repos:** specter-web + specter-api

---

## 1. Goal

Bootstrap both repos from zero so every subsequent prompt has a working, visually verifiable foundation. No application logic is built here — only structure, dependencies, design tokens, and a smoke-test page.

---

## 2. Repo Layout

Parent container: `C:\Users\manoj\SPECTER\`

```
C:\Users\manoj\SPECTER\
├── specter-web\
│   ├── app\
│   │   ├── (marketing)\
│   │   │   └── page.tsx        ← design system smoke-test page
│   │   ├── layout.tsx          ← root layout, font injection
│   │   └── globals.css         ← CSS custom properties + Tailwind base
│   ├── components\
│   │   └── ui\                 ← shadcn/ui generated components (empty)
│   ├── lib\
│   │   └── utils.ts            ← cn() utility (clsx + tailwind-merge)
│   ├── tailwind.config.ts      ← design tokens
│   ├── components.json         ← shadcn/ui config
│   ├── tsconfig.json           ← strict: true
│   ├── .env.local              ← env keys (not committed)
│   └── .gitignore              ← includes .env.local
│
└── specter-api\
    ├── main.py                 ← FastAPI app, GET /health route
    ├── pyproject.toml          ← fastapi, pydantic v2, sqlalchemy 2.0, alembic, uvicorn
    ├── requirements.txt        ← pinned for Railway
    └── .gitignore              ← includes .env
```

---

## 3. Design System

### 3.1 Tailwind Tokens (`tailwind.config.ts`)

Extend `theme.colors` with named tokens so every component uses Tailwind classes, never raw hex:

| Class | Hex |
|-------|-----|
| `bg-bg` | `#06070D` |
| `bg-surface` / `text-surface` | `#0D0F1A` |
| `border-border` | `#1A1D2E` |
| `bg-primary` / `text-primary` | `#00E87A` |
| `text-text` | `#E8EAF0` |
| `text-muted` | `#6B7280` |

### 3.2 CSS Custom Properties (`globals.css`)

Declare all six tokens as CSS variables on `:root` for use outside Tailwind (e.g. GSAP, inline styles):

```css
:root {
  --bg: #06070D;
  --surface: #0D0F1A;
  --border: #1A1D2E;
  --primary: #00E87A;
  --text: #E8EAF0;
  --muted: #6B7280;
  --font-display: 'Syne', sans-serif;
  --font-body: 'DM Sans', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}

body {
  background: var(--bg);
  color: var(--text);
}
```

### 3.3 Fonts (`app/layout.tsx`)

Loaded via `next/font/google`. Each font assigned to a CSS variable injected on `<html>`:

| Font | Variable | Usage |
|------|----------|-------|
| Syne | `--font-display` | Headlines, nav, badges |
| DM Sans | `--font-body` | Body text, UI labels |
| JetBrains Mono | `--font-mono` | Code, price values, signals |

Tailwind `fontFamily` extended to map `font-display`, `font-body`, `font-mono` classes.

### 3.4 `lib/utils.ts`

```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

---

## 4. shadcn/ui Init

- Run `npx shadcn@latest init` with style: `default`, base color: `neutral`, CSS variables: `yes`
- `components.json` committed to repo
- `components/ui/` directory created (initially empty — components added per-prompt as needed)
- shadcn components are **never hand-edited** (CLAUDE.md critical rule)

---

## 5. Design System Smoke-Test Page

`app/(marketing)/page.tsx` — temporary, deleted at start of Prompt 3.

Renders on a `bg-bg` full-page layout:
1. **Color palette row** — one swatch per token with hex label beneath
2. **Font samples** — "SPECTER" in Syne (4xl bold), body paragraph in DM Sans, `const price = 49.99` in JetBrains Mono
3. **Primary button** — `bg-primary text-bg font-body rounded px-6 py-3` with hover opacity
4. Comment at top: `// SCAFFOLD SMOKE-TEST — delete this file content before Prompt 3`

---

## 6. specter-api Skeleton

### `main.py`
```python
from fastapi import FastAPI

app = FastAPI(title="specter-api")

@app.get("/health")
async def health():
    return {"status": "ok"}
```

### `pyproject.toml` dependencies
```
fastapi==0.111.*
pydantic>=2.0,<3
sqlalchemy>=2.0,<3
alembic>=1.13,<2
uvicorn[standard]>=0.29
httpx>=0.27
python-jose[cryptography]>=3.3
```

### `requirements.txt`
Generated from pyproject.toml pins — used by Railway for deployment.

---

## 7. Environment Variables

`.env.local` created in `specter-web/` with all keys from CLAUDE.md, left empty (no real values committed):

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_API_URL=https://specter-api.railway.app
NEXT_PUBLIC_POSTHOG_KEY=
```

Both `.gitignore` files explicitly exclude `.env` and `.env.local`.

---

## 8. Success Criteria

All four must pass before Prompt 1 is considered complete:

1. `npm run dev` in `specter-web/` → `localhost:3000` returns 200; smoke-test page visible with dark background and green primary color
2. `npm run lint` in `specter-web/` → zero errors
3. `uvicorn main:app --reload` in `specter-api/` → logs `Application startup complete`
4. `python -c "import fastapi, sqlalchemy, alembic, pydantic; print('ok')"` → prints `ok`

---

## 9. Environment Notes

- Node.js: 24.6.0 (installed) — exceeds spec requirement of 20 LTS, fully compatible
- Python: 3.13.5 (installed) — exceeds spec requirement of 3.11+, fully compatible
- uvicorn: not installed — installed via pip as part of this prompt
- Repos created at `C:\Users\manoj\SPECTER\` (Option C, user-confirmed)
