/**
 * Pixel Unit RTS Prototype
 * * Engine-Architektur:
 * - Map: 256x256 Pixel.
 * - State: TypedArrays (Uint8) für Terrain, Besitzer, Farbe, Zielvektoren.
 * - Loop: Fixed Time Step (60 UPS - Updates per Second).
 * - Rendering: Schreiben in Uint32Array Puffer -> putImageData.
 */

// --- KONFIGURATION ---
const WIDTH = 256;
const HEIGHT = 256;
const SIZE = WIDTH * HEIGHT;
const MAX_RESOURCE = 2000;

// Farben (RGB Integer für 32-Bit Buffer: AABBGGRR in Little Endian)
// 0: Empty, 1: Red, 2: Green, 3: Blue, 4: Yellow, 5: Wall, 6: Base
const COLORS_HEX = [
    0xFF000000, // 0: Schwarz (Leer)
    0xFF4444FF, // 1: Rot
    0xFF44FF44, // 2: Grün
    0xFFFF4444, // 3: Blau
    0xFF44FFFF, // 4: Gelb
    0xFF808080, // 5: Wand (Grau)
    0xFFFFFFFF  // 6: Basis (Weiß)
];

// Zyklus für Stein-Schere-Papier (1 > 2 > 3 > 4 > 1...)
// Logic: if (attacker == defender - 1 || (attacker == 4 && defender == 1)) Win
function beats(colorA, colorB) {
    if (colorA === colorB) return 0; // Draw
    if ((colorA === 1 && colorB === 2) || 
        (colorA === 2 && colorB === 3) || 
        (colorA === 3 && colorB === 4) || 
        (colorA === 4 && colorB === 1)) {
        return 1; // A wins
    }
    return -1; // B wins
}

// --- STATE MANAGEMENT ---
const state = {
    // 0: Leer, 1: P1, 2: AI/Enemy
    owner: new Uint8Array(SIZE), 
    // 0: None, 1-4: Unit Color, 5: Wall, 6: Base
    type: new Uint8Array(SIZE), 
    // Zielkoordinaten für "Fluid" Movement (gepackt x + y*256)
    // 0 means no target.
    target: new Uint32Array(SIZE),
    
    // Fog of War (0: Hidden, 1: Visible, 2: Explored)
    visibility: new Uint8Array(SIZE),
    
    resources: 500,
    selectedColor: 1, // Start mit Rot
    baseIndex: 0,     // Index der Basis
    
    // Player Input Targets (wohin sollen Einheiten fließen?)
    clickTarget: null, // {x, y}
    recalling: false
};

// Canvas & Context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
const imgData = ctx.createImageData(WIDTH, HEIGHT);
const buf32 = new Uint32Array(imgData.data.buffer);

// --- INITIALISIERUNG ---

function init() {
    // 1. Map Generierung (Noise Simulation)
    // Einfache Mauern erstellen
    for (let i = 0; i < SIZE; i++) {
        if (Math.random() > 0.98) state.type[i] = 5; // Zufällige Wände
    }
    
    // 2. Basis setzen (Mitte unten)
    const bx = 128, by = 230;
    state.baseIndex = by * WIDTH + bx;
    // Basis ist 3x3 Pixel groß
    for(let y=-1; y<=1; y++) {
        for(let x=-1; x<=1; x++) {
            let idx = (by+y)*WIDTH + (bx+x);
            state.type[idx] = 6;
            state.owner[idx] = 1;
        }
    }

    // 3. UI Bindings
    setupUI();

    // 4. Start Loop
    requestAnimationFrame(gameLoop);
}

