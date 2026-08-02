//=============================================================================
// PKM_Evolution.js  — Digimon
//=============================================================================
/*:
 * @target MZ
 * @plugindesc [PKM v0.3] Evolução ramificada com condição (digievolução) e Digimemória.
 * @author Pokémon Dimensions
 * @base PKM_Core
 * @base PKM_Pokemon
 * @orderAfter PKM_Pokemon
 * @orderBefore PKM_Battle
 *
 * @help PKM_Evolution.js
 *
 * Estende a evolução por nível já existente com um campo opcional "condition"
 * em cada entrada de "evolutions" (data/species/*.json):
 *
 *   { "into": "GREYMON", "method": "Level", "param": "20",
 *     "condition": { "faintsBelow": 3 } }
 *
 * Condições suportadas (todas lidas do estado que Game_Pokemon já mantém):
 *   faintsBelow      nº de desmaios menor que o valor
 *   faintsAtLeast    nº de desmaios maior ou igual ao valor
 *   winsAtLeast      nº de vitórias maior ou igual ao valor
 *   friendshipAbove  amizade maior que o valor
 *   friendshipBelow  amizade menor que o valor
 *   highestStat      maior stat de combate ("atk"|"def"|"spa"|"spd"|"spe")
 *   hasItem          internalName presente na mochila
 *   gender           "M" | "F" | "N"
 *
 * Várias chaves no mesmo objeto valem como E lógico. Sem "condition" a entrada
 * é sempre verdadeira — as 649 espécies Pokémon seguem inalteradas.
 * Quando mais de uma evolução está disponível no mesmo nível, vence a PRIMEIRA
 * da lista cuja condição passa: a ordem no JSON é a prioridade de design.
 *
 * API:
 *   PKM.Evolution.checkCondition(pokemon, condition) -> bool
 *   PKM.Evolution.useDigimemory(pokemon) -> {ok, message}
 *
 * @command devolve
 * @text Usar Digimemória
 * @desc Reverte a digievolução mais recente de um Digimon da equipe.
 *
 * @arg index
 * @type number
 * @min 0
 * @default 0
 * @text Posição na equipe
 * @desc 0 = primeiro membro da equipe.
 */

var PKM = PKM || {};
PKM.Evolution = PKM.Evolution || {};

(() => {
    "use strict";

    const PLUGIN_NAME = "PKM_Evolution";
    const DEVOLVE_ITEM = "DIGIMEMORY";
    const DEVOLVE_FRANCHISE = "DGM";

    const CONDITIONS = {
        faintsBelow:     (p, v) => p.faints < Number(v),
        faintsAtLeast:   (p, v) => p.faints >= Number(v),
        winsAtLeast:     (p, v) => p.wins >= Number(v),
        friendshipAbove: (p, v) => p.friendship > Number(v),
        friendshipBelow: (p, v) => p.friendship < Number(v),
        highestStat:     (p, v) => p.highestStat() === String(v),
        hasItem:         (p, v) => bagHas(String(v)),
        gender:          (p, v) => p.gender === String(v)
    };

    function bagHas(internalName) {
        const party = typeof $gameParty !== "undefined" ? $gameParty : null;
        return !!(party && party.pkmHasItem && party.pkmHasItem(internalName));
    }

    // chave desconhecida reprova: erro de dados nunca libera uma evolução errada
    PKM.Evolution.checkCondition = function(pokemon, condition) {
        if (!condition) return true;
        if (!pokemon) return false;
        return Object.keys(condition).every(key => {
            const check = CONDITIONS[key];
            return check ? check(pokemon, condition[key]) : false;
        });
    };

    function methodMatches(pokemon, evolution) {
        if (evolution.method === "Level") return true;
        if (evolution.method === "LevelMale") return pokemon.gender === "M";
        if (evolution.method === "LevelFemale") return pokemon.gender === "F";
        return false;
    }

    const _Game_Pokemon_evolutionByLevel = Game_Pokemon.prototype.evolutionByLevel;
    Game_Pokemon.prototype.evolutionByLevel = function() {
        const list = (this.species() && this.species().evolutions) || [];
        if (!list.some(ev => ev.condition)) return _Game_Pokemon_evolutionByLevel.call(this);
        for (const ev of list) {
            if (Number(ev.param) > this.level) continue;
            if (!methodMatches(this, ev)) continue;
            if (!PKM.Evolution.checkCondition(this, ev.condition)) continue;
            return ev.into;
        }
        return null;
    };

    // Digimemória: desfaz a digievolução mais recente. Não mexe na mochila —
    // quem consome o item é o comando de plugin.
    PKM.Evolution.useDigimemory = function(pokemon) {
        if (!pokemon) return { ok: false, message: "Nenhum parceiro selecionado." };
        if (PKM.Franchise && PKM.Franchise.idOf(pokemon) !== DEVOLVE_FRANCHISE) {
            return { ok: false, message: "A Digimemória só responde a Digimon." };
        }
        const before = pokemon.name;
        if (!pokemon.devolve()) {
            return { ok: false, message: before + " não tem digievolução para reverter." };
        }
        return { ok: true, message: before + " reverteu para " + pokemon.speciesName + "!" };
    };

    PluginManager.registerCommand(PLUGIN_NAME, "devolve", args => {
        const item = PKM.Core.item(DEVOLVE_ITEM);
        if (!$gameParty.pkmHasItem(DEVOLVE_ITEM)) {
            $gameMessage.add("Você não tem " + (item ? item.name : DEVOLVE_ITEM) + ".");
            return;
        }
        const res = PKM.Evolution.useDigimemory($gameParty.pkmParty()[Number(args.index) || 0]);
        if (res.ok) $gameParty.pkmLoseItem(DEVOLVE_ITEM, 1);
        $gameMessage.add(res.message);
    });
})();
