//=============================================================================
// PKM_Sanctuary.js  — Monster Rancher
//=============================================================================
/*:
 * @target MZ
 * @plugindesc [PKM v0.3] Santuário de Discos (Monster Rancher): o disco vira
 * monstro por sorteio determinístico da seed, e o treino de fazenda aplica EVs.
 * @author Pokémon Dimensions
 * @base PKM_Core
 * @base PKM_Pokemon
 * @orderAfter PKM_Franchise
 * @orderAfter PKM_Bag
 * @orderAfter PKM_Storage
 *
 * @help PKM_Sanctuary.js
 *
 * Na Dimensão Fazenda não existe captura em campo (Franchises.json, inField:false).
 * Monstros nascem de discos levados ao Santuário: o nome/seed do disco tempera o
 * sorteio, então o mesmo par (disco, seed) sempre gera o mesmo monstro.
 *
 * API:
 *   PKM.Sanctuary.hash(seed)               -> inteiro 32 bits determinístico
 *   PKM.Sanctuary.disc(discId)             -> entrada de data/Discs.json
 *   PKM.Sanctuary.preview(discId, seed)    -> {species, level} | null
 *   PKM.Sanctuary.generate(discId, seed)   -> {ok, pokemon, message}
 *   PKM.Sanctuary.train(pokemon, statKey, amount) -> {ok, gained, message}
 *   PKM.Sanctuary.evTotal(pokemon) / evOf(pokemon, statKey)
 *
 * Treino de fazenda reusa os EVs do sistema: teto de 252 por stat e 510 no total.
 *
 * @command giveDisc
 * @text Dar Disco
 * @desc Coloca discos na mochila do jogador.
 * @arg disc
 * @type string
 * @default DISCCOMMON
 * @text Disco
 * @desc internalName do disco (DISCCOMMON, DISCRARE, DISCLEGEND).
 * @arg qty
 * @type number
 * @min 1
 * @default 1
 * @text Quantidade
 *
 * @command generate
 * @text Gerar Monstro do Disco
 * @desc Consome o disco e entrega o monstro sorteado pela seed.
 * @arg disc
 * @type string
 * @default DISCCOMMON
 * @text Disco
 * @arg seed
 * @type string
 * @default
 * @text Seed
 * @desc Texto que tempera o sorteio (nome do disco escrito pelo jogador).
 * @arg resultSwitch
 * @type switch
 * @default 0
 * @text Switch de Resultado
 * @desc Recebe ON quando o monstro nasce.
 *
 * @command train
 * @text Treinar na Fazenda
 * @desc Ganho permanente de EV no stat escolhido, respeitando os tetos.
 * @arg index
 * @type number
 * @min 0
 * @default 0
 * @text Posição na Equipe
 * @arg stat
 * @type select
 * @option hp
 * @option atk
 * @option def
 * @option spe
 * @option spa
 * @option spd
 * @default atk
 * @text Stat
 * @arg amount
 * @type number
 * @min 1
 * @default 10
 * @text Ganho de EV
 */

var $dataDiscs = $dataDiscs || null;

var PKM = PKM || {};
PKM.Sanctuary = PKM.Sanctuary || {};

