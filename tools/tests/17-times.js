// Times em batalha (até 3x3): encontros selvagens em grupo, treinador em campo
// como combatente e condição de fim pelo campo (PKM_Field).
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..", "..");

// o harness carrega só os plugins de lógica "clássicos"; os do campo em times
// podem faltar. Carrega sob demanda, sem duplicar o que já está no contexto.
function ensurePlugin(ctx, file, loaded) {
    if (loaded()) return true;
    const p = path.join(ROOT, "js/plugins", file);
    if (!fs.existsSync(p)) return false;
    vm.runInContext(fs.readFileSync(p, "utf8"), ctx, { filename: file });
    return loaded();
}

// classe humana de mentira: o banco HUM real é opcional aqui
function stubClass(id, internalName, name) {
    return {
        id, internalName, name, franchise: "HUM",
        type1: "NORMAL", type2: null,
        stats: { hp: 70, atk: 60, def: 60, spe: 70, spa: 60, spd: 60 },
        genderRate: "Genderless", growthRate: "Medium", baseExp: 100,
        evYield: { hp: 0, atk: 0, def: 0, spe: 0, spa: 0, spd: 0 },
        catchRate: 3, abilities: [], levelMoves: [{ level: 1, move: "TACKLE" }],
        height: 1.7, weight: 60, color: "Brown", habitat: "Urban",
        category: "Pessoa", entry: ""
    };
}

