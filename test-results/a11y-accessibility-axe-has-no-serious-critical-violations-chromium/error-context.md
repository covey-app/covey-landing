# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: a11y.spec.ts >> accessibility (axe) >> / has no serious/critical violations
- Location: tests/a11y.spec.ts:8:5

# Error details

```
Error: color-contrast: Elements must meet minimum color contrast ratio thresholds

expect(received).toEqual(expected) // deep equality

- Expected  -   1
+ Received  + 128

- Array []
+ Array [
+   Object {
+     "description": "Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds",
+     "help": "Elements must meet minimum color contrast ratio thresholds",
+     "helpUrl": "https://dequeuniversity.com/rules/axe/4.12/color-contrast?application=playwright",
+     "id": "color-contrast",
+     "impact": "serious",
+     "nodes": Array [
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#ffffff",
+               "contrastRatio": 3.34,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#8c8c92",
+               "fontSize": "10.8pt (14.4px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.34 (foreground color: #8c8c92, background color: #ffffff, font size: 10.8pt (14.4px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<div class=\"hero-def card-pinned p-7 sm:p-10\" style=\"border-radius: var(--radius-sheet)\" data-astro-cid-lcdefpme=\"\">",
+                 "target": Array [
+                   ".hero-def",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.34 (foreground color: #8c8c92, background color: #ffffff, font size: 10.8pt (14.4px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<span class=\"dm-pron-word\" data-astro-cid-gkyfojwa=\"\">kuh-vee</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".dm-pron-word",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#ffffff",
+               "contrastRatio": 1.36,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#efd8cf",
+               "fontSize": "12.0pt (16px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 1.36 (foreground color: #efd8cf, background color: #ffffff, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<div class=\"hero-def card-pinned p-7 sm:p-10\" style=\"border-radius: var(--radius-sheet)\" data-astro-cid-lcdefpme=\"\">",
+                 "target": Array [
+                   ".hero-def",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 1.36 (foreground color: #efd8cf, background color: #ffffff, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<dt data-astro-cid-gkyfojwa=\"\">1.</dt>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".dm-def[data-astro-cid-gkyfojwa=\"\"]:nth-child(1) > dt",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#ffffff",
+               "contrastRatio": 1.87,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#bdbdbd",
+               "fontSize": "12.8pt (17px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 1.87 (foreground color: #bdbdbd, background color: #ffffff, font size: 12.8pt (17px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<div class=\"hero-def card-pinned p-7 sm:p-10\" style=\"border-radius: var(--radius-sheet)\" data-astro-cid-lcdefpme=\"\">",
+                 "target": Array [
+                   ".hero-def",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 1.87 (foreground color: #bdbdbd, background color: #ffffff, font size: 12.8pt (17px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<dd data-astro-cid-gkyfojwa=\"\">a small flock of birds.</dd>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".dm-def[data-astro-cid-gkyfojwa=\"\"]:nth-child(1) > dd",
+         ],
+       },
+     ],
+     "tags": Array [
+       "cat.color",
+       "wcag2aa",
+       "wcag143",
+       "TTv5",
+       "TT13.c",
+       "EN-301-549",
+       "EN-9.1.4.3",
+       "ACT",
+       "RGAAv4",
+       "RGAA-3.2.1",
+     ],
+   },
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
        - navigation "Primary" [ref=e15]:
          - link "About" [ref=e16] [cursor=pointer]:
            - /url: /about
          - link "Contact" [ref=e17] [cursor=pointer]:
            - /url: /contact
        - generic [ref=e18]:
          - button "Switch to dark mode" [ref=e19] [cursor=pointer]:
            - img [ref=e20]
            - img [ref=e23]
          - link "Join the flock" [ref=e25] [cursor=pointer]:
            - /url: /signup
          - button "Open menu" [ref=e26] [cursor=pointer]:
            - img [ref=e27]
    - main [ref=e29]:
      - generic [ref=e31]:
        - generic [ref=e32]:
          - generic [ref=e33]: US only, invite-only, iOS first
          - heading "Anything, anytime, together." [level=1] [ref=e41]
          - paragraph [ref=e42]: Covey is a plan-first social app. Hosts publish small real-world itineraries and a few seats stay open for whoever's curious.
          - generic [ref=e43]:
            - link "Join the flock" [ref=e44] [cursor=pointer]:
              - /url: /signup
            - link "How it works" [ref=e45] [cursor=pointer]:
              - /url: /about
          - generic [ref=e46]:
            - generic [ref=e47]: Free to use
            - generic [ref=e48]: ·
            - generic [ref=e49]: 2–10 person plans
            - generic [ref=e50]: ·
            - generic [ref=e51]: iOS first, invite-only
        - generic [ref=e53]:
          - generic [ref=e55]:
            - generic [ref=e64]: Covey
            - generic [ref=e65]:
              - generic [ref=e66]: /
              - generic [ref=e67]: kuh-vee
              - generic [ref=e68]: /
            - generic [ref=e69]:
              - generic [ref=e70]:
                - term [ref=e71]: "1."
                - definition [ref=e72]: a small flock of birds.
              - generic [ref=e73]:
                - term [ref=e74]: "2."
                - definition [ref=e75]: a small group of people gathered together.
          - article [ref=e77]:
            - generic [ref=e78]:
              - generic [ref=e79]: Event
              - generic [ref=e80]: Open
              - generic [ref=e81]: 4 going
            - heading "Sunset wine crawl" [level=3] [ref=e82]
            - generic [ref=e83]:
              - generic [ref=e85]: "1"
              - generic [ref=e87]: "2"
              - generic [ref=e89]: "3"
            - generic [ref=e90]:
              - generic [ref=e91]: Sat
              - generic [ref=e93]: 5:30p
              - generic [ref=e95]: San Francisco
              - generic [ref=e97]: 3 stops
            - generic [ref=e98]:
              - generic [ref=e99]: MR
              - generic [ref=e100]: Hosted by Maya R
      - generic [ref=e103]:
        - generic [ref=e104]: Plans across
        - generic [ref=e105]: Food & Drink
        - generic [ref=e107]: Outdoors
        - generic [ref=e109]: Sports & Fitness
        - generic [ref=e111]: Arts & Crafts
        - generic [ref=e113]: Culture & Sightseeing
        - generic [ref=e115]: Media
        - generic [ref=e117]: Nightlife & Parties
        - generic [ref=e119]: Shopping
        - generic [ref=e121]: Professional
      - generic [ref=e123]:
        - generic [ref=e125]:
          - generic [ref=e127]: covey
          - generic [ref=e135]: /kuh-vee/ · noun
          - generic [ref=e136]:
            - generic [ref=e137]:
              - term [ref=e138]: "1."
              - definition [ref=e139]: a small flock of birds that moves together.
            - generic [ref=e140]:
              - term [ref=e141]: "2."
              - definition [ref=e142]: a small group of people gathered together.
        - generic [ref=e143]:
          - generic [ref=e144]: Why "Covey"
          - heading "Birds don't flock in crowds." [level=2] [ref=e145]
          - paragraph [ref=e146]: A covey is a small gathering of quail — ten or fifteen birds, never a hundred. They move together, watch out for each other, and scatter back to their own lives when the day is done.
          - paragraph [ref=e147]: That's the whole app in one word. Not a crowd, not a feed — a small group of people, gathered around one plan, for one day.
      - generic [ref=e158]:
        - generic [ref=e159]:
          - generic [ref=e160]: What it is
          - heading "Not a feed. A corkboard." [level=2] [ref=e161]
          - paragraph [ref=e162]: Covey isn't trying to be another social network. It's a place where one person sketches an itinerary — a few stops, a date, a mood — and the right two or three people show up.
          - link "More about Covey →" [ref=e163] [cursor=pointer]:
            - /url: /about
        - generic [ref=e164]:
          - generic [ref=e165]:
            - generic [ref=e166]: Show up
            - heading "Real-world plans" [level=3] [ref=e167]
            - paragraph [ref=e168]: Wine crawls, hikes, gallery days, dinners. Things that happen at a place, at a time — not another feed to scroll.
          - generic [ref=e169]:
            - generic [ref=e170]: 2–10 people
            - heading "Small groups" [level=3] [ref=e171]
            - paragraph [ref=e172]: Hosts cap each plan between two and ten people. The size keeps every plan human.
          - generic [ref=e173]:
            - generic [ref=e174]: One host
            - heading "Host-led" [level=3] [ref=e175]
            - paragraph [ref=e176]: One person owns the day. They pick the stops, set the tone, and choose who joins.
          - generic [ref=e177]:
            - generic [ref=e178]: San Francisco
            - heading "Local first" [level=3] [ref=e179]
            - paragraph [ref=e180]: Launching invite-only in San Francisco. Every plan happens somewhere you can actually walk to.
      - generic [ref=e181]:
        - generic [ref=e182]:
          - generic [ref=e183]:
            - generic [ref=e184]: How it works
            - heading "Three steps, no group chat." [level=2] [ref=e185]
          - paragraph [ref=e186]: "Whether you're hosting your first plan or joining one, the flow is the same shape: find or sketch the day, lock in your seat, and show up at the first stop."
        - list [ref=e187]:
          - listitem [ref=e188]:
            - generic [ref=e189]: "01"
            - heading "Sketch or browse" [level=3] [ref=e190]
            - paragraph [ref=e191]: Hosts publish a few stops, a date, and a vibe. Everyone else scrolls for a plan that fits their week.
          - listitem [ref=e192]:
            - generic [ref=e193]: "02"
            - heading "Claim a spot" [level=3] [ref=e194]
            - paragraph [ref=e195]: Plans are open-join, request-to-join, or invite-only. You always know how many seats are left.
          - listitem [ref=e196]:
            - generic [ref=e197]: "03"
            - heading "Meet at the first stop" [level=3] [ref=e198]
            - paragraph [ref=e199]: Once you're in, the details are yours. Show up, introduce yourself, and follow the itinerary.
      - generic [ref=e201]:
        - generic [ref=e202]:
          - generic [ref=e203]: A real plan
          - heading "Every plan is an itinerary." [level=2] [ref=e204]
          - paragraph [ref=e205]: Not a vague "let's hang out." A host lays out the stops, the time, and the vibe — so you know exactly what you're saying yes to.
          - paragraph [ref=e206]: Category-tinted stops, a clear seat count, and one person owning the day. That's the whole card.
        - generic [ref=e207]:
          - article [ref=e208]:
            - generic [ref=e209]:
              - generic [ref=e210]: Event
              - generic [ref=e211]: Open
              - generic [ref=e212]: 4 going
            - heading "Sunset wine crawl" [level=3] [ref=e213]
            - generic [ref=e214]:
              - generic [ref=e216]: "1"
              - generic [ref=e218]: "2"
              - generic [ref=e220]: "3"
            - generic [ref=e221]:
              - generic [ref=e222]: Sat
              - generic [ref=e224]: 5:30p
              - generic [ref=e226]: San Francisco
              - generic [ref=e228]: 3 stops
            - generic [ref=e229]:
              - generic [ref=e230]: MR
              - generic [ref=e231]: Hosted by Maya R
          - article [ref=e232]:
            - generic [ref=e233]:
              - generic [ref=e234]: Casual
              - generic [ref=e235]: Request
              - generic [ref=e236]: 3 going
            - heading "Sunrise ridge hike" [level=3] [ref=e237]
            - generic [ref=e238]:
              - generic [ref=e240]: "1"
              - generic [ref=e242]: "2"
            - generic [ref=e243]:
              - generic [ref=e244]: Sun
              - generic [ref=e246]: 6:00a
              - generic [ref=e248]: Marin
              - generic [ref=e250]: 2 stops
            - generic [ref=e251]:
              - generic [ref=e252]: DK
              - generic [ref=e253]: Hosted by Devin K
      - generic [ref=e254]:
        - link "Get involved See what's coming up. Launch mixers, host meetups, and city-by-city rollout dates will land here first as we open each region. Upcoming events →" [ref=e255] [cursor=pointer]:
          - /url: /events
          - generic [ref=e256]: Get involved
          - heading "See what's coming up." [level=3] [ref=e257]
          - paragraph [ref=e258]: Launch mixers, host meetups, and city-by-city rollout dates will land here first as we open each region.
          - text: Upcoming events →
        - link "Early stories Real reactions, soon. We'd rather show real quotes than invent them. Once early hosts and joiners have run their first plans, their stories go here. What's coming →" [ref=e259] [cursor=pointer]:
          - /url: /testimonials
          - generic [ref=e260]: Early stories
          - heading "Real reactions, soon." [level=3] [ref=e261]
          - paragraph [ref=e262]: We'd rather show real quotes than invent them. Once early hosts and joiners have run their first plans, their stories go here.
          - text: What's coming →
      - generic [ref=e263]:
        - generic [ref=e264]: FAQ
        - heading "Good questions." [level=2] [ref=e265]
        - generic [ref=e266]:
          - group [ref=e267]:
            - generic "What is Covey, exactly?" [ref=e268] [cursor=pointer]:
              - text: What is Covey, exactly?
              - generic [ref=e269]: +
          - group [ref=e270]:
            - generic "How big are the groups?" [ref=e271] [cursor=pointer]:
              - text: How big are the groups?
              - generic [ref=e272]: +
          - group [ref=e273]:
            - generic "How much does it cost?" [ref=e274] [cursor=pointer]:
              - text: How much does it cost?
              - generic [ref=e275]: +
          - group [ref=e276]:
            - generic "When can I get in?" [ref=e277] [cursor=pointer]:
              - text: When can I get in?
              - generic [ref=e278]: +
      - generic [ref=e279]:
        - generic [ref=e288]: Ready when you are
        - heading "Be first in the flock." [level=2] [ref=e289]
        - paragraph [ref=e290]: We're rolling out invite-only on iOS, starting in San Francisco. Drop your email and we'll reach out the second a spot opens up.
        - generic [ref=e291]:
          - link "Join the flock" [ref=e292] [cursor=pointer]:
            - /url: /signup
          - link "Talk to us" [ref=e293] [cursor=pointer]:
            - /url: /contact
    - contentinfo [ref=e294]:
      - generic [ref=e295]:
        - generic [ref=e296]:
          - generic [ref=e304]: Covey
          - paragraph [ref=e305]: Anything, anytime, together. Launching invite-only on iOS, San Francisco first.
          - link "hello@coveyapp.co" [ref=e306] [cursor=pointer]:
            - /url: mailto:hello@coveyapp.co
        - generic [ref=e307]:
          - generic [ref=e308]: Company
          - list [ref=e309]:
            - listitem [ref=e310]:
              - link "About" [ref=e311] [cursor=pointer]:
                - /url: /about
            - listitem [ref=e312]:
              - link "Testimonials" [ref=e313] [cursor=pointer]:
                - /url: /testimonials
            - listitem [ref=e314]:
              - link "Upcoming events" [ref=e315] [cursor=pointer]:
                - /url: /events
            - listitem [ref=e316]:
              - link "Contact" [ref=e317] [cursor=pointer]:
                - /url: /contact
        - generic [ref=e318]:
          - generic [ref=e319]: Legal
          - list [ref=e320]:
            - listitem [ref=e321]:
              - link "Privacy" [ref=e322] [cursor=pointer]:
                - /url: /privacy
            - listitem [ref=e323]:
              - link "Support" [ref=e324] [cursor=pointer]:
                - /url: /support
        - generic [ref=e325]:
          - generic [ref=e326]: Follow
          - link "Instagram" [ref=e327] [cursor=pointer]:
            - /url: https://instagram.com/coveyapp
            - img [ref=e328]
            - text: Instagram
      - generic [ref=e333]:
        - generic [ref=e334]: San Francisco, CA
        - generic [ref=e335]: © 2026 Covey Co. · All rights reserved.
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
> 20 |       ).toEqual([]);
     |         ^ Error: color-contrast: Elements must meet minimum color contrast ratio thresholds
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
  31 |     expect(serious.map((v) => v.id)).toEqual([]);
  32 |   });
  33 | });
  34 | 
```