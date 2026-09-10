# Founder Intelligence: archaeology and proposed direction

Research checkpoint: 11 September 2026. Canonical implementation baseline: MAPCO `328c770adb47c288a1da0b6375929d24e678aee0`. This is a research/design checkpoint, not a deployed intelligence product.

## Finding

The scarce resource is not event data. It is the opportunity to discover that an expensive founder belief is wrong while there are still dealers, time and money left to act differently.

Build a decision practice supported by software: before a consequential encounter, state the decision and competing explanations; afterwards, reconcile what was expected, observed and still unknowable; choose the smallest next observation that could change the decision. Keep account administration, but do not let its dealer directory determine the structure of learning.

The central object should be a **decision case**, spanning encounters and dealers. A trial is a context, not a controlled experiment by itself. A dealer is a participant, not a health score. A click is a measurement with limits, not proof of value.

## 1. What was actually found

### PlotMap Dealer 360 — operational attention

Fetched the historical donor branch into the existing read-only reference clone. Its head is exactly `31da12275ced4d8b6f3c54b5fc0374d8834f52fc`.

Important history:
- `6772c01`: architecture and draft analytics migration.
- `a386461`: app-open, error and environment tracking.
- `daf3857e148834783e47873868b82846817ea07e`: Dealer 360 UI; commit explicitly credits Claude Fable 5.
- `de13bd1`: app-open store-clobber/deduplication fix.
- `78f8632`: analytics hardening.
- `60041aa`, `bc7c269`: staging verification tools and procedures.
- `a37cfa0`: authenticated boot-order crash fix.
- `31da122`: Developer Control visual integration.

Read `admin/core/dev360.js`, `docs/DEALER-360-ARCHITECTURE.md`, staging verification documentation and commit history. The implementation has real RPC-backed dealer summaries, lazy timeline pagination, account/device controls and honest pending states for unavailable backend capabilities. Its prior architecture correctly prefers authoritative property/account/device tables to reconstructing everything from events. It also has an older queue/deduplication design.

However, `healthFor()` turns thresholds into labels: five inactive days becomes “At risk”; five active days, five presentations and two shares becomes “Highly engaged.” `healthScoreFor()` then assigns fixed scores such as 94 and 84. Those scores are coded judgments, not validated estimates of retention or customer value. Session duration is an event span, not measured attention.

Staging scripts test real concerns: cross-tenant injection, raw reads, device rejection, same-timestamp cursor pagination, ingestion-time rate limiting and duplicate IDs. Finding those scripts and a “complete verification” commit is not proof that they pass against today's MAPCO-DEV. I did not replay their old mutations or treat their documentation as production approval.

### Sounding — an encounter and judgment instrument

Three local archives exist:
- `founders thing.zip`: SQL, tests, telemetry code and patches.
- `founders thing2.zip`: revision specification, SQL/tests, Sounding HTML.
- `founderthing3.zip`: Capture Now, Seven Days protocol, Sounding HTML.

The bundled HTML is functional standalone software: roster, pre-meeting prediction stakes, resolution, surprises, beliefs with falsifiers, trial notes and JSON import/export. It computes Brier scores and confidence bands. It uses the Claude artifact `window.storage` API when available and an in-memory fallback with an export warning. It is not wired to Supabase, dealer Auth or the current evidence tables.

Its strongest contribution is a behavior: commit before seeing the outcome, then record the surprise. Its weakness is treating hand-authored assumptions as machinery:
- Roster “information” and relationship “cost” numbers are constants.
- A rule unlocks relationship prioritisation after twelve resolved predictions or one win.
- Its calibration advice uses bucket midpoints and small samples to tell the founder how many confidence points to discount.
- Two predictions minimum and ten total resolutions are interface rules, not guarantees of independent or informative evidence.
- Its readout expands a manually checked buyer gate into claims that the buyer looked at the location, was interested and did not call. The checkbox cannot establish those facts.
- Outcome marks can be toggled; JSON imports can replace state. This is not a tamper-resistant prediction ledger.

Important correction to my initial reading: the shipped HTML already permits a sale without G4, and the commission illustration is conditional on dealer-stated rate and typical transaction size. The stronger inventory-to-commission inference and refusal to close without G4 are in the older protocol, not that readout implementation. The archive is a mixture of revisions, not one coherent final specification.

