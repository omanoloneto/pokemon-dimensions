//=============================================================================
// PKM_Trainers.js  — Fase 9
//=============================================================================
/*:
 * @target MZ
 * @plugindesc [PKM v0.5] Batalhas de treinador com o rival EM CAMPO (humano + 2
 * monstros), recompensa em dinheiro, sem captura/fuga, e insígnias de ginásio.
 * @author Pokémon Dimensions (port MZ)
 * @base PKM_Core
 * @base PKM_Pokemon
 * @base PKM_Party
 * @base PKM_Battle
 * @orderAfter PKM_Battle
 * @orderAfter PKM_Human
 * @orderAfter PKM_Field
 *
 * @help PKM_Trainers.js
 *
 * Carrega data/Trainers.json (compilado de trainers.txt + trainertypes.txt).
 * Em batalha de treinador não é possível capturar nem fugir, e ao vencer você
 * recebe prêmio em dinheiro (baseMoney do tipo × maior nível da equipe).
 *
 *   PKM.Trainers.start("LEADER_Brock", "Brock", {defeatText:"Impressionante!"})
 *
 * O RIVAL LUTA JUNTO
 * ----------------------------------------------------------------------------
 * O time inimigo é simétrico ao seu: o humano + os monstros dele. `build()` devolve
 *
 *   .human  Game_Human do treinador (ou null, se não houver classe humana no banco)
 *   .party  só os monstros, na ordem do dado (inalterado)
 *   .team   o time de batalha: [humano, ...monstros] — slot 0 é sempre o humano
 *
 * Os 3 primeiros de `.team` entram em campo (humano + 2 monstros) e o resto fica
 * na reserva; quem cai é substituído por PKM.Field.
 *
 * CLASSE HUMANA DO TREINADOR
 * ----------------------------------------------------------------------------
 * A classe (faixa HUM, data/species/HUM.json) sai do próprio tipo do treinador,
 * sem tabela gigante. Ordem de resolução, primeira que existir no banco vence:
 *
 *   1. campo "humanClass" da entrada do treinador em Trainers.json
 *   2. campo "humanClass" do TIPO em Trainers.json
 *   3. PKM.Trainers.humanClassAlias[internalName do tipo]
 *   4. o próprio internalName do tipo            (BLACKBELT -> BLACKBELT)
 *   5. a raiz do internalName, sem sufixo/dígito (LEADER_Brock -> LEADER, RIVAL1 -> RIVAL)
 *      e o alias dessa raiz                      (LEADER -> MARKLEADER)
 *   6. a classe padrão (TRAINER)
 *
 * Sem nenhuma classe humana no banco, o treinador simplesmente fica fora do campo:
 * `.human` vira null e `.team` são só os monstros.
 *
 * Insígnias: $gameSystem.pkmGiveBadge("KANTO_1"), pkmHasBadge(id), pkmBadgeCount().
 *
 * @param humanClass
 * @text Classe humana padrão
 * @type string
 * @default TRAINER
 * @desc Classe da faixa HUM usada quando o tipo do treinador não tem uma própria.
 *
 * @command battle
 * @text Batalha de Treinador
 * @arg type @type string @text Tipo @desc internalName do tipo (ex.: LEADER_Brock, YOUNGSTER).
 * @arg name @type string @text Nome @desc Nome do treinador (ex.: Brock). Vazio = primeiro do tipo.
 * @arg partyId @type number @min 0 @default 0 @text Variante @desc Para tipos com várias equipes de mesmo nome.
 * @arg introText @type string @text Fala inicial @desc Opcional.
 * @arg defeatText @type string @text Fala ao perder @desc Opcional (dita quando você vence).
 *
 * @command giveBadge
 * @text Dar Insígnia
 * @arg badge @type string @text ID da insígnia @desc ex.: KANTO_1
 */

var PKM = PKM || {};

