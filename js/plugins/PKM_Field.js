//=============================================================================
// PKM_Field.js — campo de batalha em times (até 3v3)
//=============================================================================
/*:
 * @target MZ
 * @plugindesc [PKM v0.5] Campo de batalha em times (até 3v3) com humanos em campo:
 * posições, ordem de turno, alvos, substituição e condição de fim. Lógica pura.
 * @author Pokémon Dimensions
 * @base PKM_Core
 * @base PKM_Pokemon
 * @orderAfter PKM_Pokemon
 * @orderBefore PKM_Battle
 *
 * @help PKM_Field.js
 *
 * Substitui o 1v1 do motor original por um campo com dois lados de até 3 unidades
 * ativas cada. Uma "unidade" é qualquer coisa com a interface de Game_Pokemon —
 * inclusive Game_Human, então o treinador luta lado a lado com os monstros dele.
 *
 * Layout: lado "ally" à ESQUERDA, "foe" à DIREITA (a cena desenha de perfil, sem
 * sprite de costas). O slot 0 do jogador é sempre o humano.
 *
 * Toda a lógica aqui é pura e roda headless — a cena só renderiza e coleta input.
 *
 *   const field = PKM.Field.create({ allies: [...], foes: [...] });
 *   PKM.Field.activeUnits(field, "ally");
 *   PKM.Field.validTargets(field, unit);
 *   PKM.Field.turnOrder(actions);
 *   PKM.Field.outcome(field);   // null | "win" | "lose"
 */

var PKM = PKM || {};
PKM.Field = PKM.Field || {};

