# Prompt 1: Project Scaffolding & Design System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create both SPECTER repos at `C:\Users\manoj\SPECTER\` with all dependencies installed, design tokens wired, shadcn/ui initialized, and a visual smoke-test page confirming the design system works.

**Architecture:** Two independent repos share a parent directory. `specter-web` is a Next.js 14 App Router project with Tailwind + shadcn/ui. `specter-api` is a FastAPI skeleton with Pydantic v2, SQLAlchemy 2.0, and Alembic installed. No application logic is built — this is pure scaffolding.

**Tech Stack:** Next.js 14.2, TypeScript 5.4 (strict), Tailwind 3.4, shadcn/ui, clsx + tailwind-merge, FastAPI 0.111, Pydantic v2, SQLAlchemy 2.0, Alembic 1.13, uvicorn

---

## File Map

```
C:\Users\manoj\SPECTER\
├── specter-web\
│   ├── app\
│   │   ├── (marketing)\
│   │   │   └── page.tsx          CREATED  smoke-test page (deleted in Prompt 3)
│   │   ├── layout.tsx            MODIFIED fonts injected as CSS vars
│   │   └── globals.css           OVERWRITTEN design tokens + shadcn/ui CSS vars
│   ├── components\
│   │   └── ui\                   CREATED  empty directory, shadcn drops components here
│   ├── lib\
│   │   └── utils.ts              CREATED  cn() = clsx + tailwind-merge
│   ├── tailwind.config.ts        OVERWRITTEN design tokens
│   ├── components.json           CREATED  shadcn/ui config
│   ├── tsconfig.json             VERIFY   strict:true already set by create-next-app
│   ├── .env.local                CREATED  all keys empty, not committed
│   └── .gitignore                VERIFY   .env.local excluded
│
└── specter-api\
    ├── main.py                   CREATED  FastAPI app + GET /health
    ├── pyproject.toml            CREATED  all dependencies declared
    ├── requirements.txt          GENERATED via pip freeze
    └── .gitignore                CREATED  excludes .env, __pycache__, .venv
```

---

## Task 1: Create parent directory and scaffold specter-web

**Files:**
- Create: `C:\Users\manoj\SPECTER\` (parent)
- Create: `C:\Users\manoj\SPECTER\specter-web\` (via create-next-app)

- [ ] **Step 1: Create the SPECTER parent directory**

```powershell
New-Item -ItemType Directory -Path "C:\Users\manoj\SPECTER" -Force
Set-Location "C:\Users\manoj\SPECTER"
```

Expected: no error, prompt shows you are in `C:\Users\manoj\SPECTER`.

- [ ] **Step 2: Scaffold specter-web**

```powershell
npx create-next-app@14.2 specter-web --typescript --tailwind --app --eslint --no-src-dir --import-alias "@/*" --yes
```

Expected: the CLI runs through all prompts automatically (accepted via `--yes`) and ends with:
```
Success! Created specter-web at C:\Users\manoj\SPECTER\specter-web
```

- [ ] **Step 3: Enter the repo and verify git was initialized**

```powershell
Set-Location "C:\Users\manoj\SPECTER\specter-web"
git log --oneline
```

Expected: one commit — `"Initial commit from Create Next App"` (create-next-app runs `git init` and commits automatically). If the repo has no commits, run:

```powershell
git init
git add .
git commit -m "chore: initial Next.js 14 scaffold"
```

- [ ] **Step 4: Verify TypeScript strict mode**

Open `tsconfig.json` and confirm `"strict": true` is present in `compilerOptions`. create-next-app sets this by default. If it is missing, add it now before proceeding.

---

## Task 2: Install all npm dependencies

**Files:**
- Modify: `C:\Users\manoj\SPECTER\specter-web\package.json`
- Modify: `C:\Users\manoj\SPECTER\specter-web\package-lock.json`

All SPECTER dependencies are installed in Prompt 1 so every subsequent prompt can import them without an install step.

- [ ] **Step 1: Install runtime dependencies**

Run from `C:\Users\manoj\SPECTER\specter-web`:

```powershell
npm install clsx tailwind-merge class-variance-authority lucide-react "@clerk/nextjs@5" "@tanstack/react-query@5" "zustand@4" "framer-motion@11" "gsap@3.12" "@react-three/fiber@8" three "@lenis/react@1" "recharts@2" "react-hook-form@7" "zod@3"
```

Expected: installs without errors. Peer dependency warnings about React versions from R3F or recharts are acceptable and do not block the build.

- [ ] **Step 2: Install dev dependencies**

```powershell
npm install -D @types/three
```

Expected: `@types/three` appears in `devDependencies` in `package.json`.

- [ ] **Step 3: Verify key packages are present**

```powershell
npm list clsx tailwind-merge next react --depth=0
```

Expected: all four listed with versions, no `UNMET` errors.

- [ ] **Step 4: Commit**

```powershell
git add package.json package-lock.json
git commit -m "chore: install all specter-web runtime and dev dependencies"
```

---

## Task 3: Configure Tailwind design tokens

**Files:**
- Overwrite: `C:\Users\manoj\SPECTER\specter-web\tailwind.config.ts`

- [ ] **Step 1: Replace tailwind.config.ts**

Write the following to `C:\Users\manoj\SPECTER\specter-web\tailwind.config.ts`:

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#06070D',
        surface: '#0D0F1A',
        border: '#1A1D2E',
        primary: '#00E87A',
        text: '#E8EAF0',
        muted: '#6B7280',
      },
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        body: ['var(--font-body)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
```

