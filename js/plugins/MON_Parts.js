//=============================================================================
// MON_Parts.js  — Medabots: Medapeças trocáveis
//=============================================================================
/*:
 * @target MZ
 * @plugindesc [MON v0.3] Medabots: 4 slots de Medapeça por monstro (head/rArm/lArm/
 * legs), estoque de peças no save e drop de peça ao vencer uma Robattle.
 * @author Pokémon Dimensions
 * @base MON_Core
 * @base MON_Monster
 * @base MON_Franchise
 * @orderAfter MON_Franchise
 * @orderAfter MON_Battle
 * @orderAfter MON_Party
 *
 * @help MON_Parts.js
 *
 * A Medalha é o monstro: ela carrega nível e EXP. O corpo são 4 Medapeças
 * trocáveis que somam stats e ACRESCENTAM golpes ao repertório da Medalha.
 * Vencer uma Robattle contra um Medabot dropa 1 peça do loadout dele.
 *
 * DESVIO CONSCIENTE DO DESIGN (docs/02-franquias.md)
 *   O documento sugeria usar o equipamento NATIVO do MZ (traits Add Skill /
 *   Parameter). Não dá: nossos monstros são Game_Monster, não Game_Actor, e
 *   portanto não têm equips nem traits. Os 4 slots são implementados aqui,
 *   direto no Game_Monster, com o mesmo efeito prático (stats + golpes).
 *   Nada de dano localizado por parte nem Medaforce — fora de escopo.
 *
 * Catálogo: data/Parts.json (array). Slots válidos: head, rArm, lArm, legs.
 * "legs" dá bônus de velocidade e nunca traz golpe.
 *
 * Todo Medabot nasce montado com as peças do próprio modelo (loadout padrão),
 * então selvagens e equipes de treinador já entram na arena com corpo e drop.
 *
 * API
 *   MON.Parts.equip(monster, partId)   -> {ok, message, replaced}
 *   MON.Parts.unequip(monster, slot)   -> partId removido ou null
 *   MON.Parts.equipped(monster)        -> {head, rArm, lArm, legs} (ids)
 *   MON.Parts.loadout(monster)         -> {head, rArm, lArm, legs} (dados)
 *   MON.Parts.defaultLoadout(monster)  -> {head, rArm, lArm, legs} (ids, puro)
 *   MON.Parts.applyDefaultLoadout(p)   -> monta o padrão se ainda não tem peça
 *   MON.Parts.rawStatBonus(p, key)     -> soma crua do catálogo (ponto de base)
 *   MON.Parts.statBonus(monster, key)  -> bônus já escalado pelo nível
 *   MON.Parts.partMoves(monster)       -> ids de golpe oferecidos pelas peças
 *   MON.Parts.grantedMoves(monster)    -> ids que as peças de fato ensinaram
 *   MON.Parts.syncMoves(monster)       -> concilia golpes de peça e da Medalha
 *   MON.Parts.rollDrop(defeated, rng)  -> partId sorteado ou null (puro)
 *   MON.Parts.victoryDrop(winner, defeated, rng) -> [mensagens]
 *
 * Estoque do jogador (salvo no save, separado do loadout do Medabot):
 *   $gameParty.monGainPart(id, qty) / monLosePart(id, qty)
 *   $gameParty.monPartCount(id)     / monParts() -> [{id, qty, data}]
 *
 * @command givePart
 * @text Dar Medapeça
 * @desc Adiciona uma Medapeça ao estoque do jogador.
 * @arg part @type string @text Peça @desc id do catálogo (ex.: MB_HEAD_METABEE).
 * @arg qty  @type number @min 1 @default 1 @text Quantidade
 *
 * @command equipPart
 * @text Equipar Medapeça
 * @desc Tira a peça do estoque e monta no Medabot da equipe. A peça trocada volta ao estoque.
 * @arg member @type number @min 1 @default 1 @text Posição na equipe
 * @arg part   @type string @text Peça @desc id do catálogo (ex.: MB_RARM_ROKUSHO).
 *
 * @command unequipPart
 * @text Remover Medapeça
 * @desc Desmonta o slot e devolve a peça ao estoque do jogador.
 * @arg member @type number @min 1 @default 1 @text Posição na equipe
 * @arg slot   @type select @option head @option rArm @option lArm @option legs @default head @text Slot
 */

var $dataParts = $dataParts || null;

var MON = MON || {};
MON.Parts = MON.Parts || {};

