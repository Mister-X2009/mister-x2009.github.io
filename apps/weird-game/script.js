/**
 * Pixel Unit RTS - Slime Physics Engine
 * * Physik-Logik:
 * Anstatt Random-Walk nutzen wir eine Nachbarschaftsanalyse (Cellular Automata).
 * 1. Move Score = (Distanz zum Ziel verringern) + (Anzahl Nachbarn erhöhen/halten).
 * 2. Ein Pixel bewegt sich nur, wenn es dadurch nicht isoliert wird (Bubble-Effekt).
 */

// --- KONFIGURATION ---
const WIDTH = 256;
const HEIGHT = 256;
const SIZE = WIDTH * HEIGHT;

// Bit-Masken für Farben (ABGR Little Endian)
const COLORS = [
    0xFF000000, // 0: Leer
    0xFF4444FF, // 1: Rot
    0xFF44FF44, // 2: Grün
    0xFFFF4444, // 3: Blau
    0xFF44FFFF, // 4: Gelb
    0xFF808080, // 5: Wand
    0xFFFFFFFF  // 6: Basis
];

// --- STATE ---
const state = {
    type: new Uint8Array(SIZE),      // Welches Objekt? (0-6)
    owner: new Uint8Array(SIZE),     // Welcher Spieler? (1=P1)
    moved: new Uint8Array(SIZE),     // Locking für diesen Frame (verhindert Doppel-Moves)
    visibility: new Uint8Array(SIZE),// Fog of War
    
    resources: 600,
    selectedColor: 1,
    baseIndex: 0,
    
    targetX: -1,
    targetY: -1,
    recalling: false
};

// Canvas Init
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
ctx.imageSmoothingEnabled = false; // WICHTIG für Pixel-Look

const imgData = ctx.createImageData(WIDTH, HEIGHT);
const buf32 = new Uint32Array(imgData.data.buffer);

// --- INIT ---
function init() {
    // Map Generierung (Leere Box mit zufälligen Hindernissen)
    for (let i = 0; i < SIZE; i++) {
        const x = i % WIDTH;
        const y = Math.floor(i / WIDTH);
        // Ränder oder Noise
        if (x < 2 || x >= WIDTH-2 || y < 2 || y >= HEIGHT-2 || Math.random() > 0.992) {
            state.type[i] = 5; // Wand
        }
    }
    
    // Basis in der Mitte platzieren
    const bx = 128, by = 128;
    state.baseIndex = by * WIDTH + bx;
    // 3x3 Basis
    for(let dy=-1; dy<=1; dy++) {
        for(let dx=-1; dx<=1; dx++) {
            let idx = (by+dy)*WIDTH + (bx+dx);
            state.type[idx] = 6;
            state.owner[idx] = 1;
            state.type[idx-1] = 0; // Eingang freimachen
        }
    }

    setupUI();
    requestAnimationFrame(gameLoop);
}

// --- PHYSIK & BEWEGUNG (THE SLIME LOGIC) ---

function update() {
    state.moved.fill(0); // Reset Move-Locks

    // Bestimme Zielkoordinaten
    let tx = state.targetX;
    let ty = state.targetY;
    if (state.recalling) {
        tx = state.baseIndex % WIDTH;
        ty = Math.floor(state.baseIndex / WIDTH);
    }

    // Zufälliger Offset für Iteration (verhindert Bias oben-links nach unten-rechts)
    // Wir iterieren 4-mal durch Teilbereiche oder einfach randomisiert, 
    // hier: Linear mit Random-Start reicht für einfache CA.
    const startOff = Math.floor(Math.random() * SIZE);

    for (let k = 0; k < SIZE; k++) {
        const i = (k + startOff) % SIZE;
        
        // Nur aktive Einheiten des Spielers verarbeiten
        if (state.owner[i] !== 1 || state.type[i] > 4) continue;

        // 1. Rückruf Logik (Ressourcen zurückgewinnen)
        if (state.recalling && isNear(i, state.baseIndex, 4)) {
            state.type[i] = 0; state.owner[i] = 0;
            state.resources++;
            continue;
        }

        // 2. Slime Bewegung
        // Wenn kein Ziel gesetzt ist, machen wir nur Kohäsion (Kuscheln)
        // Wenn Ziel gesetzt ist, machen wir Bewegung + Kohäsion
        const hasTarget = (tx !== -1 && ty !== -1);
        
        if (hasTarget) {
            moveSlime(i, tx, ty);
        } else {
            moveCohesionOnly(i);
        }
    }

    updateFogOfWar();
    updateHUD();
}

