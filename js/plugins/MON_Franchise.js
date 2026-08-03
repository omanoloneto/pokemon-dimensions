//=============================================================================
// MON_Franchise.js  — camada multi-franquia
//=============================================================================
/*:
 * @target MZ
 * @plugindesc [MON v0.3] Camada multi-franquia: registro de dimensões, merge dos
 * dados extras (espécies, golpes, itens) e regras de captura por franquia.
 * @author Pokémon Dimensions
 * @base MON_Core
 * @orderAfter MON_Core
 * @orderBefore MON_Battle
 *
 * @help MON_Franchise.js
 *
 * Cada franquia ocupa uma faixa contígua de IDs de espécie (data/Franchises.json):
 *   MON 1-649 | DGM 650-799 | MDB 800-849 | MRA 850-899 | BKY 900-919
 *
 * Funde em runtime os arquivos "Extra" nos bancos base, para que os monstros de
 * todas as franquias vivam no mesmo $dataMonsters/$dataMoves/$dataItems2 e usem o
 * mesmo motor de batalha, captura, party e PC.
 *
 * API:
 *   MON.Franchise.get(id) / all() / ofSpecies(speciesId) / of(monster)
 *   MON.Franchise.captureRule(monster, itemName) -> {allowed, reason}
 *   MON.Franchise.captureItems(franchiseId) -> [internalName]
 *   MON.Franchise.registerCaptureGate(fn) -> gate extra (usado por MON_Pacts)
 */

var $dataFranchises = $dataFranchises || null;
var $dataSpeciesExtra = $dataSpeciesExtra || null;
var $dataMovesExtra = $dataMovesExtra || null;
var $dataItemsExtra = $dataItemsExtra || null;

var MON = MON || {};
MON.Franchise = MON.Franchise || {};

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

    MON.Franchise.install = function() {
        if (installed) return;
        if (!$dataMonsters || !$dataFranchises) return;

        if ($dataSpeciesExtra) {
            const list = Array.isArray($dataSpeciesExtra) ? $dataSpeciesExtra : Object.values($dataSpeciesExtra);
            for (const sp of list) {
                if (sp && sp.id > 0) $dataMonsters[sp.id] = sp;
            }
            // fecha buracos deixados por faixas ainda não preenchidas
            for (let i = 1; i < $dataMonsters.length; i++) {
                if ($dataMonsters[i] === undefined) $dataMonsters[i] = null;
            }
        }
        if ($dataMovesExtra && $dataMoves) Object.assign($dataMoves, $dataMovesExtra);
        if ($dataItemsExtra && $dataItems2) Object.assign($dataItems2, $dataItemsExtra);
        installed = true;
    };

    if (typeof Scene_Boot !== "undefined" && Scene_Boot.prototype.onDatabaseLoaded) {
        const _onDatabaseLoaded = Scene_Boot.prototype.onDatabaseLoaded;
        Scene_Boot.prototype.onDatabaseLoaded = function() {
            MON.Franchise.install();
            _onDatabaseLoaded.call(this);
        };
    }

    //=========================================================================
    // Registro
    //=========================================================================
    MON.Franchise.all = function() {
        if (!$dataFranchises) return [];
        return ($dataFranchises.order || []).map(id => $dataFranchises.list[id]).filter(Boolean);
    };
    MON.Franchise.get = function(id) {
        return ($dataFranchises && $dataFranchises.list && $dataFranchises.list[id]) || null;
    };
    MON.Franchise.ofSpecies = function(speciesId) {
        for (const f of MON.Franchise.all()) {
            if (speciesId >= f.speciesFrom && speciesId <= f.speciesTo) return f;
        }
        return MON.Franchise.get(DEFAULT_FRANCHISE);
    };
    MON.Franchise.of = function(monster) {
        if (!monster) return MON.Franchise.get(DEFAULT_FRANCHISE);
        const sp = monster.species && monster.species();
        if (sp && sp.franchise) return MON.Franchise.get(sp.franchise) || MON.Franchise.ofSpecies(monster.speciesId);
        return MON.Franchise.ofSpecies(monster.speciesId);
    };
    MON.Franchise.idOf = function(monster) {
        const f = MON.Franchise.of(monster);
        return f ? f.id : DEFAULT_FRANCHISE;
    };
    MON.Franchise.speciesOf = function(franchiseId) {
        const f = MON.Franchise.get(franchiseId);
        if (!f || !$dataMonsters) return [];
        const out = [];
        for (let i = f.speciesFrom; i <= f.speciesTo && i < $dataMonsters.length; i++) {
            if ($dataMonsters[i]) out.push($dataMonsters[i]);
        }
        return out;
    };

    //=========================================================================
    // Captura por franquia
    //=========================================================================
    const gates = [];

    // gate extra: fn(monster, itemName, franchise) -> null | {allowed:false, reason}
    MON.Franchise.registerCaptureGate = function(fn) {
        if (typeof fn === "function") gates.push(fn);
    };

    MON.Franchise.captureItems = function(franchiseId) {
        const f = MON.Franchise.get(franchiseId);
        return (f && f.capture && f.capture.items) || [];
    };

    // itens de captura válidos contra este alvo (bolas comuns só valem para Pokémon)
    MON.Franchise.itemWorksOn = function(itemName, monster) {
        const f = MON.Franchise.of(monster);
        const specific = (f && f.capture && f.capture.items) || [];
        if (specific.length) return specific.includes(itemName);
        return !isFranchiseSpecificItem(itemName);
    };

    function isFranchiseSpecificItem(itemName) {
        for (const f of MON.Franchise.all()) {
            const items = (f.capture && f.capture.items) || [];
            if (items.includes(itemName)) return true;
        }
        return false;
    }

    function fill(text, monster, itemName) {
        const item = MON.Core.item && MON.Core.item(itemName);
        return String(text || "")
            .replace("{target}", monster ? monster.name : "?")
            .replace("{item}", item ? item.name : itemName || "?");
    }
    MON.Franchise.text = fill;

    // regra completa de captura. Retorna {allowed, reason}
    MON.Franchise.captureRule = function(monster, itemName) {
        const f = MON.Franchise.of(monster);
        const rule = (f && f.capture) || {};

        if (rule.inField === false) {
            return { allowed: false, reason: fill(rule.deniedText || "Este monstro não pode ser capturado.", monster, itemName) };
        }
        if (itemName && !MON.Franchise.itemWorksOn(itemName, monster)) {
            return { allowed: false, reason: fill("{item} não funciona em " + (f ? f.name : "?") + "!", monster, itemName) };
        }
        if (rule.maxHpRate !== undefined && monster.hpRate && monster.hpRate() > rule.maxHpRate) {
            return { allowed: false, reason: fill(rule.deniedText || "O alvo ainda está forte demais!", monster, itemName) };
        }
        for (const gate of gates) {
            const res = gate(monster, itemName, f);
            if (res && res.allowed === false) {
                return { allowed: false, reason: fill(res.reason || rule.deniedText || "Não é possível agora.", monster, itemName) };
            }
        }
        return { allowed: true, reason: null };
    };

    // textos temáticos usados pela cena de batalha
    MON.Franchise.throwText = function(monster, itemName) {
        const f = MON.Franchise.of(monster);
        const t = (f && f.capture && f.capture.throwText) || "Você jogou uma {item}!";
        return fill(t, monster, itemName);
    };
    MON.Franchise.successText = function(monster, itemName) {
        const f = MON.Franchise.of(monster);
        const t = (f && f.capture && f.capture.successText) || "Gotcha! {target} foi capturado!";
        return fill(t, monster, itemName);
    };
})();