function setupUI() {
    // Farbauswahl
    document.querySelectorAll('.btn-color').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.btn-color').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            state.selectedColor = parseInt(e.target.dataset.color);
            state.recalling = false;
        });
    });

    // Spawn Button
    document.getElementById('btn-spawn').addEventListener('click', () => {
        spawnUnits(state.selectedColor, 20); // 20 Pixel spawnen
    });

    // Rückruf
    document.getElementById('btn-recall').addEventListener('click', () => {
        state.recalling = true;
        state.clickTarget = null; // Ziel aufheben, Basis wird Ziel
    });

    // Export
    document.getElementById('btn-export').addEventListener('click', exportMapLayer);

    // Maus Input (Koordinaten Mapping)
    canvas.addEventListener('mousedown', (e) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = WIDTH / rect.width;
        const scaleY = HEIGHT / rect.height;
        
        const tx = Math.floor((e.clientX - rect.left) * scaleX);
        const ty = Math.floor((e.clientY - rect.top) * scaleY);
        
        // Rechte Maustaste: Rückruf, Linke: Move
        if (e.button === 2) {
            state.recalling = true;
            state.clickTarget = null;
        } else {
            state.recalling = false;
            state.clickTarget = {x: tx, y: ty};
        }
    });
    
    // Context Menu unterdrücken
    canvas.addEventListener('contextmenu', e => e.preventDefault());
}

// --- LOGIK CORE (Cellular Automata / Fluid) ---

function spawnUnits(colorIdx, amount) {
    if (state.resources < amount) amount = state.resources;
    if (amount <= 0) return;

    let spawned = 0;
    // Spiral-Suche um die Basis für freien Platz
    let x = state.baseIndex % WIDTH;
    let y = Math.floor(state.baseIndex / WIDTH);
    
    for (let r = 2; r < 20; r++) { // Radius erhöhen
        if (spawned >= amount) break;
        for (let i = 0; i < r * 2 * Math.PI; i++) { // Kreis abtasten
            let angle = (i / (r * 2)) * Math.PI * 2;
            let sx = Math.floor(x + Math.cos(angle) * r);
            let sy = Math.floor(y + Math.sin(angle) * r);
            
            if (sx >= 0 && sx < WIDTH && sy >= 0 && sy < HEIGHT) {
                let idx = sy * WIDTH + sx;
                if (state.type[idx] === 0) { // Wenn leer
                    state.type[idx] = colorIdx;
                    state.owner[idx] = 1; // Player 1
                    // Ziel setzen (aktuelles Klickziel oder warten)
                    state.target[idx] = state.clickTarget ? 
                        (state.clickTarget.y * WIDTH + state.clickTarget.x) : 0;
                    
                    spawned++;
                    state.resources--;
                    if (spawned >= amount) break;
                }
            }
        }
    }
    updateHUD();
}

function update() {
    // Performance: Wir iterieren über das Array. 
    // Um Bias zu vermeiden (alle bewegen sich nur nach rechts unten),
    // kann man die Iterationsrichtung jeden Frame wechseln (optional, hier einfach gehalten).

    // Globales Ziel definieren (Basis wenn Recall, sonst Klick)
    let globalTargetIdx = 0;
    if (state.recalling) globalTargetIdx = state.baseIndex;
    else if (state.clickTarget) globalTargetIdx = state.clickTarget.y * WIDTH + state.clickTarget.x;

    // Temp Array für Bewegungen, um Konflikte innerhalb eines Frames zu vermeiden?
    // Für "Schleim"-Verhalten ist in-place Bearbeitung oft okay und chaotischer (organischer).
    // Wir nutzen einen einfachen Stochastic-Ansatz.
    
    // Random Offset für Iteration um Musterbildung zu brechen
    const startOffset = Math.floor(Math.random() * SIZE);

    for (let k = 0; k < SIZE; k++) {
        let i = (k + startOffset) % SIZE; // Wraparound index

        // Nur verarbeiten wenn eigene Unit (Typ 1-4)
        if (state.owner[i] !== 1 || state.type[i] < 1 || state.type[i] > 4) continue;

        // Rückruf Logic: Wenn an Basis angekommen -> Ressource
        if (state.recalling) {
            let dx = (state.baseIndex % WIDTH) - (i % WIDTH);
            let dy = Math.floor(state.baseIndex / WIDTH) - Math.floor(i / WIDTH);
            if (dx*dx + dy*dy < 9) { // Nahe genug
                state.type[i] = 0;
                state.owner[i] = 0;
                state.resources++;
                continue;
            }
        }

        // Bewegung
        let currentTarget = globalTargetIdx;
        
        if (currentTarget !== 0) {
            moveUnit(i, currentTarget);
        } else {
            // Idle Verhalten: "Kriechen" oder stehen bleiben
            // jitter(i); 
        }
    }
    
    updateFogOfWar();
    updateHUD();
}

