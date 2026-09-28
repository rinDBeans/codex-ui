# Changelog

[简体中文](CHANGELOG.zh-CN.md)

## 0.6.0 - 2026-09-28

Face B of the model picker (the Codex reasoning power rail) lands, together with a full-repository review against the
replication spec and fixes for what it confirmed.

### ⑳ Model picker face B: our own component takes over the model seat

- **Seat takeover in the DOM, never parasitic on the host menu** (0.5.0's CSS re-layout was slow and bare, and was
  reverted). Our trigger is appended to `[data-slot="conversation.input.model"]` and the popover to `document.body`;
  while our trigger is in the seat, **one** direct-child `:has()` in `model-picker.css` sets the host's child to
  `display:none` (it stays in the React tree). No marker attribute: React replacing the host child would drop it and the
  host control would flash back; `:has()` only asks "are we seated", and removing our trigger restores the host at once.
- **Data and commits go through the host only**: `ctx.inject(['modelDirectories'], …)` waits for the service (the same
  hook the host uses for its own seat; a missing service never blocks the skin), subscribes to `directoryFor(session).store`
  and commits with `select({ provider, model, reasoningEffort })`. The session id comes from the seat's
  `data-conversation-session` ancestor (the right-bar side chat has its own seat), falling back to `uiSession`. Seats the
  host did not render (subagent sessions) are left alone.
- **Power rail verbatim from the Codex source**: track 24px / radius 12 / 10% foreground / `inset .5px` stroke; ticks
  4px with a 16px hit area, passed ticks 30% white; thumb a 28px white disc / `.5px` strong stroke / `0 0 2px` shadow;
  filled part in the accent, ending at the thumb centre; motion `.3s cubic-bezier(.23,1,.32,1)`, thumb 0s on the first
  frame and .3s after 16ms. Popover 254px wide (`spacing × 63.5`), enters in `.32s … 30ms` from `scale(.98)`; placed like
  the host `place()` (right-aligned, 8px above, 12px viewport margin).
- **Interaction**: real drag (grab on press → free slide with **no commit** → one commit snapped to the nearest level on
  release), `touch-action: none`; ←/→/Home/End; keyboard focus draws the 2px ring on the thumb; Escape closes and returns
  focus (also when a mouse-open left focus on the trigger); choosing a model commits that model's default effort and
  closes on success. Level count and names come from `reasoning.efforts`.
- **During the round trip** (the host marks the directory `selecting` for the whole selectModel round trip): status is
  not part of the list signature, so the card is neither redrawn nor cleared; the rail and trigger show the pending level
  optimistically with a spinner beside it (on a model change, at the end of that row). On failure the popover shows the
  host's own message (with the session-in-use case spelled out) and the rail returns to the effective level.
- The trigger's effort label follows Codex `_ModelPickerTriggerEffortText`: all names stacked in one cell with a blurred
  cross-fade, so the width never jumps.
- Copy is borrowed from the host `model` namespace first (word-for-word with the native menu, built-in model descriptions
  localized too); our own table is only the fallback.
- New settings row "Codex model picker" (`modelPicker`, **on by default**). Off removes every node of ours and the host
  menu (⑫ face A) returns at once; while the settings document has not arrived the component does not take over, so it
  never flashes on and off. **`Config` therefore has 12 fields** (the replication spec lists 11 plus the theme preference).
- **Not built**: the three advanced states of the Codex rail (highlight, Fast-mode tick fly-out, the purple/blue gradient
  beyond the maximum) — DSH has neither Fast mode nor that state; the purple Max label on the trigger is skipped too,
  being outside the color whitelist.
- Note: 606faea once committed a 0.6.0 under the same name, but only the generated `client.js` — the component and style
  sources, the build change, the checks and the probe never reached the repository — and it was reverted. This release is
  a complete redo with sources, build and verification committed together.

### Review fixes

- **Two sources for the composer shadow**: `patches.css` ⑧ still carried `[data-composer-card] { box-shadow:
  var(--dsw-elevation-panel) }`, a second source next to `composer.css` ⑭'s three Codex layers (specificity decided the
  winner). The host only renders this card inside the conversation scroller; removed.
- **`--dsw-elevation-soft` is no longer invented**: 0.5.10's `0 8px 28px` at 10% ink (55% black in dark) had neither a
  measurement nor a source anchor, yet it landed on the host `SegmentedControl` thumb — every segmented control in
  settings wore it. The host's own value is back in charge.
- `--dsw-elevation-stroke` is now `0 0 0 .5px var(--dsw-elevation-stroke-color)` (the spec's wording; computed value unchanged).
- **Font stacks** are declared verbatim once in `skin.css` (checked word-for-word against the host 0.1.7-rc.2
  base_css_default), so the look no longer drifts with the host version.
- **Focus ring wired to the host token**: `--dsw-focus-ring-color: var(--dsw-codex-focus)`. The host's ten box-shadow ring
  rules used to fall back to ink and are now Codex blue; the skin's own rings read the token too, which makes them honour
  the host's "no ring for pointer input" contract (under `html[data-input-modality=pointer]` the host sets it to
  transparent in place).
- New `--dsw-codex-border` (10% / 12%) and `--dsw-codex-border-strong` (15% / 20%) — Codex's `--color-border` and
  `--color-border-strong`.
- **Wrong dark default on the settings card**: `SKIN_DEFAULTS.dark.surface` was still `#181818` although the dark window
  background has been `#111111` since 0.5.6, so the background swatch showed a "follow skin" value that was not the skin's.
  Fixed; `check-repo` now reconciles every field against skin.css and fails on drift.
- `.cx-error` read a token that does not exist (`--dsw-alias-state-error`), so "the save did not take effect" was plain
  text colour; it now reads `error-primary`.
- **Font stack validation hardened**: `isFontStack` also rejects backslashes (`u\72l(` tokenizes as `url(`), comment
  delimiters (a comment opened inside the value swallowed the whole dark override block), control characters and
  unbalanced quotes. `check-repo` asserts the "dark block survives" outcome on the generated CSS.
- **The installer wrote invalid YAML on a fresh profile**: dsh rc.2 creates `cordis.patch.yml` as a flow-style `[]`, and
  appending `- insert:` after it made `dsh web` die at boot with `failed to parse overlay`. An empty `[]` is now removed
  first; a non-empty flow list is refused with a hint.
- **A local path shipped in the artifacts**: a clone path in a `composer.css` comment was copied verbatim into `theme.css`
  and `client.js`, while the repository check only scanned JS and missed the JSON-escaped double backslash. The check now
  covers stylesheets and docs in both spellings; local paths in `docs/` became placeholders.
