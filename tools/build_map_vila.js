'use strict';

/**
 * Gerador deterministico do mapa "Vila Primeiro Passo" (data/Map003.json).
 *
 *   node tools/build_map_vila.js
 *
 * Marco P0 da Biblia dos Doze Mundos (secoes 24 e 31): praca e rua principal,
 * entrada sul, Colegio de Primas, Campo do Primeiro Sonho vazio e um trecho
 * curto dos Campos do Primeiro Sol.
 *
 * O mapa e regenerado do zero a cada execucao; editar este arquivo e a forma
 * suportada de alterar a vila.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MAP_PATH = path.join(ROOT, 'data', 'Map003.json');
const MAP_INFOS_PATH = path.join(ROOT, 'data', 'MapInfos.json');

const MAP_ID = 3;
const MAP_NAME = 'Vila Primeiro Passo';
const TILESET_ID = 2; // "Exterior" (Outside_A1..A5, Outside_B, Outside_C)
const WIDTH = 80;
const HEIGHT = 92;

// ---------------------------------------------------------------------------
// Tiles
// ---------------------------------------------------------------------------

const AUTO_BASE = 100000; // marcador interno: AUTO_BASE + kind
const auto = kind => AUTO_BASE + kind;
const isAuto = value => value >= AUTO_BASE;
const kindOf = value => value - AUTO_BASE;

// Autotiles: id final = 2048 + kind * 48 + shape.
const A = {
    WATER: 0,
    WATER_BASIN: 12,
    GRASS: 16,
    PATH: 17,
    COBBLE: 18,
    PAVING: 19,
    TALL_GRASS: 20,
    WOOD_FENCE: 22,
    WHITE_ROCK: 23,
    IRON_FENCE: 30,
    DIRT: 32,

    ROOF_ORANGE: 50,
    ROOF_SHINGLE: 52,
    ROOF_THATCH: 53,
    ROOF_CREAM: 56,
    ROOF_BEIGE: 57,
    ROOF_DARK_RED: 58,
    ROOF_PLANK: 61,
    ROOF_STONE: 72,
    ROOF_WHITE_STONE: 73,
    ROOF_DARK: 74,

    WALL_GRAY: 88,
    WALL_LIGHT_GRAY: 89,
    WALL_TAN: 90,
    WALL_BROWN: 91,
    WALL_WHITE: 92,
    WALL_BEIGE: 93,
    WALL_YELLOW: 105,
    WALL_CREAM: 107,

    CLIFF_TOP: 116,
    CLIFF_SIDE: 124
};

// Tiles avulsos (Outside_B = 0..255, Outside_C = 256..511, Outside_A5 = 1536+).
const T = {
    LAMP_TOP: 8, LAMP_MID: 16, LAMP_BASE: 24,
    SIGN_SHOP: 66, SIGN_ITEM: 68, SIGN_INN: 70, SIGN_FOOD: 73, SIGN_TOOL: 78,
    WINDOW: 96, WINDOW_PLANT: 97, WINDOW_FLOWER: 113, WINDOW_ARCH: 112,
    DOOR_HOUSE: 114, DOOR_PUBLIC: 122,
    CHIMNEY: 128,
    SIGNPOST: 137, CRATE: 138, BARREL_BIG: 139, PEBBLES: 140, BARREL: 141,
    POT: 144, BUCKET: 145, TROUGH: 146,
    RACK: 150,
    BUSH_S: 152, BUSH_M: 153, GRASS_TUFT: 154, BUSH_L: 155,
    STUMP: 156, ROCK: 159,
    FLOWER_WHITE: 160, FLOWER_PURPLE: 161, FLOWER_BLUE: 162, FLOWER_ORANGE: 163,
    LOG: 164, TREE_ROUND: 165, HAY: 167,
    SCARECROW: 168, PIT: 169, LOG_PILE: 170, STONES: 171,
    CROP: 173,
    TREE_TL: 176, TREE_TR: 177, TREE_BL: 184, TREE_BR: 185,
    STALL_T: [180, 181, 182, 183], STALL_B: [188, 189, 190, 191],
    WHITE_LOG: 226, WHITE_PEBBLE: 227,
    WHITE_FLOWER: 250, PEBBLE_SMALL: 252,
    LILY: 253,

    COLUMN_TOP: 257, COLUMN_BASE: 265, RUBBLE: 274,
    CLOCK_FACE: 324,
    TOWER_TOP: 432, TOWER_MID: 440, TOWER_BODY: 448, TOWER_WINDOW: 456, TOWER_BASE: 464,

    BRIDGE_L: 1541, BRIDGE_M: 1542, BRIDGE_R: 1543,
    STAIR_L: 1600, STAIR_M: 1601, STAIR_R: 1602,
    CROP_ROW: [1584, 1585, 1586, 1587],
    WHEAT_ROW: [1588, 1589, 1590, 1591],
    PLOW_ROW: [1592, 1593, 1594, 1595],
    MEDALLION: [1608, 1609, 1616, 1617]
};

// ---------------------------------------------------------------------------
// Tabelas de forma dos autotiles (espelham Tilemap.*_AUTOTILE_TABLE do MZ)
// ---------------------------------------------------------------------------

// Bits de borda: 1=oeste, 2=norte, 4=leste, 8=sul.
const FLOOR_EDGE_SHAPE = {
    1: 16, 2: 20, 4: 24, 8: 28,
    5: 32, 10: 33, 3: 34, 6: 36, 12: 38, 9: 40,
    7: 42, 11: 43, 13: 44, 14: 45, 15: 46
};
// Cantos internos ainda visiveis em cada combinacao de bordas, na ordem do offset.
const FLOOR_CORNER_ORDER = {
    1: ['ne', 'se'],
    2: ['se', 'sw'],
    4: ['sw', 'nw'],
    8: ['nw', 'ne'],
    3: ['se'],
    6: ['sw'],
    12: ['nw'],
    9: ['ne']
};

function floorShape(same) {
    const edge = (same.w ? 0 : 1) | (same.n ? 0 : 2) | (same.e ? 0 : 4) | (same.s ? 0 : 8);
    if (edge === 0) {
        return (same.nw ? 0 : 1) + (same.ne ? 0 : 2) + (same.se ? 0 : 4) + (same.sw ? 0 : 8);
    }
    let shape = FLOOR_EDGE_SHAPE[edge];
    const corners = FLOOR_CORNER_ORDER[edge];
    if (corners) {
        for (let i = 0; i < corners.length; i++) {
            if (!same[corners[i]]) shape += 1 << i;
        }
    }
    return shape;
}

function wallShape(same) {
    return (same.w ? 0 : 1) | (same.n ? 0 : 2) | (same.e ? 0 : 4) | (same.s ? 0 : 8);
}

// A3 inteiro e as linhas impares de A4 usam a tabela de parede (16 formas).
function usesWallTable(kind) {
    if (kind >= 48 && kind < 80) return true;
    if (kind >= 80) return Math.floor(kind / 8) % 2 === 1;
    return false;
}

// ---------------------------------------------------------------------------
// Canvas
// ---------------------------------------------------------------------------

class MapCanvas {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        const size = width * height;
        this.layers = [
            new Array(size).fill(auto(A.GRASS)),
            new Array(size).fill(0),
            new Array(size).fill(0),
            new Array(size).fill(0)
        ];
        this.shadow = new Array(size).fill(0);
        this.region = new Array(size).fill(0);
    }

    inside(x, y) {
        return x >= 0 && y >= 0 && x < this.width && y < this.height;
    }

    idx(x, y) {
        return y * this.width + x;
    }

    set(z, x, y, value) {
        if (!this.inside(x, y)) return;
        this.layers[z][this.idx(x, y)] = value;
    }

    get(z, x, y) {
        if (!this.inside(x, y)) return 0;
        return this.layers[z][this.idx(x, y)];
    }

    fill(z, x0, y0, x1, y1, value) {
        for (let y = y0; y <= y1; y++) {
            for (let x = x0; x <= x1; x++) this.set(z, x, y, value);
        }
    }

    setRegion(x, y, value) {
        if (!this.inside(x, y)) return;
        this.region[this.idx(x, y)] = value;
    }

    setShadow(x, y, value) {
        if (!this.inside(x, y)) return;
        this.shadow[this.idx(x, y)] = value;
    }

    resolve() {
        const out = new Array(this.width * this.height * 6).fill(0);
        for (let z = 0; z < 4; z++) {
            const layer = this.layers[z];
            for (let y = 0; y < this.height; y++) {
                for (let x = 0; x < this.width; x++) {
                    const value = layer[this.idx(x, y)];
                    let tileId = value;
                    if (isAuto(value)) {
                        const kind = kindOf(value);
                        const same = this.neighbours(z, x, y, value);
                        const shape = usesWallTable(kind) ? wallShape(same) : floorShape(same);
                        tileId = 2048 + kind * 48 + shape;
                    }
                    out[(z * this.height + y) * this.width + x] = tileId;
                }
            }
        }
        const shadowBase = 4 * this.height * this.width;
        for (let i = 0; i < this.shadow.length; i++) out[shadowBase + i] = this.shadow[i];
        const regionBase = 5 * this.height * this.width;
        for (let i = 0; i < this.region.length; i++) out[regionBase + i] = this.region[i];
        return out;
    }

    // Fora do mapa conta como "igual" para nao desenhar borda na moldura.
    neighbours(z, x, y, value) {
        const same = (dx, dy) => {
            const nx = x + dx;
            const ny = y + dy;
            if (!this.inside(nx, ny)) return true;
            return this.layers[z][this.idx(nx, ny)] === value;
        };
        return {
            n: same(0, -1), s: same(0, 1), w: same(-1, 0), e: same(1, 0),
            nw: same(-1, -1), ne: same(1, -1), sw: same(-1, 1), se: same(1, 1)
        };
    }
}

// ---------------------------------------------------------------------------
// Aleatoriedade deterministica (sem Math.random)
// ---------------------------------------------------------------------------

function makeRng(seed) {
    let state = seed >>> 0;
    return function next() {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const rng = makeRng(0x50524d31); // "PRM1"
const pick = list => list[Math.floor(rng() * list.length)];
const chance = p => rng() < p;

// ---------------------------------------------------------------------------
// Geometria da vila (ferradura em torno da colina do Colegio)
// ---------------------------------------------------------------------------

const HILL = { x0: 18, y0: 23, x1: 62, y1: 46 };
const CLIFF_H = 3;
const RAMP = { x0: 38, x1: 41, y0: 47, y1: 49 };
const PLAZA = { x0: 29, y0: 50, x1: 51, y1: 67 };
const STREAM = { y0: 68, y1: 70 };
const MAIN_ST = { x0: 38, x1: 42 };
const RING_ST = 59; // rua leste-oeste da ferradura, 2 tiles (59 e 60)

const BRIDGES = [
    { x0: 10, x1: 13 },
    { x0: MAIN_ST.x0, x1: MAIN_ST.x1 },
    { x0: 74, x1: 77 }
];

const HILL_WAVE = [0, 1, 2, 2, 1, 0, 0, 1, 2, 1, 0, 2, 1, 0];

// Encosta sul irregular: so o patamar em frente ao Colegio e reto.
function hillSouth(x) {
    if (x >= 33 && x <= 46) return HILL.y1;
    return HILL.y1 - HILL_WAVE[(x * 5) % HILL_WAVE.length];
}

// Encosta norte em degraus longos: some sob o bosque que emoldura a colina.
function hillNorth(x) {
    if (x >= 50) return HILL.y0 - 2;
    if (x >= 34) return HILL.y0;
    if (x >= 26) return HILL.y0 + 1;
    return HILL.y0 + 2;
}

function onHill(x, y) {
    if (x >= RAMP.x0 && x <= RAMP.x1 && y >= RAMP.y0 && y <= RAMP.y1) return true;
    if (x < HILL.x0 || x > HILL.x1) return false;
    const north = hillNorth(x);
    const south = hillSouth(x);
    if (y < north || y > south) return false;
    // cantos sul chanfrados: a colina termina arredondada sobre a vila
    return Math.min(x - HILL.x0, HILL.x1 - x) + (south - y) >= 4;
}

// Leito reto perto das pontes, sinuoso no resto.
function streamOffset(x) {
    for (const bridge of BRIDGES) {
        if (x >= bridge.x0 - 3 && x <= bridge.x1 + 3) return 0;
    }
    const wave = [0, 0, 1, 1, 1, 0, -1, -1, 0, 1];
    return wave[x % wave.length];
}

function inStream(x, y) {
    const off = streamOffset(x);
    return y >= STREAM.y0 + off && y <= STREAM.y1 + off;
}

// ---------------------------------------------------------------------------
// Helpers de construcao
// ---------------------------------------------------------------------------

const BUILDINGS = [];
const SANITY = { roofProps: 0, clocks: 0, doorways: 0, carved: 0 };

function rect(cv, z, x0, y0, x1, y1, value) {
    cv.fill(z, x0, y0, x1, y1, value);
}

/** Cerca de perimetro na camada 2, com aberturas opcionais. */
function fenceRect(cv, x0, y0, x1, y1, kind, gaps) {
    const isGap = (x, y) => (gaps || []).some(g => x >= g.x0 && x <= g.x1 && y >= g.y0 && y <= g.y1);
    for (let x = x0; x <= x1; x++) {
        if (!isGap(x, y0)) cv.set(2, x, y0, auto(kind));
        if (!isGap(x, y1)) cv.set(2, x, y1, auto(kind));
    }
    for (let y = y0; y <= y1; y++) {
        if (!isGap(x0, y)) cv.set(2, x0, y, auto(kind));
        if (!isGap(x1, y)) cv.set(2, x1, y, auto(kind));
    }
}

