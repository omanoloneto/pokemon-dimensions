// Suíte do campo de batalha em times (MON_Field): posições, lados, alvos,
// ordem de turno, substituição, condição de fim e IA — tudo headless.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "../..");
const STAT_KEYS = ["hp", "atk", "def", "spe", "spa", "spd"];

// o harness carrega uma lista fixa de plugins; garante Human/Field mesmo fora dela
function bootField(ctx) {
    const run = (file) => vm.runInContext(
        fs.readFileSync(path.join(ROOT, "js/plugins", file), "utf8"), ctx, { filename: file });
    if (!ctx.Game_Human) run("MON_Human.js");
    if (!ctx.MON.Field || !ctx.MON.Field.create) run("MON_Field.js");
}

// classe humana real quando o banco HUM já está compilado; senão o padrão
function humanClass(ctx) {
    const classes = (ctx.MON.Human && ctx.MON.Human.classes) ? ctx.MON.Human.classes() : [];
    const found = classes.find(sp => sp && sp.internalName);
    return found ? found.internalName : "TRAINER";
}

// IV/EV zerados e natureza neutra: sem isso os stats sorteados tornariam as
// comparações de dano e de velocidade instáveis entre execuções
function fixate(unit, opts = {}) {
    for (const k of STAT_KEYS) { unit._ivs[k] = 0; unit._evs[k] = 0; }
    unit._nature = 0;
    unit._hp = unit.maxHp;
    if (opts.moves) unit.setMoves(opts.moves);
    if (opts.speed !== undefined) unit.battleSpeed = () => opts.speed;
    if (opts.hp !== undefined) unit.hp = opts.hp;
    return unit;
}

const faint = (unit) => { unit.hp = 0; return unit; };
const drainPP = (unit) => { for (const m of unit.moves) m.pp = 0; };

