# Changelog

[简体中文](CHANGELOG.zh-CN.md)

## Unreleased - 2026-10-01

A design-system audit pass across the composer, sidebar, right panel, appearance controls and the command
surface. At the end of it `npm run check` reports **86** checks and `npm run verify` **358** assertions
(down from 360 after an independent review: three self-certifying criteria that tested dead CSS were dropped
and one criterion targeting a real host anchor was added — the decrease is an honest decrease);
every figure quoted below, and every row of the README's fixture table, comes from a real run on this
machine rather than from a hand-maintained list.

### ⓪ Independent-review pass: 6 dead CSS rules, one hollow guard, 4 self-certifying criteria

An external review reported findings that were each reproduced against the host bundles on this machine before
any change was made.

**6 dead CSS rules** (selectors that can never match):

- `content.css` `[data-tone="warn"]` — the host `ToolDetails.badge` tone enum is
  `info/neutral/success/warning/error`; there is no `warn`, so warning badges never picked up the warning colour.
  Fixed to `warning`. The *token* name stays `--dsw-alias-state-warn-*` (7 host occurrences, 0 for `-warning-`):
  the attribute value and the token name must not be changed together.
- `[data-turn-process-chevron]` (×2) and `[data-turn-process-body]` (×2) — the host chat bundle only emits
  `-answer / -hidden / -inline / -member / -messages / -subagents / -tool-calls`. Removed.
- `[data-turn-process][data-expanded="false"]` — the host writes `expanded || void 0`, i.e. attribute-absence
  semantics (its own CSS uses `:not([data-expanded])`); `="false"` never appears. Removed.
- `patches.css` `[data-slot="web-ui.plugin.item"]` — 0 hits across all 1043 host js/css files. Removed.
- `model-picker.css` `[data-disabled="true"]` — no writer in `src/` or the host. Removed.

**Hollow guard**: `check.mjs` 9b computed a `proposals` variable that only ever reached the return string, never
an `assert` — so the "every exclusion needs a proposal doc" rule it advertises in a comment was not actually
enforced. It now asserts a non-zero proposal count, one-to-one correspondence between exclusions and
proposal files, and reverse-reports orphan proposals; the "has assertions" test now looks for real call sites on
non-comment lines. `verify.mjs` now prints the excluded specs at the end of its summary so the exclusion itself
leaves a trace. Two negative tests: deleting the proposal doc, and renaming the 4 `t.check(` calls — both
turn the guard red as intended.

**4 self-certifying criteria** (a criterion that passes because of its own bug is worse than a lax one):

- `content.mjs` hand-wrote `data-turn-process-chevron` / `-body` in its fixture — attributes the host never emits —
  which is exactly how the dead CSS above survived. Switched to the real `-hidden / -member / -messages`, and the
  `pre` probe moved to `[data-tool]` (the turn-summary region holds no `<pre>`; the host bundle has 0 `pre`
near `turn-process`). Three criteria that only held because of the dead CSS were dropped, and one checking that
collapsing is the host's `-hidden` responsibility was added.
- `sidebar-keyboard.mjs` c1 judged `tabIndex >= 0`, but both fixes the proposal endorses (container
  `tabindex=0` + `aria-activedescendant`, or roving tabindex) leave the row's own `tabIndex` at -1 — a criterion
  stricter than the defect. It now judges whether focus actually lands on the row after `focus()`.
- c2 measured immediately after a programmatic `focus()`, when the page has had no keyboard interaction and
  `:focus-visible` correctly does not match; it now measures after a real Tab sequence.
- c3 was `reachedRow || reachedActions`, which would go green when the host adds row focus but not
  `.rowActions { :focus-within }` — the menu still unreachable by keyboard while the criterion says pass. Split
  into c3a (reaches the row) and c3b (reaches the in-row button); both are required, matching the proposal.

### ⑭ The follow-up queue is pulled into the composer card's family

The queue docks against the composer card's **top edge**, and it was inheriting the host's menu material:
it consumes the same `--dsw-menu-backdrop-filter` token the menus do, but it does not sit under the
`[data-menu-material]` anchor that ⑱ neutralises — so a 40px backdrop blur survived there after every menu
had already lost it, and its top corners were a different radius from the card it is welded to.

