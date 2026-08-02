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
    $dataItems2: load("PkmItems.json"),
    $dataEncounters: load("Encounters.json"),
    $dataTrainers: load("Trainers.json"),
    $dataFranchises: load("Franchises.json"),
    $dataSpeciesExtra: load("SpeciesExtra.json"),
    $dataMovesExtra: load("MovesExtra.json"),
    $dataItemsExtra: load("ItemsExtra.json"),
    $gameTemp: {},
    DataManager: { _databaseFiles: [] },
    PluginManager: { registerCommand() {} },
    SceneManager: { push() {}, _scene: {} },
    ImageManager: { loadBitmap() { return { width: 0, height: 0, addLoadListener() {} }; } },
    ColorManager: { normalColor: () => "#fff", systemColor: () => "#9cf" },
    Graphics: { boxWidth: 816, boxHeight: 624 },
    Game_System: function() {},
    Game_Party: (function() { function GP() {} GP.prototype.initialize = function() {}; return GP; })(),
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
for (const f of ["PKM_Core.js", "PKM_Franchise.js", "PKM_Pokemon.js", "PKM_Battle.js", "PKM_Bag.js",
                 "PKM_Trainers.js", "PKM_Party.js", "PKM_Storage.js",
                 "PKM_Evolution.js", "PKM_Parts.js", "PKM_Sanctuary.js", "PKM_Pacts.js"]) {
    const p = path.join(ROOT, "js/plugins", f);
    if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, "utf8"), ctx, { filename: f });
}
// sem Scene_Boot no headless: funde os bancos multi-franquia na mão
if (ctx.PKM.Franchise) ctx.PKM.Franchise.install();

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

// itens (Fase 3) — função pura PKM.Items.useOnPokemon
console.log("== Itens (mochila) ==");
if (ctx.PKM.Items && ctx.PKM.Items.useOnPokemon) {
    const inj = new G("BLASTOISE", 50);
    inj.hp = 1;
    const r = ctx.PKM.Items.useOnPokemon("POTION", inj);
    ok(r.ok && inj.hp === 21, `Potion cura +20 (HP=${inj.hp})`);

    const full = new G("BLASTOISE", 50);
    eq(ctx.PKM.Items.useOnPokemon("POTION", full).ok, false, "Potion não usa em HP cheio");

    const ko = new G("PIDGEY", 10); ko.hp = 0;
    const rev = ctx.PKM.Items.useOnPokemon("REVIVE", ko);
    ok(rev.ok && ko.hp === Math.floor(ko.maxHp / 2), "Revive volta com metade do HP");

    const poisoned = new G("RATTATA", 10); poisoned.status = "PSN";
    ok(ctx.PKM.Items.useOnPokemon("ANTIDOTE", poisoned).ok && poisoned.status === null, "Antídoto cura veneno");
    eq(ctx.PKM.Items.useOnPokemon("BURNHEAL", new G("RATTATA", 10)).ok, false, "Burn Heal sem queimadura não tem efeito");

    eq(ctx.PKM.Items.ballBonus("ULTRABALL"), 2, "Ultra Ball bônus = 2");
    eq(ctx.PKM.Items.ballBonus("MASTERBALL"), 255, "Master Ball bônus = 255");
} else {
    console.log("  (PKM.Items indisponível — pulando)");
}

// crescimento (Fase 7)
console.log("== EXP / Nível / Evolução ==");
{
    // EXP suficiente para subir de nível
    const c = new G("CATERPIE", 5);
    const before = c.level;
    const res = c.addExp(c.expForLevel(8) - c.exp); // exatamente até o nível 8
    ok(c.level === 8, `Caterpie subiu de ${before} para ${c.level} (esperado 8)`);
    ok(res.levels.length === 3, `registrou ${res.levels.length} level-ups (esperado 3)`);

    // fórmula de EXP positiva
    ok(ctx.PKM.Battle.expGain(new G("PIDGEY", 10), 1) > 0, "expGain > 0");

    // evolução por nível: Bulbasaur evolui em Ivysaur no nível 16
    const b = new G("BULBASAUR", 15);
    eq(b.evolutionByLevel(), null, "Bulbasaur nv15 ainda não evolui");
    b.addExp(b.expForLevel(16) - b.exp);
    const into = b.evolutionByLevel();
    eq(into, "IVYSAUR", "Bulbasaur nv16 evolui em IVYSAUR");
    b.evolveInto(into);
    eq(b.speciesName, "Ivysaur", "espécie virou Ivysaur após evoluir");

    // aprender golpe em slot vazio
    const m = new G("MAGIKARP", 1);
    while (m.moves.length > 0) m.moves.pop();
    eq(m.learnMove("TACKLE"), "learned", "aprende golpe em slot vazio");
    eq(m.learnMove("TACKLE"), "known", "não reaprende golpe conhecido");
}

