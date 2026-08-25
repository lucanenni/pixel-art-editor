# Changelog

History of the pixel art editor's features, in chronological order.

## v1.0 - First version

- Basic editor with a fixed 32x32 grid
- Procedurally generated 256-color palette (grays + RGB combinations)
- Drawing via click and drag
- "Clear all" and "Download image" (PNG) buttons

## v1.1 - Selectable grid size

- Added a select to choose the grid size: 8x8, 12x12, 16x16, 24x24, 32x32
- Changing the size clears the current drawing

## v1.2 - Selectable palettes (first version)

- Added a select to choose between 3 palettes: custom, web-safe (216 colors), standard VGA (256 colors)
- **Bug fix**: changing palette used to accumulate colors instead of replacing them (missing `#colorPalette` clearing before regenerating swatches)

## v1.3 - Historical PC palettes

- Replaced the previous palettes with ones inspired by historical graphics cards:
  - CGA (16 colors)
  - EGA (64 colors)
  - VGA (256 colors, default)
- Page title changed to "Pixel art editor"

## v1.4 - Layout reorganization

- Several layout passes to:
  - avoid vertical scrolling (everything visible on one screen)
  - align the "Clear all" / "Download image" buttons horizontally
  - widen containers (palette and gray boxes) to avoid swatch overflow

## v1.5 - File separation

- Code split into three separate files: `index.html`, `style.css`, `script.js` (previously a single HTML file)

## v1.6 - Eyedropper, QR code, JSON import/export

- **Eyedropper**: checkbox to enable picking a color from an already-drawn pixel
- **Export/Import JSON**: save and reload the full drawing (grid, palette, pixels) in a readable JSON structure
- **QR code**: generation of a shareable QR code
  - first attempt: encode the PNG image directly (as base64) into the QR code → **failed**, QR codes don't have enough capacity for an image
- **Bug fix**: `Cannot set properties of null (setting 'innerHTML')` — the `#qrModal` / `#qrcode` modal markup was missing from the HTML
- **Bug fix**: `Cannot read properties of undefined` — caused by trying to generate an oversized QR code with the base64 image
- **Bug fix**: reference to `#qrMessage`, never created in the markup, caused an error when writing the result message; the corresponding `div` and its reference lookup were added

## v1.7 - Working QR code sharing

- Reworked `showQRCode()` to encode compact drawing data (`{ g: gridSize, p: palette, d: pixels }`, base64-encoded) into a URL query string instead of the raw PNG, fixing the capacity problem from v1.6
- Added `loadSharedDrawingFromURL()`: on page load, if a `?data=` parameter is present, the drawing is restored and automatically downloaded as a PNG, then the URL is cleaned up (`history.replaceState`) to avoid repeated downloads on refresh
- Added a fallback for drawings whose encoded URL exceeds ~2000 characters (the practical capacity/reliability limit for scanning): a metadata-only QR code is shown, with a message suggesting a smaller grid or `Esporta JSON` instead
- Re-enabled the `Mostra QR code` button, previously commented out in `index.html` because the v1.6 implementation didn't reliably work
- **Bug fix**: the palette `<select>` had "CGA" marked as the selected `<option>`, while `script.js` initializes `currentPalette` to `"vga"` — the palette actually rendered on load (VGA, 256 colors) didn't match what the dropdown displayed. The default option was corrected to VGA, matching both the JS default and the original v1.3 intent.

## v1.1.0 - Undo/redo, hardened JSON import validation

- **Undo/redo**: new "Annulla"/"Ripeti" buttons plus Ctrl+Z / Ctrl+Y (or Ctrl+Shift+Z) keyboard shortcuts
  - a full history entry is saved once per drawing action — one per drag stroke (not per pixel), one for "Cancella tutto", one for a same-size JSON import — up to the last 50 actions
  - history is tied to the current grid size: changing the grid, or importing a drawing with a different `gridSize`, clears undo/redo (old snapshots' coordinates wouldn't make sense against a different grid)
  - buttons are disabled automatically when there's nothing to undo/redo
- `importDrawing()` now validates `gridSize` against the app's supported sizes (8/12/16/24/32) and `palette` against the supported palettes before applying them, instead of trusting the file blindly — an out-of-range `gridSize` (e.g. from a corrupted or hand-edited file) could previously make the app try to render a huge grid and hang the tab
- Each `pixels` entry is now validated individually: the key must be a well-formed `"x,y"` pair inside the grid, and the value must be a `rgb(r,g,b)` string with components ≤ 255; anything else (malformed coordinates, out-of-grid pixels, non-color strings) is silently dropped instead of being drawn or crashing the import
- The import success message now reports how many pixels were skipped, if any

## v1.2.0 - Fix unreachable eyedropper, add bucket fill