(() => {
    "use strict";

    const PLUGIN_NAME = "PKM_Sanctuary";
    const STAT_KEYS = ["hp", "atk", "def", "spe", "spa", "spd"];
    const STAT_LABELS = {
        hp: "Vitalidade", atk: "Força", def: "Resistência",
        spe: "Velocidade", spa: "Poder", spd: "Firmeza"
    };
    const EV_MAX_PER_STAT = 252;
    const EV_MAX_TOTAL = 510;
    const DEFAULT_TRAIN_GAIN = 10;

    DataManager._databaseFiles.push({ name: "$dataDiscs", src: "Discs.json" });

    //=========================================================================
    // Sorteio determinístico
    //=========================================================================
    PKM.Sanctuary.disc = function(discId) {
        return ($dataDiscs && $dataDiscs[discId]) || null;
    };

    PKM.Sanctuary.discName = function(discId) {
        const item = PKM.Core.item(discId);
        if (item) return item.name;
        const disc = PKM.Sanctuary.disc(discId);
        return (disc && disc.name) || String(discId);
    };

    // FNV-1a 32 bits: a mesma seed tem de gerar sempre o mesmo monstro
    PKM.Sanctuary.hash = function(seed) {
        const text = seed === null || seed === undefined ? "" : String(seed);
        let h = 0x811c9dc5;
        for (let i = 0; i < text.length; i++) {
            h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
        }
        return h >>> 0;
    };

    // xorshift32: avança a sequência sem tocar em Math.random
    function step(state) {
        let x = state >>> 0 || 0x9e3779b9;
        x ^= (x << 13) >>> 0; x >>>= 0;
        x ^= x >>> 17;
        x ^= (x << 5) >>> 0;  x >>>= 0;
        return x >>> 0 || 0x9e3779b9;
    }

    function weightOf(entry) {
        return Math.max(0, Number(entry && entry.weight) || 0);
    }

    function pickEntry(pool, roll) {
        let acc = roll;
        for (const entry of pool) {
            const w = weightOf(entry);
            if (acc < w) return entry;
            acc -= w;
        }
        return null;
    }

    function levelFrom(entry, state) {
        const range = entry.levelRange || [];
        const a = Number(range[0]) || 1;
        const b = Number(range[1]) || a;
        const lo = Math.min(a, b), hi = Math.max(a, b);
        return lo + (state % (hi - lo + 1));
    }

    PKM.Sanctuary.preview = function(discId, seed) {
        const disc = PKM.Sanctuary.disc(discId);
        const pool = (disc && disc.pool) || [];
        const total = pool.reduce((sum, e) => sum + weightOf(e), 0);
        if (total <= 0) return null;

        let state = step(PKM.Sanctuary.hash(discId + "|" + (seed === null || seed === undefined ? "" : seed)));
        const entry = pickEntry(pool, state % total);
        if (!entry) return null;
        state = step(state);
        return { species: entry.species, level: levelFrom(entry, state) };
    };

    //=========================================================================
    // Santuário: disco -> monstro
    //=========================================================================
    PKM.Sanctuary.generate = function(discId, seed) {
        const label = PKM.Sanctuary.discName(discId);
        if (!PKM.Sanctuary.disc(discId)) {
            return { ok: false, pokemon: null, message: "O Santuário não reconhece este disco." };
        }
        if (!$gameParty.pkmHasItem(discId)) {
            return { ok: false, pokemon: null, message: "Você não tem nenhum " + label + "." };
        }
        const roll = PKM.Sanctuary.preview(discId, seed);
        const species = roll && PKM.Core.speciesByInternal(roll.species);
        if (!species) {
            return { ok: false, pokemon: null, message: label + " está arranhado demais para ser lido." };
        }

        $gameParty.pkmLoseItem(discId, 1);
        const pokemon = new Game_Pokemon(species.id, roll.level);
        const destination = $gameParty.pkmAdd(pokemon);
        if (typeof $gameSystem !== "undefined" && $gameSystem && $gameSystem.pkmSetCaught) {
            $gameSystem.pkmSetCaught(species.id);
        }
        const sent = destination === "storage" ? " Foi enviado para o PC." : "";
        return {
            ok: true,
            pokemon: pokemon,
            message: label + " girou e " + pokemon.name + " (Nv." + pokemon.level + ") nasceu no Santuário!" + sent
        };
    };

    //=========================================================================
    // Treino de fazenda (EVs permanentes)
    //=========================================================================
    function evsOf(pokemon) {
        if (!pokemon._evs) pokemon._evs = {};
        for (const key of STAT_KEYS) {
            if (typeof pokemon._evs[key] !== "number") pokemon._evs[key] = 0;
        }
        return pokemon._evs;
    }

    PKM.Sanctuary.evOf = function(pokemon, statKey) {
        return pokemon ? evsOf(pokemon)[statKey] || 0 : 0;
    };
    PKM.Sanctuary.evTotal = function(pokemon) {
        if (!pokemon) return 0;
        const evs = evsOf(pokemon);
        return STAT_KEYS.reduce((sum, key) => sum + evs[key], 0);
    };

    PKM.Sanctuary.train = function(pokemon, statKey, amount) {
        if (!pokemon || !STAT_KEYS.includes(statKey)) {
            return { ok: false, gained: 0, message: "Não dá para treinar isso." };
        }
        const evs = evsOf(pokemon);
        const wanted = Math.max(1, Math.floor(Number(amount) || DEFAULT_TRAIN_GAIN));
        const room = Math.min(EV_MAX_PER_STAT - evs[statKey], EV_MAX_TOTAL - PKM.Sanctuary.evTotal(pokemon));
        const gained = Math.min(wanted, room);
        if (gained <= 0) {
            return { ok: false, gained: 0, message: pokemon.name + " não rende mais nesse treino." };
        }
        evs[statKey] += gained;
        return {
            ok: true,
            gained: gained,
            message: pokemon.name + " treinou " + STAT_LABELS[statKey] + " (+" + gained + ")."
        };
    };

    PKM.Sanctuary.EV_MAX_PER_STAT = EV_MAX_PER_STAT;
    PKM.Sanctuary.EV_MAX_TOTAL = EV_MAX_TOTAL;

    //=========================================================================
    // Comandos de plugin
    //=========================================================================
    function announce(text) {
        if (typeof $gameMessage !== "undefined" && $gameMessage && $gameMessage.add) $gameMessage.add(text);
    }

    PluginManager.registerCommand(PLUGIN_NAME, "giveDisc", args => {
        $gameParty.pkmGainItem(args.disc, Number(args.qty) || 1);
    });

    PluginManager.registerCommand(PLUGIN_NAME, "generate", args => {
        const result = PKM.Sanctuary.generate(args.disc, args.seed);
        announce(result.message);
        const switchId = Number(args.resultSwitch) || 0;
        if (switchId > 0 && typeof $gameSwitches !== "undefined" && $gameSwitches) {
            $gameSwitches.setValue(switchId, result.ok);
        }
    });

    PluginManager.registerCommand(PLUGIN_NAME, "train", args => {
        const pokemon = $gameParty.pkmParty()[Number(args.index) || 0];
        const result = PKM.Sanctuary.train(pokemon, args.stat, Number(args.amount) || DEFAULT_TRAIN_GAIN);
        announce(result.message);
    });
})();
