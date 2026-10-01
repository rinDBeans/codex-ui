# codex-ink

Codex / ChatGPT direction. These stylesheets are the sources for the codex-ui plugin: `scripts/build.mjs` reads the ten
CSS files here, scopes their selectors to `html[data-codex-ui]`, and writes `theme.css`, which is inlined into `client.js`;
see the repository README for installing (`dsh plugin add link:`). The same directory satisfies the Skin v2 manifest format and can be picked
up by a skin loader on its own.

## Files

| File | Layer | Content |
|---|---|---|
| `skin.json` | Manifest | id, accent, light and dark previews |
| `skin.css` | L1 tokens and L2 typography | `--dsw-alias-*` remapping; spacing, radius, type scale, motion and elevation token layers |
| `patches.css` | L3 components | Focus ring, links, card contract, mono pills, tag tone normalization, reduced motion, ⑫ host model menu (face A), ⑬ composer header and card, ⑯ right panel guide entries, ⑰ composer control hover |
| `model-picker.css` | L3 model picker component | Face B: the trigger, popover and reasoning power rail built by `src/client/model-picker/` (Codex `_Track` / `_Tick` / `_Thumb` geometry verbatim); paints only `.codex-mp-*` plus one seat-hiding rule, never the host menu. Verified by `scripts/verify.mjs model-picker` |
| `sidebar-align.css` | L3 sidebar alignment | New session and plugin rows land on the same two columns as the workspace list (icon column 20px, text column 42px); selectors cover both the rc.1 flat DOM and the rc.2 nested DOM |
| `overlays.css` | L3 overlays | Floating surfaces: menu material (the host's `blur(40px) saturate(150%)` is flattened to an opaque layer) and long-list overflow localized to `[data-trigger-menu]`. Verified by `scripts/verify.mjs text` |
| `content.css` | L3 conversation content | Tool rows, turn summary/detail, and the three-tier state ladder; state tokens reconciled against the host `ToolRowState` union. Verified by `scripts/verify.mjs content` |
| `sidebar-rows.css` | L3 sidebar rows | Maps existing host row states to visuals using host semantic attributes (`[data-row-key^="session:"]`, `[aria-selected="true"]`); separates the selected fill from the hover fill, which the host renders with the same token. Verified by `scripts/verify.mjs sidebar-rows` |
| `composer-queue.css` | L3 follow-up queue | Pulls the host's `data-queue-dock` panel into the composer card family: top corners follow `--dsw-radius-card`, and the 40px backdrop blur is dropped per the `overlays.css` precedent. Verified by `scripts/verify.mjs queue-dock` |
| `panels.css` | L3 right panel | Scroll areas follow the skin's scrollbar convention via `::-webkit-scrollbar` with the same tokens as `overlays.css`; no descendant universal selectors. Verified by `scripts/verify.mjs panels` |
| `appearance.css` | L3 appearance and font size | Two host rows the skin's palette did not reach: the selected appearance cube and the font-size stepper radius. Reuses the host's own `FontSizeRow` store and `AppearanceRow`; adds no config field. Verified by `scripts/verify.mjs appearance` |
| `sidebar-surface.css` | L3 sidebar surface | Sidebar scroll fade: the host's 24px overlay steps aside for Codex's 40px four-stop mask ramp, applied to the scroller with the rightmost 12px left unmasked for the scrollbar. Verified by `scripts/verify.mjs sidebar` |
| `window-shadow.css` | L3 window edges | Conversation window 0.5px hairline plus a 24px ambient shadow; right panel keeps a hairline on its left edge only and bleeds upward; right divider handle hover gradient |
| `composer.css` | L3 composer | Card geometry and surface, 44px editor area, 28px bottom control row, suggestion menu, hero layout. This layer is allowed to use `[class*=…]` suffix anchors |
| `settings.css` | L3 settings | Layout of the configuration card on the plugin manager bundle page (`.cx-*`) |
| `settings-modal.css` | L3 settings modal | The ㉑ full-page Codex pass over the settings dialog: grouped sidebar, search box, page header, white cards with hairlines, sticky save bars. Hiding is driven by a durable `data-*` attribute, so it survives the host rewriting `className`. Structure comes from `src/client/settings-modal.js` |
| `trajectory-exit.css` | L3 trajectory exit | The ⑬d "← Chat" pill: floats at the lower-left of the view area while the Trajectory view is showing, giving that view an exit once ⑬ hides the tab strip. Structure comes from `src/client/trajectory-exit.js` |
| `preview/` | Assets | Light and dark previews |

## Design rules

1. Chrome stays ink: buttons and selection are ink; the light theme primary button is white on ink, dark inverts. The only exception is the accent: links (light `#339CFF` / dark `#0169CC`), the focus ring (Codex `--color-border-focus`, `#339CFF`, dark at 70%) and the filled part of the power rail.
2. Greys carry hierarchy. Light `#FFFFFF → #F1F1EF → #E5E5E5`; dark `#111111 → #181818 → #212121 → #282828` (window background `#111111`, **surface** `#181818`; the composer card sits on the surface and the 0.5px hairline separates them). The sidebar is a separate chain: `#F6F6F6` light / `#0F0F0F` dark, one step below the content in both.
3. Light sidebar `#F6F6F6` = Codex's `--color-surface-tertiary` (`#F3F3F3`) at 70% over white (Codex has no sidebar token; the panel is a translucent scrim), active row `#E9E9E9`, hover `#F0F0F0`.
4. Metadata (token counts, model names, timestamps, badges, paths, shortcuts) uses `--ds-font-family-code`, 11px and `.04em`/`.08em` tracking; `:lang(zh)` exempts Chinese from tracking and uppercase.
5. Radius and spacing come from `--dsw-radius-*` and `--dsw-space-*`. Cards use a 0.5px stroke instead of a shadow.
6. Motion runs at 150 / 200 / 300ms with `cubic-bezier(.4, 0, .2, 1)`, taken from the Codex app `--transition-duration-*` and `--default-transition-timing-function`; `prefers-reduced-motion` jumps to the end state.
7. Color whitelist: the three state colors, diff red and green, badge fills (state color at 8% to 16% opacity), and the accent itself (links, focus ring, power rail). The six task-board tag tones collapse onto the state colors plus ink and grey.

## Token contract for third-party plugins

1. Colors only from `var(--dsw-alias-*)`, no literal hex.
2. Radius and spacing only from `var(--dsw-radius-*)` and `var(--dsw-space-*)`.
3. Hover raises the background one step; no custom shadows.
4. No color outside the whitelist.
5. Metadata uses `var(--dsw-font-meta)` with `--dsw-meta-size` and `--dsw-meta-tracking`.

## Verification

```bash
node scripts/check.mjs
```

The checks that concern this directory: the `skin.json` structure, 36 measured WCAG contrast pairs, and the color whitelist in `patches.css`.
Current result: 36/36 pass, 19 AAA pairs, zero colors outside the whitelist.

## Install

```powershell
dsh plugin --profile web add link:<absolute repo path>   # plugin path, the primary route
node scripts/install-skin.mjs --write                    # skin loader path: sync to $DSH_HOME/skins/codex-ink
```

## Not covered

- Shiki syntax highlighting is not desaturated here; the highlighter emits its own colors inline. This layer only constrains block backgrounds through `--dsw-alias-markdown-code-block` and friends.
- `patches.css` passes the loader safety pipeline and gets scoped correctly, but has never been applied on its own in a live GUI; applying it rewrites the skin selection.
