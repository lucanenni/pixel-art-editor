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
3. restores `gridSize`, `pixelSize`, and the UI select
4. if present, restores `palette` and calls `initColorPalette()`
5. calls `clearCanvas()` then redraws every pixel from `pixels` with `drawPixel()`

⚠️ No deep validation of `pixels`' content (e.g. out-of-grid coordinates, malformed colors). Worth hardening if the import ever handles untrusted files.

## QR code (currently disabled)

`showQRCode()` generates a QR code by passing the canvas' PNG data URL (`canvas.toDataURL("image/png")`) directly as the `text` payload to the `QRCode` library (CDN). This does not scale: QR codes only hold a few thousand bytes, far less than a base64-encoded PNG for anything but a near-blank drawing, so the library throws for most real drawings.

Because of this, the `Mostra QR code` button is currently **commented out** in `index.html`, and the feature is not reachable from the UI. The modal markup (`#qrModal`, `#qrcode`, `#qrMessage`) and the `qrcodejs` CDN script tag are still present, ready to be wired back up once the underlying approach is fixed.

A more scalable design was explored in earlier iterations (see [CHANGELOG.md](CHANGELOG.md)): encode a compact JSON representation of the drawing (`{ g: gridSize, p: palette, d: pixels }`) as a base64 query string instead of the raw image, with a `DOMContentLoaded` listener that detects `?data=` on load, restores the drawing, and auto-downloads the PNG. That approach is **not** implemented in the current `script.js` — it's listed under future improvements in the README.

## Points of attention for future changes

- **No `localStorage`/`sessionStorage`** is used, deliberately (a limitation of the environment the project was originally prototyped in); worth reconsidering if the project moves elsewhere
- To add a new palette format, add a `generateXColors()` function and a case in `generateColors()`'s switch, plus the option in `<select id="paletteSelect">`
- To add a new grid size, add the option in `<select id="gridSizeSelect">` — no other change is required, the logic is generic
- Any function that redraws from `pixels` should iterate with `Object.keys(pixels)` and do `key.split(',').map(Number)` to get `x, y` — the pattern already used in `importDrawing`, reuse it for consistency
