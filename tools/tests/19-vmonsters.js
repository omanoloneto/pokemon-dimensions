// Suíte do bestiário da dimensão Folklora (VMO): conversão de V-Monsters:
// Forgotten Link (Unity) para o banco multi-franquia — tipos, stats, cadeias de
// evolução, golpes assinatura e a amarração com a Barra de Elo.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "../..");
const STAT_KEYS = ["hp", "atk", "def", "spe", "spa", "spd"];
const RANGE = { from: 970, to: 1069 };

// os 7 textos PT-BR oficiais, copiados de Assets/Settings/Locales Tables/
// Monsters_pt-BR.asset. A tag <color> é smart-format da Unity e não existe no
// MZ: o banco guarda o mesmo texto sem a marcação, palavra por palavra.
const OFICIAL_PT_BR = {
    DOKURI: "Um V-Monster do tipo <color=#{TypeColor}>Sombrio</color>.\nAlguns Dokuris evitam contato com outros V-Monsters. Geralmente habitam ruínas antigas, para se manterem afastados.",
    GUAXINITO: "Um V-Monster do tipo <color=#{TypeColor}>Selvagem</color>.\nÉ um explorador nato, muito ágil e sempre em busca de frutinhas.",
    JAREH: "Um V-Monster do tipo <color=#{TypeColor}>Fogo</color>.\nSeu fone de ouvido o ajuda a se manter no ritmo e a canalizar a chama em sua cauda.",
    PULSEBUN: "Um V-Monster do tipo <color=#{TypeColor}>Elétrico</color>.\nPulsebun gera energia elétrica em seus pelos azuis para realizar ataques ao estilo de um boxeador.",
    QUILLI: "Um V-Monster do tipo <color=#{TypeColor}>Selvagem</color>.\nEm batalha, costumam emitir gritos altos para intimidar seus inimigos.",
    SHOKKURI: "Um V-Monster do tipo <color=#{TypeColor}>Elétrico</color>.\nA energia estática que emite é suficiente para paralisar vários oponentes.",
    STURTLE: "Um V-Monster do tipo <color=#{TypeColor}>Aquático</color>.\nGosta de presentear seus amigos com objetos encontrados no oceano. Armazena energia e ganha resistência em seu casco."
};
const stripUnityTags = (s) => s.replace(/<[^>]+>/g, "");

// Configs.asset -> StarterMonsters (7 guids, todos formas-base)
const STARTERS = ["SHOKKURI", "DOKURI", "QUILLI", "STURTLE", "GUAXINITO", "PULSEBUN", "JAREH"];

// ElementType (Assets/Scripts/Common/Utils/Enums.cs) -> rótulo PT-BR do vType
const VTYPES = ["Selvagem", "Espectral", "Divino", "Elétrico", "Aquático", "Sombrio", "Mineral",
    "Fogo", "Gélido", "Mecânico", "Vegetal", "Neutro", "Viral", "Arcano"];

// o harness carrega uma lista fixa de plugins; MON_Link não está nela
function bootLink(ctx) {
    if (ctx.MON.Link) return;
    vm.runInContext(fs.readFileSync(path.join(ROOT, "js/plugins/MON_Link.js"), "utf8"),
        ctx, { filename: "MON_Link.js" });
}

// IV/EV zerados e natureza neutra: sem isso o sorteio dos stats tornaria as
// comparações de dano instáveis entre execuções
function fixate(unit) {
    for (const k of STAT_KEYS) { unit._ivs[k] = 0; unit._evs[k] = 0; }
    unit._nature = 0;
    unit._hp = unit.maxHp;
    return unit;
}

