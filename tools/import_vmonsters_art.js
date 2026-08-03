"use strict";
/*
 * import_vmonsters_art.js — importa a arte de V-Monsters (IP do dono) para img/monsters/vmo/.
 *
 *   node tools/import_vmonsters_art.js [--src <dir>] [--out <dir>] [--portrait <px>]
 *
 * Só lê o repo de origem; escreve exclusivamente dentro de --out.
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_SRC = path.resolve(ROOT, "../vmonsters-forgotten-link/Assets/Sprites/Monsters");
const DEFAULT_OUT = path.join(ROOT, "img/monsters/vmo");
const SPECIES_FILE = path.join(ROOT, "data/species/VMO.json");

// ART_BOX da Scene_MonBattle: quadro maior que isso seria reduzido e perderia o pixel art
const FRAME_BOX = 96;
const DEFAULT_PORTRAIT = 512;

// Toda folha da fonte é 4 quadros × 6 animações em ordem de linha; os rótulos de
// ss_quillara (_0_idle, _4_run, _8_melee, _12_atk, _16_damage, _20_happy) nomeiam as linhas.
const ANIMATIONS = ["idle", "run", "melee", "atk", "damage", "happy"];
const ANIM_FRAMES = 4;

//===========================================================================
// PNG — decode/encode em Node puro (zlib), para recortar quadro por quadro
//===========================================================================
const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

const CRC_TABLE = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c;
    }
    return t;
})();

function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

function paeth(a, b, c) {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    return pb <= pc ? b : c;
}

function unfilter(raw, height, stride, bpp) {
    const out = Buffer.alloc(stride * height);
    let ri = 0;
    for (let y = 0; y < height; y++) {
        const type = raw[ri++];
        const base = y * stride;
        const prev = base - stride;
        for (let x = 0; x < stride; x++) {
            const a = x >= bpp ? out[base + x - bpp] : 0;
            const b = y > 0 ? out[prev + x] : 0;
            const c = y > 0 && x >= bpp ? out[prev + x - bpp] : 0;
            const v = raw[ri + x];
            let r;
            if (type === 0) r = v;
            else if (type === 1) r = v + a;
            else if (type === 2) r = v + b;
            else if (type === 3) r = v + ((a + b) >> 1);
            else if (type === 4) r = v + paeth(a, b, c);
            else throw new Error("filtro PNG desconhecido: " + type);
            out[base + x] = r & 0xff;
        }
        ri += stride;
    }
    return out;
}

function decodePng(buf) {
    if (buf.length < 8 || !buf.subarray(0, 8).equals(PNG_SIG)) throw new Error("assinatura PNG inválida");
    let pos = 8;
    let head = null;
    let palette = null;
    let trns = null;
    const idat = [];
    while (pos + 8 <= buf.length) {
        const len = buf.readUInt32BE(pos);
        const type = buf.toString("ascii", pos + 4, pos + 8);
        const data = buf.subarray(pos + 8, pos + 8 + len);
        if (type === "IHDR") {
            head = {
                width: data.readUInt32BE(0), height: data.readUInt32BE(4),
                depth: data[8], color: data[9], interlace: data[12]
            };
        } else if (type === "PLTE") palette = Buffer.from(data);
        else if (type === "tRNS") trns = Buffer.from(data);
        else if (type === "IDAT") idat.push(Buffer.from(data));
        else if (type === "IEND") break;
        pos += 12 + len;
    }
    if (!head) throw new Error("PNG sem IHDR");
    if (head.interlace) throw new Error("PNG entrelaçado não suportado");
    if (head.depth !== 8 && head.depth !== 16) throw new Error("profundidade PNG não suportada: " + head.depth);
    const channels = CHANNELS[head.color];
    if (!channels) throw new Error("color type PNG não suportado: " + head.color);

    const step = head.depth / 8;
    const bpp = channels * step;
    const stride = head.width * bpp;
    const pix = unfilter(zlib.inflateSync(Buffer.concat(idat)), head.height, stride, bpp);

    const data = Buffer.alloc(head.width * head.height * 4);
    for (let y = 0; y < head.height; y++) {
        for (let x = 0; x < head.width; x++) {
            const s = y * stride + x * bpp;
            const d = (y * head.width + x) * 4;
            const at = (i) => pix[s + i * step];
            if (head.color === 3) {
                const idx = pix[s];
                data[d] = palette[idx * 3];
                data[d + 1] = palette[idx * 3 + 1];
                data[d + 2] = palette[idx * 3 + 2];
                data[d + 3] = trns && idx < trns.length ? trns[idx] : 255;
            } else if (head.color === 0 || head.color === 4) {
                const g = at(0);
                data[d] = data[d + 1] = data[d + 2] = g;
                data[d + 3] = head.color === 4 ? at(1) : 255;
            } else {
                data[d] = at(0);
                data[d + 1] = at(1);
                data[d + 2] = at(2);
                data[d + 3] = head.color === 6 ? at(3) : 255;
            }
        }
    }
    return { width: head.width, height: head.height, data };
}

function chunk(type, data) {
    const out = Buffer.alloc(data.length + 12);
    out.writeUInt32BE(data.length, 0);
    out.write(type, 4, "ascii");
    data.copy(out, 8);
    out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
    return out;
}

function encodePng(img) {
    const stride = img.width * 4;
    const raw = Buffer.alloc((stride + 1) * img.height);
    const cand = [0, 1, 2, 3, 4].map(() => Buffer.alloc(stride));
    for (let y = 0; y < img.height; y++) {
        const base = y * stride;
        const prev = base - stride;
        for (let x = 0; x < stride; x++) {
            const v = img.data[base + x];
            const a = x >= 4 ? img.data[base + x - 4] : 0;
            const b = y > 0 ? img.data[prev + x] : 0;
            const c = y > 0 && x >= 4 ? img.data[prev + x - 4] : 0;
            cand[0][x] = v;
            cand[1][x] = (v - a) & 0xff;
            cand[2][x] = (v - b) & 0xff;
            cand[3][x] = (v - ((a + b) >> 1)) & 0xff;
            cand[4][x] = (v - paeth(a, b, c)) & 0xff;
        }
        let best = 0;
        let bestCost = Infinity;
        for (let f = 0; f < 5; f++) {
            let cost = 0;
            for (let x = 0; x < stride; x++) {
                const s = cand[f][x];
                cost += s < 128 ? s : 256 - s;
            }
            if (cost < bestCost) { bestCost = cost; best = f; }
        }
        raw[y * (stride + 1)] = best;
        cand[best].copy(raw, y * (stride + 1) + 1);
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(img.width, 0);
    ihdr.writeUInt32BE(img.height, 4);
    ihdr[8] = 8;
    ihdr[9] = 6;
    return Buffer.concat([
        PNG_SIG,
        chunk("IHDR", ihdr),
        chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
        chunk("IEND", Buffer.alloc(0))
    ]);
}

//===========================================================================
// Operações de imagem
//===========================================================================
function blit(dst, src, sx, sy, w, h, dx, dy) {
    for (let y = 0; y < h; y++) {
        const from = ((sy + y) * src.width + sx) * 4;
        src.data.copy(dst.data, ((dy + y) * dst.width + dx) * 4, from, from + w * 4);
    }
}

function scaleNearest(img, factor) {
    if (factor <= 1) return img;
    const width = img.width * factor;
    const height = img.height * factor;
    const data = Buffer.alloc(width * height * 4);
    for (let y = 0; y < height; y++) {
        const sy = (y / factor) | 0;
        for (let x = 0; x < width; x++) {
            const s = (sy * img.width + ((x / factor) | 0)) * 4;
            img.data.copy(data, (y * width + x) * 4, s, s + 4);
        }
    }
    return { width, height, data };
}

function resizeArea(img, width, height) {
    const data = Buffer.alloc(width * height * 4);
    const xr = img.width / width;
    const yr = img.height / height;
    for (let y = 0; y < height; y++) {
        const y0 = Math.floor(y * yr);
        const y1 = Math.min(img.height, Math.max(y0 + 1, Math.ceil((y + 1) * yr)));
        for (let x = 0; x < width; x++) {
            const x0 = Math.floor(x * xr);
            const x1 = Math.min(img.width, Math.max(x0 + 1, Math.ceil((x + 1) * xr)));
            let r = 0, g = 0, b = 0, a = 0, n = 0;
            for (let sy = y0; sy < y1; sy++) {
                for (let sx = x0; sx < x1; sx++) {
                    const i = (sy * img.width + sx) * 4;
                    const al = img.data[i + 3];
                    // média premultiplicada: sem isso o preto dos pixels transparentes sujaria a borda
                    r += img.data[i] * al;
                    g += img.data[i + 1] * al;
                    b += img.data[i + 2] * al;
                    a += al;
                    n++;
                }
            }
            const o = (y * width + x) * 4;
            if (a > 0) {
                data[o] = Math.round(r / a);
                data[o + 1] = Math.round(g / a);
                data[o + 2] = Math.round(b / a);
            }
            data[o + 3] = Math.round(a / n);
        }
    }
    return { width, height, data };
}

function fitBox(img, max) {
    if (img.width <= max && img.height <= max) return img;
    const s = Math.min(max / img.width, max / img.height);
    return resizeArea(img, Math.max(1, Math.round(img.width * s)), Math.max(1, Math.round(img.height * s)));
}

//===========================================================================
// Meta do Unity — os retângulos de quadro só existem aqui
//===========================================================================
function parseSpriteMeta(text) {
    const rects = [];
    let mode = null;
    let cur = null;
    let inRect = false;
    for (const line of text.split(/\r?\n/)) {
        let m = /^\s*spriteMode:\s*(\d+)/.exec(line);
        if (m) { if (mode === null) mode = Number(m[1]); continue; }
        m = /^ {6}name:\s*(.+)$/.exec(line);
        if (m) { cur = { name: m[1].trim(), x: 0, y: 0, w: 0, h: 0 }; rects.push(cur); inRect = false; continue; }
        if (!cur) continue;
        if (/^ {6}rect:\s*$/.test(line)) { inRect = true; continue; }
        if (!inRect) continue;
        if ((m = /^\s*x:\s*(-?\d+)/.exec(line))) cur.x = Number(m[1]);
        else if ((m = /^\s*y:\s*(-?\d+)/.exec(line))) cur.y = Number(m[1]);
        else if ((m = /^\s*width:\s*(\d+)/.exec(line))) cur.w = Number(m[1]);
        else if ((m = /^\s*height:\s*(\d+)/.exec(line))) { cur.h = Number(m[1]); inRect = false; }
    }
    return { mode: mode === null ? 0 : mode, rects };
}

function orderedFrames(rects) {
    const indexed = rects
        .map((r) => ({ r, i: /_(\d+)(?:_[A-Za-z]+)?$/.exec(r.name) }))
        .filter((e) => e.i)
        .sort((a, b) => Number(a.i[1]) - Number(b.i[1]))
        .map((e) => e.r);
    return indexed.length ? indexed : rects;
}

function cellOf(rects) {
    return rects.reduce((max, r) => Math.max(max, r.w, r.h), 0);
}

// A cena deriva frameSize de bitmap.height e anima na horizontal; a folha da
// Unity é uma grade com origem embaixo, então precisa ser reempacotada.
// Quadro menor que a célula entra centrado embaixo, que é o pivot (0.5, 0) da fonte.
function packSheet(sheet, rects, cell, factor) {
    const dst = { width: cell * rects.length, height: cell, data: Buffer.alloc(cell * rects.length * cell * 4) };
    rects.forEach((r, i) => {
        const dx = i * cell + Math.floor((cell - r.w) / 2);
        blit(dst, sheet, r.x, sheet.height - r.y - r.h, r.w, r.h, dx, cell - r.h);
    });
    return { image: scaleNearest(dst, factor), frames: rects.length, frameSize: cell * factor };
}

//===========================================================================
// WebP — as evoluções bloqueadas estão salvas como .png com conteúdo WebP
//===========================================================================
function isWebp(buf) {
    return buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP";
}

function has(cmd, args) {
    const r = spawnSync(cmd, args, { stdio: "ignore" });
    return !r.error;
}

function pickWebpDecoder() {
    if (has("dwebp", ["-version"])) return { name: "dwebp", run: (s, d) => spawnSync("dwebp", [s, "-o", d], { stdio: "ignore" }) };
    if (has("ffmpeg", ["-version"])) return { name: "ffmpeg", run: (s, d) => spawnSync("ffmpeg", ["-y", "-i", s, d], { stdio: "ignore" }) };
    if (has("sips", ["--version"])) return { name: "sips", run: (s, d) => spawnSync("sips", ["-s", "format", "png", s, "--out", d], { stdio: "ignore" }) };
    return null;
}

//===========================================================================
// Descoberta da origem
//===========================================================================
const SOURCE_EXT = new Set([".png", ".webp"]);

function slug(name) {
    return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function classify(base) {
    if (/^ss[_-]/i.test(base)) return "sheet";
    if (/emission/i.test(base)) return "emission";
    if (/icon/i.test(base)) return "icon";
    return "splash";
}

// "Game Sturtle_20250922104120" -> "Sturtle"
function splashName(base) {
    return base.replace(/^(game|geme)\s+/i, "").replace(/_\d{6,}$/, "").trim();
}

function discover(src) {
    const monsters = new Map();
    const record = (name, dir) => {
        const key = slug(name);
        if (!monsters.has(key)) monsters.set(key, { key, name, dir, splash: null, sheet: null, emission: null, icon: null });
        return monsters.get(key);
    };
    for (const entry of fs.readdirSync(src, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        if (!entry.isDirectory()) continue;
        const dir = path.join(src, entry.name);
        const primaryName = entry.name.includes(" - ") ? entry.name.split(" - ").slice(1).join(" - ").trim() : entry.name;
        const primary = record(primaryName, entry.name);
        for (const file of fs.readdirSync(dir).sort()) {
            const ext = path.extname(file).toLowerCase();
            if (!SOURCE_EXT.has(ext)) continue;
            const base = path.basename(file, path.extname(file));
            const kind = classify(base);
            const full = path.join(dir, file);
            if (kind === "splash") {
                const owner = record(splashName(base), entry.name);
                if (!owner.splash) owner.splash = full;
            } else if (!primary[kind]) primary[kind] = full;
        }
    }
    return [...monsters.values()];
}

function loadSpeciesMap() {
    if (!fs.existsSync(SPECIES_FILE)) return null;
    const map = new Map();
    for (const sp of JSON.parse(fs.readFileSync(SPECIES_FILE, "utf8"))) {
        const id = String(sp.id).padStart(3, "0");
        if (sp.name) map.set(slug(sp.name), id);
        if (sp.internalName) map.set(slug(sp.internalName), id);
    }
    return map;
}

//===========================================================================
// Execução
//===========================================================================
function parseArgs(argv) {
    const opts = { src: DEFAULT_SRC, out: DEFAULT_OUT, portrait: DEFAULT_PORTRAIT };
    for (let i = 0; i < argv.length; i += 2) {
        const key = argv[i].replace(/^--/, "");
        if (key in opts) opts[key] = key === "portrait" ? Number(argv[i + 1]) : path.resolve(argv[i + 1]);
    }
    return opts;
}

function resetDir(dir) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
}

function main() {
    const opts = parseArgs(process.argv.slice(2));
    if (!fs.existsSync(opts.src)) {
        console.error("origem não encontrada: " + opts.src);
        process.exit(1);
    }
    const species = loadSpeciesMap();
    const webp = pickWebpDecoder();
    if (!webp) console.warn("AVISO: sem dwebp/ffmpeg/sips — arquivos .png com conteúdo WebP ficam pendentes.");

    const dirs = {
        front: path.join(opts.out, "front"),
        sheet: path.join(opts.out, "sheet"),
        portrait: path.join(opts.out, "portrait"),
        icon: path.join(opts.out, "icon")
    };
    Object.values(dirs).forEach(resetDir);

    const tmp = fs.mkdtempSync(path.join(require("os").tmpdir(), "vmo-"));
    const readImage = (file) => {
        const buf = fs.readFileSync(file);
        if (!isWebp(buf)) return decodePng(buf);
        if (!webp) throw new Error("conteúdo WebP e nenhum conversor disponível");
        const dst = path.join(tmp, slug(path.basename(file)) + ".png");
        const r = webp.run(file, dst);
        if (r.status !== 0 || !fs.existsSync(dst)) throw new Error("falha convertendo WebP com " + webp.name);
        return decodePng(fs.readFileSync(dst));
    };

    const manifest = [];
    const pending = [];
    let bytesIn = 0;
    let bytesOut = 0;
    let written = 0;

    const monsters = discover(opts.src).sort((a, b) => a.key.localeCompare(b.key));
    for (const mon of monsters) {
        if (!mon.sheet) continue;
        try {
            const rects = orderedFrames(parseSpriteMeta(fs.readFileSync(mon.sheet + ".meta", "utf8")).rects);
            if (!rects.length) throw new Error("meta sem retângulos de quadro");
            mon.frames = { rects, cell: cellOf(rects) };
        } catch (err) {
            pending.push(`${mon.name}: folha de batalha ilegível — ${err.message}`);
        }
    }
    // Um único fator para todas as espécies: ampliar cada uma até 96px achataria
    // a diferença de tamanho entre estágio inicial (32px) e evoluído (48px).
    const maxCell = monsters.reduce((max, m) => Math.max(max, m.frames ? m.frames.cell : 0), 0);
    const upscale = Math.max(1, Math.floor(FRAME_BOX / (maxCell || FRAME_BOX)));

    for (const mon of monsters) {
        const id = species ? species.get(mon.key) : null;
        const key = id || mon.key;
        const entry = { key, name: mon.name, speciesId: id ? Number(id) : null, sourceDir: mon.dir };

        const emit = (dir, file, image) => {
            const buf = encodePng(image);
            fs.writeFileSync(path.join(dir, file), buf);
            bytesOut += buf.length;
            written++;
        };

        if (mon.frames) {
            bytesIn += fs.statSync(mon.sheet).size;
            try {
                const { rects, cell } = mon.frames;
                const sheet = readImage(mon.sheet);
                const full = packSheet(sheet, rects, cell, upscale);
                emit(dirs.sheet, key + ".png", full.image);
                entry.sheet = { file: "sheet/" + key + ".png", frames: full.frames, frameSize: full.frameSize, animations: ANIMATIONS };
                // A cena percorre a tira inteira em loop; só a linha de idle lê como
                // animação parada, o resto viraria um desfile de golpes fora de hora.
                const gridded = rects.length === ANIMATIONS.length * ANIM_FRAMES;
                const idle = gridded ? packSheet(sheet, rects.slice(0, ANIM_FRAMES), cell, upscale) : full;
                if (!gridded) pending.push(`${mon.name}: folha fora da grade 4×6 — front/ usa a tira inteira`);
                emit(dirs.front, key + ".png", idle.image);
                entry.front = { file: "front/" + key + ".png", frames: idle.frames, frameSize: idle.frameSize, upscale };
            } catch (err) {
                pending.push(`${mon.name}: folha de batalha falhou — ${err.message}`);
            }
        } else if (!mon.sheet) {
            pending.push(`${mon.name}: sem folha de batalha na origem (só arte estática)`);
        }
        if (mon.emission) pending.push(`${mon.name}: *_Emission não importado (quadros recortados justos, sem consumidor na cena)`);

        if (mon.splash) {
            bytesIn += fs.statSync(mon.splash).size;
            try {
                const img = fitBox(readImage(mon.splash), opts.portrait);
                emit(dirs.portrait, key + ".png", img);
                entry.portrait = { file: "portrait/" + key + ".png", width: img.width, height: img.height };
            } catch (err) {
                pending.push(`${mon.name}: splash art não importada — ${err.message}`);
            }
        } else {
            pending.push(`${mon.name}: sem splash art na origem`);
        }

        if (mon.icon) {
            bytesIn += fs.statSync(mon.icon).size;
            try {
                const img = fitBox(readImage(mon.icon), opts.portrait);
                emit(dirs.icon, key + ".png", img);
                entry.icon = "icon/" + key + ".png";
            } catch (err) {
                pending.push(`${mon.name}: ícone não importado — ${err.message}`);
            }
        }
        manifest.push(entry);
    }

    fs.rmSync(tmp, { recursive: true, force: true });
    fs.writeFileSync(path.join(opts.out, "manifest.json"), JSON.stringify({
        source: opts.src,
        naming: species ? "id de espécie (data/species/VMO.json)" : "internalName em minúsculas (VMO.json ainda não existe)",
        frameBox: FRAME_BOX,
        upscale,
        portraitMax: opts.portrait,
        monsters: manifest
    }, null, 2) + "\n");

    const mb = (n) => (n / 1048576).toFixed(2) + " MB";
    console.log(`origem: ${opts.src}`);
    console.log(`nomes:  ${species ? "id de espécie" : "internalName minúsculo (VMO.json ausente)"}`);
    console.log(`monstros: ${manifest.length} | arquivos escritos: ${written} | upscale dos quadros: ${upscale}x`);
    console.log(`peso: ${mb(bytesIn)} -> ${mb(bytesOut)}`);
    console.log(`folhas de batalha: ${manifest.filter((m) => m.front).length} | retratos: ${manifest.filter((m) => m.portrait).length}`);
    if (pending.length) {
        console.log(`\npendências (${pending.length}):`);
        pending.forEach((p) => console.log("  - " + p));
    }
}

main();
