//=============================================================================
// PKM_Pacts.js  — dimensão Bucky (Jibaku-kun)
//=============================================================================
/*:
 * @target MZ
 * @plugindesc [PKM v0.3] Bucky: Marcas de Grande Criança, Emblema G.C., pacto com
 * os 12 espíritos, golpes Jibaku e bloqueio dos Troublemonsters.
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
 * DOIS CONCEITOS DISTINTOS (não confunda):
 *
 *   MARCA de Grande Criança — insígnia "GC_01".."GC_12", uma por mundo, guardada
 *     em $gameSystem. É o reconhecimento daquele mundo: sem ela o espírito local
 *     recusa o pacto. Não ocupa a mochila. API: giveMark/hasMark/markCount.
 *
 *   EMBLEMA G.C. — o ITEM "GCEMBLEM" (pocket 3, catchBonus 12, keepOnUse). É o
 *     objeto que você ergue na batalha para firmar o pacto; aparece na lista de
 *     captura e NÃO é gasto no arremesso. API: giveEmblemItem/hasEmblemItem.
 *
 * Derrotar a Grande Criança de um mundo concede as DUAS coisas de uma vez:
 *
 *   PKM.Pacts.defeatGreatChild("GC_01") -> {mark, emblem}
 *   PKM.Pacts.canPact(pokemon)          -> {ok, reason}
 *   PKM.Pacts.spirits()                 -> [{id, name, world, pactMark, hasMark, pacted}]
 *   PKM.Pacts.markCount() / pactCount()
 *
 * ECONOMIA DO PACTO (catchBonus 12 do Emblema, alvo com 1 de HP):
 *   espírito comum (catchRate 5): 23% por arremesso; 35% com PAR/PSN/BRN;
 *   47% com SLP/FRZ — ou seja ~2 arremessos preparado contra ~13 com o alvo
 *   intacto. Dragac (catchRate 3) é metade disso. O pacto é desafio de preparo.
 *   A cena de batalha não repassa o bônus de status, então este plugin o aplica
 *   sobre PKM.Battle.tryCapture apenas quando o alvo é um espírito.
 *
 * GOLPES JIBAKU — registrados em PKM.Battle.MOVE_EFFECTS, sem motor novo.
 *   24 JIBAKUMINOR (recuo 0.33) | 42 JIBAKUSEAL (dreno 0.5)
 *   48 JIBAKUCHAIN (recuo 0.50) | 50 JIBAKU (autodesmaio)
 *   Os dois auto-destrutivos ficam ACIMA da faixa selvagem de D5 (40-47) de
 *   propósito: espírito selvagem com selfKO se derrubaria sozinho e tornaria o
 *   pacto impossível. JIBAKU no 50 cai dentro da Dimensão Zero (48-55).
 *
 * TROUBLEMONSTERS (912-919) — fauna corrompida de D5: combate-se, não se
 * coleciona. Marcados com "troublemonster": true e barrados no gate de captura.
 * O bloqueio é explícito porque catchRate 0 cairia no fallback "|| 45" de
 * PKM.Battle.tryCapture e os deixaria MAIS fáceis de capturar.
 *
 * @command defeatGreatChild
 * @text Derrotar Grande Criança
 * @desc Concede a Marca daquele mundo e o item Emblema G.C. (se ainda não tiver).
 *
 * @arg mark
 * @type string
 * @default GC_01
 * @text Marca
 * @desc GC_01 a GC_12, uma por mundo.
 *
 * @command progress
 * @text Progresso dos Pactos
 * @desc Lê quantas Marcas e quantos pactos o jogador já tem.
 *
 * @arg markVar
 * @type variable
 * @default 0
 * @text Variável (marcas)
 * @desc Recebe quantas Marcas de G.C. você tem.
 *
 * @arg pactVar
 * @type variable
 * @default 0
 * @text Variável (pactos)
 * @desc Recebe quantos espíritos já pactuaram.
 */

var PKM = PKM || {};
PKM.Pacts = PKM.Pacts || {};

