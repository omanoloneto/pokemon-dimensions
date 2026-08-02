//=============================================================================
// PKM_Pacts.js  — dimensão Bucky (Jibaku-kun)
//=============================================================================
/*:
 * @target MZ
 * @plugindesc [PKM v0.3] Emblemas de Grande Criança: gate de pacto dos 12 espíritos
 * lendários da dimensão Bucky e registro dos golpes Jibaku.
 * @author Pokémon Dimensions
 * @base PKM_Core
 * @base PKM_Franchise
 * @base PKM_Battle
 * @base PKM_Trainers
 * @orderAfter PKM_Battle
 * @orderAfter PKM_Trainers
 *
 * @help PKM_Pacts.js
 *
 * Os 12 espíritos (ids 780-791) são o endgame que costura o multiverso: cada um
 * guarda um dos doze mundos e só aceita o pacto de quem já derrotou a Grande
 * Criança daquele mundo. O emblema reusa o sistema de insígnias existente.
 *
 *   PKM.Pacts.giveEmblem("GC_01") / .hasEmblem(id) / .emblemCount()
 *   PKM.Pacts.canPact(pokemon) -> {ok, reason}
 *   PKM.Pacts.spirits() -> [{id, name, world, pactBadge, hasEmblem, pacted}]
 *
 * Os golpes Jibaku (JIBAKU, JIBAKUMINOR, JIBAKUCHAIN, JIBAKUSEAL) são registrados
 * em PKM.Battle.MOVE_EFFECTS por este plugin — nenhum motor novo de batalha.
 *
 * @command giveEmblem
 * @text Dar Emblema de G.C.
 * @arg emblem @type string @default GC_01 @text Emblema @desc GC_01 a GC_12, um por mundo.
 *
 * @command progress
 * @text Progresso dos Pactos
 * @arg emblemVar @type variable @default 0 @text Variável (emblemas) @desc Recebe quantos emblemas você tem.
 * @arg pactVar @type variable @default 0 @text Variável (pactos) @desc Recebe quantos espíritos já pactuaram.
 */

var PKM = PKM || {};
PKM.Pacts = PKM.Pacts || {};

(() => {
    "use strict";

    const FRANCHISE_ID = "BKY";
    const EMBLEM_TOTAL = 12;
    const EMBLEMS = Array.from({ length: EMBLEM_TOTAL },
        (_, i) => "GC_" + String(i + 1).padStart(2, "0"));

    PKM.Pacts.EMBLEMS = EMBLEMS;

    //=========================================================================
    // Golpes Jibaku — reusam recoil/drain/selfKO já suportados por PKM_Battle
    //=========================================================================
    Object.assign(PKM.Battle.MOVE_EFFECTS, {
        JIBAKU: { selfKO: true },
        JIBAKUMINOR: { recoil: 0.33 },
        JIBAKUCHAIN: { recoil: 0.5 },
        JIBAKUSEAL: { drain: 0.5 }
    });

    //=========================================================================
    // Emblemas de Grande Criança (insígnias reusadas 1:1)
    //=========================================================================
    function system() {
        return typeof $gameSystem !== "undefined" ? $gameSystem : null;
    }

    PKM.Pacts.isEmblem = function(id) {
        return EMBLEMS.includes(id);
    };
    PKM.Pacts.giveEmblem = function(id) {
        const sys = system();
        if (!sys || !PKM.Pacts.isEmblem(id)) return false;
        sys.pkmGiveBadge(id);
        return true;
    };
    PKM.Pacts.hasEmblem = function(id) {
        const sys = system();
        return !!sys && sys.pkmHasBadge(id);
    };
    PKM.Pacts.emblemCount = function() {
        return EMBLEMS.filter(PKM.Pacts.hasEmblem).length;
    };

    //=========================================================================
    // Pacto
    //=========================================================================
    function speciesOf(pokemon) {
        if (!pokemon) return null;
        if (typeof pokemon.species === "function") {
            const sp = pokemon.species();
            if (sp) return sp;
        }
        return PKM.Core.species(pokemon.speciesId);
    }

    // função pura: só nega quando a espécie exige emblema e o jogador não tem.
    PKM.Pacts.canPact = function(pokemon) {
        const sp = speciesOf(pokemon);
        if (!sp || !sp.pactBadge) return { ok: true, reason: null };
        if (PKM.Pacts.hasEmblem(sp.pactBadge)) return { ok: true, reason: null };
        const where = sp.world ? "do " + sp.world : "deste mundo";
        return {
            ok: false,
            reason: "{target} desvia o olhar: sem o Emblema de Grande Criança " + where + ", não há pacto."
        };
    };

    PKM.Pacts.spirits = function() {
        const sys = system();
        return PKM.Franchise.speciesOf(FRANCHISE_ID).map(sp => ({
            id: sp.id,
            name: sp.name,
            internalName: sp.internalName,
            world: sp.world || null,
            pactBadge: sp.pactBadge || null,
            hasEmblem: PKM.Pacts.hasEmblem(sp.pactBadge),
            pacted: !!sys && sys.pkmIsCaught(sp.id)
        }));
    };
    PKM.Pacts.pactCount = function() {
        return PKM.Pacts.spirits().filter(s => s.pacted).length;
    };

    // gate de captura: vale só para a dimensão Bucky, as outras seguem intactas
    PKM.Franchise.registerCaptureGate((pokemon, itemName, franchise) => {
        if (!franchise || franchise.id !== FRANCHISE_ID) return null;
        const res = PKM.Pacts.canPact(pokemon);
        return res.ok ? null : { allowed: false, reason: res.reason };
    });

    //=========================================================================
    // Comandos de plugin
    //=========================================================================
    PluginManager.registerCommand("PKM_Pacts", "giveEmblem", args => {
        PKM.Pacts.giveEmblem(String(args.emblem || "").trim());
    });
    PluginManager.registerCommand("PKM_Pacts", "progress", args => {
        const emblemVar = Number(args.emblemVar || 0);
        const pactVar = Number(args.pactVar || 0);
        if (emblemVar > 0) $gameVariables.setValue(emblemVar, PKM.Pacts.emblemCount());
        if (pactVar > 0) $gameVariables.setValue(pactVar, PKM.Pacts.pactCount());
    });
})();