/** Arvore 2x2. Nunca invade caminho, construcao ou prop ja colocado. */
function bigTree(cv, x, y) {
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        if (!cv.inside(x + dx, y + dy)) return;
        if (cv.get(1, x + dx, y + dy) !== 0 || cv.get(2, x + dx, y + dy) !== 0) return;
    }
    cv.set(2, x, y, T.TREE_TL);
    cv.set(2, x + 1, y, T.TREE_TR);
    cv.set(2, x, y + 1, T.TREE_BL);
    cv.set(2, x + 1, y + 1, T.TREE_BR);
}

function forest(cv, x0, y0, x1, y1, density) {
    for (let y = y0; y <= y1; y += 2) {
        for (let x = x0; x <= x1; x += 2) {
            if (chance(density)) bigTree(cv, x, y);
        }
    }
}

function lamp(cv, x, y) {
    cv.set(2, x, y - 2, T.LAMP_TOP);
    cv.set(2, x, y - 1, T.LAMP_MID);
    cv.set(2, x, y, T.LAMP_BASE);
}

function tower(cv, x, y) {
    cv.set(2, x, y, T.TOWER_TOP);
    cv.set(2, x, y + 1, T.TOWER_MID);
    cv.set(2, x, y + 2, T.TOWER_BODY);
    cv.set(2, x, y + 3, T.TOWER_WINDOW);
    cv.set(2, x, y + 4, T.TOWER_BASE);
}

