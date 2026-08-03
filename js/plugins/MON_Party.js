//=============================================================================
// MON_Party.js  — Fase 2
//=============================================================================
/*:
 * @target MZ
 * @plugindesc [MON v0.2] Party de até 6 Pokémon + telas de equipe e resumo.
 * @author Pokémon Dimensions (port MZ)
 * @base MON_Core
 * @base MON_Monster
 * @orderAfter MON_Monster
 *
 * @help MON_Party.js
 *
 * Estende $gameParty com a equipe Pokémon (salva no save):
 *   $gameParty.monParty()        -> array de Game_Monster (até 6)
 *   $gameParty.monAdd(pkm)       -> adiciona (vai p/ "PC" se cheio); retorna destino
 *   $gameParty.monFirstAble()    -> primeiro Pokémon não desmaiado
 *   $gameParty.monHealAll()      -> cura tudo (Centro Pokémon)
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

var MON = MON || {};

(() => {
    "use strict";
    const MAX_PARTY = 6;

    //=========================================================================
    // Game_Party — equipe + PC simples (placeholder até a Fase 8)
    //=========================================================================
    const _GP_init = Game_Party.prototype.initialize;
    Game_Party.prototype.initialize = function() {
        _GP_init.call(this);
        this._monParty = [];
        this._monStorage = [];
    };
    Game_Party.prototype.monEnsure = function() {
        if (!this._monParty) this._monParty = [];
        if (!this._monStorage) this._monStorage = [];
    };
    Game_Party.prototype.monParty = function() { this.monEnsure(); return this._monParty; };
    Game_Party.prototype.monCount = function() { this.monEnsure(); return this._monParty.length; };
    Game_Party.prototype.monStorage = function() { this.monEnsure(); return this._monStorage; };

    Game_Party.prototype.monAdd = function(pkm) {
        this.monEnsure();
        if (this._monParty.length < MAX_PARTY) {
            this._monParty.push(pkm);
            return "party";
        }
        this._monStorage.push(pkm);
        return "storage";
    };
    Game_Party.prototype.monCreate = function(species, level) {
        return this.monAdd(new Game_Monster(species, level));
    };
    Game_Party.prototype.monFirstAble = function() {
        this.monEnsure();
        return this._monParty.find(p => !p.isFainted()) || null;
    };
    Game_Party.prototype.monAllFainted = function() {
        this.monEnsure();
        return this._monParty.length > 0 && this._monParty.every(p => p.isFainted());
    };
    Game_Party.prototype.monHealAll = function() {
        this.monEnsure();
        this._monParty.forEach(p => p.healFully());
        // o avatar humano nao mora em _monParty: sem isto ele cai numa batalha
        // vencida e nao ha caminho no jogo para revive-lo
        const avatar = this.monAvatar ? this.monAvatar() : null;
        if (avatar && avatar.healFully) avatar.healFully();
    };

    PluginManager.registerCommand("MON_Party", "give", args => {
        const lvl = Number(args.level) || 5;
        const sp = /^\d+$/.test(args.species) ? Number(args.species) : args.species;
        $gameParty.monCreate(sp, lvl);
    });
    PluginManager.registerCommand("MON_Party", "openParty", () => SceneManager.push(Scene_MonParty));
    PluginManager.registerCommand("MON_Party", "heal", () => $gameParty.monHealAll());

    // headless (testes): só a lógica de party acima
    if (typeof Scene_MenuBase === "undefined" || !Scene_MenuBase.prototype.create) return;

    //=========================================================================
    // Window_MonPartyList
    //=========================================================================
    function Window_MonPartyList() { this.initialize(...arguments); }
    Window_MonPartyList.prototype = Object.create(Window_Selectable.prototype);
    Window_MonPartyList.prototype.constructor = Window_MonPartyList;

    Window_MonPartyList.prototype.initialize = function(rect) {
        Window_Selectable.prototype.initialize.call(this, rect);
        this.refresh();
        this.select(0);
        this.activate();
    };
    Window_MonPartyList.prototype.maxItems = function() { return $gameParty.monCount(); };
    Window_MonPartyList.prototype.itemHeight = function() { return Math.floor(this.innerHeight / 6); };
    Window_MonPartyList.prototype.monster = function(i) { return $gameParty.monParty()[i]; };
    Window_MonPartyList.prototype.currentMonster = function() { return this.monster(this.index()); };

    Window_MonPartyList.prototype.drawItem = function(index) {
        const p = this.monster(index);
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
    Window_MonPartyList.prototype.drawHpBar = function(p, x, y, w, h) {
        const rate = p.hpRate();
        const color = rate > 0.5 ? "#78c850" : rate > 0.2 ? "#f8d030" : "#f85038";
        this.contents.fillRect(x, y, w, h, "#202020");
        this.contents.fillRect(x + 1, y + 1, Math.floor((w - 2) * rate), h - 2, color);
    };

    //=========================================================================
    // Scene_MonParty
    //=========================================================================
    window.Scene_MonParty = function() { this.initialize(...arguments); };
    Scene_MonParty.prototype = Object.create(Scene_MenuBase.prototype);
    Scene_MonParty.prototype.constructor = Scene_MonParty;

    Scene_MonParty.prototype.create = function() {
        Scene_MenuBase.prototype.create.call(this);
        const rect = new Rectangle(0, this.mainAreaTop(), Graphics.boxWidth, this.mainAreaHeight());
        this._listWindow = new Window_MonPartyList(rect);
        this._listWindow.setHandler("ok", this.onOk.bind(this));
        this._listWindow.setHandler("cancel", this.popScene.bind(this));
        this.addWindow(this._listWindow);
    };
    Scene_MonParty.prototype.onOk = function() {
        const p = this._listWindow.currentMonster();
        if (p) {
            MON._summaryTarget = p;
            SceneManager.push(Scene_MonSummary);
        } else {
            this._listWindow.activate();
        }
    };

    //=========================================================================
    // Scene_MonSummary — ficha de um Pokémon da equipe
    //=========================================================================
    function Window_MonSummary() { this.initialize(...arguments); }
    Window_MonSummary.prototype = Object.create(Window_Base.prototype);
    Window_MonSummary.prototype.constructor = Window_MonSummary;

    Window_MonSummary.prototype.initialize = function(rect) {
        Window_Base.prototype.initialize.call(this, rect);
        this._pkm = null;
    };
    Window_MonSummary.prototype.setMonster = function(p) { this._pkm = p; this.refresh(); };
    Window_MonSummary.prototype.refresh = function() {
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
            const md = MON.Core.move(mv.id);
            const nm = md ? md.name : mv.id;
            this.drawText("• " + nm, 16, y, 300, "left");
            this.drawText("PP " + mv.pp + "/" + mv.ppMax, 320, y, 120, "left");
            y += lh;
        }
    };

    window.Scene_MonSummary = function() { this.initialize(...arguments); };
    Scene_MonSummary.prototype = Object.create(Scene_MenuBase.prototype);
    Scene_MonSummary.prototype.constructor = Scene_MonSummary;
    Scene_MonSummary.prototype.create = function() {
        Scene_MenuBase.prototype.create.call(this);
        const rect = new Rectangle(0, this.mainAreaTop(), Graphics.boxWidth, this.mainAreaHeight());
        this._win = new Window_MonSummary(rect);
        this._win.setMonster(MON._summaryTarget);
        this.addWindow(this._win);
    };
    Scene_MonSummary.prototype.update = function() {
        Scene_MenuBase.prototype.update.call(this);
        if (Input.isTriggered("cancel") || Input.isTriggered("ok") || TouchInput.isCancelled()) {
            this.popScene();
        }
    };

})();
