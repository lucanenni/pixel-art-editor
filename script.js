const canvas = document.getElementById("pixelCanvas");
const ctx = canvas.getContext("2d");
let gridSize = 32;
let pixelSize = canvas.width / gridSize;

// Deve sempre essere in formato "rgb(r,g,b)": è lo stesso formato prodotto
// dalla tavolozza e richiesto da isValidRGBColor() in fase di import/
// autosalvataggio. Un valore come "#000000" verrebbe scartato in silenzio
// dal filtro di validazione la prima volta che il disegno viene ricaricato
// (era un bug: v1.2.1, vedi CHANGELOG).
let currentColor = "rgb(0,0,0)";
let isDrawing = false;
let pixels = {};
let currentPalette = "vga";
// Strumento attivo: 'brush' (pennello, default) | 'eyedropper' (contagocce)
let currentTool = "brush";

// VALID_GRID_SIZES, VALID_PALETTES, RGB_COLOR_PATTERN, isValidRGBColor e
// filterValidPixels sono definite in logic.js (caricato prima di questo
// file in index.html), insieme alle altre funzioni pure testabili in Node.

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
    renderPixels(snapshot);
}

function undo() {
    if (undoStack.length === 0) return;
    redoStack.push(snapshotPixels());
    restorePixels(undoStack.pop());
    updateUndoRedoButtons();
    saveState();
}

function redo() {
    if (redoStack.length === 0) return;
    undoStack.push(snapshotPixels());
    restorePixels(redoStack.pop());
    updateUndoRedoButtons();
    saveState();
}

// Salvataggio automatico in localStorage: chiave unica per l'app, disegno
// completo (griglia, palette, pixel). È un extra di comodità, non deve mai
// far fallire un'azione dell'utente se localStorage non è disponibile
// (modalità privata, quota piena, ambienti senza storage, ...).
const AUTOSAVE_KEY = "pixelArtEditorAutosave";

function saveState() {
    try {
        localStorage.setItem(
            AUTOSAVE_KEY,
            JSON.stringify({ version: "1.0", gridSize, palette: currentPalette, pixels })
        );
    } catch (error) {
        console.warn("Impossibile salvare automaticamente il disegno:", error);
    }
}

// Ritorna true se ha effettivamente ripristinato un disegno salvato in
// precedenza, false altrimenti (nessun salvataggio, dati non validi, o
// localStorage non disponibile).
function loadAutosavedState() {
    let saved;
    try {
        const raw = localStorage.getItem(AUTOSAVE_KEY);
        if (!raw) return false;
        saved = JSON.parse(raw);
    } catch (error) {
        console.warn("Impossibile leggere il disegno salvato automaticamente:", error);
        return false;
    }

    if (!saved || !saved.pixels) return false;

    const newGridSize = Number(saved.gridSize);
    if (!VALID_GRID_SIZES.includes(newGridSize)) return false;
    if (saved.palette && !VALID_PALETTES.includes(saved.palette)) return false;

    gridSize = newGridSize;
    pixelSize = canvas.width / gridSize;
    document.getElementById("gridSizeSelect").value = gridSize;

    if (saved.palette) {
        currentPalette = saved.palette;
        document.getElementById("paletteSelect").value = currentPalette;
        initColorPalette();
    }

    renderPixels(filterValidPixels(saved.pixels, gridSize));

    return true;
}

// generateCGAColors/generateEGAColors/generateVGAColors sono definite in
// logic.js insieme alle altre funzioni pure testabili in Node.

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
        // <button>, non <div>: raggiungibile e attivabile da tastiera
        // (Tab + Invio/Spazio) senza bisogno di codice aggiuntivo
        const swatch = document.createElement("button");
        swatch.type = "button";
        swatch.className = "color-swatch";
        swatch.style.backgroundColor = color;
        swatch.dataset.color = color; // usato per confronto esatto in updateCurrentColor()
        swatch.title = color;
        swatch.setAttribute("aria-label", `Colore ${color}`);
        swatch.setAttribute("aria-pressed", "false");
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
    const currentColorEl = document.getElementById("currentColor");
    currentColorEl.style.backgroundColor = currentColor;
    currentColorEl.setAttribute("aria-label", currentColor);

    // Tiene sincronizzato aria-pressed sugli swatch col colore attuale, per
    // chi naviga da tastiera o con uno screen reader
    document.querySelectorAll("#colorPalette .color-swatch").forEach((swatch) => {
        swatch.setAttribute("aria-pressed", String(swatch.dataset.color === currentColor));
    });
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

    // Gli eventi touch espongono le coordinate dentro e.touches[0] invece
    // che direttamente su e.clientX/e.clientY come i mouse event
    const point = e.touches && e.touches.length > 0 ? e.touches[0] : e;

    const x = Math.floor(((point.clientX - rect.left) * scaleX) / pixelSize);
    const y = Math.floor(((point.clientY - rect.top) * scaleY) / pixelSize);

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

