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
 * Monstros nascem de discos levados ao Santuário: a seed tempera o sorteio INTEIRO
 * — espécie, nível, natureza, gênero, shiny, habilidade e os 6 IVs. O mesmo par
 * (disco, seed) devolve exatamente o mesmo monstro, hoje e depois de recarregar.
 *
 * API:
 *   PKM.Sanctuary.hash(seed)                -> inteiro 32 bits determinístico
 *   PKM.Sanctuary.disc(discId)              -> entrada de data/Discs.json
 *   PKM.Sanctuary.preview(discId, seed)     -> {species, level} | null
 *   PKM.Sanctuary.traits(discId, seed)      -> {nature, gender, shiny, ability, ivs} | null
 *   PKM.Sanctuary.traitsFor(species, seed)  -> idem, para uma espécie qualquer
 *   PKM.Sanctuary.generate(discId, seed)    -> {ok, pokemon, seed, message}
 *   PKM.Sanctuary.expandSeed(text)          -> texto com \V[n] e \N[n] resolvidos
 *   PKM.Sanctuary.resolveSeed(discId, opts) -> seed final (opts: mode/text/variableId/actorId)
 *   PKM.Sanctuary.autoSeed(discId) / useCount(discId) / totalUses()
 *   PKM.Sanctuary.train(pokemon, statKey, amount) -> {ok, gained, message}
 *   PKM.Sanctuary.evTotal(pokemon) / evOf(pokemon, statKey)
 *
 * COMO O EVENTO DEVE CHAMAR
 * Argumento de comando no MZ é texto estático (não expande \V[n] sozinho): uma seed
 * escrita direto no comando geraria o MESMO monstro para todo jogador e derrubaria o
 * pool do disco para uma espécie só. Escolha a origem no argumento "Origem da Seed":
 *
 *   text      : usa o campo "Seed (texto)", já com \V[n] e \N[n] expandidos.
 *               Ex.: Entrada de Nome/Número numa variável e escreva \V[21] no campo.
 *   variable  : usa o conteúdo da variável escolhida (o jogador digitou o número).
 *   actorName : usa o nome que o jogador digitou no ator escolhido
 *               (Comandos de Evento > Cenário > Entrada de Nome).
 *   auto      : deriva a seed do save (id do disco + quantos discos já foram usados),
 *               para o evento que não pede texto nenhum.
 *
 * Seed vazia cai sozinha no modo auto. O modo auto continua imune a save-scumming:
 * recarregar o save e girar de novo devolve o mesmo monstro, porque a seed sai só do
 * estado salvo. Para variedade entre jogadores, prefira text/variable/actorName.
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
 * @arg seedMode
 * @type select
 * @option Texto do comando (aceita \V[n])
 * @value text
 * @option Conteúdo de uma variável
 * @value variable
 * @option Nome digitado num ator
 * @value actorName
 * @option Automática (estado do save)
 * @value auto
 * @default text
 * @text Origem da Seed
 * @desc De onde sai a seed do sorteio. Seed vazia cai na automática.
 * @arg seed
 * @type string
 * @default
 * @text Seed (texto)
 * @desc Modo "text": texto que tempera o sorteio. \V[n] e \N[n] são expandidos.
 * @arg seedVariable
 * @type variable
 * @default 0
 * @text Seed (variável)
 * @desc Modo "variable": variável com o número/texto digitado pelo jogador.
 * @arg seedActor
 * @type actor
 * @default 0
 * @text Seed (ator)
 * @desc Modo "actorName": ator cujo nome o jogador digitou.
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
    const IV_RANGE = 32;
    const SHINY_ODDS = 4096;
    const GENDER_RESOLUTION = 1000;
    const SEED_MODES = ["text", "variable", "actorName", "auto"];

    // PKM_Pokemon não exporta a tabela de gênero: cópia local para derivar da seed
    const GENDER_FEMALE_RATIO = {
        AlwaysMale: 0, FemaleOneEighth: 0.125, Female25Percent: 0.25,
        Female50Percent: 0.5, Female75Percent: 0.75, FemaleSevenEighths: 0.875,
        AlwaysFemale: 1, Genderless: null
    };

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

    function seedText(seed) {
        return seed === null || seed === undefined ? "" : String(seed);
    }

    // FNV-1a 32 bits: a mesma seed tem de gerar sempre o mesmo monstro
    PKM.Sanctuary.hash = function(seed) {
        const text = seedText(seed);
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

    // fluxo determinístico: cada chamada avança o xorshift e devolve 0..max-1
    function stream(state) {
        let x = state >>> 0;
        return function(max) {
            x = step(x);
            return max > 0 ? Math.floor((x / 0x100000000) * max) : 0;
        };
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

    function rollDisc(discId, seed) {
        const disc = PKM.Sanctuary.disc(discId);
        const pool = (disc && disc.pool) || [];
        const total = pool.reduce((sum, e) => sum + weightOf(e), 0);
        if (total <= 0) return null;

        let state = step(PKM.Sanctuary.hash(discId + "|" + seedText(seed)));
        const entry = pickEntry(pool, state % total);
        if (!entry) return null;
        state = step(state);
        return { entry: entry, level: levelFrom(entry, state), state: state };
    }

    PKM.Sanctuary.preview = function(discId, seed) {
        const roll = rollDisc(discId, seed);
        return roll ? { species: roll.entry.species, level: roll.level } : null;
    };

    function natureCount() {
        const natures = PKM.Pokemon && PKM.Pokemon.NATURES;
        return (natures && natures.length) || 1;
    }

    function deriveTraits(species, state) {
        const next = stream(state);
        const nature = next(natureCount());
        const ratio = species ? GENDER_FEMALE_RATIO[species.genderRate] : 0.5;
        const female = next(GENDER_RESOLUTION) < Math.round((ratio || 0) * GENDER_RESOLUTION);
        const shiny = next(SHINY_ODDS) === 0;
        const abilities = (species && species.abilities) || [];
        const ability = abilities.length ? abilities[next(abilities.length)] : null;
        const ivs = {};
        for (const key of STAT_KEYS) ivs[key] = next(IV_RANGE);
        return {
            nature: nature,
            gender: ratio === null || ratio === undefined ? "N" : (female ? "F" : "M"),
            shiny: shiny,
            ability: ability,
            ivs: ivs
        };
    }

    PKM.Sanctuary.traits = function(discId, seed) {
        const roll = rollDisc(discId, seed);
        if (!roll) return null;
        return deriveTraits(PKM.Core.speciesByInternal(roll.entry.species), roll.state);
    };

    PKM.Sanctuary.traitsFor = function(species, seed) {
        return species ? deriveTraits(species, step(PKM.Sanctuary.hash(seedText(seed)))) : null;
    };

    // Game_Pokemon sorteia natureza/gênero/shiny/habilidade/IVs com Math.random no
    // construtor; como aqui é o disco que define o monstro (e não save-scumming),
    // o Santuário reescreve esses campos com os valores tirados da própria seed.
    function applyTraits(pokemon, traits) {
        pokemon._nature = traits.nature;
        pokemon._gender = traits.gender;
        pokemon._shiny = traits.shiny;
        pokemon._ability = traits.ability;
        for (const key of STAT_KEYS) pokemon._ivs[key] = traits.ivs[key];
        pokemon._hp = pokemon.maxHp;
    }

    //=========================================================================
    // Origem da seed (comando de plugin não expande \V[n] sozinho)
    //=========================================================================
    function variableValue(id) {
        if (!(id > 0) || typeof $gameVariables === "undefined" || !$gameVariables) return "";
        return seedText($gameVariables.value(id));
    }

    function actorName(id) {
        if (!(id > 0) || typeof $gameActors === "undefined" || !$gameActors) return "";
        const actor = $gameActors.actor(id);
        return actor ? seedText(actor.name()) : "";
    }

    function system() {
        return typeof $gameSystem !== "undefined" ? $gameSystem : null;
    }

    function useCounts() {
        const sys = system();
        if (!sys) return null;
        if (!sys.pkmDiscUses) sys.pkmDiscUses = {};
        return sys.pkmDiscUses;
    }

    PKM.Sanctuary.useCount = function(discId) {
        const counts = useCounts();
        return (counts && counts[discId]) || 0;
    };
    PKM.Sanctuary.totalUses = function() {
        const counts = useCounts();
        return counts ? Object.keys(counts).reduce((sum, key) => sum + counts[key], 0) : 0;
    };

    function countUse(discId) {
        const counts = useCounts();
        if (counts) counts[discId] = (counts[discId] || 0) + 1;
    }

    // seed sem texto sai só do estado salvo: varia a cada disco usado, mas
    // recarregar o save e girar de novo devolve o mesmo monstro
    PKM.Sanctuary.autoSeed = function(discId) {
        return String(discId) + "#" + PKM.Sanctuary.useCount(discId) + "@" + PKM.Sanctuary.totalUses();
    };

    PKM.Sanctuary.expandSeed = function(text) {
        return seedText(text)
            .replace(/\\V\[(\d+)\]/gi, (match, id) => variableValue(Number(id)))
            .replace(/\\N\[(\d+)\]/gi, (match, id) => actorName(Number(id)));
    };

    PKM.Sanctuary.resolveSeed = function(discId, options) {
        const opt = options || {};
        const mode = SEED_MODES.includes(opt.mode) ? opt.mode : "text";
        let seed = "";
        if (mode === "text") seed = PKM.Sanctuary.expandSeed(opt.text);
        else if (mode === "variable") seed = variableValue(Number(opt.variableId) || 0);
        else if (mode === "actorName") seed = actorName(Number(opt.actorId) || 0);
        return seed.trim() || PKM.Sanctuary.autoSeed(discId);
    };

    //=========================================================================
    // Santuário: disco -> monstro
    //=========================================================================
    PKM.Sanctuary.generate = function(discId, seed) {
        const label = PKM.Sanctuary.discName(discId);
        const used = seedText(seed);
        if (!PKM.Sanctuary.disc(discId)) {
            return { ok: false, pokemon: null, seed: used, message: "O Santuário não reconhece este disco." };
        }
        if (!$gameParty.pkmHasItem(discId)) {
            return { ok: false, pokemon: null, seed: used, message: "Você não tem nenhum " + label + "." };
        }
        const roll = rollDisc(discId, seed);
        const species = roll && PKM.Core.speciesByInternal(roll.entry.species);
        if (!species) {
            return { ok: false, pokemon: null, seed: used, message: label + " está arranhado demais para ser lido." };
        }

        $gameParty.pkmLoseItem(discId, 1);
        const pokemon = new Game_Pokemon(species.id, roll.level);
        applyTraits(pokemon, deriveTraits(species, roll.state));
        countUse(discId);
        const destination = $gameParty.pkmAdd(pokemon);
        const sys = system();
        if (sys && sys.pkmSetCaught) sys.pkmSetCaught(species.id);
        const sent = destination === "storage" ? " Foi enviado para o PC." : "";
        return {
            ok: true,
            pokemon: pokemon,
            seed: used,
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
    PKM.Sanctuary.SEED_MODES = SEED_MODES;
    PKM.Sanctuary.SHINY_ODDS = SHINY_ODDS;

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
        const seed = PKM.Sanctuary.resolveSeed(args.disc, {
            mode: args.seedMode,
            text: args.seed,
            variableId: args.seedVariable,
            actorId: args.seedActor
        });
        const result = PKM.Sanctuary.generate(args.disc, seed);
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