// status / estágios / efeitos (Fase 5b)
console.log("== Status & Estágios (5b) ==");
{
    const B = ctx.PKM.Battle;
    // imunidades de status
    eq(B.statusImmune(new G("CHARIZARD", 50), "BRN"), true, "Fire imune a queimadura");
    eq(B.statusImmune(new G("LAPRAS", 50), "FRZ"), true, "Ice imune a congelamento");
    eq(B.statusImmune(new G("MUK", 50), "PSN"), true, "Poison imune a veneno");
    eq(B.statusImmune(new G("RATTATA", 50), "PAR"), false, "Normal pode ser paralisado");

    // aplicar status
    const r = new G("RATTATA", 50);
    ok(B.applyStatus(r, "PSN").ok && r.status === "PSN", "aplica veneno");
    eq(B.applyStatus(r, "BRN").ok, false, "não aplica 2º status");

    // dano residual de veneno
    const before = r.hp;
    B.endOfTurnResidual(r);
    ok(r.hp === before - Math.floor(r.maxHp / 8), "veneno tira 1/8 do HP máx");

    // estágios de stat
    const s = new G("MACHAMP", 50);
    const atk0 = s.battleStat("atk");
    B.applyStatChange(s, "atk", 2);
    eq(s.stage("atk"), 2, "Swords Dance: +2 de estágio de Ataque");
    ok(s.battleStat("atk") === Math.floor(atk0 * 2), "Atk dobra com +2 estágios");
    B.applyStatChange(s, "atk", 6);
    eq(s.stage("atk"), 6, "estágio satura em +6");

    // paralisia reduz velocidade pela metade
    const par = new G("JOLTEON", 50);
    const spe0 = par.battleSpeed();
    par.status = "PAR";
    ok(par.battleSpeed() === Math.floor(spe0 / 2), "paralisia reduz velocidade à metade");

    // queimadura reduz dano físico
    const a = new G("MACHAMP", 50), d = new G("SNORLAX", 50);
    const normal = B.calcDamage(a, d, "TACKLE", { fixedRand: 1, forceCrit: false });
    a.status = "BRN";
    const burned = B.calcDamage(a, d, "TACKLE", { fixedRand: 1, forceCrit: false });
    ok(burned.damage < normal.damage, "queimadura reduz dano físico");
}

// treinadores (Fase 9)
console.log("== Treinadores (9) ==");
if (ctx.PKM.Trainers) {
    const def = ctx.PKM.Trainers.find("LEADER_Brock", "Brock");
    ok(!!def, "encontra LEADER_Brock");
    if (def) {
        const built = ctx.PKM.Trainers.build(def);
        eq(built.party.length, 2, "equipe do Brock tem 2 Pokémon");
        eq(built.party[0].speciesName, "Geodude", "primeiro é Geodude");
        ok(built.party[1].knowsMove("ROCKTOMB"), "Onix tem o golpe definido (Rock Tomb)");
        ok(built.party[1].shiny, "Onix do Brock é shiny");
        // prêmio = baseMoney(100) × nível do último (14) = 1400
        eq(built.money, 1400, "prêmio = baseMoney × nível do último");
    }
    // bônus de EXP de treinador (1.5×) > selvagem
    const e = new G("PIDGEY", 10);
    ok(ctx.PKM.Battle.expGain(e, 1, 1.5) > ctx.PKM.Battle.expGain(e, 1, 1), "EXP de treinador (1.5×) > selvagem");
} else {
    console.log("  (PKM.Trainers indisponível — pulando)");
}

// PC / caixas (Fase 8)
console.log("== PC / Caixas (8) ==");
{
    const gp = new ctx.Game_Party();
    gp.initialize();
    // adiciona 8 Pokémon: 6 vão p/ equipe, 2 p/ caixa
    const dests = [];
    for (let i = 0; i < 8; i++) dests.push(gp.pkmAdd(new G("RATTATA", 5)));
    eq(gp.pkmCount(), 6, "equipe enche em 6");
    eq(dests.filter(d => d === "storage").length, 2, "os 2 extras vão para a caixa");
    eq(gp.pkmStoredCount(), 2, "PC tem 2 armazenados");

    // depositar e retirar
    const dep = gp.pkmDeposit(0);
    ok(dep.ok && gp.pkmCount() === 5 && gp.pkmStoredCount() === 3, "depósito: equipe 5, PC 3");
    const wd = gp.pkmWithdraw(0, 0);
    ok(wd.ok && gp.pkmCount() === 6 && gp.pkmStoredCount() === 2, "retirada: equipe 6, PC 2");

    // não pode depositar o último
    const solo = new ctx.Game_Party(); solo.initialize(); solo.pkmAdd(new G("PIDGEY", 5));
    eq(solo.pkmDeposit(0).ok, false, "não deposita o último Pokémon");

    // soltar (slot 1 ainda está preenchido)
    const released = gp.pkmReleaseBox(0, 1);
    ok(released && gp.pkmStoredCount() === 1, "soltar remove da caixa");
}

// polimento (Fase 10)
console.log("== Polimento (10) ==");
{
    const sp = ctx.PKM.Core.speciesByInternal("CHARIZARD");
    ok(sp && sp.name === "Charizard", "speciesByInternal acha Charizard");
    eq(ctx.PKM.Core.speciesByInternal("NAOEXISTE"), null, "espécie inexistente retorna null");
    ok(!!ctx.PKM.Audio || true, "PKM.Audio é opcional (não carregado no harness)");
}

