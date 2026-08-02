//=============================================================================
// PKM_Parts.js  — Medabots: Medapeças trocáveis
//=============================================================================
/*:
 * @target MZ
 * @plugindesc [PKM v0.3] Medabots: 4 slots de Medapeça por monstro (head/rArm/lArm/
 * legs), estoque de peças no save e drop de peça ao vencer uma Robattle.
 * @author Pokémon Dimensions
 * @base PKM_Core
 * @base PKM_Pokemon
 * @base PKM_Franchise
 * @orderAfter PKM_Franchise
 * @orderAfter PKM_Battle
 * @orderAfter PKM_Party
 *
 * @help PKM_Parts.js
 *
 * A Medalha é o monstro: ela carrega nível e EXP. O corpo são 4 Medapeças
 * trocáveis que somam stats e substituem os golpes disponíveis em batalha.
 * Vencer uma Robattle contra um Medabot dropa 1 peça do loadout dele.
 *
 * DESVIO CONSCIENTE DO DESIGN (docs/02-franquias.md)
 *   O documento sugeria usar o equipamento NATIVO do MZ (traits Add Skill /
 *   Parameter). Não dá: nossos monstros são Game_Pokemon, não Game_Actor, e
 *   portanto não têm equips nem traits. Os 4 slots são implementados aqui,
 *   direto no Game_Pokemon, com o mesmo efeito prático (stats + golpes).
 *   Nada de dano localizado por parte nem Medaforce — fora de escopo.
 *
 * Catálogo: data/Parts.json (array). Slots válidos: head, rArm, lArm, legs.
 * "legs" dá bônus de velocidade e nunca traz golpe.
 *
 * API
 *   PKM.Parts.equip(pokemon, partId)   -> {ok, message, replaced}
 *   PKM.Parts.unequip(pokemon, slot)   -> partId removido ou null
 *   PKM.Parts.equipped(pokemon)        -> {head, rArm, lArm, legs} (ids)
 *   PKM.Parts.loadout(pokemon)         -> {head, rArm, lArm, legs} (dados)
 *   PKM.Parts.statBonus(pokemon, key)  -> soma dos bônus das peças
 *   PKM.Parts.rollDrop(defeated, rng)  -> partId sorteado ou null (puro)
 *   PKM.Parts.victoryDrop(winner, defeated, rng) -> [mensagens]
 *
 * Estoque do jogador (salvo no save, separado do loadout do Medabot):
 *   $gameParty.pkmGainPart(id, qty) / pkmLosePart(id, qty)
 *   $gameParty.pkmPartCount(id)     / pkmParts() -> [{id, qty, data}]
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

var PKM = PKM || {};
PKM.Parts = PKM.Parts || {};

(() => {
    "use strict";

    const PLUGIN_NAME = "PKM_Parts";
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

    PKM.Parts.SLOTS = SLOTS.slice();
    PKM.Parts.get = (partId) => catalog()[partId] || null;
    PKM.Parts.all = () => Object.values(catalog());
    PKM.Parts.byModel = (model) => PKM.Parts.all().filter(p => p.model === model);
    PKM.Parts.bySlot = (slot) => PKM.Parts.all().filter(p => p.slot === slot);
    PKM.Parts.isMedabot = (pokemon) => !!pokemon && PKM.Franchise.idOf(pokemon) === FRANCHISE_ID;

    //=========================================================================
    // Slots do monstro
    //=========================================================================
    function slotState(pokemon, create) {
        if (!pokemon) return null;
        if (!pokemon._pkmParts && create) {
            pokemon._pkmParts = { head: null, rArm: null, lArm: null, legs: null };
        }
        return pokemon._pkmParts || null;
    }

    function clampHp(pokemon) {
        if (pokemon.hp > pokemon.maxHp) pokemon.hp = pokemon.maxHp;
    }

    PKM.Parts.equipped = function(pokemon) {
        const state = slotState(pokemon, false);
        const out = {};
        for (const slot of SLOTS) out[slot] = (state && state[slot]) || null;
        return out;
    };

    PKM.Parts.loadout = function(pokemon) {
        const ids = PKM.Parts.equipped(pokemon);
        const out = {};
        for (const slot of SLOTS) out[slot] = ids[slot] ? PKM.Parts.get(ids[slot]) : null;
        return out;
    };

    PKM.Parts.equip = function(pokemon, partId) {
        if (!PKM.Parts.isMedabot(pokemon)) {
            return { ok: false, message: "Só Medabots aceitam Medapeças.", replaced: null };
        }
        const part = PKM.Parts.get(partId);
        if (!part) {
            return { ok: false, message: "Medapeça desconhecida: " + partId + ".", replaced: null };
        }
        if (!SLOTS.includes(part.slot)) {
            return { ok: false, message: part.name + " não encaixa em nenhum slot.", replaced: null };
        }
        const state = slotState(pokemon, true);
        if (state[part.slot] === partId) {
            return { ok: false, message: pokemon.name + " já usa " + part.name + ".", replaced: null };
        }
        const replaced = state[part.slot] || null;
        state[part.slot] = partId;
        clampHp(pokemon);
        return { ok: true, message: pokemon.name + " montou " + part.name + ".", replaced };
    };

    PKM.Parts.unequip = function(pokemon, slot) {
        if (!PKM.Parts.isMedabot(pokemon) || !SLOTS.includes(slot)) return null;
        const state = slotState(pokemon, false);
        if (!state || !state[slot]) return null;
        const removed = state[slot];
        state[slot] = null;
        clampHp(pokemon);
        return removed;
    };

    //=========================================================================
    // Stats: alias que soma os bônus das peças
    //=========================================================================
    PKM.Parts.statBonus = function(pokemon, key) {
        const state = slotState(pokemon, false);
        if (!state) return 0;
        let sum = 0;
        for (const slot of SLOTS) {
            const part = state[slot] && catalog()[state[slot]];
            if (part && part.stats && part.stats[key]) sum += part.stats[key];
        }
        return sum;
    };

    const _Game_Pokemon_stat = Game_Pokemon.prototype.stat;
    Game_Pokemon.prototype.stat = function(key) {
        const bonus = PKM.Parts.statBonus(this, key);
        const value = _Game_Pokemon_stat.call(this, key);
        return bonus ? Math.max(1, value + bonus) : value;
    };

    //=========================================================================
    // Golpes das peças
    //=========================================================================
    // A batalha lê pokemon.moves; em vez de escrever dentro de _moves (destrutivo,
    // e o monstro perderia os golpes ao desmontar), o getter passa a devolver os
    // golpes das peças e cai de volta na lista própria do monstro quando não há peça.
    PKM.Parts.partMoves = function(pokemon) {
        const state = slotState(pokemon, false);
        if (!state) return [];
        const cache = pokemon._pkmPartMoves || (pokemon._pkmPartMoves = {});
        const out = [];
        for (const slot of SLOTS) {
            const part = state[slot] && catalog()[state[slot]];
            const moveId = part && part.move;
            if (!moveId || out.some(m => m.id === moveId)) continue;
            const data = PKM.Core.move(moveId);
            if (!data) continue;
            if (!cache[moveId]) cache[moveId] = { id: moveId, pp: data.pp, ppMax: data.pp };
            out.push(cache[moveId]);
        }
        return out;
    };

    const _movesDescriptor = Object.getOwnPropertyDescriptor(Game_Pokemon.prototype, "moves");
    Object.defineProperty(Game_Pokemon.prototype, "moves", {
        get() {
            const fromParts = PKM.Parts.partMoves(this);
            return fromParts.length ? fromParts : _movesDescriptor.get.call(this);
        },
        configurable: true
    });

    const _Game_Pokemon_healFully = Game_Pokemon.prototype.healFully;
    Game_Pokemon.prototype.healFully = function() {
        _Game_Pokemon_healFully.call(this);
        for (const move of PKM.Parts.partMoves(this)) move.pp = move.ppMax;
    };

    //=========================================================================
    // Estoque de peças do jogador
    //=========================================================================
    Game_Party.prototype.pkmPartsEnsure = function() {
        if (!this._pkmPartStock) this._pkmPartStock = {};
        return this._pkmPartStock;
    };
    Game_Party.prototype.pkmPartCount = function(partId) {
        return this.pkmPartsEnsure()[partId] || 0;
    };
    Game_Party.prototype.pkmGainPart = function(partId, qty = 1) {
        if (!PKM.Parts.get(partId)) return false;
        const stock = this.pkmPartsEnsure();
        stock[partId] = Math.max(0, (stock[partId] || 0) + qty);
        if (!stock[partId]) delete stock[partId];
        return true;
    };
    Game_Party.prototype.pkmLosePart = function(partId, qty = 1) {
        if (this.pkmPartCount(partId) < qty) return false;
        return this.pkmGainPart(partId, -qty);
    };
    Game_Party.prototype.pkmParts = function() {
        const stock = this.pkmPartsEnsure();
        return Object.keys(stock)
            .map(id => ({ id, qty: stock[id], data: PKM.Parts.get(id) }))
            .filter(entry => !!entry.data);
    };

    //=========================================================================
    // Drop pós-vitória (o sistema novo da franquia)
    //=========================================================================
    PKM.Parts.rollDrop = function(defeated, rng) {
        if (!PKM.Parts.isMedabot(defeated)) return null;
        const state = slotState(defeated, false);
        if (!state) return null;
        const pool = SLOTS.map(slot => state[slot]).filter(id => id && catalog()[id]);
        if (!pool.length) return null;
        const roll = typeof rng === "function" ? rng(pool.length) : Math.randomInt(pool.length);
        return pool[Math.floor(roll).clamp(0, pool.length - 1)];
    };

    PKM.Parts.victoryDrop = function(winner, defeated, rng) {
        const partId = PKM.Parts.rollDrop(defeated, rng);
        if (!partId) return [];
        const party = typeof $gameParty !== "undefined" ? $gameParty : null;
        if (!party || !party.pkmGainPart || !party.pkmGainPart(partId)) return [];
        return [defeated.name + " perdeu " + PKM.Parts.get(partId).name + "! Você recuperou a Medapeça."];
    };

    if (PKM.Battle && PKM.Battle.registerVictoryHook) {
        PKM.Battle.registerVictoryHook((winner, defeated) => PKM.Parts.victoryDrop(winner, defeated));
    }

    //=========================================================================
    // Comandos de plugin
    //=========================================================================
    const member = (n) => $gameParty.pkmParty()[Math.max(0, (Number(n) || 1) - 1)] || null;

    PluginManager.registerCommand(PLUGIN_NAME, "givePart", args => {
        $gameParty.pkmGainPart(String(args.part), Number(args.qty) || 1);
    });

    PluginManager.registerCommand(PLUGIN_NAME, "equipPart", args => {
        const pokemon = member(args.member);
        const partId = String(args.part);
        if (!pokemon || !$gameParty.pkmLosePart(partId)) return;
        const result = PKM.Parts.equip(pokemon, partId);
        if (!result.ok) { $gameParty.pkmGainPart(partId); return; }
        if (result.replaced) $gameParty.pkmGainPart(result.replaced);
    });

    PluginManager.registerCommand(PLUGIN_NAME, "unequipPart", args => {
        const pokemon = member(args.member);
        const removed = pokemon && PKM.Parts.unequip(pokemon, String(args.slot));
        if (removed) $gameParty.pkmGainPart(removed);
    });
})();
