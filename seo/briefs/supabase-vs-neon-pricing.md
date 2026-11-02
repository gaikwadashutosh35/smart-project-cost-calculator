> **Correction (2026-11-02, before drafting):** Neon includes authentication ("Managed Better Auth", no separate charge up to 60,000 MAU per project on Free and 1,000,000 on paid plans — neon.com/pricing). The "Neon + Clerk auth" column and the "$1,760 more expensive" angle below are wrong and were not used. The published page compares Supabase Pro with Neon Launch, auth included on both: at 150,000 MAU Neon is $128.38 vs Supabase $293.50.

## Content Brief: supabase vs neon pricing

### Search Intent
Commercial investigation: developers and founders choosing a Postgres host want to know which one costs less **for their usage**, not a feature tour. The results reward long-form comparisons with tables (1,400–3,500 words) plus one calculator page. Audience: technical founders and developers, comfortable with GB and MAU but not with CU-hours.

### Competitor Analysis
| # | URL | Key H2 Sections | Est. Words | Score | Main Gap |
|---|-----|-----------------|------------|-------|----------|
| 1 | makerkit.dev/pricing-calculator/supabase-vs-neon | Calculator UI only | ~400 | 24/40 | Almost no text; one default preset; Neon always-on by default; sells a Supabase kit |
| 2 | bytebase.com/blog/neon-vs-supabase | Architecture, Branching, Pricing, FAQ | ~1,450 | 27/40 | Feature comparison; no totals or overage rates; Neon Free storage stale (0.5 GB) |
| 3 | jetadmin.io/blog/neon-vs-supabase | At a glance, Scale-to-zero, Where the money differs, FAQ | ~1,750 | 28/40 | Wrong maths (5 Pro projects ≠ $125); compares 1 CU Neon with Micro Supabase |
| 4 | costbench.com/compare/neon-vs-supabase | Plans, Cost at scale, Hidden costs | ~150 prose | 17/40 | Neon paid plans called "custom"; Neon storage $1.50/GB (now $0.35); no workings |
| 5 | designrevision.com/blog/supabase-vs-neon | Quick comparison, Pricing, Branching, Performance, FAQ | ~3,500 | 31/40 | Refuses to show totals; no official source links; Neon Free storage stale |

### Content Gaps and Opportunities
- **Topic gap:** none shows side-by-side totals at several usage levels with line items.
- **Topic gap:** auth cost. Supabase includes 100,000 MAU; Neon needs auth from elsewhere, which dominates the bill at scale. No page prices this.
- **Depth gap:** egress overage on both sides (Supabase 250 GB then $0.09/GB; Neon 500 GB then $0.10/GB).
- **Depth gap:** correct multi-project maths (Supabase: one $25 fee + $10 compute per extra project; Neon: idle projects scale to zero).
- **Quality gap:** like-for-like compute sizing (Supabase Micro 1 GB ↔ Neon 0.25 CU 1 GB; Small 2 GB ↔ 0.5 CU; Medium 4 GB ↔ 1 CU).
- **Quality gap:** stale or wrong Neon numbers on 3 of 5 pages; only 2 link the official pricing pages.

### Winning Outline

**H1:** Supabase vs Neon pricing: what you'll actually pay in 2026
**URL Slug:** /guides/supabase-vs-neon-pricing/
**Target Word Count:** ~1,800 words (editorial competitor average: ~1,550 words)

**Intro (~120 words, FS target).** Answer first: Neon is cheaper for small or mostly idle databases because it scales to zero; on a busy always-on database the two are close; once you count authentication, Supabase is far cheaper at scale because 100,000 monthly active users are included. Primary keyword in the first sentence. One line on the prices' check date and a link to the official pages.

**H2: Supabase vs Neon pricing at a glance (~200 words, FS target: table)**
Table: plan fee, compute model, included database storage, storage overage, egress included and overage, auth, free tier, inactivity behaviour. Use primary keyword in H2. Values from the catalogue (Supabase Pro $25 incl. Micro, 8 GB, 250 GB egress, 100k MAU, 100 GB files; Neon Launch $0 minimum, $0.106/CU-hour, $0.35/GB-month, 500 GB egress then $0.10/GB).

**H2: What do Supabase and Neon cost at 1,000 to 150,000 users? (~350 words, FS target: table)**
Generated table, four scenarios with line items (database only, then with auth):