- Measured on the dock panel (`getComputedStyle`), before → after: `backdrop-filter` `blur(40px) saturate(1.5)`
  → `none`; top corners `16px` → `--dsw-radius-card` (the card's own radius, so the two curves are concentric);
  bottom corners stay `0`.
- The fill moves to `--dsw-alias-bg-layer-1`: the queue belongs to the input area, not to the overlay-menu family.
- Looks in `skins/codex-ink/composer-queue.css`; assertions in `scripts/specs/queue-dock.mjs`.
- No host semantics are touched — `pendingRow` / `preview` / `editor` / `attachments` / `actions` are as shipped.
  The assertion was verified by turning the blur back on, which turns it red.

### ② Sidebar row states come from the host's own semantics

The host gives the **current** session and a **hovered** session the same background token, so "the session I
am in" and "the session the pointer happens to be over" looked identical — and the skin styled no row at all.

- Measured: current row `rgba(13, 13, 13, 0.08)` against hover `rgba(13, 13, 13, 0.04)`; the host leaves both at `0.04`.
- Anchors are the host's stable semantics — `data-row-key` (`session:` / `workspace:` / `empty` / `overflow:`)
  and `aria-selected` — never hashed CSS-module class names, which change every build.
- Looks in `skins/codex-ink/sidebar-rows.css`; assertions in `scripts/specs/sidebar-rows.mjs`.
- The last ancestor-position `:has()` went out of `sidebar-align.css`, matching the rule already enforced for
  `model-picker.css` (see the performance note below).

### ②d Right-panel scroll areas follow the skin's scrollbar rule

The right panel's scroll areas were still on the browser default while the menus had long since been brought
onto the skin's rule. They now use `::-webkit-scrollbar` with the same tokens as the menus (8px, thumb
`--dsw-alias-scrollbar-bg-l2`), plus `overscroll-behavior: contain` so scrolling the panel does not chain into
the middle column.

- Looks in `skins/codex-ink/panels.css`; assertions in `scripts/specs/panels.mjs`.
- The rest of T11 needed no work: the panel container, page header, empty state and unavailable state already
  resolve through the skin's `--dsw-*` tokens.
- The file contains **no descendant wildcards** — only named containers — and an assertion holds it that way,
  because the right panel hosts a file tree, a terminal and previews whose nodes are rebuilt while streaming.

### Appearance: the selected swatch and the font stepper use the skin's tokens

The host already implements these controls, and both were left to it. Its `FontSizeRow` store holds a
`fontSize` plus a monotonic `revision` that guards writes (`sync(d, fontSize, revision) { if (revision <= d.revision) return; … }`),
and `AppearanceRow` holds a three-way `preference` behind the same guard. **Nothing was reimplemented and no
new config field was added** — the skin only stops the two controls from displaying host-static values.

- The selected appearance swatch reads the skin's `--dsw-alias-label-primary`. Measured: skin `rgb(26, 28, 31)`
  where the host left it at `rgb(173, 178, 184)`.
- The font-size stepper's radius reads the skin's `--dsw-radius-s`. Measured: skin `8px` where the host left it at `12px`.
- Looks in `skins/codex-ink/appearance.css` (2 tokens, both declared in `skin.css`); assertions in
  `scripts/specs/appearance.mjs` (13), including that a size change reaches the skin's prose token (21px → 25px)
  and that the reset path puts it back.

### Recorded rather than fixed

- **The sidebar's row menu cannot be reached with a keyboard.** Session rows render as `div[role="treeitem"]`
  with no `tabindex` (the whole `dsh-client-ui-workspace` bundle contains exactly one `tabindex`, on the search
  input), and the row action button sits in an element that is `display:none` until `:hover`/`menuOpen` with no
  `:focus-within` rule. A `display:none` element is outside the tab order, so no pure-CSS rule can create a
  keyboard path. Filed as a host proposal in `docs/host-proposal-sidebar-keyboard.zh-CN.md`; its three assertions
  live in `scripts/specs/sidebar-keyboard.mjs`, excluded from the default run by the `OPT_IN` set in
  `scripts/verify.mjs`, so the main gate stays green while the gap stays on record.
- **The command palette is left to the host.** `dsh-client-ui-commands` emits exactly one `data-*` attribute
  (`data-plugin-css`); its slot outlet is shared with other components and its panel root (`data-menu-material`)
  is family-wide, so the only discriminator would be a `:not([data-trigger-menu])` test against a sibling —
  rejected. Ctrl+K is already bound by the host to `session.search`, and the palette renders no shortcut hints.
  Recorded in `docs/codex-ui-t12-verdict.zh-CN.md`.
- **Two radius scales are in use and are not bridged.** The skin declares `--dsw-radius-s` / `-m` / `-l`; host
  components consume `--dsw-radius-sm` / `-md` / `-lg`. Both resolve today (the host `ui-theme` layer supplies
  the second set), so nothing is broken — but a change to the host scale would desync skin-owned from
  host-owned corners. Left unbridged on purpose: it is a shared-token change. Recorded in
  `docs/codex-ui-t10-verdict.zh-CN.md`.
- **Everything in this section is fixture-verified, not verified on a live `dsh web`** — no live instance was
  started. The scrollbar work in `panels.css` cannot be measured here at all: `scripts/lib/cdp.mjs` launches
  Chromium with `--hide-scrollbars`, so `offsetWidth - clientWidth` is always 0 and the choice between the
  standard scrollbar properties and the `::-webkit-scrollbar` path is **not** settled by measurement — it
  follows the skin's existing implementation in `overlays.css` instead.
## 0.7.1 - 2026-09-29

### ⑬d An exit for the Trajectory view

