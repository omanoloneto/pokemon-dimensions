// Suíte dos Doze Mundos: Jibaku único, Ecos de Raiz, Selo x Relógio GC, gate de
// pacto, economia do arremesso, curva dos golpes Jibaku e cura dos Encrenqueiros.
module.exports = function({ ctx, ok, eq, G, section }) {
    section("Doze Mundos — Ecos de Raiz, Relógio GC e Encrenqueiros (BKY)");

    const P = ctx.MON.Pacts;
    const F = ctx.MON.Franchise;
    const B = ctx.MON.Battle;
    const C = ctx.MON.Core;

    // faixas da campanha (docs/03): D5 selvagens 40-47, chefes 45/49, D0 48-55
    const D5_WILD_TOP = 47;
    const CAMPAIGN_TOP = 55;

    const newSave = () => {
        ctx.$gameSystem = new ctx.Game_System();
        const gp = new ctx.Game_Party();
        gp.initialize();
        ctx.$gameParty = gp;
        return gp;
    };
    let party = newSave();

    const all = F.speciesOf("BKY");
    const echoes = all.filter(sp => sp.pactMark);
    const jibaku = all.filter(sp => sp.uniqueSpirit);
    const troubles = all.filter(sp => sp.troublemonster);

    //=========================================================================
    // Cânone: um Espírito só, onze ecos, doze mundos no relógio
    //=========================================================================
    ok(jibaku.length === 1 && jibaku[0].internalName === "JIBAC" && jibaku[0].world === "Primas",
        "Jibaku é o único Espírito remanescente e pertence a Primas");
    ok(!jibaku[0].pactMark, "o Espírito único não tem Selo: ele é herdado, não pactuado");
    ok(echoes.length === 11 && echoes.every(sp => sp.id >= 901 && sp.id <= 911),
        "11 Ecos de Raiz nos ids 901-911 — um para cada Espírito absorvido");
    ok(troubles.length === 8 && troubles.every(sp => sp.id >= 912 && sp.id <= 919),
        "8 Encrenqueiros nos ids 912-919");

    eq(P.WORLDS.length, 12, "os doze países do continente estão declarados");
    eq(P.MARKS.length, 12, "doze Selos de Raiz, um por posição do relógio");
    ok(P.MARKS.every((m, i) => P.worldOfMark(m) === P.WORLDS[i]),
        "o número do Selo é a posição do mundo no relógio (GC_01 Primas ... GC_12 Doidicus)");
    eq(P.worldOfMark("GC_99"), null, "Selo inexistente não aponta para mundo nenhum");

    const marks = echoes.map(sp => sp.pactMark);
    ok(new Set(marks).size === 11 && marks.every(m => P.isMark(m)),
        "cada eco tem um Selo GC_xx único e válido");
    ok(echoes.every(sp => P.worldOfMark(sp.pactMark) === sp.world),
        "o Selo de cada eco bate com o mundo em que ele está alojado");
    ok(!marks.includes("GC_01") && P.WORLDS.indexOf("Primas") === 0,
        "Primas não tem eco: o Espírito dele continua vivo ao lado do jogador");
    ok(new Set(all.filter(sp => !sp.troublemonster).map(sp => sp.world)).size === 12,
        "os doze mundos aparecem uma vez cada entre Jibaku e os ecos");

    const legendary = echoes.concat(jibaku);
    ok(legendary.every(sp => sp.growthRate === "Slow" && (sp.evolutions || []).length === 0)
        && new Set(legendary.map(sp => sp.type1)).size === 12,
        "lendários: curva Slow, sem evolução e 12 tipos distintos");
    ok(echoes.every(sp => sp.category === "Eco de Raiz") && jibaku[0].category === "Espírito",
        "a categoria da Dex separa o Espírito dos ecos");
    ok(["BAMBI", "DRAGAC"].every(n => echoes.some(sp => sp.internalName === n)),
        "Bambi (Secandas) e Dragac (Doidicus, o endgame) estão entre os ecos");

    // Encrenqueiro = estado de uma criatura real; corruptedFrom é o caminho de volta
    ok(troubles.every(sp => {
        const src = C.speciesByInternal(sp.corruptedFrom);
        if (!src) return false;
        const bst = (s) => Object.values(s.stats).reduce((a, b) => a + b, 0);
        return bst(sp) > bst(src) && sp.type1 === src.type1 && sp.type2 && sp.type2 !== src.type2;
    }), "todo Encrenqueiro deriva de uma espécie real, mantém o tipo 1 e sobe o BST");
    ok(troubles.every(sp => sp.category === "Encrenqueiro"),
        "a Dex usa o termo canônico Encrenqueiro, não uma espécie inventada");
    ok(new Set(troubles.map(sp => F.ofSpecies(C.speciesByInternal(sp.corruptedFrom).id).id)).size >= 3,
        "a toxina alcança criaturas de pelo menos 3 franquias");
    ok(troubles.every(sp => Object.values(sp.stats).reduce((a, b) => a + b, 0)
        < Math.min(...legendary.map(s => Object.values(s.stats).reduce((a, b) => a + b, 0)))),
        "nenhum Encrenqueiro chega ao BST do lendário mais fraco");
    ok(troubles.every(sp => (sp.levelMoves || []).every(lm => lm.level <= D5_WILD_TOP)),
        "Encrenqueiro tem o kit completo dentro da faixa selvagem de D5");

    //=========================================================================
    // Curva dos golpes Jibaku (tem de caber na campanha, que acaba em 52-55)
    //=========================================================================
    const levelOf = (sp, move) => ((sp.levelMoves || []).find(lm => lm.move === move) || {}).level;
    ok(legendary.every(sp => levelOf(sp, "JIBAKU") <= CAMPAIGN_TOP),
        "todo lendário alcança JIBAKU dentro da campanha");
    ok(legendary.every(sp => levelOf(sp, "JIBAKUSEAL") <= D5_WILD_TOP),
        "JIBAKUSEAL já está disponível na faixa de D5");

    // eco selvagem com selfKO/recuo pesado se derrubaria sozinho: pacto impossível
    const selfHarm = (move) => {
        const eff = B.MOVE_EFFECTS[move];
        return !!eff && (eff.selfKO === true || (eff.recoil || 0) >= 0.5);
    };
    ok(echoes.every(sp => (sp.levelMoves || [])
        .every(lm => !selfHarm(lm.move) || lm.level > D5_WILD_TOP)),
        "nenhum golpe auto-destrutivo é aprendido dentro da faixa selvagem de D5");

    const wild45 = new G("BAMBI", 45);
    ok(!wild45.moves.some(m => selfHarm(m.id)),
        "o eco encontrado em D5 (nv 45) não tem como se derrubar sozinho");
    const grown = new G("JIBAC", 50);
    ok(grown.knowsMove("JIBAKU"), "aos 50 o Espírito já usa o golpe assinatura");

    // motor: os efeitos continuam registrados
    ok(C.move("JIBAKU") && C.move("JIBAKU").power >= 200 && B.MOVE_EFFECTS.JIBAKU.selfKO === true,
        "JIBAKU existe com poder altíssimo e está registrado como selfKO");
    eq(B.MOVE_EFFECTS.JIBAKUMINOR.recoil, 0.33, "JIBAKUMINOR registrado com recuo 0.33");
    const bomber = new G("JIBAC", 50);
    B.applySelfEffect(bomber, B.MOVE_EFFECTS.JIBAKU, 300);
    ok(bomber.isFainted(), "JIBAKU derruba o próprio Espírito");

    //=========================================================================
    // Relógio GC: o ITEM que fecha o fluxo de captura na batalha
    //=========================================================================
    const emblem = C.item("GCEMBLEM");
    ok(emblem && emblem.pocket === 3 && emblem.catchBonus === 12 && emblem.keepOnUse === true,
        "GCEMBLEM é item de captura (pocket 3), bônus 12 e não se gasta");
    eq(ctx.MON.Items.ballBonus("GCEMBLEM"), 12, "ballBonus lê o catchBonus do Relógio");
    eq(ctx.MON.Items.isConsumedOnThrow("GCEMBLEM"), false, "o Relógio sobrevive ao arremesso");

    // mesma cadeia da cena de batalha: monBalls() -> itemWorksOn -> lista de captura
    const bambi = new G("BAMBI", 45);
    const captureList = () => party.monBalls().filter(b => F.itemWorksOn(b.name, bambi)).map(b => b.name);
    eq(captureList().length, 0, "sem o Relógio não há item de captura para o eco");
    party.monGainItem("POKEBALL", 5);
    eq(captureList().length, 0, "Poké Ball comum não entra na lista de um eco");
    ok(P.giveEmblemItem() && captureList().includes("GCEMBLEM"),
        "com o Relógio na mochila ele aparece na lista de captura da batalha");
    eq(P.giveEmblemItem(), false, "o Relógio é único: não duplica na mochila");

    //=========================================================================
    // Selo de Raiz e gate do pacto
    //=========================================================================
    const denied = P.canPact(bambi);
    ok(denied.ok === false && denied.reason.includes("Selo de Raiz"),
        "sem o Selo o pacto é negado com o texto temático");
    ok(denied.reason.includes("Secandas"), "a recusa nomeia o mundo do eco");
    eq(F.captureRule(bambi, "GCEMBLEM").allowed, false, "captureRule nega o pacto sem o Selo");

    P.giveMark("GC_03");
    eq(P.canPact(bambi).ok, false, "Selo de outro mundo não serve");
    P.giveMark("GC_02");
    eq(P.canPact(bambi).ok, true, "com o Selo do mundo certo o pacto é permitido");
    eq(F.captureRule(bambi, "GCEMBLEM").allowed, true, "captureRule libera o pacto com o Selo");
    P.giveMark("GC_99");
    eq(P.markCount(), 2, "markCount ignora Selo inexistente");

    // ser reconhecido num mundo concede as DUAS coisas de uma vez
    party = newSave();
    const reward = P.recognizeInWorld("GC_08");
    ok(reward.mark && reward.emblem && P.hasMark("GC_08") && P.hasEmblemItem(),
        "o reconhecimento dá o Selo do mundo e o Relógio GC");
    ok(P.recognizeInWorld("GC_04").emblem === false && P.hasMark("GC_04"),
        "o segundo mundo dá só o Selo — o Relógio já está na mochila");

    //=========================================================================
    // Jibaku é herdado, não colecionado (bíblia 1.2 e 8)
    //=========================================================================
    const jibac = new G("JIBAC", 45);
    ok(P.isJibaku(jibac) && !P.isEcho(jibac), "JIBAC é o Espírito único, não um eco");
    for (const m of P.MARKS) P.giveMark(m);
    const jibacRule = P.canPact(jibac);
    ok(jibacRule.ok === false && jibacRule.reason.includes("herda"),
        "nem com os doze Selos o Espírito único aceita ser capturado");
    eq(F.captureRule(jibac, "GCEMBLEM").allowed, false, "captureRule barra Jibaku sempre");
    eq(P.markCount(), 12, "os doze Selos podem ser reunidos mesmo sem eco em Primas");

    //=========================================================================
    // Encrenqueiro: não se captura, se cura
    //=========================================================================
    const trouble = new G("TRBGREYMON", 44);
    ok(P.isTroublemonster(trouble) && !P.isEcho(trouble), "TRBGREYMON é estado corrompido, não eco");
    const trbRule = F.captureRule(trouble, "GCEMBLEM");
    ok(trbRule.allowed === false && trbRule.reason.includes("cura"),
        "o Relógio não captura Encrenqueiro nem com todos os Selos: ele cura");
    ok(trouble.species().catchRate > 0,
        "catchRate do Encrenqueiro não é 0 (0 cairia no fallback 45 de tryCapture)");

    const plan = P.canPurify(trouble);
    ok(plan.ok && plan.into === "GREYMON", "canPurify aponta a criatura que está por baixo da toxina");
    const beforeLevel = trouble.level;
    ok(P.purify(trouble), "purify retira a toxina");
    eq(trouble.species().internalName, "GREYMON", "curado, ele volta a ser a criatura original");
    eq(trouble.level, beforeLevel, "a cura não mexe no nível: é o mesmo indivíduo");
    ok(!P.isTroublemonster(trouble) && F.captureRule(trouble, "DIGILINK").allowed === true,
        "curado, ele volta a seguir as regras da própria franquia");
    eq(P.canPurify(trouble).ok, false, "quem já está curado não tem toxina para retirar");
    eq(P.purify(new G("BAMBI", 45)), false, "purify não age sobre quem nunca foi Encrenqueiro");
    ok(troubles.every(sp => C.speciesByInternal(sp.corruptedFrom)),
        "todo Encrenqueiro tem caminho de volta: a cura nunca fica sem destino");

    //=========================================================================
    // Dragac dorme sob o gelo de Doidicus até os outros pactos estarem firmados
    //=========================================================================
    party = newSave();
    P.giveMark("GC_12");
    const dragac = new G("DRAGAC", 50);
    const asleep = P.canPact(dragac);
    ok(asleep.ok === false && asleep.reason.includes("adormecido"),
        "Dragac recusa o pacto enquanto faltam os outros dez");
    for (let id = 901; id <= 910; id++) ctx.$gameSystem.monSetCaught(id);
    eq(P.pactCount(), 10, "dez pactos firmados nos outros mundos");
    eq(P.canPact(dragac).ok, true, "com os dez pactos e o Selo de Doidicus, Dragac desperta");
    ctx.$gameSystem.monSetCaught(900);
    eq(P.pactCount(), 10, "Jibaku no time não conta como pacto: ele foi herdado");

    //=========================================================================
    // Economia do pacto: preparo (enfraquecer + status) tem de valer mais que repetir
    //=========================================================================
    const rate = (internal, level, hp, status) => {
        const mon = new G(internal, level);
        mon.hp = hp === "full" ? mon.maxHp : hp;
        mon.status = status;
        let hits = 0;
        const n = 20000;
        for (let i = 0; i < n; i++) if (B.tryCapture(mon, 12, 1).success) hits++;
        return hits / n;
    };
    const intact = rate("BAMBI", 45, "full", null);
    const weak = rate("BAMBI", 45, 1, null);
    const para = rate("BAMBI", 45, 1, "PAR");
    const sleep = rate("BAMBI", 45, 1, "SLP");

    ok(intact > 0.05 && intact < 0.11, `eco intacto: ~8% por arremesso (${(intact * 100).toFixed(1)}%)`);
    ok(weak > 0.19 && weak < 0.28, `eco a 1 de HP: ~23% por arremesso (${(weak * 100).toFixed(1)}%)`);
    ok(para > 0.30 && para < 0.40, `1 de HP + paralisia: ~35% por arremesso (${(para * 100).toFixed(1)}%)`);
    ok(sleep > 0.42 && sleep < 0.52, `1 de HP + sono: ~47% por arremesso (${(sleep * 100).toFixed(1)}%)`);
    ok(1 / sleep < 2.5 && 1 / intact > 9,
        "preparado o pacto sai em ~2 arremessos; despreparado passa de 9");
    ok(rate("DRAGAC", 50, 1, "SLP") < sleep,
        "Dragac (catchRate 3) continua o pacto mais duro dos onze");

    // o bônus de status é exclusivo do pacto: as outras franquias seguem intactas
    const caterpie = new G("CATERPIE", 5);
    caterpie.hp = 1;
    caterpie.status = "SLP";
    eq(P.statusBonus(caterpie), 2, "a tabela de bônus por status existe e vale 2 no sono");
    ok(!P.isEcho(caterpie), "Caterpie não é eco: tryCapture segue sem bônus extra");

    //=========================================================================
    // O gate é exclusivo dos Doze Mundos
    //=========================================================================
    const mock = (id, name) => ({ speciesId: id, name, species: () => null, hpRate: () => 1 });
    eq(F.captureRule(mock(25, "Pikachu"), "POKEBALL").allowed, true, "gate não afeta Pokémon");
    eq(F.captureRule(mock(650, "Agumon"), "DIGILINK").allowed, true, "gate não afeta Digimon");

    const state = P.echoes().find(e => e.pactMark === "GC_02");
    ok(state && state.pacted && !state.hasMark,
        "echoes(): reporta pacto firmado e Selo ainda ausente de forma independente");
    ok(P.echoes().length === 11 && P.echoes().every(e => !!e.world),
        "echoes() lista só os onze ecos, sem Jibaku e sem os Encrenqueiros");
};
