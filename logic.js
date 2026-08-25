// Funzioni pure (nessun accesso al DOM/canvas), condivise tra l'app in
// browser e i test in Node. In pagina viene caricato con un semplice
// <script src="logic.js"></script> prima di script.js, quindi tutto qui
// dentro finisce nello scope globale come il resto del codice, senza
// bisogno di moduli o build step. In Node, module.exports (vedi in fondo)
// rende queste funzioni importabili con require() dai test.

// Valori ammessi per griglia e palette, usati per validare i file importati
const VALID_GRID_SIZES = [8, 12, 16, 24, 32];
const VALID_PALETTES = ["cga", "ega", "vga"];
// Un colore valido è una stringa "rgb(r,g,b)" con componenti 0-255
const RGB_COLOR_PATTERN =
    /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/;

function isValidRGBColor(color) {
    if (typeof color !== "string") return false;
    const match = RGB_COLOR_PATTERN.exec(color);
    if (!match) return false;
    return match.slice(1, 4).every((component) => Number(component) <= 255);
}

// Filtra un oggetto pixels grezzo (proveniente da un import JSON, da un QR
// code o dall'autosalvataggio): tiene solo le voci con chiave "x,y" dentro
// la griglia indicata e colore "rgb(r,g,b)" valido, scartando il resto in
// silenzio. Riusata da tutti i punti che caricano un disegno da una fonte
// esterna, per non fidarsi ciecamente dei dati.
function filterValidPixels(rawPixels, forGridSize) {
    const coordPattern = /^(\d+),(\d+)$/;
    const validPixels = {};
    for (const key in rawPixels) {
        const match = coordPattern.exec(key);
        if (!match) continue;

        const x = Number(match[1]);
        const y = Number(match[2]);
        if (x >= forGridSize || y >= forGridSize) continue;

        const color = rawPixels[key];
        if (!isValidRGBColor(color)) continue;

        validPixels[key] = color;
    }
    return validPixels;
}

// Palette CGA (16 colori originali)
function generateCGAColors() {
    return [
        "rgb(0,0,0)", // Nero
        "rgb(0,0,170)", // Blu
        "rgb(0,170,0)", // Verde
        "rgb(0,170,170)", // Ciano
        "rgb(170,0,0)", // Rosso
        "rgb(170,0,170)", // Magenta
        "rgb(170,85,0)", // Marrone
        "rgb(170,170,170)", // Grigio chiaro
        "rgb(85,85,85)", // Grigio scuro
        "rgb(85,85,255)", // Blu chiaro
        "rgb(85,255,85)", // Verde chiaro
        "rgb(85,255,255)", // Ciano chiaro
        "rgb(255,85,85)", // Rosso chiaro
        "rgb(255,85,255)", // Magenta chiaro
        "rgb(255,255,85)", // Giallo
        "rgb(255,255,255)" // Bianco
    ];
}

// Palette EGA (64 colori, 6 bit RGB — 2 bit per canale). L'ordine segue
// esattamente la codifica hardware reale a 6 bit: formato "rgbRGB" (bit
// alti r,g,b = intensità bassa/85; bit bassi R,G,B = intensità alta/170,
// sommati per canale), documentata nella voce Wikipedia "Enhanced
// Graphics Adapter" con citazioni al manuale IBM originale, e verificata
// contro l'immagine di riferimento "EGA64_Full_Palette.png" (Wikimedia
// Commons) e contro la tabella dei 16 colori CGA-compatibili nello stesso
// articolo (che include la curiosità storica del marrone all'indice 20,
// non 6 come ci si aspetterebbe da una progressione lineare).
function generateEGAColors() {
    const colors = [];
    for (let i = 0; i < 64; i++) {
        const lowR = (i >> 5) & 1; // bit "r": intensità bassa (+85) sul rosso
        const lowG = (i >> 4) & 1; // bit "g"
        const lowB = (i >> 3) & 1; // bit "b"
        const highR = (i >> 2) & 1; // bit "R": intensità alta (+170) sul rosso
        const highG = (i >> 1) & 1; // bit "G"
        const highB = i & 1; // bit "B"
        const r = highR * 170 + lowR * 85;
        const g = highG * 170 + lowG * 85;
        const b = highB * 170 + lowB * 85;
        colors.push(`rgb(${r},${g},${b})`);
    }
    return colors;
}