/**
 * Kernlogik für Slime-Verhalten:
 * Ein Pixel bewegt sich bevorzugt dorthin, wo es:
 * A) Näher am Ziel ist.
 * B) MEHR oder GLEICHVIELE Nachbarn hat wie vorher (Oberflächenspannung).
 */
function moveSlime(idx, tx, ty) {
    if (state.moved[idx]) return; // Schon bewegt diesen Frame

    const cx = idx % WIDTH;
    const cy = Math.floor(idx / WIDTH);
    const myColor = state.type[idx];

    // Richtung zum Ziel
    let dx = Math.sign(tx - cx);
    let dy = Math.sign(ty - cy);

    // Wenn wir schon da sind
    if (dx === 0 && dy === 0) return;

    // Wir prüfen 3 Kandidaten-Positionen:
    // 1. Direkt zum Ziel
    // 2. Diagonal/Seitlich (um Hindernisse zu fließen)
    // Wir wollen "Kleben" bleiben.
    
    const currentNeighbors = countNeighbors(cx, cy, myColor);
    
    // Kandidaten-Offsets (Priorität: Direkt, dann Alternativen)
    const moves = [
        {x: dx, y: dy},           // Ideal
        {x: dx, y: 0},            // Nur X
        {x: 0, y: dy},            // Nur Y
        {x: (Math.random()<.5?1:-1), y: (Math.random()<.5?1:-1)} // Random Jitter (bricht Blockaden)
    ];

    let bestMove = null;
    let bestScore = -999;

    for (let m of moves) {
        if (m.x === 0 && m.y === 0) continue;
        
        const nx = cx + m.x;
        const ny = cy + m.y;
        
        if (!isValid(nx, ny)) continue;
        
        const nIdx = ny * WIDTH + nx;
        
        // Kollision / Kampf Check
        if (state.type[nIdx] !== 0) {
            // Interaktion (Kampf) möglich?
            if (state.owner[nIdx] !== 1 && state.type[nIdx] !== 5 && state.type[nIdx] !== 6) {
                // Kampf!
                interact(idx, nIdx);
                state.moved[idx] = 1; // Aktion verbraucht
                return;
            }
            continue; // Blockiert durch Wand/Freund
        }

        // --- SLIME SCORE BERECHNUNG ---
        // Wie viele Freunde hätte ich an der neuen Position?
        const newNeighbors = countNeighbors(nx, ny, myColor, idx); // Ignoriere mich selbst an alter Pos
        
        // Score Bestandteile:
        // 1. Fortschritt zum Ziel (kleiner Faktor)
        // 2. Nachbarn behalten (großer Faktor -> Kohäsion)
        
        let score = 0;
        
        // Ziel-Anziehung
        const distOld = Math.abs(tx - cx) + Math.abs(ty - cy);
        const distNew = Math.abs(tx - nx) + Math.abs(ty - ny);
        if (distNew < distOld) score += 2; // Leichter Zug zum Ziel
        
        // Kohäsion (Das Wichtigste für den Bubble-Effekt)
        // Wenn ich isoliert bin (wenig Nachbarn), MUSS ich zu mehr Nachbarn.
        // Wenn ich im Blob bin (viele Nachbarn), darf ich fließen.
        
        if (newNeighbors >= currentNeighbors) {
            score += 5; // Belohnung für Zusammenhalt
        } else if (newNeighbors < 2) {
            score -= 10; // Strafe für Ablösen (Tropfen vermeiden)
        }
        
        // Randomness für organisches "Wabbeln"
        score += Math.random() * 2;

        if (score > bestScore) {
            bestScore = score;
            bestMove = {nx, ny, nIdx};
        }
    }

    // Ausführen wenn Score gut genug
    if (bestMove && bestScore > 0) {
        // Swap pixels
        state.type[bestMove.nIdx] = state.type[idx];
        state.owner[bestMove.nIdx] = state.owner[idx];
        state.type[idx] = 0;
        state.owner[idx] = 0;
        state.moved[bestMove.nIdx] = 1; // Ziel pixel locken
    }
}

