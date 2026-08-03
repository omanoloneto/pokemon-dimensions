//=============================================================================
// MON_Pacts.js  — Doze Mundos (continuidade de Bucky/Jibaku-kun)
//=============================================================================
/*:
 * @target MZ
 * @plugindesc [MON v0.4] Doze Mundos: Selos de Raiz, Relógio GC, pacto com os 11
 * Ecos de Raiz, golpes Jibaku e cura dos Monstros Encrenqueiros.
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
 * CÂNONE (bíblia v0.11, seções 1.2, 8, 9.3, 9.4 e 10):
 *
 *   Jibaku absorveu os outros onze Espíritos e é o ÚNICO Espírito remanescente.
 *   Ele é herdado de Bucky, não colecionado: o gate barra sua captura sempre.
 *
 *   O que resta dos onze Espíritos fundidos são ECOS DE RAIZ — um por mundo que
 *   perdeu o seu, alojado na raiz de Amano que atravessa aquele país. Primas não
 *   tem eco: o Espírito dele continua vivo e anda com o jogador.
 *
 *   Monstro Encrenqueiro NÃO é espécie: é o estado de uma criatura alterada pela
 *   antiga toxina da Árvore do Zero. Não se captura — se CURA.
 *
 * DOIS CONCEITOS DISTINTOS (não confunda):
 *
 *   SELO DE RAIZ — insígnia "GC_01".."GC_12", uma por mundo na ordem do relógio
 *     (GC_01 Primas ... GC_12 Doidicus), registrada no Relógio GC e guardada em
 *     $gameSystem. É o reconhecimento daquele país: sem ele o eco local recusa o
 *     pacto. Não ocupa a mochila. API: giveMark/hasMark/markCount/worldOfMark.
 *     GC_01 vem da cerimônia de sucessão; os outros onze, de cada mundo.
 *
 *   RELÓGIO GC — o ITEM "GCEMBLEM" (pocket 3, catchBonus 12, keepOnUse). É o
 *     aparelho herdado de Bucky, convertido por Undicus: registra criaturas,
 *     mostra mapas, identifica resíduo de toxina e é o que se ergue para firmar
 *     o pacto. Aparece na lista de captura e NÃO é gasto no arremesso.
 *     API: giveEmblemItem/hasEmblemItem.
 *
 * Ser reconhecido num mundo concede as DUAS coisas de uma vez:
 *
 *   MON.Pacts.recognizeInWorld("GC_03") -> {mark, emblem}
 *   MON.Pacts.canPact(monster)          -> {ok, reason}
 *   MON.Pacts.echoes()                  -> [{id, name, world, pactMark, hasMark, pacted}]
 *   MON.Pacts.canPurify(monster)        -> {ok, reason, into}
 *   MON.Pacts.purify(monster)           -> bool
 *   MON.Pacts.markCount() / pactCount()
 *
 * ECONOMIA DO PACTO (catchBonus 12 do Relógio, alvo com 1 de HP):
 *   eco comum (catchRate 5): 23% por arremesso; 35% com PAR/PSN/BRN;
 *   47% com SLP/FRZ — ou seja ~2 arremessos preparado contra ~13 com o alvo
 *   intacto. Dragac (catchRate 3) é metade disso. O pacto é desafio de preparo.
 *   A cena de batalha não repassa o bônus de status, então este plugin o aplica
 *   sobre MON.Battle.tryCapture apenas quando o alvo é um eco.
 *
 * GOLPES JIBAKU — registrados em MON.Battle.MOVE_EFFECTS, sem motor novo.
 *   24 JIBAKUMINOR (recuo 0.33) | 42 JIBAKUSEAL (dreno 0.5)
 *   48 JIBAKUCHAIN (recuo 0.50) | 50 JIBAKU (autodesmaio)
 *   Os dois auto-destrutivos ficam ACIMA da faixa selvagem de D5 (40-47) de
 *   propósito: eco selvagem com selfKO se derrubaria sozinho e tornaria o pacto
 *   impossível. JIBAKU no 50 cai dentro da Dimensão Zero (48-55).
 *
 * ENCRENQUEIROS (912-919) — no motor eles são espécies próprias, porque o MZ não
 * tem estado de espécie; o par ESTADO/CURA vive no campo "corruptedFrom", que
 * aponta a criatura de volta. purify() faz o caminho de volta reusando o mesmo
 * evolveInto da evolução, sem motor novo. O gate de captura barra os dois lados:
 * o bloqueio é explícito porque catchRate 0 cairia no fallback "|| 45" de
 * MON.Battle.tryCapture e os deixaria MAIS fáceis de capturar.
 *
 * @command recognizeInWorld
 * @text Reconhecer Grande Criança
 * @desc Concede o Selo de Raiz daquele mundo e o Relógio GC (se ainda não tiver).
 *
 * @arg mark
 * @type string
 * @default GC_01
 * @text Selo
 * @desc GC_01 a GC_12, na ordem do relógio (GC_01 Primas ... GC_12 Doidicus).
 *
 * @command purify
 * @text Curar Encrenqueiro
 * @desc Retira a toxina de um Encrenqueiro do time e devolve a criatura original.
 *
 * @arg index
 * @type number
 * @default 0
 * @text Posição no time
 * @desc Índice do monstro no time (0 = primeiro).
 *
 * @command progress
 * @text Progresso dos Pactos
 * @desc Lê quantos Selos e quantos pactos o jogador já tem.
 *
 * @arg markVar
 * @type variable
 * @default 0
 * @text Variável (selos)
 * @desc Recebe quantos Selos de Raiz você tem.
 *
 * @arg pactVar
 * @type variable
 * @default 0
 * @text Variável (pactos)
 * @desc Recebe quantos ecos já pactuaram.
 */