(() => {
    "use strict";

    const PLUGIN_NAME = "MON_Parts";
    const FRANCHISE_ID = "MDB";
    const SLOTS = ["head", "rArm", "lArm", "legs"];

    DataManager._databaseFiles.push({ name: "$dataParts", src: "Parts.json" });

    //=========================================================================
    // Catálogo
    //=========================================================================
    let index = null;
    let indexSource = null;

    function catalog() {
        const source = $dataParts || null;
        if (!source) return {};
        if (indexSource !== source) {
            index = {};
            for (const part of source) {
                if (part && part.id) index[part.id] = part;
            }
            indexSource = source;
        }
        return index;
    }

    MON.Parts.SLOTS = SLOTS.slice();
    MON.Parts.get = (partId) => catalog()[partId] || null;
    MON.Parts.all = () => Object.values(catalog());
    MON.Parts.byModel = (model) => MON.Parts.all().filter(p => p.model === model);
    MON.Parts.bySlot = (slot) => MON.Parts.all().filter(p => p.slot === slot);
    MON.Parts.isMedabot = (monster) => !!monster && MON.Franchise.idOf(monster) === FRANCHISE_ID;

    //=========================================================================
    // Slots do monstro
    //=========================================================================
    function slotState(monster, create) {
        if (!monster) return null;
        if (!monster._monParts && create) {
            monster._monParts = { head: null, rArm: null, lArm: null, legs: null };
        }
        return monster._monParts || null;
    }

    function clampHp(monster) {
        if (monster.hp > monster.maxHp) monster.hp = monster.maxHp;
    }

    MON.Parts.equipped = function(monster) {
        const state = slotState(monster, false);
        const out = {};
        for (const slot of SLOTS) out[slot] = (state && state[slot]) || null;
        return out;
    };

    MON.Parts.loadout = function(monster) {
        const ids = MON.Parts.equipped(monster);
        const out = {};
        for (const slot of SLOTS) out[slot] = ids[slot] ? MON.Parts.get(ids[slot]) : null;
        return out;
    };

    MON.Parts.equip = function(monster, partId) {
        if (!MON.Parts.isMedabot(monster)) {
            return { ok: false, message: "Só Medabots aceitam Medapeças.", replaced: null };
        }
        const part = MON.Parts.get(partId);
        if (!part) {
            return { ok: false, message: "Medapeça desconhecida: " + partId + ".", replaced: null };
        }
        if (!SLOTS.includes(part.slot)) {
            return { ok: false, message: part.name + " não encaixa em nenhum slot.", replaced: null };
        }
        const state = slotState(monster, true);
        if (state[part.slot] === partId) {
            return { ok: false, message: monster.name + " já usa " + part.name + ".", replaced: null };
        }
        const replaced = state[part.slot] || null;
        state[part.slot] = partId;
        MON.Parts.syncMoves(monster);
        clampHp(monster);
        return { ok: true, message: monster.name + " montou " + part.name + ".", replaced };
    };

    MON.Parts.unequip = function(monster, slot) {
        if (!MON.Parts.isMedabot(monster) || !SLOTS.includes(slot)) return null;
        const state = slotState(monster, false);
        if (!state || !state[slot]) return null;
        const removed = state[slot];
        state[slot] = null;
        MON.Parts.syncMoves(monster);
        clampHp(monster);
        return removed;
    };

    //=========================================================================
    // Loadout padrão: as 4 peças do próprio modelo
    //=========================================================================
    MON.Parts.defaultLoadout = function(monster) {
        const out = {};
        for (const slot of SLOTS) out[slot] = null;
        if (!MON.Parts.isMedabot(monster)) return out;
        const sp = monster.species && monster.species();
        if (!sp || !sp.internalName) return out;
        for (const part of MON.Parts.byModel(sp.internalName)) {
            if (SLOTS.includes(part.slot) && !out[part.slot]) out[part.slot] = part.id;
        }
        return out;
    };

    // Sem isto o inimigo criado por MON_Encounters/MON_Trainers nasceria sem peça
    // alguma: stats de Medalha nua e drop de Robattle impossível.
    MON.Parts.applyDefaultLoadout = function(monster) {
        if (!MON.Parts.isMedabot(monster) || slotState(monster, false)) return false;
        const ids = MON.Parts.defaultLoadout(monster);
        if (!SLOTS.some(slot => ids[slot])) return false;
        const state = slotState(monster, true);
        for (const slot of SLOTS) state[slot] = ids[slot];
        MON.Parts.syncMoves(monster);
        return true;
    };

    const _Game_Monster_initialize = Game_Monster.prototype.initialize;
    Game_Monster.prototype.initialize = function() {
        _Game_Monster_initialize.apply(this, arguments);
        if (MON.Parts.applyDefaultLoadout(this)) this.hp = this.maxHp;
    };

    //=========================================================================
    // Stats: alias que soma os bônus das peças
    //=========================================================================
    MON.Parts.rawStatBonus = function(monster, key) {
        const state = slotState(monster, false);
        if (!state) return 0;
        let sum = 0;
        for (const slot of SLOTS) {
            const part = state[slot] && catalog()[state[slot]];
            if (part && part.stats && part.stats[key]) sum += part.stats[key];
        }
        return sum;
    };

    // A peça vale como ponto de stat BASE e escala com o nível igual ao resto do
    // jogo: o bônus plano antigo valia +40% no nv30 e só +25% no nv50, ou seja, a
    // franquia enfraquecia sozinha ao longo da campanha.
    MON.Parts.statBonus = function(monster, key) {
        const raw = MON.Parts.rawStatBonus(monster, key);
        if (!raw) return 0;
        const level = (monster && monster.level) || 1;
        return Math.trunc(2 * raw * level / 100);
    };

    const _Game_Monster_stat = Game_Monster.prototype.stat;
    Game_Monster.prototype.stat = function(key) {
        const bonus = MON.Parts.statBonus(this, key);
        const value = _Game_Monster_stat.call(this, key);
        return bonus ? Math.max(1, value + bonus) : value;
    };

    //=========================================================================
    // Golpes das peças
    //=========================================================================
    // As peças SOMAM golpes ao repertório da Medalha, nos slots livres do teto de
    // 4 do motor: monster.moves continua sendo a lista real do monstro, então
    // learnMove/knowsMove/replaceMove (e a mensagem de "aprendeu!") seguem válidos.
    MON.Parts.partMoves = function(monster) {
        const state = slotState(monster, false);
        if (!state) return [];
        const out = [];
        for (const slot of SLOTS) {
            const part = state[slot] && catalog()[state[slot]];
            const moveId = part && part.move;
            if (moveId && !out.includes(moveId) && MON.Core.move(moveId)) out.push(moveId);
        }
        return out;
    };

    function grantedList(monster) {
        if (!monster._monGrantedMoves) monster._monGrantedMoves = [];
        return monster._monGrantedMoves;
    }

    MON.Parts.grantedMoves = function(monster) {
        return monster && monster._monGrantedMoves ? monster._monGrantedMoves.slice() : [];
    };

    // golpe que a curva de nível da Medalha já ensinaria sozinha
    function isNaturalMove(monster, moveId) {
        const sp = monster.species();
        return ((sp && sp.levelMoves) || []).some(lm => lm.move === moveId && lm.level <= monster.level);
    }

    // desmontar não pode apagar golpe que a Medalha já conquistou por nível:
    // não há reaprendiz de golpes no port, a perda seria permanente.
    function forgetMove(monster, moveId) {
        if (isNaturalMove(monster, moveId)) return false;
        const list = monster.moves;
        const idx = list.findIndex(m => m.id === moveId);
        if (idx >= 0) list.splice(idx, 1);
        return true;
    }

    // golpes da Medalha deslocados por uma peça: voltam quando a peça sai
    function benchList(monster) {
        if (!monster._monBenchedMoves) monster._monBenchedMoves = [];
        return monster._monBenchedMoves;
    }
    MON.Parts.benchedMoves = function(monster) {
        return monster && monster._monBenchedMoves ? monster._monBenchedMoves.slice() : [];
    };

    // devolve os ids recém-ensinados pelas peças
    MON.Parts.syncMoves = function(monster) {
        if (!MON.Parts.isMedabot(monster)) return [];
        const offered = MON.Parts.partMoves(monster);
        const granted = grantedList(monster);
        const benched = benchList(monster);

        for (let i = granted.length - 1; i >= 0; i--) {
            if (offered.includes(granted[i])) continue;
            forgetMove(monster, granted[i]);
            granted.splice(i, 1);
        }
        while (benched.length && monster.moves.length < 4) {
            const moveId = benched.shift();
            if (!monster.knowsMove(moveId)) monster.learnMove(moveId);
        }
        const added = [];
        for (const moveId of offered) {
            if (monster.knowsMove(moveId)) {
                if (!granted.includes(moveId)) granted.push(moveId);
                continue;
            }
            if (monster.learnMove(moveId) === "learned") {
                granted.push(moveId);
                added.push(moveId);
                continue;
            }
            // A peça é o que define um Medabot, então tem prioridade sobre o golpe de
            // nível da Medalha — senão nenhum Medabot da faixa de D3 entraria em
            // batalha com um único golpe de Medapeça. O deslocado vai para a bancada.
            const victim = monster.moves.findIndex(m => !granted.includes(m.id) && !offered.includes(m.id));
            if (victim < 0) break;
            benched.unshift(monster.moves[victim].id);
            monster.replaceMove(victim, moveId);
            granted.push(moveId);
            added.push(moveId);
        }
        return added;
    };

    // treinador com golpes fixos reescreve a lista inteira e apaga o que a peça deu
    const _Game_Monster_setMoves = Game_Monster.prototype.setMoves;
    Game_Monster.prototype.setMoves = function(ids) {
        _Game_Monster_setMoves.call(this, ids);
        if (this._monGrantedMoves) this._monGrantedMoves.length = 0;
        MON.Parts.syncMoves(this);
    };

    //=========================================================================
    // Estoque de peças do jogador
    //=========================================================================
    Game_Party.prototype.monPartsEnsure = function() {
        if (!this._monPartStock) this._monPartStock = {};
        return this._monPartStock;
    };
    Game_Party.prototype.monPartCount = function(partId) {
        return this.monPartsEnsure()[partId] || 0;
    };
    Game_Party.prototype.monGainPart = function(partId, qty = 1) {
        if (!MON.Parts.get(partId)) return false;
        const stock = this.monPartsEnsure();
        stock[partId] = Math.max(0, (stock[partId] || 0) + qty);
        if (!stock[partId]) delete stock[partId];
        return true;
    };
    Game_Party.prototype.monLosePart = function(partId, qty = 1) {
        if (this.monPartCount(partId) < qty) return false;
        return this.monGainPart(partId, -qty);
    };
    Game_Party.prototype.monParts = function() {
        const stock = this.monPartsEnsure();
        return Object.keys(stock)
            .map(id => ({ id, qty: stock[id], data: MON.Parts.get(id) }))
            .filter(entry => !!entry.data);
    };

    //=========================================================================
    // Drop pós-vitória (o sistema novo da franquia)
    //=========================================================================
    MON.Parts.rollDrop = function(defeated, rng) {
        if (!MON.Parts.isMedabot(defeated)) return null;
        const state = slotState(defeated, false);
        if (!state) return null;
        const pool = SLOTS.map(slot => state[slot]).filter(id => id && catalog()[id]);
        if (!pool.length) return null;
        const roll = typeof rng === "function" ? rng(pool.length) : Math.randomInt(pool.length);
        return pool[Math.floor(roll).clamp(0, pool.length - 1)];
    };

    MON.Parts.victoryDrop = function(winner, defeated, rng) {
        const partId = MON.Parts.rollDrop(defeated, rng);
        if (!partId) return [];
        const party = typeof $gameParty !== "undefined" ? $gameParty : null;
        if (!party || !party.monGainPart || !party.monGainPart(partId)) return [];
        return [defeated.name + " perdeu " + MON.Parts.get(partId).name + "! Você recuperou a Medapeça."];
    };

    if (MON.Battle && MON.Battle.registerVictoryHook) {
        MON.Battle.registerVictoryHook((winner, defeated) => MON.Parts.victoryDrop(winner, defeated));
    }

    //=========================================================================
    // Comandos de plugin
    //=========================================================================
    const member = (n) => $gameParty.monParty()[Math.max(0, (Number(n) || 1) - 1)] || null;

    PluginManager.registerCommand(PLUGIN_NAME, "givePart", args => {
        $gameParty.monGainPart(String(args.part), Number(args.qty) || 1);
    });

    PluginManager.registerCommand(PLUGIN_NAME, "equipPart", args => {
        const monster = member(args.member);
        const partId = String(args.part);
        if (!monster || !$gameParty.monLosePart(partId)) return;
        const result = MON.Parts.equip(monster, partId);
        if (!result.ok) { $gameParty.monGainPart(partId); return; }
        if (result.replaced) $gameParty.monGainPart(result.replaced);
    });

    PluginManager.registerCommand(PLUGIN_NAME, "unequipPart", args => {
        const monster = member(args.member);
        const removed = monster && MON.Parts.unequip(monster, String(args.slot));
        if (removed) $gameParty.monGainPart(removed);
    });
})();
