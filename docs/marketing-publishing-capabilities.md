# MAPCO Marketing — platform publishing capabilities

**Checked: 2026-08-16** against first-party vendor documentation only.
No blog posts, SaaS marketing pages or third-party wrappers were used as a source of truth.

> Re-verify before any adapter ships. Meta and Google both changed
> materially in the last two years, and two of the findings below
> contradict what older examples teach.

Legend: **SUPPORTED** · **SUPPORTED_WITH_REQUIREMENTS** · **NOT_SUPPORTED** · **NEEDS_VERIFICATION**

---

## Summary matrix

| Capability | Instagram | Facebook Page | Google Business | WhatsApp |
|---|---|---|---|---|
| Single image post | ⚠️ WITH REQS | ✅ SUPPORTED | ⚠️ WITH REQS | ❌ n/a |
| Carousel | ⚠️ WITH REQS | ⚠️ WITH REQS | ❌ | ❌ |
| Story | ⚠️ WITH REQS | ❓ NEEDS VERIFICATION | ❌ | ❌ **NOT_SUPPORTED** |
| Reel / video | ✅ | ⚠️ WITH REQS | ❌ | ❌ |
| **Native scheduling** | ❌ **none** | ✅ | ✅ | ❌ |
| **Media ingest** | **fetch from URL** | either | **fetch from URL** | n/a |
| Returns a remote id | ✅ | ✅ | ✅ | n/a |
| Post-level insights | ✅ | ✅ | ❌ **discontinued** | n/a |

---

## The three findings that shape the architecture

**1. Two of three platforms FETCH the image; they do not accept an upload.**
Instagram and Google Business both require the creative at a **publicly reachable HTTPS URL**. MAPCO's approved creatives live in **private** storage. So publishing requires minting a **short-lived, unguessable, single-purpose public URL** per publication — never making the bucket public. Facebook is the exception and accepts a direct binary upload.

**2. Instagram has no native scheduling.** `media_publish` posts immediately. Every "scheduled for 10am" promise is MAPCO's own clock, which is why the scheduler owns timing rather than delegating it.

**3. WhatsApp Status has no official publishing API.** Treated as `NOT_SUPPORTED`. MAPCO will never automate it via browser automation, WhatsApp Web scraping, or reverse-engineered endpoints. The truthful UI state is **Manual share**.

---

## Instagram

**Flow:** two-step — create a media container, then publish it with the returned `creation_id`.

- **Account type is a hard gate.** Only **professional** (Business or Creator) accounts. A personal account cannot be published to at all, with no workaround.
- **Two mutually exclusive configurations:** *Instagram Login* (no Facebook Page required — simplest onboarding) or *Facebook Login for Business* (requires the IG account linked to a Page, Page Publishing Authorization, and MANAGE/CREATE_CONTENT on that Page).
- **JPEG only.** PNG, WebP and HEIC are rejected. Our creatives are produced as PNG by ChatGPT, so **conversion is mandatory** before Instagram publishing.
- Containers **expire after 24 hours**; there is **no webhook** — completion must be polled.
- Carousel max 10 items, all cropped to the first item's aspect ratio.
- Stories **are** publishable (contrary to common belief), but **no** stickers, link stickers, polls or music via API.

**Rate limit — the docs contradict themselves:** the publishing guide says 100 posts per rolling 24h; the reference says 50. **Build against 50** and read the live value from the `content_publishing_limit` edge.

**Prerequisites:** Business-type Meta app · App Review + Business Verification for Advanced Access · public HTTPS URL for the image.

---

## Facebook Page

**The most permissive of the three.** Accepts a hosted URL *or* a direct multipart upload, and supports **native scheduling** (`published=false` + a scheduled timestamp).

- Formats: JPEG, PNG, GIF, BMP, TIFF · max 10 MB (PNG recommended under 1 MB to avoid pixelation).
- Scopes: `pages_manage_posts`, `pages_read_engagement`, `pages_show_list`. The authorising user needs the **CREATE_CONTENT** task on the Page.
- Reels use a separate three-phase upload API with its own 30-per-24h ceiling.

**Token model — the classic bug:** there is **no refresh grant**. Short-lived user token → exchange for a ~60-day long-lived user token → call the accounts edge **with that long-lived token** to get a **non-expiring Page token**. Calling the accounts edge with a *short-lived* token yields a *short-lived* Page token. If the 60-day user token lapses, the dealer must re-authenticate.

**Gate beyond the API:** Advanced Access (per-permission App Review) **+** Business Verification **+ Tech Provider status** to serve other businesses' Pages. Tech Provider requires a signatory on Meta's Tech Provider Amendment.

**Do not carry over from old examples:** the `graph-video` host is deprecated, and custom link-preview parameters are deprecated.

---

## Google Business Profile

**Posts still live on the LEGACY v4.9 API** (`mybusiness.googleapis.com`), *not* any of the modern v1 split APIs. Any tutorial pointing at the Business Information host for posts is wrong.