// Palette VGA (256 colori): la palette di default storica della modalità
// VGA "Mode 13h" (0x13), la stessa caricata da BIOS/DOS su hardware VGA
// reale. Valori presi dal file di riferimento "VGA palette with black
// borders.svg" su Wikimedia Commons, collegato dalla voce Wikipedia "Mode
// 13h" — estratti a macchina dall'SVG originale (nessuna trascrizione a
// mano), riga per riga (16 colori per riga, come nell'immagine).
//
// Non tutti i 256 valori sono distinti (244 lo sono), ed è corretto così,
// fedele all'originale: l'indice 16 (inizio della rampa di grigi) è nero
// come l'indice 0, alcuni valori della rampa coincidono con i primi 16
// colori CGA, e gli indici 248-255 sono tutti neri — riservati/non usati
// sull'hardware reale, non un errore di generazione.
function generateVGAColors() {
    return [
        // 0-15: i 16 colori CGA standard
        "rgb(0,0,0)", "rgb(0,0,170)", "rgb(0,170,0)", "rgb(0,170,170)", "rgb(170,0,0)", "rgb(170,0,170)", "rgb(170,85,0)", "rgb(170,170,170)", "rgb(85,85,85)", "rgb(85,85,255)", "rgb(85,255,85)", "rgb(85,255,255)", "rgb(255,85,85)", "rgb(255,85,255)", "rgb(255,255,85)", "rgb(255,255,255)",
        // 16-31: rampa di grigi (16 livelli)
        "rgb(0,0,0)", "rgb(16,16,16)", "rgb(32,32,32)", "rgb(53,53,53)", "rgb(69,69,69)", "rgb(85,85,85)", "rgb(101,101,101)", "rgb(117,117,117)", "rgb(138,138,138)", "rgb(154,154,154)", "rgb(170,170,170)", "rgb(186,186,186)", "rgb(202,202,202)", "rgb(223,223,223)", "rgb(239,239,239)", "rgb(255,255,255)",
        // 32-47
        "rgb(0,0,255)", "rgb(65,0,255)", "rgb(130,0,255)", "rgb(190,0,255)", "rgb(255,0,255)", "rgb(255,0,190)", "rgb(255,0,130)", "rgb(255,0,65)", "rgb(255,0,0)", "rgb(255,65,0)", "rgb(255,130,0)", "rgb(255,190,0)", "rgb(255,255,0)", "rgb(190,255,0)", "rgb(130,255,0)", "rgb(65,255,0)",
        // 48-63
        "rgb(0,255,0)", "rgb(0,255,65)", "rgb(0,255,130)", "rgb(0,255,190)", "rgb(0,255,255)", "rgb(0,190,255)", "rgb(0,130,255)", "rgb(0,65,255)", "rgb(130,130,255)", "rgb(158,130,255)", "rgb(190,130,255)", "rgb(223,130,255)", "rgb(255,130,255)", "rgb(255,130,223)", "rgb(255,130,190)", "rgb(255,130,158)",
        // 64-79
        "rgb(255,130,130)", "rgb(255,158,130)", "rgb(255,190,130)", "rgb(255,223,130)", "rgb(255,255,130)", "rgb(223,255,130)", "rgb(190,255,130)", "rgb(158,255,130)", "rgb(130,255,130)", "rgb(130,255,158)", "rgb(130,255,190)", "rgb(130,255,223)", "rgb(130,255,255)", "rgb(130,223,255)", "rgb(130,190,255)", "rgb(130,158,255)",
        // 80-95
        "rgb(186,186,255)", "rgb(202,186,255)", "rgb(223,186,255)", "rgb(239,186,255)", "rgb(255,186,255)", "rgb(255,186,239)", "rgb(255,186,223)", "rgb(255,186,202)", "rgb(255,186,186)", "rgb(255,202,186)", "rgb(255,223,186)", "rgb(255,239,186)", "rgb(255,255,186)", "rgb(239,255,186)", "rgb(223,255,186)", "rgb(202,255,186)",
        // 96-111
        "rgb(186,255,186)", "rgb(186,255,202)", "rgb(186,255,223)", "rgb(186,255,239)", "rgb(186,255,255)", "rgb(186,239,255)", "rgb(186,223,255)", "rgb(186,202,255)", "rgb(0,0,113)", "rgb(28,0,113)", "rgb(57,0,113)", "rgb(85,0,113)", "rgb(113,0,113)", "rgb(113,0,85)", "rgb(113,0,57)", "rgb(113,0,28)",
        // 112-127
        "rgb(113,0,0)", "rgb(113,28,0)", "rgb(113,57,0)", "rgb(113,85,0)", "rgb(113,113,0)", "rgb(85,113,0)", "rgb(57,113,0)", "rgb(28,113,0)", "rgb(0,113,0)", "rgb(0,113,28)", "rgb(0,113,57)", "rgb(0,113,85)", "rgb(0,113,113)", "rgb(0,85,113)", "rgb(0,57,113)", "rgb(0,28,113)",
        // 128-143
        "rgb(57,57,113)", "rgb(69,57,113)", "rgb(85,57,113)", "rgb(97,57,113)", "rgb(113,57,113)", "rgb(113,57,97)", "rgb(113,57,85)", "rgb(113,57,69)", "rgb(113,57,57)", "rgb(113,69,57)", "rgb(113,85,57)", "rgb(113,97,57)", "rgb(113,113,57)", "rgb(97,113,57)", "rgb(85,113,57)", "rgb(69,113,57)",
        // 144-159
        "rgb(57,113,57)", "rgb(57,113,69)", "rgb(57,113,85)", "rgb(57,113,97)", "rgb(57,113,113)", "rgb(57,97,113)", "rgb(57,85,113)", "rgb(57,69,113)", "rgb(81,81,113)", "rgb(89,81,113)", "rgb(97,81,113)", "rgb(105,81,113)", "rgb(113,81,113)", "rgb(113,81,105)", "rgb(113,81,97)", "rgb(113,81,89)",
        // 160-175
        "rgb(113,81,81)", "rgb(113,89,81)", "rgb(113,97,81)", "rgb(113,105,81)", "rgb(113,113,81)", "rgb(105,113,81)", "rgb(97,113,81)", "rgb(89,113,81)", "rgb(81,113,81)", "rgb(81,113,89)", "rgb(81,113,97)", "rgb(81,113,105)", "rgb(81,113,113)", "rgb(81,105,113)", "rgb(81,97,113)", "rgb(81,89,113)",
        // 176-191
        "rgb(0,0,65)", "rgb(16,0,65)", "rgb(32,0,65)", "rgb(49,0,65)", "rgb(65,0,65)", "rgb(65,0,49)", "rgb(65,0,32)", "rgb(65,0,16)", "rgb(65,0,0)", "rgb(65,16,0)", "rgb(65,32,0)", "rgb(65,49,0)", "rgb(65,65,0)", "rgb(49,65,0)", "rgb(32,65,0)", "rgb(16,65,0)",
        // 192-207
        "rgb(0,65,0)", "rgb(0,65,16)", "rgb(0,65,32)", "rgb(0,65,49)", "rgb(0,65,65)", "rgb(0,49,65)", "rgb(0,32,65)", "rgb(0,16,65)", "rgb(32,32,65)", "rgb(40,32,65)", "rgb(49,32,65)", "rgb(57,32,65)", "rgb(65,32,65)", "rgb(65,32,57)", "rgb(65,32,49)", "rgb(65,32,40)",
        // 208-223
        "rgb(65,32,32)", "rgb(65,40,32)", "rgb(65,49,32)", "rgb(65,57,32)", "rgb(65,65,32)", "rgb(57,65,32)", "rgb(49,65,32)", "rgb(40,65,32)", "rgb(32,65,32)", "rgb(32,65,40)", "rgb(32,65,49)", "rgb(32,65,57)", "rgb(32,65,65)", "rgb(32,57,65)", "rgb(32,49,65)", "rgb(32,40,65)",
        // 224-239
        "rgb(45,45,65)", "rgb(49,45,65)", "rgb(53,45,65)", "rgb(61,45,65)", "rgb(65,45,65)", "rgb(65,45,61)", "rgb(65,45,53)", "rgb(65,45,49)", "rgb(65,45,45)", "rgb(65,49,45)", "rgb(65,53,45)", "rgb(65,61,45)", "rgb(65,65,45)", "rgb(61,65,45)", "rgb(53,65,45)", "rgb(49,65,45)",
        // 240-255: anello più scuro; 248-255 tutti neri (riservati/non usati sull'hardware reale)
        "rgb(45,65,45)", "rgb(45,65,49)", "rgb(45,65,53)", "rgb(45,65,61)", "rgb(45,65,65)", "rgb(45,61,65)", "rgb(45,53,65)", "rgb(45,49,65)", "rgb(0,0,0)", "rgb(0,0,0)", "rgb(0,0,0)", "rgb(0,0,0)", "rgb(0,0,0)", "rgb(0,0,0)", "rgb(0,0,0)", "rgb(0,0,0)"
    ];
}