⑬ hides the whole conversation view tab strip to match the reference screenshot, and DSH's native Trajectory
(`@deepseek-ai/dsh-client-ui-trajectory`) is one cell of that strip. The entrance was never removed — a tool card's
expanded Inspect goes through `openView('trajectory', callId)` — but the only way back was the strip, so **you could
get into Trajectory and not out**: on a live `dsh web`, once the view switched there were zero visible controls that
returned to Chat.

- **The strip is left alone** (it is the alignment surface for the reference screenshot). While the Trajectory view is
  showing, a "← Chat" pill floats at the lower-left of the view area. Clicking it **clicks that very tab** — the same
  `selectView` callback a real click uses, with no host internals and no guessing at host state.
- Structure in `src/client/trajectory-exit.js`, looks in `skins/codex-ink/trajectory-exit.css` (a new skin part).
- **Which tab is Chat is calibrated, then guessed at**: while the view area renders Chat, the tab with
  `aria-selected` is the one (independent of UI language and of tab registration order — the app starts on Chat, so one
  pass usually calibrates it); only if that fails does it fall back to the tab's own text `Chat` / `对话`. With neither,
  **no button is shown at all** — better absent than clicking the wrong cell.
- **If the strip ever becomes visible again this layer steps aside** (an `offsetParent` test), with no code change.
- The button copies its label from that tab, so the module keeps no word list.
- A mismatch with the host layout warns and skips; this layer degrades, it never throws.
- The geometry anchor is the **parent** of `[data-slot="conversation.view"]`: that slot container is
  `display: contents` and its own rect is always 0.

### Debugging note: one skin rule, two delivery channels

A trap worth recording. This machine has both the **plugin channel** (`style[data-plugin=codex-ui]` inlining
`codex-ui/theme.css`) and the **skin channel** (skin-center's
`<link href="/api/skin-center/v2/skins/codex-ink/patches">`) — and the same hiding rule ships in both. So "disable the
suspicious stylesheet" proves nothing: with the inline copy disabled the strip stayed invisible. Attribution has to ask
the browser itself: CDP `CSS.getMatchedStylesForNode` lists the matching rules and resolves `styleSheetId` back to the
sheet, and a self-injected `display:flex !important` confirms the hiding is CSS and nothing else.

## 0.7.0 - 2026-09-28

