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

## Known issues

- **QR code is disabled**: a more scalable design (compact JSON drawing data, base64-encoded in a URL query string, with an auto-load-and-download listener for `?data=` on page load) was explored to work around the capacity problem, but was never finished/merged — the shipped `script.js` still encodes the raw PNG directly, which fails for anything but near-blank drawings. As a result, the `Mostra QR code` button is commented out in `index.html`. See the "QR code (currently disabled)" section in [ARCHITECTURE.md](ARCHITECTURE.md) and the roadmap in [README.md](README.md).
- Palette/grid select defaults have drifted from the JS defaults before (e.g. the palette dropdown not matching `currentPalette`'s initial value) — worth double-checking after any change to either side.
- JSON import has only minimal validation (doesn't check for out-of-grid coordinates or malformed colors).
- No undo/redo.