- [ ] **Step 2: Verify TypeScript accepts the config**

```powershell
npx tsc --noEmit
```

Expected: exits 0 with no errors.

- [ ] **Step 3: Commit**

```powershell
git add tailwind.config.ts
git commit -m "feat: configure Tailwind design tokens — dark intelligence palette and font families"
```

---

## Task 4: Write globals.css with CSS custom properties

**Files:**
- Overwrite: `C:\Users\manoj\SPECTER\specter-web\app\globals.css`

- [ ] **Step 1: Replace globals.css**

Write the following to `C:\Users\manoj\SPECTER\specter-web\app\globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  /* ── SPECTER design tokens ── */
  --bg: #06070D;
  --surface: #0D0F1A;
  --border: #1A1D2E;
  --primary: #00E87A;
  --text: #E8EAF0;
  --muted: #6B7280;

  /* ── shadcn/ui CSS variables — mapped to SPECTER palette ── */
  /* shadcn components read these HSL values; do not remove them */
  --background: 225 30% 4%;
  --foreground: 225 15% 91%;
  --card: 225 25% 7%;
  --card-foreground: 225 15% 91%;
  --popover: 225 25% 7%;
  --popover-foreground: 225 15% 91%;
  --primary: 152 100% 45%;
  --primary-foreground: 225 30% 4%;
  --secondary: 225 25% 11%;
  --secondary-foreground: 225 15% 91%;
  --muted: 225 20% 15%;
  --muted-foreground: 220 10% 44%;
  --accent: 152 100% 45%;
  --accent-foreground: 225 30% 4%;
  --destructive: 0 84% 60%;
  --destructive-foreground: 225 15% 91%;
  --border: 225 20% 14%;
  --input: 225 20% 14%;
  --ring: 152 100% 45%;
  --radius: 0.5rem;
}

* {
  box-sizing: border-box;
  padding: 0;
  margin: 0;
}

html,
body {
  max-width: 100vw;
  overflow-x: hidden;
}

body {
  background: var(--bg);
  color: var(--text);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

Note: `--primary`, `--muted`, and `--border` appear twice in this file — once as SPECTER hex tokens and once as shadcn HSL values. The shadcn HSL values overwrite the hex ones because they appear later in the `:root` block. This is intentional: shadcn components use the HSL format. Our Tailwind classes (`bg-primary`, `text-muted`, etc.) read from `tailwind.config.ts` which uses the hex values directly — they are not affected by the CSS variable.

- [ ] **Step 2: Commit**

```powershell
git add app/globals.css
git commit -m "feat: write globals.css — SPECTER tokens and shadcn/ui HSL variable mapping"
```

---

## Task 5: Configure root layout with fonts

**Files:**
- Overwrite: `C:\Users\manoj\SPECTER\specter-web\app\layout.tsx`

- [ ] **Step 1: Write app/layout.tsx**

Write the following to `C:\Users\manoj\SPECTER\specter-web\app\layout.tsx`:

```typescript
import type { Metadata } from 'next'
import { Syne, DM_Sans, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'SPECTER — Competitor Pricing Intelligence',
  description:
    'Know when competitors change price or go out of stock. AI-powered RAISE/LOWER/HOLD signals for Shopify merchants.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${syne.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}
    >
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 2: Verify TypeScript accepts the layout**

```powershell
npx tsc --noEmit
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```powershell
git add app/layout.tsx
git commit -m "feat: inject Syne, DM Sans, JetBrains Mono fonts via next/font/google"
```

---

## Task 6: Create lib/utils.ts with cn() utility

**Files:**
- Create: `C:\Users\manoj\SPECTER\specter-web\lib\utils.ts`

- [ ] **Step 1: Create the lib/ directory**

```powershell
New-Item -ItemType Directory -Path "lib" -Force
```

- [ ] **Step 2: Write lib/utils.ts**

Write the following to `C:\Users\manoj\SPECTER\specter-web\lib\utils.ts`:

```typescript
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 3: Verify**

```powershell
npx tsc --noEmit
```

Expected: exits 0.

- [ ] **Step 4: Commit**

```powershell
git add lib/utils.ts
git commit -m "feat: add cn() utility — clsx + tailwind-merge for conditional class merging"
```

---

## Task 7: Initialize shadcn/ui

**Files:**
- Create: `C:\Users\manoj\SPECTER\specter-web\components.json`
- Create: `C:\Users\manoj\SPECTER\specter-web\components\ui\` (directory)

shadcn/ui is initialized by creating `components.json` manually (more reliable in PowerShell than the interactive CLI). Future prompts use `npx shadcn@latest add <component>` which reads this file.

- [ ] **Step 1: Create components.json**

Write the following to `C:\Users\manoj\SPECTER\specter-web\components.json`:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

- [ ] **Step 2: Create components/ui/ directory**

```powershell
New-Item -ItemType Directory -Path "components\ui" -Force
```

- [ ] **Step 3: Verify shadcn reads the config correctly**

```powershell
npx shadcn@latest diff
```

Expected: exits without error and prints something like `No updates found.` or a list of available component updates. An error here means `components.json` is malformed — re-check the JSON syntax.

- [ ] **Step 4: Commit**

```powershell
git add components.json components\
git commit -m "feat: initialize shadcn/ui — components.json configured for SPECTER dark theme"
```

---

## Task 8: Create .env.local and verify .gitignore

**Files:**
- Create: `C:\Users\manoj\SPECTER\specter-web\.env.local`
- Verify: `C:\Users\manoj\SPECTER\specter-web\.gitignore`

- [ ] **Step 1: Create .env.local with all required keys (empty values)**

Write the following to `C:\Users\manoj\SPECTER\specter-web\.env.local`:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_API_URL=https://specter-api.railway.app
NEXT_PUBLIC_POSTHOG_KEY=
```

- [ ] **Step 2: Verify .gitignore excludes .env.local**

```powershell
Select-String "env" .gitignore
```

Expected: a line containing `.env.local` is printed. create-next-app adds this by default. If the line is missing, append it:

```powershell
Add-Content .gitignore "`n.env.local"
```

- [ ] **Step 3: Confirm .env.local is NOT staged by git**

```powershell
git status
```

Expected: `.env.local` does NOT appear anywhere in the output. If it does appear as an untracked file, `.gitignore` is not working — re-check Step 2.

- [ ] **Step 4: Commit .gitignore only if it was changed**

```powershell
git diff --name-only
```

If `.gitignore` appears in the diff, commit it:

```powershell
git add .gitignore
git commit -m "chore: ensure .env.local excluded from git tracking"
```

If `.gitignore` was already correct, skip the commit.

---

## Task 9: Write the design system smoke-test page

**Files:**
- Delete: `C:\Users\manoj\SPECTER\specter-web\app\page.tsx`
- Create: `C:\Users\manoj\SPECTER\specter-web\app\(marketing)\page.tsx`

`app/page.tsx` and `app/(marketing)/page.tsx` both define the `/` route — Next.js will error if both exist simultaneously.

- [ ] **Step 1: Remove the default app/page.tsx**

```powershell
Remove-Item "app\page.tsx" -Force
```

- [ ] **Step 2: Create the (marketing) route group directory**

```powershell
New-Item -ItemType Directory -Path "app\(marketing)" -Force
```

- [ ] **Step 3: Write the smoke-test page**

Write the following to `C:\Users\manoj\SPECTER\specter-web\app\(marketing)\page.tsx`:

```typescript
// SCAFFOLD SMOKE-TEST — replace this file's content with the real homepage in Prompt 3

export default function Home() {
  const tokens = [
    { name: 'bg', hex: '#06070D', cls: 'bg-bg border border-surface' },
    { name: 'surface', hex: '#0D0F1A', cls: 'bg-surface' },
    { name: 'border', hex: '#1A1D2E', cls: 'bg-border' },
    { name: 'primary', hex: '#00E87A', cls: 'bg-primary' },
    { name: 'text', hex: '#E8EAF0', cls: 'bg-text' },
    { name: 'muted', hex: '#6B7280', cls: 'bg-muted' },
  ]

  return (
    <main className="min-h-screen bg-bg p-12 font-body">
      {/* Color tokens */}
      <section className="mb-16">
        <h1 className="font-display text-3xl font-bold text-text mb-8">
          SPECTER — Design System Smoke Test
        </h1>
        <h2 className="font-display text-xl text-muted mb-6 uppercase tracking-widest text-sm">
          Color Tokens
        </h2>
        <div className="flex gap-6 flex-wrap">
          {tokens.map(({ name, hex, cls }) => (
            <div key={name} className="flex flex-col items-center gap-2">
              <div className={`w-20 h-20 rounded-lg ${cls}`} />
              <span className="font-body text-text text-sm">{name}</span>
              <span className="font-mono text-muted text-xs">{hex}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Typography */}
      <section className="mb-16 flex flex-col gap-5">
        <h2 className="font-display text-muted uppercase tracking-widest text-sm mb-2">
          Typography
        </h2>
        <p className="font-display text-5xl font-bold text-text leading-tight">
          SPECTER<span className="text-primary">.</span>
        </p>
        <p className="font-display text-lg text-muted">
          Syne — display font for headlines and badges
        </p>
        <p className="font-body text-lg text-text max-w-xl">
          Know before they move. DM Sans body text — readable and neutral at
          every size.
        </p>
        <code className="font-mono text-primary text-base bg-surface px-4 py-2 rounded-lg w-fit">
          {'const signal = "RAISE" // JetBrains Mono'}
        </code>
      </section>

      {/* Primary button */}
      <section>
        <h2 className="font-display text-muted uppercase tracking-widest text-sm mb-6">
          Primary Action
        </h2>
        <button className="bg-primary text-bg font-body font-semibold rounded-lg px-8 py-3 hover:opacity-90 transition-opacity text-base">
          Start Free Trial →
        </button>
      </section>
    </main>
  )
}
```

- [ ] **Step 4: Stage both the deletion and the new file**

```powershell
git rm app/page.tsx
git add "app/(marketing)/page.tsx"
```

- [ ] **Step 5: Verify TypeScript accepts the page**

```powershell
npx tsc --noEmit
```

Expected: exits 0.

- [ ] **Step 6: Commit**

```powershell
git commit -m "feat: design system smoke-test page — color tokens, typography, primary button"
```

---

## Task 10: Verify specter-web meets all success criteria

- [ ] **Step 1: Start the dev server**

Run from `C:\Users\manoj\SPECTER\specter-web`:

```powershell
npm run dev
```

Expected output:
```
▲ Next.js 14.2.x
- Local:        http://localhost:3000
✓ Ready in Xs
```

Leave this terminal running.

- [ ] **Step 2: Verify HTTP 200**

Open a second PowerShell window:

```powershell
(Invoke-WebRequest http://localhost:3000 -UseBasicParsing).StatusCode
```

Expected: `200`

- [ ] **Step 3: Visually verify the design system in browser**

Open `http://localhost:3000`. Confirm all of the following:

| Check | Expected |
|-------|----------|
| Page background | Very dark navy — `#06070D` |
| "SPECTER." headline | Syne font, heavy weight, large |
| Period after SPECTER | Bright green — `#00E87A` |
| Body paragraph | DM Sans (slightly different from headline) |
| Code snippet | Monospace font (JetBrains Mono), green text |
| Color swatches | 6 boxes visible with correct background fills |
| "Start Free Trial →" button | Green background, dark text |

If any font appears as the system default (Arial/Times), wait 3 seconds and hard-refresh — Next.js font system downloads from Google Fonts on first load.

- [ ] **Step 4: Stop the dev server (Ctrl+C) and run lint**

In the specter-web terminal:

```powershell
npm run lint
```

Expected: `✔ No ESLint warnings or errors` (or exits 0 with no output).

If lint reports errors, fix them and commit before continuing:

```powershell
npm run lint -- --fix
git add -A
git commit -m "fix: resolve lint errors from scaffold"
```

---

## Task 11: Scaffold specter-api

**Files:**
- Create: `C:\Users\manoj\SPECTER\specter-api\main.py`
- Create: `C:\Users\manoj\SPECTER\specter-api\pyproject.toml`
- Create: `C:\Users\manoj\SPECTER\specter-api\.gitignore`

- [ ] **Step 1: Create the specter-api directory and initialize git**

```powershell
New-Item -ItemType Directory -Path "C:\Users\manoj\SPECTER\specter-api" -Force
Set-Location "C:\Users\manoj\SPECTER\specter-api"
git init
```

Expected: `Initialized empty Git repository in C:/Users/manoj/SPECTER/specter-api/.git/`

- [ ] **Step 2: Write main.py**

Write the following to `C:\Users\manoj\SPECTER\specter-api\main.py`:

```python
from fastapi import FastAPI

app = FastAPI(title="specter-api", version="0.1.0")


@app.get("/health")
async def health():
    return {"status": "ok"}
```

- [ ] **Step 3: Write pyproject.toml**

Write the following to `C:\Users\manoj\SPECTER\specter-api\pyproject.toml`:

```toml
[project]
name = "specter-api"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "fastapi==0.111.*",
    "pydantic>=2.0,<3",
    "sqlalchemy>=2.0,<3",
    "alembic>=1.13,<2",
    "uvicorn[standard]>=0.29",
    "httpx>=0.27",
    "python-jose[cryptography]>=3.3",
]

[build-system]
requires = ["setuptools>=68"]
build-backend = "setuptools.backends.legacy:build"
```

- [ ] **Step 4: Write .gitignore**

Write the following to `C:\Users\manoj\SPECTER\specter-api\.gitignore`:

```
# Python
__pycache__/
*.py[cod]
*.pyo
*.pyd
.Python
*.egg-info/
dist/
build/
.eggs/

# Virtual environments
.venv/
venv/
env/

# Environment variables — NEVER commit these
.env
.env.local
.env.*
!.env.example

# IDE
.vscode/
.idea/
*.swp
*.swo

# Testing
.pytest_cache/
.coverage
htmlcov/

# Alembic compiled
alembic/versions/*.pyc
```

- [ ] **Step 5: Commit initial specter-api scaffold**

```powershell
git add main.py pyproject.toml .gitignore
git commit -m "chore: initial specter-api scaffold — FastAPI skeleton, pyproject.toml, gitignore"
```

---

## Task 12: Install Python dependencies and generate requirements.txt

**Files:**
- Create: `C:\Users\manoj\SPECTER\specter-api\requirements.txt`

- [ ] **Step 1: Install all dependencies**

Run from `C:\Users\manoj\SPECTER\specter-api`:

```powershell
pip install "fastapi==0.111.*" "pydantic>=2.0,<3" "sqlalchemy>=2.0,<3" "alembic>=1.13,<2" "uvicorn[standard]>=0.29" "httpx>=0.27" "python-jose[cryptography]>=3.3"
```

Expected: all packages install without errors. `cryptography` is a C extension — installation may take 30–60 seconds. If `python-jose` has a dependency conflict with an existing package, install it without `[cryptography]` first and re-run.

- [ ] **Step 2: Generate requirements.txt**

```powershell
pip freeze | Out-File -FilePath requirements.txt -Encoding utf8
```

- [ ] **Step 3: Verify requirements.txt contains key packages**

```powershell
Select-String "fastapi|uvicorn|sqlalchemy|alembic|pydantic" requirements.txt
```

Expected: each of those names appears at least once with a pinned version like `fastapi==0.111.1`.

- [ ] **Step 4: Commit**

```powershell
git add requirements.txt
git commit -m "chore: add requirements.txt from pip freeze — all specter-api dependencies pinned"
```

---

## Task 13: Verify specter-api meets all success criteria

- [ ] **Step 1: Verify all Python imports succeed**

```powershell
python -c "import fastapi, sqlalchemy, alembic, pydantic; print('ok')"
```

Expected: `ok`

If any import fails, check the error message for the missing package and install it with `pip install <package>`.

- [ ] **Step 2: Start uvicorn**

```powershell
uvicorn main:app --reload
```

Expected output (exactly):
```
INFO:     Will watch for changes in these directories: ['C:\\Users\\manoj\\SPECTER\\specter-api']
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [XXXX] using WatchFiles
INFO:     Started server process [XXXX]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

If uvicorn is not found on PATH, install it explicitly: `pip install uvicorn` then retry.

- [ ] **Step 3: Verify /health endpoint responds**

Open a second PowerShell window:

```powershell
(Invoke-WebRequest http://127.0.0.1:8000/health -UseBasicParsing).Content
```

Expected: `{"status":"ok"}`

- [ ] **Step 4: Stop uvicorn (Ctrl+C)**

---

## Task 14: Final verification — all four Prompt 1 success criteria

Run through this checklist in order. All four must pass before moving to Prompt 2.

- [ ] **Criterion 1: specter-web dev server + HTTP 200**

```powershell
Set-Location "C:\Users\manoj\SPECTER\specter-web"
npm run dev
# In a second terminal:
(Invoke-WebRequest http://localhost:3000 -UseBasicParsing).StatusCode
```

Expected: `200` + dark smoke-test page visible in browser

- [ ] **Criterion 2: specter-web lint passes**

```powershell
# Stop dev server first (Ctrl+C), then:
npm run lint
```

Expected: exits 0 — no errors, no warnings

- [ ] **Criterion 3: specter-api startup**

```powershell
Set-Location "C:\Users\manoj\SPECTER\specter-api"
uvicorn main:app --reload
```

Expected: `Application startup complete.` in the log

- [ ] **Criterion 4: Python imports**

```powershell
python -c "import fastapi, sqlalchemy, alembic, pydantic; print('ok')"
```

Expected: `ok`

- [ ] **Step 5: Verify .env.local is NOT in git history (critical rule)**

```powershell
Set-Location "C:\Users\manoj\SPECTER\specter-web"
git ls-files | Select-String "\.env"
```

Expected: **empty output** — no env files are tracked. If `.env.local` appears, remove it immediately:

```powershell
git rm --cached .env.local
git commit -m "fix: remove .env.local from git tracking"
```

---

## Notes for Prompt 2

- Both repos are initialized as separate git repos under `C:\Users\manoj\SPECTER\`
- The smoke-test `app/(marketing)/page.tsx` is intentionally minimal — Prompt 3 replaces its content entirely with the real hero section
- `components/ui/` is empty at the end of Prompt 1 — shadcn components are added per-prompt as needed
- Python packages are installed globally in this plan; if you prefer a virtual environment, run `python -m venv .venv` then `.venv\Scripts\Activate.ps1` before the pip install in Task 12