The architecture cleanup (originally PR #3) and the full-page settings work (originally PR #1) land together on top of
0.6.4. Nothing from 0.6.2–0.6.4 is dropped: the structure is the new one, and every assertion that used to live in the
old flat scripts was re-expressed in the new ones.

### Structure (the PR #3 refactor)

- **Client side is modular**: `src/client.template.js` is gone. `src/client/index.js` is the entry and pulls in
  `settings.js`, `settings-card.js`, `override.js`, `stylesheet.js`, `theme-preview.js`, `host.js`,
  `constants.js` and `model-picker/`. The bundler in `scripts/build.mjs` is zero-dependency and produces the same
  classic `window.__ModuleLoader__.load(...)` script. A new feature is one module plus one line in the entry.
- **Tooling collapsed into three entries**: `npm run check` (host-free), `npm run verify` (fixtures),
  `scripts/live/*` (real GUI). Shared code lives in `scripts/lib/`; fixtures are `scripts/specs/*.mjs`.
  The old `check-repo.mjs` / `*-verify.mjs` / `live-gui-probe.mjs` / `theme-flash-probe.mjs` are gone; their
  assertions were moved, not deleted.
- **No `:has()` in ancestor positions** and a narrower MutationObserver: style recalc while a reply streams in went
  4264 → 267 ms (web) and 9518 → 442 ms (desktop shell).
- **The dark `html` background never applied**: the scoper turned `:root:has(body[data-ds-dark-theme])` into a
  descendant selector that could not match. Compound selectors starting with `:root` now map to the root itself.

### Settings modal (the PR #1 work)

- **㉑ The settings dialog gets a full Codex pass**: a grouped sidebar with a "← Back to app" row and a search box that
  filters host items, group headers, a page header in the content area, white cards with hairlines on every sub-page and
  sticky save bars. Structure lives in `src/client/settings-modal.js`, looks in `skins/codex-ink/settings-modal.css`.
- **Host anchors first**: the panel is found by `[data-shortcut-modal="settings"]` (the host's own attribute) and only
  falls back to the third-party skin-center adapter's `[data-dsh-surface="settings"]`. The visual layer hangs off the
  plugin's own `[data-cx-sm-panel]` only, so a host rename moves one constant, not a stylesheet. When the settings
  dialog is open but no anchor matches, the layer **warns** instead of failing silently.
- **Hiding is attribute-first**: the host rewrites a nav item's whole `className` when the selection moves away, so the
  durable marker is `data-cx-sm-hidden`; the class is only for humans. The list observer runs with `subtree` — without
  it the class rewrite produces zero mutation records (measured 0 vs 5).
- **Never takes over host nodes**: unknown items are only grouped visually, host nodes are never moved, cloned or
  deleted. Reordering uses `style.order`; the known cost is that Tab order stays DOM order.

### Ported into the new structure

- The 0.6.2–0.6.4 model-picker work (seat-local `pending`, top-rung violet dot matrix, the 16×30 knob and the
  Faster/Smarter row) lives in `src/client/model-picker/{component,view}.js`; the fixture's fake directory no longer
  pretends the snapshot has a `pending` field, which is what the installed host actually looks like.
- The 0.6.3 measured-pixel values (sidebar `#f6f6f6`, centre-column ambient shadow 13px @7%, two-layer composer
  shadow) are in, and the dark centre-column rule is kept separate: the light fit does not hold for dark, so a single
  token cannot express both.
- `scripts/live/settings-modal.mjs` and `scripts/live/settings-sweep.mjs` are the live-GUI checks for the modal. The
  sweep treats "found zero settings pages" as a hard failure — it used to report PASS while scanning nothing.
- 0.6.4's sidebar-colour verification comes across as the `sidebar-color` fixture spec (16 assertions: both themes on
  one page, measured pixels, the hierarchy direction, plus a per-theme negative control).

### Verification

`npm run check` 67/67 · `node scripts/verify.mjs` 224/224 (9 specs).

## 0.6.4 - 2026-09-28

Both sidebars were rebased. Codex has **no sidebar color token**; the left panel is painted with a translucent
scrim, so its rendered color depends on what sits behind the window. Two consequences: the old light `#EEF4F9`
was a reading taken over a blue backdrop, and the old dark `#181818` was the *surface* colour, not the sidebar —
which made the dark sidebar 7 levels **lighter** than the window background, i.e. the hierarchy ran backwards.

### Where the difference actually comes from

`app-shared-fa3f1d5d5942.css` (Codex desktop 26.924.2738.0), electron window, left panel whose appearance is
not `content-surface`:

```css
.app-shell-left-panel:not([data-app-shell-left-panel-appearance=content-surface]) {
  background: color-mix(in srgb, var(--color-surface-tertiary) 70%, transparent);
}
```

Light `--color-surface-tertiary` = `--gray-75` = `#F3F3F3`. Over a white base:
`0.7 x 243 + 0.3 x 255 = 246.6 -> #F6F6F6`.

`[data-app-shell-page-surface=true]` additionally gets `--color-surface-secondary` (`#F9F9F9`) at 85%, so the
sidebar is always the darker of the two — that is the entire hierarchy; there is no extra token.

### Measured (one capture per theme, sampled away from text)

| Surface | Codex light | codex-ink before | now | Codex dark | codex-ink before | now |
|---|---|---|---|---|---|---|
| sidebar base | `#f6f6f6` (246) | `#eef4f9` (238,244,249) | **`#f6f6f6`** | `#0f0f0f` (15) | `#181818` (24) | **`#0f0f0f`** |
| sidebar selected row | `#e9eaea` (233) | `#e2e9ed` | **`#e9e9e9`** | `#1f1f1f` (31) | `#282828` (40) | **`#1f1f1f`** |
| content base | `#ffffff` | `#ffffff` | `#ffffff` | `#111111` (17) | `#111111` | `#111111` |
| sidebar minus content | -9 | -17 | **-9** | -2 | **+7** | **-2** |

Light: the old value was off by R -8 / G -2 / B +3 — a blue cast — so the step read as a hue shift rather than
a grey step. Dark: the old value was the surface colour, so the sidebar sat 7 levels **above** the background —
the direction was inverted. Both themes now put the sidebar below the content (255 -> 246, 17 -> 15).

### What is not the source

The screenshot that prompted this is Codex's own **Settings -> Appearance** panel: every visible label matches
Codex's zh-CN locale keys (`settings.general.appearance.chromeTheme.accent / surface / ink / uiFontFamily /
codeFontFamily / translucentSidebar / contrast`, plus `import` / `export`). But the code block it shows is not
live Codex text. `themePreview`, `ThemeConfig` and `sidebar-elevated` have **zero occurrences** across all
19,310 files of the Codex app bundle (raw byte search, no extension or size filter) and zero across 57,865
files of this workspace. Codex ships `--color-surface-elevated` / `--color-surface-elevated-secondary`, never
`sidebar-elevated`; the only `ThemeConfig` hits in the bundle are mermaid's `quadrantDiagram` / `xychartDiagram`
builders. The colour mechanism is the CSS scrim quoted above, not that snippet.

### Changed

- `skins/codex-ink/skin.css`, light: `--dsw-alias-bg-sidebar` and `--dsw-specific-sidebar-fill` `#eef4f9` ->
  `#f6f6f6`; `--dsw-specific-sidebar-nav-item-active` `#e2e9ed` -> `#e9e9e9`;
  `--dsw-specific-sidebar-nav-item-hover` `#e8eef3` -> `#f0f0f0`.
- `skins/codex-ink/skin.css`, dark: the same four tokens `#181818` -> `#0f0f0f`, `#282828` -> `#1f1f1f`,
  `#212121` -> `#171717`. The dark **surface** tokens are untouched — `--dsw-composer-surface` stays `#181818`
  so the composer card still measures 35, matching Codex.
- `src/override.js`: `SKIN_DEFAULTS.light.sidebar` follows — the settings card shows this as the
  "follow the skin" default and `check-repo.mjs` reconciles the two.
- `scripts/model-picker-verify.mjs`: fixture backdrop follows.
- New fixture `scripts/sidebar-color-verify.mjs` (16 assertions): the six surfaces rendered side by side at DPR 2
  on one page, captured once per theme by toggling `body[data-ds-dark-theme]`, new values against old values at
  the same sampling points, plus a negative control per theme proving the rig can tell the old reading from the
  new one.

### Boundaries

- The skin writes the **composited** value `#f6f6f6`, not the literal
  `color-mix(in srgb, #F3F3F3 70%, transparent)`. DSH paints the sidebar fill on more than one layer (the
  titlebar strip and the sidebar both take `--dsw-specific-sidebar-fill`), so a literal 70% scrim would
  compound into a different, layer-count-dependent result. The composite is what Codex shows on a white base,
  which is the case this skin guarantees.
- The dark **surface** chain is not part of this change: `#181818` / `#212121` / `#282828` / `#303030` were
  not re-measured against Codex's dark capture beyond the composer card (35, matches).
- The dark sidebar `#0f0f0f` is a *measured* value, not a derived one. Codex's dark scrim resolves through
  `--color-surface-tertiary`, whose dark value has more than one declaration in the bundle; over a black window
  base the arithmetic gives 13 with one candidate and 15 with the other, and the capture says 15.

## 0.6.3 - 2026-09-28

The composer shadow and the window-frame shadow are now **fitted to measured pixels** instead of copied from
Codex's source tokens — the two disagree: the `0 4px 80px 8px` far field of `--elevation-composer` is not
present in the reference capture, and the token's `1px` ring rasterises to 2 device pixels at DPR 2 where the
capture shows 1.

### Measurements (same sampling line on both sides, DPR 2, device pixels)

Composer (outward from the card edge):

| | before | after | Codex capture |
|---|---|---|---|
| ring device pixels | 2 | **1** | 1 |
| ring minimum | 226 (Δ29) | **222 (Δ33)** | 222 (Δ33) |
| bottom-edge Δ | 8,8,7,7,6,6,5,5,5,4,… | 13,12,11,11,10,9,8,8,7,6,6,5,4,4,3,3,2,2,2,1,1,1,1 | 13,12,11,10,9,8,7,6,5,4,4,4,2,2,2,2,2,1,1,1,1,1,1 |
| distance to zero | 56 (= 28 CSS px) | **24 (= 12 CSS px)** | 24 |
| total absolute error vs Codex | 147 | **55** | — |

Window frame (from the hairline into the sidebar):

| | before | after | Codex capture |
|---|---|---|---|
| sidebar-side Δ | 6,6,5,5,5,5,5,4,4,4,4,4,3,3,3,3,3,3,2,2,2,2,2,2 | 8,7,7,6,6,5,5,4,4,4,3,3,2,2,2,2,1,1,1,1,0,0,0,0 | 8,8,6,6,5,5,4,3,3,3,2,2,2,2,2,1,1,1,1,1,1,1,1,1 |
| distance to zero | 32 (= 16 CSS px) | **21 (= 10.5 CSS px)** | 26 (= 13 CSS px) |
| total absolute error vs Codex | 47 | **22** | — |

### What changed

- `skins/codex-ink/composer.css`: `--dcu-composer-shadow` goes from
  `0 0 0 1px rgba(13,13,13,.1), 0 2px 8px 0 #0000000a, 0 4px 80px 8px #00000006` to
  `0 0 0 0.5px rgba(13,13,13,.1), 0 2px 12px 0 rgba(0,0,0,.09)`; the narrow-viewport
  (`max-width: 639px`) 80→40px override is deleted — there is no far field left to shrink.
- `skins/codex-ink/window-shadow.css`: the centre column's ambient shadow tightens from
  `0 0 24px rgba(13,13,13,.05)` to `0 0 13px rgba(13,13,13,.07)`; the hairline is untouched
  (the measured gap is within ±4 levels, i.e. sampling noise).
- `scripts/composer-shadow-verify.mjs`: four assertions were re-derived to the new criteria
  (three layers → two, ring 1px → 0.5px, near field 8px@4% → 12px@9%, falloff "≥35px" →
  "inside Codex's measured band of 3~13px"), 20 → 21 assertions.
- `scripts/rightbar-verify.mjs`: two assertions still pinned the pre-fit centre-column halo
  (`0 0 24px @5%`) and had been failing since the fit; they now pin the measured
  `0 0 13px @7%` in both the desktop shell and the web form.

### Boundaries

- **The dark window-frame shadow is unchanged** (`0 0 24px rgba(0,0,0,.5)`): there is no dark reference
  capture on hand, and changing it without a measurement would be eyeballing. Codex's `--shadow-card` has no
  dark override and stays at 5.1% black — that item is still unmeasured.
- The fitting fixture is headless Chrome plus the host's real CSS Modules plus this skin, not the live app;
  it does reproduce the ring seen in the user's on-screen capture (fixture 226 before, live 226 / 223).
- Only the skin side changed (`skins/codex-ink/*.css`); no DSH platform shadow or stroke definition was touched.

## 0.6.2 - 2026-09-28

Fixes the **release timing** of 0.6.1's local pending: switching back to the tier already in force dropped the
optimistic value immediately, so the earlier in-flight commit then dragged the display back — the reported
"during loading every drag rebounds, and you must wait it out".

### Symptom (reproduced frame by frame)

After high → max there is a round-trip window. Switching back to high inside it:

```
3:Max 3:Max 3:Max 3:Max 3:Max 3:Max 3:Max   <- switched back to Max inside the window, correct
1:Low 1:Low                                  <- yanked back (the earlier commit landed)
3:Max 3:Max 3:Max 3:Max ...                  <- only when the second commit lands
```

### Root cause

- The host's `current` is the **durable next-request projection**
  (`read:dsh-client-ui-model-selection/lib/types/client/directory.d.ts:14`) and therefore **trails** the commit:
  between sending a selection and its landing, `current` still names the old tier.
- 0.6.1's `settlePending` released the pending as soon as `current` equalled it. **Switching back to the tier
  already in force makes those two equal by construction** (pending = old tier = the current `current`), so the
  pending was dropped in the very same frame it was set and the optimistic cover vanished.
- The earlier commit then landed, `current` became it, and the display was dragged along — the rebound. It only
  returned to the target tier once the second commit landed too.
- So this is neither the host's fault nor "slow loading" as such: the host **accepts the commits in order** (the
  second one really is sent and does land). What was being pulled back was the **display**.

