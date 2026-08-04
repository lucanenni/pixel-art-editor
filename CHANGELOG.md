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

## Known issues

- QR code capacity is still limited: drawings with many colored pixels (especially on large grids) can exceed the ~2000-character threshold and fall back to the metadata-only QR code, which does not itself carry the drawing.
- JSON import has only minimal validation (doesn't check for out-of-grid coordinates or malformed colors).
- No undo/redo.
