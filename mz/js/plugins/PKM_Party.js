//=============================================================================
// PKM_Party.js  — Fase 2
//=============================================================================
/*:
 * @target MZ
 * @plugindesc [PKM v0.2] Party de até 6 Pokémon + telas de equipe e resumo.
 * @author Pokémon Dimensions (port MZ)
 * @base PKM_Core
 * @base PKM_Pokemon
 * @orderAfter PKM_Pokemon
 *
 * @help PKM_Party.js
 *
 * Estende $gameParty com a equipe Pokémon (salva no save):
 *   $gameParty.pkmParty()        -> array de Game_Pokemon (até 6)
 *   $gameParty.pkmAdd(pkm)       -> adiciona (vai p/ "PC" se cheio); retorna destino
 *   $gameParty.pkmFirstAble()    -> primeiro Pokémon não desmaiado
 *   $gameParty.pkmHealAll()      -> cura tudo (Centro Pokémon)
 *
 * @command give
 * @text Dar Pokémon
 * @desc Cria um Pokémon e adiciona à equipe (ou ao PC se cheia).
 * @arg species
 * @type string
 * @text Espécie
 * @desc internalName (ex.: PIKACHU) ou número da Pokédex.
 * @arg level
 * @type number @min 1 @max 100 @default 5
 * @text Nível
 *
 * @command openParty
 * @text Abrir Equipe
 * @desc Abre a tela da equipe Pokémon.
 *
 * @command heal
 * @text Curar Equipe
 * @desc Restaura HP/PP/status de toda a equipe.
 */

var PKM = PKM || {};

