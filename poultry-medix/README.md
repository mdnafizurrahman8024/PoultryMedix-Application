# PoultryMedix

A mobile-first poultry health app built with React and Vite.

## Getting started

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and set the Supabase values, `VITE_OPENWEATHER_API_KEY`, and server-only `GEMINI_API_KEY`. The Teachable Machine model URL is already configured in the example.
3. Start the development server with `npm run dev`.

The Supabase publishable/anon key, OpenWeather key, and Teachable Machine model URL are used in the browser. The Gemini key is read only by the Node API server and must never use a `VITE_` prefix. Never put a Supabase service-role key in a `VITE_` variable, and restrict the OpenWeather key to the app's allowed origins. Supabase Authentication powers password sign-in, phone OTP, and account registration. The dashboard requests browser geolocation permission to fetch current weather, UV index, and the nearest location.

`npm run dev` starts Vite and the authenticated AI API server. In production, build the frontend and run `npm start` to serve the frontend and API from the same Node process. The diagnosis endpoint requires a valid Supabase session, accepts up to four supported files (8 MB per file, 15 MB total), and limits users to eight AI requests per minute. It sends image/audio/PDF and symptom text to Gemini; image attachments are additionally classified with the configured Teachable Machine model in the browser. AI output is informational and not a veterinary diagnosis.

The dashboard includes editable guideline notes/image placeholders, local notice search, a local profile/settings dialog, and an emergency information dialog. Profile preferences, notification toggles, feedback, and the uploaded profile image are stored only in the current browser; notification delivery and feedback submission need a backend integration.

## Veterinary data features

Apply `supabase/migrations/202610100001_veterinary_data.sql` to the configured Supabase project before using the Data Hub or AMR map. The migration creates the authenticated `clinical_submissions` table, a private `clinical-submissions` Storage bucket, owner/officer RLS policies, and aggregate RPCs. Configure DLS/veterinary officer roles in Supabase **app metadata** (`dls_officer` or `vet_officer`); client-editable user metadata is not used for authorization. New contributions remain pending until an authorized officer changes their status to `verified`. The map only returns rounded location cells with at least five distinct contributors per displayed antimicrobial grouping.

Apply `supabase/migrations/202610100002_clinical_flock_logs.sql` after the veterinary-data migration to enable the separate Clinical Log. It creates private flock records with row-level security limited to the owning authenticated user; these personal treatment records are not research submissions and do not feed the AMR map. The Clinical Log's **Export PDF report** button opens a print-ready report in a new tab; select **Save as PDF** in the browser's print dialog. Pop-ups must be allowed for this action.

The Data Hub accepts the fixed seven clinical topics and stores uploaded media privately. Location is not included unless the contributor explicitly opts in; opted-in coordinates are rounded to two decimal places. The map uses OpenStreetMap tiles, whose service receives map-tile requests. Review and accept the applicable OpenStreetMap tile usage policy before production deployment.

The prescription lookup currently uses a small local demonstration catalogue, not a connected medicines database or a PDF OCR service. It does not read or verify prescription contents. Withdrawal guidance is product- and jurisdiction-specific; unknown periods are intentionally not guessed. The dose helper only multiplies a veterinarian-prescribed mg/kg value by the entered bird weight; it does not recommend a medicine, dose, route, or duration. Expand the catalogue only with current, locally verified official references and product-label data. Diagnosis results link to external DLS-related video search results, which are not individually vetted by the app.

## Language

The app provides a shared `LanguageProvider` with English (`en`) and Bengali (`bn`) translations. Use `useLanguage()` to access the selected language, `setLanguage`, and the `t(key)` translation function. The selected language also updates the document's `lang` attribute.

## Checks

- `npm run lint`
- `npm run build`
