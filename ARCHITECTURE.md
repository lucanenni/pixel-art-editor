# Architecture

Technical reference for maintaining `script.js`. Describes global state, main functions, and data flow. See [README.md](README.md) for a user-facing overview and [CHANGELOG.md](CHANGELOG.md) for history.

## Global state

Defined at the top of `script.js`:

| Variable | Type | Description |
|---|---|---|
| `canvas`, `ctx` | DOM/Context2D | reference to `<canvas id="pixelCanvas">` |
| `gridSize` | number | grid side length in cells (8/12/16/24/32) |
| `pixelSize` | number | on-screen side of one cell = `canvas.width / gridSize`, recalculated on every grid change |
| `currentColor` | string | currently selected CSS color (e.g. `rgb(255,0,0)`) |
| `isDrawing` | boolean | true while the mouse is held down, for drag-drawing |
| `pixels` | object | map `"x,y" -> color` of every drawn pixel |
| `currentPalette` | string | `'cga'` \| `'ega'` \| `'vga'` — starts as `'vga'` |
| `eyedropperMode` | boolean | true while eyedropper mode is active |

**Note**: `pixels` is the source of truth for the drawing. The canvas is only its visual representation; redrawing from `pixels` (see `importDrawing`) is the correct way to restore a state.

## Color palettes

Three generator functions, each returning an array of `rgb(r,g,b)` strings:

- `generateCGAColors()` — 16 hardcoded colors (the historical IBM CGA palette)
- `generateEGAColors()` — 64 colors, combining 4 levels (0, 85, 170, 255) across R/G/B
- `generateVGAColors()` — 256 colors: 16 CGA colors + 16 grays + 216 colors (6 levels per channel, 6³ = 216), truncated/padded to 256

`generateColors()` dispatches based on `currentPalette`.

`initColorPalette()`:
1. clears `#colorPalette` (`innerHTML = ''`) — **essential**, without this colors pile up on every palette change
2. calls `generateColors()`
3. creates one `div.color-swatch` per color with `onclick = () => selectColor(color)`

## Drawing on the grid

- `drawGrid()` — draws the grid lines on the canvas (called by `clearCanvas`)
- `getPixelCoords(e)` — converts mouse (client) coordinates into grid cell coordinates, accounting for the scaling between the canvas' CSS size and its real size (`scaleX`/`scaleY`)
- `drawPixel(x, y, color)` — draws the colored rectangle (with a 1px margin so the grid underneath stays visible) and updates `pixels[x,y]`
- `handleDraw(e)` — single handler for `mousedown`/`mousemove`/`click`:
  - if `eyedropperMode` is active: reads the color from `pixels`, sets it as `currentColor`, and turns the mode off
  - otherwise: draws normally (only while `isDrawing`, or on a `click` event)

Events registered on the canvas: `mousedown` (sets `isDrawing = true` and draws), `mousemove`, `mouseup`/`mouseleave` (`isDrawing = false`), `click` (for a single tap/click without dragging).

## Grid size / palette changes

- `changeGridSize()` — reads the value from the select, recalculates `pixelSize`, calls `clearCanvas()` (⚠️ the current drawing is lost, there is no conversion)
- `changePalette()` — reads the value from the select, calls `initColorPalette()` (the current drawing is **not** touched, only the available palette)

## Eyedropper

- `#eyedropperMode` checkbox with `onchange="toggleEyedropper()"`
- `toggleEyedropper()` updates the flag and the canvas cursor (`pointer` vs `crosshair`)
- Color reading happens inside `handleDraw()` rather than a separate handler, to reuse the same coordinate-conversion logic

## Image export

`downloadImage()` — uses `canvas.toDataURL()` and simulates a click on an `<a download>`. Exports exactly what is drawn on the canvas, grid included (the gray grid lines are part of the exported image).

## JSON export / import

**Full export** format (`exportDrawing()`, "Esporta JSON" button):

```json
{
  "version": "1.0",
  "gridSize": 32,
  "palette": "vga",
  "pixels": { "3,4": "rgb(255,0,0)", "5,5": "rgb(0,0,0)" },
  "timestamp": "2026-08-04T10:00:00.000Z"
}
```

`importDrawing(event)`:
1. reads the file with `FileReader`
2. validates that `pixels` and `gridSize` are present
3. validates `gridSize` against `VALID_GRID_SIZES` and, if present, `palette` against `VALID_PALETTES` — rejects the import with an `alert` otherwise (this guards against e.g. a corrupted/hand-edited file with a huge `gridSize` hanging the tab while rendering the grid)
4. filters `pixels`: keeps only entries whose key matches `"x,y"` inside `[0, gridSize)` and whose value matches `RGB_COLOR_PATTERN` (`isValidRGBColor`); anything else is dropped silently, and the final alert reports how many entries were skipped
5. restores `gridSize`, `pixelSize`, and the UI select
6. if present, restores `palette` and calls `initColorPalette()`
7. calls `clearCanvas()` then redraws every pixel from the filtered `pixels` with `drawPixel()`

## QR code

The QR code does **not** contain the PNG image (too large for a QR code's capacity, which is a few thousand bytes at most). Instead it encodes a URL back to this same page, with the drawing data compressed into the query string:

```
?data=<base64(compact JSON with abbreviated keys g/p/d)>
```

`showQRCode()`:
1. builds the compact object `{ g: gridSize, p: currentPalette, d: pixels }`
2. serializes it and encodes it as base64 + URL-encoding
3. if the resulting URL exceeds `QR_URL_LENGTH_LIMIT` (~2000 characters — the practical reliability limit for scanning), it generates a QR code with text metadata only (no working URL) instead, and warns the user via `#qrMessage`
4. otherwise it generates a QR code with the full URL, using the `QRCode` library (CDN)

On page load, `loadSharedDrawingFromURL()` checks for a `?data=` query parameter: if present, it decodes it, restores the state (grid/palette/pixels), redraws it, and after a short `setTimeout` (to let the render complete) automatically calls `downloadImage()`, then cleans up the URL with `history.replaceState` to avoid repeated downloads on a page refresh.

**Known limitation**: a standard QR code's capacity is limited; drawings with many colored pixels (especially on large grids) can exceed the threshold and fall back to the "metadata only" case. There is currently no fallback that still loads the drawing in that case — the user is pointed to `Esporta JSON` instead.

## Points of attention for future changes

- **No `localStorage`/`sessionStorage`** is used, deliberately (a limitation of the environment the project was originally prototyped in); worth reconsidering if the project moves elsewhere
- To add a new palette format, add a `generateXColors()` function and a case in `generateColors()`'s switch, plus the option in `<select id="paletteSelect">`
- To add a new grid size, add the option in `<select id="gridSizeSelect">` — no other change is required, the logic is generic
- Any function that redraws from `pixels` should iterate with `Object.keys(pixels)` and do `key.split(',').map(Number)` to get `x, y` — the pattern already used in `importDrawing`, reuse it for consistency
