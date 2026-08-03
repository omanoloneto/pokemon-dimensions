// Suíte da dimensão Bucky: Marca de G.C. x Emblema G.C., gate de pacto, economia
// do arremesso, curva dos golpes Jibaku e bloqueio dos Troublemonsters.
module.exports = function({ ctx, ok, eq, G, section }) {
    section("Bucky — Pactos, Emblema e Troublemonsters (BKY)");

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
    const spirits = all.filter(sp => sp.pactMark);
    const troubles = all.filter(sp => sp.troublemonster);

    //=========================================================================
    // Espécies
    //=========================================================================
    ok(spirits.length === 12 && spirits.every(sp => sp.id >= 900 && sp.id <= 911),
        "12 espíritos nos ids 900-911");
    ok(troubles.length === 8 && troubles.every(sp => sp.id >= 912 && sp.id <= 919),
        "8 Troublemonsters nos ids 912-919");
    const marks = spirits.map(sp => sp.pactMark);
    ok(new Set(marks).size === 12 && marks.every(m => P.isMark(m)),
        "cada espírito tem uma pactMark GC_xx única");
    ok(spirits.every(sp => sp.growthRate === "Slow" && (sp.evolutions || []).length === 0)
        && new Set(spirits.map(sp => sp.type1)).size === 12,
        "lendários: curva Slow, sem evolução e 12 tipos distintos");
    ok(["JIBAC", "BAMBI"].every(n => spirits.some(sp => sp.internalName === n)),
        "Jibac e Bambi (canônicos) estão entre os doze");

    // Troublemonsters = espécies existentes com palette swap corrompido + boost
    ok(troubles.every(sp => {
        const src = C.speciesByInternal(sp.corruptedFrom);
        if (!src) return false;
        const bst = (s) => Object.values(s.stats).reduce((a, b) => a + b, 0);
        return bst(sp) > bst(src) && sp.type1 === src.type1 && sp.type2 && sp.type2 !== src.type2;
    }), "todo Troublemonster deriva de uma espécie real, mantém o tipo 1 e sobe o BST");
    ok(new Set(troubles.map(sp => F.ofSpecies(C.speciesByInternal(sp.corruptedFrom).id).id)).size >= 3,
        "a fauna corrompida reusa espécies de pelo menos 3 franquias");
    ok(troubles.every(sp => Object.values(sp.stats).reduce((a, b) => a + b, 0)
        < Math.min(...spirits.map(s => Object.values(s.stats).reduce((a, b) => a + b, 0)))),
        "nenhum Troublemonster chega ao BST do espírito mais fraco");
    ok(troubles.every(sp => (sp.levelMoves || []).every(lm => lm.level <= D5_WILD_TOP)),
        "Troublemonster tem o kit completo dentro da faixa selvagem de D5");

    //=========================================================================
    // Curva dos golpes Jibaku (tem de caber na campanha, que acaba em 52-55)
    //=========================================================================
    const levelOf = (sp, move) => ((sp.levelMoves || []).find(lm => lm.move === move) || {}).level;
    ok(spirits.every(sp => levelOf(sp, "JIBAKU") <= CAMPAIGN_TOP),
        "todo espírito alcança JIBAKU dentro da campanha");
    ok(spirits.every(sp => levelOf(sp, "JIBAKUSEAL") <= D5_WILD_TOP),
        "JIBAKUSEAL já está disponível na faixa de D5");

    // espírito selvagem com selfKO/recuo pesado se derrubaria sozinho: pacto impossível
    const selfHarm = (move) => {
        const eff = B.MOVE_EFFECTS[move];
        return !!eff && (eff.selfKO === true || (eff.recoil || 0) >= 0.5);
    };
    ok(spirits.every(sp => (sp.levelMoves || [])
        .every(lm => !selfHarm(lm.move) || lm.level > D5_WILD_TOP)),
        "nenhum golpe auto-destrutivo é aprendido dentro da faixa selvagem de D5");

    const wild45 = new G("JIBAC", 45);
    ok(!wild45.moves.some(m => selfHarm(m.id)),
        "o espírito encontrado em D5 (nv 45) não tem como se derrubar sozinho");
    const grown = new G("JIBAC", 50);
    ok(grown.knowsMove("JIBAKU"), "aos 50 o espírito já usa o golpe assinatura");

    // motor: os efeitos continuam registrados
    ok(C.move("JIBAKU") && C.move("JIBAKU").power >= 200 && B.MOVE_EFFECTS.JIBAKU.selfKO === true,
        "JIBAKU existe com poder altíssimo e está registrado como selfKO");
    eq(B.MOVE_EFFECTS.JIBAKUMINOR.recoil, 0.33, "JIBAKUMINOR registrado com recuo 0.33");
    const bomber = new G("JIBAC", 50);
    B.applySelfEffect(bomber, B.MOVE_EFFECTS.JIBAKU, 300);
    ok(bomber.isFainted(), "JIBAKU derruba o próprio espírito");

    //=========================================================================
    // Emblema G.C.: o ITEM que fecha o fluxo de captura na batalha
    //=========================================================================
    const emblem = C.item("GCEMBLEM");
    ok(emblem && emblem.pocket === 3 && emblem.catchBonus === 12 && emblem.keepOnUse === true,
        "GCEMBLEM é item de captura (pocket 3), bônus 12 e não se gasta");
    eq(ctx.MON.Items.ballBonus("GCEMBLEM"), 12, "ballBonus lê o catchBonus do emblema");
    eq(ctx.MON.Items.isConsumedOnThrow("GCEMBLEM"), false, "o emblema sobrevive ao arremesso");

    // mesma cadeia da cena de batalha: monBalls() -> itemWorksOn -> lista de captura
    const jibac = new G("JIBAC", 45);
    const captureList = () => party.monBalls().filter(b => F.itemWorksOn(b.name, jibac)).map(b => b.name);
    eq(captureList().length, 0, "sem o emblema não há item de captura para o espírito");
    party.monGainItem("POKEBALL", 5);
    eq(captureList().length, 0, "Poké Ball comum não entra na lista de um espírito");
    ok(P.giveEmblemItem() && captureList().includes("GCEMBLEM"),
        "com o emblema na mochila ele aparece na lista de captura da batalha");
    eq(P.giveEmblemItem(), false, "o emblema é único: não duplica na mochila");

    //=========================================================================
    // Marca de G.C. (insígnia) e gate do pacto
    //=========================================================================
    const denied = P.canPact(jibac);
    ok(denied.ok === false && denied.reason.includes("Marca"),
        "sem a Marca o pacto é negado com o texto temático");
    eq(F.captureRule(jibac, "GCEMBLEM").allowed, false, "captureRule nega o pacto sem a Marca");

    P.giveMark("GC_02");
    eq(P.canPact(jibac).ok, false, "Marca de outro mundo não serve");
    P.giveMark("GC_01");
    eq(P.canPact(jibac).ok, true, "com a Marca do mundo certo o pacto é permitido");
    eq(F.captureRule(jibac, "GCEMBLEM").allowed, true, "captureRule libera o pacto com a Marca");
    P.giveMark("GC_99");
    eq(P.markCount(), 2, "markCount ignora Marca inexistente");

    // derrotar a Grande Criança concede as DUAS coisas de uma vez
    party = newSave();
    const reward = P.defeatGreatChild("GC_03");
    ok(reward.mark && reward.emblem && P.hasMark("GC_03") && P.hasEmblemItem(),
        "derrotar a Grande Criança dá a Marca do mundo e o item Emblema");
    ok(P.defeatGreatChild("GC_04").emblem === false && P.hasMark("GC_04"),
        "a segunda Grande Criança dá só a Marca — o emblema já está na mochila");

    //=========================================================================
    // Troublemonsters: combate-se, não se coleciona
    //=========================================================================
    const trouble = new G("TRBGREYMON", 44);
    ok(P.isTroublemonster(trouble) && !P.isSpirit(trouble), "TRBGREYMON é fauna, não espírito");
    const trbRule = F.captureRule(trouble, "GCEMBLEM");
    ok(trbRule.allowed === false && trbRule.reason.includes("Troublemonster"),
        "o emblema não captura Troublemonster nem com todas as Marcas");
    ok(trouble.species().catchRate > 0,
        "catchRate do Troublemonster não é 0 (0 cairia no fallback 45 de tryCapture)");

    //=========================================================================
    // Dragac só desperta com os outros onze pactos firmados (lore do Mundo Zero)
    //=========================================================================
    party = newSave();
    P.giveMark("GC_12");
    const dragac = new G("DRAGAC", 50);
    const asleep = P.canPact(dragac);
    ok(asleep.ok === false && asleep.reason.includes("adormecido"),
        "Dragac recusa o pacto enquanto faltam os outros onze");
    for (let id = 900; id <= 910; id++) ctx.$gameSystem.monSetCaught(id);
    eq(P.pactCount(), 11, "onze pactos firmados nos outros mundos");
    eq(P.canPact(dragac).ok, true, "com os onze pactos e a Marca do Mundo Zero, Dragac desperta");

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
    const intact = rate("JIBAC", 45, "full", null);
    const weak = rate("JIBAC", 45, 1, null);
    const para = rate("JIBAC", 45, 1, "PAR");
    const sleep = rate("JIBAC", 45, 1, "SLP");

    ok(intact > 0.05 && intact < 0.11, `espírito intacto: ~8% por arremesso (${(intact * 100).toFixed(1)}%)`);
    ok(weak > 0.19 && weak < 0.28, `espírito a 1 de HP: ~23% por arremesso (${(weak * 100).toFixed(1)}%)`);
    ok(para > 0.30 && para < 0.40, `1 de HP + paralisia: ~35% por arremesso (${(para * 100).toFixed(1)}%)`);
    ok(sleep > 0.42 && sleep < 0.52, `1 de HP + sono: ~47% por arremesso (${(sleep * 100).toFixed(1)}%)`);
    ok(1 / sleep < 2.5 && 1 / intact > 9,
        "preparado o pacto sai em ~2 arremessos; despreparado passa de 9");
    ok(rate("DRAGAC", 50, 1, "SLP") < sleep,
        "Dragac (catchRate 3) continua o pacto mais duro dos doze");

    // o bônus de status é exclusivo do pacto: as outras franquias seguem intactas
    const caterpie = new G("CATERPIE", 5);
    caterpie.hp = 1;
    caterpie.status = "SLP";
    eq(P.statusBonus(caterpie), 2, "a tabela de bônus por status existe e vale 2 no sono");
    ok(!P.isSpirit(caterpie), "Caterpie não é espírito: tryCapture segue sem bônus extra");

    //=========================================================================
    // O gate é exclusivo de Bucky
    //=========================================================================
    const mock = (id, name) => ({ speciesId: id, name, species: () => null, hpRate: () => 1 });
    eq(F.captureRule(mock(25, "Pikachu"), "POKEBALL").allowed, true, "gate não afeta Pokémon");
    eq(F.captureRule(mock(650, "Agumon"), "DIGILINK").allowed, true, "gate não afeta Digimon");

    const state = P.spirits().find(s => s.pactMark === "GC_01");
    ok(state && state.pacted && !state.hasMark,
        "spirits(): reporta pacto firmado e Marca ainda ausente de forma independente");
    ok(P.spirits().length === 12 && P.spirits().every(s => !!s.world),
        "spirits() lista só os doze mundos, sem os Troublemonsters");
};
