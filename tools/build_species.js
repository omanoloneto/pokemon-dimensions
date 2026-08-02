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
