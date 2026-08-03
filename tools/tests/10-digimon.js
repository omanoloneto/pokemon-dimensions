// Suíte da Dimensão Digital: elenco de Digimon Adventure (1ª temporada),
// digievolução ramificada com condição e Digimemória.
module.exports = function({ ctx, ok, eq, G, section }) {
    section("Digimon — elenco Adventure e digievolução ramificada");

    const E = ctx.MON.Evolution;
    const F = ctx.MON.Franchise;
    const roster = F.speciesOf("DGM");
    const byName = new Map(roster.map(sp => [sp.internalName, sp]));
    const STAGES = ["Baby I", "Baby II", "Rookie", "Champion", "Ultimate", "Mega"];
    const PARTNER_ROOTS = ["BOTAMON", "PUNIMON", "NYOKIMON", "PABUMON",
                           "YURAMON", "PICHIMON", "POYOMON", "YUKIMIBOTAMON"];
    const MEGA_GATE = "DIGILINKOMEGA";

    function withBag(items, fn) {
        const previous = ctx.$gameParty;
        ctx.$gameParty = { monHasItem: (name) => items.includes(name) };
        try { return fn(); } finally { ctx.$gameParty = previous; }
    }
    // percorre a árvore inteira a partir de um Baby I
    function tree(rootName) {
        const seen = new Set();
        const walk = (name) => {
            if (!name || seen.has(name)) return;
            seen.add(name);
            for (const ev of (byName.get(name) || {}).evolutions || []) walk(ev.into);
        };
        walk(rootName);
        return [...seen].map(n => byName.get(n)).filter(Boolean);
    }

    //--- integridade do elenco ----------------------------------------------
    {
        const validTypes = new Set(Object.keys(ctx.$dataTypes.chart));
        eq(roster.length, 101, "elenco da 1ª temporada cadastrado");
        ok(!byName.has("AGUMON") || byName.get("AGUMON").id === 652, "Agumon está na faixa DGM (650-799)");
        eq(F.idOf(new G("AGUMON", 20)), "DGM", "Agumon pertence à franquia DGM");

        ok(roster.every(sp => validTypes.has(sp.type1) && (!sp.type2 || validTypes.has(sp.type2))),
            "todos os tipos existem em Types.json (banco Gen 5, sem FAIRY)");
        ok(roster.every(sp => ["Vaccine", "Data", "Virus"].includes(sp.attribute)),
            "toda espécie declara Vaccine/Data/Virus");
        ok(roster.every(sp => sp.genderRate === "Genderless"), "todo Digimon é Genderless (canônico)");
        ok(roster.every(sp => sp.entry && sp.entry.length > 20), "toda espécie tem texto de Pokédex");
    }

    // chefes e secundários obrigatórios da temporada
    {
        const required = [
            "DEVIMON", "ETEMON", "METALETEMON", "MYOTISMON", "VENOMMYOTISMON",
            "METALSEADRAMON", "PUPPETMON", "MACHINEDRAMON", "PIEDMON", "APOCALYMON",
            "KUWAGAMON", "SHELLMON", "MERAMON", "ANDROMON", "LEOMON", "OGREMON",
            "CENTARUMON", "UNIMON", "BAKEMON", "DEMIDEVIMON", "NUMEMON", "MONZAEMON",
            "ELECMON", "FRIGIMON", "MOJYAMON", "WHAMON", "PIXIMON", "GEKOMON",
            "OTAMAMON", "DRIMOGEMON", "TYRANNOMON"
        ];
        const missing = required.filter(n => !byName.has(n));
        eq(missing.join(",") || "-", "-", "chefes e secundários da temporada cadastrados");
    }

    //--- as 8 linhas dos parceiros, completas --------------------------------
    {
        const incomplete = PARTNER_ROOTS.filter(root => {
            const stages = new Set(tree(root).map(sp => sp.stage));
            return !STAGES.every(s => stages.has(s));
        });
        eq(incomplete.join(",") || "-", "-", "as 8 linhas de parceiro vão de Baby I até Mega");

        // Gatomon é irregular de propósito: Baby II é Nyaromon, não há Rookie de luz antes de Salamon
        const gatomon = tree("YUKIMIBOTAMON").map(sp => sp.internalName);
        ok(["NYAROMON", "SALAMON", "GATOMON", "ANGEWOMON"].every(n => gatomon.includes(n)),
            "linha da Gatomon segue o canon Nyaromon/Salamon/Gatomon/Angewomon");
    }

    //--- curva de nível por estágio (docs/03: D2 = níveis 14-28) -------------
    {
        const window = { "Baby II": [1, 10], "Rookie": [12, 16], "Champion": [20, 22],
                         "Ultimate": [28, 32], "Mega": [40, 60] };
        const outOfRange = [];
        for (const sp of roster) {
            for (const ev of sp.evolutions || []) {
                const target = byName.get(ev.into);
                const range = target && window[target.stage];
                if (!range) continue;
                const level = Number(ev.param);
                if (level < range[0] || level > range[1]) {
                    outOfRange.push(`${sp.internalName}->${ev.into}@${level}`);
                }
            }
        }
        eq(outOfRange.join(",") || "-", "-", "cada estágio é alcançado na faixa de nível do documento");

        const megaGated = tree("BOTAMON").concat(tree("POYOMON"))
            .flatMap(sp => sp.evolutions || [])
            .filter(ev => (byName.get(ev.into) || {}).stage === "Mega");
        ok(megaGated.length > 0 && megaGated.every(ev => ev.condition && ev.condition.hasItem === MEGA_GATE),
            "Mega de parceiro exige o Digi-Link Ω: só alcançável no fim do jogo");
    }

    //--- regras de escopo do design (doc 02) --------------------------------
    {
        const tooManyBranches = roster.filter(sp => (sp.evolutions || []).length > 2);
        eq(tooManyBranches.map(sp => sp.internalName).join(",") || "-", "-",
            "no máximo 2 ramos por estágio");

        // highestStat depende do sorteio de IV/natureza, não da escolha do jogador
        const uncontrollable = roster.filter(sp =>
            (sp.evolutions || []).some(ev => ev.condition && ev.condition.highestStat));
        eq(uncontrollable.map(sp => sp.internalName).join(",") || "-", "-",
            "nenhum ramo usa highestStat: só condições que o jogador controla");

        const stageRank = Object.fromEntries(STAGES.map((s, i) => [s, i]));
        const catchByStage = {};
        for (const sp of roster) {
            if (!(sp.stage in stageRank)) continue;
            (catchByStage[sp.stage] = catchByStage[sp.stage] || []).push(sp.catchRate);
        }
        const ceiling = STAGES.map(s => Math.max(...(catchByStage[s] || [0])));
        ok(ceiling.every((v, i) => i === 0 || v <= ceiling[i - 1]), "catchRate cai a cada estágio");
        ok(roster.filter(sp => sp.stage === "Mega").every(sp => sp.catchRate <= 8), "Mega tem catchRate de chefe");
    }

    //--- atributo Vaccine/Data/Virus é só flavor de Pokédex ------------------
    {
        // forceCrit fixo: o crítico aleatório de 1/24 tornaria a comparação instável
        const opts = { fixedRand: 1, forceCrit: true };
        const attacker = new G("GREYMON", 28);
        const target = new G("TYRANNOMON", 28);
        const before = ctx.MON.Battle.calcDamage(attacker, target, "NOVABLAST", opts).damage;
        const species = attacker.species();
        const saved = species.attribute;
        species.attribute = "Virus";
        const after = ctx.MON.Battle.calcDamage(attacker, target, "NOVABLAST", opts).damage;
        species.attribute = saved;
        eq(after, before, "atributo não altera o dano (flavor puro)");
    }

    //--- ramo A vs ramo B: faintsBelow --------------------------------------
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
        const neglected = new G("GREYMON", 30);
        neglected.recordFaint(); neglected.recordFaint(); neglected.recordFaint();
        eq(neglected.evolutionByLevel(), "SKULLGREYMON",
            "amizade baixa: a 1ª entrada vence mesmo com a 2ª também válida");

        const loyal = new G("GREYMON", 30);
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

        const loyalBat = new G("DEMIDEVIMON", 22);
        for (let i = 0; i < 12; i++) loyalBat.recordWin();
        eq(loyalBat.evolutionByLevel(), "DEVIMON", "DemiDevimon veterano vira Devimon");
        eq(new G("DEMIDEVIMON", 22).evolutionByLevel(), "BAKEMON", "DemiDevimon comum vira Bakemon");
    }

    // friendshipAbove: amizade começa em 70 e sobe 1 por vitória
    {
        const hopeful = new G("PATAMON", 22);
        for (let i = 0; i < 15; i++) hopeful.recordWin();
        eq(hopeful.evolutionByLevel(), "ANGEMON", "Patamon com vínculo alto vira Angemon");
        eq(new G("PATAMON", 22).evolutionByLevel(), "UNIMON", "Patamon sem vínculo vira Unimon");

        const light = new G("SALAMON", 20);
        for (let i = 0; i < 15; i++) light.recordWin();
        eq(light.evolutionByLevel(), "GATOMON", "Salamon com vínculo alto vira Gatomon");
        eq(new G("SALAMON", 20).evolutionByLevel(), "BLACKGATOMON", "Salamon sem vínculo vira BlackGatomon");
    }

    // hasItem: lê a mochila da party
    {
        const cyborg = new G("METALGREYMON", 42);
        eq(cyborg.evolutionByLevel(), null, "sem o Digi-Link Ω a Mega fica travada");
        eq(withBag([MEGA_GATE], () => cyborg.evolutionByLevel()), "WARGREYMON",
            "com o Digi-Link Ω na mochila MetalGreymon vira WarGreymon");

        const wolf = new G("WEREGARURUMON", 42);
        eq(withBag([MEGA_GATE], () => wolf.evolutionByLevel()), "METALGARURUMON",
            "WereGarurumon com o Digi-Link Ω vira MetalGarurumon");
        eq(withBag(["POTION"], () => wolf.evolutionByLevel()), null, "outro item não serve de gatilho");
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
        eq(E.checkCondition(p, { hasItem: MEGA_GATE }), false, "hasItem sem party retorna falso");
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

        const monster = new G("BULBASAUR", 16);
        monster.evolveInto("IVYSAUR");
        eq(E.useDigimemory(monster).ok, false, "Digimemória não funciona fora da Dimensão Digital");
        eq(E.useDigimemory(null).ok, false, "Digimemória sem alvo falha");
    }
};
