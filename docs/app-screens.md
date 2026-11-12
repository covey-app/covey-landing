# App screens on the site

`public/brand/app/<screen>-<light|dark>-<420|840>.webp` are captures of the
iOS app in the **Meadow** canvas theme, shown in `src/components/Phone.astro`
(home hero and "How Covey works"). Every person, plan and message in them is
from the app's **demo mode** fixtures (`covey/ios/Covey/Demo/Fixtures`):
fictional, not from any account.

| Screen | What it shows | Harness launch |
|---|---|---|
| `explore` | Explore: upcoming plans nearby | `-covey.screenshot demo` |
| `plan` | A plan's cover: host, seats, itinerary | `-covey.screenshot demo-plan` |
| `chat` | Chats: DMs and the groups' chats | `demo` on the Chats tab |
| `myplans` | My plans | `demo` on the My plans tab |

## How they were made (2026-11-12)

1. Snapshot of the iOS Meadow work (`covey` branch `claude/meadow-theme`,
   then uncommitted) copied to a scratch folder and built for a dedicated
   simulator ("Covey Landing Shots", iPhone 17 Pro, iOS 26.2), signed ad hoc.
   No session, no network: demo mode is local fixtures.
2. Scratch-only DEBUG switches added to that copy (not to the repo): start
   tab (`-covey.landingTab`), Chats segment, and `-covey.landingShots YES`
   to hide first-visit tips and the "Demo" pill and to anchor the demo clock
   at 4:41 PM in San Francisco (the fixtures schedule relative to now).
3. Status bar overridden to 4:41, full signal and battery; location granted
   so Explore doesn't show its "Show plans near you" card.
4. `-covey.canvasTheme meadow -covey.appearance light|dark`, then
   `xcrun simctl io <sim> screenshot`, 1206 × 2622.
5. Resized to 420 and 840 px wide WebP with sharp (q80–82).

Skipped on purpose: the Community tab (it shows the Leaders tab, which
marketing may not claim until it is live) and the Coveys list (it never
finished loading in demo mode). Re-shoot when the iOS theme ships, since
these predate its merge.