| Scenario | Usage | Supabase Pro | Neon Launch (db only) | Neon + Clerk auth |
|---|---|---|---|---|
| Side project | 1k MAU, 0.4 GB, 3 GB egress, idle most of the time | $25 (Free also fits) | $3.32 (Free also fits) | $3.32 |
| Startup | 10k MAU, 5 GB, 60 GB egress, always on | $25 | $21.09 | $21.09 |
| Growing | 50k MAU, 20 GB, 300 GB egress, Small ↔ 0.5 CU | $36 | $45.69 | $45.69 |
| Scale | 150k MAU, 60 GB, 800 GB egress, Medium ↔ 1 CU | $293.50 | $128.38 | $2,053.38 |

- H3: How the compute sizes were matched (Micro ↔ 0.25 CU, Small ↔ 0.5 CU, Medium ↔ 1 CU; 1 CU ≈ 4 GB RAM).
- Body: mention primary keyword once; link to the Supabase calculator and the main calculator to run their own numbers.

**H2: Supabase vs Neon free tier (~200 words)**
Secondary keyword "supabase vs neon free tier" in H2. Supabase Free: 500 MB, 5 GB egress, 50k MAU, 1 GB files, 2 active projects, paused after 1 week. Neon Free: 1 GB per project, 100 CU-hours per project, 5 GB egress, no inactivity pausing (compute suspends when limits hit). Correct the common 0.5 GB error without naming competitors.

**H2: Where the two bills differ (~300 words)**
- H3: Compute — fixed instances vs CU-hours (scale to zero; always-on 0.25 CU ≈ 182.5 CU-hours ≈ $19.35/month).
- H3: Storage — $0.125/GB above 8 GB vs $0.35/GB from the first GB.
- H3: Egress — 250 GB vs 500 GB included.
- H3: Authentication — included on Supabase up to 100k MAU, then $0.00325/MAU; on Neon you add an auth service (Clerk: free to 50k retained users, then from $0.02 each).

**H2: Several projects or environments (~150 words)**
Supabase: one Pro fee per organisation plus about $10/month compute per extra project. Neon: projects that sit idle scale to zero. Give the correct 5-project maths.

**H2: Which is cheaper for your app? (~150 words)**
Bullet decision list: choose Neon if … / choose Supabase if …, each tied to a scenario row.

**H2: Frequently asked questions (~250 words)**
Is Neon cheaper than Supabase? · What does a Neon CU-hour cost? · Does Neon include authentication? · How much does Supabase or Neon cost for 100,000 users? · Do Supabase and Neon charge for egress?

**Sources (~50 words)** — supabase.com/pricing, neon.com/pricing, clerk.com/pricing with check dates. **Read next** links.

### Recommended Meta Tags

**Title**
Supabase vs Neon Pricing: Real Costs at 4 Usage Levels

**Meta Description**
Supabase vs Neon compared with verified Nov 2026 prices: free tiers, overages and monthly totals from 1,000 to 150,000 users. See which is cheaper.

### Unique Angle and Information Gain
The only comparison with like-for-like monthly totals at four usage levels, computed line by line from prices read on the official pricing pages on 1 November 2026, and the only one that prices authentication: at 150,000 users Neon's database is $165 cheaper than Supabase's, but adding a hosted auth service makes the Neon stack about $1,760 more expensive. Every number is reproducible in the site's calculators.

### E-E-A-T Requirements
- Visible "Updated" date, "prices checked" date and a link to the method page.
- Official pricing pages linked for every price (Supabase, Neon, Clerk).
- Workings shown for each scenario (sizes, hours, GB), so readers can check them.
- Publisher: the site's organisation, with a "not affiliated with Supabase or Neon" note.
- Unverified items (Neon branch pricing, Neon Auth limits, Supabase Team plan) left out until checked on the official pages.

### Internal Linking Opportunities
- Spoke → pillar: "Supabase pricing calculator" → /supabase-pricing-calculator/ (intro and scenarios section).
- "estimate your whole stack, not just the database" → / (scenarios section).
- "how the estimates are calculated" → /about/ (sources).
- Add a reverse link from /supabase-pricing-calculator/ ("Supabase vs Neon pricing") once this page is live.
