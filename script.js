const canvas = document.getElementById("pixelCanvas");
const ctx = canvas.getContext("2d");
let gridSize = 32;
let pixelSize = canvas.width / gridSize;

let currentColor = "#000000";
let isDrawing = false;
let pixels = {};
let currentPalette = "vga";
// Strumento attivo: 'brush' (pennello, default) | 'eyedropper' (contagocce)
let currentTool = "brush";

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

// Cronologia per undo/redo: ogni voce è un'istantanea completa di `pixels`.
// È legata alla gridSize corrente: cambiare griglia svuota la cronologia,
// perché le coordinate salvate non avrebbero più senso con un'altra griglia.
let undoStack = [];
let redoStack = [];
const MAX_HISTORY = 50;

function snapshotPixels() {
    return { ...pixels };
}

// Salva lo stato corrente nella cronologia undo, prima di una modifica.
// Da chiamare SEMPRE prima di applicare la modifica, non dopo.
function pushUndoState() {
    undoStack.push(snapshotPixels());
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    // una nuova azione invalida i "ripeti" disponibili
    redoStack = [];
    updateUndoRedoButtons();
}

function clearHistory() {
    undoStack = [];
    redoStack = [];
    updateUndoRedoButtons();
}

function updateUndoRedoButtons() {
    document.getElementById("undoBtn").disabled = undoStack.length === 0;
    document.getElementById("redoBtn").disabled = redoStack.length === 0;
}

// Ridisegna il canvas da zero a partire da un'istantanea di pixels
function restorePixels(snapshot) {
    clearCanvas(); // azzera pixels e ridisegna sfondo + griglia
    pixels = { ...snapshot };
    for (const key in pixels) {
        const [x, y] = key.split(",").map(Number);
        drawPixel(x, y, pixels[key]);
    }
}

function undo() {
    if (undoStack.length === 0) return;
    redoStack.push(snapshotPixels());
    restorePixels(undoStack.pop());
    updateUndoRedoButtons();
}

function redo() {
    if (redoStack.length === 0) return;
    undoStack.push(snapshotPixels());
    restorePixels(redoStack.pop());
    updateUndoRedoButtons();
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

// Genera colori in base alla palette selezionata
function generateColors() {
    switch (currentPalette) {
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

// Inizializza la palette
function initColorPalette() {
    const palette = document.getElementById("colorPalette");
    palette.innerHTML = ""; // Svuota la palette prima di ricrearla
    const colors = generateColors();

    colors.forEach((color) => {
        const swatch = document.createElement("div");
        swatch.className = "color-swatch";
        swatch.style.backgroundColor = color;
        swatch.onclick = () => selectColor(color);
        palette.appendChild(swatch);
    });

    updateCurrentColor();
}

function selectColor(color) {
    currentColor = color;
    updateCurrentColor();
}

function updateCurrentColor() {
    document.getElementById("currentColor").style.backgroundColor = currentColor;
}

// Disegna la griglia
function drawGrid() {
    ctx.strokeStyle = "#ddd";
    ctx.lineWidth = 1;

    for (let i = 0; i <= gridSize; i++) {
        ctx.beginPath();
        ctx.moveTo(i * pixelSize, 0);
        ctx.lineTo(i * pixelSize, canvas.height);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, i * pixelSize);
        ctx.lineTo(canvas.width, i * pixelSize);
        ctx.stroke();
    }
}

function getPixelCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = Math.floor(((e.clientX - rect.left) * scaleX) / pixelSize);
    const y = Math.floor(((e.clientY - rect.top) * scaleY) / pixelSize);

    return { x, y };
}

function drawPixel(x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(
        x * pixelSize + 1,
        y * pixelSize + 1,
        pixelSize - 2,
        pixelSize - 2
    );
    pixels[`${x},${y}`] = color;
}

function handleDraw(e) {
    const { x, y } = getPixelCoords(e);
    if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) return;

    // Modalità contagocce
    if (currentTool === "eyedropper") {
        const pixelKey = `${x},${y}`;
        if (pixels[pixelKey]) {
            selectColor(pixels[pixelKey]);
            // Dopo aver prelevato un colore si torna al pennello, pronti a
            // disegnare con quel colore
            setTool("brush");
        }
        return;
    }

    // Modalità disegno normale (pennello)
    if (!isDrawing && e.type !== "click") return;
    drawPixel(x, y, currentColor);
}

canvas.addEventListener("mousedown", (e) => {
    isDrawing = true;
    // Un intero tratto (drag) è un solo passo di undo: salvo lo stato solo
    // all'inizio del tratto, non ad ogni pixel disegnato durante il drag.
    // Gli altri strumenti (contagocce, ...) non disegnano qui, quindi non
    // salvano nulla in questo punto.
    if (currentTool === "brush") pushUndoState();
    handleDraw(e);
});

