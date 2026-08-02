//=============================================================================
// PKM_Trainers.js  — Fase 9
//=============================================================================
/*:
 * @target MZ
 * @plugindesc [PKM v0.4] Batalhas de treinador (equipes múltiplas, recompensa em
 * dinheiro, sem captura/fuga) e insígnias de ginásio.
 * @author Pokémon Dimensions (port MZ)
 * @base PKM_Core
 * @base PKM_Pokemon
 * @base PKM_Party
 * @base PKM_Battle
 * @orderAfter PKM_Battle
 *
 * @help PKM_Trainers.js
 *
 * Carrega data/Trainers.json (compilado de trainers.txt + trainertypes.txt).
 * Em batalha de treinador: o oponente envia cada Pokémon em sequência, não é
 * possível capturar nem fugir, e ao vencer você recebe prêmio em dinheiro
 * (baseMoney do tipo × nível do último Pokémon).
 *
 *   PKM.Trainers.start("LEADER_Brock", "Brock", {defeatText:"Impressionante!"})
 *
 * Insígnias: $gameSystem.pkmGiveBadge("KANTO_1"), pkmHasBadge(id), pkmBadgeCount().
 *
 * @command battle
 * @text Batalha de Treinador
 * @arg type @type string @text Tipo @desc internalName do tipo (ex.: LEADER_Brock, YOUNGSTER).
 * @arg name @type string @text Nome @desc Nome do treinador (ex.: Brock). Vazio = primeiro do tipo.
 * @arg partyId @type number @min 0 @default 0 @text Variante @desc Para tipos com várias equipes de mesmo nome.
 * @arg introText @type string @text Fala inicial @desc Opcional.
 * @arg defeatText @type string @text Fala ao perder @desc Opcional (dita quando você vence).
 *
 * @command giveBadge
 * @text Dar Insígnia
 * @arg badge @type string @text ID da insígnia @desc ex.: KANTO_1
 */

var PKM = PKM || {};

(() => {
    "use strict";

    PKM.Trainers = PKM.Trainers || {};

    PKM.Trainers.type = function(internalName) {
        return ($dataTrainers && $dataTrainers.types && $dataTrainers.types[internalName]) || null;
    };
    PKM.Trainers.find = function(type, name, partyId) {
        const list = ($dataTrainers && $dataTrainers.list) || [];
        return list.find(t =>
            t.type === type &&
            (!name || t.name === name) &&
            (partyId == null || t.partyId === Number(partyId))
        ) || null;
    };

    // monta um treinador "vivo": party de Game_Pokemon + prêmio + nome de exibição
    PKM.Trainers.build = function(def, opts = {}) {
        const type = PKM.Trainers.type(def.type) || {};
        const party = def.party.map(m => {
            const p = new Game_Pokemon(m.species, m.level);
            if (m.moves && m.moves.length) p.setMoves(m.moves);
            if (m.gender) p._gender = m.gender;
            if (m.shiny) p._shiny = true;
            return p;
        });
        const lastLevel = def.party.reduce((mx, m) => Math.max(mx, m.level), 0);
        const money = (type.baseMoney || 30) * lastLevel;
        const display = (type.name ? type.name + " " : "") + def.name;
        return {
            name: display, party, money,
            introText: opts.introText || null,
            defeatText: opts.defeatText || null
        };
    };

    PKM.Trainers.start = function(type, name, opts = {}) {
        const def = PKM.Trainers.find(type, name, opts.partyId);
        if (!def) { console.warn("PKM: treinador não encontrado:", type, name); return false; }
        if ($gameParty.pkmCount && $gameParty.pkmCount() === 0) return false;
        $gameTemp.pkmTrainer = PKM.Trainers.build(def, opts);
        SceneManager.push(Scene_PkmBattle);
        return true;
    };

    //=========================================================================
    // Insígnias (Game_System)
    //=========================================================================
    Game_System.prototype.pkmGiveBadge = function(id) {
        if (!this._pkmBadges) this._pkmBadges = [];
        if (!this._pkmBadges.includes(id)) this._pkmBadges.push(id);
    };
    Game_System.prototype.pkmHasBadge = function(id) {
        return !!(this._pkmBadges && this._pkmBadges.includes(id));
    };
    Game_System.prototype.pkmBadgeCount = function() {
        return this._pkmBadges ? this._pkmBadges.length : 0;
    };

    //=========================================================================
    // Comandos de plugin
    //=========================================================================
    PluginManager.registerCommand("PKM_Trainers", "battle", args => {
        PKM.Trainers.start(args.type, args.name || null, {
            partyId: args.partyId !== undefined ? Number(args.partyId) : 0,
            introText: args.introText || null,
            defeatText: args.defeatText || null
        });
    });
    PluginManager.registerCommand("PKM_Trainers", "giveBadge", args => {
        $gameSystem.pkmGiveBadge(args.badge);
    });
})();