(() => {
    "use strict";
    const MAX_PARTY = 6;

    //=========================================================================
    // Game_Party — equipe + PC simples (placeholder até a Fase 8)
    //=========================================================================
    const _GP_init = Game_Party.prototype.initialize;
    Game_Party.prototype.initialize = function() {
        _GP_init.call(this);
        this._pkmParty = [];
        this._pkmStorage = [];
    };
    Game_Party.prototype.pkmEnsure = function() {
        if (!this._pkmParty) this._pkmParty = [];
        if (!this._pkmStorage) this._pkmStorage = [];
    };
    Game_Party.prototype.pkmParty = function() { this.pkmEnsure(); return this._pkmParty; };
    Game_Party.prototype.pkmCount = function() { this.pkmEnsure(); return this._pkmParty.length; };
    Game_Party.prototype.pkmStorage = function() { this.pkmEnsure(); return this._pkmStorage; };

    Game_Party.prototype.pkmAdd = function(pkm) {
        this.pkmEnsure();
        if (this._pkmParty.length < MAX_PARTY) {
            this._pkmParty.push(pkm);
            return "party";
        }
        this._pkmStorage.push(pkm);
        return "storage";
    };
    Game_Party.prototype.pkmCreate = function(species, level) {
        return this.pkmAdd(new Game_Pokemon(species, level));
    };
    Game_Party.prototype.pkmFirstAble = function() {
        this.pkmEnsure();
        return this._pkmParty.find(p => !p.isFainted()) || null;
    };
    Game_Party.prototype.pkmAllFainted = function() {
        this.pkmEnsure();
        return this._pkmParty.length > 0 && this._pkmParty.every(p => p.isFainted());
    };
    Game_Party.prototype.pkmHealAll = function() {
        this.pkmEnsure();
        this._pkmParty.forEach(p => p.healFully());
    };

    PluginManager.registerCommand("PKM_Party", "give", args => {
        const lvl = Number(args.level) || 5;
        const sp = /^\d+$/.test(args.species) ? Number(args.species) : args.species;
        $gameParty.pkmCreate(sp, lvl);
    });
    PluginManager.registerCommand("PKM_Party", "openParty", () => SceneManager.push(Scene_PkmParty));
    PluginManager.registerCommand("PKM_Party", "heal", () => $gameParty.pkmHealAll());

    // headless (testes): só a lógica de party acima
    if (typeof Scene_MenuBase === "undefined" || !Scene_MenuBase.prototype.create) return;

    //=========================================================================
    // Window_PkmPartyList
    //=========================================================================
    function Window_PkmPartyList() { this.initialize(...arguments); }
    Window_PkmPartyList.prototype = Object.create(Window_Selectable.prototype);
    Window_PkmPartyList.prototype.constructor = Window_PkmPartyList;

    Window_PkmPartyList.prototype.initialize = function(rect) {
        Window_Selectable.prototype.initialize.call(this, rect);
        this.refresh();
        this.select(0);
        this.activate();
    };
    Window_PkmPartyList.prototype.maxItems = function() { return $gameParty.pkmCount(); };
    Window_PkmPartyList.prototype.itemHeight = function() { return Math.floor(this.innerHeight / 6); };
    Window_PkmPartyList.prototype.pokemon = function(i) { return $gameParty.pkmParty()[i]; };
    Window_PkmPartyList.prototype.currentPokemon = function() { return this.pokemon(this.index()); };

    Window_PkmPartyList.prototype.drawItem = function(index) {
        const p = this.pokemon(index);
        if (!p) return;
        const r = this.itemRect(index);
        const pad = 8;
        this.changePaintOpacity(!p.isFainted());
        // nome + gênero + nível
        this.resetTextColor();
        this.drawText(p.name + " " + p.genderSymbol(), r.x + pad, r.y + 4, 220, "left");
        this.drawText("Nv." + p.level, r.x + r.width - 90, r.y + 4, 80, "right");
        // barra de HP
        const bx = r.x + pad, by = r.y + r.height - 22, bw = 220, bh = 10;
        this.drawHpBar(p, bx, by, bw, bh);
        this.drawText(p.hp + "/" + p.maxHp, bx + bw + 10, by - 12, 110, "left");
        this.changePaintOpacity(true);
    };
    Window_PkmPartyList.prototype.drawHpBar = function(p, x, y, w, h) {
        const rate = p.hpRate();
        const color = rate > 0.5 ? "#78c850" : rate > 0.2 ? "#f8d030" : "#f85038";
        this.contents.fillRect(x, y, w, h, "#202020");
        this.contents.fillRect(x + 1, y + 1, Math.floor((w - 2) * rate), h - 2, color);
    };

    //=========================================================================
    // Scene_PkmParty
    //=========================================================================
    window.Scene_PkmParty = function() { this.initialize(...arguments); };
    Scene_PkmParty.prototype = Object.create(Scene_MenuBase.prototype);
    Scene_PkmParty.prototype.constructor = Scene_PkmParty;

    Scene_PkmParty.prototype.create = function() {
        Scene_MenuBase.prototype.create.call(this);
        const rect = new Rectangle(0, this.mainAreaTop(), Graphics.boxWidth, this.mainAreaHeight());
        this._listWindow = new Window_PkmPartyList(rect);
        this._listWindow.setHandler("ok", this.onOk.bind(this));
        this._listWindow.setHandler("cancel", this.popScene.bind(this));
        this.addWindow(this._listWindow);
    };
    Scene_PkmParty.prototype.onOk = function() {
        const p = this._listWindow.currentPokemon();
        if (p) {
            PKM._summaryTarget = p;
            SceneManager.push(Scene_PkmSummary);
        } else {
            this._listWindow.activate();
        }
    };

    //=========================================================================
    // Scene_PkmSummary — ficha de um Pokémon da equipe
    //=========================================================================
    function Window_PkmSummary() { this.initialize(...arguments); }
    Window_PkmSummary.prototype = Object.create(Window_Base.prototype);
    Window_PkmSummary.prototype.constructor = Window_PkmSummary;

    Window_PkmSummary.prototype.initialize = function(rect) {
        Window_Base.prototype.initialize.call(this, rect);
        this._pkm = null;
    };
    Window_PkmSummary.prototype.setPokemon = function(p) { this._pkm = p; this.refresh(); };
    Window_PkmSummary.prototype.refresh = function() {
        this.contents.clear();
        const p = this._pkm;
        if (!p) return;
        const lh = this.lineHeight();
        let y = 0;
        this.changeTextColor(ColorManager.systemColor());
        this.contents.fontSize = 26;
        this.drawText(p.name + " " + p.genderSymbol(), 0, y, 360, "left");
        this.resetFontSettings();
        this.drawText("Nv." + p.level, 360, y, 120, "right");
        y += lh + 4;

        this.resetTextColor();
        this.drawText("Nº" + String(p.dexNumber).padStart(3, "0") +
            "  " + p.types().join(" / "), 0, y, 480, "left"); y += lh;
        this.drawText("Natureza: " + p.natureData().name +
            (p._ability ? "   Hab.: " + p._ability : ""), 0, y, 600, "left"); y += lh;
        if (p.expToNext) {
            this.drawText("EXP: " + p.exp + "   Próx. nível: " + p.expToNext(), 0, y, 600, "left");
        }
        y += lh + 6;

        // stats
        const labels = { hp: "HP", atk: "Ataque", def: "Defesa", spa: "Sp.Atk", spd: "Sp.Def", spe: "Velocidade" };
        for (const k of ["hp", "atk", "def", "spa", "spd", "spe"]) {
            this.changeTextColor(ColorManager.systemColor());
            this.drawText(labels[k], 0, y, 140, "left");
            this.resetTextColor();
            const val = k === "hp" ? (p.hp + "/" + p.maxHp) : p.stat(k);
            this.drawText(String(val), 150, y, 120, "left");
            y += lh;
        }
        y += 6;

        // golpes
        this.changeTextColor(ColorManager.systemColor());
        this.drawText("Golpes", 0, y, 200, "left"); y += lh;
        this.resetTextColor();
        for (const mv of p.moves) {
            const md = PKM.Core.move(mv.id);
            const nm = md ? md.name : mv.id;
            this.drawText("• " + nm, 16, y, 300, "left");
            this.drawText("PP " + mv.pp + "/" + mv.ppMax, 320, y, 120, "left");
            y += lh;
        }
    };

    window.Scene_PkmSummary = function() { this.initialize(...arguments); };
    Scene_PkmSummary.prototype = Object.create(Scene_MenuBase.prototype);
    Scene_PkmSummary.prototype.constructor = Scene_PkmSummary;
    Scene_PkmSummary.prototype.create = function() {
        Scene_MenuBase.prototype.create.call(this);
        const rect = new Rectangle(0, this.mainAreaTop(), Graphics.boxWidth, this.mainAreaHeight());
        this._win = new Window_PkmSummary(rect);
        this._win.setPokemon(PKM._summaryTarget);
        this.addWindow(this._win);
    };
    Scene_PkmSummary.prototype.update = function() {
        Scene_MenuBase.prototype.update.call(this);
        if (Input.isTriggered("cancel") || Input.isTriggered("ok") || TouchInput.isCancelled()) {
            this.popScene();
        }
    };

})();
