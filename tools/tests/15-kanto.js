// Suíte da Dimensão 1: dex regional de Kanto e tabelas de encontro religadas.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "../..");
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));

const DEX_ID = "KANTO";
const TOTAL = 151;
const D1_LEVELS = { min: 3, max: 14 };
const D1_MAP_IDS = { from: 2, to: 19 };
const LAND_SLOTS = 12; // PKM_Encounters.LAND_WEIGHTS
const METHODS = ["wild", "evolution", "starter", "gift", "unavailable"];
const REASONS = ["legendary", "trade", "fossil", "postgame"];

// o harness carrega uma lista fixa de plugins; PKM_Dex e a dex regional entram aqui
function bootDex(ctx) {
    if (ctx.PKM.Dex) return;
    ctx.$dataDexKanto = readJson("data/dex/KANTO.json");
    vm.runInContext(fs.readFileSync(path.join(ROOT, "js/plugins/PKM_Dex.js"), "utf8"),
        ctx, { filename: "PKM_Dex.js" });
    ctx.PKM.Dex.install();
}

module.exports = function({ ctx, ok, eq, G, section }) {
    section("Kanto — dex regional da D1 e encontros");

    bootDex(ctx);
    const D = ctx.PKM.Dex;
    const dex = D.get(DEX_ID);
    const species = D.species(DEX_ID);

    //--- recorte -------------------------------------------------------------
    ok(!!dex && dex.franchise === "PKM" && dex.dimension === "D1",
        "KANTO é a dex da franquia PKM na dimensão D1");
    eq(species.length, TOTAL, "a dex tem 151 espécies");
    ok(species.every((id, i) => id === i + 1), "ordem regional é 1..151, crescente e sem buracos");
    ok(species.every(id => !!ctx.PKM.Core.species(id)), "toda espécie da dex existe em $dataPokemon");
    ok(species.every(id => ctx.PKM.Franchise.ofSpecies(id).id === "PKM"),
        "toda espécie da dex está na faixa da franquia PKM");
    eq(D.franchise(DEX_ID).id, "PKM", "franchise() reusa o registro de PKM_Franchise");
    ok(D.ofFranchise("PKM").some(d => d.id === DEX_ID), "ofFranchise('PKM') acha a dex de Kanto");

    //--- número regional -----------------------------------------------------
    ok(species.every(id => D.regionalNumber(DEX_ID, id) === id),
        "número regional bate com a posição na lista");
    eq(D.regionalNumber(DEX_ID, 25), 25, "Pikachu é o nº 25 de Kanto");
    eq(D.regionalNumber(DEX_ID, 152), 0, "espécie fora da dex tem número regional 0");
    eq(D.regionalNumber("NAOEXISTE", 1), 0, "dex inexistente tem número regional 0");
    ok(D.contains(DEX_ID, 151) && !D.contains(DEX_ID, 152) && !D.contains(DEX_ID, 650),
        "contains() aceita só as 151 (Digimon fica de fora)");
    eq(D.get("NAOEXISTE"), null, "get() de dex inexistente retorna null");

    //--- formas de obtenção --------------------------------------------------
    const obt = (id) => D.obtainable(DEX_ID, id);
    ok(species.every(id => obt(id) && METHODS.includes(obt(id).method)),
        "toda espécie tem um método de obtenção do vocabulário");
    eq(D.obtainable(DEX_ID, 152), null, "espécie fora da dex não tem entrada de obtenção");

    const starters = species.filter(id => obt(id).method === "starter");
    ok(starters.length === 3 && starters.join(",") === "1,4,7",
        "os iniciais são Bulbasaur, Charmander e Squirtle");

    ok(species.filter(id => obt(id).method === "unavailable")
        .every(id => REASONS.includes(obt(id).reason)),
        "toda espécie indisponível declara um motivo conhecido");
    ok([144, 145, 146, 150, 151].every(id => obt(id).reason === "legendary"),
        "os cinco lendários de Kanto ficam para o pós-game");
    ok([65, 68, 76, 94].every(id => obt(id).reason === "trade"),
        "as evoluções por troca ficam de fora (não há sistema de troca)");

    ok(species.filter(id => obt(id).method === "gift").every(id => !!obt(id).note),
        "todo presente de NPC documenta onde é entregue");

    // consistência da corrente: evolução aponta para uma pré-evolução obtível e real
    const byInternal = new Map(species.map(id => [ctx.PKM.Core.species(id).internalName, id]));
    const evolutions = species.filter(id => obt(id).method === "evolution");
    ok(evolutions.length > 0 && evolutions.every(id => byInternal.has(obt(id).from)),
        "toda evolução aponta para uma pré-evolução dentro da dex");
    ok(evolutions.every(id => obt(byInternal.get(obt(id).from)).method !== "unavailable"),
        "nenhuma evolução depende de uma linha bloqueada");
    ok(evolutions.every(id => {
        const pre = ctx.PKM.Core.species(byInternal.get(obt(id).from));
        const into = ctx.PKM.Core.species(id).internalName;
        return (pre.evolutions || []).some(ev => ev.into === into);
    }), "o 'from' declarado confere com as evoluções de $dataPokemon");

    //--- encontros -----------------------------------------------------------
    const enc = ctx.$dataEncounters;
    const mapIds = Object.keys(enc).filter(k => !k.startsWith("_"));
    ok(mapIds.length > 0 && mapIds.every(k => /^\d+$/.test(k)),
        "as tabelas são chaveadas por mapId numérico");
    ok(mapIds.every(k => Number(k) >= D1_MAP_IDS.from && Number(k) <= D1_MAP_IDS.to),
        "todo mapId está na faixa reservada à D1 (2-19)");
    ok(!!enc._meta && !!enc._meta.mapIdRanges, "a convenção de mapId está documentada em _meta");
    ok(fs.existsSync(path.join(ROOT, "data/Map002.json")) && !!enc["2"],
        "Map002 (Coral Town) existe e tem tabela");

    const slots = [];
    for (const k of mapIds) {
        const table = enc[k].methods && enc[k].methods.Land;
        if (table) for (const s of table) slots.push(s);
    }
    ok(mapIds.every(k => (enc[k].methods.Land || []).length === LAND_SLOTS),
        "toda tabela Land tem os 12 slots ponderados que PKM_Encounters espera");
    ok(mapIds.every(k => Array.isArray(enc[k].densities) && enc[k].densities[0] > 0),
        "toda tabela declara densidade terrestre positiva");

    const found = slots.map(s => ctx.PKM.Core.speciesByInternal(s.species));
    ok(found.every(Boolean), "toda espécie citada nos encontros existe em $dataPokemon");
    ok(found.every(sp => sp && D.contains(DEX_ID, sp.id)),
        "toda espécie dos encontros está na dex de Kanto");
    ok(found.every(sp => sp && obt(sp.id).method === "wild"),
        "toda espécie dos encontros está marcada como selvagem na dex");
    ok(slots.every(s => s.min >= D1_LEVELS.min && s.max <= D1_LEVELS.max && s.min <= s.max),
        "todo slot respeita a faixa de nível da D1 (3-14)");

    // jogável de verdade: o slot vira o monstro CERTO. Game_Pokemon._resolveSpecies
    // faz toUpperCase, então internalName com minúscula cai no Bulbasaur em silêncio.
    ok(slots.every((s, i) => {
        const p = new G(s.species, s.min);
        return p.speciesName === found[i].name && p.level === s.min
            && p.maxHp > 0 && p.moves.length > 0;
    }), "todo slot instancia exatamente o monstro declarado, no nível mínimo");

    const coral = enc["2"].methods.Land;
    ok(coral[0].min === D1_LEVELS.min && coral.every(s => s.max <= 5),
        "Coral Town abre no nível 3 e não passa do 5");

    //--- progresso -----------------------------------------------------------
    ctx.$gameSystem = new ctx.Game_System();
    const zero = D.progress(DEX_ID);
    ok(zero.seen === 0 && zero.caught === 0 && zero.total === TOTAL,
        "save limpo: 0 vistos, 0 capturados, 151 no total");

    ctx.$gameSystem.pkmSetSeen(16);
    ctx.$gameSystem.pkmSetSeen(19);
    ctx.$gameSystem.pkmSetCaught(25);
    const partial = D.progress(DEX_ID);
    ok(partial.seen === 3 && partial.caught === 1,
        "capturado conta como visto uma única vez (3 vistos, 1 capturado)");

    ctx.$gameSystem.pkmSetCaught(650); // Digimon: fora da dex regional
    const after = D.progress(DEX_ID);
    ok(after.seen === 3 && after.caught === 1,
        "espécie de outra franquia não entra no progresso de Kanto");

    const none = D.progress("NAOEXISTE");
    ok(none.seen === 0 && none.caught === 0 && none.total === 0,
        "progresso de dex inexistente é zerado");
};
