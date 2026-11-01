# Security

This repository is meant to be public. It holds the app, not anyone's workout history or video files.

- Do not commit catalogs, lesson notes, or media. Those stay in OneDrive.
- Do not commit contact details, home addresses, phone numbers, or machine user paths.
- The Microsoft client ID in `public/config.json` is a public SPA identifier, not a secret. Do not add a client secret.
- `scripts/check-public.mjs` blocks commits that trip the denylist. A hit means the text or file does not belong in the public tree.