- Stale comments: card radius 10px → 12px, "links are ink" → accent, 100ms → 150ms transitions, composer 14px → 16px,
  ⑫ row radius 8 → 13, `install-plugin.mjs` → `src/build.mjs` in the layer headers, "five stylesheets" in `build.mjs`,
  and the skin README's file table and "links are ink" rule.

### Verification

- **New** `scripts/power-rail-verify.mjs` (47 assertions, Chromium only): the real component and the real theme.css
  against a fake directory written to the host contract, with `select()` slowed to 600ms on purpose — the real host
  answers locally in under 60ms, too fast to observe pending behaviour in the live GUI. It found and fixed two defects:
  built-in model descriptions rendered the dictionary key when no host dictionary was present, and Escape did nothing
  while a mouse-open left focus on the trigger.
- **New** `scripts/pack-host-asar.mjs`: without a desktop shell, packs npm-installed host packages (the same set the shell
  ships) into an `app.asar` the fixtures can read.
- `hero-verify.mjs`: "badge radius stays the official 6px" hard-coded rc.1's literal; rc.2 changed it to
  `var(--dsw-radius-xs)` (the host gives 4px), so it always failed on rc.2. The expected value is now read from the host source.
- `live-gui-probe.mjs`: a fresh profile opens with two onboarding dialogs and the probe's clicks landed on their backdrop
  — that is where the three "measured none" right-panel failures came from; the dialogs are dismissed first now. The model
  seat is measured as face B (7 assertions: takeover, geometry, a keyboard change written into the host store and reverted);
  with face B off it measures the face A pending window, with `--latency` (800ms by default) added to that round trip,
  otherwise the window closes before the first sample. The probe puts the effort back afterwards.
- `settings-page-verify.mjs`: 9 rows; the dark background assertion still expected the pre-0.5.6 `#181818` and now expects
  `#111111`; five new assertions for the switch (off, reload, no trigger of ours in the seat, host control visible, reset).
- Full run (npm `@deepseek-ai/dsh@0.1.7-rc.2` + an asar packed from it + Edge/Chromium 153; live GUI on a `dsh web` of the
  same version): `check-repo` 23/23 · `audit` 36/36 · `elevation` 19/19 · `composer-shadow` 23/23 · `model-picker` 20 ·
  `power-rail` 47/47 · `rightbar` 42 · `hero` 25 · `sidebar-align` 6/6 · `sidebar-surface` 13/13 · live `live-gui-probe`
  face B 14/14, face A 10/10 · `settings-page-verify` 29/29 · `theme-flash-probe` 9 windows, 0 intermediate frames (click → colour median 23ms).

## 0.5.10 - 2026-09-28

A third Codex capture let the composer's ring be pinned down without depending on the device pixel ratio — and it
showed 0.5.8's 12% was a little heavy. The same capture confirmed 0.5.8's white card independently.

### ⑱ Composer ring: 12% → 10%

- **The ring has two mutually exclusive code paths**, and 0.5.7/0.5.8 had only looked at the first:

  ```css
  /* A — default / large / single-line */
  box-shadow: var(--composer-layout-surface-shadow);  border: 0 !important;
  /* B — [data-composer-radius-variant=compact], and B wins */
  box-shadow: none;  border: 1px solid var(--color-border) !important;
  ```

  `--color-border` = `--alpha-10` light / `--alpha-12` dark, i.e. **10%**, not the 3.9% of path A's
  `#0000000a` ring and not 0.5.8's 12%.
- **Two independent methods agree on ~10.4%:**
  - *Same-image comparison (DPR-independent).* In the new capture the Codex composer's ring pixel is **26 levels**
    below the page (`#e4e4e5` vs `#fefefe`). In the 0.5.7 capture, where the ring was 4%, the skin's ring pixel was
    **16 levels** below (`#efefef` vs `#ffffff`). Splitting the 16 into the near-field shadow's ~6 levels plus the
    ring's ~9.7, a target of 26 needs α ≈ 10.4%.
  - *Calibration render (DPR 1.25).* 4% → Δ14, 12% → Δ29; interpolating to Δ26 gives α ≈ 10.4%.
- Rendered edge after the change: **224**, against Codex's observed 220–234 (two captures, mean ≈226). At 12% it
  rendered 220 — inside the band but at its dark edge.
- **Also confirmed by this capture, no change needed:** the composer interior is `#fffeff` (93.0% of pixels) — the
  third independent sample of 0.5.8's white card; and the page surface's top stroke `#d6dae0` with a falloff of
  1px→231 / 8px→234 / 24px→237 / 30px→240 reproduces the previous capture point for point.
- **Right panel: left as is, now with evidence.** Codex's divider measures **1px `#ededed` (237)** with pure white on
  both sides and no shadow — which reproduces the "single pixel 237" the skin's comment recorded from an earlier
  reference. The skin implements `0 0 0 0.5px var(--dsw-alias-border-l1)` (7%); scaling from the measured 4%→16
  levels, 7% lands at 235–237, so it matches within 2 levels. Unchanged.
- **New detail, not previously recorded:** between the middle column and the right panel there is also a **13px-wide
  `#ededed` band** (x 781–793) — a scrollbar track, not a divider. It lines up with the 12px scrollbar slot the
  sidebar-surface layer already accounts for.
- **Still unverified:** this capture does **not** contain a popup with a surface of its own — the list on the right
  (文件 / 侧边聊天 / 浏览器 / 终端) is drawn straight onto white with no border and no shadow. So 0.5.9's
  `--dsw-elevation-prominent` **remains without screenshot evidence**.
- Suite: `check-repo` PASS · `audit` ALL PASS (36/36) · `hero-verify` 25 · `model-picker` 20 · `rightbar` 42 ·
  `composer-shadow-verify` 23/23 · `elevation-verify` 19/19 · `sidebar-align` 6/6 · `sidebar-surface` 13/13.

## 0.5.9 - 2026-09-28

Auditing every shadow in the skin against both Codex's source and Codex's screenshots turned up exactly one token
that could be aligned without new evidence. The visible change is small; this is a fidelity fix, not a defect fix.

### ⑲ `--dsw-elevation-*` cross-checked against source

- The audit covered all 12 shadow-bearing sites in the skin, each checked against both the asar tokens and the
  screenshots. Results are in the section below; only one item was actionable now.