### Claude's evidence foundation — a substantial correction

`capture-now.md` initially proposed a separate desk event stream, treated buyer behavior as uncontaminated, inferred human identity from devices, and prescribed freezing the build. `revision.md` explicitly retracts these claims. It reuses `presentation_events`, separates three axes, demotes device identity, records treatment changes and introduces immutable predictions.

Two implementation commits exist:
- `5933ecb420fff15a0ebefa8b7640733191e5f1e7`, on `feat/evidence-foundation`, based on the diverged UI branch.
- `733d2d656d0e7b6c1011b8df1f3cc394fcd9247a`, on `feat/evidence-foundation-main`, re-derived against canonical main. This is inherited by the current Founder checkpoint.

Both explicitly credit Claude Opus 5. These are alternate implementations of the same work, not two additive systems to merge blindly.

The canonical commit fixes an actual dead pipeline: incompatible event names, no useful callers, empty dealer ID and swallowed errors. It extends the metadata sanitizer, derives the actor server-side, stamps builds, instruments the live Add Property flow, and adds provider-owned `trials`, `evidence`, `predictions` plus three views. Its canonical Earth fix requires explicit confirmation before persisting WGS84; raster mapPlacement remains separate.

This is the most reusable intellectual and technical foundation. But an allowed event name is not an emitter. Current dealer-side calls to the general presentation-events repository are concentrated in Add Property. `client_link_created`, PI and other names appearing in the taxonomy do not demonstrate current capture.

### Codex Founder Control — account operations plus access to the evidence

Checkpoint `328c770` adds real provisioning, trial creation, paid-through dates, suspension, device administration, evidence entry, predictions and history. It replaces a fixture-only developer app, reuses secured provisioning and atomic finalization, and preserves tenant identity on payment.

What it does not do:
- Connect predictions to a decision, competing explanations or an observation protocol.
- Require a resolution rule before a prediction is staked.
- Link outcome resolution to a selected evidence record through the current UI/RPC, despite the evidence FK existing in the schema.
- Show capture coverage and missingness alongside usage.
- Provide consent or withdrawal enforcement for optional research.
- Distinguish founder-assisted from independent completion merely from Auth identity.
- Produce a reconciled before/after encounter readout.

My earlier implementation combined administration and learning as neighboring tabs. That makes stored records accessible, but it does not create a learning process. Payment also closes an open trial; the milestone view ends at closed_at. That can truncate learning after an early purchase. A seven-day access offer and a useful observation window are different things.

The existing device migration remains unapplied, and real authenticated Founder browser proof remains outstanding. Nothing in this request was treated as approval of the previously rejected live access migration.

## 2. What the current measurements can prove

Read-only MAPCO-DEV inspection in this session:
- 8 presentation events: 4 property-add starts, 2 property-added completions, 2 location confirmations.
- All 8 carry build `dev`, surface `admin`, and no environment tag.
- 7 buyer event rows.
- 0 structured trial, evidence or prediction rows.
- No public table with consent/privacy in its name; source inspection also found no learning-consent gate in the inspected ingestion path.
- Device-access status RPC absent.

These are development-project records, not evidence about real dealer behavior. No customer text, contacts, documents or credentials were retrieved. These counts cannot establish trial demand or production telemetry health.

Specific interpretation problems:

1. **Environment leakage.** Older usage queries exclude metadata.env='local'. The current frontend metadata builder has no environment envelope and strips arbitrary caller keys, including env. The eight dev rows have no env tag. Therefore these rows satisfy that older inclusion filter. Repairing capture without fixing eligibility can make a dashboard confidently wrong.

2. **Incomplete funnels.** A start is not a completed workflow, and a saved draft is not a published listing. Add Property emits property_added once for the first persisted row. Refresh/crash/background exits are deliberately not reported as abandonment. Four starts minus two saves is not a defensible abandonment count.

3. **No attempt identity.** The current envelope has a tab session, but no stable per-workflow attempt ID. Interleaved attempts and retries cannot be joined reliably by chronology alone. The older RPC supports event IDs; the current emitter does not pass one. Adding retries before supplying stable IDs would risk duplicate evidence.

