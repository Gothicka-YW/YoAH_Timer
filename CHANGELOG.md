# Changelog — YoAH Timer (Manual Only)

## 0.2.5 — 2026-01-31
- Added new Search tab before Settings (popup + side panel)
- Added Auction House search keyword list with Copy / Add / Remove
- Keyword list is saved in `chrome.storage.sync` and kept alphabetized
- Added privacy policy document (`PRIVACY_POLICY.md`)

## 0.2.4 — 2026-01-24
- Moved Remote Alerts into a new Settings tab (popup)
- Mirrored tabbed layout in Side Panel (Current Bids / Add / History / Settings)
- Added 5 selectable color themes (saved per-user)

## 0.2.3 — 2026-01-24
- Added History "Clear history" button (popup + side panel)
- Added optional Remote Alerts (per-user) via ntfy (push) or IFTTT Webhooks (email/SMS via applet)
- Added Remote Alerts test button + settings saved in `chrome.storage.sync`

## 0.2.2 — 2026-01-23
- Added Side Panel data entry (no need to open the popup)
- Added History tracking with Won/Lost and optional win amount
- Added automatic history retention (removes entries older than 30 days)
- Added notification Snooze button (5 minutes)
- Added item image “Find” via `api.yoworld.info` (fills YoWorld CDN image URL)
- Added dark theme with teal primary
- Updated manifest + notification icon wiring

## 0.2.1 — 2026-01-22
- Manual-only timer MVP
- Tabbed popup UI (Current Bids / Add Auction)
- Time Left input (H:MM) with persistent storage
- Optional item image URL with preview