canvas.addEventListener("mousemove", handleDraw);
canvas.addEventListener("mouseup", () => (isDrawing = false));
canvas.addEventListener("mouseleave", () => (isDrawing = false));
canvas.addEventListener("click", handleDraw);

document.addEventListener("keydown", (e) => {
    const ctrlOrCmd = e.ctrlKey || e.metaKey;
    if (!ctrlOrCmd) return;

    if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
    } else if (e.key === "y" || (e.key === "z" && e.shiftKey)) {
        e.preventDefault();
        redo();
    }
});

function clearCanvas() {
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    pixels = {};
    drawGrid();
}

// Wrapper per il pulsante "Cancella tutto": rende l'azione annullabile
function clearAll() {
    if (Object.keys(pixels).length > 0) pushUndoState();
    clearCanvas();
}

function changeGridSize() {
    gridSize = parseInt(document.getElementById("gridSizeSelect").value);
    pixelSize = canvas.width / gridSize;
    clearCanvas();
    // Le istantanee salvate finora hanno coordinate relative alla vecchia
    // griglia: non avrebbe senso riapplicarle con la nuova dimensione
    clearHistory();
}

function changePalette() {
    currentPalette = document.getElementById("paletteSelect").value;
    initColorPalette();
}

function downloadImage() {
    const link = document.createElement("a");
    link.download = "pixel-art.png";
    link.href = canvas.toDataURL();
    link.click();
}

// Cambia strumento a partire dal valore scelto in #toolSelect
function changeTool() {
    setTool(document.getElementById("toolSelect").value);
}

// Cambia strumento programmaticamente (es. dal contagocce torna al pennello
// dopo aver prelevato un colore), tenendo sincronizzati select e cursore
function setTool(tool) {
    currentTool = tool;
    document.getElementById("toolSelect").value = tool;
    canvas.style.cursor = tool === "eyedropper" ? "pointer" : "crosshair";
}

// Capienza pratica di un QR code affidabile da scansionare: oltre questa
// soglia (in caratteri dell'URL) passiamo al fallback "solo metadati".
const QR_URL_LENGTH_LIMIT = 2000;

function showQRCode() {
    const modal = document.getElementById("qrModal");
    const qrcodeDiv = document.getElementById("qrcode");
    const qrMessage = document.getElementById("qrMessage");

    // Pulisci il QR code e il messaggio precedenti
    qrcodeDiv.innerHTML = "";
    qrMessage.textContent = "";

    // Il PNG del canvas è troppo grande per un QR code: codifichiamo invece
    // solo i dati del disegno (griglia, palette, pixel), in forma compatta,
    // dentro l'URL della pagina stessa. Chi scansiona il codice riapre
    // questa pagina, che ricostruisce il disegno da quei dati.
    const compactData = { g: gridSize, p: currentPalette, d: pixels };
    const encodedData = encodeURIComponent(btoa(JSON.stringify(compactData)));
    const shareURL = `${location.origin}${location.pathname}?data=${encodedData}`;

    if (shareURL.length > QR_URL_LENGTH_LIMIT) {
        // Il disegno è troppo grande per starci in un QR code affidabile:
        // generiamo un QR con solo i metadati (nessun URL funzionante) e
        // avvisiamo l'utente invece di generare un codice illeggibile.
        new QRCode(qrcodeDiv, {
            text: `Pixel art editor - ${gridSize}x${gridSize}, ${Object.keys(pixels).length} pixel colorati`,
            width: 256,
            height: 256,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.L
        });
        qrMessage.textContent =
            "Il disegno è troppo grande per essere condiviso via QR code (limite di capienza del QR). Prova con una griglia più piccola o meno pixel colorati, oppure usa 'Esporta JSON'.";
    } else {
        new QRCode(qrcodeDiv, {
            text: shareURL,
            width: 256,
            height: 256,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.L
        });
        qrMessage.textContent =
            "Scansiona il codice per aprire il disegno e scaricarlo automaticamente come immagine.";
    }

    modal.style.display = "block";
}

function closeQRModal() {
    document.getElementById("qrModal").style.display = "none";
}

