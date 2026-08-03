//=============================================================================
// MON_Dex.js  — dex regional por dimensão
//=============================================================================
/*:
 * @target MZ
 * @plugindesc [MON v0.4] Dex regional por dimensão: recorte ordenado de espécies,
 * número regional, forma de obtenção e progresso de vistos/capturados.
 * @author Pokémon Dimensions
 * @base MON_Core
 * @base MON_Franchise
 * @orderAfter MON_Franchise
 * @orderBefore MON_Codex
 *
 * @help MON_Dex.js
 *
 * A Pokédex nacional lista todas as franquias de uma vez; a dex regional é o
 * recorte jogável de UMA dimensão, na ordem em que a dimensão apresenta as
 * espécies. Cada arquivo data/dex/<ID>.json descreve uma dex:
 *
 *   id          identificador da dex ("KANTO")
 *   franchise   franquia dona (chave de data/Franchises.json)
 *   dimension   dimensão onde a dex é jogada ("D1")
 *   species     ids na ORDEM REGIONAL — o índice + 1 é o número regional
 *   obtainable  speciesId -> { method, from?, reason?, note? }
 *
 *   method: wild | evolution | starter | gift | unavailable
 *
 * O DataManager não varre diretório: cada arquivo novo em data/dex/ precisa de
 * uma linha em SOURCES aqui embaixo.
 *
 * API:
 *   MON.Dex.all()                              -> [dex]
 *   MON.Dex.get("KANTO")                       -> dex | null
 *   MON.Dex.ofFranchise("PKM")                 -> [dex]
 *   MON.Dex.franchise("KANTO")                 -> franquia dona (MON_Franchise)
 *   MON.Dex.species("KANTO")                   -> ids na ordem regional
 *   MON.Dex.contains("KANTO", 25)              -> bool
 *   MON.Dex.regionalNumber("KANTO", 25)        -> 25 (0 = fora da dex)
 *   MON.Dex.obtainable("KANTO", 25)            -> { method, ... } | null
 *   MON.Dex.progress("KANTO")                  -> { seen, caught, total }
 *
 * @command progress
 * @text Progresso da Dex
 * @desc Escreve vistos/capturados/total da dex regional em variáveis.
 * @arg dexId
 * @type string
 * @default KANTO
 * @text Dex
 * @arg seenVar
 * @type variable
 * @default 0
 * @text Variável (vistos)
 * @arg caughtVar
 * @type variable
 * @default 0
 * @text Variável (capturados)
 * @arg totalVar
 * @type variable
 * @default 0
 * @text Variável (total)
 */

var $dataDexKanto = $dataDexKanto || null;

var MON = MON || {};
MON.Dex = MON.Dex || {};

(() => {
    "use strict";

    const PLUGIN_NAME = "MON_Dex";
    const SOURCES = [{ global: "$dataDexKanto", src: "dex/KANTO.json" }];
    const root = typeof window !== "undefined" ? window : globalThis;

    for (const s of SOURCES) {
        DataManager._databaseFiles.push({ name: s.global, src: s.src });
    }

    //=========================================================================
    // Índice: id da dex -> { data, order: Map(speciesId -> número regional) }
    //=========================================================================
    let index = null;

    // idempotente; enquanto nenhum arquivo tiver carregado, tenta de novo depois
    MON.Dex.install = function() {
        const built = {};
        let found = 0;
        for (const s of SOURCES) {
            const data = root[s.global];
            if (!data || !data.id) continue;
            const order = new Map();
            (data.species || []).forEach((id, i) => order.set(id, i + 1));
            built[data.id] = { data, order };
            found++;
        }
        if (found > 0) index = built;
        return found;
    };

    function entries() {
        if (!index) MON.Dex.install();
        return index || {};
    }
    function entry(dexId) {
        return entries()[dexId] || null;
    }

    if (typeof Scene_Boot !== "undefined" && Scene_Boot.prototype.onDatabaseLoaded) {
        const _onDatabaseLoaded = Scene_Boot.prototype.onDatabaseLoaded;
        Scene_Boot.prototype.onDatabaseLoaded = function() {
            MON.Dex.install();
            _onDatabaseLoaded.call(this);
        };
    }

    //=========================================================================
    // Consulta
    //=========================================================================
    MON.Dex.all = function() {
        return Object.values(entries()).map(e => e.data);
    };
    MON.Dex.get = function(dexId) {
        const e = entry(dexId);
        return e ? e.data : null;
    };
    MON.Dex.ofFranchise = function(franchiseId) {
        return MON.Dex.all().filter(d => d.franchise === franchiseId);
    };
    MON.Dex.franchise = function(dexId) {
        const dex = MON.Dex.get(dexId);
        return dex ? MON.Franchise.get(dex.franchise) : null;
    };
    MON.Dex.species = function(dexId) {
        const dex = MON.Dex.get(dexId);
        return dex ? (dex.species || []).slice() : [];
    };
    MON.Dex.contains = function(dexId, speciesId) {
        const e = entry(dexId);
        return !!e && e.order.has(speciesId);
    };
    // 0 = espécie fora desta dex
    MON.Dex.regionalNumber = function(dexId, speciesId) {
        const e = entry(dexId);
        return (e && e.order.get(speciesId)) || 0;
    };
    MON.Dex.obtainable = function(dexId, speciesId) {
        const dex = MON.Dex.get(dexId);
        if (!dex || !dex.obtainable) return null;
        return dex.obtainable[speciesId] || null;
    };

    MON.Dex.progress = function(dexId) {
        const ids = MON.Dex.species(dexId);
        const sys = typeof $gameSystem !== "undefined" ? $gameSystem : null;
        let seen = 0, caught = 0;
        if (sys && sys.monIsSeen) {
            for (const id of ids) {
                if (sys.monIsCaught(id)) { seen++; caught++; }
                else if (sys.monIsSeen(id)) seen++;
            }
        }
        return { seen, caught, total: ids.length };
    };

    //=========================================================================
    // Comandos de plugin
    //=========================================================================
    PluginManager.registerCommand(PLUGIN_NAME, "progress", args => {
        const p = MON.Dex.progress(args.dexId);
        const set = (varId, value) => {
            if (Number(varId) > 0) $gameVariables.setValue(Number(varId), value);
        };
        set(args.seenVar, p.seen);
        set(args.caughtVar, p.caught);
        set(args.totalVar, p.total);
    });
})();