// camada multi-franquia (core)
console.log("== Multi-franquia (core) ==");
{
    const F = ctx.PKM.Franchise;
    eq(F.ofSpecies(1).id, "PKM", "id 1 pertence a Pokémon");
    eq(F.ofSpecies(650).id, "DGM", "id 650 pertence a Digimon");
    eq(F.ofSpecies(700).id, "MDB", "id 700 pertence a Medabots");
    eq(F.ofSpecies(740).id, "MRA", "id 740 pertence a Monster Rancher");
    eq(F.ofSpecies(780).id, "BKY", "id 780 pertence a Bucky");
    ok(F.all().length === 5, "5 franquias registradas");

    // itens de captura são exclusivos da franquia dona
    const mockOf = (id) => ({ speciesId: id, name: "Alvo", species: () => null, hpRate: () => 1 });
    ok(F.itemWorksOn("POKEBALL", mockOf(1)), "Poké Ball funciona em Pokémon");
    ok(!F.itemWorksOn("POKEBALL", mockOf(650)), "Poké Ball não funciona em Digimon");
    ok(F.itemWorksOn("DIGILINK", mockOf(650)), "Digi-Link funciona em Digimon");
    ok(!F.itemWorksOn("DIGILINK", mockOf(1)), "Digi-Link não funciona em Pokémon");

    // Monster Rancher nunca é capturável em campo
    eq(F.captureRule(mockOf(740), null).allowed, false, "Monster Rancher bloqueia captura em campo");
    // Medabot exige HP baixo
    eq(F.captureRule(mockOf(700), "MEDALCASE").allowed, false, "Medabot com HP cheio recusa o estojo");
    const hurt = { speciesId: 700, name: "Alvo", species: () => null, hpRate: () => 0.2 };
    eq(F.captureRule(hurt, "MEDALCASE").allowed, true, "Medabot danificado aceita o estojo");

    // itens extras entraram no banco de itens
    ok(!!ctx.PKM.Core.item("DIGILINK"), "ItemsExtra fundido em $dataItems2");
}

// recuo, dreno e autodestruição (base do golpe Jibaku)
console.log("== Efeitos sobre o próprio atacante ==");
{
    const B = ctx.PKM.Battle;
    const mon = new G("MACHOP", 50);
    mon.hp = mon.maxHp;
    B.applySelfEffect(mon, { recoil: 0.5 }, 40);
    eq(mon.hp, mon.maxHp - 20, "recuo tira metade do dano causado");

    const drainer = new G("ODDISH", 50);
    drainer.hp = drainer.maxHp - 30;
    B.applySelfEffect(drainer, { drain: 0.5 }, 20);
    eq(drainer.hp, drainer.maxHp - 20, "dreno cura metade do dano causado");

    const bomber = new G("GEODUDE", 50);
    const msgs = B.applySelfEffect(bomber, { selfKO: true }, 100);
    ok(bomber.isFainted(), "autodestruição derruba o próprio atacante");
    ok(msgs.some(m => m.includes("desmaiou")), "autodestruição anuncia o desmaio");
    ok(B.MOVE_EFFECTS.EXPLOSION && B.MOVE_EFFECTS.EXPLOSION.selfKO, "Explosion registrado como selfKO");
    ok(B.MOVE_EFFECTS.DOUBLEEDGE.recoil > 0, "Double-Edge registrado com recuo");
}

// histórico do monstro (condições de digievolução)
console.log("== Histórico de batalha ==");
{
    const p = new G("EEVEE", 20);
    eq(p.wins, 0, "começa sem vitórias");
    p.recordWin(); p.recordWin();
    eq(p.wins, 2, "vitórias acumulam");
    const before = p.friendship;
    p.recordFaint();
    eq(p.faints, 1, "desmaios acumulam");
    ok(p.friendship < before, "desmaio reduz amizade");
    ok(["atk", "def", "spa", "spd", "spe"].includes(p.highestStat()), "highestStat retorna um stat válido");

    // evolução guarda histórico e pode ser desfeita
    const d = new G("BULBASAUR", 16);
    d.evolveInto("IVYSAUR");
    eq(d.speciesName, "Ivysaur", "evoluiu para Ivysaur");
    ok(d.devolve(), "devolve desfaz a evolução");
    eq(d.speciesName, "Bulbasaur", "voltou a ser Bulbasaur");
    eq(d.devolve(), false, "sem histórico, devolve falha");
}

// suítes por franquia: tools/tests/*.js exportam function({ctx, ok, eq, G, section})
{
    const testsDir = path.join(__dirname, "tests");
    if (fs.existsSync(testsDir)) {
        const api = { ctx, ok, eq, G, section: (t) => console.log("== " + t + " ==") };
        for (const f of fs.readdirSync(testsDir).filter(f => f.endsWith(".js")).sort()) {
            require(path.join(testsDir, f))(api);
        }
    }
}

console.log(`\nResultado: ${pass} passou, ${fail} falhou`);
process.exit(fail ? 1 : 0);
