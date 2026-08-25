# Architecture

Technical reference for maintaining `script.js` and `logic.js`. Describes global state, main functions, and data flow. See [README.md](README.md) for a user-facing overview and [CHANGELOG.md](CHANGELOG.md) for history.

## File split: `logic.js` vs `script.js`

`logic.js` holds every function that is pure (no DOM/canvas/`localStorage` access): the palette generators, `isValidRGBColor`, `filterValidPixels`, `escapeXMLAttribute`, and the `VALID_GRID_SIZES`/`VALID_PALETTES`/`RGB_COLOR_PATTERN` constants. `script.js` holds everything else (drawing, undo/redo, import/export, QR, autosave) and depends on `logic.js` being loaded first — `index.html` loads `<script src="logic.js">` before `<script src="script.js">`, so in the browser both files just share the same global scope, exactly as if it were still one file.

The split exists so `logic.js` can also be `require()`d directly by the Node test suite (`test/logic.test.js`, run with `node --test` / `npm test`) without needing a real DOM. At the bottom of `logic.js`, a small guard (`if (typeof module !== "undefined" && module.exports)`) exports its functions for Node; in the browser `module` doesn't exist, so that block is simply skipped and everything stays global as usual. See the "Running tests" section in the README.

`script.js` itself is not required by the tests and still can't be — it touches `document`/`canvas`/`localStorage` at module scope, so it only runs inside a real browser (or something that fakes one, like Playwright). Its DOM-heavy code (drawing, canvas rendering, undo/redo, import/export flows) is instead verified manually in the browser during development; see the commit messages / CHANGELOG for what was checked at each step.

## Global state

Defined at the top of `script.js`:

| Variable | Type | Description |
|---|---|---|
| `canvas`, `ctx` | DOM/Context2D | reference to `<canvas id="pixelCanvas">` |
| `gridSize` | number | grid side length in cells (8/12/16/24/32) |
| `pixelSize` | number | on-screen side of one cell = `canvas.width / gridSize`, recalculated on every grid change |
| `currentColor` | string | currently selected color — **must** always be in `"rgb(r,g,b)"` format (matching `RGB_COLOR_PATTERN`/`isValidRGBColor()` in `logic.js`), starts as `"rgb(0,0,0)"`. A `"#..."` hex value would display and export fine but silently fail every re-import/autosave-restore/QR-share check, since `filterValidPixels()` only accepts `rgb()` — this was a real bug until v1.2.1. |
| `isDrawing` | boolean | true while the mouse is held down, for drag-drawing |
| `pixels` | object | map `"x,y" -> color` of every drawn pixel |
| `currentPalette` | string | `'cga'` \| `'ega'` \| `'vga'` — starts as `'vga'` |
| `currentTool` | string | `'brush'` (default) \| `'eyedropper'` \| `'bucket'` — active drawing tool, driven by `#toolSelect` |
| `undoStack`, `redoStack` | array | stacks of `pixels` snapshots for undo/redo, capped at `MAX_HISTORY` (50) entries |

**Note**: `pixels` is the source of truth for the drawing. The canvas is only its visual representation; redrawing from `pixels` (see `importDrawing`) is the correct way to restore a state.

## Color palettes

Three generator functions (in `logic.js`, unit-tested — see "File split" above), each returning an array of `rgb(r,g,b)` strings:

- `generateCGAColors()` — 16 hardcoded colors (the historical IBM CGA palette)
- `generateEGAColors()` — 64 colors, combining 4 levels (0, 85, 170, 255) across R/G/B
- `generateVGAColors()` — 256 colors: 16 CGA colors + 16 grays + 216 web-safe colors (6 levels per channel, 6³ = 216). These three families overlap (e.g. black and white appear in more than one of them), so they only yield ~238 *distinct* colors on their own; a `pushUnique()` helper skips anything already seen and tops up the shortfall with an additional, non-overlapping RGB grid, guaranteeing exactly 256 distinct colors every time (covered by a dedicated test in `test/logic.test.js` — see "File split" above). An earlier version padded the shortfall by repeating plain black, which meant `rgb(0,0,0)` alone accounted for 11 of the 256 slots; fixed in v1.2.1.

