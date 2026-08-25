// Test delle funzioni pure di logic.js, con il test runner nativo di Node
// (node:test) — nessuna dipendenza da installare. Si lancia con:
//   node --test
"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
    VALID_GRID_SIZES,
    VALID_PALETTES,
    isValidRGBColor,
    filterValidPixels,
    generateCGAColors,
    generateEGAColors,
    generateVGAColors,
    escapeXMLAttribute
} = require("../logic.js");

describe("isValidRGBColor", () => {
    test("accetta colori rgb(...) ben formati", () => {
        assert.equal(isValidRGBColor("rgb(0,0,0)"), true);
        assert.equal(isValidRGBColor("rgb(255,255,255)"), true);
        assert.equal(isValidRGBColor("rgb(1, 2, 3)"), true); // spazi ammessi
    });

    test("rifiuta componenti fuori range 0-255", () => {
        assert.equal(isValidRGBColor("rgb(256,0,0)"), false);
        assert.equal(isValidRGBColor("rgb(999,999,999)"), false);
    });

    test("rifiuta formati non validi", () => {
        assert.equal(isValidRGBColor("javascript:alert(1)"), false);
        assert.equal(isValidRGBColor("#ff0000"), false);
        assert.equal(isValidRGBColor("rgb(1,2)"), false); // componenti mancanti
        assert.equal(isValidRGBColor(""), false);
    });

    test("rifiuta valori non stringa senza lanciare eccezioni", () => {
        assert.equal(isValidRGBColor(null), false);
        assert.equal(isValidRGBColor(undefined), false);
        assert.equal(isValidRGBColor(42), false);
        assert.equal(isValidRGBColor({ toString: () => "rgb(0,0,0)" }), false);
    });
});

describe("filterValidPixels", () => {
    test("tiene solo le voci valide dentro la griglia", () => {
        const raw = {
            "0,0": "rgb(1,2,3)",
            "7,7": "rgb(4,5,6)"
        };
        assert.deepEqual(filterValidPixels(raw, 8), raw);
    });

    test("scarta coordinate fuori griglia", () => {
        const raw = { "0,0": "rgb(1,1,1)", "8,8": "rgb(2,2,2)" };
        assert.deepEqual(filterValidPixels(raw, 8), { "0,0": "rgb(1,1,1)" });
    });

    test("scarta chiavi malformate", () => {
        const raw = {
            "0,0": "rgb(1,1,1)",
            "x,y": "rgb(2,2,2)",
            "1": "rgb(3,3,3)",
            "-1,0": "rgb(4,4,4)"
        };
        assert.deepEqual(filterValidPixels(raw, 8), { "0,0": "rgb(1,1,1)" });
    });

    test("scarta colori non validi, inclusi tentativi di injection", () => {
        const raw = {
            "0,0": "rgb(1,1,1)",
            "1,1": "javascript:alert(1)",
            "2,2": "rgb(999,0,0)"
        };
        assert.deepEqual(filterValidPixels(raw, 8), { "0,0": "rgb(1,1,1)" });
    });

    test("un oggetto pixels vuoto resta vuoto", () => {
        assert.deepEqual(filterValidPixels({}, 32), {});
    });
});

describe("palette generators", () => {
    test("generateCGAColors produce 16 colori validi", () => {
        const colors = generateCGAColors();
        assert.equal(colors.length, 16);
        for (const color of colors) assert.equal(isValidRGBColor(color), true);
    });

    test("generateEGAColors produce 64 colori validi", () => {
        const colors = generateEGAColors();
        assert.equal(colors.length, 64);
        for (const color of colors) assert.equal(isValidRGBColor(color), true);
    });

    test("generateVGAColors produce 256 colori validi, che iniziano con la palette CGA", () => {
        const vga = generateVGAColors();
        const cga = generateCGAColors();
        assert.equal(vga.length, 256);
        for (const color of vga) assert.equal(isValidRGBColor(color), true);
        assert.deepEqual(vga.slice(0, 16), cga);
    });

    test("generateVGAColors contiene 256 colori tutti distinti", () => {
        // CGA, scala di grigi e web-safe si sovrappongono in alcuni punti
        // (es. nero e bianco compaiono in più di una famiglia): la palette
        // deve comunque risultare di 256 colori diversi, non ripetuti
        const vga = generateVGAColors();
        assert.equal(new Set(vga).size, 256);
    });
});

describe("escapeXMLAttribute", () => {
    test("esegue l'escape dei caratteri speciali XML", () => {
        assert.equal(
            escapeXMLAttribute(`a & b < c > d "e"`),
            "a &amp; b &lt; c &gt; d &quot;e&quot;"
        );
    });

    test("lascia invariate le stringhe senza caratteri speciali", () => {
        assert.equal(escapeXMLAttribute("rgb(255,0,0)"), "rgb(255,0,0)");
    });

    test("converte in stringa i valori non stringa", () => {
        assert.equal(escapeXMLAttribute(42), "42");
    });
});

describe("costanti condivise", () => {
    test("VALID_GRID_SIZES corrisponde alle opzioni di #gridSizeSelect in index.html", () => {
        assert.deepEqual(VALID_GRID_SIZES, [8, 12, 16, 24, 32]);
    });

    test("VALID_PALETTES corrisponde alle opzioni di #paletteSelect in index.html", () => {
        assert.deepEqual(VALID_PALETTES, ["cga", "ega", "vga"]);
    });
});