/**
 * Constroi uma casa (telhado A3 em cima, parede A4 embaixo) e registra o nome
 * para a contagem de construcoes exigida pela secao 24.7.
 */
function building(cv, opt) {
    const { x, y, w, roofH, wallH, roof, wall } = opt;
    const wallY = y + roofH;
    rect(cv, 1, x, y, x + w - 1, wallY - 1, auto(roof));
    rect(cv, 1, x, wallY, x + w - 1, wallY + wallH - 1, auto(wall));

    const doorRow = wallY + wallH - 1;
    const doorX = x + (opt.doorOffset !== undefined ? opt.doorOffset : Math.floor((w - 1) / 2));
    if (opt.door !== null) cv.set(2, doorX, doorRow, opt.door || T.DOOR_HOUSE);

    for (let row = wallY; row < doorRow && row <= wallY + 1; row++) {
        for (let wx = x; wx < x + w; wx++) {
            if (wx === doorX) continue;
            if ((wx - x) % 2 === 0 && chance(0.7)) {
                cv.set(2, wx, row, pick([T.WINDOW, T.WINDOW_PLANT, T.WINDOW_FLOWER]));
            }
        }
    }
    if (opt.sign) cv.set(3, doorX + 1 <= x + w - 1 ? doorX + 1 : doorX - 1, doorRow - 1, opt.sign);
    if (opt.chimney) cv.set(3, x + 1, y, T.CHIMNEY);

    // sombra projetada a leste da parede (a luz do RTP vem da esquerda)
    for (let sy = wallY; sy <= doorRow; sy++) cv.setShadow(x + w, sy, 5);

    BUILDINGS.push({
        name: opt.name || 'construcao',
        x, y, w, h: roofH + wallH,
        roofY0: y, roofY1: wallY - 1,
        doorX, doorRow
    });
}

// ---------------------------------------------------------------------------
// Passos de construcao
// ---------------------------------------------------------------------------

function buildTerrain(cv) {
    for (let y = 0; y < HEIGHT; y++) {
        for (let x = 0; x < WIDTH; x++) {
            if (onHill(x, y)) cv.set(0, x, y, auto(A.CLIFF_TOP));
        }
    }
    // face rochosa: tres fileiras abaixo de toda borda sul do planalto
    for (let y = 0; y < HEIGHT; y++) {
        for (let x = 0; x < WIDTH; x++) {
            if (!onHill(x, y) || onHill(x, y + 1)) continue;
            // a rampa desemboca na vila: sem parede no pe da lingua de terra
            if (x >= RAMP.x0 && x <= RAMP.x1 && y >= RAMP.y1) continue;
            for (let d = 1; d <= CLIFF_H; d++) cv.set(1, x, y + d, auto(A.CLIFF_SIDE));
        }
    }
    // pedras soltas no pe do barranco reforcam a leitura de altura
    for (let x = HILL.x0; x <= HILL.x1; x += 3) {
        for (let y = HEIGHT - 1; y >= 0; y--) {
            if (cv.get(1, x, y) === auto(A.CLIFF_SIDE)) {
                if (chance(0.45)) cv.set(2, x, y + 1, pick([T.ROCK, T.STONES, T.PEBBLE_SMALL]));
                break;
            }
        }
    }

    // riacho que corta a vila de leste a oeste
    for (let x = 0; x < WIDTH; x++) {
        for (let y = STREAM.y0 - 2; y <= STREAM.y1 + 2; y++) {
            if (inStream(x, y)) cv.set(0, x, y, auto(A.WATER));
        }
    }
    rect(cv, 0, 16, 71, 26, 73, auto(A.WATER)); // remanso que move o moinho
}

function buildRoads(cv) {
    const trail = auto(A.PATH);
    const cobble = auto(A.COBBLE);

    // praca do Primeiro Passo e rua principal
    rect(cv, 1, PLAZA.x0, PLAZA.y0, PLAZA.x1, PLAZA.y1, cobble);
    rect(cv, 1, MAIN_ST.x0, 71, MAIN_ST.x1, HEIGHT - 1, trail);

    // rua leste-oeste da ferradura
    rect(cv, 1, 4, RING_ST, PLAZA.x0 - 1, RING_ST + 1, trail);
    rect(cv, 1, PLAZA.x1 + 1, RING_ST, 78, RING_ST + 1, trail);

    // bracos norte da ferradura, contornando a colina
    rect(cv, 1, 10, 40, 12, RING_ST - 1, trail);
    rect(cv, 1, 68, 40, 70, RING_ST - 1, trail);
    rect(cv, 1, 5, 40, 17, 41, trail);
    rect(cv, 1, 63, 40, 75, 41, trail);

    // escadaria de pedra ate o alto da colina
    rect(cv, 1, RAMP.x0, 44, RAMP.x1, RAMP.y0 - 1, trail);
    for (let y = RAMP.y0 - 1; y <= RAMP.y1 + 1; y++) {
        for (let x = RAMP.x0; x <= RAMP.x1; x++) {
            const tile = x === RAMP.x0 ? T.STAIR_L : x === RAMP.x1 ? T.STAIR_R : T.STAIR_M;
            cv.set(1, x, y, tile);
        }
    }

    // patio do Colegio em cruz, evitando a laje unica
    rect(cv, 1, 36, 36, 43, 45, auto(A.PAVING));
    rect(cv, 1, 30, 39, 48, 41, auto(A.PAVING));
    // caminho norte ate o Campo do Primeiro Sonho
    rect(cv, 1, 49, 20, 51, 43, trail);

    // estrada sul rumo aos Campos do Primeiro Sol
    rect(cv, 1, 43, 80, 63, 81, trail);

    // pontes de madeira sobre o riacho
    for (const bridge of BRIDGES) {
        for (let x = bridge.x0; x <= bridge.x1; x++) {
            const tile = x === bridge.x0 ? T.BRIDGE_L : x === bridge.x1 ? T.BRIDGE_R : T.BRIDGE_M;
            for (let y = STREAM.y0 - 1; y <= STREAM.y1 + 1; y++) cv.set(1, x, y, tile);
        }
    }
    // acessos das pontes laterais
    rect(cv, 1, 10, 61, 13, 67, trail);
    rect(cv, 1, 10, 71, 13, 79, trail);
    rect(cv, 1, 13, 78, 38, 79, trail);
    rect(cv, 1, 74, 61, 77, 67, trail);
    rect(cv, 1, 74, 71, 77, 79, trail);
    rect(cv, 1, 63, 78, 77, 79, trail);
}

