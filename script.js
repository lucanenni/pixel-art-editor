const canvas = document.getElementById("pixelCanvas");
const ctx = canvas.getContext("2d");
let gridSize = 32;
let pixelSize = canvas.width / gridSize;

let currentColor = "#000000";
let isDrawing = false;
let pixels = {};
let currentPalette = "vga";
let eyedropperMode = false;

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
    if (eyedropperMode) {
        const pixelKey = `${x},${y}`;
        if (pixels[pixelKey]) {
            selectColor(pixels[pixelKey]);
            document.getElementById("eyedropperMode").checked = false;
            eyedropperMode = false;
            canvas.style.cursor = "crosshair";
        }
        return;
    }

    // Modalità disegno normale
    if (!isDrawing && e.type !== "click") return;
    drawPixel(x, y, currentColor);
}

canvas.addEventListener("mousedown", (e) => {
    isDrawing = true;
    handleDraw(e);
});

canvas.addEventListener("mousemove", handleDraw);
canvas.addEventListener("mouseup", () => (isDrawing = false));
canvas.addEventListener("mouseleave", () => (isDrawing = false));
canvas.addEventListener("click", handleDraw);

function clearCanvas() {
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    pixels = {};
    drawGrid();
}

function changeGridSize() {
    gridSize = parseInt(document.getElementById("gridSizeSelect").value);
    pixelSize = canvas.width / gridSize;
    clearCanvas();
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

function toggleEyedropper() {
    eyedropperMode = document.getElementById("eyedropperMode").checked;
    canvas.style.cursor = eyedropperMode ? "pointer" : "crosshair";
}

function showQRCode() {
    const modal = document.getElementById("qrModal");
    const qrcodeDiv = document.getElementById("qrcode");

    // Pulisci il QR code precedente
    qrcodeDiv.innerHTML = "";

    // Genera il data URL dell'immagine
    const imageDataURL = canvas.toDataURL("image/png");

    // Crea il QR code
    new QRCode(qrcodeDiv, {
        text: imageDataURL,
        width: 256,
        height: 256,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.L
    });

    modal.style.display = "block";
}

function closeQRModal() {
    document.getElementById("qrModal").style.display = "none";
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

            // Ripristina la dimensione della griglia
            gridSize = importData.gridSize;
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

            // Ridisegna i pixel
            pixels = importData.pixels;
            for (let key in pixels) {
                const [x, y] = key.split(",").map(Number);
                drawPixel(x, y, pixels[key]);
            }

            alert("Disegno importato con successo!");
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