var MON = MON || {};
MON.Pacts = MON.Pacts || {};

(() => {
    "use strict";

    const FRANCHISE_ID = "BKY";
    // os doze países na ordem do relógio; o índice+1 é o número do selo
    const WORLDS = ["Primas", "Secandas", "Trios", "Tetras", "Pentas", "Hexas",
        "Seteras", "Octas", "Novas", "Dicas", "Undicus", "Doidicus"];
    const MARKS = WORLDS.map((_, i) => "GC_" + String(i + 1).padStart(2, "0"));
    const EMBLEM_ITEM = "GCEMBLEM";

    // bônus de captura por status (mesma escala das gerações 1-3)
    const STATUS_BONUS = { SLP: 2, FRZ: 2, PAR: 1.5, PSN: 1.5, TOX: 1.5, BRN: 1.5 };

    MON.Pacts.WORLDS = WORLDS;
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
    // Selo de Raiz (insígnia, uma por mundo, registrada no Relógio GC)
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
    MON.Pacts.worldOfMark = function(id) {
        const i = MARKS.indexOf(id);
        return i < 0 ? null : WORLDS[i];
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
    // Relógio GC (item de captura, um só serve para os doze mundos)
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

    // ser reconhecido num mundo entrega o selo E o aparelho do pacto
    MON.Pacts.recognizeInWorld = function(markId) {
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

    MON.Pacts.isEcho = function(monster) {
        const sp = speciesOf(monster);
        return !!(sp && sp.pactMark);
    };
    MON.Pacts.isJibaku = function(monster) {
        const sp = speciesOf(monster);
        return !!(sp && sp.uniqueSpirit);
    };
    MON.Pacts.isTroublemonster = function(monster) {
        const sp = speciesOf(monster);
        return !!(sp && sp.troublemonster);
    };

    // função pura: nega o pacto por toxina, por Espírito único, por selo ausente
    // ou pelo eco de Doidicus, que dorme até os outros pactos estarem firmados.
    MON.Pacts.canPact = function(monster) {
        const sp = speciesOf(monster);
        if (!sp) return { ok: true, reason: null };
        if (sp.troublemonster) {
            return { ok: false, reason: "{target} está Encrenqueiro: isso não se captura, se cura." };
        }
        if (sp.uniqueSpirit) {
            return { ok: false, reason: "{target} é o último Espírito: ele se herda, não se coleciona." };
        }
        if (!sp.pactMark) return { ok: true, reason: null };
        if (!MON.Pacts.hasMark(sp.pactMark)) {
            const where = sp.world ? "de " + sp.world : "deste mundo";
            return {
                ok: false,
                reason: "{target} desvia o olhar: sem o Selo de Raiz " + where + ", não há pacto."
            };
        }
        if (sp.requiresAllPacts) {
            const done = MON.Pacts.pactCount();
            const needed = MON.Pacts.echoes().length - 1;
            if (done < needed) {
                return {
                    ok: false,
                    reason: "{target} continua adormecido sob o gelo: " + done + " de " + needed
                        + " pactos firmados nos outros mundos."
                };
            }
        }
        return { ok: true, reason: null };
    };

    MON.Pacts.echoes = function() {
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
        return MON.Pacts.echoes().filter(e => e.pacted).length;
    };

    //=========================================================================
    // Cura do Encrenqueiro — o estado é reversível; a criatura por baixo é a mesma
    //=========================================================================
    MON.Pacts.canPurify = function(monster) {
        const sp = speciesOf(monster);
        if (!sp || !sp.troublemonster) {
            return { ok: false, reason: "Só uma criatura Encrenqueira carrega a toxina.", into: null };
        }
        const src = MON.Core.speciesByInternal(sp.corruptedFrom);
        if (!src) {
            return { ok: false, reason: "O Relógio GC não reconhece a criatura por baixo da toxina.", into: null };
        }
        return { ok: true, reason: null, into: src.internalName };
    };
    MON.Pacts.purify = function(monster) {
        const res = MON.Pacts.canPurify(monster);
        if (!res.ok || !monster || typeof monster.evolveInto !== "function") return false;
        return monster.evolveInto(res.into);
    };

    // gate de captura: vale só para os Doze Mundos, as outras dimensões seguem intactas
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
        const bonus = MON.Pacts.isEcho(wild)
            ? statusBonus * MON.Pacts.statusBonus(wild)
            : statusBonus;
        return _tryCapture.call(this, wild, ballBonus, bonus);
    };

    //=========================================================================
    // Comandos de plugin
    //=========================================================================
    PluginManager.registerCommand("MON_Pacts", "recognizeInWorld", args => {
        MON.Pacts.recognizeInWorld(String(args.mark || "").trim());
    });
    PluginManager.registerCommand("MON_Pacts", "purify", args => {
        const mon = $gameParty.monParty()[Number(args.index) || 0];
        const before = mon && mon.name;
        if (MON.Pacts.purify(mon)) {
            $gameMessage.add("A toxina se soltou! " + before + " voltou a ser " + mon.speciesName + "!");
        } else {
            $gameMessage.add(MON.Pacts.canPurify(mon).reason);
        }
    });
    PluginManager.registerCommand("MON_Pacts", "progress", args => {
        const markVar = Number(args.markVar || 0);
        const pactVar = Number(args.pactVar || 0);
        if (markVar > 0) $gameVariables.setValue(markVar, MON.Pacts.markCount());
        if (pactVar > 0) $gameVariables.setValue(pactVar, MON.Pacts.pactCount());
    });
})();
