# Workout Planner

A personal workout planner for one person. It is a static installable web app: phone-first, dark, and usable on a desktop browser. Videos play from your personal OneDrive. The catalog and your logs stay out of this repository.

## What you do once

1. Register an Azure app and confirm `public/config.json`.
2. Generate `library.json` from your local source files and upload it to OneDrive.
3. Turn on GitHub Pages (the workflow is already in the repo).
4. Open the site, sign in, and add it to the iPhone Home Screen.

## Azure app registration

Use a personal Microsoft account (consumer OneDrive), not a work or school account.

1. Open Azure app registrations and create a registration.
2. Name it `Workout Planner`.
3. Supported account types: **Personal Microsoft accounts only**.
4. Redirect URI platform: **Single-page application**. Do not choose Web. This app uses the authorization code flow with PKCE. Do not create a client secret.
5. Register these redirect URIs exactly, including the trailing slash:

   - `http://localhost:5173/`
   - `https://cra1gmanning.github.io/WOP/`

   Optional, only if you preview a production build locally with `GITHUB_PAGES=true`: `http://localhost:4173/WOP/`.

6. Delegated Microsoft Graph permissions:

   - `Files.ReadWrite`
   - `offline_access`
   - `User.Read`

The client ID is already in [`public/config.json`](public/config.json). The authority stays `https://login.microsoftonline.com/consumers`. An SPA client ID is public; it is not a secret.

Tokens are cached in `localStorage`.

## OneDrive folder

The app looks for files under a folder you can change in Settings. The default is `/Workouts`.

- Library: `/Workouts/_app/library.json`
- Logs: `/Workouts/_app/state.json`
- Exercise bookmarks (optional): `/Workouts/_app/chapters.json`

If you use a different folder name, rename it in OneDrive and save the same name in Settings. Do not commit the library file.

## Generate the library

Keep the source spreadsheets and notes outside git. `spec/` and `library.json` are gitignored. See [CONTRIBUTING.md](CONTRIBUTING.md).

```bash
npm install
npm run generate -- --spec ./spec --out ./library.json
```

The script looks for `Catalog.csv` in that folder or one directory down. Upload `library.json` to `/Workouts/_app/library.json` (or whatever folder you saved in Settings). Video files stay in that same OneDrive folder, using the relative paths from your source sheet.

## Exercise bookmarks

Follow-along videos can show the exercises in that file. On a phone the list sits under the player. On a wider window it sits beside it. Each row is the exercise name and its start time as `m:ss`. The row for the exercise at the playhead is marked Now. Tap a name to seek there and play. Hide the video when you want the list as a checklist; marks you tick stay on that screen only.

`chapters.json` is optional. If the file is missing, or a video has no entry, the player does not change. Keys are the same relative paths stored on videos in `library.json`. `t` is seconds from the start. `name` is required. `note` is optional.

```json
{
  "version": 1,
  "videos": {
    "drills/session-a/flow.mp4": [
      { "t": 0, "name": "Shoulder rolls" },
      { "t": 95, "name": "Squat hold", "note": "easy pace" }
    ]
  }
}
```

Upload it next to `library.json`, then tap Reload library. The phone and the PC both read this file. Do not commit it. A bookmark seek uses the playback link already loaded for that video. If that link has expired, the app requests a fresh one and then seeks to the same time.

## Run it locally

```bash
npm install
npm test
npm run dev
```

Dev server: `http://localhost:5173/`.

To click through the planner before signing in, generate a library and copy it to `public/preview-library.json` (gitignored), then open `http://localhost:5173/?preview=1`. An optional `public/preview-chapters.json` (also gitignored) fills the exercise list. Preview does not play OneDrive videos.

## Pages

The workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml) runs tests, builds with base path `/WOP/`, and deploys to GitHub Pages on every push to `main`.

Site: `https://cra1gmanning.github.io/WOP/`

In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

A public repository is the setup that opens on an iPhone without an extra login. The repository must not contain the catalog, videos, or personal notes. [`.github/workflows/public-scan.yml`](.github/workflows/public-scan.yml) fails the build if blocked text or media is committed.

## Install on iPhone

1. Open `https://cra1gmanning.github.io/WOP/` in Safari.
2. Tap Share → **Add to Home Screen**.
3. Open the icon and sign in there. The icon does not share storage with a Safari tab.
4. On Wi-Fi, open Today and tap **Save videos on this phone** before you rely on a weak signal.

iOS can reclaim saved video bytes. Save the current workout, not the whole library. Seeking uses OneDrive's pre-authenticated download URL. The app refreshes that URL after about 45 minutes and again if the player errors. Exercise bookmarks seek the same way, including after that refresh.

On a Windows PC, use any current browser at the same URL. The phone and the PC share logs through `state.json`.

## How sync works

The planner is local-first in IndexedDB. After a change it waits a moment, reads `state.json`, merges, and writes the result back.

Merge is last-write-wins per slot, per day, per log entry, per favorite, and per habit check. The unlocked habit only moves forward. A cleared day replaces that whole day.

## Scripts

| Command | What it does |
| --- | --- |
| `npm test` | Scanner self-test, repository scan, then Vitest |
| `npm run lint` | `tsc --noEmit` |
| `npm run dev` | Vite on port 5173 |
| `npm run generate -- --spec ./spec --out ./library.json` | Build the OneDrive catalog |
| `npm run build` | Typecheck and production build. Set `GITHUB_PAGES=true` for the `/WOP/` base |
| `npm run check-public` | Denylist scan of tracked files |

`npm install` points Git at `.githooks`, so commits run the same scan.
