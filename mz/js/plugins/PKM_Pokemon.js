//=============================================================================
// PKM_Pokemon.js  — Fase 1
//=============================================================================
/*:
 * @target MZ
 * @plugindesc [PKM v0.2] Modelo do Pokémon individual (Game_Pokemon): natureza,
 * IVs/EVs, stats calculados, golpes, gênero, HP/status. Base de party e batalha.
 * @author Pokémon Dimensions (port MZ)
 * @base PKM_Core
 * @orderAfter PKM_Core
 *
 * @help PKM_Pokemon.js
 *
 * Define a classe global Game_Pokemon — uma instância real de Pokémon (não a
 * espécie). É serializável no save do MZ (JsonEx reconstrói pela classe global).
 *
 *   const p = new Game_Pokemon("PIKACHU", 5);   // por internalName ou nº
 *   p.name; p.level; p.hp; p.maxHp; p.stat("atk"); p.types(); p.moves;
 *
 * Fórmulas: stats e natureza no padrão Gen 3+.
 */

(() => {
    "use strict";

    // 25 naturezas: up/down sobre atk/def/spe/spa/spd (null = neutra)
    const NATURES = [
        ["Hardy"], ["Lonely","atk","def"], ["Brave","atk","spe"], ["Adamant","atk","spa"], ["Naughty","atk","spd"],
        ["Bold","def","atk"], ["Docile"], ["Relaxed","def","spe"], ["Impish","def","spa"], ["Lax","def","spd"],
        ["Timid","spe","atk"], ["Hasty","spe","def"], ["Serious"], ["Jolly","spe","spa"], ["Naive","spe","spd"],
        ["Modest","spa","atk"], ["Mild","spa","def"], ["Quiet","spa","spe"], ["Bashful"], ["Rash","spa","spd"],
        ["Calm","spd","atk"], ["Gentle","spd","def"], ["Sassy","spd","spe"], ["Careful","spd","spa"], ["Quirky"]
    ].map(n => ({ name: n[0], up: n[1] || null, down: n[2] || null }));

    const GENDER_FEMALE_RATIO = {
        AlwaysMale: 0, FemaleOneEighth: 0.125, Female25Percent: 0.25,
        Female50Percent: 0.5, Female75Percent: 0.75, FemaleSevenEighths: 0.875,
        AlwaysFemale: 1, Genderless: null
    };

    const STAT_KEYS = ["hp", "atk", "def", "spe", "spa", "spd"];
    const randInt = (max) => Math.floor(Math.random() * max); // 0..max-1

    //=========================================================================
    // Game_Pokemon
    //=========================================================================
    window.Game_Pokemon = function() { this.initialize(...arguments); };

    Game_Pokemon.prototype.initialize = function(species, level) {
        const sp = this._resolveSpecies(species);
        this._speciesId = sp ? sp.id : 1;
        this._level = (level || 5).clamp(1, 100);
        this._nature = randInt(NATURES.length);
        this._gender = this._rollGender(sp);
        this._shiny = randInt(4096) === 0;
        this._ability = sp && sp.abilities && sp.abilities.length
            ? sp.abilities[randInt(sp.abilities.length)] : null;
        this._ivs = {}; this._evs = {};
        for (const k of STAT_KEYS) { this._ivs[k] = randInt(32); this._evs[k] = 0; }
        this._moves = this._defaultMoves(sp);
        this._status = null;           // "PSN","BRN","PAR","SLP","FRZ" (Fase 5b)
        this._exp = this.expForLevel(this._level);
        this._hp = this.maxHp;
        this._nickname = null;
        this._caughtBall = "POKEBALL";
    };

    Game_Pokemon.prototype._resolveSpecies = function(species) {
        if (typeof species === "number") return PKM.Core.species(species);
        if (typeof species === "string") {
            const up = species.toUpperCase();
            const list = $dataPokemon || [];
            for (let i = 1; i < list.length; i++) {
                if (list[i] && list[i].internalName === up) return list[i];
            }
        }
        return PKM.Core.species(1);
    };

    Game_Pokemon.prototype._rollGender = function(sp) {
        const ratio = sp ? GENDER_FEMALE_RATIO[sp.genderRate] : 0.5;
        if (ratio === null || ratio === undefined) return "N"; // sem gênero
        return Math.random() < ratio ? "F" : "M";
    };

    // últimos até 4 golpes aprendidos por nível no nível atual
    Game_Pokemon.prototype._defaultMoves = function(sp) {
        const learn = (sp && sp.levelMoves) || [];
        const known = [];
        for (const lm of learn) {
            if (lm.level <= this._level && !known.includes(lm.move)) known.push(lm.move);
        }
        return known.slice(-4).map(mid => this._makeMove(mid));
    };

    Game_Pokemon.prototype._makeMove = function(internalName) {
        const md = $dataMoves && $dataMoves[internalName];
        const pp = md ? md.pp : 5;
        return { id: internalName, pp: pp, ppMax: pp };
    };

    //--- acesso à espécie ----------------------------------------------------
    Game_Pokemon.prototype.species = function() { return PKM.Core.species(this._speciesId); };
    Object.defineProperty(Game_Pokemon.prototype, "name", {
        get() { return this._nickname || (this.species() ? this.species().name : "?"); },
        configurable: true
    });
    Object.defineProperty(Game_Pokemon.prototype, "speciesName", {
        get() { return this.species() ? this.species().name : "?"; }, configurable: true
    });
    Object.defineProperty(Game_Pokemon.prototype, "level", { get() { return this._level; }, configurable: true });
    Object.defineProperty(Game_Pokemon.prototype, "gender", { get() { return this._gender; }, configurable: true });
    Object.defineProperty(Game_Pokemon.prototype, "shiny", { get() { return this._shiny; }, configurable: true });
    Object.defineProperty(Game_Pokemon.prototype, "moves", { get() { return this._moves; }, configurable: true });
    Object.defineProperty(Game_Pokemon.prototype, "status", {
        get() { return this._status; }, set(v) { this._status = v; }, configurable: true
    });
    Object.defineProperty(Game_Pokemon.prototype, "speciesId", { get() { return this._speciesId; }, configurable: true });
    Object.defineProperty(Game_Pokemon.prototype, "dexNumber", { get() { return this._speciesId; }, configurable: true });

    Game_Pokemon.prototype.types = function() {
        const sp = this.species();
        const t = [sp.type1];
        if (sp.type2 && sp.type2 !== sp.type1) t.push(sp.type2);
        return t;
    };
    Game_Pokemon.prototype.natureData = function() { return NATURES[this._nature]; };

    //--- stats ---------------------------------------------------------------
    Game_Pokemon.prototype.baseStat = function(key) {
        const sp = this.species();
        return (sp && sp.stats && sp.stats[key]) || 1;
    };
    Game_Pokemon.prototype.stat = function(key) {
        const base = this.baseStat(key), iv = this._ivs[key] || 0, ev = this._evs[key] || 0;
        const lv = this._level;
        if (key === "hp") {
            return Math.floor((2 * base + iv + Math.floor(ev / 4)) * lv / 100) + lv + 10;
        }
        const flat = Math.floor((2 * base + iv + Math.floor(ev / 4)) * lv / 100) + 5;
        const nat = this.natureData();
        let mod = 1.0;
        if (nat.up === key) mod = 1.1;
        else if (nat.down === key) mod = 0.9;
        return Math.floor(flat * mod);
    };
    Object.defineProperty(Game_Pokemon.prototype, "maxHp", { get() { return this.stat("hp"); }, configurable: true });
    Object.defineProperty(Game_Pokemon.prototype, "atk", { get() { return this.stat("atk"); }, configurable: true });
    Object.defineProperty(Game_Pokemon.prototype, "def", { get() { return this.stat("def"); }, configurable: true });
    Object.defineProperty(Game_Pokemon.prototype, "spe", { get() { return this.stat("spe"); }, configurable: true });
    Object.defineProperty(Game_Pokemon.prototype, "spa", { get() { return this.stat("spa"); }, configurable: true });
    Object.defineProperty(Game_Pokemon.prototype, "spd", { get() { return this.stat("spd"); }, configurable: true });

    Object.defineProperty(Game_Pokemon.prototype, "hp", {
        get() { return this._hp; },
        set(v) { this._hp = v.clamp(0, this.maxHp); }, configurable: true
    });
    Game_Pokemon.prototype.isFainted = function() { return this._hp <= 0; };
    Game_Pokemon.prototype.hpRate = function() { return this.maxHp > 0 ? this._hp / this.maxHp : 0; };
    Game_Pokemon.prototype.takeDamage = function(dmg) {
        this._hp = (this._hp - Math.max(0, Math.floor(dmg))).clamp(0, this.maxHp);
        return this._hp;
    };
    Game_Pokemon.prototype.healFully = function() {
        this._hp = this.maxHp; this._status = null;
        for (const m of this._moves) m.pp = m.ppMax;
    };

    //--- experiência (curvas de crescimento) ---------------------------------
    Game_Pokemon.prototype.growthRate = function() {
        const sp = this.species();
        return (sp && sp.growthRate) || "Medium";
    };
    Game_Pokemon.prototype.expForLevel = function(n) {
        if (n <= 1) return 0;
        switch (this.growthRate()) {
            case "Fast":        return Math.floor(4 * n ** 3 / 5);
            case "Slow":        return Math.floor(5 * n ** 3 / 4);
            case "Parabolic":   // Medium Slow
                return Math.floor(1.2 * n ** 3 - 15 * n ** 2 + 100 * n - 140);
            case "Erratic":     return erraticExp(n);
            case "Fluctuating": return fluctuatingExp(n);
            default:            return n ** 3; // Medium
        }
    };

    function erraticExp(n) {
        if (n <= 50) return Math.floor(n ** 3 * (100 - n) / 50);
        if (n <= 68) return Math.floor(n ** 3 * (150 - n) / 100);
        if (n <= 98) return Math.floor(n ** 3 * Math.floor((1911 - 10 * n) / 3) / 500);
        return Math.floor(n ** 3 * (160 - n) / 100);
    }
    function fluctuatingExp(n) {
        if (n <= 15) return Math.floor(n ** 3 * (Math.floor((n + 1) / 3) + 24) / 50);
        if (n <= 36) return Math.floor(n ** 3 * (n + 14) / 50);
        return Math.floor(n ** 3 * (Math.floor(n / 2) + 32) / 50);
    }

    //--- conveniências -------------------------------------------------------
    Game_Pokemon.prototype.genderSymbol = function() {
        return this._gender === "M" ? "♂" : this._gender === "F" ? "♀" : "";
    };
    Game_Pokemon.prototype.frontImageName = function() {
        return String(this._speciesId).padStart(3, "0");
    };

    // expõe utilidades p/ outros plugins
    PKM.Pokemon = { STAT_KEYS, NATURES };
    PKM.Core.newWild = function(species, level) { return new Game_Pokemon(species, level); };
})();