function buildCollegeHill(cv) {
    // Colegio de Primas: corpo central com duas alas
    building(cv, {
        name: 'Colegio de Primas', x: 32, y: 30, w: 13, roofH: 3, wallH: 3,
        roof: A.ROOF_STONE, wall: A.WALL_LIGHT_GRAY, door: T.DOOR_PUBLIC
    });
    rect(cv, 1, 28, 32, 31, 33, auto(A.ROOF_STONE));
    rect(cv, 1, 28, 34, 31, 35, auto(A.WALL_LIGHT_GRAY));
    rect(cv, 1, 45, 32, 48, 33, auto(A.ROOF_STONE));
    rect(cv, 1, 45, 34, 48, 35, auto(A.WALL_LIGHT_GRAY));
    cv.set(2, 29, 35, T.WINDOW_ARCH);
    cv.set(2, 47, 35, T.WINDOW_ARCH);
    for (let sy = 34; sy <= 35; sy++) {
        cv.setShadow(32, sy, 5);
        cv.setShadow(49, sy, 5);
    }

    // torre do Colegio com o relogio sem ponteiros, erguendo-se do telhado
    const tx = 38;
    tower(cv, tx, 27);
    cv.set(3, tx, 29, T.CLOCK_FACE);

    // bosque atras do Colegio, cobrindo a costura da encosta norte
    for (let x = 18; x <= 50; x += 2) {
        for (let y = 22; y <= 28; y += 2) {
            if (Math.abs(x - tx) <= 1) continue;
            if (chance(0.62)) bigTree(cv, x, y);
        }
    }

    // casa de Bucky, na ponta oeste da colina
    building(cv, {
        name: 'Casa de Bucky', x: 20, y: 30, w: 7, roofH: 3, wallH: 3,
        roof: A.ROOF_THATCH, wall: A.WALL_BROWN, chimney: true
    });
    fenceRect(cv, 19, 29, 28, 37, A.WOOD_FENCE, [{ x0: 23, x1: 24, y0: 37, y1: 37 }]);
    rect(cv, 1, 23, 36, 24, 40, auto(A.PATH));
    rect(cv, 1, 24, 39, 36, 40, auto(A.PATH));
    cv.set(2, 21, 36, T.FLOWER_WHITE);
    cv.set(2, 26, 36, T.FLOWER_PURPLE);
    cv.set(2, 27, 33, T.BUSH_M);

    // alojamento temporario dos candidatos
    building(cv, {
        name: 'Alojamento dos candidatos', x: 20, y: 40, w: 10, roofH: 2, wallH: 2,
        roof: A.ROOF_PLANK, wall: A.WALL_TAN
    });

    // galpao e campo de treinamento
    building(cv, {
        name: 'Galpao de treinamento', x: 55, y: 29, w: 5, roofH: 2, wallH: 2,
        roof: A.ROOF_SHINGLE, wall: A.WALL_TAN
    });
    rect(cv, 1, 52, 33, 61, 43, auto(A.DIRT));
    fenceRect(cv, 52, 33, 61, 43, A.WOOD_FENCE, [{ x0: 52, x1: 52, y0: 38, y1: 39 }]);
    rect(cv, 1, 49, 38, 52, 39, auto(A.PATH));
    cv.set(2, 55, 36, T.RACK);
    cv.set(2, 58, 41, T.SCARECROW);
    cv.set(2, 60, 35, T.PEBBLES);
    cv.set(2, 54, 42, T.STONES);

    // mirante para a Arvore de Amano, na borda norte do planalto
    rect(cv, 1, 52, 23, 61, 27, auto(A.PAVING));
    for (let x = 52; x <= 61; x++) cv.set(2, x, 23, auto(A.IRON_FENCE));
    for (let y = 23; y <= 27; y++) cv.set(2, 61, y, auto(A.IRON_FENCE));
    rect(cv, 1, 49, 26, 52, 27, auto(A.PATH));
    cv.set(2, 53, 26, T.SIGNPOST);
    cv.set(2, 56, 24, T.COLUMN_TOP);
    cv.set(2, 59, 24, T.COLUMN_TOP);

    // canteiros que quebram a laje do patio
    for (const [x, y] of [[33, 37], [46, 37], [33, 44], [46, 44]]) {
        cv.set(1, x, y, auto(A.GRASS));
        cv.set(2, x, y, pick([T.FLOWER_WHITE, T.FLOWER_BLUE, T.BUSH_L]));
    }
    lamp(cv, 35, 43);
    lamp(cv, 44, 43);
}

function buildDreamField(cv) {
    // Campo do Primeiro Sonho: vazio no P0, apenas o gramado e a arena de pedra
    rect(cv, 0, 24, 4, 60, 21, auto(A.GRASS));
    // anel de pedra da arena: elipse cheia menos elipse interna, sempre fechado
    const cx = 41;
    const cy = 12;
    for (let y = 4; y <= 20; y++) {
        for (let x = 26; x <= 58; x++) {
            const outer = Math.hypot((x - cx) / 11, (y - cy) / 6.6) <= 1;
            const inner = Math.hypot((x - cx) / 9.4, (y - cy) / 5.2) <= 1;
            if (outer && !inner) cv.set(1, x, y, auto(A.PAVING));
        }
    }
    rect(cv, 1, 49, 11, 52, 13, auto(A.PATH));

    forest(cv, 24, 2, 58, 2, 1);
    forest(cv, 24, 21, 46, 21, 0.7);
    forest(cv, 53, 21, 58, 21, 0.7);
    for (let y = 4; y <= 20; y += 2) {
        bigTree(cv, 24, y);
        bigTree(cv, 58, y);
    }

    // arvore das fitas dos sonhos, marcando a entrada do campo
    bigTree(cv, 46, 18);
    cv.set(2, 45, 18, T.FLOWER_WHITE);
    cv.set(2, 48, 19, T.FLOWER_ORANGE);
    cv.set(2, 45, 20, T.BUSH_L);
    cv.set(2, 48, 17, T.BUSH_M);
    cv.set(2, 48, 20, T.SIGNPOST);
}