// Riempimento a secchiello: colora tutte le celle adiacenti (su/giù/sx/dx)
// che condividono lo stesso colore della cella di partenza. Una cella mai
// disegnata conta come colore "vuoto" (null), così il secchiello riesce a
// riempire anche lo sfondo bianco.
function floodFill(startX, startY, fillColor) {
    const targetColor = pixels[`${startX},${startY}`] || null;
    if (targetColor === fillColor) return; // nessun cambiamento da fare

    // Un intero riempimento è un solo passo di undo
    pushUndoState();

    const stack = [[startX, startY]];
    const visited = new Set();

    while (stack.length > 0) {
        const [x, y] = stack.pop();
        const key = `${x},${y}`;
        if (visited.has(key)) continue;
        if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) continue;
        if ((pixels[key] || null) !== targetColor) continue;

        visited.add(key);
        drawPixel(x, y, fillColor);

        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }

    saveState();
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

    // Modalità secchiello: un solo riempimento al click, non durante il
    // trascinamento (altrimenti si rischia di riempire più zone di seguito
    // senza che l'utente lo intenda)
    if (currentTool === "bucket") {
        if (e.type === "mousemove" || e.type === "touchmove") return;
        floodFill(x, y, currentColor);
        return;
    }

    // Modalità disegno normale (pennello)
    if (!isDrawing && e.type !== "click") return;
    drawPixel(x, y, currentColor);
}

// Inizio di un tratto di disegno, condiviso tra mouse e touch
function startStroke(e) {
    isDrawing = true;
    // Un intero tratto (drag) è un solo passo di undo: salvo lo stato solo
    // all'inizio del tratto, non ad ogni pixel disegnato durante il drag.
    // Gli altri strumenti (contagocce, secchiello) gestiscono il proprio
    // undo per conto loro (il secchiello solo se il riempimento cambia
    // davvero qualcosa), quindi qui non salvano nulla.
    if (currentTool === "brush") pushUndoState();
    handleDraw(e);
}

// Fine di un tratto di disegno, condivisa tra mouse e touch: salva lo stato
// (autosalvataggio) una volta per tratto, non ad ogni pixel disegnato
function endStroke() {
    isDrawing = false;
    saveState();
}

canvas.addEventListener("mousedown", startStroke);
canvas.addEventListener("mousemove", handleDraw);
canvas.addEventListener("mouseup", endStroke);
canvas.addEventListener("mouseleave", endStroke);
canvas.addEventListener("click", handleDraw);

// Equivalenti touch (tablet/smartphone), stessa logica dei corrispondenti
// eventi mouse. { passive: false } + preventDefault() servono per evitare
// che il dito che disegna faccia anche scorrere/zoomare la pagina.
canvas.addEventListener(
    "touchstart",
    (e) => {
        e.preventDefault();
        startStroke(e);
    },
    { passive: false }
);

canvas.addEventListener(
    "touchmove",
    (e) => {
        e.preventDefault();
        handleDraw(e);
    },
    { passive: false }
);

canvas.addEventListener("touchend", endStroke);
canvas.addEventListener("touchcancel", endStroke);

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
    // clearCanvas() viene sempre chiamata subito dopo che gridSize è stato
    // aggiornato (resize manuale, import, QR, autosalvataggio), quindi è il
    // punto giusto per tenere sincronizzata la descrizione per screen reader
    canvas.setAttribute("aria-label", `Area di disegno, griglia ${gridSize} per ${gridSize} celle`);
}

// Pulisce il canvas e ridisegna ogni pixel dell'oggetto dato ("x,y" -> colore).
// Unico punto del codice che ricostruisce il disegno da un oggetto pixels:
// restore da undo/redo, import JSON/XML, QR condiviso e autosalvataggio
// passano tutti da qui, invece di ripetere lo stesso loop in ognuno.
function renderPixels(pixelsObj) {
    clearCanvas(); // azzera pixels e ridisegna sfondo + griglia
    for (const key in pixelsObj) {
        const [x, y] = key.split(",").map(Number);
        drawPixel(x, y, pixelsObj[key]);
    }
}

// Wrapper per il pulsante "Cancella tutto": rende l'azione annullabile
function clearAll() {
    if (Object.keys(pixels).length > 0) pushUndoState();
    clearCanvas();
    saveState();
}

