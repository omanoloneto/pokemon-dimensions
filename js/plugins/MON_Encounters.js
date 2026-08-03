//=============================================================================
// MON_Encounters.js  — Fase 4
//=============================================================================
/*:
 * @target MZ
 * @plugindesc [MON v0.5] Encontros selvagens no overworld a partir de Encounters.json,
 * em times de 1 a 3 monstros.
 * @author Pokémon Dimensions (port MZ)
 * @base MON_Core
 * @base MON_Monster
 * @orderAfter MON_Party
 * @orderAfter MON_Field
 *
 * @help MON_Encounters.js
 *
 * Pinte a REGIÃO de grama (padrão: Região 1) nos tiles onde deve haver encontros.
 * A cada passo nessa região, há chance de aparecer um time selvagem do mapa atual
 * (definido em data/Encounters.json, gerado do PBS encounters.txt).
 *
 * GRUPOS (1 a 3 monstros)
 * ----------------------------------------------------------------------------
 * O encontro solo continua sendo o caso comum; grupo é exceção. A regra:
 *
 *   chance de grupo = "Chance de grupo" (%) × densidade do mapa / 25
 *   se houver grupo, ele tem 2 monstros; com metade dessa chance, 3.
 *
 * Ou seja, rotas de grama densa (densidade 25) usam a chance cheia do parâmetro e
 * rotas ralas (densidade 15) proporcionalmente menos — grama alta junta bicho.
 * Os acompanhantes saem da mesma tabela do mapa e nunca passam do nível do líder,
 * para um grupo não virar uma emboscada injusta.
 *
 * Selvagens não têm humano no time: só o lado do treinador leva gente ao campo.
 *
 * O resultado é publicado para a cena em:
 *   $gameTemp.monFoes  -> ARRAY de unidades (1 a 3)
 *   $gameTemp.monWild  -> a primeira delas (compatibilidade com o código antigo)
 *
 * API:
 *   MON.Encounters.roll(mapId, method)        -> {species, level} | null
 *   MON.Encounters.rollGroup(mapId, method)   -> [{species, level}] | null
 *   MON.Encounters.buildFoes(members)         -> [Game_Monster]
 *   MON.Encounters.startWild(species, level)  -> inicia um encontro solo
 *   MON.Encounters.startWildTeam(members)     -> inicia um encontro em grupo
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
 * @param groupChance
 * @text Chance de grupo
 * @type number @min 0 @max 100 @default 12
 * @desc % de o encontro trazer um 2º monstro (escalado pela densidade do mapa). O 3º usa metade dessa chance.
 *
 * @command wild
 * @text Forçar Encontro
 * @desc Inicia uma batalha selvagem com a espécie/nível dados.
 * @arg species
 * @type string @text Espécie @desc internalName ou número.
 * @arg level
 * @type number @min 1 @max 100 @default 5 @text Nível
 *
 * @command wildTeam
 * @text Forçar Grupo Selvagem
 * @desc Inicia uma batalha selvagem com até 3 monstros.
 * @arg species
 * @type string @text Espécies @desc internalNames separados por vírgula (ex.: RATTATA,PIDGEY).
 * @arg level
 * @type number @min 1 @max 100 @default 5 @text Nível
 *
 * @command rollHere
 * @text Sortear no Mapa
 * @desc Sorteia um encontro do mapa atual (método Land) e inicia, se houver.
 */

var MON = MON || {};

