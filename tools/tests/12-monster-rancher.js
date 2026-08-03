// Suíte Monster Rancher: Santuário de Discos (geração determinística) e treino.
const fs = require("fs");
const path = require("path");

module.exports = function({ ctx, ok, eq, G, section }) {
    section("Monster Rancher — Santuário de Discos (MRA)");

    // headless não roda Scene_Boot: o banco de discos entra na mão
    ctx.$dataDiscs = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../data/Discs.json"), "utf8"));

    const S = ctx.MON.Sanctuary;
    const STAT_KEYS = ["hp", "atk", "def", "spe", "spa", "spd"];
    const newParty = () => {
        const gp = new ctx.Game_Party();
        gp.initialize();
        ctx.$gameParty = gp;
        return gp;
    };
    const bornWith = (discId, seed) => {
        newParty().monGainItem(discId, 1);
        return S.generate(discId, seed);
    };
    // o monstro inteiro: campos internos + stats derivados
    const snapshot = (p) => JSON.stringify({ state: p, stats: STAT_KEYS.map(k => p.stat(k)) });

    // --- espécies -----------------------------------------------------------
    const suezo = ctx.MON.Core.speciesByInternal("SUEZO");
    const tiger = ctx.MON.Core.speciesByInternal("TIGER");
    ok(!!suezo && suezo.type1 === "PSYCHIC", "Suezo é Psychic");
    ok(!!tiger && tiger.type1 === "ELECTRIC" && tiger.type2 === "ICE", "Tiger é Electric/Ice");
    eq(ctx.MON.Core.speciesByInternal("GOLEM_MRA").type1, "ROCK", "Golem da fazenda é Rock");
    ok(ctx.MON.Franchise.speciesOf("MRA").every(sp => (sp.evolutions || []).length === 0),
        "nenhuma espécie MRA evolui por nível (progressão é treino)");

    // --- hash ---------------------------------------------------------------
    eq(S.hash("Bad Religion"), S.hash("Bad Religion"), "hash é determinístico");
    ok(S.hash("Bad Religion") !== S.hash("Bad Reliqion"), "seeds diferentes geram hashes diferentes");

    // --- sorteio determinístico --------------------------------------------
    const first = S.preview("DISCCOMMON", "Bad Religion");
    const again = S.preview("DISCCOMMON", "Bad Religion");
    eq(again.species, first.species, "mesma seed gera a mesma espécie");
    eq(again.level, first.level, "mesma seed gera o mesmo nível");

    const seeds = [];
    for (let i = 0; i < 40; i++) seeds.push("DISCO-" + i);
    const drawn = seeds.map(s => S.preview("DISCCOMMON", s));
    ok(new Set(drawn.map(r => r.species)).size >= 2, "seeds diferentes conseguem divergir de espécie");

    const commonPool = ctx.$dataDiscs.DISCCOMMON.pool;
    ok(drawn.every(r => {
        const entry = commonPool.find(e => e.species === r.species);
        return !!entry && r.level >= entry.levelRange[0] && r.level <= entry.levelRange[1];
    }), "sorteio respeita o pool e o levelRange do disco");

    ok(seeds.every(s => ["DRAGON", "JOKER"].includes(S.preview("DISCLEGEND", s).species)),
        "disco lendário só entrega espécies do próprio pool");
    eq(S.preview("DISCFAKE", "x"), null, "disco desconhecido não sorteia nada");

    // --- geração ------------------------------------------------------------
    const empty = newParty();
    const denied = S.generate("DISCCOMMON", "Bad Religion");
    ok(!denied.ok && denied.monster === null, "sem o disco na mochila a geração falha limpa");
    eq(empty.monCount(), 0, "geração negada não adiciona monstro");

    const gp = newParty();
    gp.monGainItem("DISCCOMMON", 1);
    const born = S.generate("DISCCOMMON", "Bad Religion");
    ok(born.ok && !!born.monster, "com o disco na mochila o monstro nasce");
    eq(gp.monItemCount("DISCCOMMON"), 0, "o disco é consumido na geração");
    eq(gp.monCount(), 1, "o monstro gerado entra na equipe");
    eq(born.monster.species().internalName, first.species, "o monstro gerado é o previsto pelo preview");
    eq(born.monster.level, first.level, "o nível gerado é o previsto pelo preview");
    eq(ctx.MON.Franchise.of(born.monster).id, "MRA", "o monstro gerado pertence a Monster Rancher");
    eq(born.seed, "Bad Religion", "o resultado devolve a seed que foi usada");

    // --- o monstro INTEIRO sai da seed --------------------------------------
    const runs = [];
    for (let i = 0; i < 5; i++) runs.push(snapshot(bornWith("DISCLEGEND", "Bad Religion").monster));
    eq(new Set(runs).size, 1, "5 gerações com a mesma seed dão monstros idênticos (natureza, gênero, shiny, habilidade, IVs, stats)");

    const traits = S.traits("DISCLEGEND", "Bad Religion");
    const legend = bornWith("DISCLEGEND", "Bad Religion").monster;
    ok(legend._nature === traits.nature && legend.gender === traits.gender
        && legend.shiny === traits.shiny && legend._ability === traits.ability
        && STAT_KEYS.every(k => legend._ivs[k] === traits.ivs[k]),
        "traits() descreve exatamente o monstro que a geração entrega");
    ok(STAT_KEYS.every(k => Number.isInteger(traits.ivs[k]) && traits.ivs[k] >= 0 && traits.ivs[k] <= 31),
        "os 6 IVs derivados ficam em 0..31");
    eq(legend.hp, legend.maxHp, "o monstro nasce com o HP cheio dos IVs derivados");
    ok(legend._ability !== null && legend.species().abilities.includes(legend._ability),
        "a habilidade derivada pertence à espécie");

    const natures = new Set(), ivSets = new Set();
    for (let i = 0; i < 40; i++) {
        const t = S.traits("DISCLEGEND", "SEED-" + i);
        natures.add(t.nature);
        ivSets.add(JSON.stringify(t.ivs));
    }
    ok(natures.size >= 10, `seeds diferentes espalham a natureza (${natures.size}/40)`);
    eq(ivSets.size, 40, "seeds diferentes dão conjuntos de IV diferentes");

    let shinies = 0;
    const SHINY_SAMPLE = 20000;
    for (let i = 0; i < SHINY_SAMPLE; i++) if (S.traits("DISCCOMMON", "SHINY-" + i).shiny) shinies++;
    ok(shinies > 0 && shinies < SHINY_SAMPLE / 1000, `shiny continua raro e possível (${shinies}/${SHINY_SAMPLE})`);

    // gênero e habilidade também saem da seed (espécie MRA é sem gênero, use uma com taxa)
    const pidgey = ctx.MON.Core.speciesByInternal("PIDGEY");
    const genders = new Set(), abilities = new Set();
    for (let i = 0; i < 60; i++) {
        const t = S.traitsFor(pidgey, "GEN-" + i);
        genders.add(t.gender);
        abilities.add(t.ability);
    }
    ok(genders.size === 2 && !genders.has("N"), "gênero sai da seed respeitando a taxa da espécie");
    ok(abilities.size === 2 && [...abilities].every(a => pidgey.abilities.includes(a)),
        "habilidade sai da seed dentro da lista da espécie");
    eq(S.traitsFor(pidgey, "GEN-1").gender, S.traitsFor(pidgey, "GEN-1").gender, "mesma seed, mesmo gênero");
    eq(traits.gender, "N", "espécie sem gênero continua sem gênero");
    eq(S.traits("DISCFAKE", "x"), null, "disco desconhecido não tem traits");
    eq(S.traitsFor(null, "x"), null, "sem espécie não há traits");

    // --- origem da seed (comando do MZ não expande \V[n] sozinho) -----------
    ctx.$gameVariables = {
        _data: {},
        value(id) { return this._data[id] || 0; },
        setValue(id, v) { this._data[id] = v; }
    };
    ctx.$gameActors = { _list: {}, actor(id) { return this._list[id] || null; } };
    ctx.$gameVariables.setValue(7, "Suezo do Norte");
    ctx.$gameActors._list[3] = { name: () => "Holly" };

    eq(S.expandSeed("disco \\V[7]"), "disco Suezo do Norte", "\\V[n] é expandido no texto da seed");
    eq(S.expandSeed("\\N[3]"), "Holly", "\\N[n] traz o nome digitado pelo jogador");
    eq(S.resolveSeed("DISCCOMMON", { mode: "text", text: "\\V[7]" }), "Suezo do Norte", "modo texto expande a variável");
    eq(S.resolveSeed("DISCCOMMON", { mode: "variable", variableId: 7 }), "Suezo do Norte", "modo variável usa o conteúdo da variável");
    eq(S.resolveSeed("DISCCOMMON", { mode: "actorName", actorId: 3 }), "Holly", "modo nome de ator usa o nome digitado");
    eq(S.resolveSeed("DISCCOMMON", { mode: "vira-lata", text: "Tiger" }), "Tiger", "modo desconhecido cai no texto");

    const player = S.resolveSeed("DISCCOMMON", { mode: "variable", variableId: 7 });
    eq(S.preview("DISCCOMMON", player).species, S.preview("DISCCOMMON", "Suezo do Norte").species,
        "seed vinda da variável mantém 'mesma seed = mesmo monstro'");
    ok(S.preview("DISCCOMMON", player).species !== undefined
        && new Set(["Ana", "Beto", "Caio", "Dani", "Edu", "Fabi", "Gui", "Hana", "Igor", "Jana"]
            .map(n => S.preview("DISCCOMMON", n).species)).size >= 2,
        "nomes digitados por jogadores diferentes divergem de espécie");

    // --- seed automática: varia no save e resiste a save-scumming -----------
    ctx.$gameSystem = new ctx.Game_System();
    eq(S.useCount("DISCCOMMON"), 0, "save novo começa sem discos usados");
    eq(S.resolveSeed("DISCCOMMON", { mode: "auto" }), S.autoSeed("DISCCOMMON"), "modo automático usa a seed do save");
    eq(S.resolveSeed("DISCCOMMON", { mode: "text", text: "   " }), S.autoSeed("DISCCOMMON"), "seed vazia cai no modo automático");
    ok(S.autoSeed("DISCCOMMON") !== S.autoSeed("DISCRARE"), "cada disco tem sua própria seed automática");

    const autoSeeds = [], autoSpecies = [];
    for (let i = 0; i < 8; i++) {
        newParty().monGainItem("DISCCOMMON", 1);
        const seed = S.resolveSeed("DISCCOMMON", { mode: "auto" });
        autoSeeds.push(seed);
        autoSpecies.push(S.generate("DISCCOMMON", seed).monster.species().internalName);
    }
    eq(new Set(autoSeeds).size, 8, "cada geração automática usa uma seed nova");
    ok(new Set(autoSpecies).size >= 3,
        `seed automática não colapsa o pool do disco (${new Set(autoSpecies).size} espécies em 8 usos)`);
    eq(S.useCount("DISCCOMMON"), 8, "cada disco lido soma no contador do save");
    eq(S.totalUses(), 8, "totalUses acompanha o contador de discos");

    const savedUses = JSON.parse(JSON.stringify(ctx.$gameSystem.monDiscUses));
    const beforeReload = S.resolveSeed("DISCCOMMON", { mode: "auto" });
    ctx.$gameSystem = new ctx.Game_System();
    ctx.$gameSystem.monDiscUses = savedUses;
    eq(S.resolveSeed("DISCCOMMON", { mode: "auto" }), beforeReload,
        "recarregar o save devolve a mesma seed automática (sem save-scumming de IV)");

    newParty();
    const usesBefore = S.useCount("DISCCOMMON");
    S.generate("DISCCOMMON", "sem disco na mochila");
    eq(S.useCount("DISCCOMMON"), usesBefore, "geração negada não mexe no contador de discos");

    // --- treino de fazenda (EVs) -------------------------------------------
    const trainee = new G("SUEZO", 40);
    const atkBefore = trainee.stat("atk");
    const gain = S.train(trainee, "atk", 40);
    ok(gain.ok && gain.gained === 40, "treino aplica o ganho pedido de EV");
    ok(trainee.stat("atk") > atkBefore, "o treino aumenta o stat de verdade");
    eq(S.train(trainee, "cool", 10).ok, false, "stat inexistente não treina");

    const capped = new G("HARE", 40);
    S.train(capped, "atk", 300);
    eq(S.evOf(capped, "atk"), 252, "EV de um stat satura em 252");
    eq(S.train(capped, "atk", 10).gained, 0, "stat no teto não ganha mais EV");

    S.train(capped, "def", 252);
    const left = S.train(capped, "spe", 50);
    eq(left.gained, 6, "o teto total de 510 limita o último treino");
    eq(S.evTotal(capped), 510, "EVs totais saturam em 510");
    eq(S.train(capped, "spa", 10).ok, false, "no teto total nenhum treino rende");
};
