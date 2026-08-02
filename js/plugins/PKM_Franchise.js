//=============================================================================
// PKM_Franchise.js  — camada multi-franquia
//=============================================================================
/*:
 * @target MZ
 * @plugindesc [PKM v0.3] Camada multi-franquia: registro de dimensões, merge dos
 * dados extras (espécies, golpes, itens) e regras de captura por franquia.
 * @author Pokémon Dimensions
 * @base PKM_Core
 * @orderAfter PKM_Core
 * @orderBefore PKM_Battle
 *
 * @help PKM_Franchise.js
 *
 * Cada franquia ocupa uma faixa contígua de IDs de espécie (data/Franchises.json):
 *   PKM 1-649 | DGM 650-799 | MDB 800-849 | MRA 850-899 | BKY 900-919
 *
 * Funde em runtime os arquivos "Extra" nos bancos base, para que os monstros de
 * todas as franquias vivam no mesmo $dataPokemon/$dataMoves/$dataItems2 e usem o
 * mesmo motor de batalha, captura, party e PC.
 *
 * API:
 *   PKM.Franchise.get(id) / all() / ofSpecies(speciesId) / of(pokemon)
 *   PKM.Franchise.captureRule(pokemon, itemName) -> {allowed, reason}
 *   PKM.Franchise.captureItems(franchiseId) -> [internalName]
 *   PKM.Franchise.registerCaptureGate(fn) -> gate extra (usado por PKM_Pacts)
 */

var $dataFranchises = $dataFranchises || null;
var $dataSpeciesExtra = $dataSpeciesExtra || null;
var $dataMovesExtra = $dataMovesExtra || null;
var $dataItemsExtra = $dataItemsExtra || null;

var PKM = PKM || {};
PKM.Franchise = PKM.Franchise || {};