- **Bug fix**: the eyedropper was fully implemented in `script.js` (and documented) since v1.6, but its toggle control was never actually in `index.html` — there was no way to turn it on from the UI. Replaced the missing checkbox with a `#toolSelect` dropdown ("Pennello" / "Contagocce"), matching the existing grid-size/palette select pattern, and wired it to the existing eyedropper logic (now driven by a `currentTool` variable instead of a boolean flag). Removed the now-unused `.tool-option` checkbox CSS that had been sitting dead in `style.css`.
- **Bucket fill**: new "Secchiello" option in the tool selector. Flood-fills the contiguous, same-colored area under the click (including the undrawn background) with the selected color. One click = one undo step; clicking an area that's already the target color is a no-op and doesn't waste an undo entry.
- **Touch support**: drawing (brush, eyedropper, bucket, undo/redo history) now works on touchscreens, not just with a mouse — `touchstart`/`touchmove`/`touchend`/`touchcancel` mirror the existing mouse handlers, and `touch-action: none` plus `preventDefault()` stop the page from scrolling/zooming while drawing.
- **Autosave**: the drawing (grid, palette, pixels) is now saved to `localStorage` after every action and restored automatically on next visit — reworked the previous "no persistence, deliberate limitation" note, since that constraint no longer applies. Opening a shared QR code link still takes priority over the autosave. Silently no-ops if `localStorage` isn't available (private browsing, quota, etc.) instead of breaking the app.
- **Hardening**: the QR-code loader (`loadSharedDrawingFromURL()`) previously trusted the `?data=` URL parameter completely, unlike the JSON import which already validated its input (see v1.1.0) — a hand-crafted link could have injected an oversized grid or malformed pixel data the same way a hand-edited import file could. Extracted the JSON import's pixel-filtering logic into a shared `filterValidPixels()` helper, now reused by the QR loader and the new autosave restore, so all three untrusted-data entry points get the same validation.
- **XML import/export**: new "Esporta XML"/"Importa XML" buttons alongside the JSON ones, same underlying data (grid size, palette, pixels) in an XML shape. Import parses with `DOMParser` (rejecting malformed XML via its `parsererror` node) and applies the exact same `filterValidPixels()` validation as JSON/QR/autosave — no separate, weaker code path for the new format. Also extracted the shared "apply a validated drawing" logic (grid/palette/canvas/undo/autosave) out of `importDrawing()` into `applyImportedDrawing()`, reused by both import formats.
- **Automated tests + CI**: extracted every pure, DOM-free function (`isValidRGBColor`, `filterValidPixels`, the three palette generators, `escapeXMLAttribute`, plus `VALID_GRID_SIZES`/`VALID_PALETTES`/`RGB_COLOR_PATTERN`) out of `script.js` into a new `logic.js`, loaded before `script.js` in `index.html` so nothing changes for the browser. `logic.js` is also `require()`-able from Node, so `test/logic.test.js` (17 tests) can exercise it with Node's built-in `node:test` runner — no dependencies to install, run with `npm test`. A GitHub Actions workflow (`.github/workflows/test.yml`) runs the suite on every push/PR. `script.js` itself still isn't unit-testable (it touches the DOM at module scope) and continues to be verified manually.
- Added `docs/demo-heart.png` and embedded it in the README for a visual preview of the app.

## v1.2.1 - Default color format bug, palette duplicates, code cleanup

Found via an external code review of the v1.2.0 state ([ANALYSIS.md](https://github.com/lucanenni/pixel-art-editor) shared by the maintainer); findings were independently re-verified against the actual code before fixing.

- **Bug fix**: `currentColor` was initialized as `"#000000"` (hex), while `isValidRGBColor()`/`filterValidPixels()` only accept the `"rgb(r,g,b)"` format used everywhere else. Anyone who drew before ever touching the palette painted with an invalid-format color: it displayed and exported fine, but was **silently dropped** by the same validation logic on the very next autosave reload, QR share, or JSON/XML re-import — since nothing ever flagged the mismatch, it looked like data loss with no visible cause. Fixed by initializing `currentColor` to `"rgb(0,0,0)"` instead.
- **Bug fix**: `generateVGAColors()` (`logic.js`) claimed 256 colors but only produced 238 *distinct* ones — the CGA, grayscale, and web-safe families overlap (black alone appeared 11 times), and the original "pad remaining slots with black" fallback made it worse rather than better. Rewrote it to skip colors already seen and top up any shortfall with an additional, non-overlapping RGB grid, so it always returns exactly 256 distinct colors. Added a test (`generateVGAColors contiene 256 colori tutti distinti`) asserting this, since none of the existing tests caught it.
- **Cleanup**: extracted a shared `renderPixels(pixelsObj)` helper (clears the canvas, redraws every entry) and pointed `restorePixels()`, `loadAutosavedState()`, `applyImportedDrawing()`, and `loadSharedDrawingFromURL()` at it, replacing four copies of the same loop.
- **Hardening**: added Subresource Integrity (`integrity`/`crossorigin`) to the `qrcodejs` CDN `<script>` tag in `index.html`, so a compromised or tampered CDN response would fail to execute instead of running silently. The hash was computed locally and cross-checked byte-for-byte against cdnjs's own published SRI metadata for that exact file/version before being pinned.

## Known issues

- QR code capacity is still limited: drawings with many colored pixels (especially on large grids) can exceed the ~2000-character threshold and fall back to the metadata-only QR code, which does not itself carry the drawing. This is inherent to QR codes and not fixable client-side.
