# Trainer prep — Offline phone profile, file exchange, export my data, robustness

## Before you start (prerequisites)
Run the files unit test once so the build exists.

## 45-minute self-study path
Read phone.ts, net.ts, then the server file's bundle and package routes.

## Worked example → faded example
Worked: rating a card offline. Faded: save a diagnostic result and show it in the mastery map.

## Top misconceptions
- "The service worker caches the data": it caches the app; the data is in IndexedDB and PouchDB.
- "A signed file is secret": it is only tamper-proof.

## Questions students will ask (with answers)
- Why not a websocket? The hub may be off; a local database works either way.

## Your mastery check (private)
Explain what a phone holds after first load and what it sends later.