// Zieht Pixel zusammen, wenn kein Ziel aktiv ist
function moveCohesionOnly(idx) {
    if (state.moved[idx]) return;
    const cx = idx % WIDTH;
    const cy = Math.floor(idx / WIDTH);
    const myColor = state.type[idx];
    const currentNeighbors = countNeighbors(cx, cy, myColor);

    // Wenn wir "gut eingebettet" sind (>=5 Nachbarn), bewegen wir uns kaum (spart CPU und zittert weniger)
    if (currentNeighbors >= 6) return;

    // Suche Nachbarfeld mit MEHR Nachbarn
    let bestIdx = -1;
    let maxN = currentNeighbors;

    // Suche in zufällige Richtungen (nicht alle 8, performance)
    for(let k=0; k<4; k++) {
        let rx = Math.floor(Math.random()*3)-1;
        let ry = Math.floor(Math.random()*3)-1;
        if (rx===0 && ry===0) continue;
        
        let nx = cx+rx, ny = cy+ry;
        if (isValid(nx, ny)) {
            let nIdx = ny*WIDTH + nx;
            if (state.type[nIdx] === 0) {
                let n = countNeighbors(nx, ny, myColor, idx);
                if (n > maxN) {
                    maxN = n;
                    bestIdx = nIdx;
                }
            }
        }
    }

    if (bestIdx !== -1) {
        state.type[bestIdx] = state.type[idx];
        state.owner[bestIdx] = state.owner[idx];
        state.type[idx] = 0;
        state.owner[idx] = 0;
        state.moved[bestIdx] = 1;
    }
}

// Zählt 8-fach Nachbarschaft einer Farbe
function countNeighbors(x, y, color, ignoreIdx = -1) {
    let count = 0;
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < WIDTH && ny >= 0 && ny < HEIGHT) {
                const idx = ny * WIDTH + nx;
                if (idx === ignoreIdx) continue; // Mich selbst ignorieren (wenn ich wegziehe)
                if (state.type[idx] === color) count++;
            }
        }
    }
    return count;
}

// --- KAMPF & INTERAKTION ---
function interact(fromIdx, toIdx) {
    const typeA = state.type[fromIdx];
    const typeB = state.type[toIdx];
    
    // Schere-Stein-Papier
    // 1(R) > 2(G) > 3(B) > 4(Y) > 1(R)
    let wins = false;
    if ((typeA === 1 && typeB === 2) || 
        (typeA === 2 && typeB === 3) || 
        (typeA === 3 && typeB === 4) || 
        (typeA === 4 && typeB === 1)) {
        wins = true;
    }

    if (wins) {
        // Übernehme Feld
        state.type[toIdx] = typeA;
        state.owner[toIdx] = state.owner[fromIdx];
        state.type[fromIdx] = 0;
        state.owner[fromIdx] = 0;
    } else if (typeA !== typeB) {
        // Verliere (Lösche Angreifer)
        state.type[fromIdx] = 0;
        state.owner[fromIdx] = 0;
    }
}

// --- UI & SPAWN ---
function spawnUnits(color, count) {
    if (state.resources < count) return;
    
    // Spawne in einem dichten Cluster ("Blob"), nicht random verteilt
    let cx = (state.baseIndex % WIDTH);
    let cy = Math.floor(state.baseIndex / WIDTH) + 4; // Etwas unter der Basis
    
    let spawned = 0;
    // Suche freien Platz spiralförmig
    let radius = 1;
    while(spawned < count && radius < 20) {
        for(let y=-radius; y<=radius; y++) {
            for(let x=-radius; x<=radius; x++) {
                if (spawned >= count) break;
                // Kreisform
                if (x*x + y*y > radius*radius) continue;
                
                let nx = cx + x;
                let ny = cy + y;
                    // Stelle ist innerhalb des Spielfelds
                if (isValid(nx, ny)) {
                    let idx = ny*WIDTH + nx;
                    // Stelle ist leer
                    if (state.type[idx] === 0) {
                        state.type[idx] = color;
                        state.owner[idx] = 1;
                        spawned++;
                        state.resources--;
                    }
                }
            }
        }
        radius++;
    }
    updateHUD();
}