`generateColors()` (in `script.js`) dispatches based on `currentPalette` — it isn't itself in `logic.js` since it reads that global.

`initColorPalette()`:
1. clears `#colorPalette` (`innerHTML = ''`) — **essential**, without this colors pile up on every palette change
2. calls `generateColors()`
3. creates one `div.color-swatch` per color with `onclick = () => selectColor(color)`

## Drawing on the grid

- `drawGrid()` — draws the grid lines on the canvas (called by `clearCanvas`)
- `getPixelCoords(e)` — converts mouse (client) coordinates into grid cell coordinates, accounting for the scaling between the canvas' CSS size and its real size (`scaleX`/`scaleY`)
- `drawPixel(x, y, color)` — draws the colored rectangle (with a 1px margin so the grid underneath stays visible) and updates `pixels[x,y]`
- `floodFill(startX, startY, fillColor)` — iterative (stack-based, not recursive) 4-directional flood fill: colors every cell reachable from `(startX, startY)` that shares its starting color, where an undrawn cell counts as color `null` (so filling the blank background works too). No-ops immediately if the target cell already has `fillColor`. See "Undo / redo" for how it pushes history.
- `handleDraw(e)` — single handler for `mousedown`/`mousemove`/`click`, branching on `currentTool`:
  - `"eyedropper"`: reads the color from `pixels`, sets it as `currentColor`, and switches back to `"brush"` via `setTool()`
  - `"bucket"`: calls `floodFill()` once per click (ignores `mousemove`, so dragging with the bucket selected doesn't repeatedly fill)
  - `"brush"` (default): draws normally (only while `isDrawing`, or on a `click` event)

Events registered on the canvas: `mousedown` (sets `isDrawing = true` and draws, via the shared `startStroke()`), `mousemove`, `mouseup`/`mouseleave` (`isDrawing = false`), `click` (for a single tap/click without dragging). `getPixelCoords(e)` reads `e.clientX`/`e.clientY` directly.

**Touch support**: `touchstart`/`touchmove`/`touchend`/`touchcancel` mirror the mouse events (`touchstart` calls the same `startStroke()` as `mousedown`), registered with `{ passive: false }` so `e.preventDefault()` can stop the page from scrolling/zooming while drawing — reinforced by `touch-action: none` on `#pixelCanvas` in `style.css`. `getPixelCoords(e)` transparently supports both: touch events carry coordinates in `e.touches[0]` instead of directly on `e`, so it reads from `e.touches[0]` when present, falling back to `e` for mouse events.

## Grid size / palette changes

- `changeGridSize()` — reads the value from the select, recalculates `pixelSize`, calls `clearCanvas()` (⚠️ the current drawing is lost, there is no conversion), then `clearHistory()` (see below)
- `changePalette()` — reads the value from the select, calls `initColorPalette()` (the current drawing is **not** touched, only the available palette; undo/redo history is untouched too, since `pixels` stores absolute `rgb()` strings independent of the active palette)

## Undo / redo

`pixels` snapshots (`{ ...pixels }`) are pushed onto `undoStack` **before** a mutating action is applied, so the top of the stack is always "the state right before the last action":

- `pushUndoState()` — snapshots `pixels` onto `undoStack` (capping it at `MAX_HISTORY`), and clears `redoStack` (a new action invalidates any available redo)
- `undo()` / `redo()` — pop a snapshot from one stack, push the *current* state onto the other, then `restorePixels()` the popped snapshot
- `restorePixels(snapshot)` — a thin wrapper around `renderPixels(snapshot)` (see below)
- `updateUndoRedoButtons()` — enables/disables `#undoBtn`/`#redoBtn` based on whether their stack is empty; called after every push/undo/redo and once at startup
- `clearHistory()` — empties both stacks; called whenever the grid size changes (manually via `changeGridSize()`, or implicitly via a same-session `importDrawing()`/`loadSharedDrawingFromURL()` that sets a different `gridSize`), since older snapshots' `"x,y"` keys wouldn't be meaningful against a different grid

`renderPixels(pixelsObj)` — the single shared "commit this pixels object to the canvas" primitive: calls `clearCanvas()` (resets `pixels` to `{}` and redraws the blank grid), then redraws every entry of `pixelsObj` with `drawPixel()`, which repopulates the global `pixels` one key at a time as a side effect. Since `clearCanvas()` always starts from a fresh `{}`, the resulting `pixels` is never the same object reference as whatever was passed in — so mutating it later (e.g. drawing a new stroke) can never retroactively corrupt a snapshot still sitting in `undoStack`/`redoStack`, or the caller's original object. Reused by `restorePixels()`, `loadAutosavedState()`, `applyImportedDrawing()`, and `loadSharedDrawingFromURL()` (see their sections below) — the one loop that redraws a `pixels`-shaped object onto the canvas, instead of four near-identical copies of it (deduplicated in v1.2.1).

`pushUndoState()` call sites — each represents one undoable action:
- `mousedown` on the canvas, once per stroke (not per `drawPixel()` call during a drag) — only while `currentTool === "brush"`, since other tools don't mutate `pixels` from this handler
- `floodFill()`, once per fill — but only *after* confirming the fill will actually change something (`targetColor !== fillColor`), so clicking the bucket on an already-matching area doesn't waste a history slot
- `clearAll()` (bound to the "Cancella tutto" button; the raw `clearCanvas()` is still used internally, without pushing history, by `changeGridSize()` and `renderPixels()`)
- `importDrawing()`, only when the imported `gridSize` matches the current one (otherwise `clearHistory()` runs instead, see above)

Keyboard shortcuts: `Ctrl+Z` (or `Cmd+Z` on Mac) for undo, `Ctrl+Y` or `Ctrl+Shift+Z` for redo, handled by a `keydown` listener on `document`.

## Tools (brush / eyedropper / bucket)

- `#toolSelect` — a `<select>` (same pattern as grid size / palette) listing the available tools; `onchange="changeTool()"`
- `changeTool()` reads `#toolSelect`'s value and calls `setTool()`
- `setTool(tool)` sets `currentTool`, syncs `#toolSelect`'s displayed value (so code can switch tools programmatically, e.g. after an eyedropper pick), and updates the canvas cursor via the `TOOL_CURSORS` lookup (`pointer` for eyedropper, `cell` for bucket, `crosshair` otherwise)
- Eyedropper color reading and the bucket's `floodFill()` call both happen inside `handleDraw()` rather than separate handlers, to reuse the same coordinate-conversion logic; picking a color with the eyedropper calls `setTool("brush")` to switch back automatically

⚠️ Historical bug (fixed in v1.2.0): the eyedropper's own toggle markup was missing from `index.html` entirely — the feature was fully implemented in `script.js` and documented, but had no UI element to reach it. If you add a new tool, always check it's actually wired into `index.html`, not just implemented in JS.

This is a small scaffold meant to grow: adding another tool means adding an `<option>` to `#toolSelect`, an entry in `TOOL_CURSORS`, and a branch in `handleDraw()` (plus `mousedown` if it needs its own undo handling), without touching the rest.

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
4. filters `pixels` via `filterValidPixels(rawPixels, gridSize)`: keeps only entries whose key matches `"x,y"` inside `[0, gridSize)` and whose value matches `RGB_COLOR_PATTERN` (`isValidRGBColor`); anything else is dropped silently, and the final alert reports how many entries were skipped. This helper is shared with the QR-code loader, the XML import, and the autosave restore below, so all untrusted-data entry points get the same hardening.
5. calls `applyImportedDrawing(newGridSize, importData.palette, validPixels)` — see below

`applyImportedDrawing(newGridSize, palette, validPixels)`, shared by JSON and XML import:
1. calls `clearHistory()` if `newGridSize` differs from the current `gridSize`, otherwise `pushUndoState()` (see "Undo / redo" above)
2. restores `gridSize`, `pixelSize`, and the UI select
3. if `palette` is given, restores it and calls `initColorPalette()`
4. calls `renderPixels(validPixels)` (see "Undo / redo" above)
5. calls `saveState()` (see "Autosave" below)

### XML export / import

Same data, alternate format — `exportDrawingXML()` builds an XML string by hand (not `DOMParser`/`XMLSerializer`, to keep it dead simple to read) with attribute values passed through `escapeXMLAttribute()`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<pixelArt version="1.0" gridSize="32" palette="vga" timestamp="...">
  <pixels>
    <pixel x="3" y="4" color="rgb(255,0,0)" />
  </pixels>
</pixelArt>
```

`importDrawingXML(event)` mirrors `importDrawing()`, but parses with `DOMParser` (checking for a `parsererror` node, since `DOMParser` doesn't throw on malformed XML) instead of `JSON.parse`, reads `gridSize`/`palette` from the `<pixelArt>` element's attributes, and builds the raw pixels object from every `<pixel x="" y="" color="" />` node before running it through the same `filterValidPixels()` and `applyImportedDrawing()` as the JSON path.

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

On page load, `loadSharedDrawingFromURL()` checks for a `?data=` query parameter: if present, it decodes it, validates `g`/`p`/`d` the same way `importDrawing()` does (`VALID_GRID_SIZES`, `VALID_PALETTES`, `filterValidPixels()` — the URL is just as untrusted as a hand-edited import file), calls `clearHistory()` (a freshly loaded drawing has no undo history), restores the state (grid/palette/pixels), redraws it, calls `saveState()`, and after a short `setTimeout` (to let the render complete) automatically calls `downloadImage()`, then cleans up the URL with `history.replaceState` to avoid repeated downloads on a page refresh. It returns `true` if it actually loaded something, `false` otherwise (no `?data=`, or invalid data) — the startup sequence uses this to decide whether to fall back to the autosave (see below).

**Known limitation**: a standard QR code's capacity is limited; drawings with many colored pixels (especially on large grids) can exceed the threshold and fall back to the "metadata only" case. There is currently no fallback that still loads the drawing in that case — the user is pointed to `Esporta JSON` instead.

## Autosave

The drawing persists across page loads via `localStorage`, under a single fixed key `AUTOSAVE_KEY` (`"pixelArtEditorAutosave"`):

- `saveState()` writes `{ version, gridSize, palette: currentPalette, pixels }` as JSON. Wrapped in `try`/`catch`: `localStorage` can be unavailable (private browsing, quota exceeded, storage disabled) and this must never break a user action — it just `console.warn`s and moves on.
- `loadAutosavedState()` is the mirror of `importDrawing()`'s restore logic (same `VALID_GRID_SIZES`/`VALID_PALETTES`/`filterValidPixels()` validation), reading from `localStorage` instead of a file. Returns `true`/`false` depending on whether it actually restored something.
- Called once at startup, but **only if `loadSharedDrawingFromURL()` returned `false`** — an opened QR share link always wins over the autosave for that page load, and its state is then saved as the new autosave.
- Called after every mutating action: end of a brush stroke (`endStroke()`, shared by mouse and touch), `floodFill()`, `clearAll()`, `changeGridSize()`, `changePalette()`, `undo()`/`redo()`, and a successful `importDrawing()`. Each of these already has its own natural "one action" boundary (see "Undo / redo" above for the equivalent reasoning on stroke grouping), so this doesn't mean one write per pixel.

## Points of attention for future changes

- To add a new palette format, add a `generateXColors()` function and a case in `generateColors()`'s switch, plus the option in `<select id="paletteSelect">`
- To add a new grid size, add the option in `<select id="gridSizeSelect">` — no other change is required, the logic is generic
- Any function that redraws from `pixels` should iterate with `Object.keys(pixels)` and do `key.split(',').map(Number)` to get `x, y` — the pattern already used in `importDrawing`, reuse it for consistency
