//=============================================================================
// PKM_Bag.js  — Fase 3
//=============================================================================
/*:
 * @target MZ
 * @plugindesc [PKM v0.3] Mochila por bolsos, dinheiro, efeitos de itens (cura/PP/
 * revive/status) e cena da mochila. Integra Poké Bolas com a batalha.
 * @author Pokémon Dimensions (port MZ)
 * @base PKM_Core
 * @base PKM_Pokemon
 * @base PKM_Party
 * @orderAfter PKM_Battle
 *
 * @help PKM_Bag.js
 *
 * Estende $gameParty com a mochila Pokémon (salva no save):
 *   $gameParty.pkmGainItem(name, qty)   / pkmLoseItem(name, qty)
 *   $gameParty.pkmItemCount(name)       / pkmHasItem(name)
 *   $gameParty.pkmPocket(n)             -> [{name, qty}] do bolso n
 *   $gameParty.pkmMoney() / pkmGainMoney(n) / pkmLoseMoney(n)
 *
 * Bolsos: 1 Itens · 2 Remédios · 3 Poké Bolas · 4 MTs · 5 Berries ·
 *         6 Correio · 7 Batalha · 8 Chave.
 *
 * @command giveItem
 * @text Dar Item
 * @arg item @type string @text Item @desc internalName (ex.: POTION).
 * @arg qty  @type number @min 1 @default 1 @text Quantidade
 *
 * @command takeItem
 * @text Remover Item
 * @arg item @type string @text Item
 * @arg qty  @type number @min 1 @default 1 @text Quantidade
 *
 * @command openBag
 * @text Abrir Mochila
 *
 * @command giveMoney
 * @text Dar Dinheiro
 * @arg amount @type number @min 0 @default 100 @text Valor
 */

var PKM = PKM || {};