### Fix

- A pending may only be released **after the commit's RPC has settled** (`seat.pendingSettled`): on settle, mark
  it, then check whether the host has caught up; if it has not, keep the pending and wait rather than dropping it
  on the spot.
- Safety valve: if the host never echoes (a dropped response, or a later commit superseding it), `PENDING_ECHO_MS
  = 12s` force-clears it so the UI cannot be pinned to a tier that will never land. Failure paths (a throw or
  `ok:false`) still clear immediately — a failure is a failure, and an optimistic value must not cover it.

### Criteria

- `power-rail-verify` 61 → **62 assertions**: a new "switching back to the original tier inside the round-trip
  window keeps the target tier all the way (no rebound)" samples 22 frames across the fixture's 600ms round trip
  and fails if any frame leaves the target. Pre-fix it measured `3:Max x7 -> 1:Low x2 -> 3:Max x13`; post-fix all
  22 frames are `3:Max`.
## 0.6.1 - 2026-09-28

Fixes a **criterion mismatch** shipped in 0.6.0: the model picker's optimistic display was built on a field the real host
does not provide.

### Symptom

Changing the reasoning effort made the rail **snap back to the old tier** on release, and the bottom trigger stayed on
the old tier for the whole round trip (~1.1s measured) — i.e. "the slider moved, the thinking label did not".