4. **Unobservable delivery.** The general emitter returns success even if capture fails, with warnings only in development. Keeping product saves independent is correct. Hiding measurement failures from the founder is not. A receipt/coverage channel can expose collection health without telling the dealer that a saved property failed.

5. **Overstated intent.** `visit_requested` fires when opening a prepared WhatsApp message after selecting a date and time. It does not prove send, delivery, dealer acceptance or a completed visit. The page copy already explains this better than the event name.

6. **Buyer identity.** A public link open is an anonymous browser interaction. Embedded dealer preview deliberately omits reporting, but a dealer opening the public URL is not thereby proven to be a buyer. Shared devices and forwarded links add ambiguity.

7. **Attribution windows.** Trial milestones join dealer ID and time bounds; buyer_engagement_v is a per-link lifetime aggregate. Founder Control sums those link aggregates. That is not automatically “what buyers did during this trial.” Overlapping trials and early commercial closure need explicit treatment.

8. **Missing first link.** trial_milestones_v asks for client_link_created events, while the current dealer emitter path does not produce them. The authoritative share-link row can prove creation; the view should not imply none existed because an unimplemented event is absent.

## 3. The recurring problem

Every generation tries to answer: “What should I do next with this dealer?”

Dealer 360 answers from activity thresholds. Sounding answers from prediction error and relationship heuristics. The evidence foundation preserves facts for a future answer. Founder Control makes account actions and records accessible.

The deeper question is: **“Which belief is making me choose this action, and what observation would make me choose differently?”**

The unit of learning is neither a click nor a dealer. It is a decision whose alternatives imply different observable outcomes. Rich telemetry helps locate the episode; it rarely explains the reason by itself. Ten correlated predictions about one coached encounter are not ten independent tests of a market thesis.

## 4. What I would build

Working name: **Decision Cases**. One private Founder product, with Account Operations retained as a separate workspace. The daily entrance is a short preparation/review queue, not a wall of metrics.

A case contains:
- The consequential decision: for example, fix mobile location selection before more onboarding, or invest in richer PI.
- The current belief, a serious rival explanation and what action differs between them.
- A bounded prediction with an observable resolution rule and deadline, fixed before the episode.
- The real opportunity: was there an appropriate buyer/property/task, was the feature offered and accessible, and who supplied help?
- Linked observations, provenance, consent scope, instrument version and capture coverage.
- Contradictory evidence presented alongside support.
- A founder decision, rationale, review date and later result. Revisions append; history is not silently rewritten.

Three short interactions are sufficient initially:

**Before a visit:** identify one decision that matters, state expected behavior and a rival explanation. No arbitrary requirement for two predictions.

**After an episode:** a factual replay assembled from eligible rows: what was attempted, what persisted, help received, what was said, where capture stopped. Ask one discriminating question, not a generic satisfaction score.

**Weekly:** review unresolved or contradicted cases. Select the cheapest ethical observation likely to change an actual action. Record what changed in the product/pitch and whether the decision helped.

Example: a dealer creates no links. Possible explanations are weak value, no suitable buyer this week, failed creation, discomfort sharing location, or founder coaching carrying the first session. A generic “At risk” badge calls for a follow-up. A decision case identifies which of those explanations remain possible and arranges one normal, consented task that separates them. It never calls missing telemetry a failed task.

The unusual advantage would be a **library of disconfirmed explanations**, attached to original evidence and product decisions. A new dealer's episode can challenge a familiar explanation without becoming a fabricated “dealer archetype.” Over time this accumulates company memory that survives changing pitches, developers and dashboards.

## 5. Data model and reuse

Retain existing tables and contracts where semantics fit:
- dealer_settings/provisioning/devices: access and operations.
- trials: commercial offer context; add or associate a separate observation window instead of changing the historical meaning of closed_at.
- evidence: human observations and explicit provenance.
- predictions: immutable stakes; extend with resolution rule, decision-case link and correction history.
- presentation_events/client_link_events: bounded interaction facts.
- canonical property/link/deal records: persistence truth.

New concepts, introduced in small migrations only when the first workflow needs them:
- consent receipt and withdrawal ledger, versioned by scope and subject.
- decision cases and append-only case revisions.
- episodes linking relevant observations, interventions and opportunity context.
- typed evidence links: supports / contradicts / context / resolves, with source identifiers.
- capture eligibility and health: instrument version, environment, attempted/accepted receipt state and coverage interval.
- workflow attempt ID and event ID; assistance context recorded explicitly, never inferred from account role.

