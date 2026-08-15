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

// Palette VGA (256 colori standard)
function generateVGAColors() {
    const colors = [];

    // Prime 16 colori CGA standard
    colors.push(...generateCGAColors());

    // 16 gradazioni di grigio
    for (let i = 0; i < 16; i++) {
        const val = Math.floor((i * 255) / 15);
        colors.push(`rgb(${val},${val},${val})`);
    }

    // 216 colori RGB (6x6x6)
    const levels = [0, 51, 102, 153, 204, 255];
    for (let r of levels) {
        for (let g of levels) {
            for (let b of levels) {
                if (colors.length < 256) {
                    colors.push(`rgb(${r},${g},${b})`);
                }
            }
        }
    }

    // Riempi eventuali spazi rimanenti con nero
    while (colors.length < 256) {
        colors.push("rgb(0,0,0)");
    }

    return colors.slice(0, 256);
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
        escapeXMLAttribute
    };
}
