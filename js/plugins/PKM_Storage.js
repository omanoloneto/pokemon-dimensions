//=============================================================================
// PKM_Storage.js  — Fase 8
//=============================================================================
/*:
 * @target MZ
 * @plugindesc [PKM v0.4] Sistema de PC: 16 caixas × 30 espaços, com depositar,
 * retirar, mover/trocar e soltar Pokémon. Cena Scene_PkmStorage.
 * @author Pokémon Dimensions (port MZ)
 * @base PKM_Core
 * @base PKM_Pokemon
 * @base PKM_Party
 * @orderAfter PKM_Party
 *
 * @help PKM_Storage.js
 *
 * Estende $gameParty com o PC (caixas), salvo no save:
 *   $gameParty.pkmBox(i) / pkmBoxCount() / pkmStoreToBox(pkm)
 *   $gameParty.pkmDeposit(partyIndex) / pkmWithdraw(box, slot)
 *
 * Capturas com a equipe cheia passam a ir para a primeira caixa com espaço.
 * Abra o PC pelo comando de plugin "Abrir PC".
 *
 * @command openPC
 * @text Abrir PC
 * @desc Abre a cena do sistema de armazenamento (caixas).
 */

var PKM = PKM || {};

(() => {
    "use strict";
    const MAX_PARTY = 6;
    const BOXES = 16;
    const PER_BOX = 30;
    const COLS = 6;

    //=========================================================================
    // Game_Party — caixas do PC
    //=========================================================================
    Game_Party.prototype.pkmBoxesEnsure = function() {
        if (!this._pkmBoxes) {
            this._pkmBoxes = [];
            for (let i = 0; i < BOXES; i++) {
                this._pkmBoxes.push({ name: "Caixa " + (i + 1), slots: new Array(PER_BOX).fill(null) });
            }
            // migra capturas antigas (array plano de PKM_Party) para as caixas
            if (this._pkmStorage && this._pkmStorage.length) {
                for (const p of this._pkmStorage) this.pkmStoreToBox(p);
                this._pkmStorage = [];
            }
        }
    };
    Game_Party.prototype.pkmBoxCount = function() { this.pkmBoxesEnsure(); return this._pkmBoxes.length; };
    Game_Party.prototype.pkmBox = function(i) { this.pkmBoxesEnsure(); return this._pkmBoxes[i]; };
    Game_Party.prototype.pkmStoredCount = function() {
        this.pkmBoxesEnsure();
        return this._pkmBoxes.reduce((n, b) => n + b.slots.filter(Boolean).length, 0);
    };
    Game_Party.prototype.pkmStoreToBox = function(pkm) {
        this.pkmBoxesEnsure();
        for (let b = 0; b < this._pkmBoxes.length; b++) {
            const slots = this._pkmBoxes[b].slots;
            for (let s = 0; s < slots.length; s++) {
                if (!slots[s]) { slots[s] = pkm; return { box: b, slot: s }; }
            }
        }
        return null;   // PC cheio
    };

    // captura com equipe cheia agora vai para uma caixa
    Game_Party.prototype.pkmAdd = function(pkm) {
        this.pkmEnsure();
        if (this._pkmParty.length < MAX_PARTY) { this._pkmParty.push(pkm); return "party"; }
        return this.pkmStoreToBox(pkm) ? "storage" : "full";
    };

    // depositar: equipe -> caixa (mantém ao menos 1 na equipe)
    Game_Party.prototype.pkmDeposit = function(partyIndex) {
        this.pkmEnsure();
        if (this._pkmParty.length <= 1) return { ok: false, reason: "Não pode depositar o último Pokémon!" };
        const pkm = this._pkmParty[partyIndex];
        if (!pkm) return { ok: false, reason: "Nada para depositar." };
        const dest = this.pkmStoreToBox(pkm);
        if (!dest) return { ok: false, reason: "O PC está cheio!" };
        this._pkmParty.splice(partyIndex, 1);
        return { ok: true, dest };
    };
    // retirar: caixa -> equipe
    Game_Party.prototype.pkmWithdraw = function(boxIndex, slot) {
        this.pkmEnsure(); this.pkmBoxesEnsure();
        if (this._pkmParty.length >= MAX_PARTY) return { ok: false, reason: "A equipe está cheia!" };
        const pkm = this._pkmBoxes[boxIndex].slots[slot];
        if (!pkm) return { ok: false, reason: "Espaço vazio." };
        this._pkmBoxes[boxIndex].slots[slot] = null;
        this._pkmParty.push(pkm);
        return { ok: true };
    };
    Game_Party.prototype.pkmReleaseBox = function(boxIndex, slot) {
        this.pkmBoxesEnsure();
        const pkm = this._pkmBoxes[boxIndex].slots[slot];
        if (!pkm) return null;
        this._pkmBoxes[boxIndex].slots[slot] = null;
        return pkm;
    };
    Game_Party.prototype.pkmMoveBoxSlot = function(boxIndex, from, to) {
        this.pkmBoxesEnsure();
        const slots = this._pkmBoxes[boxIndex].slots;
        const tmp = slots[to]; slots[to] = slots[from]; slots[from] = tmp;   // troca/move
    };

    PluginManager.registerCommand("PKM_Storage", "openPC", () => SceneManager.push(Scene_PkmStorage));

    // headless (testes): só a lógica de caixas acima
    if (typeof Scene_MenuBase === "undefined" || !Scene_MenuBase.prototype.create) return;

    //=========================================================================
    // Janelas
    //=========================================================================
    function Window_PCBox() { this.initialize(...arguments); }
    Window_PCBox.prototype = Object.create(Window_Selectable.prototype);
    Window_PCBox.prototype.constructor = Window_PCBox;
    Window_PCBox.prototype.initialize = function(rect) {
        Window_Selectable.prototype.initialize.call(this, rect);
        this._boxIndex = 0; this._moveFrom = -1;
        this.refresh(); this.select(0);
    };
    Window_PCBox.prototype.setBox = function(i) { this._boxIndex = i; this.refresh(); };
    Window_PCBox.prototype.maxCols = function() { return COLS; };
    Window_PCBox.prototype.maxItems = function() { return PER_BOX; };
    Window_PCBox.prototype.slotPkm = function(i) { return $gameParty.pkmBox(this._boxIndex).slots[i]; };
    Window_PCBox.prototype.current = function() { return this.slotPkm(this.index()); };
    Window_PCBox.prototype.drawItem = function(index) {
        const p = this.slotPkm(index);
        const r = this.itemRect(index);
        this.contents.fontSize = 18;
        if (this._moveFrom === index) { this.changeTextColor("#ffe070"); }
        else this.resetTextColor();
        if (p) {
            this.changePaintOpacity(!p.isFainted());
            const nm = p.name.length > 8 ? p.name.slice(0, 8) : p.name;
            this.drawText(nm, r.x + 2, r.y + 2, r.width - 4, "left");
            this.drawText("Nv" + p.level, r.x + 2, r.y + r.height - this.lineHeight() - 2, r.width - 4, "left");
            this.changePaintOpacity(true);
        } else {
            this.changePaintOpacity(false);
            this.drawText("·", r.x, r.y, r.width, "center");
            this.changePaintOpacity(true);
        }
        this.resetFontSettings();
    };
    Window_PCBox.prototype.itemHeight = function() { return Math.floor(this.innerHeight / 5); };

    function Window_PCParty() { this.initialize(...arguments); }
    Window_PCParty.prototype = Object.create(Window_Selectable.prototype);
    Window_PCParty.prototype.constructor = Window_PCParty;
    Window_PCParty.prototype.maxItems = function() { return $gameParty.pkmCount(); };
    Window_PCParty.prototype.itemHeight = function() { return Math.floor(this.innerHeight / 6); };
    Window_PCParty.prototype.pkm = function(i) { return $gameParty.pkmParty()[i]; };
    Window_PCParty.prototype.current = function() { return this.pkm(this.index()); };
    Window_PCParty.prototype.drawItem = function(index) {
        const p = this.pkm(index);
        if (!p) return;
        const r = this.itemRect(index);
        this.changePaintOpacity(!p.isFainted());
        this.contents.fontSize = 20;
        this.drawText(p.name, r.x + 6, r.y + 2, r.width - 60, "left");
        this.drawText("Nv" + p.level, r.x + r.width - 56, r.y + 2, 52, "right");
        this.resetFontSettings();
        this.changePaintOpacity(true);
    };

    function Window_PCCommand() { this.initialize(...arguments); }
    Window_PCCommand.prototype = Object.create(Window_Command.prototype);
    Window_PCCommand.prototype.constructor = Window_PCCommand;
    Window_PCCommand.prototype.initialize = function(rect) {
        this._list2 = [];
        Window_Command.prototype.initialize.call(this, rect);
    };
    Window_PCCommand.prototype.setCommands = function(list) { this._list2 = list; this.refresh(); this.select(0); };
    Window_PCCommand.prototype.makeCommandList = function() {
        (this._list2 || []).forEach(c => this.addCommand(c.name, c.symbol));
    };

    //=========================================================================
    // Scene_PkmStorage
    //=========================================================================
    window.Scene_PkmStorage = function() { this.initialize(...arguments); };
    Scene_PkmStorage.prototype = Object.create(Scene_MenuBase.prototype);
    Scene_PkmStorage.prototype.constructor = Scene_PkmStorage;

    Scene_PkmStorage.prototype.create = function() {
        Scene_MenuBase.prototype.create.call(this);
        const top = this.mainAreaTop(), mainH = this.mainAreaHeight();
        const line = this.calcWindowHeight(1, false);
        const boxW = 520;

        this._titleWindow = new Window_Base(new Rectangle(0, top, boxW, line));
        this.addWindow(this._titleWindow);

        this._boxWindow = new Window_PCBox(new Rectangle(0, top + line, boxW, mainH - line * 2));
        this._boxWindow.setHandler("ok", this.onBoxOk.bind(this));
        this._boxWindow.setHandler("cancel", this.onBoxCancel.bind(this));
        this.addWindow(this._boxWindow);

        this._infoWindow = new Window_Base(new Rectangle(0, top + mainH - line, boxW, line));
        this.addWindow(this._infoWindow);

        this._partyWindow = new Window_PCParty(new Rectangle(boxW, top, Graphics.boxWidth - boxW, mainH));
        this._partyWindow.setHandler("ok", this.onPartyOk.bind(this));
        this._partyWindow.setHandler("cancel", this.onPartyCancel.bind(this));
        this._partyWindow.deactivate();
        this.addWindow(this._partyWindow);

        this._cmdWindow = new Window_PCCommand(new Rectangle(160, 220, 220, 1));
        this._cmdWindow.hide(); this._cmdWindow.deactivate();
        this.addWindow(this._cmdWindow);

        this.refreshAll();
        this._boxWindow.activate();
    };

    Scene_PkmStorage.prototype.refreshAll = function() {
        this.refreshTitle();
        this.drawInfo("");
        this._boxWindow.refresh();
        this._partyWindow.refresh();
    };
    Scene_PkmStorage.prototype.refreshTitle = function() {
        const c = this._titleWindow.contents; c.clear();
        const box = $gameParty.pkmBox(this._boxWindow._boxIndex);
        this._titleWindow.drawText("◀ " + box.name + " ▶", 0, 0, this._titleWindow.innerWidth, "center");
    };
    Scene_PkmStorage.prototype.drawInfo = function(text) {
        const c = this._infoWindow.contents; c.clear();
        this._infoWindow.contents.fontSize = 20;
        let t = text;
        if (!t) {
            const p = this._boxWindow.current();
            t = p ? (p.name + "  " + p.types().join("/") + "  HP " + p.hp + "/" + p.maxHp)
                  : "Q/W: trocar de caixa";
        }
        this._infoWindow.drawText(t, 8, 0, this._infoWindow.innerWidth - 16, "left");
        this._infoWindow.resetFontSettings();
    };

    Scene_PkmStorage.prototype.update = function() {
        Scene_MenuBase.prototype.update.call(this);
        // troca de caixa quando navegando na caixa
        if (this._boxWindow.active) {
            if (Input.isRepeated("pagedown")) { this.changeBox(1); }
            else if (Input.isRepeated("pageup")) { this.changeBox(-1); }
            this.drawInfo("");
        }
    };
    Scene_PkmStorage.prototype.changeBox = function(dir) {
        const n = $gameParty.pkmBoxCount();
        this._boxWindow._boxIndex = (this._boxWindow._boxIndex + dir + n) % n;
        this._boxWindow.refresh();
        this.refreshTitle();
        SoundManager.playCursor();
    };

    //--- ações na caixa -------------------------------------------------------
    Scene_PkmStorage.prototype.onBoxOk = function() {
        // modo mover: segundo OK define o destino
        if (this._boxWindow._moveFrom >= 0) {
            $gameParty.pkmMoveBoxSlot(this._boxWindow._boxIndex, this._boxWindow._moveFrom, this._boxWindow.index());
            this._boxWindow._moveFrom = -1;
            this._boxWindow.refresh();
            this._boxWindow.activate();
            return;
        }
        const p = this._boxWindow.current();
        const cmds = p
            ? [{ name: "Retirar", symbol: "withdraw" }, { name: "Resumo", symbol: "summary" },
               { name: "Mover", symbol: "move" }, { name: "Soltar", symbol: "release" },
               { name: "Cancelar", symbol: "cancel" }]
            : [{ name: "Depositar", symbol: "deposit" }, { name: "Cancelar", symbol: "cancel" }];
        this.openCommand(cmds);
    };
    Scene_PkmStorage.prototype.onBoxCancel = function() { this.popScene(); };

    Scene_PkmStorage.prototype.openCommand = function(cmds) {
        this._cmdWindow.setCommands(cmds);
        this._cmdWindow.height = this._cmdWindow.fittingHeight(cmds.length);
        this._cmdWindow.setHandler("withdraw", this.cmdWithdraw.bind(this));
        this._cmdWindow.setHandler("summary", this.cmdSummary.bind(this));
        this._cmdWindow.setHandler("move", this.cmdMove.bind(this));
        this._cmdWindow.setHandler("release", this.cmdRelease.bind(this));
        this._cmdWindow.setHandler("deposit", this.cmdDeposit.bind(this));
        this._cmdWindow.setHandler("cancel", this.cmdCancel.bind(this));
        this._cmdWindow.show(); this._cmdWindow.activate(); this._cmdWindow.select(0);
    };
    Scene_PkmStorage.prototype.closeCommand = function() {
        this._cmdWindow.hide(); this._cmdWindow.deactivate();
    };
    Scene_PkmStorage.prototype.cmdCancel = function() { this.closeCommand(); this._boxWindow.activate(); };
    Scene_PkmStorage.prototype.cmdWithdraw = function() {
        this.closeCommand();
        const r = $gameParty.pkmWithdraw(this._boxWindow._boxIndex, this._boxWindow.index());
        if (!r.ok) { SoundManager.playBuzzer(); this.drawInfo(r.reason); } else { SoundManager.playOk(); }
        this.refreshAll(); this._boxWindow.activate();
    };
    Scene_PkmStorage.prototype.cmdSummary = function() {
        this.closeCommand();
        PKM._summaryTarget = this._boxWindow.current();
        SceneManager.push(Scene_PkmSummary);
    };
    Scene_PkmStorage.prototype.cmdMove = function() {
        this.closeCommand();
        this._boxWindow._moveFrom = this._boxWindow.index();
        this.drawInfo("Escolha o destino e confirme.");
        this._boxWindow.refresh(); this._boxWindow.activate();
    };
    Scene_PkmStorage.prototype.cmdRelease = function() {
        this.closeCommand();
        const p = this._boxWindow.current();
        $gameParty.pkmReleaseBox(this._boxWindow._boxIndex, this._boxWindow.index());
        SoundManager.playOk();
        this.refreshAll();
        this.drawInfo((p ? p.name : "O Pokémon") + " foi solto. Adeus!");
        this._boxWindow.activate();
    };
    Scene_PkmStorage.prototype.cmdDeposit = function() {
        this.closeCommand();
        if ($gameParty.pkmCount() <= 1) {
            SoundManager.playBuzzer(); this.drawInfo("Não pode depositar o último Pokémon!");
            this._boxWindow.activate(); return;
        }
        this.drawInfo("Escolha quem depositar.");
        this._partyWindow.activate(); this._partyWindow.select(0);
    };

    //--- depósito a partir da equipe (vai para a 1ª caixa com espaço) ---------
    Scene_PkmStorage.prototype.onPartyOk = function() {
        const r = $gameParty.pkmDeposit(this._partyWindow.index());
        if (!r.ok) { SoundManager.playBuzzer(); this.drawInfo(r.reason); }
        else SoundManager.playOk();
        this._partyWindow.deactivate();
        this.refreshAll();
        this._boxWindow.activate();
    };
    Scene_PkmStorage.prototype.onPartyCancel = function() {
        this._partyWindow.deactivate();
        this._boxWindow.activate();
    };
})();