module.exports = function({ ctx, ok, eq, G, section }) {
    section("Times — encontros em grupo, treinador em campo e fim de batalha");

    const hasHuman = ensurePlugin(ctx, "PKM_Human.js", () => typeof ctx.Game_Human !== "undefined");
    const hasField = ensurePlugin(ctx, "PKM_Field.js", () => !!ctx.PKM.Field);
    const hasEnc = ensurePlugin(ctx, "PKM_Encounters.js", () => !!ctx.PKM.Encounters);
    ok(hasHuman, "PKM_Human carregado");
    ok(hasField, "PKM_Field carregado");
    ok(hasEnc, "PKM_Encounters carregado");
    if (!hasHuman || !hasField || !hasEnc) return;

    const E = ctx.PKM.Encounters;
    const T = ctx.PKM.Trainers;
    const F = ctx.PKM.Field;
    const MAP_ID = 3;                       // rota de grama densa (densidade 25)

    // estado global do jogo só para este bloco. O Math é o do contexto do vm —
    // é ele que os plugins usam para sortear.
    const vmMath = vm.runInContext("Math", ctx);
    const prevParty = ctx.$gameParty, prevTemp = ctx.$gameTemp, prevRandom = vmMath.random;
    const party = new ctx.Game_Party();
    party.initialize();
    party.pkmAdd(new G("PIKACHU", 10));
    party.pkmAdd(new G("BULBASAUR", 10));
    ctx.$gameParty = party;
    ctx.$gameTemp = {};

    // classes humanas de teste: só entram se o banco HUM real não trouxer a classe
    const injected = [];
    for (const [id, internal, name] of [
        [920, "TRAINER", "Treinador"], [925, "RIVAL", "Rival"], [926, "MARKLEADER", "Líder de Marco"]
    ]) {
        if (ctx.PKM.Core.speciesByInternal(internal)) continue;
        ctx.$dataPokemon[id] = stubClass(id, internal, name);
        injected.push(id);
    }

    try {
        //--- encontros selvagens ---------------------------------------------
        ok(Array.isArray(E.rollGroup(MAP_ID, "Land")), "rollGroup devolve array");

        let solo = 0, worst = 0;
        for (let i = 0; i < 200; i++) {
            const members = E.rollGroup(MAP_ID, "Land");
            if (members.length === 1) solo++;
            worst = Math.max(worst, members.length);
            if (members.length < 1 || members.length > 3) worst = 99;
            // acompanhante nunca passa do nível do líder
            if (members.some(m => m.level > members[0].level)) worst = 99;
        }
        ok(worst <= 3, `grupo fica entre 1 e 3 unidades (maior visto: ${worst})`);
        ok(solo > 150, `encontro solo é o caso comum (${solo}/200)`);

        // tamanho do grupo é determinístico com o sorteio travado
        vmMath.random = () => 0;
        eq(E.groupSize(MAP_ID), 3, "sorteio mínimo forma o grupo cheio (3)");
        vmMath.random = () => 0.99;
        eq(E.groupSize(MAP_ID), 1, "sorteio alto mantém o encontro solo");
        vmMath.random = prevRandom;

        eq(E.startWild("RATTATA", 5), true, "startWild inicia o encontro");
        ok(Array.isArray(ctx.$gameTemp.pkmFoes), "pkmFoes é array mesmo no solo");
        eq(ctx.$gameTemp.pkmFoes.length, 1, "encontro solo publica 1 unidade");
        eq(ctx.$gameTemp.pkmWild, ctx.$gameTemp.pkmFoes[0], "pkmWild é o primeiro de pkmFoes");

        E.startWildTeam([
            { species: "RATTATA", level: 5 }, { species: "PIDGEY", level: 4 },
            { species: "CATERPIE", level: 3 }, { species: "WEEDLE", level: 3 }
        ]);
        eq(ctx.$gameTemp.pkmFoes.length, 3, "time selvagem satura em 3 unidades");
        eq(ctx.$gameTemp.pkmWild, ctx.$gameTemp.pkmFoes[0], "pkmWild acompanha o time");
        ok(ctx.$gameTemp.pkmFoes.every(u => !u.isHuman()), "selvagem não leva humano ao campo");
        eq(ctx.$gameTemp.pkmTrainer, null, "encontro selvagem limpa o treinador");

        ok(E.rollAndStart(MAP_ID, "Land"), "rollAndStart sorteia e publica");
        const rolled = ctx.$gameTemp.pkmFoes;
        ok(rolled.length >= 1 && rolled.length <= 3, `sorteio publica de 1 a 3 (${rolled.length})`);

        //--- treinador em campo ----------------------------------------------
        const def = T.find("LEADER_Brock", "Brock");
        ok(!!def, "encontra LEADER_Brock");

        eq(T.humanClassFor({ type: "LEADER_Brock" }), "MARKLEADER", "LEADER_* vira MARKLEADER");
        eq(T.humanClassFor({ type: "RIVAL1" }), "RIVAL", "raiz com dígito resolve (RIVAL1 -> RIVAL)");
        eq(T.humanClassFor({ type: "FISHERMAN" }), "TRAINER", "tipo sem classe própria cai no padrão");
        eq(T.humanClassFor({ type: "LEADER_Brock", humanClass: "TRAINER" }), "TRAINER",
            "humanClass do dado tem prioridade");

        const built = T.build(def, { defeatText: "Impressionante!" });
        ok(!!built.human && built.human.isHuman(), "treinador construído tem humano");
        eq(built.team[0], built.human, "humano ocupa o slot 0 do time");
        eq(built.team.length, built.party.length + 1, "time = humano + monstros");
        eq(built.team[1], built.party[0], "monstros vêm depois do humano");
        eq(built.human.name, "Brock", "humano usa o nome da pessoa");
        eq(built.human.className, "Líder de Marco", "humano usa a classe mapeada");
        eq(built.party.length, 2, "party continua só com os monstros");
        eq(built.money, 1400, "prêmio em dinheiro preservado");
        eq(built.defeatText, "Impressionante!", "defeatText preservado");

        eq(T.start("LEADER_Brock", "Brock", { defeatText: "Impressionante!" }), true,
            "start publica a batalha de treinador");
        eq(ctx.$gameTemp.pkmFoes.length, 3, "time inimigo = humano + 2 monstros");
        ok(ctx.$gameTemp.pkmFoes[0].isHuman(), "slot 0 do inimigo é o humano");
        eq(ctx.$gameTemp.pkmWild, null, "batalha de treinador não deixa selvagem");

        //--- degradação sem classe humana no banco ---------------------------
        const realLookup = ctx.PKM.Core.speciesByInternal;
        ctx.PKM.Core.speciesByInternal = () => null;
        const bare = T.build(def);
        ctx.PKM.Core.speciesByInternal = realLookup;
        eq(bare.human, null, "sem classe humana, o treinador fica fora do campo");
        eq(bare.team.length, bare.party.length, "time cai para só os monstros");
        eq(bare.team[0], bare.party[0], "primeiro do time volta a ser um monstro");
        eq(bare.money, 1400, "prêmio segue intacto sem humano");

        //--- campo: começo, vitória e derrota --------------------------------
        const avatar = new ctx.Game_Human("TRAINER", 10, { name: "Manolo" });
        party.pkmSetAvatar(avatar);
        const allies = party.pkmBattleTeam();
        eq(allies.length, 3, "time do jogador = humano + 2 monstros");
        ok(allies[0].isHuman(), "avatar humano no slot 0 do jogador");

        const foes = T.build(def).team;
        const field = F.create({ allies, foes, isTrainer: true, trainer: built });
        eq(F.outcome(field), null, "batalha começa sem resultado");
        eq(F.activeUnits(field, F.ALLY).length, 3, "3 aliados em campo");
        eq(F.activeUnits(field, F.FOE).length, 3, "3 inimigos em campo");
        ok(F.slots(field, F.FOE)[0].isHuman(), "humano rival ocupa o slot 0 da direita");

        foes[0].hp = 0;
        eq(F.outcome(field), null, "derrubar só o humano rival não encerra");
        for (const u of foes) u.hp = 0;
        eq(F.outcome(field), "win", "lado inimigo inteiro caído = vitória");

        const field2 = F.create({ allies, foes: T.build(def).team, isTrainer: true });
        for (const u of allies) u.hp = 0;
        eq(F.outcome(field2), "lose", "lado do jogador inteiro caído = derrota");
    } finally {
        for (const id of injected) ctx.$dataPokemon[id] = undefined;
        vmMath.random = prevRandom;
        ctx.$gameParty = prevParty;
        ctx.$gameTemp = prevTemp;
    }
};
