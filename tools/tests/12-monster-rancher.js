// Suíte Monster Rancher: Santuário de Discos (geração determinística) e treino.
const fs = require("fs");
const path = require("path");

module.exports = function({ ctx, ok, eq, G, section }) {
    section("Monster Rancher — Santuário de Discos (MRA)");

    // headless não roda Scene_Boot: o banco de discos entra na mão
    ctx.$dataDiscs = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../data/Discs.json"), "utf8"));

    const S = ctx.PKM.Sanctuary;
    const newParty = () => {
        const gp = new ctx.Game_Party();
        gp.initialize();
        ctx.$gameParty = gp;
        return gp;
    };

    // --- espécies -----------------------------------------------------------
    const suezo = ctx.PKM.Core.speciesByInternal("SUEZO");
    const tiger = ctx.PKM.Core.speciesByInternal("TIGER");
    ok(!!suezo && suezo.type1 === "PSYCHIC", "Suezo é Psychic");
    ok(!!tiger && tiger.type1 === "ELECTRIC" && tiger.type2 === "ICE", "Tiger é Electric/Ice");
    eq(ctx.PKM.Core.speciesByInternal("GOLEM_MRA").type1, "ROCK", "Golem da fazenda é Rock");
    ok(ctx.PKM.Franchise.speciesOf("MRA").every(sp => (sp.evolutions || []).length === 0),
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
    ok(!denied.ok && denied.pokemon === null, "sem o disco na mochila a geração falha limpa");
    eq(empty.pkmCount(), 0, "geração negada não adiciona monstro");

    const gp = newParty();
    gp.pkmGainItem("DISCCOMMON", 1);
    const born = S.generate("DISCCOMMON", "Bad Religion");
    ok(born.ok && !!born.pokemon, "com o disco na mochila o monstro nasce");
    eq(gp.pkmItemCount("DISCCOMMON"), 0, "o disco é consumido na geração");
    eq(gp.pkmCount(), 1, "o monstro gerado entra na equipe");
    eq(born.pokemon.species().internalName, first.species, "o monstro gerado é o previsto pelo preview");
    eq(born.pokemon.level, first.level, "o nível gerado é o previsto pelo preview");
    eq(ctx.PKM.Franchise.of(born.pokemon).id, "MRA", "o monstro gerado pertence a Monster Rancher");

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