(() => {
    "use strict";

    const POCKET_NAMES = {
        1: "Itens", 2: "Remédios", 3: "Poké Bolas", 4: "MTs",
        5: "Berries", 6: "Correio", 7: "Batalha", 8: "Chave"
    };
    const KEY_POCKET = 8;

    // valor de cura de HP por item (medicina)
    const HP_HEAL = {
        POTION: 20, SUPERPOTION: 60, HYPERPOTION: 120, MAXPOTION: "full",
        FULLRESTORE: "full", FRESHWATER: 50, SODAPOP: 60, LEMONADE: 80,
        MOOMOOMILK: 100, BERRYJUICE: 20, SWEETHEART: 20, ENERGYPOWDER: 50,
        ENERGYROOT: 200, RAGECANDYBAR: 20
    };
    const REVIVE = { REVIVE: 0.5, MAXREVIVE: 1.0, REVIVALHERB: 1.0 };
    const STATUS_CURE = {
        ANTIDOTE: ["PSN"], PARALYZEHEAL: ["PAR"], PARLYZHEAL: ["PAR"],
        AWAKENING: ["SLP"], BURNHEAL: ["BRN"], ICEHEAL: ["FRZ"],
        FULLHEAL: ["PSN", "PAR", "SLP", "BRN", "FRZ"],
        FULLRESTORE: ["PSN", "PAR", "SLP", "BRN", "FRZ"],
        LAVACOOKIE: ["PSN", "PAR", "SLP", "BRN", "FRZ"],
        OLDGATEAU: ["PSN", "PAR", "SLP", "BRN", "FRZ"]
    };
    const PP_RESTORE = { ETHER: 10, MAXETHER: "full", ELIXIR: 10, MAXELIXIR: "full" };
    const BALL_BONUS = { POKEBALL: 1, GREATBALL: 1.5, ULTRABALL: 2, MASTERBALL: 255, PREMIERBALL: 1 };

    PKM.Items = PKM.Items || {};
    PKM.Items.ballBonus = (name) => BALL_BONUS[name] !== undefined ? BALL_BONUS[name] : 1;
    PKM.Items.isBall = (name) => { const it = PKM.Core.item(name); return it && it.pocket === 3; };
    PKM.Items.isMedicine = (name) => { const it = PKM.Core.item(name); return it && it.pocket === 2; };

    // aplica item em um Pokémon. Retorna {ok, message}
    PKM.Items.useOnPokemon = function(name, pkm) {
        const it = PKM.Core.item(name);
        const label = it ? it.name : name;

        if (REVIVE[name] !== undefined) {
            if (!pkm.isFainted()) return { ok: false, message: pkm.name + " não desmaiou." };
            pkm.hp = Math.max(1, Math.floor(pkm.maxHp * REVIVE[name]));
            pkm.status = null;
            return { ok: true, message: pkm.name + " reviveu!" };
        }
        if (HP_HEAL[name] !== undefined) {
            if (pkm.isFainted()) return { ok: false, message: "Não funciona em Pokémon desmaiado." };
            if (pkm.hp >= pkm.maxHp && !STATUS_CURE[name]) return { ok: false, message: pkm.name + " já está com o HP cheio." };
            const before = pkm.hp;
            pkm.hp = HP_HEAL[name] === "full" ? pkm.maxHp : Math.min(pkm.maxHp, pkm.hp + HP_HEAL[name]);
            if (STATUS_CURE[name] && pkm.status) pkm.status = null;
            return { ok: true, message: pkm.name + " recuperou " + (pkm.hp - before) + " de HP." };
        }
        if (STATUS_CURE[name]) {
            if (pkm.status && STATUS_CURE[name].includes(pkm.status)) {
                pkm.status = null;
                return { ok: true, message: label + " curou " + pkm.name + "." };
            }
            return { ok: false, message: "Não teve efeito em " + pkm.name + "." };
        }
        if (PP_RESTORE[name] !== undefined) {
            let restored = false;
            for (const m of pkm.moves) {
                if (m.pp < m.ppMax) {
                    m.pp = PP_RESTORE[name] === "full" ? m.ppMax : Math.min(m.ppMax, m.pp + PP_RESTORE[name]);
                    restored = true;
                }
            }
            return restored ? { ok: true, message: "PP restaurado." } : { ok: false, message: "O PP já está cheio." };
        }
        return { ok: false, message: "Não dá para usar " + label + " agora." };
    };

    //=========================================================================
    // Game_Party — mochila + dinheiro
    //=========================================================================
    const _GP_init = Game_Party.prototype.initialize;
    Game_Party.prototype.initialize = function() {
        _GP_init.call(this);
        this._pkmBag = {};
        this._pkmMoney = 3000;
    };
    Game_Party.prototype.pkmBagEnsure = function() {
        if (!this._pkmBag) this._pkmBag = {};
        if (this._pkmMoney === undefined) this._pkmMoney = 0;
    };
    Game_Party.prototype.pkmItemCount = function(name) { this.pkmBagEnsure(); return this._pkmBag[name] || 0; };
    Game_Party.prototype.pkmHasItem = function(name) { return this.pkmItemCount(name) > 0; };
    Game_Party.prototype.pkmGainItem = function(name, qty = 1) {
        this.pkmBagEnsure();
        if (!PKM.Core.item(name)) { console.warn("Item desconhecido:", name); return; }
        this._pkmBag[name] = Math.max(0, (this._pkmBag[name] || 0) + qty);
        if (this._pkmBag[name] === 0) delete this._pkmBag[name];
    };
    Game_Party.prototype.pkmLoseItem = function(name, qty = 1) { this.pkmGainItem(name, -qty); };
    Game_Party.prototype.pkmPocket = function(pocket) {
        this.pkmBagEnsure();
        return Object.keys(this._pkmBag)
            .map(name => ({ name, qty: this._pkmBag[name], data: PKM.Core.item(name) }))
            .filter(e => e.data && e.data.pocket === pocket)
            .sort((a, b) => a.data.id - b.data.id);
    };
    Game_Party.prototype.pkmBalls = function() { return this.pkmPocket(3); };
    Game_Party.prototype.pkmMoney = function() { this.pkmBagEnsure(); return this._pkmMoney; };
    Game_Party.prototype.pkmGainMoney = function(n) { this.pkmBagEnsure(); this._pkmMoney = Math.max(0, Math.min(9999999, this._pkmMoney + n)); };
    Game_Party.prototype.pkmLoseMoney = function(n) { this.pkmGainMoney(-n); };

    // ambiente headless (testes): só lógica de itens/mochila acima.
    if (typeof Scene_MenuBase === "undefined" || !Scene_MenuBase.prototype.create) {
        // comandos de plugin ainda assim (no-op se PluginManager for stub)
        PluginManager.registerCommand("PKM_Bag", "giveItem", args => $gameParty.pkmGainItem(args.item, Number(args.qty) || 1));
        PluginManager.registerCommand("PKM_Bag", "takeItem", args => $gameParty.pkmLoseItem(args.item, Number(args.qty) || 1));
        PluginManager.registerCommand("PKM_Bag", "giveMoney", args => $gameParty.pkmGainMoney(Number(args.amount) || 0));
        return;
    }

    //=========================================================================
    // Janelas
    //=========================================================================
    function Window_BagPockets() { this.initialize(...arguments); }
    Window_BagPockets.prototype = Object.create(Window_HorzCommand.prototype);
    Window_BagPockets.prototype.constructor = Window_BagPockets;
    Window_BagPockets.prototype.maxCols = function() { return 8; };
    Window_BagPockets.prototype.makeCommandList = function() {
        for (let p = 1; p <= 8; p++) this.addCommand(POCKET_NAMES[p], "p" + p, true, p);
    };
    Window_BagPockets.prototype.currentPocket = function() {
        return this.currentExt() || 1;
    };

    function Window_BagList() { this.initialize(...arguments); }
    Window_BagList.prototype = Object.create(Window_Selectable.prototype);
    Window_BagList.prototype.constructor = Window_BagList;
    Window_BagList.prototype.initialize = function(rect) {
        Window_Selectable.prototype.initialize.call(this, rect);
        this._pocket = 1; this._data = [];
        this._helpWindow = null;
    };
    Window_BagList.prototype.setHelpWindow = function(w) { this._helpWindow = w; };
    Window_BagList.prototype.setPocket = function(p) { this._pocket = p; this.refresh(); this.select(0); };
    Window_BagList.prototype.maxItems = function() { return this._data ? this._data.length : 0; };
    Window_BagList.prototype.currentEntry = function() { return this._data[this.index()]; };
    Window_BagList.prototype.makeItemList = function() { this._data = $gameParty.pkmPocket(this._pocket); };
    Window_BagList.prototype.refresh = function() { this.makeItemList(); Window_Selectable.prototype.refresh.call(this); };
    Window_BagList.prototype.drawItem = function(index) {
        const e = this._data[index];
        if (!e) return;
        const r = this.itemLineRect(index);
        this.drawText(e.data.name, r.x, r.y, r.width - 90, "left");
        if (this._pocket !== KEY_POCKET) this.drawText("×" + e.qty, r.x + r.width - 80, r.y, 80, "right");
    };
    Window_BagList.prototype.callUpdateHelp = function() {
        if (this._helpWindow) {
            const e = this.currentEntry();
            this._helpWindow.setText(e ? e.data.description : "");
        }
    };

    //=========================================================================
    // Scene_PkmBag
    //=========================================================================
    window.Scene_PkmBag = function() { this.initialize(...arguments); };
    Scene_PkmBag.prototype = Object.create(Scene_MenuBase.prototype);
    Scene_PkmBag.prototype.constructor = Scene_PkmBag;

    Scene_PkmBag.prototype.create = function() {
        Scene_MenuBase.prototype.create.call(this);
        const top = this.mainAreaTop();
        const ph = this.calcWindowHeight(1, true);
        this._pockets = new Window_BagPockets(new Rectangle(0, top, Graphics.boxWidth, ph));
        this._pockets.setHandler("ok", this.onPocketOk.bind(this));
        this._pockets.setHandler("cancel", this.popScene.bind(this));
        this.addWindow(this._pockets);

        const helpH = this.calcWindowHeight(2, false);
        const listY = top + ph;
        const listH = this.mainAreaBottom() - listY - helpH;
        this._list = new Window_BagList(new Rectangle(0, listY, Graphics.boxWidth, listH));
        this._list.setHandler("ok", this.onItemOk.bind(this));
        this._list.setHandler("cancel", this.onItemCancel.bind(this));
        this.addWindow(this._list);

        this._help = new Window_Help(new Rectangle(0, this.mainAreaBottom() - helpH, Graphics.boxWidth, helpH));
        this.addWindow(this._help);
        this._list.setHelpWindow(this._help);

        const gw = 240;
        this._gold = new Window_Base(new Rectangle(Graphics.boxWidth - gw, top - 0, gw, ph));
        this.addWindow(this._gold);

        this._target = new Window_BagTarget(new Rectangle(0, listY, Graphics.boxWidth, listH + helpH));
        this._target.setHandler("ok", this.onTargetOk.bind(this));
        this._target.setHandler("cancel", this.onTargetCancel.bind(this));
        this._target.hide(); this._target.deactivate();
        this.addWindow(this._target);

        this._list.setPocket(this._pockets.currentPocket());
        this.refreshGold();
        this._pockets.activate();
    };
    Scene_PkmBag.prototype.refreshGold = function() {
        const c = this._gold.contents; c.clear();
        this._gold.drawText("$ " + $gameParty.pkmMoney(), 0, 0, this._gold.innerWidth - 8, "right");
    };
    Scene_PkmBag.prototype.onPocketOk = function() {
        this._list.setPocket(this._pockets.currentPocket());
        this._list.activate(); this._list.select(0);
    };
    Scene_PkmBag.prototype.onItemCancel = function() {
        this._list.deselect(); this._pockets.activate();
    };
    Scene_PkmBag.prototype.onItemOk = function() {
        const e = this._list.currentEntry();
        if (!e) { this._list.activate(); return; }
        if (PKM.Items.isMedicine(e.name)) {
            this._pendingItem = e.name;
            this._list.deactivate();
            this._target.refresh(); this._target.show(); this._target.activate(); this._target.select(0);
        } else if (PKM.Items.isBall(e.name)) {
            this._help.setText("Poké Bolas só podem ser usadas em batalha.");
            this._list.activate();
        } else {
            this._help.setText("Este item não pode ser usado a partir do menu (ainda).");
            this._list.activate();
        }
    };
    Scene_PkmBag.prototype.onTargetOk = function() {
        const p = this._target.currentPokemon();
        const res = PKM.Items.useOnPokemon(this._pendingItem, p);
        if (res.ok) {
            $gameParty.pkmLoseItem(this._pendingItem, 1);
            SoundManager.playUseItem && SoundManager.playUseItem();
        } else {
            SoundManager.playBuzzer();
        }
        this._help.setText(res.message);
        this._target.refresh();
        if ($gameParty.pkmItemCount(this._pendingItem) <= 0 || !res.ok) {
            this.closeTarget();
        } else {
            this._target.activate();
        }
    };
    Scene_PkmBag.prototype.onTargetCancel = function() { this.closeTarget(); };
    Scene_PkmBag.prototype.closeTarget = function() {
        this._target.hide(); this._target.deactivate();
        this._list.refresh(); this._list.activate();
    };

    // janela de alvo (party) reutilizável
    function Window_BagTarget() { this.initialize(...arguments); }
    Window_BagTarget.prototype = Object.create(Window_Selectable.prototype);
    Window_BagTarget.prototype.constructor = Window_BagTarget;
    Window_BagTarget.prototype.maxItems = function() { return $gameParty.pkmCount(); };
    Window_BagTarget.prototype.itemHeight = function() { return Math.floor(this.innerHeight / 6); };
    Window_BagTarget.prototype.pokemon = function(i) { return $gameParty.pkmParty()[i]; };
    Window_BagTarget.prototype.currentPokemon = function() { return this.pokemon(this.index()); };
    Window_BagTarget.prototype.drawItem = function(index) {
        const p = this.pokemon(index);
        if (!p) return;
        const r = this.itemRect(index);
        this.changePaintOpacity(!p.isFainted() || true);
        this.drawText(p.name + " " + p.genderSymbol(), r.x + 8, r.y + 4, 260, "left");
        this.drawText("Nv." + p.level, r.x + 280, r.y + 4, 80, "left");
        this.drawText("HP " + p.hp + "/" + p.maxHp + (p.status ? "  [" + p.status + "]" : ""),
            r.x + 380, r.y + 4, 240, "left");
        this.changePaintOpacity(true);
    };

    //=========================================================================
    // Comandos de plugin
    //=========================================================================
    PluginManager.registerCommand("PKM_Bag", "giveItem", args => $gameParty.pkmGainItem(args.item, Number(args.qty) || 1));
    PluginManager.registerCommand("PKM_Bag", "takeItem", args => $gameParty.pkmLoseItem(args.item, Number(args.qty) || 1));
    PluginManager.registerCommand("PKM_Bag", "openBag", () => SceneManager.push(Scene_PkmBag));
    PluginManager.registerCommand("PKM_Bag", "giveMoney", args => $gameParty.pkmGainMoney(Number(args.amount) || 0));
})();