module.exports = function({ ctx, ok, eq, G, section }) {
    section("V-Monsters — bestiário da Folklora (VMO)");

    bootLink(ctx);
    const C = ctx.MON.Core;
    const B = ctx.MON.Battle;
    const L = ctx.MON.Link;
    const F = ctx.MON.Franchise;

    const roster = C.allSpeciesIds().map(id => C.species(id))
        .filter(sp => sp && F.ofSpecies(sp.id) && F.ofSpecies(sp.id).id === "VMO");
    const byName = new Map(roster.map(sp => [sp.internalName, sp]));
    const bst = (sp) => STAT_KEYS.reduce((sum, k) => sum + sp.stats[k], 0);
    const isFinal = (sp) => (sp.evolutions || []).length === 0;
    const vmo = (internalName, level = 50) => fixate(new G(internalName, level));

    //=========================================================================
    // Elenco e faixa de ID
    //=========================================================================
    {
        eq(roster.length, 35, "35 V-Monsters cadastrados (16 com stats da fonte + 19 formas finais)");
        ok(roster.every(sp => sp.id >= RANGE.from && sp.id <= RANGE.to),
            "todo V-Monster está na faixa 970-1069");
        eq(new Set(roster.map(sp => sp.id)).size, roster.length, "sem id repetido");
        eq(byName.size, roster.length, "sem internalName repetido dentro de VMO");

        // colisão com as outras 793 espécies do banco derrubaria o lookup por nome
        const foreign = C.allSpeciesIds().map(id => C.species(id))
            .filter(sp => sp && !byName.has(sp.internalName) || false)
            .filter(sp => sp && F.ofSpecies(sp.id).id !== "VMO")
            .map(sp => sp.internalName);
        eq(foreign.filter(n => byName.has(n)).length, 0,
            "nenhum internalName de VMO colide com espécie de outra franquia");
        ok(roster.every(sp => C.speciesByInternal(sp.internalName) === sp),
            "todo V-Monster é achável por internalName");

        ok(roster.every(sp => sp.franchise === "VMO"), "o build marcou a franquia VMO em todos");
        ok(STARTERS.every(n => byName.has(n)), "os 7 iniciais de Configs.asset estão no banco");
        ok(STARTERS.every(n => roster.every(sp => (sp.evolutions || [])
            .every(ev => ev.into !== n))), "nenhum inicial é alvo de evolução (todos são forma-base)");
    }

    //=========================================================================
    // Tipos: os 14 da fonte caíram nos 18 do banco; vType é só flavor
    //=========================================================================
    {
        const chart = ctx.$dataTypes.chart;
        ok(roster.every(sp => !!chart[sp.type1]), "todo type1 existe em Types.json");
        ok(roster.every(sp => !sp.type2 || !!chart[sp.type2]), "todo type2 existe em Types.json");
        ok(roster.every(sp => sp.type1 !== sp.type2), "nenhum V-Monster repete o tipo em type1/type2");
        ok(roster.every(sp => sp.type1 !== "FAIRY" && sp.type2 !== "FAIRY"),
            "nenhum tipo FAIRY (o banco é Gen 5)");

        ok(roster.every(sp => typeof sp.vType === "string" && VTYPES.includes(sp.vType)),
            "todo V-Monster guarda o ElementType da fonte em vType");
        eq(VTYPES.filter(v => chart[v] !== undefined).length, 0,
            "nenhum rótulo de vType é tipo do motor — não pode entrar na tabela de dano");

        // amostra da tabela de conversão, conferida contra os .asset da fonte
        eq(byName.get("SHOKKURI").vType, "Elétrico", "Shokkuri: Type 3 = Elétrico");
        eq(byName.get("SHOKKURI").type1, "ELECTRIC", "Elétrico -> ELECTRIC");
        eq(byName.get("ARKAME").vType, "Mineral", "Arkame: Type 6 = Mineral");
        eq(byName.get("ARKAME").type1, "ROCK", "Mineral -> ROCK");
        eq(byName.get("KATANARI").vType, "Divino", "Katanari: Type 2 = Divino");
        eq(byName.get("KATANARI").type1, "PSYCHIC", "Divino -> PSYCHIC (não há FAIRY/Luz no Gen 5)");
        eq(byName.get("METALLIGATOR").vType, "Mecânico", "Metalligator: Type 9 = Mecânico");
        eq(byName.get("METALLIGATOR").type1, "STEEL", "Mecânico -> STEEL");
        eq(byName.get("XIANBOO").vType, "Vegetal", "Xianboo: Type 10 = Vegetal");
        eq(byName.get("XIANBOO").type1, "GRASS", "Vegetal -> GRASS");
    }

    //=========================================================================
    // vType tem ZERO efeito de combate (mesmo contrato do attribute dos Digimon)
    //=========================================================================
    {
        // Guarabolt é PSYCHIC/ELECTRIC com vType "Divino": quem manda na tabela
        // é o par type1/type2, não o rótulo da fonte
        const guara = vmo("GUARABOLT");
        eq(C.typeMultiplier("DARK", guara.types()), 2,
            "Sombrio x Guarabolt = 2x (PSYCHIC), o vType Divino não interfere");
        eq(C.typeMultiplier("GROUND", guara.types()), 2, "Terra x Guarabolt = 2x (ELECTRIC)");
        ok(!guara.types().includes("Divino"), "types() nunca devolve o vType");

        // prova direta: dois defensores idênticos, um com vType trocado
        const clone = JSON.parse(JSON.stringify(C.speciesByInternal("KROKOMALO")));
        let freeId = RANGE.from;
        while (ctx.$dataMonsters[freeId]) freeId++;
        clone.id = freeId;
        clone.internalName = "VMOVTYPECLONE";
        clone.name = "Clone de Teste";
        clone.vType = "Arcano";           // rótulo diferente, tudo o mais igual
        clone.evolutions = [];
        ctx.$dataMonsters[freeId] = clone;
        for (let i = 1; i < ctx.$dataMonsters.length; i++) {
            if (ctx.$dataMonsters[i] === undefined) ctx.$dataMonsters[i] = null;
        }

        const attacker = vmo("QUILLSTORM");
        const original = vmo("KROKOMALO");
        const twin = vmo("VMOVTYPECLONE");
        eq(twin.maxHp, original.maxHp, "o clone nasce com o mesmo HP");
        const opts = { fixedRand: 1, forceCrit: false };
        const a = B.calcDamage(attacker, original, "CLOUDDISPERSION", opts);
        const b = B.calcDamage(attacker, twin, "CLOUDDISPERSION", opts);
        eq(b.damage, a.damage, "trocar o vType não muda uma unidade de dano");
        eq(b.effectiveness, a.effectiveness, "trocar o vType não muda a eficácia");

        // e o mesmo do lado do atacante
        const c = B.calcDamage(original, attacker, "UNDERPRESSURE", opts);
        const d = B.calcDamage(twin, attacker, "UNDERPRESSURE", opts);
        eq(d.damage, c.damage, "vType do atacante também não pesa no dano");

        delete ctx.$dataMonsters[freeId];
        ctx.$dataMonsters[freeId] = null;
    }

    //=========================================================================
    // Cadeias de evolução (NextEvos / NextBlockedEvos da fonte)
    //=========================================================================
    {
        const all = roster.flatMap(sp => (sp.evolutions || []).map(ev => [sp, ev]));
        ok(all.length > 0, "há cadeias de evolução cadastradas");
        ok(all.every(([, ev]) => byName.has(ev.into)),
            "todo ramo aponta para um V-Monster que existe no banco");
        ok(roster.every(sp => (sp.evolutions || []).length <= 2),
            "no máximo 2 ramos por estágio (regra do doc 02) — Quillara perdeu o 3º");
        ok(all.every(([sp, ev]) => ev.into !== sp.internalName), "nenhum ramo aponta para si mesmo");
        ok(roster.every(sp => new Set((sp.evolutions || []).map(e => e.into)).size
            === (sp.evolutions || []).length), "nenhum estágio repete o mesmo destino");

        // ramos bloqueados na fonte viram condição; ramo livre não tem condição
        eq(byName.get("SHOKKURI").evolutions.length, 1, "Shokkuri tem 1 ramo (NextEvos)");
        eq(byName.get("SHOKKURI").evolutions[0].into, "KAGENARI", "Shokkuri -> Kagenari");
        ok(!byName.get("SHOKKURI").evolutions[0].condition, "ramo de NextEvos nasce sem condição");
        eq(byName.get("STURTLE").evolutions.length, 2, "Sturtle tem os 2 ramos livres da fonte");
        ok(byName.get("STURTLE").evolutions.every(ev => !ev.condition),
            "os dois ramos de Sturtle são NextEvos: sem cadeado");
        ok(byName.get("KAGENARI").evolutions.every(ev => !!ev.condition),
            "os 2 ramos de Kagenari vieram de NextBlockedEvos: ambos com condição");
        ok(byName.get("QUILLI").evolutions.some(ev => !ev.condition)
            && byName.get("QUILLI").evolutions.some(ev => !!ev.condition),
            "Quilli mistura um ramo livre (Quillara) com um bloqueado (Haunrutau)");

        // Quillphyr é o ramo cortado: existe como espécie, mas ninguém evolui nele
        ok(byName.has("QUILLPHYR"), "Quillphyr continua no banco (a arte existe)");
        ok(all.every(([, ev]) => ev.into !== "QUILLPHYR"),
            "Quillphyr não é ramo de ninguém — é o corte do 3º ramo de Quillara");

        // toda forma final é folha e todo não-final chega a uma folha
        const finals = roster.filter(isFinal);
        eq(finals.length, 19, "19 formas finais (folhas da árvore)");
        for (const sp of roster) {
            let cur = sp, hops = 0;
            while (!isFinal(cur) && hops < 10) { cur = byName.get(cur.evolutions[0].into); hops++; }
            ok(isFinal(cur), sp.internalName + " chega a uma forma final em no máximo 10 saltos");
        }
    }

    //=========================================================================
    // O portão é a Barra de Elo — nunca o nível
    //=========================================================================
    {
        const byLevel = roster.filter(sp => vmo(sp.internalName, 100).evolutionByLevel() !== null);
        eq(byLevel.length, 0, "nenhum V-Monster evolui por nível, nem no 100 (o elo é o único portão)");
        ok(roster.every(sp => (sp.evolutions || []).every(ev => Number(ev.param) > 100)),
            "o param dos ramos fica acima do teto de nível de propósito");
    }

    //=========================================================================
    // Descrições: os 7 textos oficiais são cópia literal da fonte
    //=========================================================================
    {
        for (const [key, source] of Object.entries(OFICIAL_PT_BR)) {
            eq(byName.get(key).entry, stripUnityTags(source),
                key + ": entrada idêntica ao Monsters_pt-BR.asset");
        }
        ok(roster.every(sp => typeof sp.entry === "string" && sp.entry.length > 40),
            "todo V-Monster tem entrada de dex escrita");
        ok(roster.every(sp => !/<[^>]+>/.test(sp.entry)),
            "nenhuma entrada carrega marcação da Unity (o MZ mostraria a tag crua)");
        ok(roster.every(sp => sp.entry.startsWith("Um V-Monster do tipo " + sp.vType + ".")),
            "as 35 entradas seguem o tom oficial e citam o vType do monstro");
    }

    //=========================================================================
    // Stats: BST coerente com a Dimensão 6 (níveis 47-52)
    //=========================================================================
    {
        ok(roster.every(sp => STAT_KEYS.every(k => sp.stats[k] > 0)), "nenhum stat zerado ou negativo");
        ok(roster.every(sp => STAT_KEYS.every(k => sp.stats[k] <= 155)), "nenhum stat isolado acima de 155");

        const bases = roster.filter(sp => STARTERS.includes(sp.internalName));
        const finals = roster.filter(isFinal);
        const mids = roster.filter(sp => !isFinal(sp) && !STARTERS.includes(sp.internalName));
        const avg = (list) => Math.round(list.reduce((s, sp) => s + bst(sp), 0) / list.length);

        ok(bases.every(sp => bst(sp) >= 370 && bst(sp) <= 450), "formas-base entre 370 e 450 de BST");
        ok(mids.every(sp => bst(sp) >= 500 && bst(sp) <= 620), "formas médias entre 500 e 620 de BST");
        ok(finals.every(sp => bst(sp) >= 580 && bst(sp) <= 660), "formas finais entre 580 e 660 de BST");
        ok(avg(bases) < avg(mids) && avg(mids) < avg(finals), "o BST médio cresce a cada estágio");

        // comparação com Bucky (D5), a dimensão anterior
        const bky = ctx.MON.Franchise.speciesOf("BKY").filter(Boolean);
        const troubles = bky.filter(sp => sp.troublemonster);
        const spirits = bky.filter(sp => !sp.troublemonster);
        ok(avg(finals) > avg(troubles),
            "final de VMO (D6) é mais forte que o Troublemonster médio de Bucky (D5)");
        ok(Math.max(...finals.map(bst)) < Math.max(...spirits.map(bst)),
            "nenhum V-Monster passa do espírito mais forte de Bucky (Dragac, 760)");
        ok(avg(bases) < avg(troubles),
            "a forma-base de VMO ainda é mais fraca que o padrão de D5 — ela existe para evoluir");
    }

    //=========================================================================
    // catchRate decrescente por estágio
    //=========================================================================
    {
        const rate = (n) => byName.get(n).catchRate;
        ok(roster.every(sp => sp.catchRate >= 0 && sp.catchRate <= 255), "catchRate dentro de 0-255");
        ok(STARTERS.every(n => rate(n) === 45), "formas-base: catchRate 45");
        ok(roster.filter(sp => !isFinal(sp) && !STARTERS.includes(sp.internalName))
            .every(sp => sp.catchRate <= 25), "formas médias: catchRate no máximo 25");
        ok(roster.filter(isFinal).every(sp => sp.catchRate <= 12), "formas finais: catchRate no máximo 12");
        for (const sp of roster) {
            for (const ev of sp.evolutions || []) {
                ok(byName.get(ev.into).catchRate < sp.catchRate,
                    sp.internalName + " -> " + ev.into + ": catchRate cai ao evoluir");
            }
        }
    }

    //=========================================================================
    // Golpes assinatura (data/moves/VMO.json)
    //=========================================================================
    {
        const vmoMoves = JSON.parse(fs.readFileSync(path.join(ROOT, "data/moves/VMO.json"), "utf8"));
        const names = Object.keys(vmoMoves);
        eq(names.length, 48, "48 golpes assinatura convertidos das 51 skills da fonte");
        ok(names.every(n => vmoMoves[n].internalName === n), "a chave bate com o internalName");
        ok(names.every(n => !ctx.$dataMoves[n] || ctx.$dataMovesExtra[n]),
            "nenhum golpe VMO sobrescreve golpe do banco base");
        ok(names.every(n => !!C.move(n)), "todo golpe VMO entrou no banco fundido");

        const ids = names.map(n => vmoMoves[n].id);
        eq(new Set(ids).size, ids.length, "sem id de golpe repetido");
        ok(ids.every(id => id >= 1100 && id <= 1147), "faixa própria de id: 1100-1147");
        // 1100+ não colide com base (1-559), DGM (560-645), BKY (780-783),
        // MDB (900-909) nem HUM (910-925)
        const taken = Object.values(ctx.$dataMoves).filter(Boolean)
            .filter(m => !names.includes(m.internalName)).map(m => m.id);
        eq(ids.filter(id => taken.includes(id)).length, 0, "nenhum id de golpe colide com os outros bancos");

        const chart = ctx.$dataTypes.chart;
        ok(names.every(n => !!chart[vmoMoves[n].type]), "todo golpe VMO tem tipo válido");
        ok(names.every(n => ["Physical", "Special", "Status"].includes(vmoMoves[n].category)),
            "categoria válida em todo golpe");
        ok(names.every(n => vmoMoves[n].power >= 0 && vmoMoves[n].power <= 120),
            "power entre 0 e 120 (teto da conversão _Damage x 2)");
        ok(names.every(n => vmoMoves[n].description && /[a-zà-ú]/.test(vmoMoves[n].description)),
            "todo golpe tem descrição em português");

        // nomes preservados da fonte (IP do dono)
        eq(vmoMoves.PULSERUSH.name, "Pulse Rush", "o nome da skill vem da fonte, sem tradução");
        eq(vmoMoves.OCEANSGIFT.name, "Ocean's Gift", "nome com apóstrofo preservado");

        // regra de conversão: power = _Damage x 2, com teto em 120
        eq(vmoMoves.TINYJOLT.power, 60, "Tiny Jolt: _Damage 30 -> power 60");
        eq(vmoMoves.DOKAWHIP.power, 100, "Doka Whip: _Damage 50 -> power 100");
        eq(vmoMoves.PULSERUSH.power, 120, "Pulse Rush: _Damage 70 -> power 120 (teto)");
        eq(vmoMoves.OCEANSGIFT.power, 0, "Ocean's Gift não causa dano: vira golpe de status");

        // todo golpe de dano roda de ponta a ponta pelo motor
        const attacker = vmo("PULSEBOLT");
        const target = vmo("STURTLE");
        const broken = names.filter(n => vmoMoves[n].power > 0 &&
            B.calcDamage(attacker, target, n, { fixedRand: 1, forceCrit: false }).damage <= 0);
        eq(broken.length, 0, "todo golpe de dano VMO causa dano pelo calcDamage");
        ok(B.calcDamage(attacker, target, "OCEANSGIFT").status,
            "golpe de status é reconhecido como tal pelo motor");

        // todo golpe citado em levelMoves existe (o build já reprova, aqui é a rede)
        const missing = roster.flatMap(sp => sp.levelMoves.map(lm => lm.move))
            .filter(id => !C.move(id));
        eq(missing.length, 0, "todo golpe de levelMoves existe em algum banco");
        ok(roster.every(sp => sp.levelMoves.length >= 6), "todo V-Monster aprende ao menos 6 golpes");
        ok(roster.every(sp => sp.levelMoves.some(lm => !!vmoMoves[lm.move])),
            "todo V-Monster aprende ao menos um golpe assinatura da própria franquia");
        ok(roster.every(sp => sp.levelMoves.every((lm, i, arr) => i === 0 || lm.level >= arr[i - 1].level)),
            "levelMoves em ordem crescente de nível");
        ok(roster.every(sp => vmo(sp.internalName, 50).moves.length > 0),
            "todo V-Monster entra em batalha no nível 50 com golpe na mão");
    }

    //=========================================================================
    // Integração com a Barra de Elo: encher, escolher o ramo e ficar evoluído
    //=========================================================================
    {
        const unit = vmo("SHOKKURI", 47);
        ok(L.isLinkUser(unit), "V-Monster do banco tem barra de elo");
        eq(L.branches(unit).length, 1, "Shokkuri mostra o único ramo da fonte");
        ok(L.branches(unit)[0].unlocked, "ramo sem condição já nasce liberado");
        eq(L.branches(unit)[0].name, "Kagenari", "o ramo carrega o nome de exibição");

        ok(!L.canEvolve(unit), "com a barra vazia não evolui");
        unit.hp = Math.floor(unit.maxHp / 4);
        L.gain(unit, L.max(unit));
        ok(L.canEvolve(unit), "barra cheia libera a evolução");

        const res = L.evolve(unit, 0);
        ok(res.ok, "o elo completa a evolução");
        eq(unit.speciesName, "Kagenari", "Shokkuri virou Kagenari pelo elo");
        eq(L.value(unit), 0, "evoluir zera a barra");
        ok(unit.hp > Math.floor(unit.maxHp / 4), "a evolução devolve metade do HP");

        // e a forma é DEFINITIVA — o contrário do original em Unity
        unit.resetBattleState();
        eq(unit.speciesName, "Kagenari", "a forma conquistada NÃO volta no fim da batalha");
        ok(L.evolvedByLink(unit), "a evolução pelo elo fica registrada no monstro");
    }
    {
        // ramo bloqueado: silhueta com cadeado até a condição ser cumprida
        const unit = vmo("KAGENARI", 50);
        const branches = L.branches(unit);
        eq(branches.length, 2, "Kagenari tem 2 ramos");
        ok(branches.every(b => !b.unlocked), "os dois nascem bloqueados (NextBlockedEvos)");
        L.gain(unit, L.max(unit));
        eq(L.canEvolve(unit), false, "barra cheia sem ramo liberado ainda não evolui");
        eq(L.evolve(unit, 0).ok, false, "evolve recusa ramo bloqueado");

        const tupanari = branches.findIndex(b => b.into === "TUPANARI");
        for (let i = 0; i < 10; i++) unit.recordWin();
        ok(L.branches(unit)[tupanari].unlocked, "10 vitórias destravam o ramo de Tupanari");
        ok(L.evolve(unit, tupanari).ok, "com a condição cumprida o elo evolui");
        eq(unit.speciesName, "Tupanari", "chegou à forma final escolhida");
        unit.resetBattleState();
        eq(unit.speciesName, "Tupanari", "a forma final também é definitiva");
        eq(L.branches(unit).length, 0, "forma final não tem para onde evoluir");
    }
    {
        // ramo por item: o V-Link avançado é o que abre o caminho
        const unit = vmo("KAGENARI", 50);
        const katanari = L.branches(unit).findIndex(b => b.into === "KATANARI");
        const previous = ctx.$gameParty;
        ctx.$gameParty = { monHasItem: (name) => name === "VLINKPRO" };
        try {
            ok(L.branches(unit)[katanari].unlocked, "com o V-Link Pro na mochila o ramo abre");
            L.gain(unit, L.max(unit));
            ok(L.evolve(unit, katanari).ok, "evolui pelo ramo do item");
            eq(unit.speciesName, "Katanari", "Kagenari virou Katanari");
        } finally {
            ctx.$gameParty = previous;
        }
    }
    {
        // a captura da franquia continua respondendo pelos V-Links
        const target = { speciesId: byName.get("QUILLI").id, name: "Quilli", species: () => null, hpRate: () => 0.3 };
        ok(F.itemWorksOn("VLINK", target), "V-Link funciona em V-Monster");
        ok(!F.itemWorksOn("POKEBALL", target), "Poké Bola não funciona em V-Monster");
        ok(F.captureRule(target, "VLINK").allowed, "V-Monster enfraquecido pode ser absorvido");
    }
};
