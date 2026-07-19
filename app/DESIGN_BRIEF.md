# DESIGN_BRIEF.md — Fulltime

> The hard-constraints brief for redesigning the Fulltime app. Built against the
> **family.co** reference (`app/design-ref/family/family-design/`) — adapted, not cloned.
> Rule for Step 4: if a decision isn't answered here, it's a bug in this brief — fix the
> brief, don't improvise in code.

---

## 0. Brand facts (the real inputs)

- **Name:** Fulltime
- **What it is:** a trustless World-Cup **prediction market on Solana** — every market settles
  from a cryptographic TxLINE proof (no admin, no trusted oracle). Markets, parlays, and a
  P2P back/lay exchange.
- **One-liner (voice):** *"Settled by proof, not by trust."*
- **Logo:** ❌ none exists today (just an "FT" gradient chip). **This brief defines a wordmark**
  (§7.1) — there is no logo file to derive from, so the palette is derived from the reference +
  our thesis instead.
- **Voice:** confident, calm, human, a little playful — never degen/casino, never cold-corporate.
  Sentences in the display face end in periods, like the reference ("Settled. Not promised.").

---

## 1. What we steal from Family vs. what we adapt

**Steal (the craft):** warm near-black + off-white, a **huge rounded grotesque** display, **solid
pill buttons**, **one accent used sparingly**, **generous whitespace**, joyful **flat mascot**
illustration, the **✓-benefit-list** pattern, and **dark rounded product cards floating on a light
page**.

**Adapt (make it ours):**
- Family is a *light* consumer site whose product UI is *dark cards*. We keep that exact split:
  **light warm shell + dark "proof-ticket" cards** for all market/odds/settlement data.
- Reassign the accent from Family's trust-blue to **an electric pitch-green tied to our thesis**
  (proof / valid / settled / YES / live). Football-native *and* on-message.
- Mascots become **football-world characters** (ball, whistle, trophy, net, corner-flag), same flat
  rounded treatment.
- Add what a markets product needs and a wallet doesn't: **tabular mono numerics** for odds, pots,
  scores, and tx hashes.

> Honesty note: skillui's auto-tokens labeled the theme "dark #222" — that's the docs *app*, not the
> marketing site. The real homepage is light/cream. Values below come from eyes-on screenshots.

---

## 2. Fonts (hard)

| Role | Font (Google) | Fallback stack | Weights |
|---|---|---|---|
| **Display** (headlines, wordmark, big numbers-as-headline) | **Gabarito** | `"Gabarito", ui-rounded, "Segoe UI", system-ui, sans-serif` | 600, 700 |
| **Body / UI** | **Hanken Grotesk** | `"Hanken Grotesk", system-ui, sans-serif` | 400, 500, 600 |
| **Mono / numerics** (odds, pots, scores, hashes, code) | **IBM Plex Mono** | `"IBM Plex Mono", ui-monospace, "SF Mono", monospace` | 400, 500 |

- **Gabarito** is the Family analog: rounded, warm, confident geometric grotesque — the personality
  of "Family" without the proprietary font.
- Every price/odd/score/hash renders in **IBM Plex Mono** with `font-variant-numeric: tabular-nums`.
- **BANNED fonts (never load or reference):** Inter, Roboto, Arial, **Space Grotesk**, Poppins.
  (The current app uses Inter + Space Grotesk — both must be removed from `layout.tsx`.)
- Max **3 sizes per screen** for prose hierarchy; use weight/color/mono for the rest, not more sizes.

---

## 3. Palette (hard — each hex has a role + coverage)

### Light shell (the page)
| Token | Hex | Role | ~Coverage |
|---|---|---|---|
| `bg` | `#FBFAF7` | Page background (warm off-white / cream) | ~55% |
| `surface` | `#FFFFFF` | Light cards, raised panels | ~12% |
| `ink` | `#1A1A1A` | Primary text, headlines, **primary pill buttons**, dark cards | ~18% |
| `ink-muted` | `#5C5854` | Body/secondary text on light | ~4% |
| `hairline` | `#E7E3DA` | Borders, dividers on light | ~3% |

### Dark "proof-ticket" surface (all market/odds/settlement data)
| Token | Hex | Role | ~Coverage |
|---|---|---|---|
| `panel` | `#161514` | Dark card background (**warm** near-black — NOT slate) | ~8% |
| `panel-2` | `#211F1D` | Nested rows / inputs inside a dark card | — |
| `panel-ink` | `#FFFFFF` | Text on dark cards | — |
| `panel-muted` | `#9A938C` | Muted text on dark cards | — |
| `panel-hairline`| `#302D2A` | Borders/dividers on dark | — |

