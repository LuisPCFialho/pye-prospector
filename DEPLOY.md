# Deployment & Release Guide — PYE Prospector

This is the operational runbook for building, signing, releasing, and
auto-updating the desktop app. Distribution is **private/controlled** (only the
owner and explicitly authorized users), so embedded API keys are an accepted
risk — see "Secrets" below.

---

## 1. Prerequisites

- **Node.js 20+** and **npm**
- **Rust** (stable) + the platform build tools (MSVC on Windows)
- A local `.env` (never committed) with the embedded keys:
  ```
  VITE_MAPTILER_API_KEY=...
  VITE_GEMINI_API_KEY=...
  ```
  Without these, the app still runs: satellite falls back to the free OSM
  raster, and Gemini features fall back to mock content.

---

## 2. Local build

```bash
npm ci
npm run lint        # 0 errors
npm run test:run    # all unit tests green
npm run build       # tsc -b + vite build (frontend)
npm run tauri build # produces the installers below
```

Artifacts (Windows):
- `src-tauri/target/release/pye-prospector.exe` (raw binary)
- `src-tauri/target/release/bundle/msi/PYE Prospector_<ver>_x64_en-US.msi`
- `src-tauri/target/release/bundle/nsis/PYE Prospector_<ver>_x64-setup.exe`

---

## 3. CI

`.github/workflows/ci.yml` runs on every push/PR to `main`: install → lint →
unit tests → frontend build. Keep it green before tagging a release.

---

## 4. Auto-updater (already wired)

The app checks for updates on startup (`src/lib/updater.ts`), asks the user,
then installs and relaunches. The Tauri config is in place:
- `src-tauri/tauri.conf.json` → `plugins.updater.pubkey` + `endpoints`
- `bundle.createUpdaterArtifacts: true`
- Rust plugins registered in `src-tauri/src/lib.rs`
- Permissions in `src-tauri/capabilities/default.json`

**Signing keypair** was generated with `tauri signer generate`:
- Public key → committed in `tauri.conf.json` (safe).
- **Private key → `src-tauri/pye-updater.key` (gitignored, NEVER commit).**
  Keep a backup somewhere safe. If lost, you cannot sign updates and the
  updater breaks for all installed clients.

### One-time setup before the first release

Add these **GitHub repo secrets** (Settings → Secrets and variables → Actions):

| Secret | Value |
|--------|-------|
| `TAURI_SIGNING_PRIVATE_KEY` | full contents of `src-tauri/pye-updater.key` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | the key password (empty string if none) |
| `VITE_MAPTILER_API_KEY` | your MapTiler key (so CI builds include it) |
| `VITE_GEMINI_API_KEY` | your Gemini key |

### Cutting a release

```bash
# bump version in package.json AND src-tauri/tauri.conf.json (keep them in sync)
git commit -am "chore: release v0.2.0"
git tag v0.2.0
git push origin main --tags
```

`.github/workflows/release.yml` then builds + signs on `windows-latest`,
publishes a **draft** GitHub Release with the installers and `latest.json`.
Review the draft, then publish it. Installed apps pointing at
`releases/latest/download/latest.json` will offer the update on next launch.

---

## 5. Code signing (manual — not automated, needs a paid certificate)

Unsigned installers trigger Windows SmartScreen ("unknown publisher"). To remove
that friction you need an **OV or EV code-signing certificate** (paid, issued to
a verified identity — cannot be automated here). Once you have one:

1. Import the cert / configure the signing tool (e.g. `signtool`, or an HSM/EV
   token provider).
2. Add the Tauri Windows signing config under `bundle.windows` in
   `tauri.conf.json` (`certificateThumbprint`, `digestAlgorithm`, `timestampUrl`).
3. Rebuild — the installers will be signed.

Until then, recipients can install by choosing "More info → Run anyway".

---

## 6. Post-build smoke test (do this once per release)

The app ships a Content-Security-Policy (`tauri.conf.json` → `security.csp`).
**Launch the built app once and confirm the map renders** (satellite tiles,
buildings, kWp labels). If the map is blank, the CSP is likely too strict —
loosen `connect-src`/`img-src` or temporarily set `csp` to `null`, and re-test.

---

## 7. Security invariants (do not regress)

- `.env` and `*.key` are gitignored — never commit secrets.
- CSV export keeps the formula-injection guard (`src/lib/csv.ts`).
- `open_url` / `sanitizeUrl` only allow `http`/`https`.
- All SQL stays parameterized.
- Public endpoints are rate-limited (Nominatim ≤1 req/s, Overpass, Gemini).

---

## 8. Notes

- **License:** the repo is currently MIT (`LICENSE`). For a commercial tool with
  embedded keys you may want a proprietary "all rights reserved" license instead
  — reconsider before making the repo widely visible.
- Recurring CI/release minutes are billed by GitHub for private repos.