function buildPlaza(cv) {
    // fonte baixa de pedra reaproveitada da Torre
    rect(cv, 1, 38, 52, 41, 55, auto(A.PAVING));
    for (const [x, y] of [[39, 53], [40, 53], [39, 54], [40, 54]]) {
        cv.set(0, x, y, auto(A.WATER_BASIN));
        cv.set(1, x, y, 0);
    }
    cv.set(2, 38, 52, T.RUBBLE);
    cv.set(2, 41, 55, T.RUBBLE);
    cv.set(2, 41, 52, T.STONES);
    cv.set(2, 38, 55, T.PEBBLES);

    // mercado diario: dois balcoes de quatro modulos
    for (let i = 0; i < 4; i++) {
        cv.set(2, 31 + i, 51, T.STALL_T[i]);
        cv.set(2, 31 + i, 52, T.STALL_B[i]);
        cv.set(2, 45 + i, 51, T.STALL_T[i]);
        cv.set(2, 45 + i, 52, T.STALL_B[i]);
    }

    // canteiros que dao escala a praca sem fechar os caminhos
    for (const [x, y] of [[33, 58], [46, 58], [33, 51], [48, 57]]) {
        cv.set(1, x, y, auto(A.GRASS));
        cv.set(2, x, y, T.TREE_ROUND);
    }
    for (const [x, y] of [[34, 58], [45, 58], [47, 57]]) {
        cv.set(1, x, y, auto(A.GRASS));
        cv.set(2, x, y, pick([T.FLOWER_WHITE, T.FLOWER_BLUE, T.BUSH_L]));
    }

    // quadro de avisos, medalhao civico e iluminacao
    cv.set(2, 36, 57, T.SIGNPOST);
    cv.set(1, 34, 56, T.MEDALLION[0]);
    cv.set(1, 35, 56, T.MEDALLION[1]);
    cv.set(1, 34, 57, T.MEDALLION[2]);
    cv.set(1, 35, 57, T.MEDALLION[3]);
    for (const [x, y] of [[33, 55], [46, 55], [33, 63], [46, 63], [37, 50], [43, 50]]) lamp(cv, x, y);

    // raiz branca de Amano, aflorando do pe da colina e cortando a lateral oeste
    const root = [];
    for (let y = 50; y <= 60; y++) {
        const x = 27 + (y >= 57 ? y - 56 : 0);
        root.push([x, y]);
    }
    for (const [x, y] of root) {
        cv.set(1, x, y, auto(A.WHITE_ROCK));
        cv.set(1, x + 1, y, auto(A.WHITE_ROCK));
    }
    for (const [x, y] of root) {
        if (y >= RING_ST && y <= RING_ST + 1) continue;
        if (y % 2 === 0) cv.set(2, x, y, T.WHITE_LOG);
        else cv.set(2, x + 1, y, T.WHITE_PEBBLE);
    }
    for (const [x, y] of [[26, 51], [30, 58], [26, 55], [30, 52]]) cv.set(2, x, y, T.WHITE_FLOWER);

    // predios da praca
    building(cv, {
        name: 'Loja de suprimentos', x: 20, y: 51, w: 6, roofH: 3, wallH: 3,
        roof: A.ROOF_ORANGE, wall: A.WALL_TAN, sign: T.SIGN_ITEM
    });
    building(cv, {
        name: 'Clinica comunitaria', x: 53, y: 51, w: 6, roofH: 3, wallH: 3,
        roof: A.ROOF_WHITE_STONE, wall: A.WALL_WHITE, sign: T.SIGN_SHOP,
        door: T.DOOR_PUBLIC
    });
    building(cv, {
        name: 'Edificio do conselho local', x: 30, y: 58, w: 7, roofH: 3, wallH: 3,
        roof: A.ROOF_CREAM, wall: A.WALL_BEIGE, door: T.DOOR_PUBLIC
    });
    cv.set(3, 33, 63, T.CLOCK_FACE); // segundo relogio sem ponteiros
    building(cv, {
        name: 'Casa de refeicoes', x: 44, y: 58, w: 7, roofH: 3, wallH: 3,
        roof: A.ROOF_DARK_RED, wall: A.WALL_CREAM, sign: T.SIGN_FOOD
    });
}

function buildWorkshops(cv) {
    building(cv, {
        name: 'Carpintaria', x: 3, y: 45, w: 6, roofH: 3, wallH: 3,
        roof: A.ROOF_SHINGLE, wall: A.WALL_BROWN, sign: T.SIGN_TOOL
    });
    building(cv, {
        name: 'Oficina de carrocas', x: 14, y: 45, w: 7, roofH: 3, wallH: 3,
        roof: A.ROOF_PLANK, wall: A.WALL_TAN
    });
    building(cv, {
        name: 'Deposito agricola', x: 3, y: 53, w: 6, roofH: 3, wallH: 3,
        roof: A.ROOF_THATCH, wall: A.WALL_TAN
    });
    building(cv, {
        name: 'Ferraria', x: 14, y: 53, w: 6, roofH: 3, wallH: 3,
        roof: A.ROOF_DARK, wall: A.WALL_GRAY, chimney: true, sign: T.SIGN_TOOL
    });
    building(cv, {
        name: 'Reparo de Relogios GC', x: 21, y: 58, w: 6, roofH: 3, wallH: 3,
        roof: A.ROOF_BEIGE, wall: A.WALL_YELLOW, sign: T.SIGN_SHOP
    });
    cv.set(3, 23, 63, T.CLOCK_FACE);
    building(cv, {
        name: 'Serraria', x: 3, y: 58, w: 6, roofH: 2, wallH: 3,
        roof: A.ROOF_PLANK, wall: A.WALL_BROWN
    });
    building(cv, {
        name: 'Casa do oficineiro', x: 13, y: 58, w: 6, roofH: 3, wallH: 3,
        roof: A.ROOF_ORANGE, wall: A.WALL_CREAM
    });

    for (const [x, y, tile] of [
        [10, 51, T.LOG_PILE], [11, 52, T.LOG], [2, 51, T.STUMP], [21, 51, T.CRATE],
        [10, 66, T.BARREL], [11, 67, T.BARREL_BIG], [19, 66, T.CRATE], [27, 66, T.POT],
        [9, 44, T.RACK], [21, 44, T.LOG_PILE], [2, 61, T.LOG_PILE], [12, 61, T.CRATE],
        [22, 51, T.LOG_PILE], [2, 66, T.LOG]
    ]) cv.set(2, x, y, tile);

    // terreno vago do bairro, reservado aos objetos deslocados pela fenda (P1)
    rect(cv, 1, 22, 53, 27, 57, auto(A.DIRT));
    fenceRect(cv, 22, 53, 27, 57, A.WOOD_FENCE, [{ x0: 24, x1: 25, y0: 57, y1: 57 }]);
    cv.set(2, 23, 55, T.PIT);

    // pomar a oeste da colina, fechando o braco da ferradura
    rect(cv, 1, 8, 34, 9, 42, auto(A.PATH));
    for (let x = 4; x <= 16; x += 3) {
        for (let y = 30; y <= 39; y += 3) {
            if (x === 7 || x === 10) continue;
            cv.set(2, x, y, T.TREE_ROUND);
        }
    }
    cv.set(2, 11, 41, T.SIGNPOST);
}

function buildResidential(cv) {
    const palettes = [
        { roof: A.ROOF_THATCH, wall: A.WALL_BROWN },
        { roof: A.ROOF_ORANGE, wall: A.WALL_TAN },
        { roof: A.ROOF_SHINGLE, wall: A.WALL_CREAM },
        { roof: A.ROOF_DARK_RED, wall: A.WALL_YELLOW },
        { roof: A.ROOF_PLANK, wall: A.WALL_TAN },
        { roof: A.ROOF_BEIGE, wall: A.WALL_BROWN }
    ];
    const lots = [
        [54, 43, 6], [61, 43, 6], [72, 43, 6],
        [62, 52, 6], [70, 52, 6],
        [54, 58, 6], [62, 58, 6]
    ];
    lots.forEach((lot, i) => {
        const [x, y, w] = lot;
        const palette = palettes[i % palettes.length];
        building(cv, {
            name: 'Casa familiar ' + (i + 1), x, y, w, roofH: 3, wallH: 3,
            roof: palette.roof, wall: palette.wall, chimney: i % 3 === 0
        });
        // quintais: horta, barril e canteiro junto de cada casa
        cv.set(2, x - 1, y + 6, chance(0.5) ? T.BUSH_M : T.FLOWER_ORANGE);
        cv.set(2, x + w, y + 5, T.BARREL);
        if (i % 2 === 0) cv.set(2, x + 1, y + 7, T.CROP);
    });

    building(cv, {
        name: 'Casa do cuidador de monstros', x: 71, y: 58, w: 6, roofH: 3, wallH: 3,
        roof: A.ROOF_SHINGLE, wall: A.WALL_TAN, sign: T.SIGN_SHOP
    });

    // vielas curtas que retornam a rua principal do bairro
    rect(cv, 1, 53, 50, 78, 51, auto(A.PATH));
    rect(cv, 1, 53, 61, 78, 61, auto(A.PATH));
    rect(cv, 1, 68, 62, 70, 67, auto(A.PATH));
    rect(cv, 1, 59, 43, 60, 61, auto(A.PATH));
    rect(cv, 1, 68, 42, 70, 50, auto(A.PATH));

    // area para monstros domesticos, ao norte do bairro
    rect(cv, 1, 70, 32, 78, 39, auto(A.DIRT));
    fenceRect(cv, 70, 32, 78, 39, A.WOOD_FENCE, [{ x0: 73, x1: 74, y0: 39, y1: 39 }]);
    cv.set(2, 72, 34, T.HAY);
    cv.set(2, 76, 35, T.TROUGH);
    cv.set(2, 74, 37, T.PEBBLES);
    cv.set(2, 71, 36, T.BUCKET);
    rect(cv, 1, 73, 39, 74, 41, auto(A.PATH));
}