### Accent + semantic (used sparingly — this is what makes it "ours")
| Token | Hex | Role | Rule | ~Coverage |
|---|---|---|---|---|
| `accent` | `#12E27E` | **Proof / valid / settled / YES / live / focus** | Electric pitch-green. Use as **fill or ink-on-dark**, never as small text on the cream bg. | ~4% |
| `accent-ink`| `#08170E` | Text/icon placed **on** an accent fill | — | — |
| `negative` | `#F0552E` | **NO / void / loss / lay-side** | Warm coral (adapted from Family's orange). | ~2% |
| `info` | `#0A0A0A` | Links = ink underlined; **no blue links.** | Keep it monochrome; accent is reserved. | — |

**Accent discipline:** black/ink is the workhorse for buttons and structure (Family's move);
`accent` green only lights up when something is **proven, live, winning, or the YES side**. If green
is on more than ~1/12 of the screen, it's overused.

---

## 4. Type scale (hard — px / line-height / tracking / font)

| Token | Size | Line-height | Tracking | Font / weight |
|---|---|---|---|---|
| `display` (hero H1) | 72px | 1.04 | −0.02em | Gabarito 700 |
| `h1` | 56px | 1.08 | −0.02em | Gabarito 700 |
| `h2` | 40px | 1.10 | −0.015em | Gabarito 700 |
| `h3` | 28px | 1.16 | −0.01em | Gabarito 600 |
| `h4` | 20px | 1.25 | −0.005em | Gabarito 600 |
| `body-lg` | 18px | 1.5 | 0 | Hanken 400 |
| `body` | 15px | 1.55 | 0 | Hanken 400 |
| `small` | 13px | 1.4 | 0 | Hanken 500 |
| `overline` | 12px | 1.3 | +0.08em, UPPERCASE | Hanken 600 |
| `num` (odds/pot/score) | 20–32px | 1.0 | 0 | IBM Plex Mono 500, tabular-nums |
| `num-sm` (rows/hashes) | 13–14px | 1.3 | 0 | IBM Plex Mono 400, tabular-nums |

Mobile: `display` → 44px, `h1` → 36px, `h2` → 28px. Keep line-heights.

---

## 5. Spacing, rhythm, radius (hard)

- **Base grid: 4px.** Every margin/padding/gap is a multiple of 4. Scale: 4, 8, 12, 16, 20, 24, 32,
  40, 48, 64, 96, 128.
- **Section vertical rhythm:** 128px between major sections (desktop), 64px (mobile). Family breathes —
  don't crowd.
- **Content max-width:** 1072px for marketing/hero; market tables may widen to 1200px.
- **Radius scale (rounded language):** pills/buttons/chips `9999px` (full) · dark ticket cards `24px` ·
  light cards `20px` · inputs `12px` · small tags `8px`. Nothing sharper than 8px except hairlines.
- **Elevation:** flat by default. Dark cards on light get one soft shadow: `0 12px 32px rgba(0,0,0,0.10)`.
  **No backdrop-blur, no glassmorphism** (Family bans it; so do we).

---

## 6. THE signature hero element (one, concrete)

**"Matchday, settled."** — the hero is a huge rounded-grotesque headline
(*"Settled by proof. Not by trust."*) with:

1. A **confetti field of flat football mascots** around/behind the words — a smiling soccer-ball
   buddy mid-kick, a whistle, a trophy-with-a-face, a goal-net, a corner flag, plus small national-color
   orbs. Same flat treatment as §8. They drift on a gentle spring loop (respect reduced-motion).
2. **One dark "proof-ticket" card** floating in the hero showing a *real* settled market:
   `FRA 1–0 · YES ✓` with `settled from TxLINE proof` and a mono tx hash that links to Solana Explorer.
   This is the twist that marries Family's joy to our unique claim — the first thing a judge sees is a
   real on-chain settlement, rendered beautifully.
3. Two pill buttons: primary **ink** pill `Open the markets →`, secondary cream pill `See a proof ✓`.

No other page gets this treatment; it is the hero's alone.

---

## 7. Component patterns (Step-4 build targets)

### 7.1 Wordmark (we're defining the logo)
"**Fulltime**" set in Gabarito 700, −0.02em, ink. Preceding it: a **12px rounded-square "pitch" glyph**
— a rounded square (radius 5px) in `accent` green with a single thin white center line (a football
pitch's halfway line), *not* the letters "FT". On dark surfaces the glyph stays green, the word goes white.

### 7.2 Buttons
- **Primary:** solid `ink` pill, white label, `padding 12px 20px`, radius full. Hover: lift to `#000`
  + shadow. On dark cards, primary flips to white pill / ink label.
- **Secondary:** transparent with `hairline` border pill, ink label. Hover: `surface` fill.
- **Accent (rare):** solid `accent` fill + `accent-ink` label — only for the single most important
  "commit" action on a screen (e.g. **Place bet**, **Settle from proof**).
- Icon + label allowed; **no emoji as icons** (§9). Use line icons (Lucide-style, 1.5px stroke).

### 7.3 Dark "proof-ticket" market card (the product signature)
`panel` bg, radius 24px, soft shadow, 20px padding. Contains: fixture line (flags + `TEAM 1–0 TEAM`
in mono), market question (Gabarito h4), a **YES pill** (`accent` fill) and **NO pill** (`negative`
outline), pot + odds in `num` mono, and a status chip. Settled tickets show a green `✓ settled from
proof` chip + short mono tx hash.

### 7.4 Chips / status
Full-radius, 12px overline text. States: `LIVE` (accent dot + label), `SETTLED ✓` (accent),
`OPEN` (ink-muted), `VOID` (negative). One consistent chip everywhere.

### 7.5 ✓-benefit list (Family pattern)
Two-column list, each item = `accent` check glyph + Hanken 500 label. Used for the trust/"why proof"
section. Never gray text on a colored background (§9).

### 7.6 Numerics & tables
All numbers mono + tabular. Market tables: no zebra striping (Family bans it); separate rows with
`hairline` only. Right-align all numeric columns. Positive PnL `accent`, negative `negative`.

### 7.7 Inputs
`surface` bg (or `panel-2` on dark), `hairline` border, radius 12px, focus = 2px `accent` ring.
Label in `overline`. 16px gap between fields.

---

## 8. Illustration / image treatment (one rule, applied everywhere)

**Every illustration is a flat, rounded mascot** with a simple dot-eyes face, 2–3 flat fills drawn
only from the palette, optional rounded stub arms/legs, and one soft elliptical **shadow puddle**
beneath. **No gradients, no 3D, no outlines, no stock photography, no emoji.** Product/data is never a
photo — it's shown *inside* a dark proof-ticket card (§7.3). If an asset can't be made as a flat mascot
or a dark card, it doesn't go in.

---

## 9. Banned tells (reject on sight)

- Emoji used as icons or bullets (mascots and line-icons only).
- Glassmorphism / backdrop-blur / frosted panels.
- Purple→blue gradients (or any gradient on text/buttons).
- Cards-in-cards; three-equal-cards-each-with-an-icon-tile.
- Centered-everything (Family uses confident left-aligned type; center only the hero headline).
- Gray text on a colored background.
- **Cold slate / blue-black** (`#0f172a`, `#020617`) — we use **warm** near-black (`#161514`).
- **Default-Tailwind green** (`#22c55e`) — replaced by `accent` `#12E27E`.
- Inter / Space Grotesk / Roboto / Arial / Poppins (§2).
- Zebra-striped tables.

---

## 10. The one decision to sign off (everything else is locked)

**Light warm shell + dark proof-ticket cards** (recommended, faithful to Family, best demo contrast)
— *vs.* **dark-only** (warm near-black `#161514` everywhere, keep the app dark like today; light cards
become the rare surface). Both use the same fonts/accent/rhythm; only the canvas flips. Brief is written
for the **light-shell** option; say the word and I invert §3 for dark-only in ~2 lines.

---

## 11. Contrast / QA gate (run at the end of Step 4, before "done")

- `ink #1A1A1A` on `bg #FBFAF7` → ~16:1 ✓ · `ink-muted #5C5854` on `bg` → ~6.4:1 ✓ (AA body).
- `panel-ink #FFF` on `panel #161514` → ~18:1 ✓ · `accent #12E27E` on `panel` → ~9:1 ✓.
- `accent #12E27E` is **fill/ink-on-dark only** — verify it is never <18px text on `bg` (fails AA).
- `accent-ink #08170E` on `accent #12E27E` fill → ~8:1 ✓.
- Every interactive element has a visible `accent` focus ring.
- `prefers-reduced-motion`: mascot drift + spring reveals disabled.
- Zero banned tells (§9) present. Zero uses of Inter/Space Grotesk remaining in the build.
