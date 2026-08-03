//=============================================================================
// MON_Link.js — V-Monsters: Barra de Elo (V-Link)
//=============================================================================
/*:
 * @target MZ
 * @plugindesc [MON v0.6] V-Monsters: barra de elo que enche em batalha e libera
 * uma evolução TEMPORÁRIA, escolhida entre ramos e desfeita no fim da luta.
 * @author Pokémon Dimensions
 * @base MON_Core
 * @base MON_Monster
 * @base MON_Evolution
 * @base MON_Battle
 * @orderAfter MON_Battle
 *
 * @help MON_Link.js
 *
 * O sistema único da dimensão Folklora (franquia VMO), fiel a
 * "V-Monsters: Forgotten Link". Cada V-Monster entra em batalha com uma barra de
 * elo vazia; ela enche a cada golpe de dano e, cheia, libera uma evolução
 * escolhida pelo jogador entre os ramos da espécie.
 *
 * ---------------------------------------------------------------------------
 * O QUE DIFERENCIA ESTA FRANQUIA
 * ---------------------------------------------------------------------------
 * A evolução acontece DENTRO da batalha e é escolhida pelo jogador entre os
 * ramos — e é DEFINITIVA: o V-Monster sai da luta na forma nova. O que separa
 * isto da digievolução (DGM) é o gatilho e quem decide: lá o sistema resolve por
 * condição ao subir de nível; aqui é o dano trocado no turno e a escolha do
 * jogador na hora.
 *
 * Apanhar rende mais elo que atacar (30 contra 20): quem está perdendo evolui
 * primeiro. Essa assimetria é a identidade do sistema — mexer nela muda a
 * franquia inteira.
 *
 * Ganhos por golpe de dano que acerta (Battle/Utils/Constants.cs da fonte):
 *   quem APANHA   30  (+30 se foi crítico)
 *   quem ATACA    20  (+30 se foi crítico)
 *
 * ---------------------------------------------------------------------------
 * API
 * ---------------------------------------------------------------------------
 *   MON.Link.isLinkUser(unit)          só V-Monsters têm barra
 *   MON.Link.value(unit) / max(unit)   estado da barra (0 em outras franquias)
 *   MON.Link.isReady(unit)             barra cheia
 *   MON.Link.gain(unit, amount)        soma na barra; devolve o que entrou
 *   MON.Link.reset(unit)               zera a barra
 *   MON.Link.branches(unit)            [{index, into, name, unlocked}]
 *   MON.Link.canEvolve(unit)           cheia + de pé + com ramo liberado
 *   MON.Link.evolve(unit, index)       -> {ok, message}
 *
 * Os ramos vêm de "evolutions" da espécie. O portão aqui é a BARRA, não o
 * nível: "method"/"param" não valem para o elo, mas a "condition" que o motor já
 * sabe checar vale — é o equivalente dos NextBlockedEvos da fonte, que aparecem
 * em silhueta com cadeado.
 * Ramo bloqueado volta em branches() com unlocked:false, para a UI desenhá-lo.
 *
 * A UI (painel de escolha de ramo e desenho da barra) é outro trabalho: aqui só
 * a API.
 *
 * ---------------------------------------------------------------------------
 * DESVIOS CONSCIENTES DA FONTE
 * ---------------------------------------------------------------------------
 * · ON_GUARD (-5) não foi portado: este motor não tem ação de defesa, e criar
 *   uma seria um segundo sistema — o limite é 1 sistema novo por franquia.
 * · "+3 de EP máximo" e "passa o turno" ao evoluir ficam de fora: não existe EP
 *   aqui, e consumir o turno é decisão da cena, não da regra.
 * · A cura da evolução mantém o HP relativo ao novo máximo e soma metade dele,
 *   como em BattleMonster.EvolveMonster.
 *
 * @command gainLink
 * @text Encher Elo
 * @desc Soma elo na barra de um V-Monster da equipe (evento e teste).
 *
 * @arg index
 * @type number
 * @min 0
 * @default 0
 * @text Posição na equipe
 * @desc 0 = primeiro membro da equipe.
 *
 * @arg amount
 * @type number
 * @min -999
 * @max 999
 * @default 100
 * @text Elo
 * @desc Valor somado à barra. Negativo tira.
 *
 * @command clearLink
 * @text Zerar Elo
 * @desc Zera a barra de elo de um V-Monster da equipe.
 *
 * @arg index
 * @type number
 * @min 0
 * @default 0
 * @text Posição na equipe
 * @desc 0 = primeiro membro da equipe.
 */