### Root cause

- The installed `@deepseek-ai/dsh-client-ui-model-selection` is **0.1.7-rc.1**; its `ModelDirectoryState` carries
  exactly six fields: `{ current, routable, groups, failures, status, error }` (`lib/types/client/directory.d.ts:13-32`).
  **There is no `pending` and no `retainedEffort`** — neither word occurs once in that package's `client.js`.
- 0.6.0's `viewOf()` read `snap.pending` to derive the optimistic tier; with the field absent `pendingEffort` was
  always false, so `effective` always equalled the durable `current.reasoningEffort`.
- The store's first notification (`status → selecting`) therefore repainted the rail from the **stale** current.
  Frame by frame: the rail was back on the old tier at `t=234ms` and only reached the new tier at `t=252ms`;
  `data-pending` and `.codex-mp-spinner` never appeared at all.
- The fixture built its snapshot from the **documented rc.2 contract and supplied `pending` itself**, so those three
  criteria proved nothing on the real host.

### Fix (one source file; appearance and interaction shape unchanged)

- `viewOf(snap, localPending)` takes an optional second argument: **the host's `pending` wins when present** (so a
  future host that adds it is picked up automatically); only when it is missing does the seat's own record apply.
- Seat-level `seat.pending`: `submit()` records the target selection and repaints **immediately**, so the rail, the
  bottom trigger and the popover's effort label sit on the target tier from that frame on.
- Three release points, all idempotent, each guarded so a late response cannot clear a newer submission: the host's
  `current` catches up (`settlePending`, run on every store notification and every scan), the submission resolves ok,
  or it fails / throws.

### Criteria corrected (this matters more than the fix)

- `scripts/power-rail-verify.mjs`'s fake directory **drops `pending`**, matching the installed host field for field.
  Run against the pre-fix source that fixture scores **44/47**, failing exactly "rail stays on the new tier during the
  round trip" / "trigger already shows the new tier during the round trip" / "model row spinner during a model change";
  post-fix it is **47/47**. The fixture can now tell "genuinely optimistic" from "simply never measured".