function buildSouthGate(cv) {
    // portao aberto, sem muralha
    for (const gx of [36, 44]) {
        cv.set(2, gx, 85, T.COLUMN_TOP);
        cv.set(2, gx, 86, T.COLUMN_BASE);
    }
    cv.set(2, 35, 86, T.SIGNPOST);

    building(cv, {
        name: 'Estalagem dos Viajantes', x: 27, y: 73, w: 8, roofH: 3, wallH: 3,
        roof: A.ROOF_DARK_RED, wall: A.WALL_CREAM, sign: T.SIGN_INN,
        door: T.DOOR_PUBLIC
    });
    building(cv, {
        name: 'Posto de informacoes', x: 46, y: 73, w: 6, roofH: 2, wallH: 2,
        roof: A.ROOF_BEIGE, wall: A.WALL_TAN, sign: T.SIGN_SHOP
    });
    building(cv, {
        name: 'Casa do porteiro', x: 30, y: 87, w: 5, roofH: 2, wallH: 2,
        roof: A.ROOF_SHINGLE, wall: A.WALL_BROWN
    });
    building(cv, {
        name: 'Abrigo de carrocas', x: 27, y: 81, w: 7, roofH: 2, wallH: 1,
        roof: A.ROOF_PLANK, wall: A.WALL_BROWN, door: null
    });

    // grande moinho da entrada sul, com torre redonda voltada para o remanso
    building(cv, {
        name: 'Grande Moinho', x: 19, y: 76, w: 8, roofH: 3, wallH: 3,
        roof: A.ROOF_THATCH, wall: A.WALL_GRAY, door: T.DOOR_PUBLIC
    });
    tower(cv, 17, 75);
    cv.set(2, 17, 80, T.TOWER_BASE);
    cv.set(2, 18, 80, T.RACK); // armacao da roda d'agua
    cv.set(2, 27, 79, T.CRATE);

    // estabulos e area de pouso
    rect(cv, 1, 46, 82, 57, 89, auto(A.DIRT));
    fenceRect(cv, 46, 82, 57, 89, A.WOOD_FENCE, [{ x0: 46, x1: 46, y0: 85, y1: 86 }]);
    building(cv, {
        name: 'Estabulos', x: 48, y: 83, w: 6, roofH: 2, wallH: 2,
        roof: A.ROOF_SHINGLE, wall: A.WALL_BROWN
    });
    cv.set(2, 55, 88, T.HAY);
    cv.set(2, 47, 88, T.TROUGH);
    cv.set(2, 52, 88, T.HAY);
    rect(cv, 1, 43, 85, 46, 86, auto(A.PATH));

    // parada de carrocas, ao lado da estalagem
    rect(cv, 1, 27, 84, 35, 85, auto(A.PAVING));
    cv.set(2, 26, 84, T.CRATE);
    cv.set(2, 36, 84, T.BARREL_BIG);

    for (const [x, y] of [[37, 84], [43, 84], [37, 77], [43, 77]]) lamp(cv, x, y);
}

function buildSunFields(cv) {
    // trecho curto dos Campos do Primeiro Sol (saida leste/sul)
    building(cv, {
        name: 'Celeiro dos Campos', x: 64, y: 72, w: 7, roofH: 3, wallH: 3,
        roof: A.ROOF_THATCH, wall: A.WALL_TAN, door: T.DOOR_PUBLIC
    });

    const plots = [
        { x0: 64, y0: 83, x1: 70, y1: 88, rows: T.CROP_ROW },
        { x0: 72, y0: 83, x1: 78, y1: 88, rows: T.WHEAT_ROW },
        { x0: 72, y0: 73, x1: 78, y1: 77, rows: T.PLOW_ROW }
    ];
    for (const plot of plots) {
        for (let y = plot.y0; y <= plot.y1; y++) {
            for (let x = plot.x0; x <= plot.x1; x++) {
                const tile = x === plot.x0 ? plot.rows[0] : x === plot.x1 ? plot.rows[2] : plot.rows[1];
                cv.set(1, x, y, tile);
            }
        }
        fenceRect(cv, plot.x0 - 1, plot.y0 - 1, plot.x1 + 1, plot.y1 + 1, A.WOOD_FENCE,
            [{ x0: plot.x0 + 2, x1: plot.x0 + 3, y0: plot.y0 - 1, y1: plot.y0 - 1 }]);
    }

    for (let x = 63; x <= 70; x += 3) cv.set(2, x, 80, T.TREE_ROUND);

    // capim alto: unica area de encontro do P0
    for (let y = 71; y <= 90; y++) {
        for (let x = 60; x <= 79; x++) {
            if (cv.get(1, x, y) !== 0 || cv.get(2, x, y) !== 0) continue;
            if ((x * 3 + y * 5) % 7 < 4) cv.set(1, x, y, auto(A.TALL_GRASS));
        }
    }

    cv.set(2, 62, 82, T.SIGNPOST);
    cv.set(2, 66, 90, T.SIGNPOST);
}

function buildBorders(cv) {
    // moldura de floresta, deixando abertas a saida sul e a sudeste
    for (let y = 0; y < HEIGHT; y += 2) {
        if (y >= 57 && y <= 62) continue;
        bigTree(cv, 0, y);
        if (y < 44 || y > 62) bigTree(cv, 2, y);
        if (y < 68 || y > 82) bigTree(cv, 78, y);
    }
    for (let x = 0; x < WIDTH; x += 2) bigTree(cv, x, 0);
    for (let x = 4; x < 34; x += 2) if (chance(0.6)) bigTree(cv, x, HEIGHT - 2);
    for (let x = 46; x < 62; x += 2) if (chance(0.6)) bigTree(cv, x, HEIGHT - 2);

    // bosques que emolduram a colina e preenchem os vazios do norte
    forest(cv, 2, 4, 22, 20, 0.5);
    forest(cv, 60, 4, 76, 20, 0.5);
    forest(cv, 2, 22, 16, 28, 0.45);
    forest(cv, 64, 22, 76, 30, 0.45);
    forest(cv, 2, 30, 4, 40, 0.5);
    forest(cv, 2, 68, 8, 70, 0.4);
    forest(cv, 2, 82, 22, 90, 0.4);
    forest(cv, 54, 71, 60, 76, 0.35);

    // linha continua de arvores escondendo a costura do planalto
    for (let x = HILL.x0; x <= 48; x += 2) bigTree(cv, x, hillNorth(x) - 1);
    for (let y = 25; y <= 40; y += 2) bigTree(cv, 17, y);
    for (let y = 28; y <= 40; y += 2) bigTree(cv, 62, y);
}

