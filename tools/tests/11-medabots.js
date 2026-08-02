// Suíte da dimensão Medabots: Medapeças em 4 slots, bônus de stat, golpes das
// peças e drop pós-vitória. Determinística — o sorteio do drop recebe rng fixo.
const fs = require("fs");
const path = require("path");

module.exports = function({ ctx, ok, eq, G, section }) {
    section("Medabots — Medapeças (11)");

    // o harness não pré-carrega Parts.json; o plugin indexa o global sob demanda
    ctx.$dataParts = JSON.parse(
        fs.readFileSync(path.resolve(__dirname, "../../data/Parts.json"), "utf8")
    );

    const P = ctx.PKM.Parts;
    const legs = P.bySlot("legs");
    const previousParty = ctx.$gameParty;
    const party = new ctx.Game_Party();
    party.initialize();
    ctx.$gameParty = party;

    // --- catálogo -----------------------------------------------------------
    eq(P.all().length, 40, "catálogo tem 40 Medapeças (10 modelos × 4 slots)");
    ok(P.all().every(p => !p.move || !!ctx.PKM.Core.move(p.move)), "todo golpe de peça existe no banco de golpes");
    ok(legs.length === 10 && legs.every(p => !p.move && p.stats.spe > 0), "as 10 pernas dão velocidade e nenhum golpe");

    // --- equipar / desequipar ----------------------------------------------
    const bee = new G("METABEE", 50);
    const atkBefore = bee.stat("atk");
    const mounted = P.equip(bee, "MB_RARM_METABEE");
    ok(mounted.ok && mounted.replaced === null && P.equipped(bee).rArm === "MB_RARM_METABEE",
        "monta o Revolver no slot rArm");
    eq(bee.stat("atk"), atkBefore + 14, "Revolver soma +14 de Ataque");
    ok(P.unequip(bee, "rArm") === "MB_RARM_METABEE" && bee.stat("atk") === atkBefore,
        "desmontar devolve a peça e o Ataque volta ao original");
    P.equip(bee, "MB_RARM_METABEE");
    eq(P.equip(bee, "MB_RARM_ROKUSHO").replaced, "MB_RARM_METABEE", "troca no mesmo slot reporta a substituída");

    // --- rejeições ----------------------------------------------------------
    eq(P.equip(bee, "MB_HEAD_INEXISTENTE").ok, false, "peça de modelo inexistente é rejeitada");
    eq(P.unequip(bee, "tail"), null, "slot inválido é rejeitado");
    const pika = new G("PIKACHU", 50);
    ok(P.equip(pika, "MB_HEAD_METABEE").ok === false && P.equipped(pika).head === null,
        "franquia errada não aceita Medapeça nem ganha estado de slots");

    // --- golpes das peças ---------------------------------------------------
    const scout = new G("METABEE", 30);
    const ownMoves = scout.moves.length;
    P.equip(scout, "MB_LEGS_KROSSERDOG");
    ok(ownMoves > 0 && scout.moves.length === ownMoves, "peça sem golpe mantém os golpes próprios como fallback");
    P.equip(scout, "MB_HEAD_METABEE");
    P.equip(scout, "MB_RARM_ROKUSHO");
    ok(scout.moves.length === 2 && scout.moves.some(m => m.id === "SEEKERMISSILE")
        && scout.moves.some(m => m.id === "MEDABLADE"),
        "golpes da cabeça e do braço substituem a lista lida pela batalha");

    // --- piso do stat -------------------------------------------------------
    const heavy = new G("BELZELGA", 1);
    P.equip(heavy, "MB_LARM_BELZELGA");
    eq(heavy.stat("spe"), 1, "Bulk Shield (-6 spe) não derruba o stat abaixo de 1");

    // --- drop pós-vitória ---------------------------------------------------
    const foe = new G("PEPPERCAT", 20);
    P.equip(foe, "MB_HEAD_PEPPERCAT");
    P.equip(foe, "MB_LEGS_PEPPERCAT");
    ok(P.rollDrop(foe, () => 0) === "MB_HEAD_PEPPERCAT" && P.rollDrop(foe, () => 1) === "MB_LEGS_PEPPERCAT",
        "sorteio determinístico percorre só os slots ocupados");
    ok(P.rollDrop(new G("PEPPERCAT", 20), () => 0) === null && P.rollDrop(pika, () => 0) === null,
        "Medabot desmontado e monstro de outra franquia nunca dropam peça");
    eq(P.victoryDrop(bee, pika, () => 0).length, 0, "vitória contra Pokémon não gera drop");
    ok(P.victoryDrop(bee, foe, () => 0).length === 1
        && party.pkmPartCount("MB_HEAD_PEPPERCAT") === 1
        && party.pkmLosePart("MB_HEAD_PEPPERCAT", 2) === false,
        "drop entra no estoque do jogador e o estoque nunca fica negativo");

    ctx.$gameParty = previousParty;
};
