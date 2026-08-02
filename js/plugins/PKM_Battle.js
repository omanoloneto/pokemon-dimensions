//=============================================================================
// PKM_Battle.js  — Fases 5a (batalha) + 6 (captura)
//=============================================================================
/*:
 * @target MZ
 * @plugindesc [PKM v0.2] Batalha selvagem 1v1: turnos, dano por tipo/STAB/crítico,
 * troca, fuga e CAPTURA (Poké Ball). Fórmulas puras em PKM.Battle.
 * @author Pokémon Dimensions (port MZ)
 * @base PKM_Core
 * @base PKM_Pokemon
 * @orderAfter PKM_Encounters
 *
 * @help PKM_Battle.js
 *
 * Cena Scene_PkmBattle. Lê o selvagem de $gameTemp.pkmWild (definido por
 * PKM_Encounters) e usa $gameParty.pkmParty() como sua equipe.
 *
 * Implementado nesta fase:
 *   - Ordem por prioridade > velocidade; cálculo de dano (STAB, tipos, crítico,
 *     variação aleatória); precisão/erro; desmaio; vitória/derrota.
 *   - Trocar de Pokémon e Fugir.
 *   - Captura com fórmula de chacoalhadas (4 shakes).
 * Fica para a Fase 5b: efeitos de status, golpes de status, clima, IA melhor.
 */

var PKM = PKM || {};
PKM.Battle = PKM.Battle || {};