function changeGridSize() {
    gridSize = parseInt(document.getElementById("gridSizeSelect").value);
    pixelSize = canvas.width / gridSize;
    clearCanvas();
    // Le istantanee salvate finora hanno coordinate relative alla vecchia
    // griglia: non avrebbe senso riapplicarle con la nuova dimensione
    clearHistory();
    saveState();
}

function changePalette() {
    currentPalette = document.getElementById("paletteSelect").value;
    initColorPalette();
    saveState();
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
const TOOL_CURSORS = {
    brush: "crosshair",
    eyedropper: "pointer",
    bucket: "cell",
};

function setTool(tool) {
    currentTool = tool;
    document.getElementById("toolSelect").value = tool;
    canvas.style.cursor = TOOL_CURSORS[tool] || "crosshair";
}

// Capienza pratica di un QR code affidabile da scansionare: oltre questa
// soglia (in caratteri dell'URL) passiamo al fallback "solo metadati".
const QR_URL_LENGTH_LIMIT = 2000;

// Elemento che aveva il focus prima dell'apertura della modale QR, per
// poterlo ripristinare alla chiusura
let qrModalTrigger = null;

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

    // Ricorda chi ha aperto la modale, per restituirgli il focus alla
    // chiusura, e sposta subito il focus dentro la modale (unico elemento
    // interattivo al suo interno: il pulsante di chiusura)
    qrModalTrigger = document.activeElement;
    modal.style.display = "block";
    document.getElementById("qrModalCloseBtn").focus();
}

function closeQRModal() {
    document.getElementById("qrModal").style.display = "none";
    if (qrModalTrigger) {
        qrModalTrigger.focus();
        qrModalTrigger = null;
    }
}

// Chiude la modale QR con Esc, e mantiene il focus al suo interno mentre è
// aperta: l'unico elemento raggiungibile da tastiera è il pulsante di
// chiusura, quindi Tab/Shift+Tab lo rifocalizzano invece di uscire dietro
// la modale
document.addEventListener("keydown", (e) => {
    const modal = document.getElementById("qrModal");
    if (modal.style.display !== "block") return;

    if (e.key === "Escape") {
        closeQRModal();
    } else if (e.key === "Tab") {
        e.preventDefault();
        document.getElementById("qrModalCloseBtn").focus();
    }
});

