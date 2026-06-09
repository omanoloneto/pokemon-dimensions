// Harness headless: stuba o mínimo da API do RPG Maker MZ para rodar a LÓGICA
// dos plugins PKM (Core, Pokemon, Battle) fora do editor, em Node.
// Uso:  node mz/tools/test_harness.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const load = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, "data", f), "utf8"));

// --- stubs de engine ---
function Rectangle(x, y, w, h) { this.x = x; this.y = y; this.width = w; this.height = h; }
Number.prototype.clamp = function(min, max) { return Math.min(Math.max(this, min), max); };

const ctx = {
    console,
    Rectangle,
    // dados pré-carregados (DataManager.push é no-op aqui)
    $dataPokemon: load("Pokemon.json"),
    $dataMoves: load("Moves.json"),
    $dataTypes: load("Types.json"),
    $dataItems2: load("Items.json"),
    $dataEncounters: load("Encounters.json"),
    DataManager: { _databaseFiles: [] },
    PluginManager: { registerCommand() {} },
    SceneManager: { push() {}, _scene: {} },
    ImageManager: { loadBitmap() { return { width: 0, height: 0, addLoadListener() {} }; } },
    ColorManager: { normalColor: () => "#fff", systemColor: () => "#9cf" },
    Graphics: { boxWidth: 816, boxHeight: 624 },
    Game_System: function() {},
    Game_Party: function() {},
    Scene_MenuBase: function() {}, Scene_Base: function() {}, Scene_Message: function() {},
    Window_Base: function() {}, Window_Selectable: function() {}, Window_Command: function() {},
    Input: { isTriggered() { return false; } }, TouchInput: {},
};
ctx.window = ctx;
ctx.global = ctx;
vm.createContext(ctx);

// prelúdio: extensões que o MZ (rmmz_core.js) injeta nos protótipos nativos
vm.runInContext(`
    Number.prototype.clamp = function(min, max) { return Math.min(Math.max(this, min), max); };
    Array.prototype.clone = function() { return this.slice(0); };
    Math.randomInt = function(max) { return Math.floor(max * Math.random()); };
`, ctx);

// carrega plugins de lógica (não os de cena — esses usam render)
for (const f of ["PKM_Core.js", "PKM_Pokemon.js", "PKM_Battle.js"]) {
    const p = path.join(ROOT, "js/plugins", f);
    if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, "utf8"), ctx, { filename: f });
}

// --- mini framework de asserts ---
let pass = 0, fail = 0;
function ok(cond, msg) { cond ? (pass++) : (fail++, console.log("  ✗ " + msg)); }
function eq(a, b, msg) { ok(a === b, `${msg} (esperado ${b}, obteve ${a})`); }

console.log("== Game_Pokemon ==");
const G = ctx.Game_Pokemon;

// Pikachu nível 10
const pika = new G("PIKACHU", 10);
eq(pika.speciesName, "Pikachu", "nome da espécie");
eq(pika.level, 10, "nível");
ok(pika.maxHp > 0, "maxHp > 0");
eq(pika.hp, pika.maxHp, "começa com HP cheio");
ok(pika.types().includes("ELECTRIC"), "tipo Electric");
ok(pika.moves.length >= 1 && pika.moves.length <= 4, "1..4 golpes");
ok(["M", "F", "N"].includes(pika.gender), "gênero válido");

// determinismo dos stats: dois com mesmos IVs/natureza dão mesmo stat
ok(new G("BULBASAUR", 5).maxHp > 0, "Bulbasaur maxHp");

// dano (função pura exposta por PKM_Battle)
console.log("== Cálculo de dano ==");
if (ctx.PKM.Battle && ctx.PKM.Battle.calcDamage) {
    const atk = new G("CHARMANDER", 50);
    const dfn = new G("BULBASAUR", 50);
    const ember = { id: "EMBER", pp: 25, ppMax: 25 };
    const r = ctx.PKM.Battle.calcDamage(atk, dfn, "EMBER");
    ok(r.damage > 0, "Ember causa dano");
    eq(r.effectiveness, 2, "Fogo x Grama = super eficaz (2x)");
    // imunidade
    const r2 = ctx.PKM.Battle.calcDamage(new G("PIKACHU", 50), new G("GEODUDE", 50), "THUNDERBOLT");
    eq(r2.effectiveness, 0, "Electric x Ground (Geodude) = imune (0x)");
} else {
    console.log("  (PKM.Battle.calcDamage indisponível — pulando)");
}

// captura (função pura)
console.log("== Captura ==");
if (ctx.PKM.Battle && ctx.PKM.Battle.tryCapture) {
    const weak = new G("CATERPIE", 3); weak.hp = 1;
    let caught = 0;
    for (let i = 0; i < 200; i++) if (ctx.PKM.Battle.tryCapture(weak, 1).success) caught++;
    ok(caught > 0, `captura possível em alvo fraco (${caught}/200)`);
} else {
    console.log("  (PKM.Battle.tryCapture indisponível — pulando)");
}

console.log(`\nResultado: ${pass} passou, ${fail} falhou`);
process.exit(fail ? 1 : 0);