(() => {
    "use strict";

    //=========================================================================
    // FÓRMULAS PURAS (testáveis sem render)
    //=========================================================================

    // dano de um golpe de dano. Retorna {damage, effectiveness, crit, stab}.
    PKM.Battle.calcDamage = function(attacker, defender, moveId, opts = {}) {
        const md = PKM.Core.move(moveId);
        if (!md || md.power <= 0 || md.category === "Status") {
            return { damage: 0, effectiveness: 1, crit: false, stab: 1, status: true };
        }
        const level = attacker.level;
        const power = md.power;
        const physical = md.category === "Physical";
        const useStage = typeof attacker.battleStat === "function";
        const A = useStage ? attacker.battleStat(physical ? "atk" : "spa") : attacker.stat(physical ? "atk" : "spa");
        const D = useStage ? defender.battleStat(physical ? "def" : "spd") : defender.stat(physical ? "def" : "spd");

        let base = Math.floor(Math.floor(Math.floor(2 * level / 5 + 2) * power * A / D) / 50) + 2;

        const stab = attacker.types().includes(md.type) ? 1.5 : 1.0;
        const eff = PKM.Core.typeMultiplier(md.type, defender.types());
        const crit = opts.forceCrit !== undefined ? !!opts.forceCrit : Math.randomInt(24) === 0;
        const critMod = crit ? 1.5 : 1.0;
        const rand = opts.fixedRand !== undefined ? opts.fixedRand : (85 + Math.randomInt(16)) / 100;
        const burn = (physical && attacker.status === "BRN") ? 0.5 : 1.0;  // queimadura reduz ataque físico

        let damage = 0;
        if (eff > 0) {
            damage = Math.floor(base * stab * eff * critMod * rand * burn);
            if (damage < 1) damage = 1;
        }
        return { damage, effectiveness: eff, crit, stab, burn };
    };

    // tentativa de captura. ballBonus: PokeBall=1, Great=1.5, Ultra=2, Master=255.
    PKM.Battle.tryCapture = function(wild, ballBonus = 1, statusBonus = 1) {
        const sp = wild.species();
        const catchRate = (sp && sp.catchRate) || 45;
        const maxHp = wild.maxHp;
        const curHp = Math.max(1, wild.hp);
        let a = ((3 * maxHp - 2 * curHp) * catchRate * ballBonus) / (3 * maxHp);
        a = Math.floor(a * statusBonus);
        if (a >= 255) return { success: true, shakes: 4 };
        if (a < 1) a = 1;
        const b = Math.floor(1048560 / Math.sqrt(Math.sqrt(16711680 / a)));
        let shakes = 0;
        for (let i = 0; i < 4; i++) {
            if (Math.randomInt(65536) < b) shakes++;
            else break;
        }
        return { success: shakes === 4, shakes };
    };

    // ordem de turno
    PKM.Battle.fasterFirst = function(monA, moveA, monB, moveB) {
        const pa = (PKM.Core.move(moveA.id) || {}).priority || 0;
        const pb = (PKM.Core.move(moveB.id) || {}).priority || 0;
        if (pa !== pb) return pa > pb;
        const sa = monA.battleSpeed ? monA.battleSpeed() : monA.spe;
        const sb = monB.battleSpeed ? monB.battleSpeed() : monB.spe;
        if (sa !== sb) return sa > sb;
        return Math.random() < 0.5;
    };

    //=========================================================================
    // Status, estágios de stat e efeitos de golpe (Fase 5b)
    //=========================================================================

    // registry de efeitos por golpe (internalName). target: "self" | "foe".
    // status moves usam {status}/{stats}; golpes de dano usam {secondary, chance}.
    PKM.Battle.MOVE_EFFECTS = {
        // --- inflige status (golpes de status) ---
        POISONPOWDER: { status: "PSN", target: "foe" }, POISONGAS: { status: "PSN", target: "foe" },
        TOXIC: { status: "TOX", target: "foe" },
        THUNDERWAVE: { status: "PAR", target: "foe" }, STUNSPORE: { status: "PAR", target: "foe" },
        GLARE: { status: "PAR", target: "foe" },
        WILLOWISP: { status: "BRN", target: "foe" },
        SLEEPPOWDER: { status: "SLP", target: "foe" }, SPORE: { status: "SLP", target: "foe" },
        HYPNOSIS: { status: "SLP", target: "foe" }, SING: { status: "SLP", target: "foe" },
        LOVELYKISS: { status: "SLP", target: "foe" }, GRASSWHISTLE: { status: "SLP", target: "foe" },
        // --- baixa stats do oponente ---
        GROWL: { stats: { atk: -1 }, target: "foe" }, TAILWHIP: { stats: { def: -1 }, target: "foe" },
        LEER: { stats: { def: -1 }, target: "foe" }, STRINGSHOT: { stats: { spe: -1 }, target: "foe" },
        SCREECH: { stats: { def: -2 }, target: "foe" }, METALSOUND: { stats: { spd: -2 }, target: "foe" },
        SMOKESCREEN: { stats: { acc: -1 }, target: "foe" }, SANDATTACK: { stats: { acc: -1 }, target: "foe" },
        SCARYFACE: { stats: { spe: -2 }, target: "foe" }, CHARM: { stats: { atk: -2 }, target: "foe" },
        // --- aumenta os próprios stats ---
        SWORDSDANCE: { stats: { atk: 2 }, target: "self" }, GROWTH: { stats: { atk: 1, spa: 1 }, target: "self" },
        AGILITY: { stats: { spe: 2 }, target: "self" }, HARDEN: { stats: { def: 1 }, target: "self" },
        WITHDRAW: { stats: { def: 1 }, target: "self" }, DEFENSECURL: { stats: { def: 1 }, target: "self" },
        IRONDEFENSE: { stats: { def: 2 }, target: "self" }, AMNESIA: { stats: { spd: 2 }, target: "self" },
        CALMMIND: { stats: { spa: 1, spd: 1 }, target: "self" }, NASTYPLOT: { stats: { spa: 2 }, target: "self" },
        DRAGONDANCE: { stats: { atk: 1, spe: 1 }, target: "self" }, BULKUP: { stats: { atk: 1, def: 1 }, target: "self" },
        // --- golpes de dano com efeito secundário (chance %) ---
        EMBER: { secondary: { status: "BRN" }, chance: 10 }, FLAMETHROWER: { secondary: { status: "BRN" }, chance: 10 },
        FIREBLAST: { secondary: { status: "BRN" }, chance: 10 }, FIREPUNCH: { secondary: { status: "BRN" }, chance: 10 },
        THUNDERSHOCK: { secondary: { status: "PAR" }, chance: 10 }, THUNDERBOLT: { secondary: { status: "PAR" }, chance: 10 },
        THUNDER: { secondary: { status: "PAR" }, chance: 30 }, THUNDERPUNCH: { secondary: { status: "PAR" }, chance: 10 },
        ICEBEAM: { secondary: { status: "FRZ" }, chance: 10 }, BLIZZARD: { secondary: { status: "FRZ" }, chance: 10 },
        ICEPUNCH: { secondary: { status: "FRZ" }, chance: 10 },
        BODYSLAM: { secondary: { status: "PAR" }, chance: 30 }, LICK: { secondary: { status: "PAR" }, chance: 30 },
        POISONSTING: { secondary: { status: "PSN" }, chance: 30 }, SLUDGE: { secondary: { status: "PSN" }, chance: 30 },
        SLUDGEBOMB: { secondary: { status: "PSN" }, chance: 30 }, POISONJAB: { secondary: { status: "PSN" }, chance: 30 },
        // --- golpes de dano que baixam stat do alvo ---
        PSYCHIC: { secondary: { stats: { spd: -1 }, target: "foe" }, chance: 10 },
        CRUNCH: { secondary: { stats: { def: -1 }, target: "foe" }, chance: 20 },
        ROCKTOMB: { secondary: { stats: { spe: -1 }, target: "foe" }, chance: 100 },
        BUBBLE: { secondary: { stats: { spe: -1 }, target: "foe" }, chance: 10 },
        AURORABEAM: { secondary: { stats: { atk: -1 }, target: "foe" }, chance: 10 },
        // --- recuo (recoil): o atacante toma parte do dano causado ---
        TAKEDOWN: { recoil: 0.25 }, SUBMISSION: { recoil: 0.25 }, DOUBLEEDGE: { recoil: 0.33 },
        FLAREBLITZ: { recoil: 0.33, secondary: { status: "BRN" }, chance: 10 },
        VOLTTACKLE: { recoil: 0.33, secondary: { status: "PAR" }, chance: 10 },
        BRAVEBIRD: { recoil: 0.33 }, WOODHAMMER: { recoil: 0.33 }, HEADSMASH: { recoil: 0.5 },
        // --- dreno: o atacante recupera parte do dano causado ---
        ABSORB: { drain: 0.5 }, MEGADRAIN: { drain: 0.5 }, GIGADRAIN: { drain: 0.5 },
        LEECHLIFE: { drain: 0.5 }, DRAINPUNCH: { drain: 0.5 }, DRAININGKISS: { drain: 0.75 },
        // --- autodestruição: o atacante desmaia após acertar ---
        SELFDESTRUCT: { selfKO: true }, EXPLOSION: { selfKO: true }
    };

    const STAT_LABEL = { atk: "Ataque", def: "Defesa", spa: "At. Esp.", spd: "Def. Esp.", spe: "Velocidade", acc: "Precisão", eva: "Evasão" };
    const STATUS_VERB = { PSN: " foi envenenado!", TOX: " foi gravemente envenenado!", BRN: " foi queimado!", PAR: " ficou paralisado!", SLP: " adormeceu!", FRZ: " foi congelado!" };

    PKM.Battle.statusImmune = function(target, status) {
        if (target.status) return true;             // já tem um status maior
        const types = target.types();
        if (status === "BRN" && types.includes("FIRE")) return true;
        if (status === "FRZ" && types.includes("ICE")) return true;
        if ((status === "PSN" || status === "TOX") && (types.includes("POISON") || types.includes("STEEL"))) return true;
        return false;
    };
    PKM.Battle.applyStatus = function(target, status) {
        if (PKM.Battle.statusImmune(target, status)) return { ok: false, messages: [] };
        target.status = status;
        if (status === "SLP") target._sleepTurns = 1 + Math.randomInt(3);
        if (status === "TOX") target._toxic = 1;
        return { ok: true, messages: [target.name + (STATUS_VERB[status] || " foi afetado!")] };
    };
    PKM.Battle.applyStatChange = function(target, stat, delta) {
        const applied = target.changeStage(stat, delta);
        const label = STAT_LABEL[stat] || stat;
        if (applied === 0) {
            return [label + " de " + target.name + (delta > 0 ? " não pode aumentar mais!" : " não pode diminuir mais!")];
        }
        const mag = Math.abs(applied);
        const dir = delta > 0 ? (mag >= 2 ? " aumentou muito!" : " aumentou!") : (mag >= 2 ? " caiu bruscamente!" : " diminuiu!");
        return [label + " de " + target.name + dir];
    };
    // pode agir? trata SLP/FRZ/PAR (mutável). Retorna {act, messages}
    PKM.Battle.canAct = function(mon) {
        if (mon.status === "FRZ") {
            if (Math.randomInt(100) < 20) { mon.status = null; return { act: true, messages: [mon.name + " descongelou!"] }; }
            return { act: false, messages: [mon.name + " está congelado!"] };
        }
        if (mon.status === "SLP") {
            if ((mon._sleepTurns || 0) > 0) {
                mon._sleepTurns--;
                if (mon._sleepTurns <= 0) { mon.status = null; return { act: true, messages: [mon.name + " acordou!"] }; }
                return { act: false, messages: [mon.name + " está dormindo."] };
            }
            mon.status = null; return { act: true, messages: [mon.name + " acordou!"] };
        }
        if (mon.status === "PAR" && Math.randomInt(100) < 25) {
            return { act: false, messages: [mon.name + " está paralisado! Não consegue se mexer!"] };
        }
        return { act: true, messages: [] };
    };
    PKM.Battle.accuracyCheck = function(attacker, defender, move) {
        const md = PKM.Core.move(move.id);
        if (!md || md.accuracy === 0) return true;       // 0 = nunca erra
        const accStage = attacker.stageMult ? attacker.stageMult("acc") : 1;
        const evaStage = defender.stageMult ? defender.stageMult("eva") : 1;
        return Math.randomInt(100) < (md.accuracy * accStage / evaStage);
    };
    // dano residual de fim de turno (PSN/TOX/BRN). Retorna mensagens.
    PKM.Battle.endOfTurnResidual = function(mon) {
        if (mon.isFainted()) return [];
        const msgs = [];
        if (mon.status === "PSN") {
            mon.takeDamage(Math.max(1, Math.floor(mon.maxHp / 8)));
            msgs.push(mon.name + " sofreu com o veneno!");
        } else if (mon.status === "TOX") {
            mon._toxic = mon._toxic || 1;
            mon.takeDamage(Math.max(1, Math.floor(mon.maxHp * mon._toxic / 16)));
            mon._toxic++;
            msgs.push(mon.name + " sofreu com o veneno!");
        } else if (mon.status === "BRN") {
            mon.takeDamage(Math.max(1, Math.floor(mon.maxHp / 8)));
            msgs.push(mon.name + " sofreu com a queimadura!");
        }
        if (mon.isFainted()) msgs.push(mon.name + " desmaiou!");
        return msgs;
    };

    // ganchos de vitória: plugins de franquia penduram recompensas aqui
    // (ex.: PKM_Parts dropa uma peça do Medabot derrotado). fn -> [mensagens]
    PKM.Battle._victoryHooks = [];
    PKM.Battle.registerVictoryHook = function(fn) {
        if (typeof fn === "function") PKM.Battle._victoryHooks.push(fn);
    };
    PKM.Battle.runVictoryHooks = function(winner, defeated, isTrainer) {
        const msgs = [];
        for (const fn of PKM.Battle._victoryHooks) {
            const out = fn(winner, defeated, isTrainer);
            if (Array.isArray(out)) msgs.push(...out);
            else if (typeof out === "string") msgs.push(out);
        }
        return msgs;
    };

    // efeitos que recaem sobre o próprio atacante: dreno, recuo, autodestruição.
    // Usado pelos golpes "Jibaku" da dimensão Bucky sem motor novo.
    PKM.Battle.applySelfEffect = function(attacker, eff, damageDealt) {
        const msgs = [];
        if (!eff || attacker.isFainted()) return msgs;
        if (eff.drain && damageDealt > 0) {
            const heal = Math.max(1, Math.floor(damageDealt * eff.drain));
            attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
            msgs.push(attacker.name + " absorveu energia!");
        }
        if (eff.recoil && damageDealt > 0) {
            attacker.takeDamage(Math.max(1, Math.floor(damageDealt * eff.recoil)));
            msgs.push(attacker.name + " se feriu com o impacto!");
        }
        if (eff.selfKO) {
            attacker.takeDamage(attacker.maxHp);
            msgs.push(attacker.name + " se autodestruiu!");
        }
        if (attacker.isFainted()) msgs.push(attacker.name + " desmaiou!");
        return msgs;
    };

    // chance de fuga (true = fugiu)
    PKM.Battle.canEscape = function(playerSpe, enemySpe, attempts = 0) {
        if (playerSpe > enemySpe) return true;
        if (enemySpe <= 0) return true;
        const odds = (Math.floor((playerSpe * 128) / enemySpe) + 30 * attempts) % 256;
        return Math.randomInt(256) < odds;
    };

    // EXP ganha por derrotar um Pokémon (bonus 1.5 em treinadores)
    PKM.Battle.expGain = function(faintedMon, participants = 1, bonus = 1) {
        const sp = faintedMon.species();
        const base = (sp && sp.baseExp) || 64;
        return Math.max(1, Math.floor((base * faintedMon.level * bonus) / 7 / Math.max(1, participants)));
    };

    //=========================================================================
    // Scene_PkmBattle  (a partir daqui usa render; ignorado no harness headless)
    //=========================================================================
    if (typeof Scene_Base === "undefined" || !Scene_Base.prototype.createWindowLayer) {
        // ambiente headless (testes): só as fórmulas acima.
        return;
    }

    window.Scene_PkmBattle = function() { this.initialize(...arguments); };
    Scene_PkmBattle.prototype = Object.create(Scene_Base.prototype);
    Scene_PkmBattle.prototype.constructor = Scene_PkmBattle;

    Scene_PkmBattle.prototype.create = function() {
        Scene_Base.prototype.create.call(this);
        this._trainer = $gameTemp.pkmTrainer || null;
        this._isTrainer = !!this._trainer;
        if (this._isTrainer) {
            this._enemyParty = this._trainer.party;
            this._enemyIndex = 0;
            this._enemy = this._enemyParty[0];
        } else {
            this._enemy = $gameTemp.pkmWild;
        }
        this._player = $gameParty.pkmFirstAble();
        this._runAttempts = 0;
        if (this._enemy.resetBattleState) this._enemy.resetBattleState();
        if (this._player && this._player.resetBattleState) this._player.resetBattleState();
        this.createBackground();
        this.createWindowLayer();
        this.createAllWindows();
        this.startBattle();
    };

    Scene_PkmBattle.prototype.createBackground = function() {
        const bmp = new Bitmap(Graphics.width, Graphics.height);
        bmp.gradientFillRect(0, 0, Graphics.width, Graphics.height, "#bfe9ff", "#7fb24d", true);
        this._bg = new Sprite(bmp);
        this.addChild(this._bg);
        // flash branco de entrada de batalha
        const fb = new Bitmap(Graphics.width, Graphics.height);
        fb.fillRect(0, 0, Graphics.width, Graphics.height, "#ffffff");
        this._flash = new Sprite(fb);
        this._flash.opacity = 255;
        this.addChild(this._flash);
    };

    Scene_PkmBattle.prototype.createAllWindows = function() {
        this._enemyWindow = new Window_Base(new Rectangle(16, 24, 380, 110));
        this._playerWindow = new Window_Base(new Rectangle(420, 300, 380, 120));
        this._msgWindow = new Window_Base(new Rectangle(0, 480, Graphics.boxWidth, 144));
        this.addWindow(this._enemyWindow);
        this.addWindow(this._playerWindow);
        this.addWindow(this._msgWindow);

        this._commandWindow = new Window_BattleCmd(new Rectangle(456, 480, 360, 144));
        this._commandWindow.setHandler("fight", this.onFight.bind(this));
        this._commandWindow.setHandler("ball", this.onBall.bind(this));
        this._commandWindow.setHandler("pokemon", this.onPokemonCmd.bind(this));
        this._commandWindow.setHandler("run", this.onRun.bind(this));
        this.addWindow(this._commandWindow);

        this._moveWindow = new Window_BattleMoves(new Rectangle(0, 480, Graphics.boxWidth, 144));
        this._moveWindow.setHandler("ok", this.onMoveOk.bind(this));
        this._moveWindow.setHandler("cancel", this.onMoveCancel.bind(this));
        this._moveWindow.hide();
        this.addWindow(this._moveWindow);

        const sr = new Rectangle(0, this.buttonAreaBottom ? this.buttonAreaBottom() : 0,
            Graphics.boxWidth, 470);
        this._switchWindow = new Window_BattleSwitch(sr);
        this._switchWindow.setHandler("ok", this.onSwitchOk.bind(this));
        this._switchWindow.setHandler("cancel", this.onSwitchCancel.bind(this));
        this._switchWindow.hide();
        this._switchWindow.deactivate();
        this.addWindow(this._switchWindow);

        this._ballWindow = new Window_BattleBalls(new Rectangle(0, 480, Graphics.boxWidth, 144));
        this._ballWindow.setHandler("ok", this.onBallOk.bind(this));
        this._ballWindow.setHandler("cancel", this.onBallCancel.bind(this));
        this._ballWindow.hide(); this._ballWindow.deactivate();
        this.addWindow(this._ballWindow);

        // aprender golpe (Fase 7): sim/não + seleção do golpe a esquecer
        this._yesnoWindow = new Window_BattleYesNo(new Rectangle(Graphics.boxWidth - 240, 336, 240, 144));
        this._yesnoWindow.setHandler("yes", this.onForgetYes.bind(this));
        this._yesnoWindow.setHandler("no", this.onForgetNo.bind(this));
        this._yesnoWindow.hide(); this._yesnoWindow.deactivate();
        this.addWindow(this._yesnoWindow);

        this._forgetWindow = new Window_BattleMoves(new Rectangle(0, 480, Graphics.boxWidth, 144));
        this._forgetWindow.setHandler("ok", this.onForgetOk.bind(this));
        this._forgetWindow.setHandler("cancel", this.onForgetCancel.bind(this));
        this._forgetWindow.hide(); this._forgetWindow.deactivate();
        this.addWindow(this._forgetWindow);

        this.refreshStatus();
    };

    //--- status / mensagens ---------------------------------------------------
    Scene_PkmBattle.prototype.foeTag = function() { return this._isTrainer ? "" : " selvagem"; };
    Scene_PkmBattle.prototype.refreshStatus = function() {
        this.drawBattler(this._enemyWindow, this._enemy, this._isTrainer ? "" : " (selvagem)", false);
        this.drawBattler(this._playerWindow, this._player, "", true);
    };
    Scene_PkmBattle.prototype.drawBattler = function(win, p, tag, hpText) {
        const c = win.contents; c.clear();
        if (!p) return;
        win.resetFontSettings();
        win.changeTextColor(ColorManager.normalColor());
        c.drawText(p.name + p.genderSymbol() + tag, 8, 0, win.innerWidth - 90, win.lineHeight(), "left");
        c.drawText("Nv." + p.level, win.innerWidth - 80, 0, 72, win.lineHeight(), "right");
        const y = win.lineHeight() + 8, w = win.innerWidth - 16, h = 12;
        const rate = p.hpRate();
        const col = rate > 0.5 ? "#78c850" : rate > 0.2 ? "#f8d030" : "#f85038";
        c.fillRect(8, y, w, h, "#303030");
        c.fillRect(9, y + 1, Math.floor((w - 2) * rate), h - 2, col);
        if (p.status) {
            const sc = { PSN: "#a040a0", TOX: "#a040a0", BRN: "#f08030", PAR: "#f8d030", SLP: "#8888a0", FRZ: "#98d8d8" }[p.status] || "#888";
            c.fillRect(8, y + h + 4, 56, 22, sc);
            win.changeTextColor("#ffffff");
            c.drawText(p.status, 8, y + h + 2, 56, win.lineHeight(), "center");
            win.resetTextColor();
        }
        if (hpText) c.drawText(p.hp + " / " + p.maxHp, 72, y + h + 2, w - 72, win.lineHeight(), "right");
    };
    Scene_PkmBattle.prototype._drawMessage = function(text) {
        const c = this._msgWindow.contents; c.clear();
        this._msgWindow.resetFontSettings();
        this._msgWindow.drawTextEx(text, 12, 8, this._msgWindow.innerWidth - 24);
    };
    Scene_PkmBattle.prototype._drawPrompt = function() {
        this._drawMessage("O que " + (this._player ? this._player.name : "?") + " fará?");
    };

    // fila de passos: cada passo = {text, fn?}
    Scene_PkmBattle.prototype.showSteps = function(steps, cb) {
        this._stepQueue = steps.slice();
        this._afterSteps = cb || (() => {});
        this._phase = "message";
        this.hideMenus();
        this._playNextStep();
    };
    Scene_PkmBattle.prototype._playNextStep = function() {
        if (this._stepQueue.length === 0) {
            const cb = this._afterSteps; this._afterSteps = null;
            this._phase = "settle"; cb();
            return;
        }
        const s = this._stepQueue.shift();
        if (s.fn) s.fn();
        this.refreshStatus();
        this._drawMessage(s.text || "");
    };
    Scene_PkmBattle.prototype.hideMenus = function() {
        this._commandWindow.hide(); this._commandWindow.deactivate();
        this._moveWindow.hide(); this._moveWindow.deactivate();
        this._switchWindow.hide(); this._switchWindow.deactivate();
        if (this._ballWindow) { this._ballWindow.hide(); this._ballWindow.deactivate(); }
        if (this._yesnoWindow) { this._yesnoWindow.hide(); this._yesnoWindow.deactivate(); }
        if (this._forgetWindow) { this._forgetWindow.hide(); this._forgetWindow.deactivate(); }
    };

    //--- ciclo ----------------------------------------------------------------
    Scene_PkmBattle.prototype.startBattle = function() {
        if ($gameSystem.pkmSetSeen) $gameSystem.pkmSetSeen(this._enemy.dexNumber);
        if (PKM.Audio) { PKM.Audio.playBattleBgm(this._isTrainer); PKM.Audio.playCry(this._enemy.dexNumber); }
        let intro;
        if (this._isTrainer) {
            intro = [{ text: this._trainer.name + " quer batalhar!" }];
            if (this._trainer.introText) intro.push({ text: this._trainer.introText });
            intro.push({ text: this._trainer.name + " enviou " + this._enemy.name + "!" });
            intro.push({ text: "Vai, " + this._player.name + "!" });
        } else {
            intro = [{ text: "Um " + this._enemy.name + " selvagem apareceu!" },
                     { text: "Vai, " + this._player.name + "!" }];
        }
        this.showSteps(intro, this.startInput.bind(this));
    };
    Scene_PkmBattle.prototype.startInput = function() {
        this._phase = "input";
        this.hideMenus();
        this._commandWindow.show(); this._commandWindow.activate(); this._commandWindow.select(0);
        this._drawPrompt();
    };

    Scene_PkmBattle.prototype.update = function() {
        Scene_Base.prototype.update.call(this);
        if (this._flash && this._flash.opacity > 0) this._flash.opacity -= 16;  // fade do flash de entrada
        if (this._phase === "message") {
            if (Input.isTriggered("ok") || Input.isTriggered("cancel") || TouchInput.isTriggered()) {
                this._playNextStep();
            }
        }
    };

    //--- comandos -------------------------------------------------------------
    Scene_PkmBattle.prototype.onFight = function() {
        this._commandWindow.hide(); this._commandWindow.deactivate();
        this._moveWindow.setPokemon(this._player);
        this._moveWindow.show(); this._moveWindow.activate(); this._moveWindow.select(0);
        this._phase = "selectMove";
    };
    Scene_PkmBattle.prototype.onMoveCancel = function() {
        this._moveWindow.hide(); this._moveWindow.deactivate();
        this.startInput();
    };
    Scene_PkmBattle.prototype.onMoveOk = function() {
        const mv = this._player.moves[this._moveWindow.index()];
        if (!mv || mv.pp <= 0) { SoundManager.playBuzzer(); this._moveWindow.activate(); return; }
        this._moveWindow.hide(); this._moveWindow.deactivate();
        this.executeMoveTurn(mv);
    };
    Scene_PkmBattle.prototype.onBall = function() {
        this._commandWindow.hide(); this._commandWindow.deactivate();
        if (this._isTrainer) {
            this.showSteps([{ text: "Não dá para capturar o Pokémon de outro treinador!" }],
                this.startInput.bind(this));
            return;
        }
        // regra da franquia do alvo (ex.: Monster Rancher não se captura em campo)
        if (PKM.Franchise) {
            const rule = PKM.Franchise.captureRule(this._enemy, null);
            if (!rule.allowed) {
                this.showSteps([{ text: rule.reason }], this.startInput.bind(this));
                return;
            }
        }
        // se a mochila (PKM_Bag) existir, escolhe entre as bolas que você possui
        if ($gameParty.pkmBalls) {
            let balls = $gameParty.pkmBalls();
            if (PKM.Franchise) balls = balls.filter(b => PKM.Franchise.itemWorksOn(b.name, this._enemy));
            if (balls.length === 0) {
                const f = PKM.Franchise ? PKM.Franchise.of(this._enemy) : null;
                const what = f && f.capture && f.capture.items.length ? "o item de captura desta dimensão" : "nenhuma Poké Bola";
                this.showSteps([{ text: "Você não tem " + what + "!" }], this.startInput.bind(this));
                return;
            }
            this._ballWindow.setBalls(balls);
            this._ballWindow.show(); this._ballWindow.activate(); this._ballWindow.select(0);
            this._phase = "selectBall";
            return;
        }
        // sem PKM_Bag: usa uma Poké Ball comum (modo autônomo)
        this.doBallThrow("POKEBALL", 1, false);
    };
    Scene_PkmBattle.prototype.onBallOk = function() {
        const e = this._ballWindow.currentBall();
        this._ballWindow.hide(); this._ballWindow.deactivate();
        if (!e) { this.startInput(); return; }
        this.doBallThrow(e.name, PKM.Items.ballBonus(e.name), true);
    };
    Scene_PkmBattle.prototype.onBallCancel = function() {
        this._ballWindow.hide(); this._ballWindow.deactivate();
        this.startInput();
    };
    Scene_PkmBattle.prototype.onRun = function() {
        this._commandWindow.hide(); this._commandWindow.deactivate();
        if (this._isTrainer) {
            this.showSteps([{ text: "Não dá para fugir de uma batalha de treinador!" }],
                this.startInput.bind(this));
            return;
        }
        this.doRun();
    };
    Scene_PkmBattle.prototype.onPokemonCmd = function() {
        this._commandWindow.hide(); this._commandWindow.deactivate();
        this._forcedSwitch = false;
        this.openSwitch();
    };

    //--- ações ----------------------------------------------------------------
    Scene_PkmBattle.prototype.pickEnemyMove = function() {
        const usable = (this._enemy.moves || []).filter(m => m.pp > 0);
        if (usable.length === 0) return { id: "TACKLE", pp: 1, ppMax: 1 };
        return usable[Math.randomInt(usable.length)];
    };

    // aplica efeito de status/stat de um golpe. Retorna mensagens.
    Scene_PkmBattle.prototype.applyMoveEffect = function(eff, attacker, defender) {
        const out = [];
        const tgt = eff.target === "self" ? attacker : defender;
        if (eff.status) {
            const r = PKM.Battle.applyStatus(tgt, eff.status);
            out.push(...(r.messages.length ? r.messages : ["Mas não teve efeito em " + tgt.name + "."]));
        }
        if (eff.stats) {
            for (const k in eff.stats) out.push(...PKM.Battle.applyStatChange(tgt, k, eff.stats[k]));
        }
        return out;
    };

    Scene_PkmBattle.prototype.buildMoveMessages = function(attacker, defender, move) {
        const md = PKM.Core.move(move.id);
        const name = md ? md.name : move.id;
        const tag = attacker === this._enemy ? this.foeTag() : "";
        const msgs = [];

        // pré-ação: dorme/congela/paralisia
        const ca = PKM.Battle.canAct(attacker);
        msgs.push(...ca.messages);
        if (!ca.act) return msgs.length ? msgs : [attacker.name + " não pode agir."];

        msgs.push(attacker.name + tag + " usou " + name + "!");
        if (move.pp !== undefined && move.pp > 0) move.pp--;
        if (!PKM.Battle.accuracyCheck(attacker, defender, move)) { msgs.push("Mas o ataque errou!"); return msgs; }

        const eff = PKM.Battle.MOVE_EFFECTS[move.id];
        const isStatus = !md || md.category === "Status" || md.power <= 0;
        if (isStatus) {
            if (eff) msgs.push(...this.applyMoveEffect(eff, attacker, defender));
            else msgs.push("…mas o golpe ainda não tem efeito implementado.");
            return msgs;
        }

        const calc = PKM.Battle.calcDamage(attacker, defender, move.id);
        if (calc.effectiveness === 0) { msgs.push("Não afeta " + defender.name + "…"); return msgs; }
        defender.takeDamage(calc.damage);
        if (calc.crit) msgs.push("Um acerto crítico!");
        if (calc.effectiveness > 1) msgs.push("Foi super eficaz!");
        else if (calc.effectiveness < 1) msgs.push("Não foi muito eficaz…");

        const selfMsgs = PKM.Battle.applySelfEffect(attacker, eff, calc.damage);
        if (defender.isFainted()) {
            const dt = defender === this._enemy ? this.foeTag() : "";
            msgs.push(defender.name + dt + " desmaiou!");
            return msgs.concat(selfMsgs);
        }
        msgs.push(...selfMsgs);
        if (attacker.isFainted()) return msgs;
        // efeito secundário (por chance)
        if (eff && eff.secondary) {
            const chance = eff.chance || (md ? md.effectChance : 0) || 0;
            if (chance > 0 && Math.randomInt(100) < chance) {
                const sec = Object.assign({ target: "foe" }, eff.secondary);
                msgs.push(...this.applyMoveEffect(sec, attacker, defender));
            }
        }
        return msgs;
    };

    Scene_PkmBattle.prototype.executeMoveTurn = function(playerMove) {
        const enemyMove = this.pickEnemyMove();
        const playerFirst = PKM.Battle.fasterFirst(this._player, playerMove, this._enemy, enemyMove);
        const order = playerFirst
            ? [[this._player, this._enemy, playerMove], [this._enemy, this._player, enemyMove]]
            : [[this._enemy, this._player, enemyMove], [this._player, this._enemy, playerMove]];
        let msgs = this.buildMoveMessages(order[0][0], order[0][1], order[0][2]);
        // o segundo atacante (= alvo do primeiro) só age se não desmaiou
        if (!order[1][0].isFainted()) {
            msgs = msgs.concat(this.buildMoveMessages(order[1][0], order[1][1], order[1][2]));
        }
        // dano residual de fim de turno (veneno/queimadura), na ordem de velocidade
        const resOrder = playerFirst ? [this._player, this._enemy] : [this._enemy, this._player];
        for (const mon of resOrder) msgs = msgs.concat(PKM.Battle.endOfTurnResidual(mon));

        this.showSteps(msgs.map(t => ({ text: t })), this.settleTurn.bind(this));
    };

    Scene_PkmBattle.prototype.settleTurn = function() {
        if (this._enemy.isFainted()) {
            if (this._player.recordWin) this._player.recordWin(this._enemy);
            this.awardExpAndFinish(() => this.onEnemyDefeated());
        } else if (this._player.isFainted()) {
            if (this._player.recordFaint) this._player.recordFaint();
            if ($gameParty.pkmAllFainted()) {
                this.showSteps([{ text: this._player.name + " desmaiou!" },
                                { text: "Você não tem mais Pokémon em pé…" }],
                    () => { $gameParty.pkmHealAll(); this.endBattle(); });
            } else {
                this.showSteps([{ text: this._player.name + " desmaiou!" }],
                    () => { this._forcedSwitch = true; this.openSwitch(); });
            }
        } else {
            this.startInput();
        }
    };

    Scene_PkmBattle.prototype.doRun = function() {
        const escaped = PKM.Battle.canEscape(this._player.spe, this._enemy.spe, this._runAttempts);
        this._runAttempts++;
        if (escaped) {
            this.showSteps([{ text: "Você fugiu em segurança!" }], () => this.endBattle());
        } else {
            const em = this.pickEnemyMove();
            const msgs = [{ text: "Não conseguiu fugir!" }]
                .concat(this.buildMoveMessages(this._enemy, this._player, em).map(t => ({ text: t })));
            this.showSteps(msgs, this.settleTurn.bind(this));
        }
    };

    Scene_PkmBattle.prototype.doBallThrow = function(ballName, bonus, consume) {
        if (PKM.Franchise) {
            const rule = PKM.Franchise.captureRule(this._enemy, ballName);
            if (!rule.allowed) {
                this.showSteps([{ text: rule.reason }], this.startInput.bind(this));
                return;
            }
        }
        const res = PKM.Battle.tryCapture(this._enemy, bonus, 1);
        const throwText = PKM.Franchise
            ? PKM.Franchise.throwText(this._enemy, ballName)
            : "Você jogou uma " + ((PKM.Core.item(ballName) || {}).name || "Poké Ball") + "!";
        const spend = consume && (!PKM.Items || !PKM.Items.isConsumedOnThrow || PKM.Items.isConsumedOnThrow(ballName));
        const steps = [{
            text: throwText,
            fn: () => { if (spend && $gameParty.pkmLoseItem) $gameParty.pkmLoseItem(ballName, 1); }
        }];
        const shakes = res.success ? 3 : res.shakes;
        for (let i = 0; i < shakes; i++) steps.push({ text: "…" });
        if (res.success) {
            const dest = { v: null };
            steps.push({
                text: PKM.Franchise
                    ? PKM.Franchise.successText(this._enemy, ballName)
                    : "Gotcha! " + this._enemy.name + " foi capturado!",
                fn: () => {
                    $gameSystem.pkmSetCaught(this._enemy.dexNumber);
                    this._enemy.healStatusOnly && this._enemy.healStatusOnly();
                    dest.v = $gameParty.pkmAdd(this._enemy);
                }
            });
            this.showSteps(steps, () => {
                if (dest.v === "storage") {
                    this.showSteps([{ text: this._enemy.name + " foi enviado ao PC." }],
                        () => this.endBattle());
                } else {
                    this.endBattle();
                }
            });
        } else {
            const em = this.pickEnemyMove();
            const fail = res.shakes >= 3 ? "Ah! Quase! Faltou pouco!" : "Oh não! O Pokémon escapou!";
            steps.push({ text: fail });
            this.showSteps(steps.concat(this.buildMoveMessages(this._enemy, this._player, em).map(t => ({ text: t }))),
                this.settleTurn.bind(this));
        }
    };

    //--- troca ----------------------------------------------------------------
    Scene_PkmBattle.prototype.openSwitch = function() {
        this._phase = "switch";
        this._switchWindow.refresh();
        this._switchWindow.show(); this._switchWindow.activate(); this._switchWindow.select(0);
    };
    Scene_PkmBattle.prototype.onSwitchOk = function() {
        const p = this._switchWindow.currentPokemon();
        if (!p || p.isFainted() || (p === this._player && !this._forcedSwitch)) {
            SoundManager.playBuzzer(); this._switchWindow.activate(); return;
        }
        this._switchWindow.hide(); this._switchWindow.deactivate();
        const forced = this._forcedSwitch;
        this._player = p;
        if (p.resetBattleState) p.resetBattleState();   // trocar zera os estágios de stat
        this.refreshStatus();
        if (forced) {
            this._forcedSwitch = false;
            this.showSteps([{ text: "Vai, " + p.name + "!" }], this.startInput.bind(this));
        } else {
            const em = this.pickEnemyMove();
            const msgs = [{ text: "Vai, " + p.name + "!" }]
                .concat(this.buildMoveMessages(this._enemy, this._player, em).map(t => ({ text: t })));
            this.showSteps(msgs, this.settleTurn.bind(this));
        }
    };
    Scene_PkmBattle.prototype.onSwitchCancel = function() {
        if (this._forcedSwitch) { SoundManager.playBuzzer(); this._switchWindow.activate(); return; }
        this._switchWindow.hide(); this._switchWindow.deactivate();
        this.startInput();
    };

    //--- crescimento: EXP, nível, golpes, evolução (Fase 7) ------------------
    Scene_PkmBattle.prototype.awardExpAndFinish = function(onDone) {
        const winner = this._player;
        this._afterGrowth = onDone;
        this._expWinner = winner;
        const exp = PKM.Battle.expGain(this._enemy, 1, this._isTrainer ? 1.5 : 1);
        const res = winner.addExp(exp);
        const steps = [{ text: winner.name + " ganhou " + res.gained + " de Exp.!" }];
        res.levels.forEach(lv => steps.push({ text: winner.name + " subiu para o nível " + lv.level + "!" }));
        PKM.Battle.runVictoryHooks(winner, this._enemy, this._isTrainer)
            .forEach(text => steps.push({ text }));
        this._learnQueue = res.levels.reduce((a, lv) => a.concat(lv.learnable), []);
        this.showSteps(steps, () => this.processNextLearn());
    };

    Scene_PkmBattle.prototype.processNextLearn = function() {
        const w = this._expWinner;
        if (!this._learnQueue || this._learnQueue.length === 0) return this.evolutionStep();
        const moveId = this._learnQueue.shift();
        if (w.knowsMove(moveId)) return this.processNextLearn();
        const md = PKM.Core.move(moveId);
        const nm = md ? md.name : moveId;
        if (w.moves.length < 4) {
            w.learnMove(moveId);
            this.showSteps([{ text: w.name + " aprendeu " + nm + "!" }], () => this.processNextLearn());
        } else {
            this._pendingLearn = { moveId, name: nm };
            this.showSteps([{ text: w.name + " quer aprender " + nm + ", mas já conhece 4 golpes." }],
                () => this.openForgetPrompt());
        }
    };

    Scene_PkmBattle.prototype.openForgetPrompt = function() {
        this._phase = "learn";
        this.hideMenus();
        this._drawMessage("Esquecer um golpe para aprender " + this._pendingLearn.name + "?");
        this._yesnoWindow.show(); this._yesnoWindow.activate(); this._yesnoWindow.select(0);
    };
    Scene_PkmBattle.prototype.onForgetYes = function() {
        this._yesnoWindow.hide(); this._yesnoWindow.deactivate();
        this._forgetWindow.setPokemon(this._expWinner);
        this._forgetWindow.show(); this._forgetWindow.activate(); this._forgetWindow.select(0);
        this._phase = "learn";
        this._drawMessage("Qual golpe deve ser esquecido?");
    };
    Scene_PkmBattle.prototype.onForgetNo = function() {
        this._yesnoWindow.hide(); this._yesnoWindow.deactivate();
        this.showSteps([{ text: this._expWinner.name + " não aprendeu " + this._pendingLearn.name + "." }],
            () => this.processNextLearn());
    };
    Scene_PkmBattle.prototype.onForgetOk = function() {
        const idx = this._forgetWindow.index();
        const oldMv = PKM.Core.move(this._expWinner.moves[idx].id);
        const oldName = oldMv ? oldMv.name : this._expWinner.moves[idx].id;
        this._expWinner.replaceMove(idx, this._pendingLearn.moveId);
        this._forgetWindow.hide(); this._forgetWindow.deactivate();
        this.showSteps([
            { text: "1, 2 e… pof!" },
            { text: this._expWinner.name + " esqueceu " + oldName + " e aprendeu " + this._pendingLearn.name + "!" }
        ], () => this.processNextLearn());
    };
    Scene_PkmBattle.prototype.onForgetCancel = function() {
        this._forgetWindow.hide(); this._forgetWindow.deactivate();
        this.showSteps([{ text: this._expWinner.name + " não aprendeu " + this._pendingLearn.name + "." }],
            () => this.processNextLearn());
    };

    Scene_PkmBattle.prototype.evolutionStep = function() {
        const w = this._expWinner;
        const into = w.evolutionByLevel ? w.evolutionByLevel() : null;
        if (!into) return this.finishGrowth();
        const oldName = w.name;
        this.showSteps([{ text: "O quê? " + oldName + " está evoluindo!" }], () => {
            w.evolveInto(into);
            this.refreshStatus();
            this.showSteps([{ text: oldName + " evoluiu em " + w.speciesName + "!" }],
                () => this.finishGrowth());
        });
    };
    Scene_PkmBattle.prototype.finishGrowth = function() {
        const cb = this._afterGrowth; this._afterGrowth = null;
        cb();
    };

    // após derrotar um Pokémon inimigo: próximo do treinador ou fim
    Scene_PkmBattle.prototype.onEnemyDefeated = function() {
        if (this._isTrainer) {
            this._enemyIndex++;
            if (this._enemyIndex < this._enemyParty.length) {
                this._enemy = this._enemyParty[this._enemyIndex];
                if (this._enemy.resetBattleState) this._enemy.resetBattleState();
                if ($gameSystem.pkmSetSeen) $gameSystem.pkmSetSeen(this._enemy.dexNumber);
                if (PKM.Audio) PKM.Audio.playCry(this._enemy.dexNumber);
                this.refreshStatus();
                this.showSteps([{ text: this._trainer.name + " enviou " + this._enemy.name + "!" }],
                    this.startInput.bind(this));
            } else {
                this.trainerDefeated();
            }
        } else {
            if (PKM.Audio) PKM.Audio.playVictory(false);
            this.endBattle();
        }
    };
    Scene_PkmBattle.prototype.trainerDefeated = function() {
        if (PKM.Audio) PKM.Audio.playVictory(true);
        const reward = this._trainer.money || 0;
        const steps = [{ text: "Você derrotou " + this._trainer.name + "!" }];
        if (this._trainer.defeatText) steps.push({ text: this._trainer.defeatText });
        steps.push({
            text: "Você recebeu $" + reward + " de prêmio!",
            fn: () => { if ($gameParty.pkmGainMoney) $gameParty.pkmGainMoney(reward); }
        });
        this.showSteps(steps, () => this.endBattle());
    };

    //--- fim ------------------------------------------------------------------
    Scene_PkmBattle.prototype.endBattle = function() {
        $gameTemp.pkmWild = null;
        $gameTemp.pkmTrainer = null;
        if (PKM.Audio) PKM.Audio.restoreBgm();
        this.popScene();
    };

    //=========================================================================
    // Janelas auxiliares
    //=========================================================================
    function Window_BattleCmd() { this.initialize(...arguments); }
    Window_BattleCmd.prototype = Object.create(Window_Command.prototype);
    Window_BattleCmd.prototype.constructor = Window_BattleCmd;
    Window_BattleCmd.prototype.makeCommandList = function() {
        this.addCommand("Lutar", "fight");
        this.addCommand("Bola", "ball");
        this.addCommand("Pokémon", "pokemon");
        this.addCommand("Fugir", "run");
    };
    Window_BattleCmd.prototype.maxCols = function() { return 2; };

    function Window_BattleMoves() { this.initialize(...arguments); }
    Window_BattleMoves.prototype = Object.create(Window_Selectable.prototype);
    Window_BattleMoves.prototype.constructor = Window_BattleMoves;
    Window_BattleMoves.prototype.initialize = function(rect) {
        Window_Selectable.prototype.initialize.call(this, rect);
        this._pkm = null;
    };
    Window_BattleMoves.prototype.setPokemon = function(p) { this._pkm = p; this.refresh(); };
    Window_BattleMoves.prototype.maxCols = function() { return 2; };
    Window_BattleMoves.prototype.maxItems = function() { return this._pkm ? this._pkm.moves.length : 0; };
    Window_BattleMoves.prototype.drawItem = function(index) {
        const mv = this._pkm.moves[index];
        if (!mv) return;
        const md = PKM.Core.move(mv.id);
        const r = this.itemLineRect(index);
        this.changePaintOpacity(mv.pp > 0);
        this.drawText(md ? md.name : mv.id, r.x, r.y, r.width - 90, "left");
        this.drawText("PP " + mv.pp + "/" + mv.ppMax, r.x + r.width - 100, r.y, 100, "right");
        this.changePaintOpacity(true);
    };

    function Window_BattleSwitch() { this.initialize(...arguments); }
    Window_BattleSwitch.prototype = Object.create(Window_Selectable.prototype);
    Window_BattleSwitch.prototype.constructor = Window_BattleSwitch;
    Window_BattleSwitch.prototype.maxItems = function() { return $gameParty.pkmCount(); };
    Window_BattleSwitch.prototype.itemHeight = function() { return Math.floor(this.innerHeight / 6); };
    Window_BattleSwitch.prototype.pokemon = function(i) { return $gameParty.pkmParty()[i]; };
    Window_BattleSwitch.prototype.currentPokemon = function() { return this.pokemon(this.index()); };
    Window_BattleSwitch.prototype.drawItem = function(index) {
        const p = this.pokemon(index);
        if (!p) return;
        const r = this.itemRect(index);
        this.changePaintOpacity(!p.isFainted());
        this.drawText(p.name + " " + p.genderSymbol(), r.x + 8, r.y + 4, 260, "left");
        this.drawText("Nv." + p.level, r.x + 280, r.y + 4, 80, "left");
        this.drawText("HP " + p.hp + "/" + p.maxHp, r.x + 380, r.y + 4, 160, "left");
        this.changePaintOpacity(true);
    };

    function Window_BattleBalls() { this.initialize(...arguments); }
    Window_BattleBalls.prototype = Object.create(Window_Selectable.prototype);
    Window_BattleBalls.prototype.constructor = Window_BattleBalls;
    Window_BattleBalls.prototype.initialize = function(rect) {
        Window_Selectable.prototype.initialize.call(this, rect);
        this._balls = [];
    };
    Window_BattleBalls.prototype.setBalls = function(balls) { this._balls = balls; this.refresh(); this.select(0); };
    Window_BattleBalls.prototype.maxCols = function() { return 2; };
    Window_BattleBalls.prototype.maxItems = function() { return this._balls.length; };
    Window_BattleBalls.prototype.currentBall = function() { return this._balls[this.index()]; };
    Window_BattleBalls.prototype.drawItem = function(index) {
        const e = this._balls[index];
        if (!e) return;
        const r = this.itemLineRect(index);
        this.drawText(e.data.name, r.x, r.y, r.width - 80, "left");
        this.drawText("×" + e.qty, r.x + r.width - 80, r.y, 80, "right");
    };

    function Window_BattleYesNo() { this.initialize(...arguments); }
    Window_BattleYesNo.prototype = Object.create(Window_Command.prototype);
    Window_BattleYesNo.prototype.constructor = Window_BattleYesNo;
    Window_BattleYesNo.prototype.makeCommandList = function() {
        this.addCommand("Sim", "yes");
        this.addCommand("Não", "no");
    };
})();