// Se la pagina è stata aperta scansionando un QR code (parametro ?data=
// nella query string), ricostruisce il disegno codificato e ne avvia
// automaticamente il download come immagine PNG.
// Ritorna true se ha effettivamente caricato un disegno dall'URL, false
// altrimenti (nessun parametro ?data=, o dati non validi) — usato
// all'avvio per decidere se provare a ripristinare l'autosalvataggio.
function loadSharedDrawingFromURL() {
    const params = new URLSearchParams(window.location.search);
    const data = params.get("data");
    if (!data) return false;

    try {
        const compactData = JSON.parse(atob(decodeURIComponent(data)));
        if (!compactData.d || !compactData.g) return false;

        // Gli stessi controlli usati per l'import JSON: i dati nell'URL
        // potrebbero essere stati modificati a mano, non fidarsi ciecamente
        const newGridSize = Number(compactData.g);
        if (!VALID_GRID_SIZES.includes(newGridSize)) return false;
        if (compactData.p && !VALID_PALETTES.includes(compactData.p)) return false;
        const validPixels = filterValidPixels(compactData.d, newGridSize);

        // Disegno caricato da zero: nessuna cronologia precedente ha senso
        clearHistory();

        gridSize = newGridSize;
        pixelSize = canvas.width / gridSize;
        document.getElementById("gridSizeSelect").value = gridSize;

        if (compactData.p) {
            currentPalette = compactData.p;
            document.getElementById("paletteSelect").value = currentPalette;
            initColorPalette();
        }

        renderPixels(validPixels);

        saveState();

        // Aspetta che il canvas sia renderizzato, poi scarica automaticamente
        // l'immagine e ripulisce l'URL per evitare download ripetuti a un
        // eventuale refresh della pagina.
        setTimeout(() => {
            downloadImage();
            const cleanURL = window.location.origin + window.location.pathname;
            window.history.replaceState({}, document.title, cleanURL);
        }, 100);

        return true;
    } catch (error) {
        console.error("Errore nel caricamento del disegno condiviso:", error);
        return false;
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

// Rende sicura una stringa da inserire in un valore di attributo XML
// escapeXMLAttribute è definita in logic.js insieme alle altre funzioni
// pure testabili in Node.

// Stesso disegno dell'export JSON, in un formato XML equivalente:
// <pixelArt gridSize="..." palette="..."><pixels><pixel x="" y="" color=""/>...
function exportDrawingXML() {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += `<pixelArt version="1.0" gridSize="${gridSize}" palette="${currentPalette}" timestamp="${new Date().toISOString()}">\n`;
    xml += "  <pixels>\n";
    for (const key in pixels) {
        const [x, y] = key.split(",").map(Number);
        xml += `    <pixel x="${x}" y="${y}" color="${escapeXMLAttribute(pixels[key])}" />\n`;
    }
    xml += "  </pixels>\n";
    xml += "</pixelArt>\n";

    const dataBlob = new Blob([xml], { type: "application/xml" });

    const link = document.createElement("a");
    link.download = "pixel-art-export.xml";
    link.href = URL.createObjectURL(dataBlob);
    link.click();
}

// Applica uno stato di disegno già validato (griglia, palette, pixel) e lo
// rende quello corrente: gestisce cronologia undo, ridisegno del canvas e
// autosalvataggio. Riusata da import JSON e import XML, che si occupano solo
// di leggere e validare il proprio formato prima di richiamarla.
function applyImportedDrawing(newGridSize, palette, validPixels) {
    // Se la griglia cambia, le istantanee salvate finora non hanno più senso
    // (vedi changeGridSize); altrimenti l'import diventa un normale passo
    // annullabile con undo
    if (newGridSize !== gridSize) {
        clearHistory();
    } else {
        pushUndoState();
    }

    gridSize = newGridSize;
    pixelSize = canvas.width / gridSize;
    document.getElementById("gridSizeSelect").value = gridSize;

    if (palette) {
        currentPalette = palette;
        document.getElementById("paletteSelect").value = currentPalette;
        initColorPalette();
    }

    renderPixels(validPixels);

    saveState();
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
            const validPixels = filterValidPixels(importData.pixels, newGridSize);

            applyImportedDrawing(newGridSize, importData.palette, validPixels);

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

function importDrawingXML(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const xmlDoc = new DOMParser().parseFromString(e.target.result, "application/xml");

            // DOMParser non lancia eccezioni su XML malformato: inserisce
            // invece un nodo <parsererror> nel documento risultante
            if (xmlDoc.querySelector("parsererror")) {
                alert("File XML non valido o mal formato.");
                return;
            }

            const root = xmlDoc.querySelector("pixelArt");
            if (!root) {
                alert(
                    "File non valido. Il file deve essere un export XML generato da questa applicazione."
                );
                return;
            }

            const gridSizeAttr = root.getAttribute("gridSize");
            const newGridSize = Number(gridSizeAttr);
            if (!VALID_GRID_SIZES.includes(newGridSize)) {
                alert(
                    `Dimensione griglia non valida nel file (${gridSizeAttr}). Valori ammessi: ${VALID_GRID_SIZES.join(", ")}.`
                );
                return;
            }

            const palette = root.getAttribute("palette");
            if (palette && !VALID_PALETTES.includes(palette)) {
                alert(`Palette non valida nel file (${palette}).`);
                return;
            }

            // Costruisco un oggetto pixels grezzo dai nodi <pixel x="" y=""
            // color="" />, poi lo filtro con la stessa validazione dell'import
            // JSON (coordinate dentro la griglia, colore rgb(...) valido)
            const rawPixels = {};
            const pixelNodes = root.querySelectorAll("pixel");
            pixelNodes.forEach((node) => {
                const x = node.getAttribute("x");
                const y = node.getAttribute("y");
                const color = node.getAttribute("color");
                if (x === null || y === null || color === null) return;
                rawPixels[`${x},${y}`] = color;
            });

            const validPixels = filterValidPixels(rawPixels, newGridSize);

            applyImportedDrawing(newGridSize, palette, validPixels);

            const skippedCount = pixelNodes.length - Object.keys(validPixels).length;
            alert(
                skippedCount > 0
                    ? `Disegno importato con successo (${skippedCount} pixel non validi ignorati).`
                    : "Disegno importato con successo!"
            );
        } catch (error) {
            alert(
                "Errore durante l'importazione del file. Assicurati che sia un file XML valido."
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
// Un disegno condiviso via QR ha la priorità sull'autosalvataggio locale;
// altrimenti, se presente, ripristino l'ultimo disegno salvato in automatico
if (!loadSharedDrawingFromURL()) {
    loadAutosavedState();
}
updateUndoRedoButtons();
