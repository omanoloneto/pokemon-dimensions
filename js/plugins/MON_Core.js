//=============================================================================
// MON_Core.js
//=============================================================================
/*:
 * @target MZ
 * @plugindesc [MON v0.1] Núcleo do port do Pokémon Essentials para MZ. Carrega os
 * dados das espécies e controla o estado da Pokédex (vistos/capturados).
 * @author Pokémon Dimensions (port MZ)
 *
 * @help MON_Core.js
 *
 * Base mínima para os sistemas Pokémon no RPG Maker MZ. Por enquanto fornece:
 *   - $dataMonsters : array de espécies carregado de data/Monsters.json
 *   - $gameSystem.monDex : registro de Pokémon vistos e capturados (salvo no save)
 *   - Comandos de plugin para marcar visto/capturado.
 *
 * INSTALAÇÃO
 *   1. Copie data/Monsters.json para a pasta data/ do seu projeto MZ.
 *   2. Copie js/plugins/MON_Core.js e MON_Codex.js para js/plugins/.
 *   3. No Gerenciador de Plugins, ative MON_Core ANTES de MON_Codex.
 *
 * Este plugin não depende de nenhum outro. MON_Codex depende dele.
 *
 * @command registerSeen
 * @text Registrar Visto
 * @desc Marca uma espécie como vista na Pokédex.
 * @arg id
 * @type number
 * @min 1
 * @text Nº da Pokédex
 * @desc Número nacional da espécie (1 = Bulbasaur).
 *
 * @command registerCaught
 * @text Registrar Capturado
 * @desc Marca uma espécie como vista E capturada na Pokédex.
 * @arg id
 * @type number
 * @min 1
 * @text Nº da Pokédex
 */

var $dataMonsters = $dataMonsters || null;
var $dataMoves = $dataMoves || null;
var $dataTypes = $dataTypes || null;
var $dataItems2 = $dataItems2 || null;       // itens Pokémon (evita colidir com $dataItems do MZ)
var $dataEncounters = $dataEncounters || null;
var $dataTrainers = $dataTrainers || null;

var MON = MON || {};
MON.Core = {};
MON.PLUGIN_NAME = "MON_Core";

(() => {
    "use strict";

    // --- Carrega os bancos de dados Pokémon (data/*.json) ---
    DataManager._databaseFiles.push({ name: "$dataMonsters", src: "Monsters.json" });
    DataManager._databaseFiles.push({ name: "$dataMoves", src: "Moves.json" });
    DataManager._databaseFiles.push({ name: "$dataTypes", src: "Types.json" });
    DataManager._databaseFiles.push({ name: "$dataItems2", src: "MonItems.json" });
    DataManager._databaseFiles.push({ name: "$dataEncounters", src: "Encounters.json" });
    DataManager._databaseFiles.push({ name: "$dataTrainers", src: "Trainers.json" });

    // --- Tabela de eficácia de tipos ---
    MON.Core.typeEffectiveness = function(atkType, defType) {
        if (!$dataTypes || !$dataTypes.chart) return 1;
        const row = $dataTypes.chart[atkType];
        if (!row || row[defType] === undefined) return 1;
        return row[defType];
    };
    // multiplicador total contra um ou dois tipos
    MON.Core.typeMultiplier = function(atkType, defTypes) {
        return defTypes.reduce((m, t) => m * MON.Core.typeEffectiveness(atkType, t), 1);
    };
    MON.Core.move = function(internalName) {
        return ($dataMoves && $dataMoves[internalName]) || null;
    };
    MON.Core.item = function(internalName) {
        return ($dataItems2 && $dataItems2[internalName]) || null;
    };

    // --- Acesso a espécies ----------------------------------------------------
    MON.Core.species = function(id) {
        return ($dataMonsters && $dataMonsters[id]) || null;
    };
    MON.Core.maxSpecies = function() {
        return $dataMonsters ? $dataMonsters.length - 1 : 0;
    };
    // ids realmente preenchidos (as faixas de franquia deixam buracos)
    // franquia com "roster: false" (humanos) fica fora da Pokedex: inflaria o
    // total com entradas que nunca podem ser vistas
    MON.Core.allSpeciesIds = function() {
        const out = [];
        for (let i = 1; i <= MON.Core.maxSpecies(); i++) {
            if (!$dataMonsters[i]) continue;
            const fr = MON.Franchise && MON.Franchise.ofSpecies(i);
            if (fr && fr.roster === false) continue;
            out.push(i);
        }
        return out;
    };

    // Carrega sprite FORA do cache do ImageManager: monstro sem imagem ainda não
    // instalada não pode derrubar a cena via ImageManager.throwLoadError.
    MON.Core.loadSprite = function(folder, filename) {
        if (typeof Bitmap === "undefined") return null;
        const url = folder + (typeof Utils !== "undefined" ? Utils.encodeURI(filename) : filename) + ".png";
        return Bitmap.load(url);
    };

    MON.Core.speciesByInternal = function(internalName) {
        if (!$dataMonsters || !internalName) return null;
        const up = internalName.toUpperCase();
        for (let i = 1; i < $dataMonsters.length; i++) {
            if ($dataMonsters[i] && $dataMonsters[i].internalName.toUpperCase() === up) return $dataMonsters[i];
        }
        return null;
    };

    //=========================================================================
    // Estado da Pokédex — persiste no save via Game_System
    //=========================================================================
    const _GameSystem_initialize = Game_System.prototype.initialize;
    Game_System.prototype.initialize = function() {
        _GameSystem_initialize.call(this);
        this.monDex = { seen: {}, caught: {} };
    };

    Game_System.prototype.monEnsureDex = function() {
        if (!this.monDex) this.monDex = { seen: {}, caught: {} };
        if (!this.monDex.seen) this.monDex.seen = {};
        if (!this.monDex.caught) this.monDex.caught = {};
        return this.monDex;
    };

    Game_System.prototype.monSetSeen = function(id) {
        this.monEnsureDex().seen[id] = true;
    };
    Game_System.prototype.monSetCaught = function(id) {
        const dex = this.monEnsureDex();
        dex.seen[id] = true;
        dex.caught[id] = true;
    };
    Game_System.prototype.monIsSeen = function(id) {
        return !!this.monEnsureDex().seen[id];
    };
    Game_System.prototype.monIsCaught = function(id) {
        return !!this.monEnsureDex().caught[id];
    };
    Game_System.prototype.monSeenCount = function() {
        return Object.keys(this.monEnsureDex().seen).length;
    };
    Game_System.prototype.monCaughtCount = function() {
        return Object.keys(this.monEnsureDex().caught).length;
    };

    // --- Atalhos globais convenientes ----------------------------------------
    MON.Core.setSeen   = (id) => $gameSystem.monSetSeen(id);
    MON.Core.setCaught = (id) => $gameSystem.monSetCaught(id);

    //=========================================================================
    // Comandos de plugin
    //=========================================================================
    PluginManager.registerCommand(MON.PLUGIN_NAME, "registerSeen", args => {
        $gameSystem.monSetSeen(Number(args.id));
    });
    PluginManager.registerCommand(MON.PLUGIN_NAME, "registerCaught", args => {
        $gameSystem.monSetCaught(Number(args.id));
    });
})();