// Ritorna l'array di colori della palette indicata (stesso dispatch di
// generateColors() in script.js, ma parametrizzato: qui non possiamo
// leggere la variabile globale currentPalette, e questa versione pura è
// anche riusabile per decodificare un disegno con una palette diversa da
// quella attualmente attiva nell'app, es. durante il caricamento da QR).
function paletteColorsFor(paletteName) {
    switch (paletteName) {
        case "cga":
            return generateCGAColors();
        case "ega":
            return generateEGAColors();
        case "vga":
            return generateVGAColors();
        default:
            return generateVGAColors();
    }
}

// Trova, tra i colori dati, quello più vicino al colore indicato (distanza
// euclidea nello spazio RGB). Usato dal contagocce per adattare un colore
// prelevato da fuori (es. da tutto lo schermo tramite l'API EyeDropper,
// che può restituire qualunque colore esista sullo schermo) alla palette
// attualmente in uso, così il disegno resta coerente con la palette
// scelta invece di introdurre colori arbitrari.
function findNearestColor(targetColor, paletteColors) {
    const targetMatch = RGB_COLOR_PATTERN.exec(targetColor);
    if (!targetMatch) return paletteColors[0];
    const [tr, tg, tb] = targetMatch.slice(1, 4).map(Number);

    let closest = paletteColors[0];
    let closestDistance = Infinity;
    for (const color of paletteColors) {
        const match = RGB_COLOR_PATTERN.exec(color);
        const [r, g, b] = match.slice(1, 4).map(Number);
        const distance = (r - tr) ** 2 + (g - tg) ** 2 + (b - tb) ** 2;
        if (distance < closestDistance) {
            closestDistance = distance;
            closest = color;
        }
    }
    return closest;
}

