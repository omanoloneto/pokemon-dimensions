//=============================================================================
// MON_Human.js — humanos como combatentes
//=============================================================================
/*:
 * @target MZ
 * @plugindesc [MON v0.5] Humanos em campo: Game_Human luta lado a lado com os
 * monstros, com HP, golpes e derrota próprios.
 * @author Pokémon Dimensions
 * @base MON_Core
 * @base MON_Monster
 * @orderAfter MON_Monster
 * @orderBefore MON_Field
 *
 * @help MON_Human.js
 *
 * Game_Human ESTENDE Game_Monster de propósito: assim o motor inteiro (dano,
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
 *   $gameParty.monSetAvatar(you);      // seu humano, slot 0 do time em batalha
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

var MON = MON || {};
MON.Human = MON.Human || {};

(() => {
    "use strict";

    const DEFAULT_CLASS = "TRAINER";

    //=========================================================================
    // Game_Human
    //=========================================================================
    window.Game_Human = function() { this.initialize(...arguments); };
    Game_Human.prototype = Object.create(Game_Monster.prototype);
    Game_Human.prototype.constructor = Game_Human;

    Game_Human.prototype.initialize = function(klass, level, opts = {}) {
        Game_Monster.prototype.initialize.call(this, klass || DEFAULT_CLASS, level);
        this._shiny = false;
        this._personName = opts.name || null;
        this._portrait = opts.portrait || null;
        if (opts.gender) this._gender = opts.gender;
        if (opts.moves) this.setMoves(opts.moves);
    };

    Game_Human.prototype.isHuman = function() { return true; };
    Game_Monster.prototype.isHuman = function() { return false; };

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

    MON.Human.create = function(klass, level, opts) {
        return new Game_Human(klass, level, opts);
    };
    MON.Human.isHuman = function(unit) { return !!(unit && unit.isHuman && unit.isHuman()); };

    MON.Human.classes = function() {
        return MON.Franchise ? MON.Franchise.speciesOf("HUM") : [];
    };

    //=========================================================================
    // Avatar do jogador — o humano que entra no slot 0 do time
    //=========================================================================
    Game_Party.prototype.monSetAvatar = function(human) {
        this._monAvatar = human || null;
        return this._monAvatar;
    };
    // o jogador SEMPRE luta em campo: sem avatar definido por evento, cria o padrao
    Game_Party.prototype.monAvatar = function() {
        if (!this._monAvatar && MON.Human.classes().length) {
            this._monAvatar = new Game_Human(DEFAULT_CLASS, 5, { name: defaultAvatarName() });
        }
        return this._monAvatar || null;
    };
    Game_Party.prototype.monBattleTeam = function() {
        const monsters = this.monParty ? this.monParty().filter(p => p && !p.isFainted()) : [];
        const avatar = this.monAvatar();
        return avatar && !avatar.isFainted() ? [avatar].concat(monsters) : monsters;
    };
    // tudo que o jogador pode curar/reviver, inclusive o humano
    Game_Party.prototype.monBattleRoster = function() {
        const monsters = this.monParty ? this.monParty().slice() : [];
        const avatar = this.monAvatar();
        return avatar ? [avatar].concat(monsters) : monsters;
    };

    function defaultAvatarName() {
        const actor = typeof $gameActors !== "undefined" && $gameActors.actor(1);
        return (actor && actor.name()) || "Você";
    }

    //=========================================================================
    // Efeitos das ações humanas
    //=========================================================================
    const HUMAN_EFFECTS = {
        TACTICALCALL: { stats: { atk: -1, spa: -1 }, target: "foe" },
        READTHEFIELD: { stats: { spe: -2 }, target: "foe" },
        INTIMIDATIONSTARE: { stats: { def: -1, spd: -1 }, target: "foe" },
        FLASHGRENADE: { stats: { acc: -2 }, target: "foe" },
        ROBATTLESUBMIT: { stats: { atk: -2 }, target: "foe" },
        BRACEFORIMPACT: { stats: { def: 1, spd: 1 }, target: "self" },
        WARCRY: { stats: { atk: 1, spe: 1 }, target: "self" },
        COLDREAD: { stats: { spa: 1, spd: 1 }, target: "self" }
    };

    // MON_Battle carrega DEPOIS deste plugin no jogo (e antes, no harness):
    // registra assim que o registry existir, sem depender da ordem.
    MON.Human.installEffects = function() {
        if (!MON.Battle || !MON.Battle.MOVE_EFFECTS) return false;
        Object.assign(MON.Battle.MOVE_EFFECTS, HUMAN_EFFECTS);
        return true;
    };
    if (!MON.Human.installEffects() && typeof Scene_Boot !== "undefined") {
        const _onDatabaseLoaded = Scene_Boot.prototype.onDatabaseLoaded;
        Scene_Boot.prototype.onDatabaseLoaded = function() {
            MON.Human.installEffects();
            _onDatabaseLoaded.call(this);
        };
    }

    //=========================================================================
    // Comandos de plugin
    //=========================================================================
    if (typeof PluginManager !== "undefined") {
        PluginManager.registerCommand("MON_Human", "setAvatar", args => {
            const human = new Game_Human(args.klass || DEFAULT_CLASS, Number(args.level) || 5,
                { name: args.name });
            $gameParty.monSetAvatar(human);
        });
    }
})();