(() => {
    "use strict";

    const P = (typeof PluginManager !== "undefined" && PluginManager.parameters)
        ? PluginManager.parameters("PKM_Trainers") : {};
    const HUMAN_FRANCHISE = "HUM";
    const DEFAULT_HUMAN_CLASS = String(P.humanClass || "TRAINER");

    PKM.Trainers = PKM.Trainers || {};

    // apelidos para os tipos cujo nome não bate com nenhuma classe humana.
    // Tabela única e sobrescrevível — quem não estiver aqui cai no padrão.
    PKM.Trainers.humanClassAlias = {
        POKEMONTRAINER: "TRAINER",
        COOLTRAINER: "TRAINER",
        POKEMONBREEDER: "BREEDER",
        LEADER: "MARKLEADER",
        ELITEFOUR: "NEXUSKEEPER",
        CHAMPION: "UNIFIER",
        ROCKETBOSS: "HERALD",
        YOUNGSTER: "GREATCHILD",
        LASS: "GREATCHILD",
        TUBER: "GREATCHILD",
        BUGCATCHER: "GREATCHILD",
        CAMPER: "GREATCHILD",
        PICNICKER: "GREATCHILD"
    };

    PKM.Trainers.type = function(internalName) {
        return ($dataTrainers && $dataTrainers.types && $dataTrainers.types[internalName]) || null;
    };
    PKM.Trainers.find = function(type, name, partyId) {
        const list = ($dataTrainers && $dataTrainers.list) || [];
        return list.find(t =>
            t.type === type &&
            (!name || t.name === name) &&
            (partyId == null || t.partyId === Number(partyId))
        ) || null;
    };

    //=========================================================================
    // Humano do treinador
    //=========================================================================
    // só vale como classe humana o que existe no banco E está na faixa HUM
    function humanClassExists(name) {
        if (!name || !PKM.Core || !PKM.Core.speciesByInternal) return false;
        const sp = PKM.Core.speciesByInternal(String(name).toUpperCase());
        if (!sp) return false;
        if (!PKM.Franchise || !PKM.Franchise.ofSpecies) return true;
        const fr = PKM.Franchise.ofSpecies(sp.id);
        return !!fr && fr.id === HUMAN_FRANCHISE;
    }

    // LEADER_Brock -> LEADER | SWIMMER2_M -> SWIMMER | RIVAL1 -> RIVAL
    function classRoot(internalName) {
        return String(internalName || "").split("_")[0].replace(/\d+$/, "");
    }

    PKM.Trainers.humanClassFor = function(def, type) {
        const t = type || PKM.Trainers.type(def && def.type) || {};
        const internal = (def && def.type) || t.internalName || "";
        const root = classRoot(internal);
        const alias = PKM.Trainers.humanClassAlias;
        const candidates = [
            def && def.humanClass, t.humanClass,
            alias[internal], internal,
            alias[root], root,
            DEFAULT_HUMAN_CLASS
        ];
        return candidates.find(c => humanClassExists(c)) || null;
    };

    PKM.Trainers.buildHuman = function(def, type) {
        if (typeof Game_Human === "undefined") return null;
        const klass = PKM.Trainers.humanClassFor(def, type);
        if (!klass) return null;
        const level = (def.party || []).reduce((mx, m) => Math.max(mx, m.level), 0) || 5;
        const gender = (type && type.gender === "Female") ? "F" : (type && type.gender === "Male") ? "M" : null;
        return new Game_Human(String(klass).toUpperCase(), level, { name: def.name, gender });
    };

    //=========================================================================
    // Construção do treinador "vivo"
    //=========================================================================
    PKM.Trainers.build = function(def, opts = {}) {
        const type = PKM.Trainers.type(def.type) || {};
        const party = def.party.map(m => {
            const p = new Game_Pokemon(m.species, m.level);
            if (m.moves && m.moves.length) p.setMoves(m.moves);
            if (m.gender) p._gender = m.gender;
            if (m.shiny) p._shiny = true;
            return p;
        });
        const human = opts.human !== undefined ? opts.human : PKM.Trainers.buildHuman(def, type);
        const lastLevel = def.party.reduce((mx, m) => Math.max(mx, m.level), 0);
        const money = (type.baseMoney || 30) * lastLevel;
        const display = (type.name ? type.name + " " : "") + def.name;
        return {
            name: display, human, party,
            team: human ? [human].concat(party) : party.slice(),
            money,
            introText: opts.introText || null,
            defeatText: opts.defeatText || null
        };
    };

    PKM.Trainers.start = function(type, name, opts = {}) {
        const def = PKM.Trainers.find(type, name, opts.partyId);
        if (!def) { console.warn("PKM: treinador não encontrado:", type, name); return false; }
        if (!playerReady()) return false;
        const built = PKM.Trainers.build(def, opts);
        $gameTemp.pkmTrainer = built;
        $gameTemp.pkmFoes = built.team;
        $gameTemp.pkmWild = null;                    // batalha de treinador não tem selvagem
        if (typeof SceneManager !== "undefined" && typeof Scene_PkmBattle !== "undefined") {
            SceneManager.push(Scene_PkmBattle);
        }
        return true;
    };

    function playerReady() {
        if (typeof $gameParty === "undefined" || !$gameParty) return false;
        // com humano em campo, o jogador ainda luta sem nenhum monstro de pé
        if ($gameParty.pkmBattleTeam) return $gameParty.pkmBattleTeam().length > 0;
        return !($gameParty.pkmCount && $gameParty.pkmCount() === 0);
    }

    //=========================================================================
    // Insígnias (Game_System)
    //=========================================================================
    Game_System.prototype.pkmGiveBadge = function(id) {
        if (!this._pkmBadges) this._pkmBadges = [];
        if (!this._pkmBadges.includes(id)) this._pkmBadges.push(id);
    };
    Game_System.prototype.pkmHasBadge = function(id) {
        return !!(this._pkmBadges && this._pkmBadges.includes(id));
    };
    Game_System.prototype.pkmBadgeCount = function() {
        return this._pkmBadges ? this._pkmBadges.length : 0;
    };

    //=========================================================================
    // Comandos de plugin
    //=========================================================================
    if (typeof PluginManager !== "undefined") {
        PluginManager.registerCommand("PKM_Trainers", "battle", args => {
            PKM.Trainers.start(args.type, args.name || null, {
                partyId: args.partyId !== undefined ? Number(args.partyId) : 0,
                introText: args.introText || null,
                defeatText: args.defeatText || null
            });
        });
        PluginManager.registerCommand("PKM_Trainers", "giveBadge", args => {
            $gameSystem.pkmGiveBadge(args.badge);
        });
    }
})();