function moveUnit(idx, targetIdx) {
    const cx = idx % WIDTH;
    const cy = Math.floor(idx / WIDTH);
    const tx = targetIdx % WIDTH;
    const ty = Math.floor(targetIdx / WIDTH);

    // Einfacher Richtungsvektor
    let dx = Math.sign(tx - cx);
    let dy = Math.sign(ty - cy);

    // Wenn wir schon da sind
    if (dx === 0 && dy === 0) return;

    // Nächster Schritt (gewünscht)
    let nx = cx + dx;
    let ny = cy + dy;
    let nIdx = ny * WIDTH + nx;

    // Kollisionsprüfung & Kampf
    if (isValid(nx, ny)) {
        interact(idx, nIdx);
    } else {
        // Blockiert? Versuche Ausweichbewegung (Semi-Random für Fluidität)
        // Wenn horizontal blockiert, versuche diagonal oder vertikal
        if (Math.random() > 0.5) {
            // Versuch X-Achse zu halten, Y ändern
            interact(idx, (cy + (Math.random() > 0.5 ? 1 : -1)) * WIDTH + (cx + dx));
        } else {
             // Versuch Y-Achse zu halten, X ändern
            interact(idx, (cy + dy) * WIDTH + (cx + (Math.random() > 0.5 ? 1 : -1)));
        }
    }
}

function isValid(x, y) {
    return x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT;
}

function interact(fromIdx, toIdx) {
    if (toIdx < 0 || toIdx >= SIZE) return;

    const fromType = state.type[fromIdx];
    const toType = state.type[toIdx];
    const toOwner = state.owner[toIdx];

    // 1. Leeres Feld: Bewegen
    if (toType === 0) {
        // Swap (Bewegen)
        state.type[toIdx] = fromType;
        state.owner[toIdx] = state.owner[fromIdx];
        state.type[fromIdx] = 0;
        state.owner[fromIdx] = 0;
        return;
    }

    // 2. Wand: Blockiert (Nichts tun)
    if (toType === 5) return;

    // 3. Eigene Basis: Blockiert
    if (toType === 6) return;

    // 4. Eigene Einheit (gleiche Farbe): Blockiert (Blob Bildung)
    if (state.owner[fromIdx] === toOwner && fromType === toType) return;

    // 5. Gegner oder andere Farbe (Hier könnte Friendly Fire sein wenn gewünscht)
    // Aktuell: Kampf auch zwischen eigenen Farben möglich? 
    // Im Prompt steht: "Wenn Pixel verschiedener Farben aufeinandertreffen"
    if (fromType !== toType) {
        const result = beats(fromType, toType);
        if (result === 1) {
            // Angreifer gewinnt -> Ersetzt Verteidiger
            state.type[toIdx] = fromType;
            state.owner[toIdx] = state.owner[fromIdx];
            state.type[fromIdx] = 0;
            state.owner[fromIdx] = 0;
        } else if (result === -1) {
            // Verteidiger gewinnt -> Angreifer stirbt
            state.type[fromIdx] = 0;
            state.owner[fromIdx] = 0;
        } else {
            // Gleichstand (z.B. 50% Chance)
            if (Math.random() > 0.5) {
                 state.type[fromIdx] = 0; // Einer stirbt zufällig
                 state.owner[fromIdx] = 0;
            }
        }
    }
}

// --- RENDERING & FOW ---

