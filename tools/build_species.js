// Compila os bancos multi-franquia: junta data/species/*.json em SpeciesExtra.json
// e data/moves/*.json em MovesExtra.json, validando faixas de ID e referências.
//
// Uso (a partir da raiz do repo):  node tools/build_species.js
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DATA = path.join(ROOT, "data");
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

const franchises = readJson(path.join(DATA, "Franchises.json"));
const baseMoves = readJson(path.join(DATA, "Moves.json"));
const types = readJson(path.join(DATA, "Types.json"));

const VALID_TYPES = new Set(Object.keys(types.chart || {}));
const VALID_CONDITIONS = new Set([
    "faintsBelow", "faintsAtLeast", "winsAtLeast", "friendshipAbove",
    "friendshipBelow", "highestStat", "hasItem", "gender"
]);
const VALID_STATS = new Set(["hp", "atk", "def", "spe", "spa", "spd"]);

function collect(dirName) {
    const dir = path.join(DATA, dirName);
    if (!fs.existsSync(dir)) return {};
    const out = {};
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".json")).sort()) {
        out[path.basename(f, ".json")] = readJson(path.join(dir, f));
    }
    return out;
}

const errors = [];
const speciesFiles = collect("species");
const species = [];
const seenIds = new Set();

for (const [key, list] of Object.entries(speciesFiles)) {
    const fr = franchises.list[key];
    if (!fr) { errors.push(`species/${key}.json: franquia "${key}" não existe em Franchises.json`); continue; }
    for (const sp of list) {
        if (sp.id < fr.speciesFrom || sp.id > fr.speciesTo) {
            errors.push(`${sp.internalName} (id ${sp.id}) fora da faixa de ${key} (${fr.speciesFrom}-${fr.speciesTo})`);
        }
        if (seenIds.has(sp.id)) errors.push(`id ${sp.id} duplicado (${sp.internalName})`);
        seenIds.add(sp.id);
        sp.franchise = key;
        species.push(sp);
    }
}
species.sort((a, b) => a.id - b.id);

const moveFiles = collect("moves");
const moves = Object.assign({}, ...Object.values(moveFiles));

// integridade: todo golpe citado por levelMoves precisa existir em algum banco
const byInternal = new Map(species.map(s => [s.internalName, s]));
for (const sp of species) {
    for (const lm of sp.levelMoves || []) {
        if (!baseMoves[lm.move] && !moves[lm.move]) {
            errors.push(`${sp.internalName}: golpe desconhecido "${lm.move}"`);
        }
    }
    for (const ev of sp.evolutions || []) {
        if (!byInternal.has(ev.into) && !ev.external) {
            errors.push(`${sp.internalName}: evolui para "${ev.into}", que não existe`);
        }
        for (const key of Object.keys(ev.condition || {})) {
            if (!VALID_CONDITIONS.has(key)) {
                errors.push(`${sp.internalName}: condição de evolução desconhecida "${key}"`);
            }
            if (key === "highestStat" && !VALID_STATS.has(ev.condition[key])) {
                errors.push(`${sp.internalName}: highestStat inválido "${ev.condition[key]}"`);
            }
        }
    }
    for (const t of [sp.type1, sp.type2]) {
        if (t && !VALID_TYPES.has(t)) errors.push(`${sp.internalName}: tipo inválido "${t}"`);
    }
    if (!sp.type1) errors.push(`${sp.internalName}: sem type1`);
    if (!(sp.catchRate >= 0 && sp.catchRate <= 255)) {
        errors.push(`${sp.internalName}: catchRate fora de 0-255 (${sp.catchRate})`);
    }
    for (const k of VALID_STATS) {
        if (!(sp.stats && sp.stats[k] > 0)) errors.push(`${sp.internalName}: stat "${k}" ausente ou <= 0`);
    }
}

// golpes novos não podem sobrescrever os do banco base (Object.assign é silencioso)
for (const [key, list] of Object.entries(moveFiles)) {
    for (const name of Object.keys(list)) {
        if (baseMoves[name]) errors.push(`moves/${key}.json: "${name}" já existe em Moves.json`);
    }
}

if (errors.length) {
    console.error("FALHOU:\n  " + errors.join("\n  "));
    process.exit(1);
}

fs.writeFileSync(path.join(DATA, "SpeciesExtra.json"), JSON.stringify(species, null, 1));
fs.writeFileSync(path.join(DATA, "MovesExtra.json"), JSON.stringify(moves, null, 1));

const perFranchise = Object.keys(speciesFiles)
    .map(k => `${k}:${speciesFiles[k].length}`).join(" ");
console.log(`OK  SpeciesExtra.json  ${species.length} espécies (${perFranchise})`);
console.log(`OK  MovesExtra.json    ${Object.keys(moves).length} golpes`);