function decorate(cv) {
    // vegetacao rasteira apenas onde ha grama livre, sem invadir caminhos
    for (let y = 1; y < HEIGHT - 1; y++) {
        for (let x = 1; x < WIDTH - 1; x++) {
            if (cv.get(1, x, y) !== 0 || cv.get(2, x, y) !== 0) continue;
            const ground = cv.get(0, x, y);
            if (ground !== auto(A.GRASS) && ground !== auto(A.CLIFF_TOP)) continue;
            const roll = rng();
            if (roll < 0.05) {
                cv.set(2, x, y, pick([T.BUSH_S, T.BUSH_M, T.GRASS_TUFT, T.BUSH_L]));
            } else if (roll < 0.075) {
                cv.set(2, x, y, pick([T.FLOWER_WHITE, T.FLOWER_PURPLE, T.FLOWER_BLUE, T.FLOWER_ORANGE]));
            } else if (roll < 0.082) {
                cv.set(2, x, y, pick([T.ROCK, T.STONES, T.PEBBLE_SMALL]));
            } else if (roll < 0.088) {
                cv.set(2, x, y, T.TREE_ROUND);
            }
        }
    }
    // margens do riacho
    for (let x = 1; x < WIDTH - 1; x++) {
        for (let y = STREAM.y0 - 3; y <= STREAM.y1 + 3; y++) {
            if (!cv.inside(x, y) || inStream(x, y)) continue;
            if (cv.get(1, x, y) !== 0 || cv.get(2, x, y) !== 0) continue;
            if (!inStream(x, y - 1) && !inStream(x, y + 1)) continue;
            if (chance(0.3)) cv.set(2, x, y, pick([T.GRASS_TUFT, T.BUSH_S, T.PEBBLE_SMALL]));
        }
    }
    for (let x = 3; x < WIDTH - 3; x += 5) {
        const y = STREAM.y0 + streamOffset(x) + 1;
        if (cv.get(1, x, y) === 0 && inStream(x, y)) cv.set(2, x, y, T.LILY);
    }
}

function paintRegions(cv) {
    // regiao 1 = encontros selvagens (MON_Encounters). Somente no capim alto
    // dos Campos do Primeiro Sol; nunca dentro da vila.
    for (let y = 0; y < HEIGHT; y++) {
        for (let x = 0; x < WIDTH; x++) {
            if (cv.get(1, x, y) === auto(A.TALL_GRASS)) cv.setRegion(x, y, 1);
        }
    }
}

// ---------------------------------------------------------------------------
// Eventos minimos de navegacao
// ---------------------------------------------------------------------------

function makeEvent(id, name, x, y, lines) {
    const list = [{ code: 101, indent: 0, parameters: ['', 0, 0, 2, name] }];
    for (const line of lines) list.push({ code: 401, indent: 0, parameters: [line] });
    list.push({ code: 0, indent: 0, parameters: [] });
    return {
        id, name, note: '', x, y,
        pages: [{
            conditions: {
                actorId: 1, actorValid: false, itemId: 1, itemValid: false,
                selfSwitchCh: 'A', selfSwitchValid: false,
                switch1Id: 1, switch1Valid: false, switch2Id: 1, switch2Valid: false,
                variableId: 1, variableValid: false, variableValue: 0
            },
            directionFix: false,
            image: { characterIndex: 0, characterName: '', direction: 2, pattern: 1, tileId: 0 },
            list,
            moveFrequency: 3,
            moveRoute: { list: [{ code: 0, parameters: [] }], repeat: true, skippable: false, wait: false },
            moveSpeed: 3,
            moveType: 0,
            priorityType: 0,
            stepAnime: false,
            through: true,
            trigger: 1,
            walkAnime: false
        }]
    };
}

function buildEvents() {
    return [
        null,
        makeEvent(1, 'Ponto de Partida', 40, 88,
            ['Vila Primeiro Passo.', 'Ano 7 da Nova Arvore.']),
        makeEvent(2, 'Placa da Entrada', 37, 86,
            ['Entrada dos Viajantes.', 'Ao norte: Praca do Primeiro Passo.']),
        makeEvent(3, 'Quadro de Avisos', 36, 57,
            ['Quadro de avisos da praca.',
                'A colina do Colegio fica ao norte.',
                'Os Campos do Primeiro Sol, a sudeste.']),
        makeEvent(4, 'Placa da Colina', 39, 50,
            ['Colina do Colegio.', 'Escadaria para o Colegio de Primas.']),
        makeEvent(5, 'Placa do Campo', 50, 20,
            ['Campo do Primeiro Sonho.', 'A cerimonia acontece aqui.']),
        makeEvent(6, 'Placa dos Campos', 62, 82,
            ['Campos do Primeiro Sol.', 'Cuidado com os monstros no capim alto.'])
    ];
}

// ---------------------------------------------------------------------------
// Escrita
// ---------------------------------------------------------------------------

function buildMap() {
    const cv = new MapCanvas(WIDTH, HEIGHT);
    buildTerrain(cv);
    buildRoads(cv);
    buildCollegeHill(cv);
    buildDreamField(cv);
    buildPlaza(cv);
    buildWorkshops(cv);
    buildResidential(cv);
    buildSouthGate(cv);
    buildSunFields(cv);
    buildBorders(cv);
    decorate(cv);
    paintRegions(cv);

    SANITY.roofProps = clearRoofProps(cv);
    SANITY.clocks = fixClockFaces(cv);
    SANITY.doorways = openDoorways(cv);
    SANITY.carved = carveDoorPaths(cv);

    return {
        autoplayBgm: false,
        autoplayBgs: false,
        battleback1Name: '',
        battleback2Name: '',
        bgm: { name: '', pan: 0, pitch: 100, volume: 90 },
        bgs: { name: '', pan: 0, pitch: 100, volume: 90 },
        disableDashing: false,
        displayName: MAP_NAME,
        encounterList: [],
        encounterStep: 30,
        height: HEIGHT,
        note: 'Gerado por tools/build_map_vila.js — Marco P0 (Biblia secoes 24 e 31).',
        parallaxLoopX: false,
        parallaxLoopY: false,
        parallaxName: '',
        parallaxShow: true,
        parallaxSx: 0,
        parallaxSy: 0,
        scrollType: 0,
        specifyBattleback: false,
        tilesetId: TILESET_ID,
        width: WIDTH,
        data: cv.resolve(),
        events: buildEvents()
    };
}

// ---------------------------------------------------------------------------
// Saneamento e verificacao
// ---------------------------------------------------------------------------

const SPAWN = { x: 40, y: 88 };
const TILE_FLAGS = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'data', 'Tilesets.json'), 'utf8')
)[TILESET_ID].flags;

