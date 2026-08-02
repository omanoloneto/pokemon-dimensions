// Suíte da Dimensão Digital: digievolução ramificada com condição + Digimemória.
module.exports = function({ ctx, ok, eq, G, section }) {
    section("Digimon — digievolução ramificada");

    const E = ctx.PKM.Evolution;
    const STAT_KEYS = ["hp", "atk", "def", "spe", "spa", "spd"];
    const NEUTRAL_NATURE = 12;

    // zera a variação aleatória do construtor: stats viram função só da espécie
    function neutral(pkm) {
        pkm._nature = NEUTRAL_NATURE;
        for (const k of STAT_KEYS) { pkm._ivs[k] = 0; pkm._evs[k] = 0; }
        return pkm;
    }
    function withBag(items, fn) {
        const previous = ctx.$gameParty;
        ctx.$gameParty = { pkmHasItem: (name) => items.includes(name) };
        try { return fn(); } finally { ctx.$gameParty = previous; }
    }

    //--- dados ---------------------------------------------------------------
    const agumonSpecies = ctx.PKM.Core.speciesByInternal("AGUMON");
    ok(agumonSpecies && agumonSpecies.id === 652, "Agumon está na faixa DGM (650-699)");
    eq(ctx.PKM.Franchise.idOf(new G("AGUMON", 20)), "DGM", "Agumon pertence à franquia DGM");

    // atributo Vaccine/Data/Virus é só flavor de Pokédex
    {
        const attacker = neutral(new G("GREYMON", 28));
        const target = neutral(new G("TYRANNOMON", 28));
        const opts = { fixedRand: 1, forceCrit: false };
        const before = ctx.PKM.Battle.calcDamage(attacker, target, "NOVABLAST", opts).damage;
        const species = attacker.species();
        const saved = species.attribute;
        species.attribute = "Virus";
        const after = ctx.PKM.Battle.calcDamage(attacker, target, "NOVABLAST", opts).damage;
        species.attribute = saved;
        eq(after, before, "atributo não altera o dano (flavor puro)");
    }

    //--- ramo A vs ramo B ----------------------------------------------------
    {
        const cared = new G("AGUMON", 20);
        eq(cared.evolutionByLevel(), "GREYMON", "Agumon sem desmaios vira Greymon");

        const battered = new G("AGUMON", 20);
        battered.recordFaint(); battered.recordFaint(); battered.recordFaint();
        eq(battered.evolutionByLevel(), "TYRANNOMON", "Agumon com 3 desmaios vira Tyrannomon");

        const borderline = new G("AGUMON", 20);
        borderline.recordFaint(); borderline.recordFaint();
        eq(borderline.evolutionByLevel(), "GREYMON", "faintsBelow: 3 ainda passa com 2 desmaios");

        const early = new G("AGUMON", 19);
        eq(early.evolutionByLevel(), null, "abaixo do nível não evolui por nenhum ramo");
    }

    // empate no mesmo nível: vence a PRIMEIRA da lista que satisfaz
    {
        const neglected = new G("GREYMON", 28);
        neglected.recordFaint(); neglected.recordFaint(); neglected.recordFaint();
        eq(neglected.evolutionByLevel(), "SKULLGREYMON",
            "amizade baixa: a 1ª entrada vence mesmo com a 2ª também válida");

        const loyal = new G("GREYMON", 28);
        eq(loyal.evolutionByLevel(), "METALGREYMON", "sem condição satisfeita cai na entrada sem condition");
    }

    // winsAtLeast
    {
        const veteran = new G("GABUMON", 20);
        for (let i = 0; i < 8; i++) veteran.recordWin();
        eq(veteran.evolutionByLevel(), "GARURUMON", "Gabumon com 8 vitórias vira Garurumon");

        const rookie = new G("GABUMON", 20);
        for (let i = 0; i < 7; i++) rookie.recordWin();
        eq(rookie.evolutionByLevel(), "GURURUMON", "Gabumon com 7 vitórias cai no ramo Virus");
    }

    // hasItem: lê a mochila da party
    {
        const wolf = new G("GARURUMON", 28);
        eq(wolf.evolutionByLevel(), "WEREGARURUMON", "sem o Digi-Link Ω na mochila vira WereGarurumon");
        eq(withBag(["DIGILINKOMEGA"], () => wolf.evolutionByLevel()), "METALGARURUMON",
            "com o Digi-Link Ω na mochila vira MetalGarurumon");
    }

    // highestStat
    {
        const mage = neutral(new G("PATAMON", 22));
        eq(mage.evolutionByLevel(), "ANGEMON", "Patamon com At. Esp. dominante vira Angemon");

        const bruiser = neutral(new G("PATAMON", 22));
        bruiser._evs.atk = 252;
        eq(bruiser.evolutionByLevel(), "UNIMON", "Patamon treinado em Ataque vira Unimon");
    }

    //--- regressão zero para Pokémon (nenhuma entrada tem condition) ---------
    {
        const bulba = new G("BULBASAUR", 15);
        eq(bulba.evolutionByLevel(), null, "Bulbasaur nv15 continua sem evoluir");
        const ready = new G("BULBASAUR", 16);
        eq(ready.evolutionByLevel(), "IVYSAUR", "Bulbasaur nv16 continua virando Ivysaur");

        const combee = new G("COMBEE", 21);
        combee._gender = "F";
        eq(combee.evolutionByLevel(), "VESPIQUEN", "LevelFemale segue funcionando");
        combee._gender = "M";
        eq(combee.evolutionByLevel(), null, "LevelFemale não dispara em macho");
    }

    //--- checkCondition como função pura ------------------------------------
    {
        const p = new G("AGUMON", 20);
        p.recordWin(); p.recordFaint();
        ok(E.checkCondition(p, null), "sem condição = sempre verdadeira");
        ok(E.checkCondition(p, {}), "condição vazia = verdadeira");
        ok(E.checkCondition(p, { faintsAtLeast: 1, winsAtLeast: 1 }), "várias chaves valem como E lógico");
        eq(E.checkCondition(p, { faintsAtLeast: 1, winsAtLeast: 99 }), false, "basta uma chave falhar");
        ok(E.checkCondition(p, { friendshipAbove: 60 }), "friendshipAbove lê a amizade atual");
        eq(E.checkCondition(p, { friendshipBelow: 60 }), false, "friendshipBelow reprova com amizade alta");
        ok(E.checkCondition(p, { gender: "N" }), "Digimon é genderless (N)");
        eq(E.checkCondition(p, { naoExiste: 1 }), false, "chave desconhecida falha fechada");
        eq(E.checkCondition(p, { hasItem: "DIGILINKOMEGA" }), false, "hasItem sem party retorna falso");
        eq(E.checkCondition(null, { winsAtLeast: 0 }), false, "sem monstro nenhuma condição passa");
    }

    //--- Digimemória ---------------------------------------------------------
    {
        const digimon = new G("AGUMON", 20);
        digimon.evolveInto(digimon.evolutionByLevel());
        eq(digimon.speciesName, "Greymon", "Agumon digievoluiu para Greymon");

        const res = E.useDigimemory(digimon);
        ok(res.ok && digimon.speciesName === "Agumon", "Digimemória reverte a digievolução mais recente");

        const again = E.useDigimemory(digimon);
        eq(again.ok, false, "sem histórico, a Digimemória falha");

        const pokemon = new G("BULBASAUR", 16);
        pokemon.evolveInto("IVYSAUR");
        eq(E.useDigimemory(pokemon).ok, false, "Digimemória não funciona fora da Dimensão Digital");
        eq(E.useDigimemory(null).ok, false, "Digimemória sem alvo falha");
    }
};
