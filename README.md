<p align="center">
  <img src="assets/screenshots/live-gui.png" alt="codex-ui" width="100%">
</p>

<div align="center">

  # codex-ui

  **Codex appearance for DSH Web: window edges, sidebar divider, model picker and reasoning power rail, composer, theme colors**

  [简体中文](README.zh-CN.md) · [Changelog](CHANGELOG.md) · [MIT](LICENSE)

  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
  [![DSH Web Plugin](https://img.shields.io/badge/DSH%20Web-Plugin-0f766e.svg)](https://github.com/deepseek-ai/deepseek-harness)
  [![Node.js 22 or later](https://img.shields.io/badge/Node.js-22%20or%20later-339933.svg?logo=node.js&logoColor=white)](https://nodejs.org/)
  [![CI](https://github.com/rinDBeans/codex-ui/actions/workflows/ci.yml/badge.svg)](https://github.com/rinDBeans/codex-ui/actions/workflows/ci.yml)

</div>

> codex-ui is a community-maintained interface plugin for DeepSeek Harness (DSH), not an official DeepSeek AI product.

This plugin rebuilds DSH Web interface elements to match Codex: edge shadows and hairlines, the sidebar divider,
the model and reasoning-effort menu, composer structure, and the light and dark palettes.
Values come from Codex screenshots and its color picker, measured per pixel. The measurements and the source
images are in the sections below and in `assets/reference/`.

## Host compatibility

Developed against DSH `0.1.7-rc.1` (npm global install) and `0.1.7-rc.2` (Windows desktop shell `app.asar`);
the full 0.7.0 verification ran on the npm release `@deepseek-ai/dsh@0.1.7-rc.2` (fixtures against both its
`node_modules` and an `app.asar` packed from it, the live checks on a `dsh web` booted from it; see "Host and browser").
Fixtures read the shipped host CSS and render code directly, so a structural host change fails their assertions.

## Features

| Id | Content |
|---|---|
| ⑳ | **Model picker, face B** (on by default): a component of our own takes over the composer model seat — model list (grouped by provider, with descriptions) plus the Codex reasoning **power rail** (24px track / 4px ticks / 28px white thumb, real drag, ←/→/Home/End, levels from the data); during the round trip it shows the new level optimistically with a spinner and never clears the list (the optimistic value prefers the host's `pending` and falls back to the seat's own record — 0.1.7-rc.1 has no such field); **the slider's form follows dsh-claude-style** (a 26px groove with an 8px radius, a 26% ink fill, a 16×30 knob, and a Faster/Smarter row under the groove), and **the top rung swaps in a violet dot matrix** (5 rows of hash-scattered blocks, #8b7ad0 light / #9d8ce0 dark, stopped by both `prefers-reduced-motion` and the script's `data-reduced-motion`); the trigger cross-fades the effort label with blur. Can be switched off in settings |
| ⑫ | Model picker, face A (the host menu when ⑳ is off): opaque white menu (18px radius), 28px rows with 13px radius (concentric: 18 − 5px inset), permanent check column, pending spinner |
| ⑬ | Composer header turned blank, panel buttons keep the official icons |
| ⑬c | Both header slots **released**: entries registered there render again (subagent descendant count / job roster / preset badge / open-in-app); the view tabs stay hidden. The entries are conditionally rendered, so the top bar is unchanged in the common case |
| ⑬d | **An exit for the Trajectory view**: once ⑬ hides the tab strip, Trajectory has an entrance but no way out — a tool card's expanded Inspect goes through `openView('trajectory', callId)`, and the only route back was that strip. While the Trajectory view is showing, a "← Chat" pill floats at the lower-left of the view area; clicking it **clicks that very tab**, the same `selectView` callback a real click uses, with no host internals involved. Structure in `src/client/trajectory-exit.js`, looks in `skins/codex-ink/trajectory-exit.css`. Which tab is Chat is calibrated from `aria-selected` while Chat renders, falling back to the tab's own text; with neither, **no button is shown at all**. If the strip ever becomes visible again this layer steps aside. Any mismatch with the host layout warns and skips |
| ⑭ | Composer card: radius (card 20/25, top strip = the card's own radius), shadow, geometry, tool row, hero layout |
| ⑯ | Right panel guide entries: no border, no fill, 52px rows, 20px icons, filled shortcut pills |
| ⑰ | Composer bottom controls: add button has no box until hover; model and permission controls share the hover chip and, like the add button, are **fully rounded** (Codex reference measures R = h/2) |
| ② | Sidebar colors match the Codex light sidebar; sidebar rows align with the workspace list |
| ②c | Conversation window edge: 0.5px hairline plus a 24px ambient shadow |
| ②d | Right panel: hairline only on its left edge, shadow bleeds upward only; the dockkit 1px border is removed |
| ②e | Right divider handle: center-darkest gradient on hover |
| ⑱ | Settings card on the plugin manager's codex-ui bundle page: theme / accent / background / foreground / UI font / code font / translucent sidebar / Codex model picker / contrast |
| ㉑ | **Settings modal, full-page Codex pass**: the settings dialog gets a grouped sidebar (a "← Back to app" row, a search box that filters host items, group headers), a page header in the content area, white cards with hairlines on every sub-page and sticky save bars. Structure comes from `src/client/settings-modal.js` (host anchors only, host nodes never moved or cloned, hiding driven by a durable `data-*` attribute), looks from `skins/codex-ink/settings-modal.css`. Any step that does not match the host layout warns and skips — the layer degrades, it never throws |

## Screenshots

Light theme: conversation window edge and right panel.

![Light theme](assets/screenshots/live-gui-rightbar.png)

Composer bottom row: no box by default, a chip on hover.

![Composer controls](assets/screenshots/composer-controls-hover.png)

Model picker face B (captured on a real `dsh web` instance): model list plus reasoning power rail, light and dark.

<p><img src="assets/screenshots/model-picker-live.png" alt="Model picker · light" width="49%"> <img src="assets/screenshots/model-picker-live-dark.png" alt="Model picker · dark" width="49%"></p>

With face B switched off, the host menu (face A) while a reasoning effort is being written.

![Model menu pending](assets/screenshots/model-pending.png)

## Install

A standard DSH plugin install; none of this repository's scripts are involved:

```powershell
dsh plugin --profile web add link:<absolute repo path>   # adds a link dependency and puts the package into dsh.profile.bundles
dsh web
dsh plugin --profile web remove codex-ui                 # uninstall: removes the dependency and the bundles entry
```

To keep your everyday profile untouched, try it in a new profile first:

```powershell
dsh codex --from-default-profile web --dump-config   # creates the codex profile from the web template
dsh plugin --profile codex add link:<absolute repo path>
dsh codex --port 3099 --no-open
```

The desktop app owns its profile and the CLI refuses to write it: open "Plugins" → "Add plugin" in the app and enter
the absolute repo path (the dialog accepts a package name, a Git URL, a tarball or a local absolute path).
`@deepseek-ai/schemastery` is declared in `peerDependencies` and provided by the host.

`link:` points at the repository itself: after changing a stylesheet or a component, run `npm run build` and reload the
page. A change to the `Config` in `index.js` needs a `dsh web` restart (the host half loads at boot).

**Migrating from 0.6.0 or earlier**: `install-plugin.mjs` is gone. It installed a copy at
`profiles/<name>/vendor/codex-ui` plus a `node_modules/codex-ui` junction, registered either through the package name in
`dsh.profile.bundles` or a hand-written `- insert:` in the profile `cordis.patch.yml`. Remove those before the standard
install — two registrations of the same id fail the market check and the plugin is disabled.

The same stylesheets can be picked up by a skin loader:

```powershell
node scripts/install-skin.mjs          # per-file SHA256 check against $DSH_HOME/skins/codex-ink
node scripts/install-skin.mjs --write  # overwrite on drift
```

## Development

```powershell
npm run build                    # regenerate theme.css and client.js from skins/codex-ink and src/client
node scripts/build.mjs --check   # report stale artifacts without writing
```

The build has no dependencies and one implementation, `scripts/build.mjs`: the eight stylesheets are stripped of
comments and scoped to `html[data-codex-ui]` into `theme.css`; the ES modules in `src/client/` are bundled in dependency
order into one classic script, `client.js` (the DSH `__ModuleLoader__.load` shape, stylesheet inlined, host packages such
as `react` resolved through the loader's `require`). It accepts two import forms (`import { a, b as c } from '…'`,
`import * as ns from '…'`) and three export forms (`export const | function | class`); anything else fails the build
instead of bundling wrongly.

Adding a feature: a module in `src/client/` exporting `installXxx(ctx)` plus one line in `apply` in
`src/client/index.js`; new styles go into a new file in `skins/codex-ink/`, registered in `SKIN_PARTS` in
`scripts/build.mjs`. Required host services go into `inject` (one missing service keeps the plugin inactive); optional
ones go through a `ctx.inject([...], cb)` child scope, as the model picker does.

## Layout

| Path | Content |
|---|---|
| `index.js` `cordis.patch.yml` `package.json` | Host half (the `Config` schema) and manifest |
| `src/client/index.js` | Browser half entry: `inject` and `apply`, wiring up the modules below in order |
| `src/client/stylesheet.js` | Injects the skin (`style[data-plugin]`, which the host removes on unload and hot reload) |
| `src/client/settings.js` `theme-preview.js` `settings-card.js` | Settings: the override `<style>`, the local theme preview, the config card on the bundle page |
| `src/client/settings-modal.js` | ㉑ settings-modal structure layer: grouped sidebar, search filter, page header, attribute-first hiding. Host anchors only — host nodes are never moved or cloned, and any step that does not match the host layout warns and skips |
| `src/client/override.js` | Override-layer pure functions (no DOM; unit-tested by `check.mjs`) |
| `src/client/model-picker/` | Model picker face B: `index.js` waits for the `modelDirectories` service, `component.js` is the seat takeover, popover and power rail, `view.js` holds the pure functions (unit-tested by `check.mjs`) |
| `src/client/trajectory-exit.js` | ⑬d Trajectory exit: floats a "← Chat" pill that **clicks the Chat tab itself** (the same `selectView` callback a real click uses, no host internals). Calibrates which tab is Chat from `aria-selected`, falls back to its text, and shows no button at all when neither resolves |
| `src/client/constants.js` `host.js` | Shared names and small helpers for reading host services |
| `skins/codex-ink/` | Stylesheet sources (skin.css / patches.css / model-picker.css / sidebar-align.css / sidebar-surface.css / window-shadow.css / composer.css / settings.css / settings-modal.css / trajectory-exit.css) and the Skin v2 manifest |
| `theme.css` `client.js` | Generated by `scripts/build.mjs` and committed (DSH loads `client.js`) |
| `scripts/build.mjs` | Scoping and bundling |
| `scripts/check.mjs` | Host-free repository checks; the CI entry point |
| `scripts/verify.mjs` `scripts/specs/` | Fixture verification: shipped host CSS plus a rebuilt DOM, asserted in headless Chromium |
| `scripts/live/` | Live GUI verification: `gui.mjs`, `settings.mjs`, and `parity.mjs` (per-element computed-style comparison before and after a change) |
| `scripts/lib/` | Host and browser lookup (`host.mjs`), CDP driver (`cdp.mjs`), assertion summary (`checks.mjs`) |
| `scripts/install-skin.mjs` | Sync for the skin loader path |
| `docs/` | Plans, recon reports and decisions — `docs/README.md` says which are current and which are historical records |
| `assets/reference/` | Codex reference images |
| `assets/screenshots/` | Images used by the READMEs |
| `.github/workflows/ci.yml` | CI |

## Verification

| Command | Coverage | Requirement |
|---|---|---|
| `npm run check` | Syntax, JSON, manifest and `peerDependencies`, artifacts in sync with sources, the DSH client plugin contract of `client.js` (executed once in isolation), scoping, override-layer and power-rail pure functions, 36 WCAG pairs, color whitelist, encoding, docs pairing, machine-specific paths, the settings-modal contract (sources / scoping / host-first anchor / assembly) — 67 checks | none |
| `npm run verify` | All fixtures, 224 assertions (table below) | host packages + Chromium |
| `node scripts/live/gui.mjs --url <token URL>` | Real GUI: shadows and both dividers, plus the model seat — 14 assertions with face B on (takeover, geometry, a keyboard change written into the host store and reverted), 10 with it off (the face A pending window; `--latency` adds 800ms to that round trip by default, since locally it takes <60ms and cannot be sampled) | a running `dsh web` |
| `node scripts/live/settings.mjs --url <…>` | Real GUI: the card on the bundle page, its 9 rows, no override at defaults, switch and accent writes, the host seat coming back when the model picker is off, survival across a reload, no intermediate frame while switching theme; resets everything at the end — 30 assertions | same, with the plugin manager enabled |
| `node scripts/live/settings-modal.mjs --url <…>` | Real GUI: the ㉑ structure layer and its visual layer together — the grouped sidebar, the "← Back to app" row, the search filter, group headers, host node identity (nothing moved or cloned), and the attribute-first hiding that survives the host rewriting `className`. Needs a live `dsh web` with the plugin manager enabled; `--explore` dumps the structure without asserting | same |
| `node scripts/live/settings-sweep.mjs --url <…> --out <dir> --prefix c1` | Opens every settings page in light and dark, screenshots each and measures layout health. **Zero pages found is a hard failure** (non-zero exit): a sweep that scans nothing must never report PASS | same |
| `node scripts/live/parity.mjs snap --url <…> --out <dir>`<br>`node scripts/live/parity.mjs diff <before> <after>` | Stores every element's computed style across 14 UI states and compares them; exits 0 on zero differences. This is how a refactor proves the look did not change. `--ignore` skips given properties or newly added `--variables` | same |

Fixtures: `node scripts/verify.mjs [spec…]`; without a spec, all of them run.

| Spec | Sections | Coverage | Assertions |
|---|---|---|---|
| `composer` | composer-shadow · hero | ⑱ composer shadow **fitted to measured pixels** (two layers — ring + near field; per-layer geometry and alpha, dark inset, narrow and wide viewports agreeing, rendered pixels); ⑬ ⑭ ⑰, the focus ring, the released header slots and the badge colour / radius read from the tokens themselves | 21 + 25 |
| `elevation` | elevation | ⑲ `--dsw-elevation-*` against Codex's source, plus a rendered menu panel | 19 |
| `model-picker` | host-menu · power-rail | ⑫ face A (the host menu) and the pending indicator; ⑳ face B: seat takeover and hand-back, geometry, no commit while dragging / one snapped commit on release, no snap-back and a spinner during a slow round trip, **the top-rung violet dot matrix** (5 rows, 8 tone buckets, hash-scattered phases, feathering, both reduced-motion switches), the four keys, focus ring, Escape, model change carrying its default effort, failure notice, reduced motion, dark, the switch. The fake directory is shaped like the **installed** host (no `pending` in the snapshot) | 20 + 62 |
| `rightbar` | rightbar | Shadow layer, right panel, both dividers | 42 |
| `sidebar` | align · surface | Sidebar column alignment; the sidebar scroll fade (Codex mask ramp), mechanism plus per-pixel alpha | 6 + 13 |
| `sidebar-color` | sidebar-color | The sidebar base against Codex's **measured** pixels, both themes on one page: light 246/233/255 and dark 15/31/17 (all neutral, R=G=B), the sidebar-to-content step in each, the hierarchy direction, plus a per-theme negative control | 16 |

Options: `--host <app.asar | node_modules>` picks the host, `--shots <dir>` the screenshot directory (default
`codex-ui-shots/` under the system temp directory), `--verbose` prints the readings. Fixtures read the shipped host CSS
over a DOM rebuilt from the render code with `getComputedStyle`; they have no title bar, no real AppFrame grid and no
real RPC, so the shadow layer, divider hover and pending feedback are verified on the live GUI.

### Host and browser

Fixtures read the host they run against, taking the first available source in this order (an explicit path that does
not exist is an error):

1. `DSH_ASAR` (the desktop shell's `app.asar`) or `DSH_GLOBAL_MODULES` (any `node_modules` containing `@deepseek-ai/*`);
2. `scripts/host.local.json`, a gitignored per-machine file with `asar` / `globalModules` / `chrome`;
3. a scan of the desktop shell's standard install locations and `npm root -g`.

The browser comes from `DSH_CHROME`, then Playwright's Chromium, a local Chrome, and Edge. No machine-specific path is
committed (`npm run check` scans every file, including the JSON-escaped form inside `client.js`).

Without a desktop shell, the same packages from npm are enough; no asar is needed:

```powershell
npm install @deepseek-ai/dsh@0.1.7-rc.2 --prefix <tmp>
$env:DSH_GLOBAL_MODULES = "<tmp>/node_modules"
npm run verify
```

The same package boots a real instance (the first run creates the web profile; then add the plugin as in "Install"):
`$env:DSH_HOME = "<tmp>/home"; node <tmp>/node_modules/@deepseek-ai/dsh/lib/bin.js web --port 3098 --no-open`.
The token URL it prints is the `--url` for the live checks.

## Settings page

The config card on the plugin manager's bundle page (slot `plugins.bundle.config`, keyed by the **package name**
`codex-ui`). In the desktop app: sidebar **Plugins** → **Installed** → `codex-ui` → the card on that page.
Changes apply immediately; no restart needed.

![Settings page](assets/screenshots/settings-page-accent.png)

The same card in dark (after switching the theme the three colour rows edit the dark variant, and contrast shows the
dark default, 60):

![Settings page · dark](assets/screenshots/settings-page-dark.png)

| Row | Config field | Default | Lands on |
|---|---|---|---|
| Theme | — (writes the host `ui-theme` `preference`) | System | `ctx.theme.setTheme()`: switches the whole app, the same setting as Settings → General → Appearance |
| Accent | `accentLight` / `accentDark` | empty = follow skin | `--dsw-alias-link`, `--dsw-codex-focus` |
| Background | `surfaceLight` / `surfaceDark` | empty | `--dsw-alias-bg-base` |
| Foreground | `inkLight` / `inkDark` | empty | `--dsw-alias-label-primary` |
| UI font | `fontUi` | empty | `--dsw-font-family` |
| Code font | `fontCode` | empty | `--ds-font-family-code` |
| Translucent sidebar | `translucentSidebar` | off | sidebar fill and row fills become translucent |
| Codex model picker | `modelPicker` | on | the ⑳ face B component takes over the model seat; off removes every node of ours and the host menu (⑫ face A) comes straight back |
| Contrast | `contrastLight` / `contrastDark` | 45 / 60 | text tiers and the neutral alpha ladder |

- **The theme row is not card-local view state**: it writes the host's `ui-theme` `preference`, the same setting as
  Settings → General → Appearance — the whole app switches and it survives a reload. The three colour rows below edit
  the variant currently in effect (`active.colorScheme`).
- It does **not** go through `theme.setTheme()`: that path publishes optimistically first and is then re-read from the
  settings document by `adopt()`, so on a slow round trip it draws new → old → new, which reads as "black → white →
  black". The card writes the preference into the theme plugin's own settings document instead (the same namespace
  `ui-theme` and field `preference` the service's internal `host.set` uses), leaving `adopt()` as the only publisher —
  one click, one publish. The control keeps a local pending value so it still feels immediate, and an unaccepted write
  falls back to the service entry point.
  That 0.8s round trip is not left empty: the browser half carries a **local preview** — the target theme is applied
  the moment you click (writing exactly the two things the host writes itself: `body[data-ds-dark-theme]` and the
  `color-scheme` on `html`), then handed back idempotently when `theme/change` arrives with the same result. If the
  confirmation does not arrive within 2.5s, the preview rolls back to the truth. Measured click → colour change:
  **824ms → 22ms** (median), with the run sequence still two runs (light×n → dark×m) and no double publish.
- All 12 fields are `.volatile()`: the settings service only projects volatile fields, and that is exactly how the
  plugin manager knows the entry — no `Config`, no card.
- **Empty means no override**: at the defaults the override layer emits an empty string and `data-codex-ui-theme` never
  appears, so an untouched install's style layer is byte-for-byte 0.1.x (a repo check asserts this). The model picker is a
  structural component and does not go through the override layer: it is on by default and governed by the single
  `modelPicker` switch; switched off, the seat and the host menu are handed back completely.
- Overrides live in one runtime `<style>` whose selector carries one extra attribute (specificity +1), so sheet order
  does not matter and `skins/*.css` is never touched.
- Instant write, no save button; text inputs commit on Enter or blur and every write is read back to confirm it landed;
  overridden rows show a badge and a Reset control.
- The contrast slider is a **documented simplification**: the app lerps text towards ink in linear RGB and raises the
  ramp by a constant; here the text tiers are mixed in the same direction and the hairline/neutral-tone family is scaled
  (clamped to 0.5×–2×). Colored state and diff fills are excluded so the palette never leaks into the override layer.
- The translucent sidebar has no window layer to reveal on the web, and in dark the sidebar shares the surface colour,
  so it is invisible there — the switch therefore also turns the sidebar row fills translucent, otherwise it would be
  completely silent in dark. Recorded as a gap, not presented as an equivalent.
- With the switch on, the settings page backdrop stays pinned to the solid sidebar colour: the settings panel is a
  full-window overlay whose backdrop reuses the sidebar token, and a translucent backdrop would show the main window
  bleeding through it.
- The skin paints the canvas itself: `html` and `body` both carry this skin's base colour in either theme (`html` follows
  through `:has(body[data-ds-dark-theme])`, because the host stamps the theme marker on `body` only). Transitions are
  suppressed for the two frames after a theme change (`html[data-codex-ui-switching] *`, set by the browser half on
  `ctx.on('theme/change')`). Both prevent a flash: the first closes the "nobody painted the canvas this frame" hole that
  would reveal the host's default backdrop, the second stops the whole page from cross-fading.

## Measurements

### Window edges

`assets/reference/codex-app-reference-1x.png` (1901x1107, DPR 1):

| Location | Scan | Value |
|---|---|---|
| Conversation window, left edge | y=600 | x=340..355 ramps 238,241,247 to 231,233,239; x=356 is a single pixel 212,215,221 |
| Conversation window, top edge | x=800 | y=30..45 ramps 237,242,247 to 232,237,242; y=46 is a single pixel 214,218,224 |
| Right panel, left edge | y=600 | x=1437 is a single pixel 237,237,237, both sides pure white |
| Right panel, top edge | x=1700 | y=46 is a single pixel 213,218,224 with the same ramp above |

In both reference images the hairline is one device pixel, so the stylesheet uses 0.5 CSS px: at the 150%
scaling of this machine, 1px rasterizes into two device pixels.

| Target | box-shadow |
|---|---|
| Conversation window | `0 0 0 0.5px var(--dsw-alias-border-l2), 0 0 24px rgba(13,13,13,.05)` |
| Right panel | `0 0 0 0.5px var(--dsw-alias-border-l1), 0 -12px 24px -12px rgba(13,13,13,.05)` |

### Theme colors

Source: `assets/reference/codex-theme-light.png` and `codex-theme-dark.png` (the Codex color picker).

| Role | Light | Dark | Token |
|---|---|---|---|
| Accent | `#339CFF` | `#0169CC` | `--dsw-alias-link` |
| Background | `#FFFFFF` | `#111111` | `--dsw-alias-bg-base` |
| Surface (what the composer sits on) | `#FFFFFF` | `#181818` | `--dsw-composer-surface` |
| Foreground | `#1A1C1F` | `#FFFFFF` | `--dsw-alias-label-primary` |
| Hover fill | `#F2F2F3` | `rgba(255,255,255,.08)` | `--dsw-codex-hover-fill` |

The light values come from the color picker screenshot `codex-theme-light.png`. **Since 0.5.6 the dark side is split across two sources**: the window background comes from the theme picker
(`codex-theme-dark.png` states `背景 #111111`) and the surface from `resources/app.asar`'s `jdi.dark.surface
#181818`; foreground and accent still come from `jdi` (`ink #ffffff`, `accent #339cff`). 0.2.0~0.5.5 collapsed the
two into `#181818`, which cut the composer card's step against the background from Codex's 18 levels to 12. The dark link stays on the app's text-link token `#0169CC`.

The dark ramp: window background `#111111` → sidebar/surface `#181818` → layer 1 `#212121` → layer 2 `#282828` →
layer 3 `#303030`; the alpha family moved from `rgba(252,252,252,·)` to
`rgba(255,255,255,·)` (the app's dark `--alpha-base` is `#fff`).

### Sidebar colors

Source: the Codex app stylesheet, not a point sample. **Codex has no sidebar color token.** The left panel is a
translucent scrim over the window base (`app-shared-*.css`, electron window, left panel whose appearance is not
`content-surface`):

```css
.app-shell-left-panel:not([data-app-shell-left-panel-appearance=content-surface]) {
  background: color-mix(in srgb, var(--color-surface-tertiary) 70%, transparent);
}
```

Light `--color-surface-tertiary` is `--gray-75` = `#F3F3F3`; over a white base that composites to
`0.7 x 243 + 0.3 x 255 = 246.6 -> #F6F6F6`, which is the 246 a Codex capture reads. Because 30% stays
transparent, the *rendered* value tracks whatever is behind the window: the previous `#EEF4F9` was a reading
taken over a blue backdrop, not the baseline.

Measured away from text, one capture per theme: light sidebar **246** / selected row **233** / content **255**;
dark sidebar **15** / selected row **31** / content **17**. In both themes the sidebar sits **one step below**
the content — 255 -> 246 light, 17 -> 15 dark — which is the hierarchy, and it is the only difference.

| Token | Light | Dark | Derivation |
|---|---|---|---|
| `--dsw-alias-bg-sidebar` | `#f6f6f6` | `#0f0f0f` | Codex sidebar, measured on the same sampling line |
| `--dsw-specific-sidebar-fill` | `#f6f6f6` | `#0f0f0f` | same surface (also the app frame and titlebar strip) |
| `--dsw-specific-sidebar-nav-item-active` | `#e9e9e9` | `#1f1f1f` | Codex selected row, measured 233 / 31 |
| `--dsw-specific-sidebar-nav-item-hover` | `#f0f0f0` | `#171717` | midpoint of base and active row |

The dark **surface** (what cards sit on) stays `#181818` — in Codex that is `jdi.dark.surface`, a different
thing from the sidebar. The composer card over it measures 35, matching Codex.

## Limits

- The two header slots have been released since 0.3.0 (⑬·3c), so the **top bar can carry more entries than the
  reference screenshot shows**: they only appear when the session really has subagents / background jobs / a preset /
  a working directory — and that is also the only visible surface for "a subagent is running". The trade-off is
  recorded in the changelog.
- Fixture checks are not signed-in screenshots. The `dsh web` launch token has a lifetime and lives in process memory only.
- In headless mode only the foreground tab handles `:hover`, so multi-page fixtures open the web-shape page last.
- Face B of the model seat (⑳) **registers no slot**: the host still renders `conversation.input.model`; the component
  appends its own trigger to the same seat and marks the seat `data-codex-ui-seated`, and one child rule hides the host's
  child (which stays in the React tree); removing the trigger removes the mark too and the host control is back at once.
  Data and commits go through the host's `ctx.modelDirectories` only. The three advanced states of the Codex power rail — the highlight when
  Fast is off, the Fast-mode tick fly-out, and the purple/blue gradient beyond the maximum level — are not built: DSH has
  no Fast mode and no "beyond maximum" state. The purple Max label on the trigger (`--color-chart-purple`) is skipped too:
  it is outside the color whitelist.
- ⑯ keeps the host tab strip: hiding it also removes the fullscreen and collapse buttons.
- The session row text column is 40px, 2px shorter than the workspace, new session and plugin rows, because the shipped
  `Rows.module.css` gives `.sessionRow .title` its own margin. Left as is.
- `composer.css`, `patches.css`, `sidebar-align.css` and `sidebar-surface.css` use hash-class suffix anchors (`[class$=…]`,
  `[class*=…]`) where the host exposes no `data-*` (0.7.0 raw occurrences: composer 9 · patches 9 · sidebar-align 9 · sidebar-surface 2 · settings-modal 3).
  The 9 in sidebar-align are one anchor, `_collapsed` (the collapsed sidebar), replacing an ancestor-position `:has()`.
  `model-picker.css` has none.
- Selectors keep `:has()` out of ancestor positions: while the conversation streams nodes in, Chromium re-matches the
  whole subtree under every affected ancestor, which took style recalc from ~0.3s to over 4s. The remaining `:has()`
  are in subject position or look at direct children only; `check.mjs` holds `model-picker.css` at zero.

## Codex source alignment

The Codex desktop app carries its webview CSS inside `resources/app.asar` (`webview/assets/app-*.css`); the public
`openai/codex` repository holds the CLI and the TUI, not this interface. Values below come from app `26.727.4816.0`.

| Value | Codex | This skin |
|---|---|---|
| Motion | `--transition-duration-basic: .15s`, `--transition-duration-relaxed: .3s` | `--dsw-motion-fast: 150ms`, `--dsw-motion-slow: 300ms` |
| Easing | `--ease-in-out` and `--default-transition-timing-function`, both `cubic-bezier(.4, 0, .2, 1)` | `--dsw-ease` |
| Focus ring | `--color-border-focus` = `--blue-300` `#339cff`; dark the same at 70% | `--dsw-codex-focus` |
| Pending spinner | `--animate-spin: spin 1s linear infinite` | `codex-ui-spin 1s linear infinite` |
| Hairline | `--shadow-hairline: 0 0 0 .5px #0000001a` | the window and panel hairlines use the same 0.5px ring |
| Light foreground | `--color-text-foreground: #1a1c1f` | `--dsw-alias-label-primary` |
| Chip fill | `--background-button-secondary-hover`, 8% of the foreground | light `#f2f2f3` (measured), dark `rgba(255,255,255,.08)` |
| Composer chip radius | Fully rounded pill (per-pixel measurement of `codex-composer-chip-hover.png`: R = h/2 = 21px) | `--dsw-radius-pill` (declared explicitly since 0.5.0; before that it inherited the host's `--dsw-radius-sm` = 8px) |
| Power rail | `_Track` 24px / radius 12 / 10% foreground / `inset 0 0 0 .5px var(--color-border)`; `_Tick` 4px with a 16px hit area; `_Thumb` 28px white disc / `.5px` `--color-border-strong` / `0 0 2px #0000001a` | `.codex-mp-track` / `-tick` / `-thumb`, same values; `--color-border` → `--dsw-codex-border` (10% / 12%), `--color-border-strong` → `--dsw-codex-border-strong` (15% / 20%) |
| Power rail motion | `.3s cubic-bezier(.23, 1, .32, 1)`, tick transform `.12s`, thumb `0s` on the first frame and `.3s` after 16ms | same values (`--codex-mp-*`) |
| Picker popover | width `calc(var(--spacing) * 63.5)` = 254px; enter `.32s cubic-bezier(.23,1,.32,1) 30ms`, `opacity 0 / scale(.98)` → 1 | same; placement follows the host `place()`: right-aligned, 8px above, 12px viewport margin |
| Font stacks | — (the host `dsh-client-ui-theme` base_css_default) | declared verbatim once in `skin.css`, so the look does not drift with the host version |

Deliberate differences:

- The dark base moved to the app default in 0.2.0: `jdi.dark.surface = #181818`, `jdi.dark.ink = #ffffff`, ramp
  `#212121 / #282828 / #303030` (the app's gray-800 / gray-750 / gray-700). The 0.1.x picker values
  `#111111 / #FCFCFC` are no longer used. For the record, the app CSS resolves the dark surface to `--gray-900`
  `#181818`; picker and CSS disagree, and the picker wins here.
- The composer card radius is 25px as measured on `assets/reference/codex-composer-reference.png`. The app CSS gives
  `--radius-3xl` (20px) for the multi-line composer and 22px for the single-line one; the gap is the screenshot's
  device scale factor, which is not recorded.
- The sidebar is 280px wide, set by the host layout. Codex clamps its own sidebar with
  `clamp(240px, 275px, min(520px, calc(100vw - 320px)))`.
- Dark link text keeps `#0169cc`, which the app uses for `--color-token-text-link-foreground`; dragging the accent
  control on the settings page is now the way to get `#339CFF` there. The app's own `--color-text-accent` is
  `#99ceff` (`--blue-100`) in dark.
- The contrast slider is a documented simplification (see "Settings page"), not the app's `Rdi + zdi·contrast` blend.
- For the record, the app's full gray ramp is
  `#0d0d0d / #181818 / #212121 / #282828 / #303030 / #414141 / #4f4f4f / #5d5d5d / #afafaf / #ededed / #f3f3f3 / #f9f9f9 / #fff`.

## CI

`.github/workflows/ci.yml` runs `scripts/check.mjs` (which includes the artifact sync check) on Ubuntu and Windows,
Node 22 and 24. Fixtures and live checks need a host and Chromium, so they stay local.

## License

MIT.