- **`--dsw-elevation-prominent` was invented, and it is not a corner case.** The host consumes it in 14 places —
  `.QsffPG_menu`, `._7KE1Ra_menu`, `.JObwrW_panel`, `stat-dialog`, `PopupSelectView`, `MenuView` — i.e. the
  **menus and panels**. Codex has a token of the *same name*, read verbatim at asar offset 67930856:

  ```css
  --elevation-prominent: var(--elevation-stroke), 0 3px 7.5px #0000000a, 0 0 20px #0000000d;
  ```

  The skin had a single invented layer, `0 4px 16px rgba(13,13,13,.08)`. Now aligned verbatim.
- **Dark is no longer overridden.** Codex declares `--elevation-prominent` once in `:root` with **no dark variant**,
  so dark uses the same literal. The skin's dark override (`0 4px 16px rgba(0,0,0,.5)`, 50% black, zero evidence)
  is removed. Consequence: dark menus now carry a hairline + fill instead of a heavy outer shadow — consistent with
  Codex's dark behaviour proven in 0.5.7 (composer has no outer shadow) and 0.5.8 (dark elevates by fill).
- **Deliberately NOT changed** — three tokens that look like candidates but are already correct:
  - `--dsw-elevation-stroke` (8% light / 9% dark). Codex's *same-named* `--elevation-stroke` is
    `--color-border-strong` = 15%/20%, which would have been a tempting "fix". But the measurement says otherwise:
    `codex-theme-dark.png`'s panel separators are `#2f2f2f` on `#1c1c1c` = **8.4% white**, which matches the skin's
    9% and Codex's `--shadow-hairline` (8% light / 10% dark) — **not** the 20% `--color-border-strong`. Changing it
    would have been a guess swap across 32 consumers.
  - `--dsw-elevation-panel` still equals `--dsw-elevation-stroke` (the skin's layering choice).
  - `--dsw-elevation-soft` has **no Codex counterpart** at all and is documented as skin-invented, pending evidence.
- **New fixture** `scripts/elevation-verify.mjs` (19 assertions) locks all four tokens in both themes: geometry and
  alpha per layer against Codex's literal, layer 1 tracking the stroke, layers 2–3 **identical across themes**
  (Codex has no dark variant), and a rendered menu panel actually consuming the token. It asserts against
  **computed** values — custom-property literals omit the `0` spread and spell colours as hex, so literal
  assertions fail on notation rather than value.
- Suite: `check-repo` PASS · `audit` ALL PASS (36/36) · `hero-verify` 25 · `model-picker` 20 · `rightbar` 42 ·
  `composer-shadow-verify` 23/23 · `elevation-verify` 19/19 · `sidebar-align` 6/6 · `sidebar-surface` 13/13.
- **Honest scope:** the rendered delta is small — light falloff 13px → 14px, peak 28 → 29; dark extent 19.5px → 14px.
  This buys source fidelity and removes an unevidenced 50% black dark shadow; it does not fix anything you can see.

## 0.5.8 - 2026-09-28

The light composer card was 11 levels too dark. Codex's two themes express elevation in **opposite** ways, and this
skin had been applying the dark model to both.

### ⑱ Composer surface — light and dark are opposite mechanisms

- **Dark = fill.** The card is one step lighter than the page: 5% white over surface #181818 = 35.55 (Codex's own
  dark crops `layer-codex.png` / `codex-card-ref.png` measure card #232323 = 35 against page #111111 = 17, a step
  of 18). Dark also has **no drop shadow** — see 0.5.7's `inset 0 0 1px 0 #fff3`.
- **Light = shadow.** The card is **the same colour as the page** (#ffffff); it stands up on its ring plus the
  three-layer shadow, not on fill. Three independent measurements agree:
  - `codex-composer-reference.png` — card interior mode `#fffeff` 34.3% + `#ffffff` 14.9% + `#fefdfe` 13.2% = **62%**;
  - the user's 2026-09-28 side-by-side screenshot — card interior mode `#fffeff` 73.8% + `#fefdfe` 23.0% = **96.8%**;
  - `codex-app-reference.png` (whole window) — `#ffffff` 76.5%.
- The skin was rendering `#f4f4f4` (5% ink over white), i.e. **11 levels darker than Codex**. The cause is a layer
  mix-up: the `--card: color-mix(in oklab, var(--foreground) 5%, transparent)` token that 0.5.4 copied belongs to the
  **widget/artifact contract** (read out of `codex.exe`), not to the app shell's composer. The wash now applies to
  dark only; light takes the surface colour directly.
- **0.5.7 got the ring wrong.** It replaced the 12% ring with the source token's `#0000000a` (3.9%). But
  `--elevation-composer`'s first layer is not the whole edge: the composer has **no border rule at all** (the asar
  only ever sets `border-radius` on it), and the rendered edge is consistently darker than 3.9% can produce. Both
  Codex captures agree — `codex-composer-reference.png` card edge **220–234**, the user's screenshot **220–234**.
  Calibration render at the user's own DPR (1.25), same three shadow layers, only the ring varied:

  | ring | rendered edge | vs Codex 220–234 |
  |---|---|---|
  | 4% `#0000000a` (0.5.7) | **241** | 7–21 too light |
  | 8% `#00000014` | 233 | borderline |
  | **12% `--dsw-alias-border-l2`** | **226** | **in band** |
  | 15% `--dsw-alias-alpha-15` | 221 | in band |

  The ring is back to 12%. The fixture now asserts the *rendered edge* lands in 210–234, so this cannot regress
  silently again. (The old `1px above the edge ≤ 22` assertion was removed: it was calibrated at DSF=1 against a 4%
  ring, which means it was measuring the ring pixel, while Codex's "15" is the pixel *outside* the ring — it compared
  two different things.)
- Same screenshot, same method, both sides:

  | | Codex | skin 0.5.7 | skin 0.5.8 |
  |---|---|---|---|
  | page | `#ffffff` (92.3%) | `#ffffff` | `#ffffff` |
  | sidebar | `#f0f3f9` (96.4%) | `#eef4f9` | `#eef4f9` (unchanged) |
  | **composer card** | **`#ffffff`** | `#f4f4f4` | **`#ffffff`** |

- `scripts/composer-shadow-verify.mjs` extended to 23 assertions: the light card must be `#ffffff`, the dark card must
  be ≈35.55, and the two must differ (the two mechanisms are opposite by construction). It also now normalises colour
  notation — `color-mix` computes to `color(srgb …)`, not `rgb(…)`, and an assertion written against the latter
  fails on notation rather than on value.
