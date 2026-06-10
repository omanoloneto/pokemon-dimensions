//=============================================================================
// PKM_Core.js
//=============================================================================
/*:
 * @target MZ
 * @plugindesc [PKM v0.1] Núcleo do port do Pokémon Essentials para MZ. Carrega os
 * dados das espécies e controla o estado da Pokédex (vistos/capturados).
 * @author Pokémon Dimensions (port MZ)
 *
 * @help PKM_Core.js
 *
 * Base mínima para os sistemas Pokémon no RPG Maker MZ. Por enquanto fornece:
 *   - $dataPokemon : array de espécies carregado de data/Pokemon.json
 *   - $gameSystem.pkmDex : registro de Pokémon vistos e capturados (salvo no save)
 *   - Comandos de plugin para marcar visto/capturado.
 *
 * INSTALAÇÃO
 *   1. Copie data/Pokemon.json para a pasta data/ do seu projeto MZ.
 *   2. Copie js/plugins/PKM_Core.js e PKM_Pokedex.js para js/plugins/.
 *   3. No Gerenciador de Plugins, ative PKM_Core ANTES de PKM_Pokedex.
 *
 * Este plugin não depende de nenhum outro. PKM_Pokedex depende dele.
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

var $dataPokemon = $dataPokemon || null;
var $dataMoves = $dataMoves || null;
var $dataTypes = $dataTypes || null;
var $dataItems2 = $dataItems2 || null;       // itens Pokémon (evita colidir com $dataItems do MZ)
var $dataEncounters = $dataEncounters || null;
var $dataTrainers = $dataTrainers || null;

var PKM = PKM || {};
PKM.Core = {};
PKM.PLUGIN_NAME = "PKM_Core";

(() => {
    "use strict";

    // --- Carrega os bancos de dados Pokémon (data/*.json) ---
    DataManager._databaseFiles.push({ name: "$dataPokemon", src: "Pokemon.json" });
    DataManager._databaseFiles.push({ name: "$dataMoves", src: "Moves.json" });
    DataManager._databaseFiles.push({ name: "$dataTypes", src: "Types.json" });
    DataManager._databaseFiles.push({ name: "$dataItems2", src: "PkmItems.json" });
    DataManager._databaseFiles.push({ name: "$dataEncounters", src: "Encounters.json" });
    DataManager._databaseFiles.push({ name: "$dataTrainers", src: "Trainers.json" });

    // --- Tabela de eficácia de tipos ---
    PKM.Core.typeEffectiveness = function(atkType, defType) {
        if (!$dataTypes || !$dataTypes.chart) return 1;
        const row = $dataTypes.chart[atkType];
        if (!row || row[defType] === undefined) return 1;
        return row[defType];
    };
    // multiplicador total contra um ou dois tipos
    PKM.Core.typeMultiplier = function(atkType, defTypes) {
        return defTypes.reduce((m, t) => m * PKM.Core.typeEffectiveness(atkType, t), 1);
    };
    PKM.Core.move = function(internalName) {
        return ($dataMoves && $dataMoves[internalName]) || null;
    };
    PKM.Core.item = function(internalName) {
        return ($dataItems2 && $dataItems2[internalName]) || null;
    };

    // --- Acesso a espécies ----------------------------------------------------
    PKM.Core.species = function(id) {
        return ($dataPokemon && $dataPokemon[id]) || null;
    };
    PKM.Core.maxSpecies = function() {
        return $dataPokemon ? $dataPokemon.length - 1 : 0;
    };
    PKM.Core.speciesByInternal = function(internalName) {
        if (!$dataPokemon || !internalName) return null;
        const up = internalName.toUpperCase();
        for (let i = 1; i < $dataPokemon.length; i++) {
            if ($dataPokemon[i] && $dataPokemon[i].internalName === up) return $dataPokemon[i];
        }
        return null;
    };

    //=========================================================================
    // Estado da Pokédex — persiste no save via Game_System
    //=========================================================================
    const _GameSystem_initialize = Game_System.prototype.initialize;
    Game_System.prototype.initialize = function() {
        _GameSystem_initialize.call(this);
        this.pkmDex = { seen: {}, caught: {} };
    };

    Game_System.prototype.pkmEnsureDex = function() {
        if (!this.pkmDex) this.pkmDex = { seen: {}, caught: {} };
        if (!this.pkmDex.seen) this.pkmDex.seen = {};
        if (!this.pkmDex.caught) this.pkmDex.caught = {};
        return this.pkmDex;
    };

    Game_System.prototype.pkmSetSeen = function(id) {
        this.pkmEnsureDex().seen[id] = true;
    };
    Game_System.prototype.pkmSetCaught = function(id) {
        const dex = this.pkmEnsureDex();
        dex.seen[id] = true;
        dex.caught[id] = true;
    };
    Game_System.prototype.pkmIsSeen = function(id) {
        return !!this.pkmEnsureDex().seen[id];
    };
    Game_System.prototype.pkmIsCaught = function(id) {
        return !!this.pkmEnsureDex().caught[id];
    };
    Game_System.prototype.pkmSeenCount = function() {
        return Object.keys(this.pkmEnsureDex().seen).length;
    };
    Game_System.prototype.pkmCaughtCount = function() {
        return Object.keys(this.pkmEnsureDex().caught).length;
    };

    // --- Atalhos globais convenientes ----------------------------------------
    PKM.Core.setSeen   = (id) => $gameSystem.pkmSetSeen(id);
    PKM.Core.setCaught = (id) => $gameSystem.pkmSetCaught(id);

    //=========================================================================
    // Comandos de plugin
    //=========================================================================
    PluginManager.registerCommand(PKM.PLUGIN_NAME, "registerSeen", args => {
        $gameSystem.pkmSetSeen(Number(args.id));
    });
    PluginManager.registerCommand(PKM.PLUGIN_NAME, "registerCaught", args => {
        $gameSystem.pkmSetCaught(Number(args.id));
    });
})();
