//=============================================================================
// MON_Pacts.js  — dimensão Bucky (Jibaku-kun)
//=============================================================================
/*:
 * @target MZ
 * @plugindesc [MON v0.3] Bucky: Marcas de Grande Criança, Emblema G.C., pacto com
 * os 12 espíritos, golpes Jibaku e bloqueio dos Troublemonsters.
 * @author Pokémon Dimensions
 * @base MON_Core
 * @base MON_Franchise
 * @base MON_Battle
 * @base MON_Trainers
 * @orderAfter MON_Battle
 * @orderAfter MON_Trainers
 *
 * @help MON_Pacts.js
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
 *   MON.Pacts.defeatGreatChild("GC_01") -> {mark, emblem}
 *   MON.Pacts.canPact(monster)          -> {ok, reason}
 *   MON.Pacts.spirits()                 -> [{id, name, world, pactMark, hasMark, pacted}]
 *   MON.Pacts.markCount() / pactCount()
 *
 * ECONOMIA DO PACTO (catchBonus 12 do Emblema, alvo com 1 de HP):
 *   espírito comum (catchRate 5): 23% por arremesso; 35% com PAR/PSN/BRN;
 *   47% com SLP/FRZ — ou seja ~2 arremessos preparado contra ~13 com o alvo
 *   intacto. Dragac (catchRate 3) é metade disso. O pacto é desafio de preparo.
 *   A cena de batalha não repassa o bônus de status, então este plugin o aplica
 *   sobre MON.Battle.tryCapture apenas quando o alvo é um espírito.
 *
 * GOLPES JIBAKU — registrados em MON.Battle.MOVE_EFFECTS, sem motor novo.
 *   24 JIBAKUMINOR (recuo 0.33) | 42 JIBAKUSEAL (dreno 0.5)
 *   48 JIBAKUCHAIN (recuo 0.50) | 50 JIBAKU (autodesmaio)
 *   Os dois auto-destrutivos ficam ACIMA da faixa selvagem de D5 (40-47) de
 *   propósito: espírito selvagem com selfKO se derrubaria sozinho e tornaria o
 *   pacto impossível. JIBAKU no 50 cai dentro da Dimensão Zero (48-55).
 *
 * TROUBLEMONSTERS (912-919) — fauna corrompida de D5: combate-se, não se
 * coleciona. Marcados com "troublemonster": true e barrados no gate de captura.
 * O bloqueio é explícito porque catchRate 0 cairia no fallback "|| 45" de
 * MON.Battle.tryCapture e os deixaria MAIS fáceis de capturar.
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

var MON = MON || {};
MON.Pacts = MON.Pacts || {};

(() => {
    "use strict";

    const FRANCHISE_ID = "BKY";
    const MARK_TOTAL = 12;
    const MARKS = Array.from({ length: MARK_TOTAL },
        (_, i) => "GC_" + String(i + 1).padStart(2, "0"));
    const EMBLEM_ITEM = "GCEMBLEM";

    // bônus de captura por status (mesma escala das gerações 1-3)
    const STATUS_BONUS = { SLP: 2, FRZ: 2, PAR: 1.5, PSN: 1.5, TOX: 1.5, BRN: 1.5 };

    MON.Pacts.MARKS = MARKS;
    MON.Pacts.EMBLEM_ITEM = EMBLEM_ITEM;

    //=========================================================================
    // Golpes Jibaku — reusam recoil/drain/selfKO já suportados por MON_Battle
    //=========================================================================
    Object.assign(MON.Battle.MOVE_EFFECTS, {
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

    MON.Pacts.isMark = function(id) {
        return MARKS.includes(id);
    };
    MON.Pacts.giveMark = function(id) {
        const sys = system();
        if (!sys || !MON.Pacts.isMark(id)) return false;
        sys.monGiveBadge(id);
        return true;
    };
    MON.Pacts.hasMark = function(id) {
        const sys = system();
        return !!sys && sys.monHasBadge(id);
    };
    MON.Pacts.markCount = function() {
        return MARKS.filter(MON.Pacts.hasMark).length;
    };

    //=========================================================================
    // Emblema G.C. (item de captura, um só serve para os doze mundos)
    //=========================================================================
    MON.Pacts.hasEmblemItem = function() {
        const gp = party();
        return !!gp && !!gp.monHasItem && gp.monHasItem(EMBLEM_ITEM);
    };
    MON.Pacts.giveEmblemItem = function() {
        const gp = party();
        if (!gp || !gp.monGainItem || MON.Pacts.hasEmblemItem()) return false;
        gp.monGainItem(EMBLEM_ITEM, 1);
        return true;
    };

    // derrotar a Grande Criança entrega o reconhecimento E a ferramenta do pacto
    MON.Pacts.defeatGreatChild = function(markId) {
        return { mark: MON.Pacts.giveMark(markId), emblem: MON.Pacts.giveEmblemItem() };
    };

    //=========================================================================
    // Pacto
    //=========================================================================
    function speciesOf(monster) {
        if (!monster) return null;
        if (typeof monster.species === "function") {
            const sp = monster.species();
            if (sp) return sp;
        }
        return MON.Core.species(monster.speciesId);
    }

    MON.Pacts.isSpirit = function(monster) {
        const sp = speciesOf(monster);
        return !!(sp && sp.pactMark);
    };
    MON.Pacts.isTroublemonster = function(monster) {
        const sp = speciesOf(monster);
        return !!(sp && sp.troublemonster);
    };

    // função pura: nega o pacto por fauna corrompida, marca ausente ou lore de Dragac.
    MON.Pacts.canPact = function(monster) {
        const sp = speciesOf(monster);
        if (!sp) return { ok: true, reason: null };
        if (sp.troublemonster) {
            return { ok: false, reason: "{target} é um Troublemonster: aqui não se coleciona, se enfrenta." };
        }
        if (!sp.pactMark) return { ok: true, reason: null };
        if (!MON.Pacts.hasMark(sp.pactMark)) {
            const where = sp.world ? "do " + sp.world : "deste mundo";
            return {
                ok: false,
                reason: "{target} desvia o olhar: sem a Marca de Grande Criança " + where + ", não há pacto."
            };
        }
        // Dragac só desperta com os outros onze pactos firmados (lore do Mundo Zero)
        if (sp.requiresAllPacts) {
            const done = MON.Pacts.pactCount();
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

    MON.Pacts.spirits = function() {
        const sys = system();
        return MON.Franchise.speciesOf(FRANCHISE_ID)
            .filter(sp => sp.pactMark)
            .map(sp => ({
                id: sp.id,
                name: sp.name,
                internalName: sp.internalName,
                world: sp.world || null,
                pactMark: sp.pactMark,
                hasMark: MON.Pacts.hasMark(sp.pactMark),
                pacted: !!sys && sys.monIsCaught(sp.id)
            }));
    };
    MON.Pacts.pactCount = function() {
        return MON.Pacts.spirits().filter(s => s.pacted).length;
    };

    // gate de captura: vale só para a dimensão Bucky, as outras seguem intactas
    MON.Franchise.registerCaptureGate((monster, itemName, franchise) => {
        if (!franchise || franchise.id !== FRANCHISE_ID) return null;
        const res = MON.Pacts.canPact(monster);
        return res.ok ? null : { allowed: false, reason: res.reason };
    });

    // a cena de batalha fixa statusBonus em 1; sem isto enfraquecer + dormir não
    // valeria nada e o pacto voltaria a ser repetição de arremesso.
    MON.Pacts.statusBonus = function(monster) {
        return (monster && STATUS_BONUS[monster.status]) || 1;
    };
    const _tryCapture = MON.Battle.tryCapture;
    MON.Battle.tryCapture = function(wild, ballBonus = 1, statusBonus = 1) {
        const bonus = MON.Pacts.isSpirit(wild)
            ? statusBonus * MON.Pacts.statusBonus(wild)
            : statusBonus;
        return _tryCapture.call(this, wild, ballBonus, bonus);
    };

    //=========================================================================
    // Comandos de plugin
    //=========================================================================
    PluginManager.registerCommand("MON_Pacts", "defeatGreatChild", args => {
        MON.Pacts.defeatGreatChild(String(args.mark || "").trim());
    });
    PluginManager.registerCommand("MON_Pacts", "progress", args => {
        const markVar = Number(args.markVar || 0);
        const pactVar = Number(args.pactVar || 0);
        if (markVar > 0) $gameVariables.setValue(markVar, MON.Pacts.markCount());
        if (pactVar > 0) $gameVariables.setValue(pactVar, MON.Pacts.pactCount());
    });
})();