var MON = MON || {};
MON.Link = MON.Link || {};

(() => {
    "use strict";

    const PLUGIN_NAME = "MON_Link";
    const FRANCHISE = "VMO";
    const DEFAULT_MAX = 100;
    const HEAL_RATE = 0.5;

    // apanhar (30) rende mais que atacar (20) de propósito: quem está perdendo
    // evolui primeiro. É a identidade mecânica de V-Monsters.
    const GAIN = { onHit: 30, onHitCrit: 30, onAttack: 20, onAttackCrit: 30 };
    MON.Link.GAIN = GAIN;

    //=========================================================================
    // Barra de elo
    //=========================================================================
    MON.Link.isLinkUser = function(unit) {
        return !!unit && !!MON.Franchise && MON.Franchise.idOf(unit) === FRANCHISE;
    };

    // 0 em quem não é V-Monster: nenhuma outra franquia tem barra
    MON.Link.max = function(unit) {
        if (!MON.Link.isLinkUser(unit)) return 0;
        const sp = unit.species();
        const declared = Number(sp && (sp.maxLink !== undefined ? sp.maxLink : sp.maxEvo));
        return declared > 0 ? Math.floor(declared) : DEFAULT_MAX;
    };

    MON.Link.value = function(unit) {
        return MON.Link.isLinkUser(unit) ? (unit._linkValue || 0) : 0;
    };

    MON.Link.isReady = function(unit) {
        const max = MON.Link.max(unit);
        return max > 0 && MON.Link.value(unit) >= max;
    };

    MON.Link.reset = function(unit) {
        if (MON.Link.isLinkUser(unit)) unit._linkValue = 0;
    };

    // devolve o quanto realmente entrou na barra (0 em quem não acumula elo)
    MON.Link.gain = function(unit, amount) {
        if (!MON.Link.isLinkUser(unit) || unit.isFainted()) return 0;
        const before = MON.Link.value(unit);
        const after = Math.min(MON.Link.max(unit), Math.max(0, before + Math.floor(Number(amount) || 0)));
        unit._linkValue = after;
        return after - before;
    };

    function award(unit, amount) {
        const wasReady = MON.Link.isReady(unit);
        if (MON.Link.gain(unit, amount) <= 0) return [];
        return !wasReady && MON.Link.isReady(unit) ? [unit.name + " está com o elo no máximo!"] : [];
    }

    // gancho de dano: só LÊ o resultado do golpe. Não altera dano, alvo ou status.
    function onDamage(info) {
        if (!info) return [];
        const crit = !!info.crit;
        return award(info.defender, GAIN.onHit + (crit ? GAIN.onHitCrit : 0))
            .concat(award(info.attacker, GAIN.onAttack + (crit ? GAIN.onAttackCrit : 0)));
    }

    //=========================================================================
    // Ramos de evolução
    //=========================================================================
    // sem MON_Evolution carregado, ramo com condição reprova (falha fechada)
    function conditionOk(unit, condition) {
        return MON.Evolution ? MON.Evolution.checkCondition(unit, condition) : !condition;
    }

    MON.Link.branches = function(unit) {
        if (!MON.Link.isLinkUser(unit)) return [];
        const list = (unit.species() && unit.species().evolutions) || [];
        return list.map((ev, index) => {
            const target = MON.Core.speciesByInternal(ev.into);
            return {
                index,
                into: ev.into,
                name: target ? target.name : ev.into,
                unlocked: !!target && conditionOk(unit, ev.condition)
            };
        });
    };

    MON.Link.canEvolve = function(unit) {
        return MON.Link.isReady(unit) && !unit.isFainted()
            && MON.Link.branches(unit).some(b => b.unlocked);
    };

    //=========================================================================
    // Evolução pelo elo (definitiva)
    //=========================================================================
    MON.Link.evolvedByLink = function(unit) {
        return !!(unit && unit._linkEvolutions);
    };

    MON.Link.evolve = function(unit, branchIndex) {
        if (!MON.Link.isLinkUser(unit)) {
            return { ok: false, message: "O V-Link só responde a V-Monsters." };
        }
        if (unit.isFainted()) {
            return { ok: false, message: unit.name + " está fora de combate." };
        }
        if (!MON.Link.isReady(unit)) {
            return { ok: false, message: "O elo de " + unit.name + " ainda não está completo." };
        }
        const branch = MON.Link.branches(unit)[Number(branchIndex) || 0];
        if (!branch) {
            return { ok: false, message: unit.name + " não tem para onde evoluir." };
        }
        if (!branch.unlocked) {
            return { ok: false, message: branch.name + " ainda está fora do alcance do elo." };
        }

        const before = unit.name;
        const beforeMaxHp = unit.maxHp;
        if (!unit.evolveInto(branch.into)) {
            return { ok: false, message: unit.name + " não conseguiu completar o elo." };
        }
        unit._linkEvolutions = (unit._linkEvolutions || 0) + 1;
        const carried = Math.max(0, unit.maxHp - beforeMaxHp);
        unit.hp = Math.min(unit.maxHp, unit.hp + carried + Math.floor(unit.maxHp * HEAL_RATE));
        MON.Link.reset(unit);
        return { ok: true, message: before + " ativou o V-Link e virou " + unit.speciesName + "!" };
    };

    //=========================================================================
    // Ciclo de batalha
    //=========================================================================
    // a barra é recurso de combate e zera a cada batalha; a FORMA conquistada
    // fica — no jogo, V-Monster que evolui pelo elo não volta atrás
    const _resetBattleState = Game_Monster.prototype.resetBattleState;
    Game_Monster.prototype.resetBattleState = function() {
        _resetBattleState.call(this);
        if (MON.Link.isLinkUser(this)) MON.Link.reset(this);
    };

    // MON_Battle carrega ANTES deste plugin no jogo; no harness a ordem pode
    // ser outra. Registra assim que o gancho existir, sem depender da ordem.
    let installed = false;
    MON.Link.install = function() {
        if (installed) return true;
        if (!MON.Battle || !MON.Battle.registerDamageHook) return false;
        MON.Battle.registerDamageHook(onDamage);
        installed = true;
        return true;
    };
    if (!MON.Link.install() && typeof Scene_Boot !== "undefined") {
        const _onDatabaseLoaded = Scene_Boot.prototype.onDatabaseLoaded;
        Scene_Boot.prototype.onDatabaseLoaded = function() {
            MON.Link.install();
            _onDatabaseLoaded.call(this);
        };
    }

    if (typeof PluginManager !== "undefined") {
        PluginManager.registerCommand(PLUGIN_NAME, "gainLink", args => {
            MON.Link.gain(partyMember(args.index), Number(args.amount) || 0);
        });
        PluginManager.registerCommand(PLUGIN_NAME, "clearLink", args => {
            MON.Link.reset(partyMember(args.index));
        });
    }

    function partyMember(index) {
        const list = (typeof $gameParty !== "undefined" && $gameParty.monParty) ? $gameParty.monParty() : [];
        return list[Number(index) || 0] || null;
    }

    //=========================================================================
    // Cena (a partir daqui depende de render; ignorado no harness headless)
    //=========================================================================
    if (typeof Scene_Base === "undefined" || !Scene_Base.prototype.createWindowLayer) {
        return;
    }

})();