(() => {
    "use strict";
    const P = (typeof PluginManager !== "undefined" && PluginManager.parameters)
        ? PluginManager.parameters("MON_Encounters") : {};
    const GRASS_REGION = Number(P.grassRegionId || 1);
    const STEP_DIV = Number(P.stepDivisor || 250);
    const GROUP_CHANCE = Number(P.groupChance != null && P.groupChance !== "" ? P.groupChance : 12) / 100;
    // densidade de referência do PBS: grama cheia. Serve de escala para os grupos.
    const REFERENCE_DENSITY = 25;

    // pesos padrão de 12 slots terrestres (Gen 3+)
    const LAND_WEIGHTS = [20, 20, 10, 10, 10, 10, 5, 5, 4, 4, 1, 1];

    MON.Encounters = {};

    // teto do grupo vem do campo (3v3); lido tarde porque a ordem de plugin varia
    function maxGroup() {
        return (MON.Field && MON.Field.MAX_ACTIVE) || 3;
    }

    MON.Encounters.tableFor = function(mapId, method) {
        const all = $dataEncounters || {};
        const entry = all[String(mapId)] || all[mapId];
        if (!entry || !entry.methods) return null;
        return entry.methods[method] || null;
    };
    MON.Encounters.density = function(mapId, idx = 0) {
        const all = $dataEncounters || {};
        const entry = all[String(mapId)] || all[mapId];
        if (!entry || !entry.densities) return 0;
        return entry.densities[idx] || 0;
    };

    // sorteia {species, level} de uma tabela (com pesos se tiver 12 slots)
    MON.Encounters.roll = function(mapId, method = "Land") {
        const slots = MON.Encounters.tableFor(mapId, method);
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

    //--- grupos --------------------------------------------------------------
    MON.Encounters.groupChance = function(mapId) {
        const density = MON.Encounters.density(mapId, 0) || REFERENCE_DENSITY;
        return Math.min(1, GROUP_CHANCE * (density / REFERENCE_DENSITY));
    };

    // 1 na maioria das vezes; 2 na chance do parâmetro; 3 na metade dela
    MON.Encounters.groupSize = function(mapId) {
        const chance = MON.Encounters.groupChance(mapId);
        if (Math.random() >= chance) return 1;
        const size = Math.random() < chance / 2 ? 3 : 2;
        return Math.min(size, maxGroup());
    };

    MON.Encounters.rollGroup = function(mapId, method = "Land") {
        const leader = MON.Encounters.roll(mapId, method);
        if (!leader) return null;
        const members = [leader];
        const size = MON.Encounters.groupSize(mapId);
        while (members.length < size) {
            const extra = MON.Encounters.roll(mapId, method);
            if (!extra) break;
            // acompanhante nunca passa do líder: grupo é numeroso, não mais forte
            members.push({ species: extra.species, level: Math.min(extra.level, leader.level) });
        }
        return members;
    };

    // aceita {species, level} ou unidades já construídas
    MON.Encounters.buildFoes = function(members) {
        return (members || []).filter(Boolean).map(m =>
            m instanceof Game_Monster ? m : new Game_Monster(m.species, m.level));
    };

    //--- publicação para a cena ----------------------------------------------
    MON.Encounters.publish = function(units) {
        $gameTemp.monFoes = units;
        $gameTemp.monWild = units[0] || null;   // legado: código antigo lê só o primeiro
        $gameTemp.monTrainer = null;
        return units;
    };

    function playerReady() {
        if (typeof $gameParty === "undefined" || !$gameParty) return false;
        // com humano em campo, o jogador ainda luta sem nenhum monstro de pé
        if ($gameParty.monBattleTeam) return $gameParty.monBattleTeam().length > 0;
        return !($gameParty.monCount && $gameParty.monCount() === 0);
    }

    function pushBattleScene() {
        if (typeof SceneManager === "undefined" || typeof Scene_PkmBattle === "undefined") return;
        SceneManager.push(Scene_PkmBattle);
    }

    MON.Encounters.startWildTeam = function(members) {
        if (!playerReady()) return false;
        const units = MON.Encounters.buildFoes(members).slice(0, maxGroup());
        if (units.length === 0) return false;
        MON.Encounters.publish(units);
        pushBattleScene();
        return true;
    };

    MON.Encounters.startWild = function(species, level) {
        return MON.Encounters.startWildTeam([{ species, level }]);
    };

    MON.Encounters.rollAndStart = function(mapId, method = "Land") {
        const members = MON.Encounters.rollGroup(mapId, method);
        if (!members) return false;
        return MON.Encounters.startWildTeam(members);
    };

    //--- gatilho por passo na grama -----------------------------------------
    if (typeof Game_Player !== "undefined") {
        const _GP_increaseSteps = Game_Player.prototype.increaseSteps;
        Game_Player.prototype.increaseSteps = function() {
            _GP_increaseSteps.call(this);
            this.monCheckEncounter();
        };
        Game_Player.prototype.monCheckEncounter = function() {
            if ($gameMap.isEventRunning && $gameMap.isEventRunning()) return;
            if (this.regionId() !== GRASS_REGION) return;
            const mapId = $gameMap.mapId();
            const density = MON.Encounters.density(mapId, 0);
            if (density <= 0) return;
            if (Math.random() < density / STEP_DIV) {
                MON.Encounters.rollAndStart(mapId, "Land");
            }
        };
    }

    //--- comandos de plugin --------------------------------------------------
    if (typeof PluginManager !== "undefined") {
        const parseSpecies = s => /^\d+$/.test(s) ? Number(s) : s;

        PluginManager.registerCommand("MON_Encounters", "wild", args => {
            MON.Encounters.startWild(parseSpecies(args.species), Number(args.level) || 5);
        });
        PluginManager.registerCommand("MON_Encounters", "wildTeam", args => {
            const level = Number(args.level) || 5;
            const members = String(args.species || "").split(",")
                .map(s => s.trim()).filter(Boolean)
                .map(s => ({ species: parseSpecies(s), level }));
            MON.Encounters.startWildTeam(members);
        });
        PluginManager.registerCommand("MON_Encounters", "rollHere", () => {
            MON.Encounters.rollAndStart($gameMap.mapId(), "Land");
        });
    }
})();
