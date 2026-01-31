# Privacy Policy — YoAH Timer (Manual Only)

**Effective date:** January 31, 2026

YoAH Timer (“the extension”) helps you manually track auction end times and receive reminders.

## Summary
- **No accounts, no sign-in, no analytics.** The extension does not require you to create an account and does not include analytics or advertising trackers.
- **Manual-only.** The extension does not read or hook YoWorld pages for bidding/automation.
- **Data stays on your device unless you enable optional remote alerts.**

## Data the extension stores
The extension stores the following data to provide its features:

### Stored in `chrome.storage.local` (on your device)
- **Tracked auctions** (for reminders): item name, end time, enabled/disabled state, and optionally an image URL.
- **Auction history** (for display): prior auctions you tracked (pruned automatically).
- **Draft form state**: last-opened tab and in-progress form values.

### Stored in `chrome.storage.sync` (synced with your Chrome profile, if sync is enabled)
- **Settings**: theme selection and remote alert configuration (provider choice, ntfy topic, or IFTTT event name/key).
- **Search keywords list**: your Auction House search keyword list.

## Data the extension transmits
The extension only sends data over the network in these situations:

### 1) Optional remote alerts (only if enabled by you)
If you enable **Remote alerts** in Settings, the extension will send alert payloads to the provider you choose:

- **ntfy** (`https://ntfy.sh/…`): sends a notification message to your configured topic.
- **IFTTT Webhooks** (`https://maker.ifttt.com/…`): triggers your configured webhook event.

The message content is limited to what’s needed to deliver the alert (for example: auction/item name and timing information).

### 2) Optional item image lookup (only when you click related buttons)
If you use the item image helper buttons, the extension may request data from:
- `https://api.yoworld.info/…` (item search)
- `https://yoworld.info/…` / `https://www.yoworld.info/…` (page fetch to read the page’s preview image)

These requests are made without your cookies/credentials.

## Permissions
The extension requests these Chrome permissions:
- **storage**: save auctions, history, settings, and your search keyword list.
- **alarms**: schedule reminder checks.
- **notifications**: display reminder notifications.
- **sidePanel**: provide the optional side panel UI.

Host permissions are limited to the domains needed for optional image lookup and optional remote alerts.

## Data retention
- Auction history is automatically pruned by the extension (currently keeping about **30 days** of history).
- Other stored data persists until you delete it.

## Your choices & how to delete data
- You can remove individual auctions, clear history, and remove keywords using the UI.
- You can disable Remote alerts at any time.
- To remove all extension data, you can uninstall the extension (Chrome will remove the extension’s stored data).

## Sharing / selling data
The extension does **not** sell your data.

## Changes to this policy
This policy may be updated as the extension changes. The “Effective date” will be updated when changes are made.

## Contact
For privacy questions or requests, please contact the developer via the extension’s listing page (where the support contact is provided).
