# Pixel Art Editor

A small, dependency-free pixel art editor that runs entirely in the browser. Draw on a resizable grid using color palettes inspired by classic PC graphics cards (CGA/EGA/VGA), then export your drawing as a PNG image or a re-importable JSON file.

Built as a teaching tool for vocational school students (graphic design and IT tracks) — the code is intentionally kept simple, vanilla JavaScript, and easy to read.

> Vibe-coded with Claude, with some manual tweaks on top.

## Features

- **Resizable drawing grid** — 8×8, 12×12, 16×16, 24×24, or 32×32 cells, rendered on a fixed 512×512 canvas
- **Retro color palettes**, generated procedurally:
  - **CGA** — 16 colors
  - **EGA** — 64 colors (4 levels per RGB channel)
  - **VGA** — 256 colors (16 CGA + 16 grayscale + 216 web-safe colors); loaded by default
- **Freehand drawing** — click or click-and-drag across the canvas
- **Eyedropper** — pick a color straight from an already-drawn pixel
- **Export**
  - as a **PNG** image (`Scarica immagine`)
  - as a **JSON** file describing the full drawing state (`Esporta JSON`), so it can be reloaded later
- **Import** a previously exported JSON drawing (`Importa JSON`)
- **QR code sharing** (`Mostra QR code`) — generates a QR code encoding the drawing itself; scanning it reopens the app with the drawing restored and automatically downloads it as a PNG
- **Clear canvas** (`Cancella tutto`)

## Getting started

No build step and no dependencies to install — it's plain HTML/CSS/JS. The only external dependency is the [qrcodejs](https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js) library, loaded from a CDN.

Simplest option — just open the file in a browser:

```bash
open index.html
```

Or serve it locally (recommended, avoids browser restrictions on `file://` in some setups):

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Usage

1. Pick a **grid size** and a **color palette** from the dropdowns — changing either one clears the current drawing (no automatic resize/conversion of existing pixels).
2. Click a color swatch in the palette to select it, then click or drag on the canvas to draw.
3. Enable **eyedropper mode** to pick up a color from a pixel you've already drawn instead of painting.
4. Use **Scarica immagine** to download a PNG snapshot of the canvas (grid lines included), or **Esporta JSON** to save the drawing data for later editing.
5. Use **Importa JSON** to reload a drawing previously exported from this app.
6. Use **Mostra QR code** to generate a QR code for the current drawing — scanning it (or opening the underlying URL) reopens the app with the drawing restored and downloads it as a PNG automatically. Very large/detailed drawings may exceed the data capacity of a QR code; in that case a metadata-only code is shown instead, with a message suggesting a smaller grid or `Esporta JSON`.
7. **Cancella tutto** wipes the canvas back to blank.

### JSON export format

```json
{
  "version": "1.0",
  "gridSize": 32,
  "palette": "vga",
  "pixels": { "3,4": "rgb(255,0,0)", "5,5": "rgb(0,0,0)" },
  "timestamp": "2026-08-04T10:00:00.000Z"
}
```

`pixels` maps each painted cell (`"x,y"`) to its CSS color string. Import only checks that `pixels` and `gridSize` are present — coordinates outside the grid or malformed colors aren't validated further.

## Project structure

```
.
├── index.html        # page markup: canvas, controls, QR modal
├── style.css         # styling and responsive layout
├── script.js         # app logic: drawing, palettes, export/import, QR code
├── ARCHITECTURE.md   # technical deep-dive for maintainers
├── CHANGELOG.md      # feature history
└── LICENSE
```

> For implementation details see [ARCHITECTURE.md](ARCHITECTURE.md); for version history see [CHANGELOG.md](CHANGELOG.md).

## Technical notes

- `pixels` (an object keyed `"x,y"` → CSS color string) is the single source of truth for the drawing; the canvas is just its visual rendering. Anything that needs to restore a drawing (import, future features) should redraw from `pixels`, following the pattern already used in `importDrawing`.
- The canvas has a fixed 512×512px size; `pixelSize` (the on-screen size of one grid cell) is recalculated as `canvas.width / gridSize` whenever the grid size changes.
- Adding a new palette only requires a new `generateXColors()` function, a `case` in `generateColors()`'s switch, and a new `<option>` in `#paletteSelect`. Adding a new grid size only requires a new `<option>` in `#gridSizeSelect` — no other code changes needed.
- No `localStorage`/`sessionStorage` is used (a deliberate limitation of the environment the project was originally prototyped in); worth revisiting if the project moves elsewhere.

## Known limitations

- **QR code sharing** encodes the drawing's data (grid size, palette, pixels) in the URL, not the image itself — very large or highly detailed drawings can still exceed a QR code's data capacity, in which case a metadata-only code is generated (see above).
- No undo/redo.
- Import validation is minimal (see above).

## Possible future improvements

- Undo/redo
- Bucket fill
- Auto-save via `localStorage`/`sessionStorage`
- XML import/export alongside JSON

## License

[MIT](LICENSE) © lucanenni