- Full suite: `check-repo` PASS · `audit-codex-ink` ALL PASS (36/36) · `hero-verify` 25 · `model-picker` 20 ·
  `rightbar` 42 · `sidebar-align` 6/6 · `sidebar-surface` 13/13 · `composer-shadow-verify` 23/23.
- Also corrected 0.5.7's claim that `26.727.4816.0` has no asar — it does.

## 0.5.7 - 2026-09-28

The composer shadow was reconstructed from a screenshot. It is a named token in Codex's own source, and reading it
changes three things at once: the ring was 3× too heavy, the far layer was missing, and dark mode has no drop shadow
at all.

### ⑱ Composer shadow — read from source, not fitted to a picture

- **New evidence surface.** Both Codex builds on this machine are Electron and both carry `resources/app.asar`:
  `26.727.4816.0` (211.6 MB) and `26.924.2738.0` (460.3 MB). The newer one's app shell stylesheet is
  `webview/assets/app-shared-fa3f1d5d5942.css` (1,154,547 B). *Correction (0.5.8): this entry originally claimed
  `26.727.4816.0` was native with no asar. It is not — that build has an asar too; what it lacks is the redesigned
  composer (`--elevation-composer` / `ComposerLayoutRoot` appear in neither its CSS nor its JS).*
- The composer shadow is a **named token**, read verbatim at asar offset 67930943:

  ```css
  --elevation-composer:      0 0 0 1px #0000000a, 0 2px 8px 0 #0000000a, 0 4px 80px 8px #00000006;
  --elevation-composer-dark: inset 0 0 1px 0 #fff3
  @media (width<40rem) { --elevation-composer: … 0 4px 40px 8px #00000006 }
  ```
  It is consumed at exactly one mount point, which also carries `border: 0 !important` — **Codex never uses a border
  for the card edge; the 0-blur ring is the edge.**
- Three corrections to this skin:
  1. **Ring 3.1× too heavy** — `rgba(13,13,13,.12)` → `#0000000a` (3.9%).
  2. **Far layer missing** — the 80px bloom at 2.4% was dropped in an earlier pass after being misread as
     "over-stated". Codex does have it; what it does *not* have is the wide layer without a tight one in front.
  3. **Dark mode is a different mechanism** — Codex has **no drop shadow in dark**; it lights the top edge from
     inside with `inset 0 0 1px 0 #fff3`. This skin drew a `0 0 0 .5px` ring *outside* the card instead.
- Measured on a real render (deviceScaleFactor 2, same harness as the reference): **1px above the edge 14.0, falloff
  radius 42px** against Codex's 15.0 / 42px (was 32.0 / 9px). Dark: **0.0** deviation outside the card, and the inside
  top edge reads **47** against a card body of **36** (was 36 / 36 — flat).
- **New fixture** `scripts/composer-shadow-verify.mjs` (19 checks) covers all three paths, because the dark branch
  had no coverage at all before. It asserts computed geometry+alpha per layer, plus rendered pixels, plus the
  narrow-viewport 80→40px branch. It carries a precondition self-check that the narrow stage really left dark mode —
  without it the dark rule's higher specificity would silently satisfy the narrow assertion.
- `check-repo` PASS · `audit-codex-ink` ALL PASS (36/36) · `hero-verify` 25 · `model-picker` 20 · `rightbar` 42 ·
  `sidebar-align` 6/6 · `sidebar-surface` 13/13 · `composer-shadow-verify` 19/19.

## 0.5.6 - 2026-09-28

The dark window background was one step too light — that is what flattened the composer card against it.

### ⑭ Dark window background vs surface

- `--dsw-alias-bg-base` **#181818 → #111111** (and the matching `html`/`body` canvas literals).
  `--dsw-alias-bg-sidebar` stays #181818.
