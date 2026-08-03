// Suíte da dimensão Medabots: Medapeças em 4 slots, loadout padrão por modelo,
// bônus de stat escalado pelo nível, golpes somados à Medalha e drop pós-vitória.
// Determinística — sorteio do drop com rng fixo, IVs/natureza normalizados.
const fs = require("fs");
const path = require("path");

module.exports = function({ ctx, ok, eq, G, section }) {
    section("Medabots — Medapeças (11)");

    // o harness não pré-carrega Parts.json; o plugin indexa o global sob demanda
    ctx.$dataParts = JSON.parse(
        fs.readFileSync(path.resolve(__dirname, "../../data/Parts.json"), "utf8")
    );

    const P = ctx.MON.Parts;
    const KEYS = ["hp", "atk", "def", "spe", "spa", "spd"];
    const previousParty = ctx.$gameParty;
    const party = new ctx.Game_Party();
    party.initialize();
    ctx.$gameParty = party;

    // mesmo corte de medida do relatório: IV 16, EV 0, natureza neutra (Hardy)
    function fair(species, level) {
        const p = new G(species, level);
        p._nature = 0;
        for (const k of KEYS) { p._ivs[k] = 16; p._evs[k] = 0; }
        return p;
    }
    const statSum = (p) => KEYS.reduce((s, k) => s + p.stat(k), 0);
    const strip = (p) => { for (const slot of P.SLOTS) P.unequip(p, slot); return p; };

    // replica o ramo de aprendizado de MON_Battle.processNextLearn
    function battleLearn(monster, learnable) {
        const announced = [], forgetPrompts = [];
        for (const moveId of learnable) {
            if (monster.knowsMove(moveId)) continue;
            if (monster.moves.length < 4) { monster.learnMove(moveId); announced.push(moveId); }
            else forgetPrompts.push(moveId);
        }
        return { announced, forgetPrompts };
    }

    // --- catálogo -----------------------------------------------------------
    eq(P.all().length, 40, "catálogo tem 40 Medapeças (10 modelos × 4 slots)");
    ok(P.all().every(p => !p.move || !!ctx.MON.Core.move(p.move)), "todo golpe de peça existe no banco de golpes");
    const legs = P.bySlot("legs");
    ok(legs.length === 10 && legs.every(p => !p.move && p.stats.spe > 0), "as 10 pernas dão velocidade e nenhum golpe");

    // --- loadout padrão: o inimigo nasce montado (defeito 2) -----------------
    // caminho real de MON_Encounters.startWild: new Game_Monster(species, level)
    const wild = new G("ROKUSHO", 28);
    const wildIds = P.equipped(wild);
    ok(P.SLOTS.every(slot => !!wildIds[slot]), "Medabot selvagem nasce com os 4 slots montados");
    ok(P.SLOTS.every(slot => P.get(wildIds[slot]).model === "ROKUSHO"),
        "o loadout padrão são as peças do próprio modelo");
    eq(P.defaultLoadout(wild).head, "MB_HEAD_ROKUSHO", "defaultLoadout é puro e devolve as peças do modelo");
    ok(P.equipped(new G("PIKACHU", 28)).head === null && !new G("PIKACHU", 28)._monParts,
        "monstro de outra franquia não ganha loadout nem estado de slots");
    ok(wild.hp === wild.maxHp, "o HP nasce cheio já contando o bônus das peças");

    // caminho real de MON_Trainers.build (inclui setMoves com golpes fixos)
    const built = ctx.MON.Trainers.build({
        type: "YOUNGSTER", name: "Ikki",
        party: [{ species: "ROKUSHO", level: 30, moves: ["ICYWIND", "MEDABLADE"] }]
    });
    const foe = built.party[0];
    ok(P.SLOTS.every(slot => !!P.equipped(foe)[slot]), "Medabot de treinador também nasce montado");
    ok(foe.knowsMove("ICYWIND") && foe.knowsMove("MEDABLADE"),
        "golpes fixos do treinador sobrevivem ao loadout");
    ok(foe.knowsMove("FROSTSABER") && P.grantedMoves(foe).includes("FROSTSABER"),
        "as peças recompõem os golpes que setMoves apagou");

    // --- drop pós-vitória pelo caminho real (defeito 2) ----------------------
    const winner = new G("METABEE", 30);
    const drops = ctx.MON.Battle.runVictoryHooks(winner, wild, false);
    eq(drops.length, 1, "vencer um Medabot selvagem dropa 1 peça pelo hook de vitória");
    const stock = party.monParts();
    ok(stock.length === 1 && P.SLOTS.some(slot => wildIds[slot] === stock[0].id),
        "a peça que entrou no estoque veio do loadout do derrotado");
    eq(ctx.MON.Battle.runVictoryHooks(winner, new G("PIKACHU", 30), false).length, 0,
        "vitória contra Pokémon não gera drop");
    eq(P.rollDrop(strip(new G("PEPPERCAT", 20)), () => 0), null, "Medabot desmontado não dropa peça");
    const peppercat = new G("PEPPERCAT", 20);
    ok(P.rollDrop(peppercat, () => 0) === "MB_HEAD_PEPPERCAT" && P.rollDrop(peppercat, () => 3) === "MB_LEGS_PEPPERCAT",
        "sorteio determinístico percorre os slots ocupados na ordem head→legs");
    ok(party.monLosePart(stock[0].id, 2) === false && party.monPartCount(stock[0].id) === 1,
        "o estoque nunca fica negativo");

    // --- equipar / desequipar ------------------------------------------------
    const bee = new G("METABEE", 50);
    eq(P.equip(bee, "MB_RARM_METABEE").ok, false, "remontar a peça que já está no slot é rejeitado");
    const atkBare = (P.unequip(bee, "rArm"), bee.stat("atk"));
    ok(P.equip(bee, "MB_RARM_METABEE").ok && bee.stat("atk") === atkBare + 14,
        "Revolver soma +14 de Ataque no nível 50");
    eq(P.equip(bee, "MB_RARM_ROKUSHO").replaced, "MB_RARM_METABEE", "troca no mesmo slot reporta a substituída");
    eq(P.equip(bee, "MB_HEAD_INEXISTENTE").ok, false, "peça de modelo inexistente é rejeitada");
    eq(P.unequip(bee, "tail"), null, "slot inválido é rejeitado");
    eq(P.equip(new G("PIKACHU", 50), "MB_HEAD_METABEE").ok, false, "franquia errada não aceita Medapeça");

    // --- golpes: a peça tem prioridade; o deslocado vai para a bancada --------
    const rookie = new G("METABEE", 5);
    const partMoves = P.partMoves(rookie);
    ok(partMoves.length === 3 && partMoves.every(id => rookie.knowsMove(id)),
        "todo golpe de peça entra no repertório, mesmo com a lista cheia");
    eq(rookie.moves.length, 4, "o total respeita o teto de 4 golpes do motor");
    ok(P.benchedMoves(rookie).length > 0,
        "o golpe de nível deslocado pela peça fica na bancada, não é perdido");

    // o defeito era este: na faixa de nível de D3 nenhum Medabot tinha golpe de peça
    for (const level of [5, 20, 28, 40]) {
        const bot = new G("METABEE", level);
        ok(P.partMoves(bot).every(id => bot.knowsMove(id)),
            `Metabee nv${level} entra em batalha com os golpes das Medapeças`);
    }

    const scout = new G("KROSSERDOG", 5);
    ok(scout.knowsMove("SCOPESHOT") && P.unequip(scout, "head") === "MB_HEAD_KROSSERDOG"
        && !scout.knowsMove("SCOPESHOT"),
        "desmontar a peça leva junto o golpe que ela deu");
    ok(P.benchedMoves(scout).length === 0 && scout.moves.length > 0,
        "desmontar devolve à Medalha o golpe que estava na bancada");

    // golpe que a curva de nível da Medalha já ensinaria não some ao desmontar
    const veteran = new G("KROSSERDOG", 30);
    ok(veteran.knowsMove("SCOPESHOT"), "Krosserdog nv30 conhece SCOPESHOT (peça + curva)");
    P.unequip(veteran, "head");
    ok(veteran.knowsMove("SCOPESHOT"),
        "golpe já conquistado por nível permanece após desmontar a peça que o dava");

    // --- monster.moves é a lista real, estável e mutável (defeito 1c) --------
    const mutable = new G("METABEE", 24);
    ok(mutable.moves === mutable.moves, "monster.moves devolve sempre a mesma lista");
    const beforePop = mutable.moves.length;
    mutable.moves.pop();
    eq(mutable.moves.length, beforePop - 1, "mutação in-place em monster.moves tem efeito");

    // --- aprender por nível volta a funcionar e a mensagem não mente ---------
    const learned = battleLearn(mutable, ["TACKLE"]);
    ok(learned.announced.length === 1 && mutable.knowsMove("TACKLE"),
        "com slot livre o Medabot anuncia e APRENDE o golpe de nível");

    // repro do relatório: Metabee montado nv24 -> 45
    const grower = new G("METABEE", 24);
    const gained = grower.addExp(grower.expForLevel(45) - grower.exp);
    const learnable = gained.levels.reduce((a, lv) => a.concat(lv.learnable), []);
    ok(learnable.length > 0, "subir de 24 a 45 oferece golpes novos");
    const flow = battleLearn(grower, learnable);
    ok(flow.announced.every(id => grower.knowsMove(id)),
        "todo golpe anunciado como aprendido está mesmo na lista");
    ok(flow.forgetPrompts.length > 0,
        "com 4 golpes ocupados a janela de esquecer é alcançada");
    ok(grower.moves.length === 4 && P.SLOTS.every(slot => !!P.equipped(grower)[slot]),
        "o Medabot continua montado depois de todo o fluxo de nível");

    // --- bônus de peça escala com o nível (defeito 3) ------------------------
    eq(P.rawStatBonus(bee, "atk"), 8 + 16 + 10, "rawStatBonus é a soma crua do catálogo");
    const scale25 = new G("METABEE", 25), scale50 = new G("METABEE", 50), scale100 = new G("METABEE", 100);
    eq(P.rawStatBonus(scale25, "atk"), P.rawStatBonus(scale100, "atk"), "a soma crua não depende do nível");
    ok(P.statBonus(scale25, "atk") === 16 && P.statBonus(scale50, "atk") === 32
        && P.statBonus(scale100, "atk") === 64,
        "a peça vale ponto de stat BASE: bônus dobra do nv25 ao nv50 e de novo ao nv100");
    const heavy = new G("BELZELGA", 40);
    ok(P.statBonus(heavy, "spe") < 0 && heavy.stat("spe") >= 1,
        "bônus negativo é aplicado sem derrubar o stat abaixo de 1");

    // --- Medabots são competitivos na dimensão 3 (defeito 3) ----------------
    for (const sp of ctx.MON.Franchise.speciesOf("MDB")) {
        const bst = KEYS.reduce((s, k) => s + sp.stats[k], 0);
        ok(bst >= 380 && bst <= 420, `BST de ${sp.name} na faixa 380-420 (${bst})`);
    }
    const bee30 = statSum(fair("METABEE", 30)), grey30 = statSum(fair("GREYMON", 30));
    const bee40 = statSum(fair("METABEE", 40)), grey40 = statSum(fair("GREYMON", 40));
    ok(bee30 > grey30, `Metabee montado nv30 supera Greymon nv30 (${bee30} > ${grey30})`);
    ok(bee40 > grey40, `Metabee montado nv40 supera Greymon nv40 (${bee40} > ${grey40})`);
    ok(bee40 / grey40 >= bee30 / grey30,
        "a vantagem não decai com o nível (bônus plano decaía de 0.94 para 0.86)");
    const metal34 = statSum(fair("METALGREYMON", 34));
    ok(statSum(fair("METABEE", 34)) < metal34,
        "Ultimate de D2 continua acima do Medabot montado no mesmo nível");
    ok(statSum(fair("METABEE", 30)) > statSum(strip(fair("METABEE", 30))),
        "Medalha nua é mais fraca que a montada — as peças ainda são o sistema");

    ctx.$gameParty = previousParty;
};
