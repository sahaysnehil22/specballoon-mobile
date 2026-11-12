# SpecBalloon Mobile — DATUM STUDIO on Android & iOS

Autonomous 2D CAD metrology / auto-ballooning for manufacturing QA, as a
**React Native (Expo SDK 58, TypeScript)** app — one codebase for Android and
iOS. Team Krynex (Startup Buildathon India 2026): Snehil Sahay, Dhyey Patel,
Kartikey Singh, Kislay Kumar.

It is the mobile companion to the SpecBalloon web app
([spec-balloon.vercel.app](https://spec-balloon.vercel.app),
repo [DhyeyPatel007/SpecBalloon](https://github.com/DhyeyPatel007/SpecBalloon),
MIT). The app **talks to the existing Python FastAPI backend** — it does not
rewrite it, and it invents no endpoints.

Theme: **DATUM STUDIO** — Oxide Graphite `#0B0B0A`, Anodized Stone `#E6E5E0`,
Micrometer Safety Orange `#EA580C`, Cobalt `#0284C7`, Ink `#09090B`.

## Screens

| Tab / screen | What it does | Backend call |
|---|---|---|
| **Home** (Dashboard) | Backend status, current drawing, PASS/WARN/FAIL summary, pipeline stages, recent drawings | `GET /api/v1/health` |
| **Upload** | Pick a vector PDF (document picker) or photograph the drawing as a field reference; runs extraction automatically | `POST /api/v1/drawings`, then `POST /api/v1/drawings/{id}/extract` |
| **Viewer** (stack) | Schematic sheet with numbered balloon markers, drag-to-pan, zoom buttons, tap a balloon for its callout + verification crop | `GET /api/v1/drawings/{id}/balloons` |
| **Tape** | Characteristic list — nominal, ±tolerances, USL/LSL, measured value, verdict; search + PASS/WARN/FAIL/review filters | local state from extraction |
| **Form 3** | 14-column AS9102 Rev C sheet; export Excel + ballooned PDF via the native share sheet | `POST /api/v1/drawings/{id}/exports/excel`, `POST /api/v1/drawings/{id}/exports/ballooned-pdf` |
| **Caliper** | Big digital readout, manual entry + simulated pulse, lot readings with on-device Cp/Cpk | `PATCH /api/v1/balloons/{char_id}` (`measured_value`) |
| **Settings** | Backend base URL (persisted), connection test, backend info, about | `GET /api/v1/health` |

Navigation is **Expo Router** (file-based, routes in `src/app/`): tabs for
Home / Upload / Tape / Caliper / Settings, stack screens for Viewer and Form 3.

## Run it

```bash
cd specballoon-mobile
npm install
npx expo start          # then press a (Android) / i (iOS) / w (web)
```

- **Android:** Expo Go on a physical device, or an emulator (`npm run android`).
- **iOS:** Expo Go on a physical iPhone, or a Simulator on macOS (`npm run ios`).
  iOS builds need macOS/Xcode; on other machines use Expo Go or EAS Build.
- **Development build:** all native modules used here (document picker, image
  picker, file system, sharing) ship in Expo Go, so no dev build is required.
- **Typecheck / lint:** `npx tsc --noEmit`, `npx expo lint`, `npx expo-doctor`.

## Point it at the backend

Settings → Backend URL. Default is `http://localhost:8000` (the FastAPI dev
server). On a **physical phone, `localhost` means the phone itself** — use your
laptop's LAN IP instead (e.g. `http://192.168.1.20:8000`), or the deployed
Render URL. The backend must be reachable from the phone; the app shows
`BACKEND OFFLINE` on Home when it is not.

To run the backend locally (from the web repo):

```bash
cd <SpecBalloon repo>/backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

No API key is needed for the core pipeline. Gemini Vision symbol resolution
is optional and configured server-side (`GEMINI_API_KEY`); the app only reads
the backend's `vision_configured` flag from the health response.

## Demo without a backend

Home → **Load demo** (or Tape/Upload when empty) loads the AS-4092-C
Aerospace Hydraulic Actuator Housing sample — the same 17-characteristic
benchmark dataset from the web repo's `backend/sample_data.py`, copied verbatim
into `src/data/sampleDrawing.ts`. It is always labelled **SAMPLE DATA** and is
never presented as a real customer drawing. With the backend reachable, the
same demo comes from `POST /api/v1/drawings/demo-as4092c/extract?demo=true`.

## What's real vs placeholder

**Real (wired to the backend):** PDF upload + extraction, balloon positions
and limits, characteristic edits via PATCH, measured-value sync, AS9102 Excel
and ballooned-PDF exports, health/version/vision status.

**Real but local:** PASS/WARN/FAIL verdicts and Cp/Cpk are computed on-device
from the backend's limits (same definitions as the web workspace's Bay 04);
the lot history lives on-device and is also PATCHed to the backend as the
latest `measured_value`.

**Placeholder / schematic:** the Viewer draws a schematic sheet (grid +
outline) instead of the real drawing page — see gaps below. The caliper pulse
is simulated (see below). The field photo from the camera is a local reference
only and is never sent to the backend.

## Honest gaps (things the backend does not expose — not faked)

1. **No list-drawings endpoint.** The backend has no `GET /api/v1/drawings`.
   "Recent drawings" on Home is local metadata only; re-opening an uploaded
   drawing requires re-uploading it (the demo reloads locally).
2. **No PDF page rendering.** No endpoint returns a drawing page as an image,
   so the Viewer cannot show the real blueprint — it renders a schematic sheet
   with balloons placed at the backend's real `balloonPosition` coordinates,
   plus the per-characteristic `crop_base64` verification images the backend
   does return. Adding a page-render endpoint would fix this in one place.
3. **No USB-HID caliper on phones.** The web workspace reads live Mitutoyo
   pulses over USB-HID; phones have no HID host path for calipers. The Caliper
   screen simulates the pulse and accepts manual entry instead.
4. **Lot history is local.** The backend stores only the latest
   `measured_value` per characteristic (via PATCH); the full lot list and
   Cp/Cpk history live in the app. A lot-history endpoint would be needed to
   share measurements across devices.
5. **No auth / multi-user.** The backend has no auth; the app assumes a
   single trusted device on the shop floor, like the web workspace.
6. **Ballooned PDF export is circles-only.** The backend's
   `/exports/ballooned-pdf` draws balloon circles on a blank page sized to the
   drawing — it does not overlay them on the original PDF. Same limitation as
   the web app; fixing it belongs in the backend.

## Project layout

```
specballoon-mobile/
  app.json                 Expo config (scheme specballoon, expo-router plugin)
  src/
    app/                   Expo Router routes
      _layout.tsx          Root stack + StoreProvider
      (tabs)/              Home, Upload, Tape, Caliper, Settings
      viewer.tsx           Ballooned drawing viewer
      form3.tsx            AS9102 Form 3 sheet + exports
    api.ts                 FastAPI client (all routes in backend/main.py)
    store.tsx              App state + AsyncStorage persistence
    theme.ts               DATUM STUDIO colours
    types.ts               DrawingMeta / Characteristic / pipeline stages
    utils/metrology.ts     Verdict + Cp/Cpk math
    components/ui.tsx      Screen shell, buttons, badges, tape row
    data/sampleDrawing.ts  AS-4092-C demo dataset (from backend/sample_data.py)
```

## Verification

- `npm install` — clean.
- `npx tsc --noEmit` — clean (exit 0).
- `npx expo-doctor` — 20/20 checks passed.
- Not yet run on a physical device/emulator — needs a phone or emulator with
  Expo Go and a reachable backend (see above).
