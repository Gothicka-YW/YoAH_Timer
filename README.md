# YoAH Timer (Manual Only)

Chrome extension that lets you manually track auction end times and get reminders 10 minutes before an auction ends.

- Manual entry only (does not read YoWorld pages)
- Popup UI + Side Panel UI
- Local notifications (with snooze)
- Optional remote alerts (phone/email) via ntfy or IFTTT

## Install (Developer Mode)

1. In Chrome, open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `YoAH_Timer` folder

## Using the timer

- Add an auction in the **Add Auction** tab (popup) or in the side panel.
- Reminders fire **10 minutes** before the listed end time.
- When a reminder fires, the auction is disabled (so it won’t keep alerting).

## Remote alerts (optional)

Remote alerts are per-user settings saved to `chrome.storage.sync`.

### Option A: ntfy (push notifications to phone)

1. Install the **ntfy** app on your phone (or use the web UI).
2. Pick a unique topic name (example: `yoah_timer_jane_123`).
3. In YoAH Timer → **Settings** → **Remote alerts**:
   - Enable remote alerts
   - Provider: `ntfy`
   - Topic: your chosen topic
   - Click **Save remote settings**
4. In the ntfy app, **subscribe** to that same topic.
5. Click **Test remote alert**.

Notes:
- Anyone who knows your topic can post to it. Use a hard-to-guess topic.

### Option B: IFTTT Webhooks (route to Email or SMS)

1. Create an applet in IFTTT:
   - **If This**: Webhooks → **Receive a web request**
   - Event name: for example `yoah_ending`
   - **Then That**: choose Email or SMS/notification action you prefer.
2. Find your Webhooks key:
   - IFTTT → Webhooks service → Documentation page
3. In YoAH Timer → **Settings** → **Remote alerts**:
   - Enable remote alerts
   - Provider: `IFTTT`
   - Event name: the event you used
   - Key: your Webhooks key
   - Click **Save remote settings**
4. Click **Test remote alert**.

## Privacy / data

- Auctions + history are stored locally in `chrome.storage.local`.
- Remote alert settings are stored in `chrome.storage.sync`.
- Remote alerts (if enabled) send the item name and end time to the selected provider.

See the full policy in `PRIVACY_POLICY.md`.

## Troubleshooting

- Remote test says disabled: enable remote alerts and save settings.
- No ntfy notifications: confirm your phone is subscribed to the same topic.
- IFTTT not firing: confirm event name + key and that the applet is enabled.