// Codifica pixels in una forma compatta per la condivisione via QR/URL,
// dove lo spazio è limitato: se il colore di un pixel è esattamente uno
// dei colori della palette indicata (il caso comune — CGA/EGA/VGA hanno
// solo 16/64/256 colori possibili), salva il suo indice numerico invece
// della stringa "rgb(r,g,b)" per intero, molto più compatto (es. "7"
// invece di "rgb(170,170,170)"). Se il colore non è nella palette (raro:
// un vecchio disegno con palette cambiata, o dati non standard), salva
// comunque la stringa colore così com'è, per non perdere il dato.
function encodePixelsCompact(pixels, paletteName) {
    const paletteColors = paletteColorsFor(paletteName);
    const compact = {};
    for (const key in pixels) {
        const index = paletteColors.indexOf(pixels[key]);
        compact[key] = index === -1 ? pixels[key] : index;
    }
    return compact;
}

// Operazione inversa: da pixels in forma compatta (indici numerici e/o
// stringhe colore, vedi sopra) a un normale oggetto pixels con valori
// "rgb(r,g,b)". Un indice fuori range (dati corrotti o manomessi) produce
// `undefined`, che il successivo filterValidPixels scarta correttamente
// perché non è una stringa colore valida — nessuna validazione aggiuntiva
// necessaria qui.
function decodePixelsCompact(compactPixels, paletteName) {
    const paletteColors = paletteColorsFor(paletteName);
    const pixels = {};
    for (const key in compactPixels) {
        const value = compactPixels[key];
        pixels[key] = typeof value === "number" ? paletteColors[value] : value;
    }
    return pixels;
}

// Rende sicura una stringa da inserire in un valore di attributo XML
function escapeXMLAttribute(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

// In browser (caricato con <script>) "module" non esiste e questo blocco
// viene semplicemente ignorato: le funzioni sopra restano globali come le
// altre di script.js. In Node (require() dai test) le esporta esplicitamente.
if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        VALID_GRID_SIZES,
        VALID_PALETTES,
        RGB_COLOR_PATTERN,
        isValidRGBColor,
        filterValidPixels,
        generateCGAColors,
        generateEGAColors,
        generateVGAColors,
        paletteColorsFor,
        findNearestColor,
        encodePixelsCompact,
        decodePixelsCompact,
        escapeXMLAttribute
    };
}