Do not duplicate the general event store, rebuild maps, or create a separate “Sounding app.” Do not add a vector database, opaque dealer scores or autonomous account actions. Forecast scores remain descriptive, domain-specific, with resolved/pending/unresolvable counts and encounter concentration exposed. They do not generate confidence-discount advice from a tiny bucket.

## 6. Consent and privacy as part of evidence quality

Proposed product policy, not a claim about legal compliance:
- Optional product-learning participation is separate from account access, payment, operational security logs and a deliberately requested support session.
- Plain-language choice before collection: specific actions and outcomes, purpose, who can see them, duration, withdrawal and deletion options. Declining must not quietly degrade the paid/trial product.
- Dealer organisation approval does not prove that every staff member or buyer agreed. Define and display actor-facing notices/choices; buyer-link operations and optional founder research are separate purposes.
- No keystrokes, screen recording, clipboard, unrelated browsing, WhatsApp contents, contacts, exact locations, property documents or private notes in usage telemetry.
- A volunteered quote requires explicit, scoped handling. Redact third-party details; never import private dealer notes wholesale.
- Server enforces the scope at ingestion; the client gate is additional protection. Withdrawal prevents future optional ingestion and read-model reuse according to the stated policy. Pending queues must not replay withdrawn events.
- Historic rows have unknown consent unless supported by a real receipt. Do not manufacture retrospective consent.
- Proposed initial raw research retention: 30 days, with separately permissioned excerpts needed for open cases reviewed after 90 days. Implement expiry/deletion tests, not merely a policy paragraph. Final durations should fit the actual study and applicable obligations.
- Consented data is still not automatically eligible: test traffic, weak identity, absent opportunity and broken capture remain visible exclusions.
- No external AI provider gets raw dealer material by default.

AI is optional later: suggest rival explanations, retrieve contradictory cases and draft questions from a redacted, permissioned evidence packet. Every factual sentence must cite its source. The founder resolves claims. The system can say “not enough evidence.” It must not infer intent from a click or silently change treatment.

## 7. Build order and proof

First vertical slice: **Can a consenting dealer complete one useful task without founder assistance?** Support either adding a property or preparing a client link, depending on the case. Do not make links the universal activation thesis.

1. Measurement eligibility/consent and capture receipts before expanding collection.
2. Truthful event semantics and authoritative-row reconciliation. Fix local/test tagging and workflow IDs.
3. One decision case: stake → episode → evidence → resolve → decide → review, using existing Founder identity and backend.
4. Browser proof on MAPCO-DEV: opt-out emits no optional events; opt-in capture survives reload; revoke stops ingestion and queued replay; retries dedupe; same-tenant actions reconcile; another tenant cannot read/write; founder help is explicit; WhatsApp handoff is never labelled delivered; missing capture yields unknown.
5. Add a second case only after the first changes a real founder action. Then evaluate whether a weekly review is being used and whether it exposes disconfirming observations.

No fixed dealer-count unlock schedule and no simulated precision. Stop adding software when the next bottleneck is getting permission, observing a task or talking to the dealer. The measure of success is whether a consequential decision was improved by evidence that could have contradicted it, not the volume of collected activity.

## 8. What was done in this research pass

Inspected branches, worktrees, reflogs, historical commit diffs, the donor historical branch, local Claude archives, live emitter/view code and the Codex review checkpoint. Queried MAPCO-DEV read-only for aggregate coverage. No production access, no migrations, no new telemetry, no account changes, no invitations and no modifications to the shared product tree.

This report is committed separately on codex/founder-intelligence-archaeology. It deliberately does not ship another dashboard before the measurement and consent contracts are settled. The next implementation is the narrow vertical slice above, not an expansion of every prior concept.

Limit: local archives contain artifacts/specifications, not the full original Claude conversation. Historical staging claims were inspected, not freshly reproduced. The eight dev events cannot establish production capture reliability or real-user value.


Verification in the isolated checkpoint: 104 tests passed across telemetry-contract, add-property-telemetry and evidence-foundation. These are contract tests, not authenticated browser proof. SOURCE-INDEX.json records the source commits, archive hashes and aggregate development snapshot.
