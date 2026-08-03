// Suíte dos métodos de evolução destravados (pedra, amizade, golpe, vínculo,
// local) + prova de regressão zero contra o comportamento antigo (só Level*).
module.exports = function({ ctx, ok, eq, G, section }) {
    section("Evolução — métodos completos");

    const E = ctx.MON.Evolution;
    const LEVEL_ONLY = ["Level", "LevelMale", "LevelFemale"];

    // comportamento ANTIGO (core + override do MON_Evolution v0.3) congelado
    // aqui como oráculo da regressão
    function legacyEvolution(pkm) {
        for (const ev of (pkm.species().evolutions || [])) {
            if (Number(ev.param) > pkm.level) continue;
            if (!LEVEL_ONLY.includes(ev.method)) continue;
            if (ev.method === "LevelMale" && pkm.gender !== "M") continue;
            if (ev.method === "LevelFemale" && pkm.gender !== "F") continue;
            if (!E.checkCondition(pkm, ev.condition)) continue;
            return ev.into;
        }
        return null;
    }
    function at(internalName, level, gender) {
        const pkm = new G(internalName, level);
        if (gender) pkm._gender = gender;
        return pkm;
    }
    function withBag(items, fn) {
        const previous = ctx.$gameParty;
        ctx.$gameParty = { monHasItem: (name) => items.includes(name) };
        try { return fn(); } finally { ctx.$gameParty = previous; }
    }
    function withParty(members, items, fn) {
        const previous = ctx.$gameParty;
        ctx.$gameParty = {
            monHasItem: (name) => (items || []).includes(name),
            monParty: () => members
        };
        try { return fn(); } finally { ctx.$gameParty = previous; }
    }
    function onMap(id, fn) {
        const previousMap = ctx.$gameMap;
        ctx.$gameMap = { mapId: () => id };
        try { return fn(); } finally { ctx.$gameMap = previousMap; }
    }
    const happy = (pkm) => { pkm.record().friendship = 255; return pkm; };

    //--- 1. Pedras -----------------------------------------------------------
    {
        eq(E.byItem(at("PIKACHU", 20), "THUNDERSTONE"), "RAICHU", "Pikachu + Thunder Stone = Raichu");
        eq(E.byItem(at("PIKACHU", 20), "FIRESTONE"), null, "Pikachu ignora a pedra errada");
        eq(at("PIKACHU", 100).evolutionByLevel(), null, "Pikachu nunca evolui só por nível");

        // as 7 evoluções do Eevee, uma a uma
        eq(E.byItem(at("EEVEE", 20), "WATERSTONE"), "VAPOREON", "Eevee + Water Stone = Vaporeon");
        eq(E.byItem(at("EEVEE", 20), "THUNDERSTONE"), "JOLTEON", "Eevee + Thunder Stone = Jolteon");
        eq(E.byItem(at("EEVEE", 20), "FIRESTONE"), "FLAREON", "Eevee + Fire Stone = Flareon");
        eq(E.byItem(at("EEVEE", 20), "LEAFSTONE"), null, "Eevee não responde a pedra fora da linha");
        eq(happy(at("EEVEE", 20)).evolutionByLevel(), "ESPEON",
            "Eevee feliz vira Espeon (Day/Night no mesmo critério: vence o 1º da lista)");
        eq(onMap(28, () => {
            E.LOCATION_MAPS["28"] = 28;
            const into = happy(at("EEVEE", 20)).evolutionByLevel();
            delete E.LOCATION_MAPS["28"];
            return into;
        }), "LEAFEON", "no mapa mapeado, Leafeon vence Espeon pela ordem da lista");

        // gênero (Kirlia/Gallade, Gen 4)
        eq(E.byItem(at("KIRLIA", 20, "M"), "DAWNSTONE"), "GALLADE", "Kirlia macho + Dawn Stone = Gallade");
        eq(E.byItem(at("KIRLIA", 20, "F"), "DAWNSTONE"), null, "Kirlia fêmea não vira Gallade");

        // held items viraram uso direto (sem day/night, sem item segurado)
        eq(E.byItem(at("SNEASEL", 30), "RAZORCLAW"), "WEAVILE", "Sneasel + Razor Claw = Weavile");
        eq(E.byItem(at("HAPPINY", 10), "OVALSTONE"), "CHANSEY", "Happiny + Oval Stone = Chansey");
    }

    //--- 2. Amizade ----------------------------------------------------------
    {
        eq(at("GOLBAT", 30).evolutionByLevel(), null, "Golbat com amizade inicial não evolui");
        eq(happy(at("GOLBAT", 30)).evolutionByLevel(), "CROBAT", "Golbat feliz vira Crobat");
        const borderline = at("PICHU", 10);
        borderline.record().friendship = 219;
        eq(borderline.evolutionByLevel(), null, "amizade 219 ainda não basta");
        borderline.record().friendship = 220;
        eq(borderline.evolutionByLevel(), "PIKACHU", "amizade 220 dispara (limiar canônico)");
        eq(happy(at("CHINGLING", 20)).evolutionByLevel(), "CHIMECHO", "HappinessNight cai no mesmo critério");
        eq(happy(at("RIOLU", 20)).evolutionByLevel(), "LUCARIO", "HappinessDay cai no mesmo critério");
    }

    //--- 3. HasMove ----------------------------------------------------------
    {
        const lick = at("LICKITUNG", 40);
        lick._moves = [];
        eq(lick.evolutionByLevel(), null, "Lickitung sem Rollout não evolui");
        lick.learnMove("ROLLOUT");
        eq(lick.evolutionByLevel(), "LICKILICKY", "Lickitung com Rollout vira Lickilicky");

        const tangela = at("TANGELA", 40);
        tangela._moves = [];
        tangela.learnMove("ANCIENTPOWER");
        eq(tangela.evolutionByLevel(), "TANGROWTH", "Tangela com Ancient Power vira Tangrowth");
    }

    //--- 4. Vínculo (Cabo Link no lugar da troca) ----------------------------
    {
        ok(!!ctx.MON.Core.item("LINKCABLE"), "Cabo Link existe no banco de itens");
        eq(E.byItem(at("MACHOKE", 30), "LINKCABLE"), "MACHAMP", "Machoke + Cabo Link = Machamp");
        eq(E.byItem(at("HAUNTER", 30), "LINKCABLE"), "GENGAR", "Haunter + Cabo Link = Gengar");
        eq(at("MACHOKE", 100).evolutionByLevel(), null, "Machoke nunca evolui só por nível");

        // TradeItem exige o item indicado na mochila, mas não o consome
        eq(withBag([], () => E.byItem(at("ONIX", 30), "LINKCABLE")), null,
            "Onix + Cabo Link sem Metal Coat não evolui");
        eq(withBag(["METALCOAT"], () => E.byItem(at("ONIX", 30), "LINKCABLE")), "STEELIX",
            "Onix + Cabo Link com Metal Coat = Steelix");
        eq(withBag(["METALCOAT"], () => E.byItem(at("ONIX", 30), "METALCOAT")), null,
            "o item exigido sozinho não evolui: quem dispara é o Cabo Link");

        // Feebas: Beauty falha fechada, a Prism Scale é o caminho real
        eq(at("FEEBAS", 50).evolutionByLevel(), null, "Beauty não existe no jogo: falha fechada");
        eq(withBag(["PRISMSCALE"], () => E.byItem(at("FEEBAS", 20), "LINKCABLE")), "MILOTIC",
            "Feebas evolui pela Prism Scale + Cabo Link");

        // TradeSpecies e HasInParty leem a equipe
        eq(withParty([at("SHELMET", 20)], [], () => E.byItem(at("KARRABLAST", 20), "LINKCABLE")), "ESCAVALIER",
            "Karrablast + Cabo Link com Shelmet na equipe = Escavalier");
        eq(withParty([at("PIDGEY", 20)], [], () => E.byItem(at("KARRABLAST", 20), "LINKCABLE")), null,
            "sem Shelmet na equipe, Karrablast não evolui");
        eq(withParty([at("REMORAID", 20)], [], () => at("MANTYKE", 25).evolutionByLevel()), "MANTINE",
            "Mantyke evolui com Remoraid na equipe");
    }

    //--- 5. Local ------------------------------------------------------------
    {
        eq(onMap(49, () => at("MAGNETON", 40).evolutionByLevel()), null,
            "sem mapeamento, Location falha fechada (Map001/Map002 não colidem com o Essentials)");
        eq(onMap(2, () => {
            E.LOCATION_MAPS["49"] = 2;
            const into = at("MAGNETON", 40).evolutionByLevel();
            delete E.LOCATION_MAPS["49"];
            return into;
        }), "MAGNEZONE", "com o mapa mapeado, Magneton vira Magnezone lá");
    }

    //--- 6. Métodos extras das gerações 2-5 ---------------------------------
    {
        const tyrogue = at("TYROGUE", 20);
        const into = tyrogue.evolutionByLevel();
        ok(["HITMONLEE", "HITMONCHAN", "HITMONTOP"].includes(into),
            "Tyrogue nv20 vira um dos Hitmon conforme Atk vs Def (" + into + ")");
        eq(at("TYROGUE", 19).evolutionByLevel(), null, "Tyrogue nv19 ainda não evolui");

        const wurmples = [];
        for (let i = 0; i < 40; i++) wurmples.push(at("WURMPLE", 7).evolutionByLevel());
        ok(wurmples.every(w => w === "SILCOON" || w === "CASCOON"), "Wurmple nv7 sempre escolhe um ramo");
        ok(new Set(wurmples).size === 2, "o ramo do Wurmple varia entre indivíduos");
        const stable = at("WURMPLE", 7);
        eq(stable.evolutionByLevel(), stable.evolutionByLevel(), "o ramo do Wurmple é fixo no indivíduo");

        eq(at("NINCADA", 20).evolutionByLevel(), "NINJASK", "Nincada nv20 vira Ninjask");
        // item que não dispara evolução alguma tem de reprovar mesmo em espécie
        // QUE TEM evolução por item (senão o assert é verdadeiro por construção)
        eq(E.byItem(at("PIKACHU", 20), "POKEBALL"), null, "item errado não evolui quem evolui por pedra");
    }

    //--- 7. Falha fechada ----------------------------------------------------
    {
        const bulba = at("BULBASAUR", 16);
        const species = bulba.species();
        const saved = species.evolutions;
        species.evolutions = [{ into: "MEWTWO", method: "MetodoQueNaoExiste", param: "1" }];
        eq(bulba.evolutionByLevel(), null, "método desconhecido não evolui por nível");
        eq(E.byItem(bulba, "THUNDERSTONE"), null, "método desconhecido não evolui por item");
        species.evolutions = saved;

        eq(E.byItem(at("PIKACHU", 20), null), null, "byItem sem item retorna null");
        eq(E.byItem(null, "THUNDERSTONE"), null, "byItem sem monstro retorna null");
    }

    //--- 8. Mochila: hook tardio (MON_Bag carrega DEPOIS deste plugin) -------
    {
        E.installBagIntegration();
        E.installBagIntegration();   // idempotente: não pode empilhar wrapper

        ok(E.isEvolutionItem("THUNDERSTONE") && E.isEvolutionItem("LINKCABLE"),
            "pedras e Cabo Link são reconhecidos como itens de evolução");
        ok(!E.isEvolutionItem("POTION"), "Potion não é item de evolução");

        const pika = at("PIKACHU", 20);
        const res = ctx.MON.Items.useOnMonster("THUNDERSTONE", pika);
        ok(res.ok && pika.speciesName === "Raichu", "usar a pedra pela mochila evolui de verdade");
        ok(res.message.includes("Raichu"), "a mensagem anuncia a evolução");

        // o wrapper não pode atrapalhar os itens comuns
        const hurt = at("BLASTOISE", 50);
        hurt.hp = 1;
        const heal = ctx.MON.Items.useOnMonster("POTION", hurt);
        ok(heal.ok && hurt.hp === 21, "Potion continua curando +20 pela mochila");
        eq(ctx.MON.Items.useOnMonster("THUNDERSTONE", at("BULBASAUR", 20)).ok, false,
            "pedra sem efeito devolve a recusa padrão");
    }

    //--- 9. Regressão: 649 espécies × níveis × gêneros -----------------------
    {
        section("Evolução — regressão contra o comportamento antigo");
        const ids = ctx.MON.Core.allSpeciesIds();
        const levels = [1, 5, 7, 10, 16, 20, 25, 30, 34, 37, 40, 45, 50, 55, 64, 80, 100];
        let checks = 0, contradictions = 0, unlocked = 0;
        const samples = [];

        for (const id of ids) {
            const species = ctx.MON.Core.species(id);
            if (!species || !(species.evolutions || []).length) continue;
            for (const level of levels) {
                for (const gender of ["M", "F", "N"]) {
                    const pkm = at(id, level, gender);
                    const before = legacyEvolution(pkm);
                    const after = pkm.evolutionByLevel();
                    checks++;
                    if (before !== null && before !== after) {
                        contradictions++;
                        if (samples.length < 5) samples.push(`${species.internalName} nv${level} ${gender}: ${before} -> ${after}`);
                    }
                    if (before === null && after !== null) unlocked++;
                }
            }
        }
        console.log(`  (${checks} combinações verificadas, ${unlocked} evoluções novas destravadas)`);
        if (samples.length) console.log("  divergências: " + samples.join(" | "));
        eq(contradictions, 0, "nenhuma evolução Level* antiga mudou de resultado");
        ok(unlocked > 0, "o novo motor destrava evoluções que antes eram inalcançáveis");

        // nenhum método fora das tabelas escapou por engano
        const known = new Set([
            "Level", "LevelMale", "LevelFemale", "AttackGreater", "DefenseGreater", "AtkDefEqual",
            "Silcoon", "Cascoon", "Ninjask", "Happiness", "HappinessDay", "HappinessNight",
            "HasMove", "HasInParty", "Location",
            "Item", "ItemMale", "ItemFemale", "DayHoldItem", "NightHoldItem",
            "Trade", "TradeItem", "TradeSpecies",
            "Shedinja", "Beauty"
        ]);
        const unhandled = new Set();
        for (const id of ids) {
            for (const ev of (ctx.MON.Core.species(id).evolutions || [])) {
                if (!known.has(ev.method)) unhandled.add(ev.method);
            }
        }
        eq(unhandled.size, 0, "todo método do banco está mapeado ou é recusa deliberada");

        // o caso âncora do harness continua idêntico
        const bulba = at("BULBASAUR", 15);
        eq(bulba.evolutionByLevel(), null, "Bulbasaur nv15 continua sem evoluir");
        eq(at("BULBASAUR", 16).evolutionByLevel(), "IVYSAUR", "Bulbasaur nv16 continua virando Ivysaur");
        eq(at("CHARMANDER", 16).evolutionByLevel(), "CHARMELEON", "Charmander nv16 continua igual");
        eq(at("BURMY", 20, "F").evolutionByLevel(), "WORMADAM", "LevelFemale continua funcionando");
        eq(at("BURMY", 20, "M").evolutionByLevel(), "MOTHIM", "LevelMale continua funcionando");
    }

    //--- 10. Digievolução ramificada continua intacta ------------------------
    {
        eq(new G("AGUMON", 20).evolutionByLevel(), "GREYMON", "digievolução com condition segue viva");
        const battered = new G("AGUMON", 20);
        battered.recordFaint(); battered.recordFaint(); battered.recordFaint();
        eq(battered.evolutionByLevel(), "TYRANNOMON", "ramo alternativo por condition segue vivo");
    }
};
