// Suíte dos humanos em campo: classes da faixa HUM, ações humanas e Game_Human
// lutando pelo mesmo motor dos monstros (atacando, apanhando e desmaiando).
// Determinística: IVs/natureza normalizados e sorteios travados onde importa.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..", "..");
const STAT_KEYS = ["hp", "atk", "def", "spe", "spa", "spd"];
const bst = (sp) => STAT_KEYS.reduce((s, k) => s + sp.stats[k], 0);

// as 8 ações de status esperam efeito registrado por um plugin (ver relatório).
// Enquanto ele não existe, executeMove avisa que o golpe não tem efeito.
const PENDING_EFFECTS = {
    TACTICALCALL: { stats: { atk: -1, spa: -1 }, target: "foe" },
    READTHEFIELD: { stats: { spe: -2 }, target: "foe" },
    BRACEFORIMPACT: { stats: { def: 1, spd: 1 }, target: "self" },
    WARCRY: { stats: { atk: 1, spe: 1 }, target: "self" },
    COLDREAD: { stats: { spa: 1, spd: 1 }, target: "self" },
    INTIMIDATIONSTARE: { stats: { def: -1, spd: -1 }, target: "foe" },
    FLASHGRENADE: { stats: { acc: -2 }, target: "foe" },
    ROBATTLESUBMIT: { stats: { atk: -2 }, target: "foe" },
    STUNBATON: { secondary: { status: "PAR" }, chance: 30 },
    CAPTURENET: { secondary: { stats: { spe: -1 }, target: "foe" }, chance: 100 },
    SIGNALFLARE: { secondary: { status: "BRN" }, chance: 10 }
};

// o harness pode não carregar o plugin de humanos; carrega sob demanda
function ensurePlugin(ctx, file, loaded) {
    if (loaded()) return true;
    const p = path.join(ROOT, "js/plugins", file);
    if (!fs.existsSync(p)) return false;
    vm.runInContext(fs.readFileSync(p, "utf8"), ctx, { filename: file });
    return loaded();
}

