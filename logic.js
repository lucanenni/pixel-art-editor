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

// Palette EGA (64 colori - 2 bit per canale RGB)
function generateEGAColors() {
    const colors = [];
    const levels = [0, 85, 170, 255]; // 4 livelli (2 bit) per canale

    for (let r of levels) {
        for (let g of levels) {
            for (let b of levels) {
                colors.push(`rgb(${r},${g},${b})`);
            }
        }
    }

    return colors;
}

// Sceglie, tra i colori candidati, quelli più lontani (distanza euclidea
// nello spazio RGB) dai colori già esistenti — e tra loro stessi via via
// che vengono scelti (selezione golosa "farthest point"). Usato per
// riempire gli ultimi posti della palette VGA (vedi sotto) con colori il
// più possibile sparsi, invece che ammassati in un angolo dello spazio
// colore vicino a colori già presenti.
function pickFarthestColors(existingColors, candidateColors, count) {
    function parseRGB(color) {
        const [, r, g, b] = /^rgb\((\d+),(\d+),(\d+)\)$/.exec(color);
        return [Number(r), Number(g), Number(b)];
    }

    const chosen = [];
    const chosenRGB = existingColors.map(parseRGB);
    const pool = candidateColors.map((color) => ({ color, rgb: parseRGB(color) }));

    while (chosen.length < count && pool.length > 0) {
        let bestIndex = 0;
        let bestDistance = -1;
        for (let i = 0; i < pool.length; i++) {
            const [r, g, b] = pool[i].rgb;
            let minDistance = Infinity;
            for (const [er, eg, eb] of chosenRGB) {
                const distance = (r - er) ** 2 + (g - eg) ** 2 + (b - eb) ** 2;
                if (distance < minDistance) minDistance = distance;
            }
            if (minDistance > bestDistance) {
                bestDistance = minDistance;
                bestIndex = i;
            }
        }
        const picked = pool.splice(bestIndex, 1)[0];
        chosen.push(picked.color);
        chosenRGB.push(picked.rgb);
    }

    return chosen;
}

// Palette VGA (256 colori standard)
function generateVGAColors() {
    const seen = new Set();
    const colors = [];

    // Aggiunge un colore solo se non è già presente (es. nero e bianco
    // compaiono sia tra i colori CGA sia tra le gradazioni di grigio sia
    // tra i colori web-safe) e solo finché non abbiamo raggiunto 256 colori
    function pushUnique(r, g, b) {
        if (colors.length >= 256) return;
        const color = `rgb(${r},${g},${b})`;
        if (seen.has(color)) return;
        seen.add(color);
        colors.push(color);
    }

    // Prime 16 colori CGA standard
    for (const color of generateCGAColors()) {
        const [, r, g, b] = /^rgb\((\d+),(\d+),(\d+)\)$/.exec(color);
        pushUnique(Number(r), Number(g), Number(b));
    }

    // 16 gradazioni di grigio
    for (let i = 0; i < 16; i++) {
        const val = Math.floor((i * 255) / 15);
        pushUnique(val, val, val);
    }

    // 216 colori RGB (6x6x6)
    const levels = [0, 51, 102, 153, 204, 255];
    for (const r of levels) {
        for (const g of levels) {
            for (const b of levels) {
                pushUnique(r, g, b);
            }
        }
    }

    // Le tre famiglie sopra si sovrappongono abbastanza da produrre solo
    // circa 238 colori distinti, non 256: completiamo gli slot mancanti
    // scegliendo, da una griglia RGB più fitta (livelli scelti apposta per
    // non coincidere con quelli usati sopra), i colori più lontani da
    // quelli già presenti — invece di prendere semplicemente i primi
    // trovati in ordine di scansione, che finirebbero ammassati in un
    // angolo dello spazio colore e percettivamente troppo simili tra loro
    if (colors.length < 256) {
        const fineLevels = [16, 48, 80, 112, 144, 176, 208, 240];
        const candidates = [];
        for (const r of fineLevels) {
            for (const g of fineLevels) {
                for (const b of fineLevels) {
                    const color = `rgb(${r},${g},${b})`;
                    if (!seen.has(color)) candidates.push(color);
                }
            }
        }
        for (const color of pickFarthestColors(colors, candidates, 256 - colors.length)) {
            colors.push(color);
            seen.add(color);
        }
    }

    return colors;
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
        pickFarthestColors,
        paletteColorsFor,
        findNearestColor,
        encodePixelsCompact,
        decodePixelsCompact,
        escapeXMLAttribute
    };
}