(() => {
    "use strict";

    const ALLY = "ally";
    const FOE = "foe";
    const MAX_ACTIVE = 3;

    PKM.Field.ALLY = ALLY;
    PKM.Field.FOE = FOE;
    PKM.Field.MAX_ACTIVE = MAX_ACTIVE;

    //=========================================================================
    // Construção
    //=========================================================================
    // allies/foes: listas completas; as MAX_ACTIVE primeiras entram em campo.
    PKM.Field.create = function(opts = {}) {
        const allies = (opts.allies || []).filter(Boolean);
        const foes = (opts.foes || []).filter(Boolean);
        const field = {
            sides: {
                [ALLY]: makeSide(allies),
                [FOE]: makeSide(foes)
            },
            isTrainer: !!opts.isTrainer,
            trainer: opts.trainer || null,
            runAttempts: 0,
            turn: 0
        };
        for (const unit of PKM.Field.allUnits(field)) {
            if (unit.resetBattleState) unit.resetBattleState();
        }
        return field;
    };

    function makeSide(list) {
        return { active: list.slice(0, MAX_ACTIVE), bench: list.slice(MAX_ACTIVE) };
    }

    //=========================================================================
    // Consulta
    //=========================================================================
    PKM.Field.side = function(field, side) { return field.sides[side]; };
    PKM.Field.opposing = function(side) { return side === ALLY ? FOE : ALLY; };

    PKM.Field.activeUnits = function(field, side) {
        return field.sides[side].active.filter(u => u && !u.isFainted());
    };
    // inclui as caídas ainda ocupando posição (a cena precisa desenhá-las)
    PKM.Field.slots = function(field, side) { return field.sides[side].active.slice(); };

    PKM.Field.allUnits = function(field) {
        return [ALLY, FOE].reduce((acc, s) => acc.concat(field.sides[s].active, field.sides[s].bench), [])
            .filter(Boolean);
    };

    PKM.Field.sideOf = function(field, unit) {
        for (const side of [ALLY, FOE]) {
            const s = field.sides[side];
            if (s.active.includes(unit) || s.bench.includes(unit)) return side;
        }
        return null;
    };

    PKM.Field.isAlly = function(field, unit) { return PKM.Field.sideOf(field, unit) === ALLY; };

    PKM.Field.validTargets = function(field, unit) {
        const side = PKM.Field.sideOf(field, unit);
        if (!side) return [];
        return PKM.Field.activeUnits(field, PKM.Field.opposing(side));
    };

    PKM.Field.resolveTarget = function(field, unit, target) {
        const options = PKM.Field.validTargets(field, unit);
        if (target && options.includes(target)) return target;
        return options.length ? options[0] : null;
    };

    //=========================================================================
    // Ordem de turno
    //=========================================================================
    // actions: [{unit, kind:"move"|"item"|"switch"|"run"|"capture", move, target}]
    // Ações que não são golpe agem antes (item/troca/fuga têm prioridade alta),
    // como no Pokémon clássico. Empate de velocidade é sorteado.
    PKM.Field.actionPriority = function(action) {
        if (!action) return 0;
        if (action.kind && action.kind !== "move") return 6;
        const md = action.move && PKM.Core.move(action.move.id);
        return (md && md.priority) || 0;
    };

    PKM.Field.unitSpeed = function(unit) {
        if (!unit) return 0;
        return unit.battleSpeed ? unit.battleSpeed() : unit.stat("spe");
    };

    // o desempate sorteia UMA chave por ação antes de ordenar; sortear dentro do
    // comparador torna a ordenação inconsistente e enviesa as permutações
    PKM.Field.turnOrder = function(actions) {
        return actions.filter(a => a && a.unit)
            .map(a => ({ a, tie: Math.random() }))
            .sort((x, y) => {
                const pd = PKM.Field.actionPriority(y.a) - PKM.Field.actionPriority(x.a);
                if (pd !== 0) return pd;
                const sd = PKM.Field.unitSpeed(y.a.unit) - PKM.Field.unitSpeed(x.a.unit);
                if (sd !== 0) return sd;
                return x.tie - y.tie;
            })
            .map(e => e.a);
    };

    //=========================================================================
    // Substituição e fim de batalha
    //=========================================================================
    PKM.Field.isSideDown = function(field, side) {
        return PKM.Field.activeUnits(field, side).length === 0
            && field.sides[side].bench.every(u => !u || u.isFainted());
    };

    // null enquanto a batalha corre; "win" derrotou o inimigo; "lose" perdeu
    PKM.Field.outcome = function(field) {
        if (PKM.Field.isSideDown(field, FOE)) return "win";
        if (PKM.Field.isSideDown(field, ALLY)) return "lose";
        return null;
    };

    // troca as unidades caídas em campo pelas primeiras de pé da reserva.
    // Retorna [{slot, out, in}] para a cena narrar.
    PKM.Field.fillEmptySlots = function(field, side) {
        const s = field.sides[side];
        const changes = [];
        for (let i = 0; i < s.active.length; i++) {
            const unit = s.active[i];
            if (unit && !unit.isFainted()) continue;
            const idx = s.bench.findIndex(u => u && !u.isFainted());
            if (idx < 0) continue;
            const replacement = s.bench.splice(idx, 1)[0];
            if (unit) s.bench.push(unit);
            if (replacement.resetBattleState) replacement.resetBattleState();
            s.active[i] = replacement;
            changes.push({ slot: i, out: unit, in: replacement });
        }
        return changes;
    };

    PKM.Field.switchUnit = function(field, side, unit, replacement) {
        const s = field.sides[side];
        const slot = s.active.indexOf(unit);
        const benchIndex = s.bench.indexOf(replacement);
        if (slot < 0 || benchIndex < 0 || replacement.isFainted()) return false;
        s.bench.splice(benchIndex, 1);
        s.bench.push(unit);
        s.active[slot] = replacement;
        if (replacement.resetBattleState) replacement.resetBattleState();
        return true;
    };

    PKM.Field.benchReady = function(field, side) {
        return field.sides[side].bench.filter(u => u && !u.isFainted());
    };

    //=========================================================================
    // IA: escolha de ação de uma unidade inimiga
    //=========================================================================
    // Heurística barata: entre os golpes com PP, prefere o de maior dano esperado
    // contra o alvo mais fraco de pé. Sem previsão de turno futuro.
    PKM.Field.pickAction = function(field, unit) {
        const targets = PKM.Field.validTargets(field, unit);
        if (!targets.length) return null;
        const usable = (unit.moves || []).filter(m => m.pp === undefined || m.pp > 0);
        const move = usable.length ? bestMove(unit, targets, usable) : null;
        if (!move) return { unit, kind: "move", move: { id: "STRUGGLE", pp: 1, ppMax: 1 }, target: targets[0] };
        return { unit, kind: "move", move: move.move, target: move.target };
    };

    function bestMove(unit, targets, usable) {
        let best = null;
        for (const move of usable) {
            for (const target of targets) {
                const score = estimate(unit, target, move);
                if (!best || score > best.score) best = { move, target, score };
            }
        }
        return best;
    }

    function estimate(unit, target, move) {
        const md = PKM.Core.move(move.id);
        if (!md) return 0;
        if (md.power <= 0 || md.category === "Status") return 12;   // utilidade fixa
        const calc = PKM.Battle.calcDamage(unit, target, move.id, { fixedRand: 1, forceCrit: false });
        const lethal = calc.damage >= target.hp ? 40 : 0;           // prefere finalizar
        return calc.damage + lethal;
    }
})();