module.exports = function({ ctx, ok, eq, G, section }) {
    section("Humanos — classes jogáveis, ações e combate (16)");

    const hasHuman = ensurePlugin(ctx, "PKM_Human.js", () => typeof ctx.Game_Human !== "undefined");
    ok(hasHuman, "PKM_Human carregado");
    if (!hasHuman) return;

    const Human = ctx.Game_Human;
    const B = ctx.PKM.Battle;
    const F = ctx.PKM.Franchise;
    const C = ctx.PKM.Core;
    const humMoves = JSON.parse(fs.readFileSync(path.join(ROOT, "data/moves/HUM.json"), "utf8"));
    const classes = F.speciesOf("HUM");
    const byName = new Map(classes.map(sp => [sp.internalName, sp]));
    const monster = (internal) => C.speciesByInternal(internal);
    const move = (id) => ({ id, pp: 20, ppMax: 20 });

    // corte de medida justo: IV 16, EV 0, natureza neutra (mesmo de 11-medabots)
    function fair(species, level, Klass) {
        const p = new (Klass || G)(species, level);
        p._nature = 0;
        for (const k of STAT_KEYS) { p._ivs[k] = 16; p._evs[k] = 0; }
        p._hp = p.maxHp;
        return p;
    }

    //--- catálogo de classes -------------------------------------------------
    ok(classes.length >= 8 && classes.length <= 12, `elenco tem ${classes.length} classes humanas (8-12)`);
    ok(classes.every(sp => sp.id >= 920 && sp.id <= 969), "toda classe está na faixa HUM (920-969)");
    ok(classes.every(sp => F.ofSpecies(sp.id).id === "HUM"), "toda classe pertence à franquia HUM");
    ok(!!byName.get("TRAINER"), "a classe padrão TRAINER existe (default de Game_Human)");
    eq(ctx.PKM.Human.classes().length, classes.length, "PKM.Human.classes() devolve o elenco HUM");

    ok(classes.every(sp => sp.type1 === "NORMAL"), "humano é NORMAL — a tabela de tipos é a língua franca");
    const dualType = classes.filter(sp => sp.type2);
    ok(dualType.length <= 2 && dualType.every(sp => ["HERALD", "UNIFIER"].includes(sp.internalName)),
        "só os antagonistas reescritos pelas fendas ganham 2º tipo");
    ok(classes.every(sp => sp.catchRate === 0), "catchRate 0 em toda classe (cinto e suspensório)");
    ok(classes.every(sp => (sp.evolutions || []).length === 0), "nenhuma classe humana evolui");
    ok(classes.every(sp => (sp.abilities || []).length === 0), "humano não tem habilidade (sistema não usado)");
    ok(classes.every(sp => sp.entry && sp.entry.length > 40), "toda classe tem descrição em português");
    ok(classes.every(sp => ["Medium", "Parabolic", "Slow"].includes(sp.growthRate)),
        "growthRate válido e coerente (avatar Medium, endgame Parabolic, chefe Slow)");

    //--- balanceamento: o humano ocupa 1 dos 3 slots sem dominar --------------
    // BST na faixa dos monstros médios da dimensão em que a classe aparece
    ok(classes.every(sp => STAT_KEYS.every(k => sp.stats[k] > 0)), "todo stat é positivo");
    ok(classes.every(sp => {
        const top = Math.max(...STAT_KEYS.map(k => sp.stats[k]));
        return sp.stats.atk < top;
    }), "Ataque nunca é o stat mais alto — o humano é estrategista, não brigão");

    const cmp = [
        ["TRAINER", "IVYSAUR", "inicial evoluído da D1"],
        ["DIGIDESTINED", "GREYMON", "Champion médio da D2"],
        ["MEDAFIGHTER", "ARCBEETLE", "melhor Medalha da D3"],
        ["BREEDER", "DURAHAN", "monstro de topo da D4"],
        ["GREATCHILD", "JIBAC", "espírito mais fraco da D5"],
        ["UNIFIER", "DRAGAC", "ás lendário do próprio Unificador"]
    ];
    for (const [klass, ref, label] of cmp) {
        const h = byName.get(klass), m = monster(ref);
        ok(h && m && bst(h) < bst(m),
            `${klass} (${h ? bst(h) : "?"}) fica abaixo de ${ref} — ${label} (${m ? bst(m) : "?"})`);
    }
    eq(bst(byName.get("MEDAFIGHTER")) >= 380 && bst(byName.get("MEDAFIGHTER")) <= 420, true,
        `Medafighter (${bst(byName.get("MEDAFIGHTER"))}) dentro da faixa dos Medabots (380-420)`);
    eq(bst(byName.get("GREATCHILD")), bst(monster("TRBGREYMON")),
        "Grande Criança empata com o Troublemonster — a fauna média da D5");
    ok(bst(byName.get("TRAINER")) < bst(byName.get("GREATCHILD")),
        "a curva sobe por dimensão: Treinador da D1 < Grande Criança da D5");
    ok(classes.every(sp => bst(sp) <= bst(byName.get("UNIFIER"))),
        "nenhuma classe passa do chefe final");

    //--- ações humanas -------------------------------------------------------
    const ids = Object.keys(humMoves);
    ok(ids.length >= 12 && ids.length <= 16, `${ids.length} ações humanas cadastradas (12-16)`);
    ok(ids.every(id => humMoves[id].id >= 910 && humMoves[id].id <= 925),
        "ações ocupam a faixa livre 910-925");
    const baseMoves = JSON.parse(fs.readFileSync(path.join(ROOT, "data/Moves.json"), "utf8"));
    const takenIds = new Set(Object.values(baseMoves).map(m => m.id));
    for (const dir of fs.readdirSync(path.join(ROOT, "data/moves"))) {
        if (dir === "HUM.json") continue;
        const bank = JSON.parse(fs.readFileSync(path.join(ROOT, "data/moves", dir), "utf8"));
        for (const m of Object.values(bank)) takenIds.add(m.id);
    }
    ok(ids.every(id => !takenIds.has(humMoves[id].id)), "nenhum id de ação colide com outro banco");
    ok(ids.every(id => !baseMoves[id]), "nenhum internalName sobrescreve golpe do banco base");
    ok(ids.every(id => !!C.move(id)), "toda ação foi fundida em $dataMoves pelo build");

    const damage = ids.filter(id => humMoves[id].power > 0);
    const status = ids.filter(id => humMoves[id].power === 0);
    ok(damage.length >= 5, `${damage.length} ações de dano funcionam sem registro de efeito`);
    ok(status.length >= 5, `${status.length} comandos de apoio projetados`);
    ok(damage.every(id => humMoves[id].power <= 85),
        "ação humana mais forte não passa de 85 de poder — item arremessado não é golpe de monstro");
    ok(status.every(id => humMoves[id].category === "Status"),
        "todo comando sem poder está categorizado como Status");
    ok(ids.every(id => humMoves[id].description && humMoves[id].description.length > 20),
        "toda ação tem descrição em português");

    // o que ainda depende de um plugin registrar em PKM.Battle.MOVE_EFFECTS
    const missing = ids.filter(id => {
        const md = humMoves[id];
        const needsEffect = md.category === "Status" || md.effectChance > 0;
        return needsEffect && !B.MOVE_EFFECTS[id];
    });
    ok(missing.every(id => !!PENDING_EFFECTS[id]),
        "toda ação sem efeito registrado está documentada na lista de pendências");

    //--- Game_Human ----------------------------------------------------------
    const you = new Human("TRAINER", 10, { name: "Manolo" });
    eq(you.isHuman(), true, "Game_Human.isHuman() é true");
    eq(new G("PIKACHU", 10).isHuman(), false, "monstro comum não é humano");
    eq(you.name, "Manolo", "o nome exibido é o da pessoa");
    eq(you.className, "Treinador", "className é a classe de personagem");
    eq(you.speciesName, "Treinador", "speciesName continua sendo a classe");
    eq(you.speciesId, 920, "a classe TRAINER é a espécie 920");
    eq(you.level, 10, "nível respeitado");
    ok(you.maxHp > 0 && you.hp === you.maxHp, "nasce com HP cheio");
    ok(you.types().includes("NORMAL"), "humano entra na tabela de tipos como NORMAL");
    eq(you.shiny, false, "humano nunca é shiny");
    eq(new Human("TRAINER", 5).name, "Treinador", "sem nome de pessoa, cai no nome da classe");
    eq(ctx.PKM.Human.isHuman(you), true, "PKM.Human.isHuman reconhece o avatar");
    eq(ctx.PKM.Human.isHuman(new G("PIKACHU", 5)), false, "PKM.Human.isHuman rejeita monstro");
    ok(ctx.PKM.Human.create("MEDAFIGHTER", 30, { name: "Ikki" }).className === "Medafighter",
        "PKM.Human.create monta qualquer classe do elenco");

    // repertório: o humano entra em campo com ações utilizáveis
    ok(you.moves.length >= 1 && you.moves.length <= 4, "1..4 ações no repertório");
    ok(you.moves.every(mv => !!C.move(mv.id)), "toda ação do repertório existe no banco");
    // o motor só entrega os 4 últimos golpes aprendidos: uma curva mal ordenada
    // deixa o humano só com comandos e sem nada que cause dano em campo
    for (const sp of classes) {
        const armed = [], commanded = [];
        for (let level = 1; level <= 100; level++) {
            const p = new Human(sp.internalName, level);
            const kinds = p.moves.map(mv => C.move(mv.id)).filter(Boolean);
            if (!kinds.some(md => md.power > 0)) armed.push(level);
            if (!kinds.some(md => md.power === 0)) commanded.push(level);
        }
        eq(armed.length, 0, `${sp.internalName} tem ação ofensiva em todo nível 1-100`);
        eq(commanded.length, 0, `${sp.internalName} tem comando de apoio em todo nível 1-100`);
    }

    //--- não é capturável e não evolui ---------------------------------------
    const rule = F.captureRule(you, null);
    eq(rule.allowed, false, "PKM.Franchise.captureRule barra a captura de humano");
    ok(rule.reason && rule.reason.includes("Manolo"), "a recusa cita a pessoa pelo nome");
    eq(F.captureRule(you, "POKEBALL").allowed, false, "nem com Poké Bola na mão");
    eq(F.captureRule(you, "MASTERBALL").allowed, false, "nem com Master Ball");
    eq(you.species().catchRate, 0, "catchRate 0 é a segunda trava, no dado");

    eq(you.evolutionByLevel(), null, "humano não evolui por nível");
    const grown = new Human("TRAINER", 5);
    grown.addExp(grown.expForLevel(40) - grown.exp);
    eq(grown.level, 40, "humano ganha EXP e sobe de nível como qualquer unidade");
    eq(grown.evolutionByLevel(), null, "mesmo no nível 40 não há evolução");
    eq((you.species().evolutions || []).length, 0, "a classe não declara linha evolutiva");

    //--- time de batalha: avatar no slot 0 -----------------------------------
    const prevParty = ctx.$gameParty;
    const party = new ctx.Game_Party();
    party.initialize();
    ctx.$gameParty = party;
    try {
        const pika = new G("PIKACHU", 10), bulba = new G("BULBASAUR", 10);
        party.pkmAdd(pika);
        party.pkmAdd(bulba);
        // o jogador sempre entra em campo: sem avatar definido, cria o padrão
        eq(party.pkmBattleTeam().length, 3, "sem avatar definido, o padrão entra no time");
        ok(party.pkmBattleTeam()[0].isHuman(), "o avatar padrão ocupa o slot 0");
        ok(party.pkmBattleRoster().includes(party.pkmAvatar()),
            "o avatar é alvo válido de item/cura fora de batalha");

        party.pkmSetAvatar(you);
        eq(party.pkmAvatar(), you, "pkmAvatar devolve o humano definido");
        const team = party.pkmBattleTeam();
        eq(team.length, 3, "time de batalha = humano + 2 monstros");
        eq(team[0], you, "o avatar humano ocupa a frente do time");
        eq(team[1], pika, "os monstros vêm depois do humano");
        ok(team.length <= ctx.PKM.Field.MAX_ACTIVE, "o time cabe nos 3 slots do campo");

        you._hp = 0;
        ok(!party.pkmBattleTeam().includes(you), "avatar caído sai do time de batalha");
        you._hp = you.maxHp;
        ok(party.pkmBattleTeam()[0] === you, "avatar curado volta para a frente");
    } finally {
        ctx.$gameParty = prevParty;
    }

    //--- combate: o humano ataca, apanha e desmaia pelo mesmo motor -----------
    {
        const hero = fair("TRAINER", 30, Human);
        hero._personName = "Manolo";
        const foe = fair("RATTATA", 30);
        const hpBefore = foe.hp;
        const msgs = B.executeMove(hero, foe, move("THROWNBALL"), {});
        ok(msgs.some(m => m.includes("Manolo") && m.includes("Bola Arremessada")),
            "o humano anuncia a ação com o nome da pessoa");
        ok(foe.hp < hpBefore, `ação humana de dano tira HP do monstro (${hpBefore} -> ${foe.hp})`);
        ok(B.calcDamage(hero, foe, "THROWNBALL").damage > 0, "calcDamage aceita humano como atacante");
        ok(B.calcDamage(hero, foe, "THROWNBALL").stab === 1.5, "humano NORMAL tem STAB nas ações NORMAL");
    }
    {
        const target = fair("TRAINER", 30, Human);
        const attacker = fair("MACHOP", 30);
        const before = target.hp;
        const msgs = B.executeMove(attacker, target, move("KARATECHOP"), {});
        ok(target.hp < before, `humano apanha como qualquer unidade (${before} -> ${target.hp})`);
        ok(msgs.some(m => m.includes("Foi super eficaz")),
            "Lutador é super eficaz contra o humano NORMAL");
        eq(B.calcDamage(attacker, target, "SHADOWBALL").effectiveness, 0,
            "Fantasma não afeta humano NORMAL");

        target._hp = 1;
        const fatal = B.executeMove(attacker, target, move("KARATECHOP"), { defender: " inimigo" });
        ok(target.isFainted(), "humano pode ser derrotado e sai de campo");
        ok(fatal.some(m => m.includes("desmaiou")), "a derrota do humano é anunciada");
    }
    {
        // humano é NORMAL: não tem imunidade de status nenhuma
        const h = new Human("TRAINER", 30);
        eq(B.statusImmune(h, "PAR"), false, "humano pode ser paralisado");
        eq(B.statusImmune(h, "BRN"), false, "humano pode ser queimado");
        ok(B.applyStatus(h, "PSN").ok && h.status === "PSN", "humano pode ser envenenado");
        const before = h.hp;
        B.endOfTurnResidual(h);
        ok(h.hp < before, "dano residual atinge o humano");
    }

    //--- os comandos de apoio funcionam assim que o efeito for registrado -----
    {
        const added = [];
        for (const id of Object.keys(PENDING_EFFECTS)) {
            if (!B.MOVE_EFFECTS[id]) { B.MOVE_EFFECTS[id] = PENDING_EFFECTS[id]; added.push(id); }
        }
        try {
            const cmdr = fair("TRAINER", 30, Human);
            const foe = fair("MACHAMP", 30);
            B.executeMove(cmdr, foe, move("TACTICALCALL"), {});
            ok(foe.stage("atk") === -1 && foe.stage("spa") === -1,
                "Chamada Tática derruba a ofensiva do alvo — o comando protege o time inteiro");
            B.executeMove(cmdr, foe, move("READTHEFIELD"), {});
            eq(foe.stage("spe"), -2, "Ler o Campo tira dois estágios de Velocidade do alvo");
            B.executeMove(cmdr, foe, move("BRACEFORIMPACT"), {});
            ok(cmdr.stage("def") === 1 && cmdr.stage("spd") === 1,
                "Aguentar Firme reforça o próprio humano");
            const msgs = B.executeMove(cmdr, foe, move("WARCRY"), {});
            ok(!msgs.some(m => m.includes("não tem efeito implementado")),
                "comando registrado não cai na mensagem de golpe sem efeito");
        } finally {
            for (const id of added) delete B.MOVE_EFFECTS[id];
        }
        // e enquanto ninguém registra, o motor avisa em vez de quebrar
        const mute = new Human("TRAINER", 30);
        const dummy = new G("RATTATA", 30);
        const out = B.executeMove(mute, dummy, move("TACTICALCALL"), {});
        ok(out.length > 0 && !dummy.isFainted(),
            "comando sem efeito registrado não quebra o turno (só não faz nada)");
    }
};
