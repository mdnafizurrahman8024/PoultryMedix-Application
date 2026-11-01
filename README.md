<!-- ───────────────────────── HERO BANNER ───────────────────────── -->
<div align="center">

<img src="public/images/logo.png" alt="PoultryMedix logo" width="120" height="120" />

# 🩺 PoultryMedix

### AI-powered poultry triage, prescription intelligence & AMR surveillance for marginal farmers of Bangladesh

**One Health at the farm gate — diagnose faster, medicate responsibly, protect
the food chain.**

<br/>

[![Primary Language](<https://img.shields.io/badge/JavaScript_(React_19)-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black>)](https://react.dev/)
[![Framework](https://img.shields.io/badge/Vite_+_TanStack_Router-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Backend](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![License](https://img.shields.io/badge/License-MIT-1C4C34?style=for-the-badge&logo=opensourceinitiative&logoColor=white)](./LICENSE)
[![Status](https://img.shields.io/badge/Status-Active_Development-orange?style=for-the-badge&logo=statuspage&logoColor=white)](#-future-roadmap)
[![Author](https://img.shields.io/badge/Author-Md._Nafizur_Rahman-0F4C81?style=for-the-badge&logo=github&logoColor=white)](https://github.com/mdnafizurrahman8024)

<br/>

📱 **Mobile-first** · 🌐 **4 Languages** (EN · বাংলা · हिंदी · اردو) · 📴
**Offline-tolerant** · 🧬 **One Health aligned**

</div>

---

## 📖 Overview

**PoultryMedix** is an AI-driven veterinary diagnostic and epidemiological
platform designed for **marginal poultry farmers in Bangladesh**. Rooted in the
**"One Health"** framework, it uses multi-modal AI (image, audio, and
natural-language chat) to help farmers identify poultry diseases early, and
actively combats **Antimicrobial Resistance (AMR)** by enforcing **medication
withdrawal periods** through automated prescription scanning.

The application is built as a **progressive, mobile-first web app** with a warm,
high-contrast "glassmorphism" design language tailored for field use — large
touch targets, bilingual typography, low-bandwidth friendliness, and a
**national livestock hotline (16358)** one tap away.

> 💡 **Why it matters** — Misdiagnosis and over-the-counter antibiotic misuse on
> smallholder farms are major drivers of AMR. PoultryMedix puts guideline-grade
> triage and drug-withdrawal knowledge in the farmer's pocket, then turns the
> same interactions into anonymized surveillance data for researchers and
> veterinary authorities.

---

## ✨ Key Features

- **🤖 AI Diagnosis Chat** — Multi-modal triage via **photo upload**,
  **microphone recording**, or **free-text symptom description**, with a layered
  fallback strategy: _local validated knowledge base → trusted online search →
  cloud AI_, and every answer is tagged with its source.
- **📷 Prescription Scanner (AMR enforcer)** — Photograph a medicine strip or
  prescription and get the **trade name → generic name → dose**, plus **meat/egg
  withdrawal periods** for both **Bangladesh DLS local rules** and **WHO/OIE
  international guidelines**.
- **💊 Drug Withdrawal Info Hub** — Searchable reference for critical
  antimicrobials (e.g. _Enrofloxacin 10% — fluoroquinolone, critically
  important_) including "not for laying hens" flags.
- **🗺️ Anonymised Outbreak Map** — District-level disease heat mapping with
  severity legends, filterable by disease type, plus a **Vet View** toggle
  exposing aggregated reports, mortality rate, AMR index and a 7-day trend
  chart.
- **📊 Community Data Hub** — Farmers contribute disease images, acoustic
  samples, GPS location and voice notes; contributions are **synced when
  connectivity returns** and rewarded with **research points (+20 pts)**.
- **🔄 Offline-tolerant submissions** — Submissions are queued locally and
  flagged _"Offline — will sync"_ so field data is never lost in low-coverage
  areas.
- **📢 Govt Noticeboard** — Auto-updated bulletins (AMR alerts, outbreaks, free
  vaccination camps) styled after **DLS & Upazila Livestock Office**
  communications.
- **🌤️ Weather & Heat-Stress Card** — Live temperature, humidity, wind and UV
  index with **heat-stress advisory** for flock ventilation and cooling.
- **🎙️ Voice Typing & Multilingual UI** — Full **English, Bangla, Hindi, Urdu**
  interface with RTL support for Urdu and browser speech-recognition for
  hands-free symptom entry.
- **📄 Case History & PDF Export** — Timestamped diagnostic log with status
  chips, one-click **print/PDF report** for sharing with a registered
  veterinarian.
- **🚨 SOS Hotline** — Instant dial to the national livestock emergency number
  **16358**.

---

## 🧰 Tech Stack

| Layer             | Technology                                                                                                   |
| :---------------- | :----------------------------------------------------------------------------------------------------------- |
| **UI Framework**  | React 19 + JSX, TypeScript-style props, `lucide-react` icon set                                              |
| **Routing / SSR** | TanStack Router (file-based) + TanStack Start server entry                                                   |
| **Build Tool**    | Vite 4 (`@vitejs/plugin-react`), PostCSS + Autoprefixer                                                      |
| **Styling**       | Tailwind CSS v4 (`@import "tailwindcss"`), `tw-animate-css`, custom `oklch()` design tokens                  |
| **Animation**     | Framer Motion, Tailwind `animate-in` / `fade-in` utilities                                                   |
| **Maps**          | Leaflet + React-Leaflet (bundled with an inline SVG fallback map)                                            |
| **AI / ML**       | Teachable Machine image model (`@teachablemachine/image`), cloud AI fallback, browser Speech Recognition API |
| **Backend / DB**  | Supabase (PostgreSQL, `documents` table) via `@supabase/supabase-js`                                         |
| **Server**        | Express 5 API layer proxied at `/api` → `127.0.0.1:8787`                                                     |
| **Design System** | 50+ shadcn-style primitives in `src/components/ui` (dialog, sheet, chart, table, toast…)                     |
| **Tooling**       | ESLint, Prettier, Vitest + Testing Library, Bun lockfile (in `Extra/`)                                       |

---

## 🏗️ Architecture & Directory Tree

```
PoultryMedix-Application/
├── 📄 index.html                  # Vite entry shell (theme-color, meta, root node)
├── ⚙️ vite.config.js              # React plugin · /api proxy · envDir → poultry-medix/
├── 📦 package.json                # Dependencies + dev / build / preview scripts
├── 📜 LICENSE                     # MIT © 2026 Md Nafizur Rahman
│
├── 🌐 public/
│   ├── favicon.png · robots.txt
│   └── images/                    # logo, team portraits, chat icon
│
├── 💻 src/
│   ├── 🧭 routes/                 # File-based TanStack routes
│   │   ├── __root.tsx             # App shell (root layout)
│   │   ├── index.tsx              # Main experience: onboarding → home → AI flows
│   │   └── routeTree.gen.ts       # Auto-generated route tree (do not edit)
│   ├── 🧩 components/
│   │   ├── pm/                    # Product copy + i18n dictionaries (EN/BN/HI/UR)
│   │   └── ui/                    # 50+ reusable shadcn-style primitives
│   ├── 🪝 hooks/                  # use-mobile and shared hooks
│   ├── 🔌 lib/                    # supabaseClient, error capture & error page, utils
│   ├── 🎨 assets/                 # Logo & lead-image asset manifests
│   ├── 🧪 test/                   # Vitest setup + app-routing tests
│   ├── styles.css                 # Tailwind v4 theme (@theme inline, oklch tokens)
│   ├── server.ts                  # SSR entry with h3 error normalisation
│   └── start.ts                   # TanStack Start bootstrap
│
├── 📱 poultry-medix/              # Nested workspace (server, scripts, supabase, src)
│   ├── server/ · scripts/ · supabase/
│   └── .env                       # VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
│
├── 🧰 Extra/                      # Dev tooling: ESLint, Prettier, tsconfig, vitest,
│   └── AGENTS.md, components.json, bun.lock
│
└── 📦 dist/                       # Production build output
```

### 🔄 Runtime Flow

```
        ┌────────────┐   photo / audio / text   ┌─────────────────────┐
Farmer ─▶│ React App  │ ───────────────────────▶ │ Local Knowledge Base│
        │ (mobile-   │                          └──────────┬──────────┘
        │  first UI) │   no local match                    │ miss
        └─────┬──────┘ ◀───────────────────────────────────┘
              │                    │
              │                    ▼
              │          ┌────────────────────┐   ┌──────────────────┐
              │          │ Trusted Web Search │──▶│  Cloud AI Model  │
              │          └────────────────────┘   └──────────────────┘
              │ evidence + source tag
              ▼
     ┌──────────────────┐        ┌──────────────────────────┐
     │ Supabase (PG)    │◀──────▶│ Anonymous Outbreak Layer │
     │ documents table  │        │ district heat map / stats│
     └──────────────────┘        └──────────────────────────┘
```

---

## 🚀 Installation & Quickstart

### ✅ Prerequisites

- **Node.js ≥ 18** (or **Bun** — a `bun.lock` is provided in `Extra/`)
- A **Supabase** project with a `documents` table
- Optional: an API key for your preferred cloud-AI fallback

### 1️⃣ Clone the repository

```bash
git clone https://github.com/mdnafizurrahman8024/PoultryMedix-Application.git
cd PoultryMedix-Application
```

### 2️⃣ Install dependencies

```bash
npm install
# or: bun install
```

### 3️⃣ Configure environment variables

Create `poultry-medix/.env` (the Vite `envDir`) and add:

```env
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-public-key>
```

> ⚠️ The app **fails fast** on startup if either key is missing — this is
> intentional so a misconfigured deployment never silently runs without a
> database.

### 4️⃣ Start the development server

```bash
npm run dev
```

Open **http://localhost:5173**. API calls to `/api/*` are proxied to
`http://127.0.0.1:8787`.

### 5️⃣ Build for production

```bash
npm run build      # outputs to dist/
npm run preview    # serve the production bundle locally
```

### 🧫 Verify the database connection

On boot the app calls `checkSupabaseConnection()`, which probes the `documents`
table. A successful check logs:

```text
Supabase connected; documents table is reachable.
```

---

## 🗺️ Future Roadmap

| Status         | Milestone                                                      |
| :------------- | :------------------------------------------------------------- |
| ✅ Done        | Multi-language UI (EN · বাংলা · हिंदी · اردو) with RTL support |
| ✅ Done        | Prescription scanner with DLS + WHO/OIE withdrawal comparisons |
| ✅ Done        | Anonymised district outbreak heat map & Vet View analytics     |
| 🔄 In progress | On-device (offline) inference for image and audio triage       |
| 🔄 In progress | Bangla voice input end-to-end (community-requested feature)    |
| 🧭 Planned     | Vaccine-schedule reminders per flock & age cohort              |
| 🧭 Planned     | Full offline sync engine with conflict resolution              |
| 🧭 Planned     | Researcher dashboard + CSV/OSF-ready exports of AMR datasets   |
| 🧭 Planned     | Regional expansion beyond Bangladesh (Nepal, India, Sri Lanka) |
| 🧭 Planned     | Installable PWA with push notifications for outbreak alerts    |

---

## 🤝 Contributing

Contributions, field feedback and veterinary review are all welcome!

```bash
git checkout -b feature/your-feature-name
git commit -m "feat: describe your change"
git push origin feature/your-feature-name
```

Then open a **Pull Request**. For data-model changes, please run the test suite
first:

```bash
npx vitest run
```

Licensed under **MIT** — see [LICENSE](./LICENSE).

---

<br/>

<!-- ───────────────────────── AUTHOR ───────────────────────── -->
<div align="center">

## 👨‍🔬 Author & Connect

### Md. Nafizur Rahman

**Undergraduate Student** · Faculty of Veterinary and Animal Sciences<br/>
University of Rajshahi, Rajshahi-6205, Bangladesh

<br/>

[![Email](https://img.shields.io/badge/Email-s2210968138%40ru.ac.bd-0F4C81?style=for-the-badge&logo=gmail&logoColor=white)](mailto:s2210968138@ru.ac.bd)
[![WhatsApp](https://img.shields.io/badge/WhatsApp-%2B8801949288024-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://wa.me/8801949288024)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-md--nafizur--rahman--ru-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white)](http://www.linkedin.com/in/md-nafizur-rahman-ru)
[![GitHub](https://img.shields.io/badge/GitHub-mdnafizurrahman8024-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/mdnafizurrahman8024)

<br/>

[![CV](https://img.shields.io/badge/📄_Curriculum_Vitae-View-1B4D8C?style=for-the-badge&logo=googledrive&logoColor=white)](https://drive.google.com/file/d/106-eTtiqsvXZ9PIY_shcyWJX9kR66uq9/view?usp=drive_link)
[![Portfolio](https://img.shields.io/badge/🌐_Portfolio-Explore-5AA9E6?style=for-the-badge&logo=googlechrome&logoColor=white)](https://sites.google.com/view/md-nafizur-rahman/home)
[![Facebook](https://img.shields.io/badge/Facebook-mdnafizurrahman8024-1877F2?style=for-the-badge&logo=facebook&logoColor=white)](https://www.facebook.com/mdnafizurrahman8024/)

<br/>

**Research Identifiers**

[![ORCID](https://img.shields.io/badge/ORCID-0009--0008--3918--187X-A6CE39?style=for-the-badge&logo=orcid&logoColor=white)](https://orcid.org/0009-0008-3918-187X)
[![Google Scholar](https://img.shields.io/badge/Google_Scholar-bImpEzMAAAAJ-4285F4?style=for-the-badge&logo=googlescholar&logoColor=white)](https://scholar.google.com/citations?user=bImpEzMAAAAJ&hl=en)
[![ResearchGate](https://img.shields.io/badge/ResearchGate-Md--Rahman--1097-00CCBB?style=for-the-badge&logo=researchgate&logoColor=white)](https://www.researchgate.net/profile/Md-Rahman-1097)
[![OSF](https://img.shields.io/badge/OSF-10.17605%2FOSF.IO%2F9AQS3-2F3136?style=for-the-badge&logo=osf&logoColor=white)](https://doi.org/10.17605/OSF.IO/9AQS3)

<br/>

**Contact**

📧 [s2210968138@ru.ac.bd](mailto:s2210968138@ru.ac.bd) &nbsp;·&nbsp; 📞
[+8801949288024](https://wa.me/8801949288024) &nbsp;·&nbsp; 📍 Rajshahi-6205,
Bangladesh

</div>

<br/>

<img width="100%" src="https://capsule-render.vercel.app/api?type=waving&color=0:1C4C34,50:2E8B57,100:5AA9E6&height=110&section=footer&animation=fadeIn" alt="" />

<div align="center">

<sub>⭐ <i>Healthier flocks, smarter veterinary care — from molecules to models,
one commit at a time.</i></sub>

</div>