function setupUI() {
    document.querySelectorAll('.btn-color').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.btn-color').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            state.selectedColor = parseInt(e.target.dataset.color);
            state.recalling = false;
            // Ziel resetten bei Farbwechsel? Optional. Hier: Nein.
        });
    });

    document.getElementById('btn-spawn').addEventListener('click', () => spawnUnits(state.selectedColor, 20));
    
    document.getElementById('btn-recall').addEventListener('click', () => {
        state.recalling = true;
        state.targetX = -1; state.targetY = -1;
    });

    document.getElementById('btn-export').addEventListener('click', () => {
        // Simpler Canvas Export
        const link = document.createElement('a');
        link.download = 'pixel_rts_map.png';
        link.href = canvas.toDataURL();
        link.click();
    });

    canvas.addEventListener('mousedown', (e) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = WIDTH / rect.width;
        const scaleY = HEIGHT / rect.height;
        const tx = Math.floor((e.clientX - rect.left) * scaleX);
        const ty = Math.floor((e.clientY - rect.top) * scaleY);
        
        if (e.button === 2) { // Rechtsklick -> Recall
            state.recalling = true;
            state.targetX = -1; state.targetY = -1;
        } else { // Linksklick -> Move
            state.recalling = false;
            state.targetX = tx;
            state.targetY = ty;
        }
    });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
}

// --- HELPER ---
function isValid(x, y) { return x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT; }
function isNear(idx1, idx2, dist) {
    const x1 = idx1 % WIDTH, y1 = Math.floor(idx1 / WIDTH);
    const x2 = idx2 % WIDTH, y2 = Math.floor(idx2 / WIDTH);
    return Math.abs(x1-x2) <= dist && Math.abs(y1-y2) <= dist;
}

// --- RENDER LOOP ---
function updateFogOfWar() {
    state.visibility.fill(0);
    // Schnellere FoW: Rechtecke um Einheiten
    // Basis
    paintVis(state.baseIndex, 15);
    
    for (let i = 0; i < SIZE; i++) {
        if (state.owner[i] === 1) {
            paintVis(i, 6); // 6px Sichtradius pro Unit
        }
    }
}

function paintVis(idx, r) {
    const cx = idx % WIDTH;
    const cy = Math.floor(idx / WIDTH);
    const minX = Math.max(0, cx - r);
    const maxX = Math.min(WIDTH-1, cx + r);
    const minY = Math.max(0, cy - r);
    const maxY = Math.min(HEIGHT-1, cy + r);
    
    for(let y=minY; y<=maxY; y++) {
        for(let x=minX; x<=maxX; x++) {
            state.visibility[y*WIDTH+x] = 1;
        }
    }
}

function updateHUD() {
    document.getElementById('res-count').innerText = state.resources;
}

function draw() {
    const fow = document.getElementById('chk-fow').checked;
    
    // Background löschen (schwarz)
    buf32.fill(0xFF000000);

    for (let i = 0; i < SIZE; i++) {
        if (fow && state.visibility[i] === 0) {
            // Zeige nur Wände im Nebel (abgedunkelt)
            if (state.type[i] === 5) buf32[i] = 0xFF303030;
            continue;
        }
        if (state.type[i] !== 0) {
            buf32[i] = COLORS[state.type[i]];
        }
    }

    // Ziel Marker
    if (state.targetX !== -1) {
        // Kleines Kreuz zeichnen
        let idx = state.targetY * WIDTH + state.targetX;
        if (idx >= 0 && idx < SIZE) buf32[idx] = 0xFFFFFFFF;
    }

    ctx.putImageData(imgData, 0, 0);
}

let lastTime = 0;
const TICK = 1000/60; // 60 FPS Physics für flüssigen Slime
let acc = 0;

function gameLoop(time) {
    const dt = time - lastTime;
    lastTime = time;
    acc += dt;
    
    // Limit Ticks um Spiral of Death zu vermeiden
    if (acc > 200) acc = 200;

    while (acc >= TICK) {
        update();
        acc -= TICK;
    }
    draw();
    requestAnimationFrame(gameLoop);
}

init();