// Telhado nao aceita objeto por cima (poste, caixote, cerca): so chamine.
function clearRoofProps(cv) {
    let removed = 0;
    for (const b of BUILDINGS) {
        for (let y = b.roofY0; y <= b.roofY1; y++) {
            for (let x = b.x; x < b.x + b.w; x++) {
                for (const layer of [2, 3]) {
                    const value = cv.get(layer, x, y);
                    if (!value || value === T.CHIMNEY) continue;
                    if (layer === 3 && value === T.CLOCK_FACE) continue;
                    cv.set(layer, x, y, 0);
                    removed++;
                }
            }
        }
    }
    return removed;
}

// O relogio sem ponteiros e marco visual: fica na FACHADA, nunca no telhado.
function fixClockFaces(cv) {
    let moved = 0;
    for (const b of BUILDINGS) {
        for (let y = b.roofY0; y <= b.roofY1; y++) {
            for (let x = b.x; x < b.x + b.w; x++) {
                if (cv.get(3, x, y) !== T.CLOCK_FACE) continue;
                cv.set(3, x, y, 0);
                const fx = b.doorX === b.x ? b.x + 1 : b.doorX - 1;
                cv.set(3, fx, b.doorRow - 1, T.CLOCK_FACE);
                moved++;
            }
        }
    }
    return moved;
}

// Porta sem calcada na frente e porta que nao abre: limpa o obstaculo e, se o
// chao for intransponivel (agua, barranco), assenta caminho de terra.
function openDoorways(cv) {
    let fixed = 0;
    for (const b of BUILDINGS) {
        const y = b.doorRow + 1;
        if (y >= HEIGHT) continue;
        for (const layer of [2, 3]) {
            if (cv.get(layer, b.doorX, y)) { cv.set(layer, b.doorX, y, 0); fixed++; }
        }
        if (!isWalkableGround(cv, b.doorX, y)) {
            for (let d = 0; d < 2 && y + d < HEIGHT; d++) {
                cv.set(0, b.doorX, y + d, auto(A.GRASS));
                cv.set(1, b.doorX, y + d, auto(A.PATH));
                cv.set(2, b.doorX, y + d, 0);
                cv.set(3, b.doorX, y + d, 0);
            }
            fixed++;
        }
    }
    return fixed;
}

function isWalkableGround(cv, x, y) {
    const top = cv.get(1, x, y) || cv.get(0, x, y);
    if (!isAuto(top)) return top === 0;
    const kind = kindOf(top);
    return kind !== A.WATER && kind !== A.WATER_BASIN
        && kind !== A.CLIFF_SIDE
        && kind !== A.WOOD_FENCE && kind !== A.IRON_FENCE;
}

// Porta que nao alcanca a rua ganha uma trilha ate ela. Roda depois de tudo
// desenhado, entao vale para qualquer layout futuro sem ajuste manual.
function carveDoorPaths(cv) {
    let carved = 0;
    for (let pass = 0; pass < 4; pass++) {
        const reach = reachableSet(cv);
        const pending = BUILDINGS.filter(b => !reach.has(idxOf(b.doorX, b.doorRow + 1)));
        if (!pending.length) break;
        for (const b of pending) {
            for (const dir of [1, -1]) {
                const hit = probe(cv, reach, b.doorX, b.doorRow + 1, dir);
                if (hit === null) continue;
                for (let y = b.doorRow + 1; dir > 0 ? y <= hit : y >= hit; y += dir) {
                    cv.set(0, b.doorX, y, auto(A.GRASS));
                    cv.set(1, b.doorX, y, auto(A.PATH));
                    cv.set(2, b.doorX, y, 0);
                    cv.set(3, b.doorX, y, 0);
                }
                carved++;
                break;
            }
        }
    }
    return carved;
}

// procura, na vertical, o primeiro tile ja alcancavel a no maximo 8 passos
function probe(cv, reach, x, y0, dir) {
    for (let step = 1; step <= 8; step++) {
        const y = y0 + dir * step;
        if (y < 0 || y >= HEIGHT) return null;
        if (reach.has(idxOf(x, y))) return y;
    }
    return null;
}

const idxOf = (x, y) => y * WIDTH + x;

function reachableSet(cv) {
    const map = { width: WIDTH, height: HEIGHT, data: cv.resolve() };
    return verifyReachable(map).seen;
}

// BFS pelo mapa resolvido: toda porta tem de ser alcancavel a pe da entrada sul.
function verifyReachable(map) {
    const { width: w, height: h, data } = map;
    // espelha Game_Map.checkPassage: percorre de cima para baixo e a PRIMEIRA
    // camada que não seja estrela decide. Sem isto a ponte sobre o riacho não
    // conta, porque a água embaixo dela é intransponível.
    const pass = (x, y) => {
        if (x < 0 || y < 0 || x >= w || y >= h) return false;
        for (const z of [3, 2, 1, 0]) {
            const flag = TILE_FLAGS[data[(z * h + y) * w + x]] || 0;
            if (flag & 0x10) continue;
            return (flag & 0x0f) !== 0x0f;
        }
        return false;
    };
    const start = SPAWN;
    const seen = new Set([start.y * w + start.x]);
    const queue = [start];
    while (queue.length) {
        const { x, y } = queue.shift();
        for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
            const nx = x + dx, ny = y + dy, key = ny * w + nx;
            if (seen.has(key) || !pass(nx, ny)) continue;
            seen.add(key);
            queue.push({ x: nx, y: ny });
        }
    }
    const unreachable = BUILDINGS.filter(b => !seen.has((b.doorRow + 1) * w + b.doorX));
    return { reachable: seen.size, unreachable, seen };
}

function updateMapInfos() {
    const infos = JSON.parse(fs.readFileSync(MAP_INFOS_PATH, 'utf8'));
    while (infos.length <= MAP_ID) infos.push(null);
    const previous = infos[MAP_ID] || {};
    infos[MAP_ID] = {
        id: MAP_ID,
        expanded: false,
        name: MAP_NAME,
        order: previous.order || MAP_ID,
        parentId: 0,
        scrollX: previous.scrollX !== undefined ? previous.scrollX : WIDTH / 2,
        scrollY: previous.scrollY !== undefined ? previous.scrollY : HEIGHT / 2
    };
    fs.writeFileSync(MAP_INFOS_PATH, JSON.stringify(infos));
}

function main() {
    const map = buildMap();
    const walk = verifyReachable(map);
    if (walk.unreachable.length) {
        console.error('FALHOU: %d porta(s) inalcancavel(is) a pe:\n  %s',
            walk.unreachable.length,
            walk.unreachable.map(b => `${b.name} (${b.doorX},${b.doorRow + 1})`).join('\n  '));
        process.exit(1);
    }
    fs.writeFileSync(MAP_PATH, JSON.stringify(map));
    updateMapInfos();
    console.log('Map003 gerado: %dx%d, %d construcoes, %d eventos.',
        WIDTH, HEIGHT, BUILDINGS.length, map.events.filter(Boolean).length);
    console.log('  saneamento: %d props sobre telhado, %d relogios movidos, %d portas abertas',
        SANITY.roofProps, SANITY.clocks, SANITY.doorways);
    console.log('  caminhavel: %d tiles, todas as %d portas alcancaveis de (%d,%d)',
        walk.reachable, BUILDINGS.length, SPAWN.x, SPAWN.y);
}

if (require.main === module) main();

module.exports = { buildMap, WIDTH, HEIGHT, BUILDINGS };