(() => {
    "use strict";

    const DEFAULT_FRANCHISE = "PKM";

    DataManager._databaseFiles.push({ name: "$dataFranchises", src: "Franchises.json" });
    DataManager._databaseFiles.push({ name: "$dataSpeciesExtra", src: "SpeciesExtra.json" });
    DataManager._databaseFiles.push({ name: "$dataMovesExtra", src: "MovesExtra.json" });
    DataManager._databaseFiles.push({ name: "$dataItemsExtra", src: "ItemsExtra.json" });

    //=========================================================================
    // Merge dos bancos extras nos bancos base (idempotente)
    //=========================================================================
    let installed = false;

    PKM.Franchise.install = function() {
        if (installed) return;
        if (!$dataPokemon || !$dataFranchises) return;

        if ($dataSpeciesExtra) {
            const list = Array.isArray($dataSpeciesExtra) ? $dataSpeciesExtra : Object.values($dataSpeciesExtra);
            for (const sp of list) {
                if (sp && sp.id > 0) $dataPokemon[sp.id] = sp;
            }
            // fecha buracos deixados por faixas ainda não preenchidas
            for (let i = 1; i < $dataPokemon.length; i++) {
                if ($dataPokemon[i] === undefined) $dataPokemon[i] = null;
            }
        }
        if ($dataMovesExtra && $dataMoves) Object.assign($dataMoves, $dataMovesExtra);
        if ($dataItemsExtra && $dataItems2) Object.assign($dataItems2, $dataItemsExtra);
        installed = true;
    };

    if (typeof Scene_Boot !== "undefined" && Scene_Boot.prototype.onDatabaseLoaded) {
        const _onDatabaseLoaded = Scene_Boot.prototype.onDatabaseLoaded;
        Scene_Boot.prototype.onDatabaseLoaded = function() {
            PKM.Franchise.install();
            _onDatabaseLoaded.call(this);
        };
    }

    //=========================================================================
    // Registro
    //=========================================================================
    PKM.Franchise.all = function() {
        if (!$dataFranchises) return [];
        return ($dataFranchises.order || []).map(id => $dataFranchises.list[id]).filter(Boolean);
    };
    PKM.Franchise.get = function(id) {
        return ($dataFranchises && $dataFranchises.list && $dataFranchises.list[id]) || null;
    };
    PKM.Franchise.ofSpecies = function(speciesId) {
        for (const f of PKM.Franchise.all()) {
            if (speciesId >= f.speciesFrom && speciesId <= f.speciesTo) return f;
        }
        return PKM.Franchise.get(DEFAULT_FRANCHISE);
    };
    PKM.Franchise.of = function(pokemon) {
        if (!pokemon) return PKM.Franchise.get(DEFAULT_FRANCHISE);
        const sp = pokemon.species && pokemon.species();
        if (sp && sp.franchise) return PKM.Franchise.get(sp.franchise) || PKM.Franchise.ofSpecies(pokemon.speciesId);
        return PKM.Franchise.ofSpecies(pokemon.speciesId);
    };
    PKM.Franchise.idOf = function(pokemon) {
        const f = PKM.Franchise.of(pokemon);
        return f ? f.id : DEFAULT_FRANCHISE;
    };
    PKM.Franchise.speciesOf = function(franchiseId) {
        const f = PKM.Franchise.get(franchiseId);
        if (!f || !$dataPokemon) return [];
        const out = [];
        for (let i = f.speciesFrom; i <= f.speciesTo && i < $dataPokemon.length; i++) {
            if ($dataPokemon[i]) out.push($dataPokemon[i]);
        }
        return out;
    };

    //=========================================================================
    // Captura por franquia
    //=========================================================================
    const gates = [];

    // gate extra: fn(pokemon, itemName, franchise) -> null | {allowed:false, reason}
    PKM.Franchise.registerCaptureGate = function(fn) {
        if (typeof fn === "function") gates.push(fn);
    };

    PKM.Franchise.captureItems = function(franchiseId) {
        const f = PKM.Franchise.get(franchiseId);
        return (f && f.capture && f.capture.items) || [];
    };

    // itens de captura válidos contra este alvo (bolas comuns só valem para Pokémon)
    PKM.Franchise.itemWorksOn = function(itemName, pokemon) {
        const f = PKM.Franchise.of(pokemon);
        const specific = (f && f.capture && f.capture.items) || [];
        if (specific.length) return specific.includes(itemName);
        return !isFranchiseSpecificItem(itemName);
    };

    function isFranchiseSpecificItem(itemName) {
        for (const f of PKM.Franchise.all()) {
            const items = (f.capture && f.capture.items) || [];
            if (items.includes(itemName)) return true;
        }
        return false;
    }

    function fill(text, pokemon, itemName) {
        const item = PKM.Core.item && PKM.Core.item(itemName);
        return String(text || "")
            .replace("{target}", pokemon ? pokemon.name : "?")
            .replace("{item}", item ? item.name : itemName || "?");
    }
    PKM.Franchise.text = fill;

    // regra completa de captura. Retorna {allowed, reason}
    PKM.Franchise.captureRule = function(pokemon, itemName) {
        const f = PKM.Franchise.of(pokemon);
        const rule = (f && f.capture) || {};

        if (rule.inField === false) {
            return { allowed: false, reason: fill(rule.deniedText || "Este monstro não pode ser capturado.", pokemon, itemName) };
        }
        if (itemName && !PKM.Franchise.itemWorksOn(itemName, pokemon)) {
            return { allowed: false, reason: fill("{item} não funciona em " + (f ? f.name : "?") + "!", pokemon, itemName) };
        }
        if (rule.maxHpRate !== undefined && pokemon.hpRate && pokemon.hpRate() > rule.maxHpRate) {
            return { allowed: false, reason: fill(rule.deniedText || "O alvo ainda está forte demais!", pokemon, itemName) };
        }
        for (const gate of gates) {
            const res = gate(pokemon, itemName, f);
            if (res && res.allowed === false) {
                return { allowed: false, reason: fill(res.reason || rule.deniedText || "Não é possível agora.", pokemon, itemName) };
            }
        }
        return { allowed: true, reason: null };
    };

    // textos temáticos usados pela cena de batalha
    PKM.Franchise.throwText = function(pokemon, itemName) {
        const f = PKM.Franchise.of(pokemon);
        const t = (f && f.capture && f.capture.throwText) || "Você jogou uma {item}!";
        return fill(t, pokemon, itemName);
    };
    PKM.Franchise.successText = function(pokemon, itemName) {
        const f = PKM.Franchise.of(pokemon);
        const t = (f && f.capture && f.capture.successText) || "Gotcha! {target} foi capturado!";
        return fill(t, pokemon, itemName);
    };
})();