- Evidence: `assets/reference/codex-theme-dark.png` is Codex's own theme picker and states the dark theme's
  **背景 = #111111** / 前景 = #FCFCFC / 强调色 = #0169CC. The rendered measurements agree: in every Codex crop
  the area around the composer is **17** (= #111111) and the card is **35**. This skin was rendering 24 / 36.
- The two values are not in conflict — they are two layers. 0.1.2 used #111111; 0.5.x switched to #181818
  after reading app.asar's `jdi.dark.surface`, which is Codex's **surface**, not its window background.
  Collapsing them cost the composer card its step: **Δ12 instead of Codex's Δ18**.
- The card keeps its own value: a new role token `--dsw-composer-surface` (#ffffff light / #181818 dark) is
  what the 5% wash composites onto, so the card stays 5% foreground over the *surface*, not over the window.
  Rendered after the change: **page 17, card 36** against Codex's 17 / 35.
- `scripts/hero-verify.mjs` ALL PASS (25); `audit-codex-ink.mjs` ALL PASS (contrast re-checked on the new base).

## 0.5.5 - 2026-09-28

0.5.4 made the composer card see-through; the wash is now pre-composited onto the base colour.

### ⑭ Composer card surface

- `--dcu-composer-bg: color-mix(in oklab, var(--dsw-alias-label-primary) 5%, transparent)` →
  **`color-mix(in srgb, var(--dsw-alias-label-primary) 5%, var(--dsw-alias-bg-base))`**.
- Two separate bugs in one line. (1) Codex's `--card` is a 5% wash over an **opaque canvas** — its composer
  sits in a solid footer — while this skin's composer floats over the conversation scroll, so a
  `transparent` component lets the file list behind it show through. Reproduced on the user's screen.
  (2) Mixing in `oklab` compresses the top end: 5% white into #181818 lands on 34, where sRGB alpha
  compositing (what Codex's browser actually does) lands on 35.6. Rendered dark card: **36**, page 24.
- Light: 5% ink into #ffffff = 243.55, matching the 240~246 measured on
  `assets/reference/codex-composer-reference.png`.
- `scripts/hero-verify.mjs` gains `输入卡底不透明（不透视身后会话内容）` — the computed background must
  carry no alpha. All 25 pass.

## 0.5.4 - 2026-09-28

Research into Codex's border/shadow stack, and the composer card is rebuilt on it.

### What Codex actually does (evidence in `docs` of this entry)

- Codex ships a native `codex.exe` (Tauri/wry) with the widget stylesheet embedded as plain text; the app
  chrome is not. The token layer that *is* readable there is the agent-facing widget contract:
  `--shadow-sm: 0 1px 2px -1px rgb(0 0 0 / 8%)` — **the only shadow token** — plus
  `--card: color-mix(in oklab, var(--foreground) 5%, transparent)`,
  `--border: light-dark(rgb(26 28 31 / 8%), rgb(255 255 255 / 8.2%))`,
  `--radius: 12.5px` with ratio multipliers, and `corner-shape: superellipse(1.5)` on every rounded box.
- Surfaces are **translucent washes**, not opaque fills: `--card` is 5% of the foreground over whatever is
  behind it. Measured: 5% white over #181818 = 35, and the user's Codex screenshot measures exactly 35.
  Light: 5% ink over white = 243, and `assets/reference/codex-composer-reference.png` measures 240~246.
- Popovers/menus: `border: 1px solid var(--border); box-shadow: none`. Focus: `inset 0 0 0 1px var(--ring)`.
- The composer card's shadow, measured off the light reference: ~20-25px falloff, peak 2~5% ink
  (left Δ6~10, bottom Δ13, right Δ2) plus a 1px ≈12% ink border. **Dark has no outer shadow at all** —
  the page stays at 17 right up to the card's edge, then one rim pixel at 41.

### ⑭ Composer card surface and shadow

- `--dcu-composer-bg` is now `color-mix(in oklab, var(--dsw-alias-label-primary) 5%, transparent)` —
  Codex's `--card` formula, one declaration covering both themes — instead of the opaque
  `--dsw-specific-input-major` / `--dsw-alias-bg-layer-1`.
- Light shadow `0 0 0 1px #0000000a, 0 2px 8px #0000000a, 0 4px 80px 8px #00000006` →
  `0 0 0 1px var(--dsw-alias-border-l2), 0 8px 24px rgba(13,13,13,.05)`. The 80px layer was ~3x wider
  than the measured falloff — a halo, not an edge.
- Dark shadow stays the 0.5px `--dsw-elevation-stroke` hairline (Codex has none there).
- Not changed yet, listed as follow-ups: menus/popovers still carry `0 8px 28px` where Codex uses
  `box-shadow: none` + a border; focus rings are still an outer `outline` rather than an inset ring.
- `scripts/hero-verify.mjs` still ALL PASS (24).

## 0.5.3 - 2026-09-28

0.5.2's height change overshot; reverted against a same-scale DSH/Codex card-height comparison.

### ⑭ Composer card height

- Editor `min-height` 64px → **44px** and footer `padding-bottom` 12px → **8px** (both back to the host's
  values). Card `padding-top` 12px is kept.
- Evidence: the user supplied DSH and Codex composer cards side by side. The two crops are at one scale —
  their card corner curves are numerically identical (equivalent-circle R 29.6 vs 29.5, DPR 1.25), which
  also confirms the 0.5.1 radius work on a real screen. Card heights: **DSH 182 vs Codex 149** device px,
  i.e. 0.5.2 was 35 device px (≈28 CSS px) too tall; before it, DSH was 147 against Codex's 149 — already
  aligned.
- What was actually off is the **top inset**: card top → placeholder ink is 22.4 device px on DSH against
  29.25 on Codex. Hence `padding-top` 8 → 12 and nothing else. New total ≈ 152 vs 149 (+2%).
- 0.5.2 derived its numbers from the *declared* stack (12 + 64 + 4 + 28 + 12) instead of measuring the
  rendered card — the host DOM contributes height the stack does not model, so the stack was not a valid
  ruler. The lesson is in the changelog rather than in the CSS.
- `scripts/hero-verify.mjs` assertions now pin editor `min-height` 44, card `padding-top` 12 and footer
  `padding-bottom` 8. All 24 pass.

### ⑭ Composer card surface (kept from 0.5.2)

- Dark fill `--dsw-alias-bg-layer-1` (#212121) and the `--dsw-elevation-stroke` hairline stand: the
  comparison measures DSH's fill at 33 against Codex's 35 on the same scale.

## 0.5.2 - 2026-09-28

The composer card itself: surface and vertical rhythm, measured against a Codex composer crop.

### ⑭ Composer card surface

- Dark fill `--dsw-alias-bg-layer-2` (#282828) → **`--dsw-alias-bg-layer-1` (#212121)**. The Codex crop is a
  flat #222222; #212121 is the nearest step on this skin's own dark ladder (base #181818 → layer-1 #212121).
- Dark edge: `inset 0 0 1px #fff3` (a 20%-white **blurred** inner glow) → **`var(--dsw-elevation-stroke)`**
  (a crisp `0 0 0 0.5px rgba(255,255,255,.09)` hairline). Codex's edge measures +6~7 over its fill on a
  single pixel row along the top, right and bottom — a hard 1px rim, not a glow. "Stroke is hierarchy" is
  already this skin's rule everywhere else; the composer was the one surface still using a blur.
- Light theme untouched (no light reference for Codex's composer).

### ⑭ Composer card height

- Editor `min-height` 44px → **64px**, card `padding-top` 8px → **12px**, footer `padding-bottom`
  8px → **12px**.
- Evidence: normalising both sides by the composer font size (the Codex crop's CJK advance is 19.25 device
  px, this skin's is ~18), the Codex card's editor region (card top → control row) is ≈79 CSS px and its
  bottom inset ≈12, against this skin's 56 and 8. The three changes bring the stack to 12 + 64 + 4 + 28 +
  12 = 120 against Codex's ≈125.
- Control sizes were left alone (this skin's 28px control band); Codex's row measures ≈33px, so the card
  is still ~4% shorter than Codex's. `scripts/hero-verify.mjs` gains three assertions pinning editor
  `min-height` 64, card `padding-top` 12 and footer `padding-bottom` 12. All 24 pass.

## 0.5.1 - 2026-09-28

The top strip's corner was still wrong. 0.5.0 derived it as "card − 4" from an eyeballed arc span on a
reference image; a same-scale DSH-vs-Codex side-by-side falsifies that reading.

### ⑬/⑭ Composer top strip

- The strip no longer has a radius of its own. `--dsw-radius-bar` is gone; both the strip
  (`[data-codex-filebar]`, `[data-phase=hero] [class*="_heroWorkspaceRow"]`) and the card
  (`[data-composer-card]`) read `--dsw-radius-card`, so strip / card is 1 by construction.
- Evidence: the user supplied a DSH/Codex side-by-side rendered at one scale. Measuring all four corner
  arcs — the arc-curve method, calibrated against synthetic ground truth (±0.4 px), cross-checked with a
  corner-deficit area integral — gives Codex strip/card = **1.03** (29 / 28) but this skin **0.79**
  (16 / 20). The strip was ~5 px tighter than the card, which is exactly the mismatch visible where the
  two surfaces overlap.
- Why "card − 4" was wrong: it came from reading arc spans (22 vs 26) off a different reference image by
  eye. The calibrated method recovers a rendered radius to within 1 px — on a real render of this
  `theme.css` it reports 15.4 / 19.2 / 24.3 for declared 16 / 20 / 25 — so the arc-span reading was the
  weak link, not these numbers.
- The fix is deliberately agnostic about the card's own value: the strip equals the card whether the card
  is the host's 28px, the skin's 20px, or the skin's 25px + `corner-shape`, so it holds in every
  `@supports` branch.
- No alias token: `--dsw-radius-bar: var(--dsw-radius-card)` would resolve `var()` where it is declared
  (`body`), so a later override of `--dsw-radius-card` on a mid-level element would move the card but not
  the strip. Reading the card token directly removes that trap.
- `scripts/hero-verify.mjs`: the two strip assertions become "strip = card (literal)",
  "strip = card (ratio = 1)" and "strip reads `--dsw-radius-card`". All 21 pass.

## 0.5.0 - 2026-09-28

Concentric corners: "inner radius = outer radius − inset" is now a skin rule, and four mismatches are fixed against it.

### Corner rule (new)

- The token layer (`skins/codex-ink/skin.css`) gains `--dsw-radius-menu: 18px` (floating menus) and
  `--dsw-radius-bar` (the composer's top strip), and the concentric formula is written into the scale
  block: a nested radius is always "outer radius − inset".
- The justification is the host's own behaviour, not taste: the MenuSurface panel is 16px
  (`--dsw-radius-lg`) plus a 4px list inset = 12px rows (`--dsw-radius-md`). The skin had hard-coded
  the rows to 8px, which is what broke the concentric pair.

### ⑫ Model menu

- Menu panel 16px → **18px**. The old value folded the reference repo's measured 18px down to
  `--dsw-radius-l`; stacked against the composer card's 20/25px the two arcs were plainly different.
- Rows / cells 8px → **13px** (= 18 − 5px inset), concentric with the panel.
- `scripts/model-picker-verify.mjs` gains two closed-loop assertions: the native reference
  (host menu 16 / row 12) and "row radius = menu radius − inset". All 20 pass.

### ⑰ Composer chips

- Model / permission controls 8px (host `--dsw-radius-sm`) → **fully rounded pill**; the add button
  declares the pill explicitly too.
- Evidence: a per-pixel re-measurement of `assets/reference/codex-composer-chip-hover.png` — the capsule
  is 42px tall with its leftmost point at x=13, and the top row's boundary sits at x=29 (16px in from that
  point), exactly the 16.4 predicted by R = h/2 = 21; a 12px radius would predict 8.6. The old code copied
  Codex's fill but not its radius.
- Concentric arithmetic: 20/25 − 8px inset = 12~17, all above half the control height (28px → 14), so the
  rule demands a pill anyway.
- `scripts/hero-verify.mjs` moves the host baseline from 24px to the source value 8px (host rc.2's
  `.u91W7W_trigger` / `._5Tq8wa_trigger` both use `--dsw-radius-sm`) and adds a same-class-name control
  outside the card. All 18 pass.

### ⑬/⑭ Composer top strip (filebar / hero workspace row)

- Top corners 16px → **21px = card − 4** (`--dsw-radius-bar`, which follows the card's corner-shape
  branch: card 25 ⇒ strip 21, and card 20 without corner-shape ⇒ strip 16).
- Evidence: a per-pixel re-measurement of `assets/reference/codex-composer-reference.png` using the
  stroke track (not a threshold) — the strip's top-left arc spans y 24→46 = **22px** while the card's
  spans y 82→108 = **26px**, i.e. "strip = card − 4". The old 16px was 4~9px off the card's 20/25 and
  the two arcs were plainly different where the surfaces overlap.
- Applied to both `[data-codex-filebar]` (⑬·2) and `[data-phase=hero] [class*="_heroWorkspaceRow"]` (⑭·1):
  they are the same family of "strip peeking out from behind the card".
- `scripts/hero-verify.mjs` gains two assertions: `top strip radius 21` and
  `top strip follows the card: strip = card − 4` (both read computed values, so moving one without the
  other fails). All 20 pass.
- Known gap, recorded as-is: nothing installed on this machine produces the `[data-codex-filebar]`
  marker (a full scan finds it only in codex-ui's own CSS), so the ⑬·2 rule is currently inert; the
  hero workspace row (the host's `D_tfqW_heroWorkspaceRow`) is the strip actually visible today.

### ⑭ Composer card and trigger menu

- Removed the second source of truth in `patches.css`
  (`[data-composer-card] { border-radius: var(--dsw-radius-l) }`, 16px): it competed with
  `composer.css`'s 20px / 25px superellipse for the same element, decided only by selector weight.
- `[data-trigger-menu]` (the @ / command suggestion menu) 12px → 18px, option rows 8px → 13px, same
  family and same formula as the model menu.

### Verification

- `node scripts/check-repo.mjs` → PASS (19 checks)
- `node scripts/model-picker-verify.mjs` → ALL PASS (20)
- `node scripts/hero-verify.mjs` → ALL PASS (18)

## 0.4.0 - 2026-09-27

The sidebar **surface**: the scroll fade moves from the host's 24px overlay to Codex's 40px four-stop mask ramp.

### Sidebar surface (⑱)

- The host already has its own take: a 24px absolutely positioned overlay next to the scroller, painted with
  `linear-gradient(transparent → var(--dsw-specific-sidebar-fill))`. Codex uses `_headerFadeMask_n9nga_1`'s
  `--sidebar-scroll-mask-image` — an alpha mask over the content itself.
- **This change is not about looks**, and the fixture says so plainly: four states side by side with the mask alpha
  curve recovered pixel by pixel. Under an opaque sidebar fill the native A and codex-ui B curves differ by
  **≤0.122** in the first 24px and by **8.0/255** at the bottom edge — effectively equivalent. The real gap is under a
  translucent sidebar fill (the card's `translucentSidebar`): bottom-edge luminance **176.4 native vs 240.3
  codex-ui**, because the overlay cannot hide content through a 72%-alpha fill, while the mask is immune
  (B ↔ Bt differ by 3.5).
- Both DSH-specific deviations carry their evidence: ① the ramp's `footer-edge` is 100%, because the scroller's
  bottom edge *is* the top edge of the fixed footer here (live GUI: `listRect.bottom = regionRect.bottom =
  footRect.y = 844`), unlike Codex where the footer sits on top of the scrolling content; ② no 8px top fade, since
  DSH's group header is not inside the scroller and nothing overlays the top of the scroll viewport.
- Two mask layers: the first paints the ramp over `100% − 12px` horizontally, the second restores the remaining
  12px to opaque. With `mask-repeat: no-repeat` the unpainted region masks to 0 (hidden), so without the second
  layer the host's scrollbar gutter would be erased.
- Anchors: the scope root uses the semantic `div:has(> [data-slot="sidebar.workspaces"])` (a unique hit on
  regionArea). The scroller and the overlay have no semantic anchor — none of them appear in the live
  `[data-slot]` set — so this layer adds two **suffix** anchors, `[class$="_list"]` and `[class$="_fade"]`;
  the build's hash-anchor count therefore grows by 2.
- `scripts/sidebar-surface-verify.mjs`: 13 assertions, including "no mask natively", "host overlay stepped aside",
  "the four Codex alpha stops are present" and "the second layer is 12px wide", plus two pixel-level checks.

## 0.3.0 - 2026-09-27

Both header slots are **released**: the entries registered in them render again. Before this, a dispatched subagent
left no visible trace that it was running.

### Top bar (⑬·3c)

- 0.2.x hid the contents of `conversation.session.header.actions` and `…utilities` with a blanket
  `display: none`, to match the reference screenshot's "session name plus the top-right button" only. The cost was
  not obvious at the time: the official subagent package registers its **descendant-count trigger** (total and running
  counts) in `actions` (id `subagent-catalog`, order -30), and the same slot also carries the job roster, the preset
  badge and "open in app" — all of them were hidden with it.
- Only those two rules were removed; nothing else changed, and the view tabs stay hidden (the reference has no tabs).
- The entries are **conditionally rendered** by their own packages (no subagents / no jobs / no preset / no working
  directory means they return null), so the top bar looks exactly as before in the common case. Real-GUI A/B: with the
  old rule re-injected into an empty session, the header geometry (header 1138×41, corner button 28×28, tabs display)
  is **field-for-field identical**.
- No second palette was introduced: the entries take their colours from `--dsw-*` semantic tokens, which this skin has
  already re-anchored, so they follow the current skin. Modelled in the fixture with the official class names, the
  measured badge colour is `rgb(118, 118, 118)` = the skin's `--dsw-alias-label-tertiary`;
  `--dsw-alias-fill-tsp-secondary` is undefined, so the badge keeps no fill; and the official 22px height, 6px radius
  and 12px font are asserted as "not rewritten by the skin".
- `scripts/hero-verify.mjs` grew from 8 to **17 assertions**: title still there, preset badge visible, utility entry
  visible, tabs still hidden, corner button still there, badge colour / radius / height, badge has no fill.

## 0.2.0 - 2026-09-27

A settings page inside the plugin manager, plus the dark base re-anchored on the Codex app's own defaults.

### Settings page (slot `plugins.bundle.config`)

- A config card on the plugin manager's bundle page: theme / accent / background / foreground / UI font / code font /
  translucent sidebar / contrast. The seat key is the **package name** `codex-ui`; the form namespace is the
  **profile entry id** `codex-ui`. They are not the same string.
- The host half exports `Config`: 11 fields, each `.default(x).volatile()`. The settings service projects volatile
  fields only and exposes a form only for entries that have them — no `Config`, no card.
- The override layer is a pure function (`src/override.js`): at the defaults it emits an empty string and never sets
  `data-codex-ui-theme`, so an untouched install looks byte-for-byte like 0.1.2. When something is overridden it writes
  one runtime `<style>` whose selector carries one extra attribute (specificity +1); `skins/*.css` is never touched.
- Instant write, no save button; text inputs commit on Enter or blur and every write is read back; overridden rows show
  a badge and a Reset control.
- Contrast is normalised to the Codex defaults (45 light / 60 dark means unchanged): text tiers mix towards ink and the
  neutral alpha ladder is scaled (clamped to 0.5×–2×). **This is a simplification** — the app's `Rdi + zdi·contrast`
  blend is not reproduced, and the README says so.
- The translucent sidebar has no window layer to reveal on the web and shares the surface colour in dark, so the switch
  also turns the sidebar row fills translucent. Recorded as a gap, not as an equivalent.
- New `skins/codex-ink/settings.css` (tokens only, zero colors) and `scripts/settings-page-verify.mjs`
  (13 assertions against a real GUI).

- The theme row now drives the host theme service (`ctx.theme`, provided by
  @deepseek-ai/dsh-client-ui-theme): three segments light/dark/system, writing `ui-theme`'s `preference` — the same
  setting as Settings → General → Appearance, so the whole app switches and it survives a reload, and the three colour
  rows follow the variant in effect. `inject` gained the service name `theme`.
- New `scripts/make-verify-profile.mjs`: builds a throwaway verification profile (plugin manager enabled, only this
  plugin) so `settings-page-verify` is reproducible on any machine. Live-GUI assertions went from 13 to 20 (theme
  switch, dark taking effect, preference surviving a reload, clean-up at the end) and the script is now idempotent:
  it clears overrides and the theme left by a previous run first.
- Two real bugs fixed, both caught by live-GUI assertions: `jsxs(type, props, children)` takes a **key** as its third
  argument (the card rendered an empty div); and handing a freshly-allocated object to `useSyncExternalStore` — React
  throws #185 (maximum update depth) and the host only leaves `slot entry crashed in 'plugins.bundle.config'`, so the
  whole seat entry never renders.

- Flash hardening: the skin now paints the canvas itself (`html` and `body` carry this skin's base colour in both
  themes; `html` follows via `:has()` on the body marker) and transitions are suppressed for two frames after
  `theme/change` (`html[data-codex-ui-switching]`). Measured: the dark canvas went from the host's `rgb(16,22,36)`
  to this skin's `#181818`.
- New `scripts/theme-flash-probe.mjs`: per-frame sampling of the effective backdrop during switches (first opaque
  ancestor background) — 9 windows, ~720 frames, currently 0 intermediate frames. This kind of flash does not
  reproduce in headless Chromium, so the probe stays as a regression detector.

- Fixed "the theme switch flashes twice (black → white → black)": the preference is now written document-first. The
  host's `theme.setTheme()` publishes optimistically and is then re-read from the settings document by `adopt()`, which
  on a slow round trip draws new → old → new; the card writes `preference` into the theme plugin's own settings document
  instead (the same write the service's internal `host.set` performs), leaving `adopt()` as the only publisher — one
  click, one publish. Live GUI: all 20 assertions pass (theme switch, survival across reload, clean-up at the end).
  **Note**: this flash does not reproduce in headless Chromium here; what was fixed is the only mechanism that can
  produce that sequence, not "it looks fine now".
- Override layer hardening: a transiently unavailable settings document (`status=loading` / just reconnected) no longer
  clears the overrides already in effect — that would make a user's own settings blink out.
- `scripts/theme-flash-probe.mjs` gained a "dark/light run" report (`L×12 → D×68`); more than two runs means a
  double-publish.

- The theme switch no longer waits for the round trip: the browser half gained a **local preview** (applies the
  target theme the moment you click — `body[data-ds-dark-theme]` plus the `color-scheme` on `html` — hands it back
  idempotently when `theme/change` arrives with the same result, and rolls back to the truth after 2.5s).
  Measured click → colour change: **824ms → 22ms** (median; 4 probe samples 22/18/18/31ms), run sequence still two runs
  with no double publish.
- `settings-page-verify` went from 20 to 22 assertions: "colour change within 300ms of the click" (the preview working)
  and "the preview marker is cleared once the document lands" (never stuck in preview).

### Dark base

- Background `#111111 → #181818`, foreground `#FCFCFC → #FFFFFF`, sidebar `#171717 → #181818` (same face as the
  surface), layers 1/2/3 `#1f1f1f / #2a2a2a / #353535 → #212121 / #282828 / #303030`, alpha family
  `rgba(252,252,252,·) → rgba(255,255,255,·)`. Values come from the `jdi` defaults inside the app
  `resources/app.asar` (`surface #181818` / `ink #ffffff`) and the generated ramp; the 0.1.x picker values are gone.
  The dark link stays on the app's text-link token `#0169CC`.
- The 36 WCAG pairs in the skin audit all pass again (ratios rise as the dark base lightens; the lowest is 4.35).

### Engineering

- `src/build.mjs` gained two placeholders: the override module (exports stripped at build time, wrapped in an IIFE) and
  the settings card. An unsupported `export` form throws instead of silently dropping a binding.
- `scripts/check-repo.mjs` went from 13 checks to 19: Config fields complete and all volatile, defaults emit no CSS,
  hex/font-stack validation, contrast identity and clamps, a 37-entry reconciliation against `skin.css`, and the
  presence of the settings page and override layer in the built artifacts.
- `scripts/install-plugin.mjs` gained `--bundle`: it writes the package name into `dsh.profile.bundles` and removes a
  redundant `- insert:` block (both paths at once produce a duplicate loader entry id). The web profile now registers
  through bundles.
- Fixed a real bug: in the settings card `jsxs(type, props, children)` takes a **key** as its third argument, so
  children must live in props — otherwise React renders an empty element. A repo check now guards against it.

## 0.1.2 - 2026-09-26

Aligned to the Codex desktop app's own tokens (app `26.727.4816.0`, `resources/app.asar` → `webview/assets/app-*.css`).

- Motion: `--dsw-motion-fast/base/slow` 100/160/240ms → 150/200/300ms; `--dsw-ease` → `cubic-bezier(.4, 0, .2, 1)`,
  from Codex `--transition-duration-basic`, `--transition-duration-relaxed` and `--default-transition-timing-function`.
- Focus ring: ink → Codex `--color-border-focus` (`#339cff`; dark `rgba(51,156,255,.7)`), in all four stylesheets.
- Pending spinner: 620ms → 1s linear, from Codex `--animate-spin`.
- Dark composer chip hover: derived 6% → 8%, from `--color-background-button-secondary-hover`.
- `hero-verify`: hover assertions wait for the transition to settle; added a focus-ring assertion (8 total).
- `README`: new "Codex source alignment" section listing token sources and the deliberate differences.

## 0.1.1 - 2026-09-26

Build, checks and CI. No change to what the plugin renders beyond the template header comment.

- Build: scoping and artifact generation moved to `src/build.mjs`; `scripts/install-plugin.mjs` and the new
  `scripts/build.mjs` both call it, so `theme.css` and `client.js` cannot drift from each other.
- Check: `scripts/check-repo.mjs` (`npm run check`) verifies syntax, JSON, the manifest, artifact-to-source
  equality, stylesheet hygiene, encoding, bilingual doc pairing and machine-specific paths. It needs no host.
- Host paths: `scripts/host-paths.mjs` resolves `app.asar`, the global `@deepseek-ai` modules and Chromium from
  `DSH_ASAR` / `DSH_GLOBAL_MODULES` / `DSH_CHROME`, a gitignored `scripts/host.local.json`, or a scan of the
  standard locations. The four fixture suites and the live probe no longer hardcode a machine path.
- Live probe: opens a new conversation before timing the pending window, asserts the measured shadows, both
dividers and the pending window (10 assertions), prints `SKIP` for a stage it cannot measure and exits non-zero
on failure.
- CI: `.github/workflows/ci.yml` runs both commands on Ubuntu and Windows, Node 22 and 24.
- npm scripts: `build`, `check`, `install:web`, `install:desktop`.

## 0.1.0 - 2026-09-26

Initial release.

- Window edges: the conversation window gets a 0.5px hairline plus a 24px ambient shadow; the right panel keeps a
  hairline on its left edge and bleeds its shadow upward only, using a negative spread.
- Dividers: the right handle shows a 2px center-darkest gradient on hover; the left divider stays a static hairline.
- Theme colors copied from the Codex color picker: light `#339CFF` / `#FFFFFF` / `#1A1C1F`, dark `#0169CC` / `#111111` / `#FCFCFC`.
  The dark ramp is re-anchored on `#111111`.
- ⑰: the add button carries no box until hover; the model and permission controls share the same hover chip `#F2F2F3`.
- ⑫: the model menu matches Codex; while a write is pending the trailing check becomes a spinner and the cursor turns to progress.
- ⑯: right panel guide entries flattened, including a targeted rule for the terminal plugin custom card.
- ⑬ ⑭: composer header turned blank; card geometry, shadow, tool row and hero layout.
- ②: sidebar colors and column alignment.
- Installers and verification: `install-plugin.mjs` (duplicate registration detection and cleanup), `install-skin.mjs`
  (SHA256 drift check), `audit-codex-ink.mjs`, four fixture suites, and the `live-gui-probe.mjs` live probe.