**The access wall is the real cost.** The API is **not open to the public**. A Cloud project must be approved via the Business Profile API application; an unapproved project has **0 QPM** and cannot even see the API. Review takes up to ~14 days.

**Prerequisites:** profile **verified and active 60+ days** · a live website · OAuth scope `business.manage` with sensitive-scope verification · public URL for post media (**byte upload is not available for post media**).

- Post types: STANDARD, EVENT, OFFER, ALERT (COVID-only). **Product posts are not available via API.**
- CTA: BOOK, ORDER, SHOP, LEARN_MORE, SIGN_UP, CALL. **CALL takes no URL.** `GET_OFFER` is deprecated. CTA is **ignored** on OFFER posts.
- **Publication is moderated and asynchronous.** A 200 does not mean live — poll for `LIVE` or `REJECTED`.
- **Post-level insights were discontinued in 2023 with no replacement.** The method is still listed but dead. Post engagement cannot be reported.
- **Policy forbids a phone number in the post body** — a frequent silent rejection. MAPCO validates captions for this.
- No documented summary length limit; the widely quoted 1,500 is **not** in Google's docs. We cap defensively and say so.
- **Resource-name mismatch:** the v1 API returns `locations/{id}` but posts need `accounts/{aid}/locations/{lid}`. The account id must be stored alongside every location.
- Hotels cannot run OFFER posts; regulated categories may not carry a CTA.

---

## WhatsApp Business

> ⚠️ **VERIFICATION INCOMPLETE.** The research pass for WhatsApp did not finish. Both entries below must be re-checked against official Meta documentation before any adapter ships.

| Capability | Status |
|---|---|
| Publish to WhatsApp **Status** | **NOT_SUPPORTED** — treated as unavailable per explicit product decision |
| Send a media **message** via Cloud API | **NEEDS_VERIFICATION** — not enabled |

**Status and business messaging are entirely different products.** Messaging requires recipient **opt-in**, is governed by the 24-hour customer service window and template rules, and is **not** a broadcast channel for marketing creatives. Enabling it would require a separate consent/audience model, which is out of scope.

**MAPCO will never automate WhatsApp Status by unofficial means.** The truthful UI state is *Manual share* with a download.

---

## Credential storage boundary

**No secret ever lives in a database row, a client bundle, a log line, or any object that can reach the browser.**

```
dealer
  └─ marketing_channel_accounts        (row: NO secret)
       └─ credential_ref               "mapco:<dealer>:<channel>:access"
            └─ server-side secret store   ← the only place a token exists
```

`credential_ref` is a **name**, not a value, and is already constrained by regex on `marketing_channel_accounts`. The `CredentialStore` interface defines what production must supply; the only implementation shipped is `UnconfiguredCredentialStore`, which **refuses to return a value**. That is deliberate — a fake encrypted store would be worse than none, and this way no code path can quietly start depending on insecure storage.

**What production must back `credential_ref` with:** a Supabase Edge secret store, a KMS-backed table, or a managed secret manager — reachable only from server-side code, supporting rotation and revocation.

`findSecretLeaks()` walks any object and fails loudly on token-shaped keys; it is applied to the client-safe projection in tests.

---

## What is automatic vs manual

| | Today | Once credentials exist |
|---|---|---|
| Instagram | ❌ manual | ✅ automatic (after JPEG conversion + App Review) |
| Facebook Page | ❌ manual | ✅ automatic (after App Review + Tech Provider) |
| Google Business | ❌ manual | ✅ automatic (after API approval) |
| WhatsApp Status | ❌ manual | ❌ **permanently manual** |

Nothing publishes in this milestone. Approved creatives reach **Ready to publish** and stop there, honestly.

---

## To turn on each real connector

**Instagram** — Business-type Meta app; App Review for `instagram_business_content_publish` (or `instagram_content_publish`); Business Verification; PNG→JPEG conversion in `prepareAsset`; short-lived public URL minting; container status polling.

**Facebook Page** — App Review for `pages_manage_posts` + `pages_read_engagement` + `pages_show_list`; Business Verification; **Tech Provider status**; the four-step token exchange with proactive refresh before the 60-day user token lapses.

**Google Business** — Cloud project approved via the Business Profile API application (~14 days); OAuth sensitive-scope verification; account→location resolution storing both ids; public URL minting; moderation-state polling; caption phone-number stripping.

**WhatsApp** — complete the verification pass first. Status stays manual regardless.

---

## Open items requiring verification before shipping

1. **WhatsApp** — the entire research pass (both messaging and Status).
2. **Facebook Page Stories** — surface exists, not verified.
3. **Instagram feed video** — `media_type=VIDEO` is no longer documented; feed video appears to be Reels only.
4. **Google Business** — which `LocalPost` fields are actually mutable on PATCH, and the real summary character limit.
5. **Instagram publishing limit** — 50 vs 100; read the live value per account.
