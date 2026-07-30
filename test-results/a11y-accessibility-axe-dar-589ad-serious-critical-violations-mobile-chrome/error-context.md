# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: a11y.spec.ts >> accessibility (axe) >> dark mode home has no serious/critical violations
- Location: tests/a11y.spec.ts:24:3

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "scrollable-region-focusable",
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - link "Skip to content" [ref=e2] [cursor=pointer]:
    - /url: "#main"
  - generic [ref=e3]:
    - banner [ref=e4]:
      - generic [ref=e5]:
        - link "Covey — home" [ref=e6] [cursor=pointer]:
          - /url: /
          - generic [ref=e14]: Covey
        - generic [ref=e15]:
          - button "Switch to light mode" [pressed] [ref=e16] [cursor=pointer]:
            - img [ref=e17]
            - img [ref=e20]
          - button "Open menu" [ref=e22] [cursor=pointer]:
            - img [ref=e23]
    - main [ref=e25]:
      - generic [ref=e27]:
        - generic [ref=e28]:
          - generic [ref=e29]: US only, invite-only, iOS first
          - heading "Anything, anytime, together." [level=1] [ref=e37]
          - paragraph [ref=e38]: Covey is a plan-first social app. Hosts publish small real-world itineraries and a few seats stay open for whoever's curious.
          - generic [ref=e39]:
            - link "Join the flock" [ref=e40] [cursor=pointer]:
              - /url: /signup
            - link "How it works" [ref=e41] [cursor=pointer]:
              - /url: /about
          - generic [ref=e42]:
            - generic [ref=e43]: Free to use
            - generic [ref=e44]: ·
            - generic [ref=e45]: 2–10 person plans
            - generic [ref=e46]: ·
            - generic [ref=e47]: iOS first, invite-only
        - generic [ref=e49]:
          - generic [ref=e51]:
            - generic [ref=e60]: Covey
            - generic [ref=e61]:
              - generic [ref=e62]: /
              - generic [ref=e63]: kuh-vee
              - generic [ref=e64]: /
            - generic [ref=e65]:
              - generic [ref=e66]:
                - term [ref=e67]: "1."
                - definition [ref=e68]: a small flock of birds.
              - generic [ref=e69]:
                - term [ref=e70]: "2."
                - definition [ref=e71]: a small group of people gathered together.
          - article [ref=e73]:
            - generic [ref=e74]:
              - generic [ref=e75]: Event
              - generic [ref=e76]: Open
              - generic [ref=e77]: 4 going
            - heading "Sunset wine crawl" [level=3] [ref=e78]
            - generic [ref=e79]:
              - generic [ref=e81]: "1"
              - generic [ref=e83]: "2"
              - generic [ref=e85]: "3"
            - generic [ref=e86]:
              - generic [ref=e87]: Sat
              - generic [ref=e89]: 5:30p
              - generic [ref=e91]: San Francisco
              - generic [ref=e93]: 3 stops
            - generic [ref=e94]:
              - generic [ref=e95]: MR
              - generic [ref=e96]: Hosted by Maya R
      - generic [ref=e99]:
        - generic [ref=e100]: Plans across
        - generic [ref=e101]: Food & Drink
        - generic [ref=e103]: Outdoors
        - generic [ref=e105]: Sports & Fitness
        - generic [ref=e107]: Arts & Crafts
        - generic [ref=e109]: Culture & Sightseeing
        - generic [ref=e111]: Media
        - generic [ref=e113]: Nightlife & Parties
        - generic [ref=e115]: Shopping
        - generic [ref=e117]: Professional
      - generic [ref=e119]:
        - generic [ref=e121]:
          - generic [ref=e123]: covey
          - generic [ref=e131]: /kuh-vee/ · noun
          - generic [ref=e132]:
            - generic [ref=e133]:
              - term [ref=e134]: "1."
              - definition [ref=e135]: a small flock of birds that moves together.
            - generic [ref=e136]:
              - term [ref=e137]: "2."
              - definition [ref=e138]: a small group of people gathered together.
        - generic [ref=e139]:
          - generic [ref=e140]: Why "Covey"
          - heading "Birds don't flock in crowds." [level=2] [ref=e141]
          - paragraph [ref=e142]: A covey is a small gathering of quail — ten or fifteen birds, never a hundred. They move together, watch out for each other, and scatter back to their own lives when the day is done.
          - paragraph [ref=e143]: That's the whole app in one word. Not a crowd, not a feed — a small group of people, gathered around one plan, for one day.
      - generic [ref=e154]:
        - generic [ref=e155]:
          - generic [ref=e156]: What it is
          - heading "Not a feed. A corkboard." [level=2] [ref=e157]
          - paragraph [ref=e158]: Covey isn't trying to be another social network. It's a place where one person sketches an itinerary — a few stops, a date, a mood — and the right two or three people show up.
          - link "More about Covey →" [ref=e159] [cursor=pointer]:
            - /url: /about
        - generic [ref=e160]:
          - generic [ref=e161]:
            - generic [ref=e162]: Show up
            - heading "Real-world plans" [level=3] [ref=e163]
            - paragraph [ref=e164]: Wine crawls, hikes, gallery days, dinners. Things that happen at a place, at a time — not another feed to scroll.
          - generic [ref=e165]:
            - generic [ref=e166]: 2–10 people
            - heading "Small groups" [level=3] [ref=e167]
            - paragraph [ref=e168]: Hosts cap each plan between two and ten people. The size keeps every plan human.
          - generic [ref=e169]:
            - generic [ref=e170]: One host
            - heading "Host-led" [level=3] [ref=e171]
            - paragraph [ref=e172]: One person owns the day. They pick the stops, set the tone, and choose who joins.
          - generic [ref=e173]:
            - generic [ref=e174]: San Francisco
            - heading "Local first" [level=3] [ref=e175]
            - paragraph [ref=e176]: Launching invite-only in San Francisco. Every plan happens somewhere you can actually walk to.
      - generic [ref=e177]:
        - generic [ref=e178]:
          - generic [ref=e179]:
            - generic [ref=e180]: How it works
            - heading "Three steps, no group chat." [level=2] [ref=e181]
          - paragraph [ref=e182]: "Whether you're hosting your first plan or joining one, the flow is the same shape: find or sketch the day, lock in your seat, and show up at the first stop."
        - list [ref=e183]:
          - listitem [ref=e184]:
            - generic [ref=e185]: "01"
            - heading "Sketch or browse" [level=3] [ref=e186]
            - paragraph [ref=e187]: Hosts publish a few stops, a date, and a vibe. Everyone else scrolls for a plan that fits their week.
          - listitem [ref=e188]:
            - generic [ref=e189]: "02"
            - heading "Claim a spot" [level=3] [ref=e190]
            - paragraph [ref=e191]: Plans are open-join, request-to-join, or invite-only. You always know how many seats are left.
          - listitem [ref=e192]:
            - generic [ref=e193]: "03"
            - heading "Meet at the first stop" [level=3] [ref=e194]
            - paragraph [ref=e195]: Once you're in, the details are yours. Show up, introduce yourself, and follow the itinerary.
      - generic [ref=e197]:
        - generic [ref=e198]:
          - generic [ref=e199]: A real plan
          - heading "Every plan is an itinerary." [level=2] [ref=e200]
          - paragraph [ref=e201]: Not a vague "let's hang out." A host lays out the stops, the time, and the vibe — so you know exactly what you're saying yes to.
          - paragraph [ref=e202]: Category-tinted stops, a clear seat count, and one person owning the day. That's the whole card.
        - generic [ref=e203]:
          - article [ref=e204]:
            - generic [ref=e205]:
              - generic [ref=e206]: Event
              - generic [ref=e207]: Open
              - generic [ref=e208]: 4 going
            - heading "Sunset wine crawl" [level=3] [ref=e209]
            - generic [ref=e210]:
              - generic [ref=e212]: "1"
              - generic [ref=e214]: "2"
              - generic [ref=e216]: "3"
            - generic [ref=e217]:
              - generic [ref=e218]: Sat
              - generic [ref=e220]: 5:30p
              - generic [ref=e222]: San Francisco
              - generic [ref=e224]: 3 stops
            - generic [ref=e225]:
              - generic [ref=e226]: MR
              - generic [ref=e227]: Hosted by Maya R
          - article [ref=e228]:
            - generic [ref=e229]:
              - generic [ref=e230]: Casual
              - generic [ref=e231]: Request
              - generic [ref=e232]: 3 going
            - heading "Sunrise ridge hike" [level=3] [ref=e233]
            - generic [ref=e234]:
              - generic [ref=e236]: "1"
              - generic [ref=e238]: "2"
            - generic [ref=e239]:
              - generic [ref=e240]: Sun
              - generic [ref=e242]: 6:00a
              - generic [ref=e244]: Marin
              - generic [ref=e246]: 2 stops
            - generic [ref=e247]:
              - generic [ref=e248]: DK
              - generic [ref=e249]: Hosted by Devin K
      - generic [ref=e250]:
        - link "Get involved See what's coming up. Launch mixers, host meetups, and city-by-city rollout dates will land here first as we open each region. Upcoming events →" [ref=e251] [cursor=pointer]:
          - /url: /events
          - generic [ref=e252]: Get involved
          - heading "See what's coming up." [level=3] [ref=e253]
          - paragraph [ref=e254]: Launch mixers, host meetups, and city-by-city rollout dates will land here first as we open each region.
          - text: Upcoming events →
        - link "Early stories Real reactions, soon. We'd rather show real quotes than invent them. Once early hosts and joiners have run their first plans, their stories go here. What's coming →" [ref=e255] [cursor=pointer]:
          - /url: /testimonials
          - generic [ref=e256]: Early stories
          - heading "Real reactions, soon." [level=3] [ref=e257]
          - paragraph [ref=e258]: We'd rather show real quotes than invent them. Once early hosts and joiners have run their first plans, their stories go here.
          - text: What's coming →
      - generic [ref=e259]:
        - generic [ref=e260]: FAQ
        - heading "Good questions." [level=2] [ref=e261]
        - generic [ref=e262]:
          - group [ref=e263]:
            - generic "What is Covey, exactly?" [ref=e264] [cursor=pointer]:
              - text: What is Covey, exactly?
              - generic [ref=e265]: +
          - group [ref=e266]:
            - generic "How big are the groups?" [ref=e267] [cursor=pointer]:
              - text: How big are the groups?
              - generic [ref=e268]: +
          - group [ref=e269]:
            - generic "How much does it cost?" [ref=e270] [cursor=pointer]:
              - text: How much does it cost?
              - generic [ref=e271]: +
          - group [ref=e272]:
            - generic "When can I get in?" [ref=e273] [cursor=pointer]:
              - text: When can I get in?
              - generic [ref=e274]: +
      - generic [ref=e275]:
        - generic [ref=e284]: Ready when you are
        - heading "Be first in the flock." [level=2] [ref=e285]
        - paragraph [ref=e286]: We're rolling out invite-only on iOS, starting in San Francisco. Drop your email and we'll reach out the second a spot opens up.
        - generic [ref=e287]:
          - link "Join the flock" [ref=e288] [cursor=pointer]:
            - /url: /signup
          - link "Talk to us" [ref=e289] [cursor=pointer]:
            - /url: /contact
    - contentinfo [ref=e290]:
      - generic [ref=e291]:
        - generic [ref=e292]:
          - generic [ref=e300]: Covey
          - paragraph [ref=e301]: Anything, anytime, together. Launching invite-only on iOS, San Francisco first.
          - link "hello@coveyapp.co" [ref=e302] [cursor=pointer]:
            - /url: mailto:hello@coveyapp.co
        - generic [ref=e303]:
          - generic [ref=e304]: Company
          - list [ref=e305]:
            - listitem [ref=e306]:
              - link "About" [ref=e307] [cursor=pointer]:
                - /url: /about
            - listitem [ref=e308]:
              - link "Testimonials" [ref=e309] [cursor=pointer]:
                - /url: /testimonials
            - listitem [ref=e310]:
              - link "Upcoming events" [ref=e311] [cursor=pointer]:
                - /url: /events
            - listitem [ref=e312]:
              - link "Contact" [ref=e313] [cursor=pointer]:
                - /url: /contact
        - generic [ref=e314]:
          - generic [ref=e315]: Legal
          - list [ref=e316]:
            - listitem [ref=e317]:
              - link "Privacy" [ref=e318] [cursor=pointer]:
                - /url: /privacy
            - listitem [ref=e319]:
              - link "Support" [ref=e320] [cursor=pointer]:
                - /url: /support
        - generic [ref=e321]:
          - generic [ref=e322]: Follow
          - link "Instagram" [ref=e323] [cursor=pointer]:
            - /url: https://instagram.com/coveyapp
            - img [ref=e324]
            - text: Instagram
      - generic [ref=e329]:
        - generic [ref=e330]: San Francisco, CA
        - generic [ref=e331]: © 2026 Covey Co. · All rights reserved.
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | import AxeBuilder from "@axe-core/playwright";
  3  | 
  4  | const ROUTES = ["/", "/about", "/contact", "/signup", "/testimonials", "/events", "/privacy", "/support"];
  5  | 
  6  | test.describe("accessibility (axe)", () => {
  7  |   for (const route of ROUTES) {
  8  |     test(`${route} has no serious/critical violations`, async ({ page }) => {
  9  |       await page.emulateMedia({ colorScheme: "light" });
  10 |       await page.goto(route, { waitUntil: "networkidle" });
  11 |       const results = await new AxeBuilder({ page })
  12 |         .withTags(["wcag2a", "wcag2aa"])
  13 |         .analyze();
  14 |       const serious = results.violations.filter(
  15 |         (v) => v.impact === "serious" || v.impact === "critical",
  16 |       );
  17 |       expect(
  18 |         serious,
  19 |         serious.map((v) => `${v.id}: ${v.help}`).join("\n"),
  20 |       ).toEqual([]);
  21 |     });
  22 |   }
  23 | 
  24 |   test("dark mode home has no serious/critical violations", async ({ page }) => {
  25 |     await page.emulateMedia({ colorScheme: "dark" });
  26 |     await page.goto("/", { waitUntil: "networkidle" });
  27 |     const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  28 |     const serious = results.violations.filter(
  29 |       (v) => v.impact === "serious" || v.impact === "critical",
  30 |     );
> 31 |     expect(serious.map((v) => v.id)).toEqual([]);
     |                                      ^ Error: expect(received).toEqual(expected) // deep equality
  32 |   });
  33 | });
  34 | 
```