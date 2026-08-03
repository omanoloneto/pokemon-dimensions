//=============================================================================
// MON_Evolution.js  — Digimon
//=============================================================================
/*:
 * @target MZ
 * @plugindesc [MON v0.4] Evolução: métodos completos (pedra, amizade, golpe,
 * vínculo, local), condição ramificada (digievolução) e Digimemória.
 * @author Pokémon Dimensions
 * @base MON_Core
 * @base MON_Monster
 * @orderAfter MON_Monster
 * @orderBefore MON_Battle
 *
 * @help MON_Evolution.js
 *
 * Dono único da evolução estendida. Substitui Game_Monster.evolutionByLevel
 * (que só entendia Level/LevelMale/LevelFemale) por uma tabela de métodos.
 *
 * ---------------------------------------------------------------------------
 * DOIS GATILHOS
 * ---------------------------------------------------------------------------
 *   evolutionByLevel()            -> disparado ao subir de nível
 *   MON.Evolution.byItem(p, item) -> disparado ao usar um item no monstro
 *
 * Ambos devolvem o internalName do alvo ou null, e nunca mutam o monstro.
 * Método fora das tabelas SEMPRE reprova: dado desconhecido não evolui nada.
 *
 * Métodos por nível:
 *   Level / LevelMale / LevelFemale     nível (+ gênero)
 *   AttackGreater / DefenseGreater /
 *   AtkDefEqual                         nível + comparação Atk vs Def (Tyrogue)
 *   Silcoon / Cascoon                   nível + ramo fixo do indivíduo (Wurmple)
 *   Ninjask                             nível (Nincada)
 *   Happiness / HappinessDay /
 *   HappinessNight                      amizade >= HAPPINESS_THRESHOLD
 *   HasMove                             conhece o golpe indicado
 *   HasInParty                          espécie indicada na equipe (Mantyke)
 *   Location                            mapa atual (ver LOCATION_MAPS)
 *
 * Métodos por item (MON.Evolution.byItem):
 *   Item / ItemMale / ItemFemale        a pedra indicada (+ gênero)
 *   DayHoldItem / NightHoldItem         o item indicado
 *   Trade                               Cabo Link (LINKCABLE)
 *   TradeItem                           Cabo Link + o item indicado na mochila
 *   TradeSpecies                        Cabo Link + a espécie indicada na equipe
 *
 * Fora das tabelas de propósito: Shedinja (exige criar um segundo monstro e um
 * slot livre) e Beauty (não há stat de beleza — Feebas evolui pela Prism Scale).
 *
 * ---------------------------------------------------------------------------
 * DECISÕES DE ESCOPO (docs/01: sem day/night, sem held items, sem troca)
 * ---------------------------------------------------------------------------
 * · HappinessDay e HappinessNight caem no MESMO critério de Happiness. Quando a
 *   espécie tem os dois ramos, vale a regra geral de prioridade (primeiro da
 *   lista que passa): Eevee feliz vira Espeon, e Umbreon fica reservado para
 *   quando existir um gatilho próprio de design.
 * · Sem held items, DayHoldItem/NightHoldItem viram "usar o item no monstro".
 * · Sem troca entre jogadores, Trade* passa pelo Cabo Link. O item exigido pelo
 *   TradeItem (ex.: Metal Coat) é REQUISITO, não combustível: só o Cabo Link é
 *   consumido, porque sem held items aquele item não teria outro uso e cobrar
 *   dois consumíveis pela mesma evolução só esconde a regra do jogador.
 * · Location compara o mapa atual com LOCATION_MAPS. Os params do banco são ids
 *   do Essentials original (28, 34, 49, 50, 51) e o jogo ainda só tem Map001 e
 *   Map002: a tabela nasce VAZIA e a regra falha fechada. Quando o mapa existir,
 *   basta mapear MON.Evolution.LOCATION_MAPS["28"] = <id do mapa no MZ>.
 *
 * ---------------------------------------------------------------------------
 * CONDIÇÃO RAMIFICADA (digievolução)
 * ---------------------------------------------------------------------------
 * Campo opcional "condition" em cada entrada de "evolutions":
 *
 *   { "into": "GREYMON", "method": "Level", "param": "20",
 *     "condition": { "faintsBelow": 3 } }
 *
 * Condições suportadas (todas lidas do estado que Game_Monster já mantém):
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
 * é sempre verdadeira. Quando mais de uma evolução está disponível, vence a
 * PRIMEIRA da lista: a ordem no JSON é a prioridade de design.
 *
 * ---------------------------------------------------------------------------
 * API
 * ---------------------------------------------------------------------------
 *   MON.Evolution.checkCondition(monster, condition) -> bool
 *   MON.Evolution.byItem(monster, itemName)          -> internalName | null
 *   MON.Evolution.isEvolutionItem(itemName)          -> bool
 *   MON.Evolution.installBagIntegration()            -> instala os hooks tardios
 *   MON.Evolution.useDigimemory(monster)             -> {ok, message}
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

var MON = MON || {};
MON.Evolution = MON.Evolution || {};

(() => {
    "use strict";

    const PLUGIN_NAME = "MON_Evolution";
    const DEVOLVE_ITEM = "DIGIMEMORY";
    const DEVOLVE_FRANCHISE = "DGM";
    const LINK_ITEM = "LINKCABLE";
    const HAPPINESS_THRESHOLD = 220;

    // param do banco -> id do mapa no MZ. Vazia enquanto os mapas não existem.
    MON.Evolution.LOCATION_MAPS = {};

    //=========================================================================
    // Leituras do mundo (tudo tolerante a ambiente headless)
    //=========================================================================
    function party() {
        return typeof $gameParty !== "undefined" ? $gameParty : null;
    }
    function bagHas(internalName) {
        const p = party();
        return !!(p && p.monHasItem && p.monHasItem(internalName));
    }
    function partyHasSpecies(internalName) {
        const p = party();
        const members = p && p.monParty ? p.monParty() : null;
        if (!members) return false;
        const up = String(internalName).toUpperCase();
        return members.some(m => m && m.species() && m.species().internalName === up);
    }
    function currentMapId() {
        const map = typeof $gameMap !== "undefined" ? $gameMap : null;
        return map && map.mapId ? map.mapId() : 0;
    }
    function onLocation(param) {
        const target = MON.Evolution.LOCATION_MAPS[String(param)];
        return target !== undefined && currentMapId() === Number(target);
    }
    // Wurmple sorteia o ramo por indivíduo; a natureza já é fixa no nascimento
    // e faz esse papel sem inventar campo novo no save.
    function splitBranch(monster) {
        const natures = (MON.Pokemon && MON.Pokemon.NATURES) || [];
        return natures.indexOf(monster.natureData()) % 2;
    }

    const atLeast = (p, v) => { const n = Number(v); return Number.isFinite(n) && p.level >= n; };
    const isHappy = (p) => p.friendship >= HAPPINESS_THRESHOLD;
    const sameItem = (v, item) => String(v).toUpperCase() === item;

    //=========================================================================
    // Tabelas de método — chave ausente reprova (falha fechada)
    //=========================================================================
    const LEVEL_METHODS = {
        Level:          (p, v) => atLeast(p, v),
        LevelMale:      (p, v) => atLeast(p, v) && p.gender === "M",
        LevelFemale:    (p, v) => atLeast(p, v) && p.gender === "F",
        AttackGreater:  (p, v) => atLeast(p, v) && p.stat("atk") > p.stat("def"),
        DefenseGreater: (p, v) => atLeast(p, v) && p.stat("def") > p.stat("atk"),
        AtkDefEqual:    (p, v) => atLeast(p, v) && p.stat("atk") === p.stat("def"),
        Silcoon:        (p, v) => atLeast(p, v) && splitBranch(p) === 0,
        Cascoon:        (p, v) => atLeast(p, v) && splitBranch(p) === 1,
        Ninjask:        (p, v) => atLeast(p, v),
        Happiness:       isHappy,
        HappinessDay:    isHappy,
        HappinessNight:  isHappy,
        HasMove:        (p, v) => p.knowsMove(String(v)),
        HasInParty:     (p, v) => partyHasSpecies(v),
        Location:       (p, v) => onLocation(v)
    };

    const ITEM_METHODS = {
        Item:          (p, v, item) => sameItem(v, item),
        ItemMale:      (p, v, item) => sameItem(v, item) && p.gender === "M",
        ItemFemale:    (p, v, item) => sameItem(v, item) && p.gender === "F",
        DayHoldItem:   (p, v, item) => sameItem(v, item),
        NightHoldItem: (p, v, item) => sameItem(v, item),
        Trade:         (p, v, item) => item === LINK_ITEM,
        TradeItem:     (p, v, item) => item === LINK_ITEM && bagHas(String(v)),
        TradeSpecies:  (p, v, item) => item === LINK_ITEM && partyHasSpecies(v)
    };
    // métodos cujo param é o próprio item usado (os Trade* usam o Cabo Link)
    const DIRECT_ITEM_METHODS = ["Item", "ItemMale", "ItemFemale", "DayHoldItem", "NightHoldItem"];

    //=========================================================================
    // Consultas puras
    //=========================================================================
    const evolutionsOf = (monster) => (monster.species() && monster.species().evolutions) || [];

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

    // chave desconhecida reprova: erro de dados nunca libera uma evolução errada
    MON.Evolution.checkCondition = function(monster, condition) {
        if (!condition) return true;
        if (!monster) return false;
        return Object.keys(condition).every(key => {
            const check = own(CONDITIONS, key);
            return check ? check(monster, condition[key]) : false;
        });
    };

    // só chave PRÓPRIA vale: sem isto, method "toString"/"valueOf" resolveria pela
    // cadeia de protótipo e um dado ruim evoluiria errado (ou derrubaria a batalha).
    function own(table, key) {
        return Object.prototype.hasOwnProperty.call(table, key) ? table[key] : null;
    }

    function firstMatch(monster, table, extra) {
        for (const ev of evolutionsOf(monster)) {
            const check = own(table, ev.method);
            if (!check || !check(monster, ev.param, extra)) continue;
            if (!MON.Evolution.checkCondition(monster, ev.condition)) continue;
            return ev.into;
        }
        return null;
    }

    Game_Monster.prototype.evolutionByLevel = function() {
        return firstMatch(this, LEVEL_METHODS);
    };

    MON.Evolution.byItem = function(monster, itemName) {
        if (!monster || !itemName) return null;
        return firstMatch(monster, ITEM_METHODS, String(itemName).toUpperCase());
    };

    // itens que disparam evolução, lidos do próprio banco (nada hardcoded).
    // Preguiçoso porque o merge multi-franquia só roda depois dos plugins.
    let evolutionItems = null;
    MON.Evolution.isEvolutionItem = function(itemName) {
        if (!itemName) return false;
        if (!evolutionItems) {
            evolutionItems = new Set([LINK_ITEM]);
            for (const sp of (typeof $dataMonsters !== "undefined" && $dataMonsters) || []) {
                for (const ev of (sp && sp.evolutions) || []) {
                    if (DIRECT_ITEM_METHODS.includes(ev.method)) {
                        evolutionItems.add(String(ev.param).toUpperCase());
                    }
                }
            }
        }
        return evolutionItems.has(String(itemName).toUpperCase());
    };

    //=========================================================================
    // Integração com a mochila (hook TARDIO)
    //=========================================================================
    // js/plugins.js carrega MON_Bag DEPOIS deste plugin, então envolver
    // MON.Items.useOnMonster agora seria código morto: MON_Bag reatribuiria o
    // método logo em seguida. Scene_Boot.start é o primeiro momento com todos os
    // plugins já avaliados — no headless o teste chama installBagIntegration().
    let bagInstalled = false;
    MON.Evolution.installBagIntegration = function() {
        if (bagInstalled || !MON.Items || !MON.Items.useOnMonster) return;
        bagInstalled = true;

        const _useOnMonster = MON.Items.useOnMonster;
        MON.Items.useOnMonster = function(name, pkm) {
            const into = pkm ? MON.Evolution.byItem(pkm, name) : null;
            if (!into) return _useOnMonster.call(this, name, pkm);
            const before = pkm.name;
            if (!pkm.evolveInto(into)) return _useOnMonster.call(this, name, pkm);
            return { ok: true, message: before + " evoluiu em " + pkm.speciesName + "!" };
        };

        if (typeof Scene_MonBag === "undefined" || !Scene_MonBag.prototype.onItemOk) return;
        const _onItemOk = Scene_MonBag.prototype.onItemOk;
        Scene_MonBag.prototype.onItemOk = function() {
            const entry = this._list.currentEntry();
            if (!entry || !MON.Evolution.isEvolutionItem(entry.name)) return _onItemOk.call(this);
            this._pendingItem = entry.name;
            this._list.deactivate();
            this._target.refresh();
            this._target.show();
            this._target.activate();
            this._target.select(0);
        };
    };

    if (typeof Scene_Boot !== "undefined" && Scene_Boot.prototype.start) {
        const _Scene_Boot_start = Scene_Boot.prototype.start;
        Scene_Boot.prototype.start = function() {
            MON.Evolution.installBagIntegration();
            _Scene_Boot_start.call(this);
        };
    }

    //=========================================================================
    // Digimemória
    //=========================================================================
    // Desfaz a digievolução mais recente. Não mexe na mochila — quem consome o
    // item é o comando de plugin.
    MON.Evolution.useDigimemory = function(monster) {
        if (!monster) return { ok: false, message: "Nenhum parceiro selecionado." };
        if (MON.Franchise && MON.Franchise.idOf(monster) !== DEVOLVE_FRANCHISE) {
            return { ok: false, message: "A Digimemória só responde a Digimon." };
        }
        const before = monster.name;
        if (!monster.devolve()) {
            return { ok: false, message: before + " não tem digievolução para reverter." };
        }
        return { ok: true, message: before + " reverteu para " + monster.speciesName + "!" };
    };

    PluginManager.registerCommand(PLUGIN_NAME, "devolve", args => {
        const item = MON.Core.item(DEVOLVE_ITEM);
        if (!$gameParty.monHasItem(DEVOLVE_ITEM)) {
            $gameMessage.add("Você não tem " + (item ? item.name : DEVOLVE_ITEM) + ".");
            return;
        }
        const res = MON.Evolution.useDigimemory($gameParty.monParty()[Number(args.index) || 0]);
        if (res.ok) $gameParty.monLoseItem(DEVOLVE_ITEM, 1);
        $gameMessage.add(res.message);
    });
})();
