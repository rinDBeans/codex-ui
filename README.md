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
the full 0.6.0 verification ran on the npm release `@deepseek-ai/dsh@0.1.7-rc.2` (a real `dsh web` instance plus an asar packed from it, see "Host paths").
The verification scripts read shipped CSS straight out of `app.asar`; a host upgrade that changes structure fails their assertions.

## Features

| Id | Content |
|---|---|
| ⑳ | **Model picker, face B** (on by default): a component of our own takes over the composer model seat — model list (grouped by provider, with descriptions) plus the Codex reasoning **power rail** (24px track / 4px ticks / 28px white thumb, real drag, ←/→/Home/End, levels from the data); during the round trip it shows the new level optimistically with a spinner and never clears the list; the trigger cross-fades the effort label with blur. Can be switched off in settings |
| ⑫ | Model picker, face A (the host menu when ⑳ is off): opaque white menu (18px radius), 28px rows with 13px radius (concentric: 18 − 5px inset), permanent check column, pending spinner |
| ⑬ | Composer header turned blank, panel buttons keep the official icons |
| ⑬c | Both header slots **released**: entries registered there render again (subagent descendant count / job roster / preset badge / open-in-app); the view tabs stay hidden. The entries are conditionally rendered, so the top bar is unchanged in the common case |
| ⑭ | Composer card: radius (card 20/25, top strip = the card's own radius), shadow, geometry, tool row, hero layout |
| ⑯ | Right panel guide entries: no border, no fill, 52px rows, 20px icons, filled shortcut pills |
| ⑰ | Composer bottom controls: add button has no box until hover; model and permission controls share the hover chip and, like the add button, are **fully rounded** (Codex reference measures R = h/2) |
| ② | Sidebar colors match the Codex light sidebar; sidebar rows align with the workspace list |
| ②c | Conversation window edge: 0.5px hairline plus a 24px ambient shadow |
| ②d | Right panel: hairline only on its left edge, shadow bleeds upward only; the dockkit 1px border is removed |
| ②e | Right divider handle: center-darkest gradient on hover |
| ⑱ | Settings card on the plugin manager's codex-ui bundle page: theme / accent / background / foreground / UI font / code font / translucent sidebar / Codex model picker / contrast |

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

```powershell
npm run install:web        # node scripts/install-plugin.mjs --write
npm run install:desktop    # desktop shell; restart the app afterwards
npm run build              # regenerate theme.css and client.js from skins/codex-ink

node scripts/install-plugin.mjs                              # dry run (web profile by default)
node scripts/install-plugin.mjs --bundle --write              # register through dsh.profile.bundles and drop the redundant insert
node scripts/build.mjs --check                               # report stale artifacts without writing
```

The installer scopes the eight stylesheets in `skins/codex-ink/` to `html[data-codex-ui]`, combines them with
`src/client.template.js` (which inlines `src/override.js`, `src/model-picker.js` and `src/settings-card.js`) into `client.js`, copies the
result to `profiles/<name>/vendor/codex-ui`, creates the `node_modules/codex-ui` junction, and keeps exactly one
registration path.

Never use both registration paths at once — two rows share the id and the market check disables the plugin:

| Path | How | Used by |
|---|---|---|
| bundle | the package name goes into the profile `package.json` `dsh.profile.bundles`; the package's own `cordis.patch.yml` inserts the entry | the desktop shell profile and the web profile (`--bundle`) |
| insert | a hand-written `- insert:` in the profile `cordis.patch.yml` | throwaway verification profiles that skip pnpm install |

The same stylesheets can be picked up by a skin loader:

```powershell
node scripts/install-skin.mjs          # per-file SHA256 check against $DSH_HOME/skins/codex-ink
node scripts/install-skin.mjs --write  # overwrite on drift
```

## Layout

| Path | Content |
|---|---|
| `index.js` `cordis.patch.yml` `package.json` | Host half and manifest |
| `src/client.template.js` | Browser half template (stylesheet, override layer, settings seat) |
| `src/override.js` | Override-layer pure functions (no DOM; unit-tested by the repo checks) |
| `src/settings-card.js` | The config card on the bundle page (inlined into `client.js` at build time) |
| `src/model-picker.js` | Model picker face B: seat takeover, popover, power rail (its pure functions are unit-tested by `check-repo`) |
| `src/build.mjs` | Scoping and artifact generation; the only implementation |
| `theme.css` `client.js` | Generated from `skins/codex-ink/` by `src/build.mjs` |
| `skins/codex-ink/` | Stylesheet sources (skin.css / patches.css / model-picker.css / sidebar-align.css / sidebar-surface.css / window-shadow.css / composer.css / settings.css) |
| `docs/` | Plans and decisions |
| `scripts/build.mjs` | Regenerate the artifacts; `--check` compares without writing |
| `scripts/check-repo.mjs` | Host-free repository checks; the CI entry point |
| `scripts/host-paths.mjs` | Resolves `app.asar`, the global `@deepseek-ai` modules and Chromium |
| `scripts/pack-host-asar.mjs` | Without a desktop shell, packs npm-installed host packages into an `app.asar` the fixtures can read |
| `scripts/install-plugin.mjs` `scripts/install-skin.mjs` | Installers |
| `scripts/*-verify.mjs` `scripts/live-gui-probe.mjs` `scripts/settings-page-verify.mjs` | Fixture verification and live probing |
| `scripts/make-verify-profile.mjs` | Builds a throwaway verification profile: plugin manager enabled, only this plugin, no existing profile touched |
| `assets/reference/` | Codex reference images |
| `assets/screenshots/` | Verification output |
| `.github/workflows/ci.yml` | CI |

## Verification

| Command | Coverage | Requirement |
|---|---|---|
| `npm run check` | Syntax, JSON, manifest, artifact sync, encoding, docs pairing, machine-specific paths | none |
| `node scripts/audit-codex-ink.mjs` | Skin structure, 36 WCAG pairs, color whitelist | none |
| `node scripts/model-picker-verify.mjs` | ⑫ (face A, the host menu) and the pending indicator, 20 assertions | none |
| `node scripts/power-rail-verify.mjs` | ⑳ face B: seat takeover and hand-back, trigger and popover geometry, Codex power rail geometry verbatim, no commit while dragging / one snapped commit on release, no snap-back and no list reset during a slow (600ms) round trip with a spinner, the four keys, focus ring, Escape, model change carrying its default effort, failure notice, reduced motion, dark, the switch — 47 assertions | none (Chromium only) |
| `node scripts/rightbar-verify.mjs` | Shadow layer, right panel, both dividers, 42 assertions | none |
| `node scripts/sidebar-align-verify.mjs` | Sidebar column alignment, 6 assertions | none |
| `node scripts/sidebar-surface-verify.mjs` | Sidebar scroll fade (the Codex mask ramp): mechanism plus pixels, four states side by side, 13 assertions | none |
| `node scripts/hero-verify.mjs` | ⑬ ⑭ ⑰, the focus ring and the released header slots, 25 assertions | none |
| `node scripts/composer-shadow-verify.mjs` | ⑱ Composer shadow aligned to Codex's `--elevation-composer`: per-layer geometry and alpha in light, the dark inset with zero outside shadow, the narrow-viewport 80→40px branch, plus rendered pixels (falloff radius, inside top edge) and one precondition self-check — 23 assertions | none |
| `node scripts/elevation-verify.mjs` | ⑲ The `--dsw-elevation-*` tokens against Codex's source: per-layer geometry and alpha, layer 1 tracking the stroke, layers 2–3 identical across themes (Codex declares no dark variant), and a rendered menu panel — 19 assertions | none |
| `node scripts/live-gui-probe.mjs --url <token URL>` | Real GUI: 7 assertions on shadows and both dividers, plus the model seat — 7 on face B when it is on (takeover, geometry, a keyboard change written into the host store and reverted), or 3 on the face A pending window when it is off (`--latency` adds 800ms to that round trip by default; locally it takes <60ms and the window cannot be sampled) | a running `dsh web` |
| `node scripts/settings-page-verify.mjs --url <token URL>` | Real GUI: the card on the bundle page, its 9 rows, no override at defaults, switch and accent writes, the host seat coming back when the model picker is off, survival across a reload — 29 assertions | a running `dsh web` with the plugin manager enabled |
| `node scripts/theme-flash-probe.mjs --url <token URL>` | Per-frame sampling of the effective backdrop during theme and page switches (first opaque ancestor background); reports frames belonging to neither end of the transition (measured: 9 windows, ~720 frames, 0 anomalies) | same as above |

`npm run check` needs no host. The fixture suites run locally: they need shipped CSS from `app.asar` plus a DOM
rebuilt from the render code, read with `getComputedStyle`. Fixtures have no title bar, no real AppFrame grid and no
real RPC, so the shadow layer, divider hover and pending feedback are verified by the live probe.

### Host paths

The verification scripts read the host they run against. Each path is resolved in this order:

1. `DSH_ASAR`, `DSH_GLOBAL_MODULES`, `DSH_CHROME`;
2. `scripts/host.local.json`, a gitignored per-machine file, for example `{ "asar": "D:/.../resources/app.asar" }`;
3. a scan of the standard install locations, Playwright's browser cache and `npm root -g`.

No machine-specific path is committed (`npm run check` scans JS, stylesheets and docs, including the JSON-escaped form inside `client.js`).

Without a desktop shell, pack the same packages from npm:

```powershell
npm install @deepseek-ai/dsh@0.1.7-rc.2 --prefix <tmp>
node scripts/pack-host-asar.mjs --from <tmp>/node_modules --out <tmp>/app.asar
$env:DSH_ASAR = "<tmp>/app.asar"; $env:DSH_GLOBAL_MODULES = "<tmp>/node_modules"
$env:DSH_CHROME = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"   # system Edge when Playwright is not installed
```

The same npm package can also boot a real instance: `$env:DSH_HOME = "<tmp>/home"; node <tmp>/node_modules/@deepseek-ai/dsh/lib/bin.js web --port 3098 --no-open`
(the first run creates the web profile; then run `install-plugin.mjs --profile web --write`).

```powershell
dsh --profile web --port 3099 --no-open      # prints a token URL
node scripts/live-gui-probe.mjs --url "http://127.0.0.1:3099/?token=..." --dpr 1.5
```

The probe opens a new conversation before timing the pending window, and exits non-zero if an assertion fails.
The token expires; after about half an hour requests return 401 and a restart is needed.

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

Source: point samples from `assets/reference/codex-sidebar-reference.png`.

| Token | Value |
|---|---|
| `--dsw-alias-bg-sidebar` | `#eef4f9` |
| `--dsw-specific-sidebar-fill` | `#eef4f9` |
| `--dsw-specific-sidebar-nav-item-active` | `#e2e9ed` |
| `--dsw-specific-sidebar-nav-item-hover` | `#e8eef3` |

## Limits

- The two header slots have been released since 0.3.0 (⑬·3c), so the **top bar can carry more entries than the
  reference screenshot shows**: they only appear when the session really has subagents / background jobs / a preset /
  a working directory — and that is also the only visible surface for "a subagent is running". The trade-off is
  recorded in the changelog.
- Fixture checks are not signed-in screenshots. The `dsh web` launch token has a lifetime and lives in process memory only.
- In headless mode only the foreground tab handles `:hover`, so multi-page fixtures open the web-shape page last.
- Face B of the model seat (⑳) **registers no slot**: the host still renders `conversation.input.model`; the component
  appends its own trigger to the same seat and hides the host's child with one direct-child `:has()`; data and commits go
  through the host's `ctx.modelDirectories` only. The three advanced states of the Codex power rail — the highlight when
  Fast is off, the Fast-mode tick fly-out, and the purple/blue gradient beyond the maximum level — are not built: DSH has
  no Fast mode and no "beyond maximum" state. The purple Max label on the trigger (`--color-chart-purple`) is skipped too:
  it is outside the color whitelist.
- ⑯ keeps the host tab strip: hiding it also removes the fullscreen and collapse buttons.
- The session row text column is 40px, 2px shorter than the workspace, new session and plugin rows, because the shipped
  `Rows.module.css` gives `.sessionRow .title` its own margin. Left as is.
- `composer.css`, `patches.css` and `sidebar-surface.css` use hash-class suffix anchors (`[class$=…]`, `[class*=…]`) where the host
  exposes no `data-*`; `node scripts/build.mjs` reports the counts on every run (0.6.0: composer 18 · patches 12 ·
  sidebar-surface 2, comment mentions included). `model-picker.css` has none.

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

`.github/workflows/ci.yml` runs `scripts/check-repo.mjs` and `scripts/build.mjs --check` on Ubuntu and Windows,
Node 22 and 24. The fixture suites and the live probe need the desktop shell and Chromium, so they stay local.

## License

MIT.