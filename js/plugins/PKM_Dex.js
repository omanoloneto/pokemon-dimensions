//=============================================================================
// PKM_Dex.js  — dex regional por dimensão
//=============================================================================
/*:
 * @target MZ
 * @plugindesc [PKM v0.4] Dex regional por dimensão: recorte ordenado de espécies,
 * número regional, forma de obtenção e progresso de vistos/capturados.
 * @author Pokémon Dimensions
 * @base PKM_Core
 * @base PKM_Franchise
 * @orderAfter PKM_Franchise
 * @orderBefore PKM_Pokedex
 *
 * @help PKM_Dex.js
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
 *   PKM.Dex.all()                              -> [dex]
 *   PKM.Dex.get("KANTO")                       -> dex | null
 *   PKM.Dex.ofFranchise("PKM")                 -> [dex]
 *   PKM.Dex.franchise("KANTO")                 -> franquia dona (PKM_Franchise)
 *   PKM.Dex.species("KANTO")                   -> ids na ordem regional
 *   PKM.Dex.contains("KANTO", 25)              -> bool
 *   PKM.Dex.regionalNumber("KANTO", 25)        -> 25 (0 = fora da dex)
 *   PKM.Dex.obtainable("KANTO", 25)            -> { method, ... } | null
 *   PKM.Dex.progress("KANTO")                  -> { seen, caught, total }
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

var PKM = PKM || {};
PKM.Dex = PKM.Dex || {};

(() => {
    "use strict";

    const PLUGIN_NAME = "PKM_Dex";
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
    PKM.Dex.install = function() {
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
        if (!index) PKM.Dex.install();
        return index || {};
    }
    function entry(dexId) {
        return entries()[dexId] || null;
    }

    if (typeof Scene_Boot !== "undefined" && Scene_Boot.prototype.onDatabaseLoaded) {
        const _onDatabaseLoaded = Scene_Boot.prototype.onDatabaseLoaded;
        Scene_Boot.prototype.onDatabaseLoaded = function() {
            PKM.Dex.install();
            _onDatabaseLoaded.call(this);
        };
    }

    //=========================================================================
    // Consulta
    //=========================================================================
    PKM.Dex.all = function() {
        return Object.values(entries()).map(e => e.data);
    };
    PKM.Dex.get = function(dexId) {
        const e = entry(dexId);
        return e ? e.data : null;
    };
    PKM.Dex.ofFranchise = function(franchiseId) {
        return PKM.Dex.all().filter(d => d.franchise === franchiseId);
    };
    PKM.Dex.franchise = function(dexId) {
        const dex = PKM.Dex.get(dexId);
        return dex ? PKM.Franchise.get(dex.franchise) : null;
    };
    PKM.Dex.species = function(dexId) {
        const dex = PKM.Dex.get(dexId);
        return dex ? (dex.species || []).slice() : [];
    };
    PKM.Dex.contains = function(dexId, speciesId) {
        const e = entry(dexId);
        return !!e && e.order.has(speciesId);
    };
    // 0 = espécie fora desta dex
    PKM.Dex.regionalNumber = function(dexId, speciesId) {
        const e = entry(dexId);
        return (e && e.order.get(speciesId)) || 0;
    };
    PKM.Dex.obtainable = function(dexId, speciesId) {
        const dex = PKM.Dex.get(dexId);
        if (!dex || !dex.obtainable) return null;
        return dex.obtainable[speciesId] || null;
    };

    PKM.Dex.progress = function(dexId) {
        const ids = PKM.Dex.species(dexId);
        const sys = typeof $gameSystem !== "undefined" ? $gameSystem : null;
        let seen = 0, caught = 0;
        if (sys && sys.pkmIsSeen) {
            for (const id of ids) {
                if (sys.pkmIsCaught(id)) { seen++; caught++; }
                else if (sys.pkmIsSeen(id)) seen++;
            }
        }
        return { seen, caught, total: ids.length };
    };

    //=========================================================================
    // Comandos de plugin
    //=========================================================================
    PluginManager.registerCommand(PLUGIN_NAME, "progress", args => {
        const p = PKM.Dex.progress(args.dexId);
        const set = (varId, value) => {
            if (Number(varId) > 0) $gameVariables.setValue(Number(varId), value);
        };
        set(args.seenVar, p.seen);
        set(args.caughtVar, p.caught);
        set(args.totalVar, p.total);
    });
})();
