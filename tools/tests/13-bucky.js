// Suíte da dimensão Bucky: emblemas de Grande Criança, gate de pacto e golpes Jibaku.
module.exports = function({ ctx, ok, eq, G, section }) {
    section("Bucky — Emblemas de G.C. e Pactos (BKY)");

    const P = ctx.PKM.Pacts;
    const F = ctx.PKM.Franchise;
    const B = ctx.PKM.Battle;

    // save limpo: nenhum emblema, nenhum pacto
    ctx.$gameSystem = new ctx.Game_System();

    const list = F.speciesOf("BKY");
    ok(list.length === 12 && list.every(sp => sp.id >= 780 && sp.id <= 791),
        "12 espíritos nos ids 780-791");
    const badges = list.map(sp => sp.pactBadge);
    ok(new Set(badges).size === 12 && badges.every(b => P.isEmblem(b)),
        "cada espírito tem um pactBadge GC_xx único");
    ok(list.every(sp => sp.catchRate === 3 && sp.growthRate === "Slow" && (sp.evolutions || []).length === 0)
        && new Set(list.map(sp => sp.type1)).size === 12,
        "lendários: catchRate 3, curva Slow, sem evolução e 12 tipos distintos");
    ok(["JIBAC", "BAMBI"].every(n => list.some(sp => sp.internalName === n)),
        "Jibac e Bambi (canônicos) estão entre os doze");
    ok(list.every(sp => (sp.levelMoves || []).some(lm => lm.move === "JIBAKU")),
        "todo espírito aprende JIBAKU por nível");

    // golpes assinatura fundidos no banco e registrados no motor
    ok(ctx.PKM.Core.move("JIBAKU") && ctx.PKM.Core.move("JIBAKU").power >= 200
        && B.MOVE_EFFECTS.JIBAKU.selfKO === true,
        "JIBAKU existe com poder altíssimo e está registrado como selfKO");
    eq(B.MOVE_EFFECTS.JIBAKUMINOR.recoil, 0.33, "JIBAKUMINOR registrado com recuo 0.33");

    const jibac = new G("JIBAC", 70);
    B.applySelfEffect(jibac, B.MOVE_EFFECTS.JIBAKU, 300);
    ok(jibac.isFainted(), "JIBAKU derruba o próprio espírito");

    // gate de pacto
    const spirit = new G("JIBAC", 70);
    const denied = P.canPact(spirit);
    ok(denied.ok === false && denied.reason.includes("Emblema"),
        "sem emblema o pacto é negado com o texto temático");
    eq(F.captureRule(spirit, "GCEMBLEM").allowed, false, "captureRule nega o pacto sem emblema");

    P.giveEmblem("GC_02");
    eq(P.canPact(spirit).ok, false, "emblema de outro mundo não serve");

    P.giveEmblem("GC_01");
    eq(P.canPact(spirit).ok, true, "com o emblema do mundo certo o pacto é permitido");
    eq(F.captureRule(spirit, "GCEMBLEM").allowed, true, "captureRule libera o pacto com emblema");

    P.giveEmblem("GC_99");
    eq(P.emblemCount(), 2, "emblemCount ignora emblema inexistente");

    // o gate é exclusivo de Bucky
    const mock = (id, name) => ({ speciesId: id, name, species: () => null, hpRate: () => 1 });
    eq(F.captureRule(mock(25, "Pikachu"), "POKEBALL").allowed, true, "gate não afeta Pokémon");
    eq(F.captureRule(mock(650, "Agumon"), "DIGILINK").allowed, true, "gate não afeta Digimon");

    const state = P.spirits().find(s => s.pactBadge === "GC_01");
    ok(state.hasEmblem && !state.pacted, "spirits(): emblema obtido, pacto ainda não firmado");
    ctx.$gameSystem.pkmSetCaught(state.id);
    eq(P.pactCount(), 1, "spirits(): pacto firmado entra na contagem do endgame");
};
