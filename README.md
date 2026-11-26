# CEC Quest 2.0 — Learn, Practice, Speak, Grow

Editorial preview for CEC Bea Cukai Pangkalpinang. This branch does not release production.

## Available preview
- Six worlds and 60 micro-lessons with Learn → Understand → Practice → Speak → Review → Master.
- 300 lesson questions, 15 grammar drills, 60 vocabulary entries, and 200 retained archive questions.
- Daily journeys, vocabulary notebook, spaced review, six-skill evidence, streaks and activity badges.
- Device speaking/listening practice, twelve fictional conversation scenarios and a limited offline tutor.
- Responsive light/dark UI and offline caching of public learning assets.
- Backend implementation and isolated tests for approved institutional integration. Institutional integration is disabled by default.

The vocabulary/question expansion targets and mentor approval are still pending. CEFR labels and placement are internal estimates, not certification.

## Local preview
Run `python -m http.server 8080` and open http://localhost:8080/.

Run `npm test` and `npm run check`. Optional browser tests: `npm ci`, then `npm run test:browser` and `npm run test:integration`.

27 Node tests passed. Chrome/Edge desktop and mobile viewport regressions, offline reload, CSV download, and an isolated browser/API/database-emulator workflow passed. Real Google OAuth/Apps Script, production data, physical mobile devices and formal accessibility review remain unverified.

See [public documentation](docs/README.md), [curriculum](docs/CURRICULUM.md), and [preview](docs/preview-desktop.png).
Detailed security, operational, migration and recovery reports are supplied privately and are not included in this public PR pending disclosure approval.

No production deployment or production data changes have been made.