(() => {
    "use strict";

    const FRANCHISE_ID = "BKY";
    const MARK_TOTAL = 12;
    const MARKS = Array.from({ length: MARK_TOTAL },
        (_, i) => "GC_" + String(i + 1).padStart(2, "0"));
    const EMBLEM_ITEM = "GCEMBLEM";

    // bônus de captura por status (mesma escala das gerações 1-3)
    const STATUS_BONUS = { SLP: 2, FRZ: 2, PAR: 1.5, PSN: 1.5, TOX: 1.5, BRN: 1.5 };

    PKM.Pacts.MARKS = MARKS;
    PKM.Pacts.EMBLEM_ITEM = EMBLEM_ITEM;

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
    // Marca de Grande Criança (insígnia, uma por mundo)
    //=========================================================================
    function system() {
        return typeof $gameSystem !== "undefined" ? $gameSystem : null;
    }
    function party() {
        return typeof $gameParty !== "undefined" ? $gameParty : null;
    }

    PKM.Pacts.isMark = function(id) {
        return MARKS.includes(id);
    };
    PKM.Pacts.giveMark = function(id) {
        const sys = system();
        if (!sys || !PKM.Pacts.isMark(id)) return false;
        sys.pkmGiveBadge(id);
        return true;
    };
    PKM.Pacts.hasMark = function(id) {
        const sys = system();
        return !!sys && sys.pkmHasBadge(id);
    };
    PKM.Pacts.markCount = function() {
        return MARKS.filter(PKM.Pacts.hasMark).length;
    };

    //=========================================================================
    // Emblema G.C. (item de captura, um só serve para os doze mundos)
    //=========================================================================
    PKM.Pacts.hasEmblemItem = function() {
        const gp = party();
        return !!gp && !!gp.pkmHasItem && gp.pkmHasItem(EMBLEM_ITEM);
    };
    PKM.Pacts.giveEmblemItem = function() {
        const gp = party();
        if (!gp || !gp.pkmGainItem || PKM.Pacts.hasEmblemItem()) return false;
        gp.pkmGainItem(EMBLEM_ITEM, 1);
        return true;
    };

    // derrotar a Grande Criança entrega o reconhecimento E a ferramenta do pacto
    PKM.Pacts.defeatGreatChild = function(markId) {
        return { mark: PKM.Pacts.giveMark(markId), emblem: PKM.Pacts.giveEmblemItem() };
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

    PKM.Pacts.isSpirit = function(pokemon) {
        const sp = speciesOf(pokemon);
        return !!(sp && sp.pactMark);
    };
    PKM.Pacts.isTroublemonster = function(pokemon) {
        const sp = speciesOf(pokemon);
        return !!(sp && sp.troublemonster);
    };

    // função pura: nega o pacto por fauna corrompida, marca ausente ou lore de Dragac.
    PKM.Pacts.canPact = function(pokemon) {
        const sp = speciesOf(pokemon);
        if (!sp) return { ok: true, reason: null };
        if (sp.troublemonster) {
            return { ok: false, reason: "{target} é um Troublemonster: aqui não se coleciona, se enfrenta." };
        }
        if (!sp.pactMark) return { ok: true, reason: null };
        if (!PKM.Pacts.hasMark(sp.pactMark)) {
            const where = sp.world ? "do " + sp.world : "deste mundo";
            return {
                ok: false,
                reason: "{target} desvia o olhar: sem a Marca de Grande Criança " + where + ", não há pacto."
            };
        }
        // Dragac só desperta com os outros onze pactos firmados (lore do Mundo Zero)
        if (sp.requiresAllPacts) {
            const done = PKM.Pacts.pactCount();
            if (done < MARK_TOTAL - 1) {
                return {
                    ok: false,
                    reason: "{target} continua adormecido: " + done + " de " + (MARK_TOTAL - 1)
                        + " pactos firmados nos outros mundos."
                };
            }
        }
        return { ok: true, reason: null };
    };

    PKM.Pacts.spirits = function() {
        const sys = system();
        return PKM.Franchise.speciesOf(FRANCHISE_ID)
            .filter(sp => sp.pactMark)
            .map(sp => ({
                id: sp.id,
                name: sp.name,
                internalName: sp.internalName,
                world: sp.world || null,
                pactMark: sp.pactMark,
                hasMark: PKM.Pacts.hasMark(sp.pactMark),
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

    // a cena de batalha fixa statusBonus em 1; sem isto enfraquecer + dormir não
    // valeria nada e o pacto voltaria a ser repetição de arremesso.
    PKM.Pacts.statusBonus = function(pokemon) {
        return (pokemon && STATUS_BONUS[pokemon.status]) || 1;
    };
    const _tryCapture = PKM.Battle.tryCapture;
    PKM.Battle.tryCapture = function(wild, ballBonus = 1, statusBonus = 1) {
        const bonus = PKM.Pacts.isSpirit(wild)
            ? statusBonus * PKM.Pacts.statusBonus(wild)
            : statusBonus;
        return _tryCapture.call(this, wild, ballBonus, bonus);
    };

    //=========================================================================
    // Comandos de plugin
    //=========================================================================
    PluginManager.registerCommand("PKM_Pacts", "defeatGreatChild", args => {
        PKM.Pacts.defeatGreatChild(String(args.mark || "").trim());
    });
    PluginManager.registerCommand("PKM_Pacts", "progress", args => {
        const markVar = Number(args.markVar || 0);
        const pactVar = Number(args.pactVar || 0);
        if (markVar > 0) $gameVariables.setValue(markVar, PKM.Pacts.markCount());
        if (pactVar > 0) $gameVariables.setValue(pactVar, PKM.Pacts.pactCount());
    });
})();