- `scripts/check-repo.mjs`'s power-rail view case gains six assertions: the seat's own record is used when the host
  provides no `pending`; `null` / omitted arguments change nothing; a pending on another model does not hijack this
  model's tier; the host's `pending` wins once it exists.
- `src/model-picker.js`'s driver contract now states the measured shape (the six fields of 0.1.7-rc.1) instead of
  copying fields that do not exist.

### ㉑ The reasoning slider takes dsh-claude-style's form (form only)

**This block only, form only**: the control stays in the popover, keeps the same seat and the same interaction
(real drag / snap on release / four keys). Only the track's appearance follows the reference; every other region
and control of the codex skin is untouched.

- **The form baseline is dsh-claude-style's .dsh-claude-effort-* rules** (its own comments name Claude Desktop's
  Effort slider as the reference). Every measurement is read from its source, not eyeballed: groove **26px tall,
  8px radius** (a rounded rectangle, not a pill); fill = label ink at **26%**, square on the right, ending at the
  knob's centre; ticks 4px in the same ink as the fill (passed ones are swallowed by the fill, so there is no
  selected/unselected pair any more); knob **16×30, 5px radius**, white with a 0 1px 3px shadow (a rounded
  rectangle, not a bead); and a new **Faster / Smarter** row under the groove (11px caption colour — it names the
  axis, not a value).
- **The top rung swaps in a violet dot matrix** (apex): fill and ticks step aside for a **5-row block grid**
  (1 device-pixel gaps, 0.5 device-pixel margins, solved in whole device pixels — a fractional pitch rasterizes as
  alternating gaps); each block's phase, cycle and tone are **hash-scattered** (nothing ordered, so it reads as a
  field of particles rather than one sweeping bar); the left end dissolves back into the bare track by smoothstep
  while the right end stays solid; the knob takes a violet tint and a 10px glow, and the level's name goes violet.
  The violet comes in two sets, one per theme (light #8b7ad0 / dark #9d8ce0).
- **The blue sweep ported last round is gone with the form** — it came from plugin-effort-slider, not from the
  reference; the top rung is now the matrix alone, and the build carries no effect the reference does not have.
- **Still triggered by the continuous ratio**: the matrix lights up at the far right *before* release, not only once
  the committed level changes; a single-tier model has no "highest tier".
- The level's name swaps the way the baseline does: the incoming one rises out of a blur while the outgoing ghost
  blurs away upward, re-armed on every real change.
- Both off switches as before: the system prefers-reduced-motion and the script's data-reduced-motion.

### Criteria

- power-rail-verify 53 → **61 assertions**: groove 26/8, hit area 30, fill 26% with 8px 0 0 8px, knob 16×30/5px/
  white/shadow, the Faster-Smarter row, tick travel [8, width−8], knob centre = the level in force, fill ending at
  the knob's centre, ticks sharing the fill's ink; seven for the apex (grid lit with 5×N cells, fill and ticks
  yielding, scattered phases with 8 tone buckets, plume fading 0→1, flash cycle inside the 1.45s scatter band,
  violet knob with glow, violet level name); three for dark (groove still 26/8, apex violet swapped to the dark set,
  knob a violet tint rather than white).
- check-repo's unit assertion moved from the sweep to the matrix: two keyframes, three mountable classes,
  **no --codex-mp-pos in the block's declaration** (the hard condition for reusability), 8 tone buckets, both
  theme sets of the apex violet, and both off switches.
- Two fixture precision issues fixed along the way: keyframe selectors did not accept decimal percentages
  (17.24%), and --codex-mp-apex-* was first defined on the rail where the level's name in the head could not
  read it (moved to the card).


- `power-rail-verify` 47 → **53 assertions**: the shimmer trio (animation-name / 1.8s / 250% gradient),
  the thumb breathing on the same cycle, the accent genuinely coming from `--dsw-alias-link` (found inside the
  gradient string), no glow at the far left, glowing before release at the far right, and both animations stopped
  under reduced motion.
- `check-repo` gains a structural assertion: both keyframes and both mountable classes exist, **the unit's declaration
  block never mentions `--codex-mp-pos`** (the hard condition for reusability), the accent is a single source, and both
  off switches are present.
- Also fixed a fixture precision issue in `check-repo`: keyframe selectors were filtered only as single `0%`, so a
  comma list like `0%, 100%` was misread as a CSS selector.
## 0.6.1 - 2026-09-28

An architecture cleanup: no feature changes, much faster while a reply streams in, and the engineering scripts reduced
to three entry points. Before and after the refactor, every element's computed style was compared across 14 UI states on
a real `dsh web`: zero differences apart from the one intended change under "Fixes".

### Performance

- **No more `:has()` in ancestor positions**: 9 rules in sidebar alignment, 2 in the sidebar fade, 1 for the model
  picker seat; the composer hero rule became a fixed-depth child `:has()`. An ancestor-position `:has()` makes Chromium
  re-match the whole subtree under every affected ancestor each time the conversation inserts a node carrying `data-slot`.
  Simulated streaming (200 frames, each 30 spans plus one `data-slot` node), median of 5 runs:

  | Mode | Style recalc | Wall time |
  |---|---|---|
  | web | 4264 → 267 ms | 6.3 → 2.3 s |
  | Windows desktop shell (title bar) | 9518 → 442 ms | 11.7 → 2.5 s |

  In the desktop-shell mode the skin's extra recalc over a bare host is now within noise. Every new anchor keeps the
  old selector's specificity, so the cascade against host rules is unchanged.
- **Model picker seat**: the host control used to be hidden by `seat:has(> .codex-mp-trigger) > :not(trigger)`; now the
  **seat itself** gets `data-codex-ui-seated` when our trigger goes in, and loses it when the trigger is removed. The mark
  sits on the slot outlet, not on the host's child, so React replacing that child does not drop it (0.6.0's reason for
  avoiding a mark no longer applies; the fixture "still hidden after the host replaces its own child" passes).
