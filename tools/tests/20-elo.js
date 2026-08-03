// Suíte da dimensão Folklora (VMO): barra de elo (V-Link), evolução definitiva
// escolhida entre ramos e isolamento das franquias.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "../..");
const STAT_KEYS = ["hp", "atk", "def", "spe", "spa", "spd"];

// o harness carrega uma lista fixa de plugins; garante MON_Link mesmo fora dela
function bootLink(ctx) {
    if (ctx.MON.Link) return;
    vm.runInContext(fs.readFileSync(path.join(ROOT, "js/plugins/MON_Link.js"), "utf8"),
        ctx, { filename: "MON_Link.js" });
}

// espécies de teste na faixa VMO: a suíte não pode depender da ordem em que o
// banco data/species/VMO.json entra no repo, nem sobrescrevê-lo quando existir.
const FIXTURES = [
    {
        internalName: "TESTVMOBASE", name: "Teste V-Base",
        evolutions: [
            { into: "TESTVMOA", method: "Level", param: "20" },
            { into: "TESTVMOB", method: "Level", param: "20", condition: { winsAtLeast: 5 } }
        ]
    },
    {
        internalName: "TESTVMOA", name: "Teste V-Alfa", maxLink: 150,
        stats: { hp: 90, atk: 70, def: 70, spe: 70, spa: 70, spd: 70 },
        evolutions: [{ into: "TESTVMOC", method: "Level", param: "40" }]
    },
    {
        internalName: "TESTVMOB", name: "Teste V-Beta",
        stats: { hp: 90, atk: 70, def: 70, spe: 70, spa: 70, spd: 70 }
    },
    {
        internalName: "TESTVMOC", name: "Teste V-Ômega",
        stats: { hp: 120, atk: 90, def: 90, spe: 90, spa: 90, spd: 90 }
    }
];

function injectFixtures(ctx) {
    const range = ctx.MON.Franchise.get("VMO");
    const data = ctx.$dataMonsters;
    let id = range.speciesFrom;
    for (const def of FIXTURES) {
        while (data[id]) id++;
        if (id > range.speciesTo) throw new Error("faixa VMO cheia");
        data[id] = Object.assign({
            id, franchise: "VMO", type1: "NORMAL", type2: null,
            stats: { hp: 50, atk: 50, def: 50, spe: 50, spa: 50, spd: 50 },
            genderRate: "Genderless", growthRate: "Medium", baseExp: 100,
            catchRate: 45, abilities: [], levelMoves: [{ level: 1, move: "TACKLE" }],
            evolutions: []
        }, def);
        id++;
    }
    for (let i = 1; i < data.length; i++) if (data[i] === undefined) data[i] = null;
}

// IV/EV zerados e natureza neutra: sem isso os stats sorteados tornariam as
// comparações de HP e de dano instáveis entre execuções
function fixate(unit) {
    for (const k of STAT_KEYS) { unit._ivs[k] = 0; unit._evs[k] = 0; }
    unit._nature = 0;
    unit._hp = unit.maxHp;
    return unit;
}

