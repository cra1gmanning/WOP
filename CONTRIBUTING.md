# Contributing

Workout catalogs, lesson notes, and video files never go in this repository. Generate `library.json` on your machine and upload it to your OneDrive folder (`/Workouts/_app/` by default). Optional exercise bookmarks live in `chapters.json` in that same folder. `spec/`, `library.json`, `chapters.json`, and video files are gitignored.

Before you commit, `npm install` installs a git hook that runs `node scripts/check-public.mjs`. The same scan runs in GitHub Actions on every push and pull request. Do not commit personal contact details, machine paths, or source-media dumps.

See [SECURITY.md](SECURITY.md).