function updateFogOfWar() {
    // Simpler FoW: Alles löschen (oder dimmen), dann um jede Unit herum aufdecken.
    // Performance: Für Prototyp einfach Distanz um Einheiten.
    // Optimierung: Floodfill oder niedrigere Auflösung wäre besser.
    // Hier: Simple "Active Tiles" Liste könnte helfen, aber wir iterieren eh.
    
    // Reset Visibility Layer (0 = Fog, 1 = Visible)
    // Wir lassen "Explored" (2) weg für Einfachheit oder machen nur temporary FoW
    state.visibility.fill(0);

    // Basis immer sichtbar
    markVisible(state.baseIndex % WIDTH, Math.floor(state.baseIndex / WIDTH), 30);

    // Iteration über alle Pixel ist zu teuer für Radius-Check pro Pixel (256x256 * Radius).
    // Besser: Sichtbarkeit nur grob berechnen oder Sichtfeld der Einheiten ist klein (3px).
    const viewRadius = 8;
    const r2 = viewRadius * viewRadius;

    for (let i = 0; i < SIZE; i++) {
        if (state.owner[i] === 1) { // Wenn eigene Einheit
             let ux = i % WIDTH;
             let uy = Math.floor(i / WIDTH);
             
             // Sehr simpler Box-Check für Performance statt Kreis
             for (let dy = -viewRadius; dy <= viewRadius; dy+=2) {
                 for (let dx = -viewRadius; dx <= viewRadius; dx+=2) {
                     let vx = ux + dx;
                     let vy = uy + dy;
                     if (vx >= 0 && vx < WIDTH && vy >= 0 && vy < HEIGHT) {
                         state.visibility[vy * WIDTH + vx] = 1;
                     }
                 }
             }
        }
    }
}

function markVisible(cx, cy, radius) {
    for (let y = -radius; y <= radius; y++) {
        for (let x = -radius; x <= radius; x++) {
            if (x*x + y*y <= radius*radius) {
                let px = cx + x;
                let py = cy + y;
                if (px >= 0 && px < WIDTH && py >= 0 && py < HEIGHT) {
                    state.visibility[py * WIDTH + px] = 1;
                }
            }
        }
    }
}

function draw() {
    const fowEnabled = document.getElementById('chk-fow').checked;

    for (let i = 0; i < SIZE; i++) {
        let type = state.type[i];
        let isVisible = state.visibility[i] === 1;

        if (fowEnabled && !isVisible && type !== 5) { // Wände evtl. immer sichtbar lassen als Karte?
            buf32[i] = 0xFF000000; // Schwarz
            // Wenn wir erforschtes Gebiet grau wollen, bräuchten wir State 2
            continue;
        }

        // Farbe setzen
        buf32[i] = COLORS_HEX[type];
    }

    ctx.putImageData(imgData, 0, 0);
    
    // UI Overlay im Canvas (z.B. Zielmarker)
    if (state.clickTarget) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(state.clickTarget.x, state.clickTarget.y, 5, 0, Math.PI*2);
        ctx.stroke();
    }
}

function updateHUD() {
    document.getElementById('res-count').innerText = state.resources;
}

function exportMapLayer() {
    // Erstelle temporären Canvas
    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = WIDTH;
    tmpCanvas.height = HEIGHT;
    const tmpCtx = tmpCanvas.getContext('2d');
    const tmpImgData = tmpCtx.createImageData(WIDTH, HEIGHT);
    const tmpBuf = new Uint32Array(tmpImgData.data.buffer);

    // Nur Spieler Units zeichnen
    for(let i=0; i<SIZE; i++) {
        if(state.owner[i] === 1) {
            tmpBuf[i] = COLORS_HEX[state.type[i]];
        } else {
            tmpBuf[i] = 0x00000000; // Transparent
        }
    }
    
    tmpCtx.putImageData(tmpImgData, 0, 0);
    const link = document.createElement('a');
    link.download = 'player_layer.png';
    link.href = tmpCanvas.toDataURL();
    link.click();
}

// --- MAIN LOOP ---

let lastTime = 0;
const TICK_RATE = 1000 / 30; // 30 Ticks Logik
let accumulator = 0;

function gameLoop(time) {
    const deltaTime = time - lastTime;
    lastTime = time;
    accumulator += deltaTime;

    // Fixed Timestep für Logik
    while (accumulator >= TICK_RATE) {
        update();
        accumulator -= TICK_RATE;
    }

    // Interpolation wäre hier möglich, aber für PixelArt/Canvas overkill
    draw();
    requestAnimationFrame(gameLoop);
}

// Start
init();
