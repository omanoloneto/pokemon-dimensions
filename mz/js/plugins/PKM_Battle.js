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
        const A = physical ? attacker.stat("atk") : attacker.stat("spa");
        const D = physical ? defender.stat("def") : defender.stat("spd");

        let base = Math.floor(Math.floor(Math.floor(2 * level / 5 + 2) * power * A / D) / 50) + 2;

        const stab = attacker.types().includes(md.type) ? 1.5 : 1.0;
        const eff = PKM.Core.typeMultiplier(md.type, defender.types());
        const crit = opts.forceCrit || Math.randomInt(24) === 0;
        const critMod = crit ? 1.5 : 1.0;
        const rand = opts.fixedRand !== undefined ? opts.fixedRand : (85 + Math.randomInt(16)) / 100;

        let damage = 0;
        if (eff > 0) {
            damage = Math.floor(base * stab * eff * critMod * rand);
            if (damage < 1) damage = 1;
        }
        return { damage, effectiveness: eff, crit, stab };
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
        if (monA.spe !== monB.spe) return monA.spe > monB.spe;
        return Math.random() < 0.5;
    };

    // chance de fuga (true = fugiu)
    PKM.Battle.canEscape = function(playerSpe, enemySpe, attempts = 0) {
        if (playerSpe > enemySpe) return true;
        if (enemySpe <= 0) return true;
        const odds = (Math.floor((playerSpe * 128) / enemySpe) + 30 * attempts) % 256;
        return Math.randomInt(256) < odds;
    };

    // EXP ganha por derrotar um Pokémon (dividida entre participantes)
    PKM.Battle.expGain = function(faintedMon, participants = 1) {
        const sp = faintedMon.species();
        const base = (sp && sp.baseExp) || 64;
        return Math.max(1, Math.floor((base * faintedMon.level) / 7 / Math.max(1, participants)));
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
        this._enemy = $gameTemp.pkmWild;
        this._player = $gameParty.pkmFirstAble();
        this._runAttempts = 0;
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
    Scene_PkmBattle.prototype.refreshStatus = function() {
        this.drawBattler(this._enemyWindow, this._enemy, " (selvagem)", false);
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
        if (hpText) c.drawText(p.hp + " / " + p.maxHp, 8, y + h + 2, w, win.lineHeight(), "right");
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
        this.showSteps([{ text: "Um " + this._enemy.name + " selvagem apareceu!" },
                        { text: "Vai, " + this._player.name + "!" }],
            this.startInput.bind(this));
    };
    Scene_PkmBattle.prototype.startInput = function() {
        this._phase = "input";
        this.hideMenus();
        this._commandWindow.show(); this._commandWindow.activate(); this._commandWindow.select(0);
        this._drawPrompt();
    };

    Scene_PkmBattle.prototype.update = function() {
        Scene_Base.prototype.update.call(this);
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
        // se a mochila (PKM_Bag) existir, escolhe entre as bolas que você possui
        if ($gameParty.pkmBalls) {
            const balls = $gameParty.pkmBalls();
            if (balls.length === 0) {
                this.showSteps([{ text: "Você não tem nenhuma Poké Bola!" }], this.startInput.bind(this));
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

    Scene_PkmBattle.prototype.buildMoveMessages = function(attacker, defender, move) {
        const md = PKM.Core.move(move.id);
        const name = md ? md.name : move.id;
        const tag = attacker === this._enemy ? " selvagem" : "";
        const msgs = [attacker.name + tag + " usou " + name + "!"];
        if (move.pp !== undefined && move.pp > 0) move.pp--;
        const acc = md ? md.accuracy : 100;
        if (acc !== 0 && Math.randomInt(100) >= acc) { msgs.push("Mas o ataque errou!"); return msgs; }
        if (!md || md.category === "Status" || md.power <= 0) {
            msgs.push("…mas o efeito ainda não foi implementado (Fase 5b)."); return msgs;
        }
        const calc = PKM.Battle.calcDamage(attacker, defender, move.id);
        if (calc.effectiveness === 0) { msgs.push("Não afeta " + defender.name + "…"); return msgs; }
        defender.takeDamage(calc.damage);
        if (calc.crit) msgs.push("Um acerto crítico!");
        if (calc.effectiveness > 1) msgs.push("Foi super eficaz!");
        else if (calc.effectiveness < 1) msgs.push("Não foi muito eficaz…");
        if (defender.isFainted()) {
            const dt = defender === this._enemy ? " selvagem" : "";
            msgs.push(defender.name + dt + " desmaiou!");
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
        if (!order[0][1].isFainted()) {
            msgs = msgs.concat(this.buildMoveMessages(order[1][0], order[1][1], order[1][2]));
        }
        this.showSteps(msgs.map(t => ({ text: t })), this.settleTurn.bind(this));
    };

    Scene_PkmBattle.prototype.settleTurn = function() {
        if (this._enemy.isFainted()) {
            this.awardExpAndFinish(() => this.endBattle());
        } else if (this._player.isFainted()) {
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
        const res = PKM.Battle.tryCapture(this._enemy, bonus, 1);
        const ballLabel = (PKM.Core.item && PKM.Core.item(ballName) && PKM.Core.item(ballName).name) || "Poké Ball";
        const steps = [{
            text: "Você jogou uma " + ballLabel + "!",
            fn: () => { if (consume && $gameParty.pkmLoseItem) $gameParty.pkmLoseItem(ballName, 1); }
        }];
        const shakes = res.success ? 3 : res.shakes;
        for (let i = 0; i < shakes; i++) steps.push({ text: "…" });
        if (res.success) {
            const dest = { v: null };
            steps.push({
                text: "Gotcha! " + this._enemy.name + " foi capturado!",
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
        const exp = PKM.Battle.expGain(this._enemy, 1);
        const res = winner.addExp(exp);
        const steps = [
            { text: "Você derrotou o " + this._enemy.name + " selvagem!" },
            { text: winner.name + " ganhou " + res.gained + " de Exp.!" }
        ];
        res.levels.forEach(lv => steps.push({ text: winner.name + " subiu para o nível " + lv.level + "!" }));
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

    //--- fim ------------------------------------------------------------------
    Scene_PkmBattle.prototype.endBattle = function() {
        $gameTemp.pkmWild = null;
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