module.exports = function({ ctx, ok, eq, G, section }) {
    bootField(ctx);

    const F = ctx.MON.Field;
    const KLASS = humanClass(ctx);
    const mon = (species, level, opts) => fixate(new G(species, level), opts);
    const human = (level, opts = {}) =>
        fixate(new ctx.Game_Human(KLASS, level, { name: opts.name || "Manolo" }), opts);

    //--- construção ----------------------------------------------------------
    section("Campo — construção");
    {
        const team = [mon("PIKACHU", 10), mon("BULBASAUR", 10), mon("SQUIRTLE", 10),
                      mon("CHARMANDER", 10), mon("RATTATA", 10)];
        const enemy = [mon("PIDGEY", 10), mon("CATERPIE", 10)];
        team[0].changeStage("spe", -1);           // sujeira de uma batalha anterior
        team[3].changeStage("atk", 2);
        const field = F.create({ allies: team, foes: enemy });

        eq(F.MAX_ACTIVE, 3, "o campo comporta 3 unidades ativas por lado");
        eq(F.slots(field, F.ALLY).length, 3, "só as 3 primeiras entram em campo");
        ok(F.slots(field, F.ALLY).every((u, i) => u === team[i]), "os slots seguem a ordem da lista");
        eq(F.side(field, F.ALLY).bench.length, 2, "o excedente vai para a reserva");
        ok(F.side(field, F.ALLY).bench[0] === team[3], "a reserva também preserva a ordem");
        eq(F.slots(field, F.FOE).length, 2, "time menor que 3 ocupa só os slots que tem");
        eq(F.side(field, F.FOE).bench.length, 0, "time menor que 3 não tem reserva");
        eq(F.allUnits(field).length, 7, "allUnits soma ativos e reserva dos dois lados");
        eq(F.activeUnits(field, F.ALLY).length, 3, "as 3 unidades em campo estão de pé");

        eq(team[0].stage("spe"), 0, "create limpa o estado de batalha de quem entra em campo");
        eq(team[3].stage("atk"), 0, "create limpa o estado de batalha também da reserva");

        eq(field.turn, 0, "a batalha começa no turno 0");
        eq(field.runAttempts, 0, "nenhuma tentativa de fuga registrada");
        eq(field.isTrainer, false, "encontro selvagem não é batalha de treinador");
        eq(field.trainer, null, "encontro selvagem não guarda treinador");

        const duel = F.create({
            allies: [mon("PIKACHU", 10)], foes: [mon("PIDGEY", 10)],
            isTrainer: true, trainer: { name: "Gary" }
        });
        eq(duel.isTrainer, true, "batalha de treinador marca a flag");
        eq(duel.trainer.name, "Gary", "o treinador adversário fica guardado no campo");

        const sparse = F.create({ allies: [mon("EEVEE", 5), null, mon("ODDISH", 5)], foes: [] });
        eq(F.slots(sparse, F.ALLY).length, 2, "buracos na lista não viram slots vazios");
        eq(F.allUnits(sparse).length, 2, "lado sem unidade nenhuma não quebra a montagem");
    }

    //--- lados e alvos -------------------------------------------------------
    section("Campo — lados e alvos");
    {
        const a = [mon("PIKACHU", 20), mon("BULBASAUR", 20), mon("SQUIRTLE", 20), mon("EEVEE", 20)];
        const f = [mon("PIDGEY", 20), mon("RATTATA", 20), mon("ZUBAT", 20), mon("ODDISH", 20)];
        const field = F.create({ allies: a, foes: f });
        const outsider = mon("MAGIKARP", 20);

        eq(F.ALLY, "ally", "o time do jogador é o lado 'ally' (esquerda)");
        eq(F.FOE, "foe", "o time adversário é o lado 'foe' (direita)");
        eq(F.opposing(F.ALLY), F.FOE, "o oposto do lado do jogador é o adversário");
        eq(F.opposing(F.FOE), F.ALLY, "o oposto do adversário é o jogador");

        eq(F.sideOf(field, a[0]), F.ALLY, "sideOf acha a unidade ativa do jogador");
        eq(F.sideOf(field, a[3]), F.ALLY, "sideOf acha a unidade na reserva do jogador");
        eq(F.sideOf(field, f[3]), F.FOE, "sideOf acha a unidade na reserva inimiga");
        eq(F.sideOf(field, outsider), null, "unidade fora da batalha não tem lado");
        eq(F.isAlly(field, a[1]), true, "isAlly reconhece o time do jogador");
        eq(F.isAlly(field, f[1]), false, "isAlly rejeita o time inimigo");
        eq(F.isAlly(field, outsider), false, "isAlly rejeita quem não está na batalha");

        const targets = F.validTargets(field, a[0]);
        eq(targets.length, 3, "um golpe pode mirar as 3 unidades inimigas em campo");
        ok(targets.every(t => F.sideOf(field, t) === F.FOE), "só entram unidades do lado oposto");
        ok(!targets.includes(a[1]), "aliado em campo não é alvo");
        ok(!targets.includes(f[3]), "inimigo na reserva não é alvo");
        eq(F.validTargets(field, outsider).length, 0, "unidade fora da batalha não tem alvos");

        faint(f[1]);
        const alive = F.validTargets(field, a[0]);
        eq(alive.length, 2, "a unidade caída sai da lista de alvos");
        ok(!alive.includes(f[1]), "a caída some dos alvos mesmo continuando na posição");
        eq(F.slots(field, F.FOE).length, 3, "slots ainda devolve a caída para a cena desenhar");
        eq(F.activeUnits(field, F.FOE).length, 2, "activeUnits conta só quem está de pé");

        ok(F.resolveTarget(field, a[0], f[2]) === f[2], "alvo de pé é mantido");
        ok(F.resolveTarget(field, a[0], f[1]) === f[0], "alvo caído redireciona para o primeiro de pé");
        ok(F.resolveTarget(field, a[0], null) === f[0], "sem alvo escolhido, mira o primeiro de pé");
        ok(F.resolveTarget(field, a[0], a[1]) === f[0], "alvo do próprio lado não é aceito");
        faint(f[0]); faint(f[2]);
        eq(F.resolveTarget(field, a[0], f[2]), null, "sem inimigo de pé não há alvo");
    }

    //--- ordem de turno ------------------------------------------------------
    section("Campo — ordem de turno");
    {
        const fast = mon("JOLTEON", 50, { speed: 200 });
        const mid = mon("PIKACHU", 50, { speed: 120 });
        const slow = mon("SNORLAX", 50, { speed: 40 });
        const tackle = (u) => ({ unit: u, kind: "move", move: { id: "TACKLE" } });

        const order = F.turnOrder([tackle(slow), tackle(fast), tackle(mid)]);
        eq(order.length, 3, "todas as ações entram na ordem");
        ok(order[0].unit === fast && order[1].unit === mid && order[2].unit === slow,
            "com a mesma prioridade, o mais rápido age primeiro");

        const quickSlow = { unit: slow, kind: "move", move: { id: "QUICKATTACK" } };
        const byPriority = F.turnOrder([tackle(fast), quickSlow]);
        ok(byPriority[0] === quickSlow, "prioridade do golpe vence a velocidade");

        const quickFast = { unit: fast, kind: "move", move: { id: "QUICKATTACK" } };
        const extremeSlow = { unit: slow, kind: "move", move: { id: "EXTREMESPEED" } };
        ok(F.turnOrder([quickFast, extremeSlow])[0] === extremeSlow,
            "prioridade +2 passa na frente da +1 mesmo vindo do mais lento");

        for (const kind of ["item", "switch", "run", "capture"]) {
            const other = { unit: slow, kind };
            ok(F.turnOrder([quickFast, other])[0] === other,
                `ação de ${kind} age antes de qualquer golpe`);
        }

        eq(F.actionPriority({ unit: slow, kind: "item" }), 6, "ação fora de golpe usa prioridade alta fixa");
        eq(F.actionPriority(quickSlow), 1, "Quick Attack tem prioridade +1");
        eq(F.actionPriority(tackle(slow)), 0, "golpe comum tem prioridade 0");
        eq(F.actionPriority({ unit: slow, kind: "move" }), 0, "golpe sem dado cai para prioridade 0");
        eq(F.actionPriority(null), 0, "ação inexistente não quebra a ordenação");

        eq(F.unitSpeed(null), 0, "unidade inexistente tem velocidade 0");
        const par = mon("JOLTEON", 50);
        const healthy = par.battleSpeed();
        par.status = "PAR";
        eq(F.unitSpeed(par), par.battleSpeed(), "a ordem usa battleSpeed, não o stat cru");
        ok(F.unitSpeed(par) < healthy, "paralisia derruba a posição na ordem de turno");
        const buffed = mon("SNORLAX", 50);
        const before = F.unitSpeed(buffed);
        buffed.changeStage("spe", 2);
        ok(F.unitSpeed(buffed) > before, "estágio de velocidade muda a ordem de turno");

        const input = [tackle(slow), tackle(fast)];
        const sorted = F.turnOrder(input);
        ok(input[0].unit === slow, "turnOrder não reordena o array recebido");
        ok(sorted[0].unit === fast, "turnOrder devolve uma lista nova já ordenada");
        eq(F.turnOrder([null, { kind: "move" }, tackle(fast)]).length, 1, "ação sem unidade é descartada");
        eq(F.turnOrder([]).length, 0, "turno sem ações devolve lista vazia");
    }

    //--- fim de batalha ------------------------------------------------------
    section("Campo — fim de batalha");
    {
        const allies = [mon("PIKACHU", 20), mon("BULBASAUR", 20), mon("SQUIRTLE", 20)];
        const foes = [mon("PIDGEY", 20), mon("RATTATA", 20), mon("ZUBAT", 20), mon("ODDISH", 20)];
        const field = F.create({ allies, foes });

        eq(F.outcome(field), null, "com os dois lados de pé a batalha continua");
        foes.slice(0, 3).forEach(faint);
        eq(F.isSideDown(field, F.FOE), false, "lado com reserva de pé não está derrotado");
        eq(F.outcome(field), null, "derrubar as 3 em campo não encerra se ainda há reserva");
        faint(foes[3]);
        eq(F.isSideDown(field, F.FOE), true, "sem ativos nem reserva de pé, o lado caiu");
        eq(F.outcome(field), "win", "time inimigo inteiro caído = vitória");

        const mine = [mon("PIKACHU", 20), mon("EEVEE", 20)];
        const lost = F.create({ allies: mine, foes: [mon("ONIX", 20)] });
        faint(mine[0]);
        eq(F.outcome(lost), null, "uma unidade de pé ainda segura a batalha");
        faint(mine[1]);
        eq(F.outcome(lost), "lose", "time do jogador inteiro caído = derrota");

        const reserve = [mon("PIKACHU", 20), mon("EEVEE", 20), mon("ODDISH", 20), mon("GEODUDE", 20)];
        const held = F.create({ allies: reserve, foes: [mon("ONIX", 20)] });
        F.slots(held, F.ALLY).forEach(faint);
        eq(F.isSideDown(held, F.ALLY), false, "reserva viva impede a derrota");
        eq(F.outcome(held), null, "campo vazio com reserva de pé não encerra a batalha");
    }

    //--- substituição --------------------------------------------------------
    section("Campo — substituição");
    {
        const a = [mon("PIKACHU", 20), mon("BULBASAUR", 20), mon("SQUIRTLE", 20),
                   mon("EEVEE", 20), mon("ODDISH", 20)];
        const field = F.create({ allies: a, foes: [mon("ONIX", 20)] });
        a[3].changeStage("atk", 2);               // sujeira antes de entrar em campo

        faint(a[1]);
        const changes = F.fillEmptySlots(field, F.ALLY);
        eq(changes.length, 1, "só o slot do caído é preenchido");
        eq(changes[0].slot, 1, "a troca informa o slot afetado");
        ok(changes[0].out === a[1] && changes[0].in === a[3], "sai o caído, entra a primeira de pé da reserva");
        ok(F.slots(field, F.ALLY)[1] === a[3], "a reserva assume a posição em campo");
        ok(F.side(field, F.ALLY).bench.includes(a[1]), "o caído vai para a reserva");
        eq(a[3].stage("atk"), 0, "quem entra chega com o estado de batalha limpo");
        eq(F.fillEmptySlots(field, F.ALLY).length, 0, "sem slot vago nada muda");
        eq(F.benchReady(field, F.ALLY).length, 1, "sobrou uma reserva de pé");

        faint(a[4]);
        faint(a[0]);
        eq(F.benchReady(field, F.ALLY).length, 0, "reserva inteira caída");
        eq(F.fillEmptySlots(field, F.ALLY).length, 0, "sem reserva de pé ninguém entra");
        ok(F.slots(field, F.ALLY)[0] === a[0], "o caído continua na posição quando não há quem entre");

        const b = [mon("PIKACHU", 20), mon("BULBASAUR", 20), mon("SQUIRTLE", 20),
                   mon("EEVEE", 20), mon("ODDISH", 20)];
        const multi = F.create({ allies: b, foes: [mon("ONIX", 20)] });
        faint(b[0]); faint(b[2]);
        const many = F.fillEmptySlots(multi, F.ALLY);
        eq(many.length, 2, "dois caídos, dois slots preenchidos numa passada");
        ok(many[0].in === b[3] && many[1].in === b[4], "a reserva entra na ordem em que está");
        ok(F.slots(multi, F.ALLY)[0] === b[3] && F.slots(multi, F.ALLY)[2] === b[4],
            "cada reserva assume o slot certo");
        ok(F.slots(multi, F.ALLY)[1] === b[1], "o slot de quem está de pé não é mexido");

        const c = [mon("PIKACHU", 20), mon("BULBASAUR", 20), mon("SQUIRTLE", 20),
                   mon("EEVEE", 20), mon("ODDISH", 20)];
        const sw = F.create({ allies: c, foes: [mon("ONIX", 20)] });
        const outsider = mon("MAGIKARP", 20);
        faint(c[4]);                              // reserva caída
        c[3].changeStage("spe", -2);

        eq(F.switchUnit(sw, F.ALLY, c[0], c[4]), false, "não troca por unidade caída");
        eq(F.switchUnit(sw, F.ALLY, c[0], c[1]), false, "não troca por quem já está em campo");
        eq(F.switchUnit(sw, F.ALLY, c[0], outsider), false, "unidade fora da reserva não entra em campo");
        eq(F.switchUnit(sw, F.ALLY, outsider, c[3]), false, "só quem está em campo pode ser trocado");
        ok(F.slots(sw, F.ALLY)[0] === c[0], "troca recusada não mexe no campo");
        eq(F.side(sw, F.ALLY).bench.length, 2, "troca recusada não mexe na reserva");

        eq(F.switchUnit(sw, F.ALLY, c[0], c[3]), true, "troca voluntária por reserva de pé");
        ok(F.slots(sw, F.ALLY)[0] === c[3], "a reserva assume o slot de quem saiu");
        ok(F.side(sw, F.ALLY).bench.includes(c[0]), "quem saiu vai para a reserva");
        ok(!F.side(sw, F.ALLY).bench.includes(c[3]), "quem entrou sai da reserva");
        eq(c[3].stage("spe"), 0, "quem entra pela troca também zera o estado de batalha");
        eq(F.side(sw, F.ALLY).bench.length, 2, "a troca não muda o tamanho da reserva");
    }

    //--- IA ------------------------------------------------------------------
    section("Campo — IA de escolha de ação");
    {
        const ai = mon("RATTATA", 50, { moves: ["TACKLE", "BODYSLAM"] });
        const field = F.create({ allies: [mon("PIKACHU", 50)], foes: [ai] });
        const act = F.pickAction(field, ai);
        ok(act && act.unit === ai && act.kind === "move", "a IA devolve uma ação de golpe da própria unidade");
        ok(F.validTargets(field, ai).includes(act.target), "o alvo escolhido é legal");
        ok(ai.knowsMove("TACKLE"), "a IA tinha um golpe mais fraco disponível");
        eq(act.move.id, "BODYSLAM", "a IA prefere o golpe de maior dano esperado");
        ok(ai.moves.includes(act.move), "a ação aponta para o golpe real da unidade (gasta o PP certo)");

        // alvos idênticos: só o HP baixo diferencia, e o abatível não é o primeiro da lista
        const healthy = mon("PIKACHU", 50);
        const dying = mon("PIKACHU", 50, { hp: 1 });
        const killer = mon("RATTATA", 50, { moves: ["TACKLE"] });
        const koField = F.create({ allies: [healthy, dying], foes: [killer] });
        ok(F.validTargets(koField, killer)[0] === healthy, "o alvo íntegro é o primeiro da lista");
        ok(F.pickAction(koField, killer).target === dying, "a IA mira quem consegue derrubar no turno");

        const ghost = mon("GASTLY", 50);
        const utility = mon("RATTATA", 50, { moves: ["TACKLE", "GROWL"] });
        const ghostField = F.create({ allies: [ghost], foes: [utility] });
        eq(ctx.MON.Battle.calcDamage(utility, ghost, "TACKLE", { fixedRand: 1, forceCrit: false }).damage, 0,
            "golpe Normal não machuca Fantasma");
        eq(F.pickAction(ghostField, utility).move.id, "GROWL", "contra alvo imune a IA parte para a utilidade");

        const noPP = mon("RATTATA", 50, { moves: ["TACKLE", "BODYSLAM"] });
        const ppField = F.create({ allies: [mon("PIKACHU", 50)], foes: [noPP] });
        noPP.moves.find(m => m.id === "BODYSLAM").pp = 0;
        eq(F.pickAction(ppField, noPP).move.id, "TACKLE", "golpe sem PP sai da escolha");

        drainPP(noPP);
        const desperate = F.pickAction(ppField, noPP);
        ok(desperate && desperate.move && !!ctx.MON.Core.move(desperate.move.id),
            "com todo o PP zerado ainda devolve um golpe que existe no banco");
        ok(desperate.move.pp > 0, "o golpe de desespero tem PP para ser usado");
        ok(F.validTargets(ppField, noPP).includes(desperate.target), "o desespero também mira alvo válido");
        eq(desperate.move.id, "STRUGGLE", "sem PP a IA recorre a Struggle");

        F.slots(ppField, F.ALLY).forEach(faint);
        eq(F.pickAction(ppField, noPP), null, "sem inimigo de pé a IA não devolve ação");
    }

    //--- humano em campo -----------------------------------------------------
    section("Campo — humano como combatente");
    {
        const you = human(20, { speed: 200 });
        const mine = [mon("PIKACHU", 20, { speed: 100 }), mon("BULBASAUR", 20)];
        const rival = human(20, { name: "Gary", moves: ["TACKLE"] });
        const theirs = [mon("PIDGEY", 20), mon("RATTATA", 20)];
        const field = F.create({
            allies: [you].concat(mine), foes: [rival].concat(theirs),
            isTrainer: true, trainer: { name: "Gary" }
        });

        ok(you.isHuman(), "o avatar do jogador é um humano");
        ok(F.slots(field, F.ALLY)[0] === you, "o humano ocupa o slot 0 do time do jogador");
        eq(F.sideOf(field, you), F.ALLY, "o humano tem lado como qualquer unidade");
        eq(F.activeUnits(field, F.ALLY).length, 3, "o time em campo é o humano + 2 monstros");
        eq(F.slots(field, F.FOE).length, 3, "o time inimigo é simétrico: treinador + 2 monstros");
        ok(rival.isHuman() && !theirs[0].isHuman(), "o treinador inimigo é humano e os parceiros não");

        ok(F.validTargets(field, rival).includes(you), "o humano é alvo legal do adversário");
        ok(F.validTargets(field, you).includes(rival), "o humano ataca o treinador adversário");
        eq(F.validTargets(field, you).length, 3, "o humano mira as 3 unidades inimigas");

        const order = F.turnOrder([
            { unit: mine[0], kind: "move", move: { id: "TACKLE" } },
            { unit: you, kind: "move", move: { id: "TACKLE" } }
        ]);
        ok(order[0].unit === you, "o humano entra na ordem de turno pela própria velocidade");

        you.hp = 1;
        ok(F.pickAction(field, rival).target === you, "a IA trata o humano como alvo abatível");

        faint(you);
        eq(F.activeUnits(field, F.ALLY).length, 2, "o humano caído sai das unidades de pé");
        ok(!F.validTargets(field, rival).includes(you), "humano caído deixa de ser alvo");
        eq(F.outcome(field), null, "o time segue lutando com os monstros mesmo sem o humano");
        mine.forEach(faint);
        eq(F.outcome(field), "lose", "a queda das 3 unidades do lado encerra em derrota");

        const bench = mon("CHARMANDER", 20);
        const swap = F.create({
            allies: [human(20), mon("PIKACHU", 20), mon("SQUIRTLE", 20), bench],
            foes: [mon("ONIX", 20)]
        });
        faint(F.slots(swap, F.ALLY)[0]);
        const filled = F.fillEmptySlots(swap, F.ALLY);
        eq(filled.length, 1, "o slot do humano caído é preenchido");
        ok(filled[0].in === bench, "a reserva assume o lugar do humano");
        ok(F.slots(swap, F.ALLY)[0] === bench, "o slot 0 passa a ser do monstro que entrou");

        const wild = F.create({ allies: [human(20), mon("PIKACHU", 20)], foes: [mon("PIDGEY", 5)] });
        eq(wild.isTrainer, false, "encontro selvagem não é batalha de treinador");
        eq(F.slots(wild, F.FOE).length, 1, "encontro selvagem pode ter uma única unidade");
        ok(F.slots(wild, F.FOE).every(u => !u.isHuman()), "encontro selvagem não tem humano do outro lado");
    }
};
