//=============================================================================
// PKM_Encounters.js  — Fase 4
//=============================================================================
/*:
 * @target MZ
 * @plugindesc [PKM v0.2] Encontros selvagens no overworld a partir de Encounters.json.
 * @author Pokémon Dimensions (port MZ)
 * @base PKM_Core
 * @base PKM_Pokemon
 * @orderAfter PKM_Party
 *
 * @help PKM_Encounters.js
 *
 * Pinte a REGIÃO de grama (padrão: Região 1) nos tiles onde deve haver encontros.
 * A cada passo nessa região, há chance de aparecer um Pokémon selvagem do mapa
 * atual (definido em data/Encounters.json, gerado do PBS encounters.txt).
 *
 * Também: comando de plugin para forçar um encontro específico (testes).
 *
 * @param grassRegionId
 * @text Região de grama
 * @type number @min 0 @max 255 @default 1
 * @desc ID de região (no editor de mapa) que dispara encontros terrestres.
 *
 * @param stepDivisor
 * @text Divisor de chance
 * @type number @min 50 @max 1000 @default 250
 * @desc chance por passo = densidade do mapa / este valor. Maior = mais raro.
 *
 * @command wild
 * @text Forçar Encontro
 * @desc Inicia uma batalha selvagem com a espécie/nível dados.
 * @arg species
 * @type string @text Espécie @desc internalName ou número.
 * @arg level
 * @type number @min 1 @max 100 @default 5 @text Nível
 *
 * @command rollHere
 * @text Sortear no Mapa
 * @desc Sorteia um encontro do mapa atual (método Land) e inicia, se houver.
 */

var PKM = PKM || {};

(() => {
    "use strict";
    const P = PluginManager.parameters("PKM_Encounters");
    const GRASS_REGION = Number(P.grassRegionId || 1);
    const STEP_DIV = Number(P.stepDivisor || 250);

    // pesos padrão de 12 slots terrestres (Gen 3+)
    const LAND_WEIGHTS = [20, 20, 10, 10, 10, 10, 5, 5, 4, 4, 1, 1];

    PKM.Encounters = {};

    PKM.Encounters.tableFor = function(mapId, method) {
        const all = $dataEncounters || {};
        const entry = all[String(mapId)] || all[mapId];
        if (!entry || !entry.methods) return null;
        return entry.methods[method] || null;
    };
    PKM.Encounters.density = function(mapId, idx = 0) {
        const all = $dataEncounters || {};
        const entry = all[String(mapId)] || all[mapId];
        if (!entry || !entry.densities) return 0;
        return entry.densities[idx] || 0;
    };

    // sorteia {species, level} de uma tabela (com pesos se tiver 12 slots)
    PKM.Encounters.roll = function(mapId, method = "Land") {
        const slots = PKM.Encounters.tableFor(mapId, method);
        if (!slots || slots.length === 0) return null;
        let idx;
        if (slots.length === LAND_WEIGHTS.length) {
            const total = LAND_WEIGHTS.reduce((a, b) => a + b, 0);
            let r = Math.randomInt(total);
            idx = 0;
            while (r >= LAND_WEIGHTS[idx]) { r -= LAND_WEIGHTS[idx]; idx++; }
        } else {
            idx = Math.randomInt(slots.length);
        }
        const slot = slots[idx];
        const lo = Math.min(slot.min, slot.max), hi = Math.max(slot.min, slot.max);
        const level = lo + Math.randomInt(hi - lo + 1);
        return { species: slot.species, level };
    };

    // inicia a batalha selvagem
    PKM.Encounters.startWild = function(species, level) {
        if ($gameParty.pkmCount && $gameParty.pkmCount() === 0) {
            // sem Pokémon: não inicia (evita travar a demo)
            return false;
        }
        $gameTemp.pkmWild = new Game_Pokemon(species, level);
        SceneManager.push(Scene_PkmBattle);
        return true;
    };

    PKM.Encounters.rollAndStart = function(mapId, method = "Land") {
        const enc = PKM.Encounters.roll(mapId, method);
        if (!enc) return false;
        return PKM.Encounters.startWild(enc.species, enc.level);
    };

    //--- gatilho por passo na grama -----------------------------------------
    const _GP_increaseSteps = Game_Player.prototype.increaseSteps;
    Game_Player.prototype.increaseSteps = function() {
        _GP_increaseSteps.call(this);
        this.pkmCheckEncounter();
    };
    Game_Player.prototype.pkmCheckEncounter = function() {
        if ($gameMap.isEventRunning && $gameMap.isEventRunning()) return;
        if (this.regionId() !== GRASS_REGION) return;
        const mapId = $gameMap.mapId();
        const density = PKM.Encounters.density(mapId, 0);
        if (density <= 0) return;
        if (Math.random() < density / STEP_DIV) {
            PKM.Encounters.rollAndStart(mapId, "Land");
        }
    };

    //--- comandos de plugin --------------------------------------------------
    PluginManager.registerCommand("PKM_Encounters", "wild", args => {
        const sp = /^\d+$/.test(args.species) ? Number(args.species) : args.species;
        PKM.Encounters.startWild(sp, Number(args.level) || 5);
    });
    PluginManager.registerCommand("PKM_Encounters", "rollHere", () => {
        PKM.Encounters.rollAndStart($gameMap.mapId(), "Land");
    });
})();
