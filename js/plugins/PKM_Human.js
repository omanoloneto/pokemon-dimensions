//=============================================================================
// PKM_Human.js — humanos como combatentes
//=============================================================================
/*:
 * @target MZ
 * @plugindesc [PKM v0.5] Humanos em campo: Game_Human luta lado a lado com os
 * monstros, com HP, golpes e derrota próprios.
 * @author Pokémon Dimensions
 * @base PKM_Core
 * @base PKM_Pokemon
 * @orderAfter PKM_Pokemon
 * @orderBefore PKM_Field
 *
 * @help PKM_Human.js
 *
 * Game_Human ESTENDE Game_Pokemon de propósito: assim o motor inteiro (dano,
 * tipos, status, estágios, ordem de turno, campo em times) trata humano e monstro
 * pela mesma interface, sem um segundo sistema de combate.
 *
 * Diferenças de um monstro:
 *   - nome é da pessoa, não da espécie ("Ash", não "Treinador")
 *   - não é capturável, não entra na Pokédex nem no PC
 *   - não evolui e não é shiny
 *
 * As "espécies" humanas (data/species/HUM.json, ids 920-969) são CLASSES de
 * personagem — Treinador, Grande Criança, Medafighter — e definem stats e golpes.
 *
 *   const you = new Game_Human("TRAINER", 5, { name: "Manolo" });
 *   $gameParty.pkmSetAvatar(you);      // seu humano, slot 0 do time em batalha
 *
 * @command setAvatar
 * @text Definir Avatar
 * @desc Define o humano que o jogador controla em batalha (slot 0 do time).
 * @arg klass
 * @type string
 * @default TRAINER
 * @text Classe
 * @arg name
 * @type string
 * @text Nome
 * @arg level
 * @type number
 * @min 1
 * @default 5
 * @text Nível
 */

var PKM = PKM || {};
PKM.Human = PKM.Human || {};

(() => {
    "use strict";

    const DEFAULT_CLASS = "TRAINER";

    //=========================================================================
    // Game_Human
    //=========================================================================
    window.Game_Human = function() { this.initialize(...arguments); };
    Game_Human.prototype = Object.create(Game_Pokemon.prototype);
    Game_Human.prototype.constructor = Game_Human;

    Game_Human.prototype.initialize = function(klass, level, opts = {}) {
        Game_Pokemon.prototype.initialize.call(this, klass || DEFAULT_CLASS, level);
        this._shiny = false;
        this._personName = opts.name || null;
        this._portrait = opts.portrait || null;
        if (opts.gender) this._gender = opts.gender;
        if (opts.moves) this.setMoves(opts.moves);
    };

    Game_Human.prototype.isHuman = function() { return true; };
    Game_Pokemon.prototype.isHuman = function() { return false; };

    // o nome é da pessoa; a "espécie" é a classe (Treinador, Grande Criança...)
    Object.defineProperty(Game_Human.prototype, "name", {
        get() { return this._personName || this._nickname || this.speciesName; },
        configurable: true
    });
    Object.defineProperty(Game_Human.prototype, "className", {
        get() { return this.speciesName; }, configurable: true
    });

    Game_Human.prototype.evolutionByLevel = function() { return null; };
    Game_Human.prototype.frontImageName = function() {
        return this._portrait || String(this._speciesId).padStart(3, "0");
    };

    PKM.Human.create = function(klass, level, opts) {
        return new Game_Human(klass, level, opts);
    };
    PKM.Human.isHuman = function(unit) { return !!(unit && unit.isHuman && unit.isHuman()); };

    PKM.Human.classes = function() {
        return PKM.Franchise ? PKM.Franchise.speciesOf("HUM") : [];
    };

    //=========================================================================
    // Avatar do jogador — o humano que entra no slot 0 do time
    //=========================================================================
    Game_Party.prototype.pkmSetAvatar = function(human) {
        this._pkmAvatar = human || null;
        return this._pkmAvatar;
    };
    Game_Party.prototype.pkmAvatar = function() {
        return this._pkmAvatar || null;
    };
    Game_Party.prototype.pkmBattleTeam = function() {
        const monsters = this.pkmParty ? this.pkmParty().filter(p => p && !p.isFainted()) : [];
        const avatar = this.pkmAvatar();
        return avatar && !avatar.isFainted() ? [avatar].concat(monsters) : monsters;
    };

    //=========================================================================
    // Comandos de plugin
    //=========================================================================
    if (typeof PluginManager !== "undefined") {
        PluginManager.registerCommand("PKM_Human", "setAvatar", args => {
            const human = new Game_Human(args.klass || DEFAULT_CLASS, Number(args.level) || 5,
                { name: args.name });
            $gameParty.pkmSetAvatar(human);
        });
    }
})();