// Se la pagina è stata aperta scansionando un QR code (parametro ?data=
// nella query string), ricostruisce il disegno codificato e ne avvia
// automaticamente il download come immagine PNG.
function loadSharedDrawingFromURL() {
    const params = new URLSearchParams(window.location.search);
    const data = params.get("data");
    if (!data) return;

    try {
        const compactData = JSON.parse(atob(decodeURIComponent(data)));
        if (!compactData.d || !compactData.g) return;

        // Disegno caricato da zero: nessuna cronologia precedente ha senso
        clearHistory();

        gridSize = compactData.g;
        pixelSize = canvas.width / gridSize;
        document.getElementById("gridSizeSelect").value = gridSize;

        if (compactData.p) {
            currentPalette = compactData.p;
            document.getElementById("paletteSelect").value = currentPalette;
            initColorPalette();
        }

        clearCanvas();

        pixels = compactData.d;
        for (const key in pixels) {
            const [x, y] = key.split(",").map(Number);
            drawPixel(x, y, pixels[key]);
        }

        // Aspetta che il canvas sia renderizzato, poi scarica automaticamente
        // l'immagine e ripulisce l'URL per evitare download ripetuti a un
        // eventuale refresh della pagina.
        setTimeout(() => {
            downloadImage();
            const cleanURL = window.location.origin + window.location.pathname;
            window.history.replaceState({}, document.title, cleanURL);
        }, 100);
    } catch (error) {
        console.error("Errore nel caricamento del disegno condiviso:", error);
    }
}

function exportDrawing() {
    const exportData = {
        version: "1.0",
        gridSize: gridSize,
        palette: currentPalette,
        pixels: pixels,
        timestamp: new Date().toISOString()
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });

    const link = document.createElement("a");
    link.download = "pixel-art-export.json";
    link.href = URL.createObjectURL(dataBlob);
    link.click();
}

function importDrawing(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const importData = JSON.parse(e.target.result);

            // Verifica che il formato sia corretto
            if (!importData.pixels || !importData.gridSize) {
                alert(
                    "File non valido. Il file deve essere un export generato da questa applicazione."
                );
                return;
            }

            // Valida la dimensione della griglia: deve essere una di quelle
            // supportate dall'app, altrimenti si rischia di disegnare una
            // griglia enorme (o vuota) e di bloccare la pagina
            const newGridSize = Number(importData.gridSize);
            if (!VALID_GRID_SIZES.includes(newGridSize)) {
                alert(
                    `Dimensione griglia non valida nel file (${importData.gridSize}). Valori ammessi: ${VALID_GRID_SIZES.join(", ")}.`
                );
                return;
            }

            // Valida la palette, se presente
            if (importData.palette && !VALID_PALETTES.includes(importData.palette)) {
                alert(`Palette non valida nel file (${importData.palette}).`);
                return;
            }

            // Filtra i pixel: tengo solo coordinate intere dentro la griglia
            // e colori in formato "rgb(r,g,b)" valido, scartando in
            // silenzio eventuali voci malformate invece di disegnarle o
            // andare in errore
            const coordPattern = /^(\d+),(\d+)$/;
            const validPixels = {};
            for (const key in importData.pixels) {
                const match = coordPattern.exec(key);
                if (!match) continue;

                const x = Number(match[1]);
                const y = Number(match[2]);
                if (x >= newGridSize || y >= newGridSize) continue;

                const color = importData.pixels[key];
                if (!isValidRGBColor(color)) continue;

                validPixels[key] = color;
            }

            // Se la griglia cambia, le istantanee salvate finora non hanno
            // più senso (vedi changeGridSize); altrimenti l'import diventa
            // un normale passo annullabile con undo
            if (newGridSize !== gridSize) {
                clearHistory();
            } else {
                pushUndoState();
            }

            // Ripristina la dimensione della griglia
            gridSize = newGridSize;
            pixelSize = canvas.width / gridSize;
            document.getElementById("gridSizeSelect").value = gridSize;

            // Ripristina la palette se presente
            if (importData.palette) {
                currentPalette = importData.palette;
                document.getElementById("paletteSelect").value = currentPalette;
                initColorPalette();
            }

            // Pulisci il canvas
            clearCanvas();

            // Ridisegna i pixel validati
            pixels = validPixels;
            for (let key in pixels) {
                const [x, y] = key.split(",").map(Number);
                drawPixel(x, y, pixels[key]);
            }

            const skippedCount =
                Object.keys(importData.pixels).length - Object.keys(validPixels).length;
            alert(
                skippedCount > 0
                    ? `Disegno importato con successo (${skippedCount} pixel non validi ignorati).`
                    : "Disegno importato con successo!"
            );
        } catch (error) {
            alert(
                "Errore durante l'importazione del file. Assicurati che sia un file JSON valido."
            );
            console.error(error);
        }
    };

    reader.readAsText(file);

    // Reset dell'input file per permettere di importare lo stesso file più volte
    event.target.value = "";
}

// Inizializza
clearCanvas();
initColorPalette();
loadSharedDrawingFromURL();
updateUndoRedoButtons();