- **Narrower observer**: the model picker's MutationObserver rescans everything only on attribute changes and on seats
  being added or removed; otherwise it re-syncs just the touched seats and the ones not settled yet. Script time while
  streaming: 47.5 → 10.1 ms.

### Fixes

- **The dark `html` background never applied**: `skin.css`'s `:root:has(body[data-ds-dark-theme])` was scoped to
  `html[data-codex-ui] :root:has(…)` (a descendant selector that never matches), so in dark mode `html` stayed light
  `#fff`, normally hidden behind `body`. The scoper now maps compound selectors starting with `:root` to the root itself.
  This is the release's only visible difference: in dark mode the `html` background goes `#fff` → `#111111` (the
  intended design; see the last item under "Settings page" in the README). It is its own commit (249e6d1) and can be
  reverted on its own.

### Structure

- The browser half is split into ES modules under `src/client/`: `index.js` (`inject` and `apply`), `stylesheet.js`,
  `settings.js`, `theme-preview.js`, `settings-card.js`, `override.js`, `model-picker/{index,component,view}.js`,
  `constants.js`, `host.js`. The string-splicing template `src/client.template.js` and `src/build.mjs` are gone. A new
  feature is one module exporting `installXxx(ctx)` plus one line in `apply`.
- `scripts/build.mjs` is the only build: a zero-dependency bundler turns the modules into IIFEs in dependency order
  (relative imports become destructuring, host packages go through the loader's `require`), with the stylesheet
  inlined as the virtual module `codex-ui:theme.css`; unknown import or export forms fail the build. The CSS scoper
  understands comments and strings, and comments are stripped from the output.
- Unreachable code removed: the settings card's summary branch, the no-primitives fallback and theme fallback table,
  and the matching `.cx-row--stack` and fallback styles in `settings.css`.
- Deduplicated styles: repeated shadows and fills became 4 tokens (`--dsw-codex-ambient`, `--dsw-codex-menu-shadow`,
  `--dsw-codex-suggest-shadow`, `--dsw-codex-suggest-fill`), dark declarations identical to light ones were dropped,
  comments were slimmed; the eight stylesheets went from 2491 to about 1820 lines.

### Engineering

- Scripts went from 25 files / 4886 lines to 15 / 3356, with three entry points and shared code in `scripts/lib/`
  (host / cdp / checks):
  - `scripts/check.mjs`: the former `check-repo.mjs` plus `audit-codex-ink.mjs`, 60 checks, the CI entry point; new are a
    DSH client plugin contract check on `client.js` (executed once in isolation: loader id = package name, `inject` is
    exactly the three required services, the inlined stylesheet equals `theme.css`) and a `peerDependencies` check.
  - `scripts/verify.mjs` + `scripts/specs/`: the eight former `*-verify.mjs` fixtures with the same assertion names and
    counts, 195 in total; `npm run verify`.
  - `scripts/live/`: `gui.mjs`, `settings.mjs` (absorbing `theme-flash-probe.mjs`: no intermediate frame while switching
    theme) and the new `parity.mjs` (per-element computed-style comparison before and after a change).
- **Install goes through the standard `dsh plugin add link:`**: removed `install-plugin.mjs`, `make-verify-profile.mjs`,
  `pack-host-asar.mjs` (an npm-installed `node_modules` works as a fixture host directly), `make-preview.mjs` and
  `scripts/fixtures/`; `package.json` drops `install:*`, adds `verify`, and declares `@deepseek-ai/schemastery` in
  `peerDependencies` (`index.js` imports it; the host provides it). See "Install" in the README for **migrating**.
- Fixture fixes: the old hero / composer-shadow fixtures truncated the host's conversation root styles at the first
  `content:""` (2672 of 6717 characters read); with the full CSS the scroller clips the shadow, so the fixture now puts
  the padding inside the scroller as the real app does, with unchanged readings (edge 224, 42px falloff). The face A
  menu fixture and the right-bar fixture, already broken on 0.6.0, work again. The settings check resets every override
  when it finishes, so later comparisons are not polluted.
- Removed `docs/plan-settings-page.zh-CN.md` (an executed plan whose conclusions are in the changelog) and the
  verification screenshots the READMEs no longer reference.

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