module.exports = function({ ctx, ok, eq, G, section }) {
    section("V-Monsters — Barra de Elo (V-Link)");

    bootLink(ctx);
    injectFixtures(ctx);

    const L = ctx.MON.Link;
    const B = ctx.MON.Battle;
    const GAIN = L.GAIN;
    const NAME = Object.fromEntries(FIXTURES.map(f => [f.internalName, f.name]));

    const vmo = (internalName, level = 30) => fixate(new G(internalName, level));
    const hit = (attacker, defender, crit = false) =>
        B.runDamageHooks({ attacker, defender, damage: 20, crit, moveId: "TACKLE" });

    //=========================================================================
    // A barra
    //=========================================================================
    {
        const unit = vmo("TESTVMOBASE");
        ok(L.isLinkUser(unit), "V-Monster tem barra de elo");
        ok(!L.isLinkUser(new G("PIKACHU", 30)) && !L.isLinkUser(new G("AGUMON", 30)),
            "Pokémon e Digimon não têm barra de elo");
        eq(L.value(unit), 0, "a barra começa vazia");
        eq(L.max(unit), 100, "teto padrão de 100 quando a espécie não declara");
        eq(L.max(vmo("TESTVMOA")), 150, "teto vem do maxLink da espécie");

        eq(L.gain(unit, 40), 40, "gain devolve o que entrou na barra");
        eq(L.gain(unit, -60), -40, "elo nunca fica negativo");
        eq(L.gain(unit, 999), 100, "gain satura no teto e devolve só o que coube");
        eq(L.value(unit), L.max(unit), "a barra respeita o teto");
    }

    //=========================================================================
    // Ganhos por golpe — apanhar rende mais que atacar (a identidade da franquia)
    //=========================================================================
    {
        const striker = vmo("TESTVMOBASE");
        const target = vmo("TESTVMOBASE");
        hit(striker, target);
        eq(L.value(target), GAIN.onHit, "quem apanha ganha 30 de elo");
        eq(L.value(striker), GAIN.onAttack, "quem ataca ganha 20 de elo");
        ok(L.value(target) > L.value(striker), "apanhar enche o elo mais rápido que atacar");
    }
    {
        const striker = vmo("TESTVMOBASE");
        const target = vmo("TESTVMOBASE");
        hit(striker, target, true);
        eq(L.value(target), GAIN.onHit + GAIN.onHitCrit, "crítico soma o bônus de quem apanha (60)");
        eq(L.value(striker), GAIN.onAttack + GAIN.onAttackCrit, "crítico soma o bônus de quem ataca (50)");
    }
    {
        const striker = vmo("TESTVMOB");
        const target = vmo("TESTVMOBASE");
        L.gain(target, L.max(target) - GAIN.onHit);
        ok(!L.isReady(target), "isReady é falso com a barra a um golpe do teto");
        const filled = hit(striker, target);
        ok(L.isReady(target), "isReady só quando a barra chega ao teto");
        ok(filled.some(m => m.includes(target.name)), "avisa quando a barra enche");
        const again = hit(striker, target);
        eq(L.value(target), L.max(target), "golpe extra não passa do teto");
        eq(again.filter(m => m.includes(target.name)).length, 0, "o aviso de elo cheio não se repete");
    }
    {
        const striker = vmo("TESTVMOBASE");
        const down = vmo("TESTVMOBASE");
        down.hp = 0;
        hit(striker, down);
        eq(L.value(down), 0, "unidade caída não acumula elo");
    }

    //=========================================================================
    // O gancho de dano não pode interferir no dano
    //=========================================================================
    {
        const striker = vmo("TESTVMOBASE");
        const target = vmo("TESTVMOBASE");
        const info = { attacker: striker, defender: target, damage: 42, crit: false, moveId: "TACKLE" };
        const hpBefore = target.hp;
        const msgs = B.runDamageHooks(info);
        eq(info.damage, 42, "o gancho não altera o dano informado");
        eq(target.hp, hpBefore, "o gancho não tira HP por conta própria");
        ok(msgs.every(m => typeof m === "string"), "o gancho devolve apenas mensagens");
    }
    {
        // RNG travado: randomInt(24)=1 (sem crítico), rand=(85+1)/100, acerto garantido.
        // Math vive no global do vm, não no objeto de contexto: só dá para trocar por dentro.
        vm.runInContext("Math._randomInt = Math.randomInt; Math.randomInt = () => 1;", ctx);
        try {
            const striker = vmo("TESTVMOBASE");
            const target = vmo("TESTVMOBASE");
            const expected = B.calcDamage(striker, target, "TACKLE", { fixedRand: 0.86, forceCrit: false });
            const hpBefore = target.hp;
            B.executeMove(striker, target, { id: "TACKLE", pp: 35, ppMax: 35 });
            eq(hpBefore - target.hp, expected.damage, "com o elo instalado o golpe causa o dano de sempre");
        } finally {
            vm.runInContext("Math.randomInt = Math._randomInt; delete Math._randomInt;", ctx);
        }
    }

    //=========================================================================
    // Ramos de evolução
    //=========================================================================
    {
        const unit = vmo("TESTVMOBASE");
        const branches = L.branches(unit);
        eq(branches.length, 2, "lista os dois ramos da espécie");
        eq(branches[0].index, 0, "o ramo carrega o índice que evolve() espera");
        eq(branches[0].name, NAME.TESTVMOA, "o ramo carrega o nome de exibição");
        ok(branches[0].unlocked, "ramo sem condição nasce liberado");
        ok(!branches[1].unlocked, "ramo com condição não cumprida vem bloqueado (silhueta)");

        for (let i = 0; i < 5; i++) unit.recordWin();
        ok(L.branches(unit)[1].unlocked, "cumprir a condição destrava o ramo");

        eq(L.branches(new G("PIKACHU", 30)).length, 0, "Pokémon não tem ramo de elo");
        eq(L.branches(new G("AGUMON", 30)).length, 0, "Digimon não tem ramo de elo");
    }

    //=========================================================================
    // Evolução pelo elo (definitiva)
    //=========================================================================
    {
        const unit = vmo("TESTVMOBASE");
        ok(!L.canEvolve(unit), "com a barra vazia não dá para evoluir");
        eq(L.evolve(unit, 0).ok, false, "evolve recusa com a barra incompleta");

        L.gain(unit, L.max(unit));
        ok(L.canEvolve(unit), "barra cheia libera a evolução");
        eq(L.evolve(unit, 1).ok, false, "ramo bloqueado é recusado");

        unit.hp = Math.floor(unit.maxHp / 4);
        const hpBefore = unit.hp;
        const maxHpBefore = unit.maxHp;
        const res = L.evolve(unit, 0);
        ok(res.ok && res.message.includes(NAME.TESTVMOA), "evolve devolve ok e a mensagem do elo");
        eq(unit.speciesName, NAME.TESTVMOA, "a espécie vira a forma do ramo escolhido");
        eq(unit.hp, Math.min(unit.maxHp, hpBefore + (unit.maxHp - maxHpBefore) + Math.floor(unit.maxHp / 2)),
            "a evolução cura metade do HP máximo");
        eq(L.value(unit), 0, "evoluir zera a barra");
        eq(L.max(unit), 150, "o teto passa a ser o da nova forma");
        ok(L.evolvedByLink(unit), "a evolução pelo elo fica registrada");
    }
    {
        const unit = vmo("TESTVMOBASE");
        L.gain(unit, L.max(unit));
        unit.hp = 0;
        ok(!L.canEvolve(unit), "unidade caída não pode evoluir");
        eq(L.evolve(unit, 0).ok, false, "evolve recusa unidade caída");
        eq(unit.speciesName, NAME.TESTVMOBASE, "a espécie da unidade caída fica intacta");
    }
    {
        const pika = fixate(new G("PIKACHU", 30));
        L.gain(pika, 999);
        eq(L.evolve(pika, 0).ok, false, "o V-Link não evolui Pokémon");
        eq(pika.speciesName, "Pikachu", "Pokémon segue sendo Pikachu");
    }

    //=========================================================================
    // A forma conquistada é DEFINITIVA
    //=========================================================================
    {
        const unit = vmo("TESTVMOBASE");
        L.gain(unit, L.max(unit));
        L.evolve(unit, 0);
        unit.resetBattleState();
        eq(L.value(unit), 0, "resetBattleState zera a barra (o elo é recurso de combate)");
        eq(unit.speciesName, NAME.TESTVMOA, "a forma conquistada pelo elo NÃO volta atrás");
    }
    {
        // evolução por elo empilhada sobre evolução por nível: nada é desfeito
        const unit = vmo("TESTVMOBASE");
        unit.evolveInto("TESTVMOA");
        L.gain(unit, L.max(unit));
        ok(L.evolve(unit, 0).ok, "evolui por elo em cima da forma ganha por nível");
        eq(unit.speciesName, NAME.TESTVMOC, "chegou à forma seguinte");
        unit.resetBattleState();
        eq(unit.speciesName, NAME.TESTVMOC, "segue na forma nova depois da batalha");
        eq(unit._evoHistory.length, 2, "as duas evoluções ficam no histórico");
    }
    {
        const unit = vmo("TESTVMOBASE");
        L.gain(unit, L.max(unit));
        L.evolve(unit, 0);
        ctx.MON.Field.create({ allies: [unit], foes: [vmo("TESTVMOB")] });
        ok(L.value(unit) === 0 && unit.speciesName === NAME.TESTVMOA,
            "entra em campo com a barra vazia, mas na forma que conquistou");
    }

    //=========================================================================
    // Nenhuma outra franquia é afetada
    //=========================================================================
    {
        const pika = fixate(new G("PIKACHU", 30));
        const agumon = fixate(new G("AGUMON", 30));
        hit(pika, agumon, true);
        hit(agumon, pika, true);
        ok(L.value(pika) === 0 && L.value(agumon) === 0, "Pokémon e Digimon não acumulam elo");
        ok(L.max(pika) === 0 && L.max(agumon) === 0, "sem franquia VMO, não há barra");
        ok(!L.isReady(pika) && !L.isReady(agumon), "isReady é falso fora de V-Monsters");
        eq(L.gain(pika, 999), 0, "gain direto em Pokémon não faz nada");
        eq(pika._linkValue, undefined, "nem cria estado de elo no monstro de outra franquia");
    }
};
