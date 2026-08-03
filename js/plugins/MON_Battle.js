//=============================================================================
// MON_Battle.js  — fórmulas de batalha/captura + cena 3v3 lado a lado
//=============================================================================
/*:
 * @target MZ
 * @plugindesc [MON v0.5] Batalha em times de até 3v3 lado a lado: dano por tipo/
 * STAB/crítico, status, troca, fuga e CAPTURA. Fórmulas puras em MON.Battle.
 * @author Pokémon Dimensions (port MZ)
 * @base MON_Core
 * @base MON_Monster
 * @base MON_Human
 * @base MON_Field
 * @orderAfter MON_Encounters
 *
 * @help MON_Battle.js
 *
 * Duas camadas independentes:
 *   1. MON.Battle.* — fórmulas puras (dano, status, captura, EXP, executeMove).
 *      Rodam headless e são consumidas por outros plugins e pelos testes.
 *   2. Scene_PkmBattle — casca de render e input. Toda a regra de campo vem de
 *      MON.Field e a resolução de golpe de MON.Battle.executeMove.
 *
 * Layout da cena: time do jogador à ESQUERDA, adversário à DIREITA, até 3
 * unidades por lado empilhadas verticalmente. Não existe arte de costas — os
 * dois lados usam img/monsters/front/ e o lado aliado é espelhado no Sprite.
 * O humano do jogador ocupa o slot 0 e aparece destacado no HUD.
 *
 * Entrada da cena:
 *   $gameTemp.monTrainer = {name, party, avatar?, money, introText, defeatText}
 *   $gameTemp.monFoes    = [unidades]   (time selvagem de 1 a 3)
 *   $gameTemp.monWild    = unidade      (encontro selvagem simples)
 * O time do jogador vem de $gameParty.monBattleTeam() (avatar + monstros).
 */

var MON = MON || {};
MON.Battle = MON.Battle || {};

(() => {
    "use strict";

    //=========================================================================
    // FÓRMULAS PURAS (testáveis sem render)
    //=========================================================================

    // dano de um golpe de dano. Retorna {damage, effectiveness, crit, stab}.
    MON.Battle.calcDamage = function(attacker, defender, moveId, opts = {}) {
        const md = MON.Core.move(moveId);
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
        const eff = MON.Core.typeMultiplier(md.type, defender.types());
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
    MON.Battle.tryCapture = function(wild, ballBonus = 1, statusBonus = 1) {
        const sp = wild.species();
        const catchRate = sp && sp.catchRate !== undefined ? sp.catchRate : 45;
        if (catchRate <= 0) return { success: false, shakes: 0 };
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
    MON.Battle.fasterFirst = function(monA, moveA, monB, moveB) {
        const pa = (MON.Core.move(moveA.id) || {}).priority || 0;
        const pb = (MON.Core.move(moveB.id) || {}).priority || 0;
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
    MON.Battle.MOVE_EFFECTS = {
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

    MON.Battle.statusImmune = function(target, status) {
        if (target.status) return true;             // já tem um status maior
        const types = target.types();
        if (status === "BRN" && types.includes("FIRE")) return true;
        if (status === "FRZ" && types.includes("ICE")) return true;
        if ((status === "PSN" || status === "TOX") && (types.includes("POISON") || types.includes("STEEL"))) return true;
        return false;
    };
    MON.Battle.applyStatus = function(target, status) {
        if (MON.Battle.statusImmune(target, status)) return { ok: false, messages: [] };
        target.status = status;
        if (status === "SLP") target._sleepTurns = 1 + Math.randomInt(3);
        if (status === "TOX") target._toxic = 1;
        return { ok: true, messages: [target.name + (STATUS_VERB[status] || " foi afetado!")] };
    };
    MON.Battle.applyStatChange = function(target, stat, delta) {
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
    MON.Battle.canAct = function(mon) {
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
    MON.Battle.accuracyCheck = function(attacker, defender, move) {
        const md = MON.Core.move(move.id);
        if (!md || md.accuracy === 0) return true;       // 0 = nunca erra
        const accStage = attacker.stageMult ? attacker.stageMult("acc") : 1;
        const evaStage = defender.stageMult ? defender.stageMult("eva") : 1;
        return Math.randomInt(100) < (md.accuracy * accStage / evaStage);
    };
    // dano residual de fim de turno (PSN/TOX/BRN). Retorna mensagens.
    MON.Battle.endOfTurnResidual = function(mon) {
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
    // (ex.: MON_Parts dropa uma peça do Medabot derrotado). fn -> [mensagens]
    MON.Battle._victoryHooks = [];
    MON.Battle.registerVictoryHook = function(fn) {
        if (typeof fn === "function") MON.Battle._victoryHooks.push(fn);
    };
    MON.Battle.runVictoryHooks = function(winner, defeated, isTrainer) {
        const msgs = [];
        for (const fn of MON.Battle._victoryHooks) {
            const out = fn(winner, defeated, isTrainer);
            if (Array.isArray(out)) msgs.push(...out);
            else if (typeof out === "string") msgs.push(out);
        }
        return msgs;
    };

    // efeitos que recaem sobre o próprio atacante: dreno, recuo, autodestruição.
    // Usado pelos golpes "Jibaku" da dimensão Bucky sem motor novo.
    MON.Battle.applySelfEffect = function(attacker, eff, damageDealt) {
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

    // aplica efeito de status/stat de um golpe. Retorna mensagens.
    MON.Battle.applyMoveEffect = function(eff, attacker, defender) {
        const out = [];
        const tgt = eff.target === "self" ? attacker : defender;
        if (eff.status) {
            const r = MON.Battle.applyStatus(tgt, eff.status);
            out.push(...(r.messages.length ? r.messages : ["Mas não teve efeito em " + tgt.name + "."]));
        }
        if (eff.stats) {
            for (const k in eff.stats) out.push(...MON.Battle.applyStatChange(tgt, k, eff.stats[k]));
        }
        return out;
    };

    // Executa um golpe de ponta a ponta e devolve as mensagens. É pura (não usa
    // cena), então o campo em times consegue resolver 6 unidades sem duplicar regra.
    // tags: {attacker, defender} — sufixos de nome, ex.: " selvagem".
    MON.Battle.executeMove = function(attacker, defender, move, tags = {}) {
        const md = MON.Core.move(move.id);
        const name = md ? md.name : move.id;
        const atkTag = tags.attacker || "";
        const defTag = tags.defender || "";
        const msgs = [];

        const ca = MON.Battle.canAct(attacker);
        msgs.push(...ca.messages);
        if (!ca.act) return msgs.length ? msgs : [attacker.name + " não pode agir."];

        msgs.push(attacker.name + atkTag + " usou " + name + "!");
        if (move.pp !== undefined && move.pp > 0) move.pp--;
        if (!defender || defender.isFainted()) { msgs.push("Mas não há alvo!"); return msgs; }
        if (!MON.Battle.accuracyCheck(attacker, defender, move)) { msgs.push("Mas o ataque errou!"); return msgs; }

        const eff = MON.Battle.MOVE_EFFECTS[move.id];
        const isStatus = !md || md.category === "Status" || md.power <= 0;
        if (isStatus) {
            if (eff) msgs.push(...MON.Battle.applyMoveEffect(eff, attacker, defender));
            else msgs.push("…mas o golpe ainda não tem efeito implementado.");
            return msgs;
        }

        const calc = MON.Battle.calcDamage(attacker, defender, move.id);
        if (calc.effectiveness === 0) { msgs.push("Não afeta " + defender.name + "…"); return msgs; }
        defender.takeDamage(calc.damage);
        if (calc.crit) msgs.push("Um acerto crítico!");
        if (calc.effectiveness > 1) msgs.push("Foi super eficaz!");
        else if (calc.effectiveness < 1) msgs.push("Não foi muito eficaz…");

        const selfMsgs = MON.Battle.applySelfEffect(attacker, eff, calc.damage);
        if (defender.isFainted()) {
            msgs.push(defender.name + defTag + " desmaiou!");
            return msgs.concat(selfMsgs);
        }
        msgs.push(...selfMsgs);
        if (attacker.isFainted()) return msgs;
        if (eff && eff.secondary) {
            const chance = eff.chance || (md ? md.effectChance : 0) || 0;
            if (chance > 0 && Math.randomInt(100) < chance) {
                const sec = Object.assign({ target: "foe" }, eff.secondary);
                msgs.push(...MON.Battle.applyMoveEffect(sec, attacker, defender));
            }
        }
        return msgs;
    };

    // chance de fuga (true = fugiu)
    MON.Battle.canEscape = function(playerSpe, enemySpe, attempts = 0) {
        if (playerSpe > enemySpe) return true;
        if (enemySpe <= 0) return true;
        const odds = (Math.floor((playerSpe * 128) / enemySpe) + 30 * attempts) % 256;
        return Math.randomInt(256) < odds;
    };

    // EXP ganha por derrotar um Pokémon (bonus 1.5 em treinadores)
    MON.Battle.expGain = function(faintedMon, participants = 1, bonus = 1) {
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

    const ALLY = MON.Field.ALLY;
    const FOE = MON.Field.FOE;
    const FRONT_DIR = "img/monsters/front/";
    const SHINY_DIR = "img/monsters/front_shiny/";

    // Layout: aliados à esquerda, inimigos à direita, 3 faixas empilhadas.
    const SLOT_TOP = 6;
    const SLOT_H = 108;
    const FIELD_H = SLOT_TOP + SLOT_H * 3;
    const PANEL_W = 250;
    const PANEL_H = 88;
    const ART_BOX = 96;
    const BAND_Y = 336;
    const BAND_H = 144;
    const MSG_Y = 480;
    const MSG_H = 144;

    const STATUS_COLOR = {
        PSN: "#a040a0", TOX: "#a040a0", BRN: "#f08030",
        PAR: "#f8d030", SLP: "#8888a0", FRZ: "#98d8d8"
    };

    const isHuman = (unit) => !!(MON.Human && MON.Human.isHuman(unit));

    window.Scene_PkmBattle = function() { this.initialize(...arguments); };
    Scene_PkmBattle.prototype = Object.create(Scene_Base.prototype);
    Scene_PkmBattle.prototype.constructor = Scene_PkmBattle;

    //--- construção -----------------------------------------------------------
    Scene_PkmBattle.prototype.create = function() {
        Scene_Base.prototype.create.call(this);
        this._field = this.buildField();
        this._participants = [];
        this._defeated = [];
        this._down = [];
        this._endReason = null;
        this._focusUnit = null;
        this._hoverUnit = null;
        MON.Field.activeUnits(this._field, ALLY).forEach(u => this.notePartaker(u));
        this.createBackground();
        this.createFieldSprites();
        this.createFlash();
        this.createWindowLayer();
        this.createAllWindows();
        this.startBattle();
    };

    // $gameTemp.monFoes (time) tem precedência; monWild mantém o encontro 1x1.
    Scene_PkmBattle.prototype.buildField = function() {
        const trainer = $gameTemp.monTrainer || null;
        const allies = $gameParty.monBattleTeam
            ? $gameParty.monBattleTeam()
            : $gameParty.monParty().filter(p => p && !p.isFainted());
        let foes;
        if (trainer) {
            const rival = trainer.avatar || trainer.human;
            foes = (rival ? [rival] : []).concat(trainer.party || []);
        } else if (Array.isArray($gameTemp.monFoes) && $gameTemp.monFoes.length) {
            foes = $gameTemp.monFoes.slice();
        } else {
            foes = [$gameTemp.monWild];
        }
        return MON.Field.create({ allies, foes, isTrainer: !!trainer, trainer });
    };

    Scene_PkmBattle.prototype.createBackground = function() {
        const bmp = new Bitmap(Graphics.width, Graphics.height);
        bmp.gradientFillRect(0, 0, Graphics.width, Graphics.height, "#bfe9ff", "#7fb24d", true);
        this._bg = new Sprite(bmp);
        this.addChild(this._bg);
    };

    Scene_PkmBattle.prototype.createFlash = function() {
        const bmp = new Bitmap(Graphics.width, Graphics.height);
        bmp.fillRect(0, 0, Graphics.width, Graphics.height, "#ffffff");
        this._flash = new Sprite(bmp);
        this.addChild(this._flash);
    };

    Scene_PkmBattle.prototype.createFieldSprites = function() {
        this._views = [];
        for (const side of [ALLY, FOE]) {
            for (let i = 0; i < MON.Field.MAX_ACTIVE; i++) {
                const sprite = new Sprite();
                sprite.anchor.x = 0.5;
                sprite.anchor.y = 1;
                sprite.visible = false;
                this.addChild(sprite);
                this._views.push({ side, index: i, sprite, unit: null, ready: false, frames: 1, size: 0, tick: 0 });
            }
        }
        this._hud = new Sprite(new Bitmap(Graphics.width, FIELD_H));
        this.addChild(this._hud);
    };

    Scene_PkmBattle.prototype.createAllWindows = function() {
        this._msgWindow = new Window_Base(new Rectangle(0, MSG_Y, Graphics.boxWidth, MSG_H));
        this.addWindow(this._msgWindow);

        this._cmdWindow = new Window_BattleCmd(new Rectangle(456, BAND_Y, 360, BAND_H));
        this._cmdWindow.setHandler("fight", this.onFight.bind(this));
        this._cmdWindow.setHandler("ball", this.onBall.bind(this));
        this._cmdWindow.setHandler("item", this.onItem.bind(this));
        this._cmdWindow.setHandler("switch", this.onSwitch.bind(this));
        this._cmdWindow.setHandler("run", this.onRun.bind(this));
        this._cmdWindow.setHandler("cancel", this.onCommandCancel.bind(this));
        this.addWindow(this._cmdWindow);

        this._moveWindow = new Window_BattleMoves(new Rectangle(0, BAND_Y, 456, BAND_H));
        this._moveWindow.setHandler("ok", this.onMoveOk.bind(this));
        this._moveWindow.setHandler("cancel", this.onMoveCancel.bind(this));
        this.addWindow(this._moveWindow);

        this._targetWindow = new Window_BattleUnits(new Rectangle(456, BAND_Y, 360, BAND_H));
        this.addWindow(this._targetWindow);

        this._listWindow = new Window_BattleUnits(new Rectangle(0, BAND_Y, Graphics.boxWidth, BAND_H));
        this.addWindow(this._listWindow);

        this._entryWindow = new Window_BattleEntries(new Rectangle(0, BAND_Y, 456, BAND_H));
        this.addWindow(this._entryWindow);

        this._yesnoWindow = new Window_BattleYesNo(new Rectangle(Graphics.boxWidth - 240, BAND_Y, 240, BAND_H));
        this._yesnoWindow.setHandler("yes", this.onForgetYes.bind(this));
        this._yesnoWindow.setHandler("no", this.onForgetNo.bind(this));
        this.addWindow(this._yesnoWindow);

        this._forgetWindow = new Window_BattleMoves(new Rectangle(0, BAND_Y, 456, BAND_H));
        this._forgetWindow.setHandler("ok", this.onForgetOk.bind(this));
        this._forgetWindow.setHandler("cancel", this.onForgetCancel.bind(this));
        this.addWindow(this._forgetWindow);

        this.hideMenus();
        this.refreshField();
    };

    Scene_PkmBattle.prototype.hideMenus = function() {
        for (const win of [this._cmdWindow, this._moveWindow, this._targetWindow, this._listWindow,
            this._entryWindow, this._yesnoWindow, this._forgetWindow]) {
            if (win) { win.hide(); win.deactivate(); }
        }
    };

    //--- render do campo ------------------------------------------------------
    Scene_PkmBattle.prototype.slotY = function(i) { return SLOT_TOP + i * SLOT_H; };
    Scene_PkmBattle.prototype.panelX = function(side) {
        return side === ALLY ? 8 : Graphics.boxWidth - 8 - PANEL_W;
    };
    // faixas mais ao fundo recuam um pouco para dar sensação de formação
    Scene_PkmBattle.prototype.artX = function(side, i) {
        const inner = 16 + PANEL_W + ART_BOX / 2;
        return side === ALLY ? inner + i * 16 : Graphics.boxWidth - inner - i * 16;
    };

    Scene_PkmBattle.prototype.refreshField = function() {
        for (const view of this._views) {
            const unit = MON.Field.slots(this._field, view.side)[view.index] || null;
            if (view.unit !== unit) this.loadArt(view, unit);
            view.sprite.visible = !!unit;
            view.sprite.opacity = unit && unit.isFainted() ? 90 : 255;
        }
        this.drawHud();
    };

    // Bitmap.blt não espelha: o lado aliado usa scale.x negativo com anchor 0.5,
    // assim os dois times se encaram reaproveitando a arte de frente.
    Scene_PkmBattle.prototype.loadArt = function(view, unit) {
        const sprite = view.sprite;
        view.unit = unit;
        view.ready = false;
        view.tick = 0;
        if (!unit) { sprite.bitmap = null; return; }
        sprite.bitmap = MON.Core.loadSprite(unit.shiny ? SHINY_DIR : FRONT_DIR, unit.frontImageName());
        sprite.setFrame(0, 0, 0, 0);
        sprite.x = this.artX(view.side, view.index);
        sprite.y = this.slotY(view.index) + SLOT_H - 8;
    };

    Scene_PkmBattle.prototype.updateArt = function() {
        for (const view of this._views) {
            if (!view.unit || !view.sprite.bitmap) continue;
            if (!view.ready) {
                if (view.sprite.bitmap.isError()) view.sprite.bitmap = this.placeholderBitmap(view.unit);
                else if (!view.sprite.bitmap.isReady()) continue;
                this.settleArt(view);
            } else if (view.frames > 1) {
                view.tick++;
                if (view.tick % 8 === 0) {
                    const frame = Math.floor(view.tick / 8) % view.frames;
                    view.sprite.setFrame(frame * view.size, 0, view.size, view.size);
                }
            }
        }
    };

    // as folhas de sprite do repo são tiras horizontais de quadros quadrados
    Scene_PkmBattle.prototype.settleArt = function(view) {
        const bmp = view.sprite.bitmap;
        const size = bmp.height || 1;
        const scale = Math.min(1, ART_BOX / size);
        view.size = size;
        view.frames = Math.max(1, Math.round(bmp.width / size));
        view.ready = true;
        view.sprite.setFrame(0, 0, size, size);
        view.sprite.scale.y = scale;
        view.sprite.scale.x = view.side === ALLY ? -scale : scale;
    };

    Scene_PkmBattle.prototype.placeholderBitmap = function(unit) {
        const size = 88;
        const bmp = new Bitmap(size, size);
        const human = isHuman(unit);
        bmp.fillRect(0, 0, size, size, human ? "#4a3d73" : "#33506b");
        bmp.fillRect(3, 3, size - 6, size - 6, human ? "#8b78c4" : "#6d90b5");
        bmp.fontFace = $gameSystem.mainFontFace();
        bmp.fontSize = 34;
        bmp.textColor = "#ffffff";
        bmp.outlineColor = "rgba(0,0,0,0.7)";
        bmp.outlineWidth = 4;
        bmp.drawText(String(unit.name || "?").substring(0, 2).toUpperCase(), 0, size / 2 - 22, size, 44, "center");
        return bmp;
    };

    Scene_PkmBattle.prototype.drawHud = function() {
        const bmp = this._hud.bitmap;
        bmp.clear();
        bmp.fontFace = $gameSystem.mainFontFace();
        for (const side of [ALLY, FOE]) {
            const slots = MON.Field.slots(this._field, side);
            for (let i = 0; i < MON.Field.MAX_ACTIVE; i++) {
                if (slots[i]) this.drawUnitPanel(bmp, slots[i], this.panelX(side), this.slotY(i) + 10, side);
            }
        }
    };

    Scene_PkmBattle.prototype.strokeRect = function(bmp, x, y, w, h, color) {
        bmp.fillRect(x, y, w, 2, color);
        bmp.fillRect(x, y + h - 2, w, 2, color);
        bmp.fillRect(x, y, 2, h, color);
        bmp.fillRect(x + w - 2, y, 2, h, color);
    };

    // o humano ganha cor de destaque e a classe escrita: é a unidade que você é
    Scene_PkmBattle.prototype.drawUnitPanel = function(bmp, unit, x, y, side) {
        const human = isHuman(unit);
        const accent = human ? "#ffd75e" : side === ALLY ? "#8fd0ff" : "#ff9a8f";
        const rate = unit.hpRate();
        const bx = x + 10;
        const bw = PANEL_W - 20;
        bmp.paintOpacity = unit.isFainted() ? 110 : 255;
        bmp.fillRect(x, y, PANEL_W, PANEL_H, "rgba(10,16,30,0.74)");
        bmp.fillRect(x, y, PANEL_W, 4, accent);
        if (unit === this._focusUnit) this.strokeRect(bmp, x - 3, y - 3, PANEL_W + 6, PANEL_H + 6, "#ffffff");
        if (unit === this._hoverUnit) this.strokeRect(bmp, x - 3, y - 3, PANEL_W + 6, PANEL_H + 6, "#ff5a5a");
        bmp.outlineColor = "rgba(0,0,0,0.85)";
        bmp.outlineWidth = 4;
        bmp.fontSize = 20;
        bmp.textColor = human ? accent : "#ffffff";
        bmp.drawText(unit.name + unit.genderSymbol(), bx, y + 6, bw - 74, 26, "left");
        bmp.textColor = "#ffffff";
        bmp.drawText("Nv." + unit.level, x + PANEL_W - 82, y + 6, 72, 26, "right");
        bmp.fillRect(bx, y + 38, bw, 12, "#202430");
        bmp.fillRect(bx + 1, y + 39, Math.floor((bw - 2) * rate), 10,
            rate > 0.5 ? "#78c850" : rate > 0.2 ? "#f8d030" : "#f85038");
        bmp.fontSize = 16;
        let fx = bx;
        if (unit.status) {
            bmp.fillRect(fx, y + 56, 48, 20, STATUS_COLOR[unit.status] || "#888888");
            bmp.drawText(unit.status, fx, y + 55, 48, 22, "center");
            fx += 54;
        }
        if (human) bmp.drawText(unit.className, fx, y + 55, 100, 22, "left");
        if (side === ALLY) bmp.drawText(unit.hp + " / " + unit.maxHp, bx + bw - 96, y + 55, 96, 22, "right");
        bmp.paintOpacity = 255;
    };

    //--- mensagens ------------------------------------------------------------
    Scene_PkmBattle.prototype._drawMessage = function(text) {
        this._msgWindow.contents.clear();
        this._msgWindow.resetFontSettings();
        this._msgWindow.drawTextEx(text, 12, 8, this._msgWindow.innerWidth - 24);
    };

    // fila de passos: cada passo = {text, fn?}
    Scene_PkmBattle.prototype.showSteps = function(steps, cb) {
        this._stepQueue = steps.slice();
        this._afterSteps = cb || (() => {});
        this._phase = "message";
        this.hideMenus();
        this._playNextStep();
    };
    Scene_PkmBattle.prototype.queueStep = function(text) {
        if (this._stepQueue) this._stepQueue.push({ text });
    };
    Scene_PkmBattle.prototype._playNextStep = function() {
        if (this._stepQueue.length === 0) {
            const cb = this._afterSteps;
            this._afterSteps = null;
            this._phase = "settle";
            cb();
            return;
        }
        const step = this._stepQueue.shift();
        if (step.fn) step.fn();
        this.refreshField();
        this._drawMessage(step.text || "");
    };

    Scene_PkmBattle.prototype.update = function() {
        Scene_Base.prototype.update.call(this);
        if (this._flash && this._flash.opacity > 0) this._flash.opacity -= 16;
        this.updateArt();
        if (this._phase === "message" &&
            (Input.isTriggered("ok") || Input.isTriggered("cancel") || TouchInput.isTriggered())) {
            this._playNextStep();
        }
    };

    //--- abertura -------------------------------------------------------------
    Scene_PkmBattle.prototype.foeTag = function() { return this._field.isTrainer ? "" : " selvagem"; };
    Scene_PkmBattle.prototype.tagOf = function(unit) {
        return MON.Field.sideOf(this._field, unit) === FOE ? this.foeTag() : "";
    };
    Scene_PkmBattle.prototype.notePartaker = function(unit) {
        if (unit && !this._participants.includes(unit)) this._participants.push(unit);
    };
    // humano não entra na Pokédex nem tem cry
    Scene_PkmBattle.prototype.noteFoeSeen = function(unit) {
        if (!isHuman(unit) && $gameSystem.monSetSeen) $gameSystem.monSetSeen(unit.dexNumber);
    };

    Scene_PkmBattle.prototype.startBattle = function() {
        const foes = MON.Field.activeUnits(this._field, FOE);
        foes.forEach(f => this.noteFoeSeen(f));
        if (MON.Audio) {
            MON.Audio.playBattleBgm(this._field.isTrainer);
            const criable = foes.find(f => !isHuman(f));
            if (criable) MON.Audio.playCry(criable.dexNumber);
        }
        const foeNames = foes.map(u => u.name).join(", ");
        const allyNames = MON.Field.activeUnits(this._field, ALLY).map(u => u.name).join(", ");
        const steps = [];
        if (this._field.isTrainer) {
            const trainer = this._field.trainer;
            steps.push({ text: trainer.name + " quer batalhar!" });
            if (trainer.introText) steps.push({ text: trainer.introText });
            steps.push({ text: trainer.name + " enviou " + foeNames + "!" });
        } else {
            steps.push({
                text: foes.length > 1
                    ? "Monstros selvagens apareceram: " + foeNames + "!"
                    : "Um " + foeNames + " selvagem apareceu!"
            });
        }
        steps.push({ text: "Vai, " + allyNames + "!" });
        this.showSteps(steps, () => this.startInput());
    };

    //--- entrada de ações (uma por unidade viva do jogador) --------------------
    Scene_PkmBattle.prototype.startInput = function() {
        if (MON.Field.outcome(this._field)) return this.concludeByOutcome();
        this._inputUnits = MON.Field.activeUnits(this._field, ALLY);
        this._actions = [];
        this._inputIndex = 0;
        this.nextInput();
    };
    Scene_PkmBattle.prototype.actor = function() { return this._inputUnits[this._inputIndex] || null; };

    Scene_PkmBattle.prototype.nextInput = function() {
        if (this._inputIndex >= this._inputUnits.length) return this.beginResolve();
        this._cmdWindow.setBackEnabled(this._inputIndex > 0);
        this.openCommand();
    };

    Scene_PkmBattle.prototype.openCommand = function() {
        this._phase = "input";
        this.hideMenus();
        this._focusUnit = this.actor();
        this._hoverUnit = null;
        this._cmdWindow.show();
        this._cmdWindow.activate();
        this._cmdWindow.select(0);
        this.refreshField();
        this._drawMessage("O que " + this.actor().name + " fará?");
    };

    Scene_PkmBattle.prototype.commit = function(action) {
        this._actions[this._inputIndex] = action;
        this._inputIndex++;
        this._focusUnit = null;
        this.nextInput();
    };

    // voltar atrás: refaz a escolha da unidade anterior
    Scene_PkmBattle.prototype.onCommandCancel = function() {
        if (this._inputIndex <= 0) { SoundManager.playBuzzer(); this._cmdWindow.activate(); return; }
        this._inputIndex--;
        this._actions.length = this._inputIndex;
        this._cmdWindow.setBackEnabled(this._inputIndex > 0);
        this.openCommand();
    };

    Scene_PkmBattle.prototype.warn = function(text) {
        this.showSteps([{ text }], () => this.openCommand());
    };

    //--- seleção de alvo ------------------------------------------------------
    Scene_PkmBattle.prototype.openTargets = function(onOk, onCancel) {
        const targets = MON.Field.validTargets(this._field, this.actor());
        const back = onCancel || (() => this.openCommand());
        if (!targets.length) { SoundManager.playBuzzer(); back(); return; }
        if (targets.length === 1) { onOk(targets[0]); return; }
        const close = () => {
            this._hoverUnit = null;
            this._targetWindow.hide();
            this._targetWindow.deactivate();
        };
        this._targetWindow.setUnits(targets);
        this._targetWindow.setCursorCallback(unit => { this._hoverUnit = unit; this.drawHud(); });
        this._targetWindow.setHandler("ok", () => {
            const target = this._targetWindow.currentUnit();
            close();
            onOk(target);
        });
        this._targetWindow.setHandler("cancel", () => { close(); back(); });
        this._targetWindow.show();
        this._targetWindow.activate();
        this._targetWindow.select(0);
        this._phase = "selectTarget";
        this._drawMessage("Alvo de " + this.actor().name + "?");
    };

    //--- comandos -------------------------------------------------------------
    Scene_PkmBattle.prototype.onFight = function() {
        this._cmdWindow.hide();
        this._cmdWindow.deactivate();
        const unit = this.actor();
        // sem PP em nenhum golpe o jogador nao teria acao para commitar e a
        // batalha travaria: Struggle e a saida, igual a IA
        if (!unit.moves.some(m => m.pp === undefined || m.pp > 0)) {
            const struggle = { id: "STRUGGLE", pp: 1, ppMax: 1 };
            return this.openTargets(target => this.commit({ unit, kind: "move", move: struggle, target }));
        }
        this._moveWindow.setUnit(unit);
        this._moveWindow.show();
        this._moveWindow.activate();
        this._moveWindow.select(0);
        this._phase = "selectMove";
    };
    Scene_PkmBattle.prototype.onMoveCancel = function() {
        this._moveWindow.hide();
        this._moveWindow.deactivate();
        this.openCommand();
    };
    Scene_PkmBattle.prototype.onMoveOk = function() {
        const unit = this.actor();
        const move = unit.moves[this._moveWindow.index()];
        if (!move || move.pp <= 0) { SoundManager.playBuzzer(); this._moveWindow.activate(); return; }
        this._moveWindow.hide();
        this._moveWindow.deactivate();
        this.openTargets(target => this.commit({ unit, kind: "move", move, target }));
    };

    Scene_PkmBattle.prototype.onBall = function() {
        this._cmdWindow.hide();
        this._cmdWindow.deactivate();
        if (this._field.isTrainer) return this.warn("Não dá para capturar o monstro de outro treinador!");
        // uma tentativa por turno: com 3 aliados seriam 3 rolagens no mesmo alvo
        if (this._actions.some(a => a && a.kind === "capture")) {
            return this.warn("Já foi arremessado algo neste turno!");
        }
        if (!$gameParty.monBalls) return this.chooseCaptureTarget("POKEBALL", false);
        const targets = MON.Field.validTargets(this._field, this.actor());
        let balls = $gameParty.monBalls();
        if (MON.Franchise) {
            balls = balls.filter(b => targets.some(t => MON.Franchise.itemWorksOn(b.name, t)));
        }
        if (!balls.length) return this.warn("Você não tem um item de captura que sirva aqui!");
        this._entryWindow.setEntries(balls);
        this._entryWindow.setHandler("ok", this.onBallOk.bind(this));
        this._entryWindow.setHandler("cancel", this.onEntryCancel.bind(this));
        this._entryWindow.show();
        this._entryWindow.activate();
        this._entryWindow.select(0);
        this._phase = "selectBall";
        this._drawMessage("Qual item de captura usar?");
    };
    Scene_PkmBattle.prototype.onBallOk = function() {
        const entry = this._entryWindow.currentEntry();
        this._entryWindow.hide();
        this._entryWindow.deactivate();
        if (!entry) return this.openCommand();
        this.chooseCaptureTarget(entry.name, true);
    };
    Scene_PkmBattle.prototype.onEntryCancel = function() {
        this._entryWindow.hide();
        this._entryWindow.deactivate();
        this.openCommand();
    };
    Scene_PkmBattle.prototype.chooseCaptureTarget = function(ball, consume) {
        const unit = this.actor();
        this.openTargets(target => {
            const rule = MON.Franchise ? MON.Franchise.captureRule(target, ball) : { allowed: true };
            if (!rule.allowed) return this.warn(rule.reason);
            this.commit({ unit, kind: "capture", ball, consume, target });
        }, () => this.onBall());
    };

    Scene_PkmBattle.prototype.onItem = function() {
        this._cmdWindow.hide();
        this._cmdWindow.deactivate();
        const meds = $gameParty.monPocket ? $gameParty.monPocket(2) : [];
        if (!meds.length) return this.warn("Você não tem remédios!");
        this._entryWindow.setEntries(meds);
        this._entryWindow.setHandler("ok", this.onItemOk.bind(this));
        this._entryWindow.setHandler("cancel", this.onEntryCancel.bind(this));
        this._entryWindow.show();
        this._entryWindow.activate();
        this._entryWindow.select(0);
        this._phase = "selectItem";
        this._drawMessage("Qual item usar?");
    };
    Scene_PkmBattle.prototype.onItemOk = function() {
        const entry = this._entryWindow.currentEntry();
        this._entryWindow.hide();
        this._entryWindow.deactivate();
        if (!entry) return this.openCommand();
        const unit = this.actor();
        const side = MON.Field.side(this._field, ALLY);
        this.openUnitList(side.active.filter(Boolean).concat(side.bench),
            target => this.commit({ unit, kind: "item", item: entry.name, target }),
            () => this.onItem(),
            "Usar " + entry.data.name + " em quem?");
    };

    Scene_PkmBattle.prototype.onSwitch = function() {
        this._cmdWindow.hide();
        this._cmdWindow.deactivate();
        const bench = MON.Field.benchReady(this._field, ALLY);
        if (!bench.length) return this.warn("Não há ninguém na reserva!");
        const unit = this.actor();
        this.openUnitList(bench,
            replacement => this.commit({ unit, kind: "switch", replacement }),
            () => this.openCommand(),
            "Quem entra no lugar de " + unit.name + "?");
    };

    Scene_PkmBattle.prototype.onRun = function() {
        this._cmdWindow.hide();
        this._cmdWindow.deactivate();
        if (this._field.isTrainer) return this.warn("Não dá para fugir de uma batalha de treinador!");
        this.commit({ unit: this.actor(), kind: "run" });
    };

    Scene_PkmBattle.prototype.openUnitList = function(units, onOk, onCancel, prompt) {
        const close = () => { this._listWindow.hide(); this._listWindow.deactivate(); };
        this._listWindow.setUnits(units);
        this._listWindow.setCursorCallback(null);
        this._listWindow.setHandler("ok", () => {
            const unit = this._listWindow.currentUnit();
            close();
            if (unit) onOk(unit); else onCancel();
        });
        this._listWindow.setHandler("cancel", () => { close(); onCancel(); });
        this._listWindow.show();
        this._listWindow.activate();
        this._listWindow.select(0);
        this._phase = "selectUnit";
        this._drawMessage(prompt);
    };

    //--- resolução do turno ---------------------------------------------------
    Scene_PkmBattle.prototype.beginResolve = function() {
        this._focusUnit = null;
        this.hideMenus();
        const foeActions = MON.Field.activeUnits(this._field, FOE)
            .map(unit => MON.Field.pickAction(this._field, unit))
            .filter(Boolean);
        this._order = MON.Field.turnOrder(this._actions.filter(Boolean).concat(foeActions));
        this._phase = "resolve";
        this.resolveNext();
    };

    Scene_PkmBattle.prototype.onField = function(unit) {
        const side = MON.Field.sideOf(this._field, unit);
        return !!side && MON.Field.slots(this._field, side).includes(unit);
    };

    Scene_PkmBattle.prototype.resolveNext = function() {
        if (this._endReason) return this.endBattle();
        if (MON.Field.outcome(this._field)) return this.endOfTurn();
        const action = this._order.shift();
        if (!action) return this.endOfTurn();
        if (action.unit.isFainted() || !this.onField(action.unit)) return this.resolveNext();
        const steps = this.performAction(action);
        if (!steps.length) return this.resolveNext();
        this.showSteps(steps, () => this.resolveNext());
    };

    Scene_PkmBattle.prototype.performAction = function(action) {
        const unit = action.unit;
        let steps = [];
        if (action.kind === "capture") steps = this.captureSteps(action);
        else if (action.kind === "item") steps = this.itemSteps(action);
        else if (action.kind === "switch") steps = this.switchSteps(action);
        else if (action.kind === "run") steps = this.runSteps(action);
        else steps = this.moveSteps(action);
        this.noteCasualties(unit);
        return steps;
    };

    Scene_PkmBattle.prototype.moveSteps = function(action) {
        const unit = action.unit;
        const target = MON.Field.resolveTarget(this._field, unit, action.target);
        if (!target) return [{ text: unit.name + " não encontrou um alvo." }];
        return MON.Battle.executeMove(unit, target, action.move, {
            attacker: this.tagOf(unit), defender: this.tagOf(target)
        }).map(text => ({ text }));
    };

    Scene_PkmBattle.prototype.itemSteps = function(action) {
        const label = (MON.Core.item(action.item) || {}).name || action.item;
        const res = MON.Items.useOnMonster(action.item, action.target);
        if (res.ok && $gameParty.monLoseItem) $gameParty.monLoseItem(action.item, 1);
        return [{ text: action.unit.name + " usou " + label + "." }, { text: res.message }];
    };

    Scene_PkmBattle.prototype.switchSteps = function(action) {
        if (!MON.Field.switchUnit(this._field, ALLY, action.unit, action.replacement)) {
            return [{ text: action.replacement.name + " não pode entrar agora." }];
        }
        this.notePartaker(action.replacement);
        return [{ text: action.unit.name + ", volte!" }, { text: "Vai, " + action.replacement.name + "!" }];
    };

    Scene_PkmBattle.prototype.runSteps = function(action) {
        const foes = MON.Field.activeUnits(this._field, FOE);
        const fastest = foes.reduce((mx, f) => Math.max(mx, MON.Field.unitSpeed(f)), 0);
        const escaped = MON.Battle.canEscape(MON.Field.unitSpeed(action.unit), fastest, this._field.runAttempts);
        this._field.runAttempts++;
        if (!escaped) return [{ text: "Não conseguiu fugir!" }];
        this._endReason = "escape";
        return [{ text: "Você fugiu em segurança!" }];
    };

    Scene_PkmBattle.prototype.captureSteps = function(action) {
        const target = MON.Field.resolveTarget(this._field, action.unit, action.target);
        if (!target) return [{ text: "Não há alvo para capturar." }];
        if (MON.Franchise) {
            const rule = MON.Franchise.captureRule(target, action.ball);
            if (!rule.allowed) return [{ text: rule.reason }];
        }
        const bonus = MON.Items ? MON.Items.ballBonus(action.ball) : 1;
        const res = MON.Battle.tryCapture(target, bonus, 1);
        const spend = action.consume &&
            (!MON.Items || !MON.Items.isConsumedOnThrow || MON.Items.isConsumedOnThrow(action.ball));
        const steps = [{
            text: MON.Franchise
                ? MON.Franchise.throwText(target, action.ball)
                : "Você jogou uma " + ((MON.Core.item(action.ball) || {}).name || "Poké Ball") + "!",
            fn: () => { if (spend && $gameParty.monLoseItem) $gameParty.monLoseItem(action.ball, 1); }
        }];
        const shakes = res.success ? 3 : res.shakes;
        for (let i = 0; i < shakes; i++) steps.push({ text: "…" });
        if (!res.success) {
            steps.push({ text: res.shakes >= 3 ? "Ah! Quase! Faltou pouco!" : "Oh não! O monstro escapou!" });
            return steps;
        }
        steps.push({
            text: MON.Franchise
                ? MON.Franchise.successText(target, action.ball)
                : "Gotcha! " + target.name + " foi capturado!",
            fn: () => {
                $gameSystem.monSetCaught(target.dexNumber);
                if (target.healStatusOnly) target.healStatusOnly();
                this.removeFromField(target);
                if ($gameParty.monAdd(target) === "storage") this.queueStep(target.name + " foi enviado ao PC.");
            }
        });
        return steps;
    };

    // capturado sai do campo sem desmaiar: não vale EXP nem conta como derrota
    Scene_PkmBattle.prototype.removeFromField = function(unit) {
        const sideId = MON.Field.sideOf(this._field, unit);
        if (!sideId) return;
        const side = MON.Field.side(this._field, sideId);
        const slot = side.active.indexOf(unit);
        if (slot >= 0) side.active[slot] = null;
        const benched = side.bench.indexOf(unit);
        if (benched >= 0) side.bench.splice(benched, 1);
    };

    // registra quem caiu: vitórias/derrotas alimentam as condições de evolução
    Scene_PkmBattle.prototype.noteCasualties = function(actor) {
        for (const unit of MON.Field.allUnits(this._field)) {
            const index = this._down.indexOf(unit);
            if (!unit.isFainted()) {
                if (index >= 0) this._down.splice(index, 1);
                continue;
            }
            if (index >= 0) continue;
            this._down.push(unit);
            if (MON.Field.sideOf(this._field, unit) === FOE) {
                const killer = actor && MON.Field.sideOf(this._field, actor) === ALLY ? actor : null;
                this._defeated.push({ unit, killer });
                if (killer && killer.recordWin) killer.recordWin(unit);
            } else if (unit.recordFaint) {
                unit.recordFaint();
            }
        }
    };

    //--- fim de turno ---------------------------------------------------------
    Scene_PkmBattle.prototype.endOfTurn = function() {
        const living = MON.Field.activeUnits(this._field, ALLY)
            .concat(MON.Field.activeUnits(this._field, FOE))
            .sort((a, b) => MON.Field.unitSpeed(b) - MON.Field.unitSpeed(a));
        const steps = [];
        for (const unit of living) {
            MON.Battle.endOfTurnResidual(unit).forEach(text => steps.push({ text }));
        }
        this.noteCasualties(null);
        this._field.turn++;
        this.showSteps(steps, () => this.fillSlots());
    };

    Scene_PkmBattle.prototype.fillSlots = function() {
        if (MON.Field.outcome(this._field)) return this.concludeByOutcome();
        const steps = [];
        for (const side of [ALLY, FOE]) {
            for (const change of MON.Field.fillEmptySlots(this._field, side)) {
                const unit = change.in;
                if (side === ALLY) {
                    this.notePartaker(unit);
                    steps.push({ text: "Vai, " + unit.name + "!" });
                } else {
                    this.noteFoeSeen(unit);
                    steps.push({
                        text: this._field.isTrainer
                            ? this._field.trainer.name + " enviou " + unit.name + "!"
                            : "Outro " + unit.name + " selvagem entrou na luta!"
                    });
                }
            }
        }
        this.showSteps(steps, () => this.concludeByOutcome());
    };

    Scene_PkmBattle.prototype.concludeByOutcome = function() {
        const outcome = MON.Field.outcome(this._field);
        if (outcome === "win") return this.onVictory();
        if (outcome === "lose") return this.onDefeat();
        this.startInput();
    };

    //--- vitória: EXP, golpes e evolução de todos os participantes vivos -------
    Scene_PkmBattle.prototype.onVictory = function() {
        if (MON.Audio) MON.Audio.playVictory(this._field.isTrainer);
        const winners = this._participants.filter(u => !u.isFainted());
        const bonus = this._field.isTrainer ? 1.5 : 1;
        const share = Math.max(1, winners.length);
        const exp = this._defeated.reduce((sum, e) => sum + MON.Battle.expGain(e.unit, share, bonus), 0);
        const steps = [];
        for (const entry of this._defeated) {
            MON.Battle.runVictoryHooks(entry.killer || winners[0] || null, entry.unit, this._field.isTrainer)
                .forEach(text => steps.push({ text }));
        }
        this._growthQueue = exp > 0 ? winners.map(unit => ({ unit, exp })) : [];
        this._afterGrowth = () => (this._field.isTrainer ? this.trainerDefeated() : this.endBattle());
        this.showSteps(steps, () => this.processGrowth());
    };

    Scene_PkmBattle.prototype.processGrowth = function() {
        if (!this._growthQueue.length) {
            const cb = this._afterGrowth;
            this._afterGrowth = null;
            return cb();
        }
        const job = this._growthQueue.shift();
        const unit = job.unit;
        this._expWinner = unit;
        const res = unit.addExp(job.exp);
        const steps = [{ text: unit.name + " ganhou " + res.gained + " de Exp.!" }];
        res.levels.forEach(lv => steps.push({ text: unit.name + " subiu para o nível " + lv.level + "!" }));
        this._learnQueue = res.levels.reduce((acc, lv) => acc.concat(lv.learnable), []);
        this.showSteps(steps, () => this.processNextLearn());
    };

    Scene_PkmBattle.prototype.processNextLearn = function() {
        const winner = this._expWinner;
        if (!this._learnQueue || this._learnQueue.length === 0) return this.evolutionStep();
        const moveId = this._learnQueue.shift();
        if (winner.knowsMove(moveId)) return this.processNextLearn();
        const md = MON.Core.move(moveId);
        const name = md ? md.name : moveId;
        if (winner.moves.length < 4) {
            winner.learnMove(moveId);
            this.showSteps([{ text: winner.name + " aprendeu " + name + "!" }], () => this.processNextLearn());
        } else {
            this._pendingLearn = { moveId, name };
            this.showSteps([{ text: winner.name + " quer aprender " + name + ", mas já conhece 4 golpes." }],
                () => this.openForgetPrompt());
        }
    };

    Scene_PkmBattle.prototype.openForgetPrompt = function() {
        this._phase = "learn";
        this.hideMenus();
        this._drawMessage("Esquecer um golpe para aprender " + this._pendingLearn.name + "?");
        this._yesnoWindow.show();
        this._yesnoWindow.activate();
        this._yesnoWindow.select(0);
    };
    Scene_PkmBattle.prototype.onForgetYes = function() {
        this._yesnoWindow.hide();
        this._yesnoWindow.deactivate();
        this._forgetWindow.setUnit(this._expWinner);
        this._forgetWindow.show();
        this._forgetWindow.activate();
        this._forgetWindow.select(0);
        this._phase = "learn";
        this._drawMessage("Qual golpe deve ser esquecido?");
    };
    Scene_PkmBattle.prototype.onForgetNo = function() {
        this._yesnoWindow.hide();
        this._yesnoWindow.deactivate();
        this.showSteps([{ text: this._expWinner.name + " não aprendeu " + this._pendingLearn.name + "." }],
            () => this.processNextLearn());
    };
    Scene_PkmBattle.prototype.onForgetOk = function() {
        const winner = this._expWinner;
        const index = this._forgetWindow.index();
        const old = MON.Core.move(winner.moves[index].id);
        const oldName = old ? old.name : winner.moves[index].id;
        winner.replaceMove(index, this._pendingLearn.moveId);
        this._forgetWindow.hide();
        this._forgetWindow.deactivate();
        this.showSteps([
            { text: "1, 2 e… pof!" },
            { text: winner.name + " esqueceu " + oldName + " e aprendeu " + this._pendingLearn.name + "!" }
        ], () => this.processNextLearn());
    };
    Scene_PkmBattle.prototype.onForgetCancel = function() {
        this._forgetWindow.hide();
        this._forgetWindow.deactivate();
        this.showSteps([{ text: this._expWinner.name + " não aprendeu " + this._pendingLearn.name + "." }],
            () => this.processNextLearn());
    };

    Scene_PkmBattle.prototype.evolutionStep = function() {
        const winner = this._expWinner;
        const into = winner.evolutionByLevel ? winner.evolutionByLevel() : null;
        if (!into) return this.processGrowth();
        const oldName = winner.name;
        this.showSteps([{ text: "O quê? " + oldName + " está evoluindo!" }], () => {
            winner.evolveInto(into);
            this.refreshField();
            this.showSteps([{ text: oldName + " evoluiu em " + winner.speciesName + "!" }],
                () => this.processGrowth());
        });
    };

    Scene_PkmBattle.prototype.trainerDefeated = function() {
        const trainer = this._field.trainer;
        const reward = trainer.money || 0;
        const steps = [{ text: "Você derrotou " + trainer.name + "!" }];
        if (trainer.defeatText) steps.push({ text: trainer.defeatText });
        steps.push({
            text: "Você recebeu $" + reward + " de prêmio!",
            fn: () => { if ($gameParty.monGainMoney) $gameParty.monGainMoney(reward); }
        });
        this.showSteps(steps, () => this.endBattle());
    };

    Scene_PkmBattle.prototype.onDefeat = function() {
        this.showSteps([
            { text: "Sua equipe inteira foi derrotada…" },
            { text: "Você voltou correndo para o centro de cura." }
        ], () => { this.healTeam(); this.endBattle(); });
    };

    Scene_PkmBattle.prototype.healTeam = function() {
        if ($gameParty.monHealAll) $gameParty.monHealAll();
        const avatar = $gameParty.monAvatar ? $gameParty.monAvatar() : null;
        if (avatar && avatar.healFully) avatar.healFully();
    };

    //--- fim ------------------------------------------------------------------
    Scene_PkmBattle.prototype.endBattle = function() {
        $gameTemp.monWild = null;
        $gameTemp.monFoes = null;
        $gameTemp.monTrainer = null;
        if (MON.Audio) MON.Audio.restoreBgm();
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
        this.addCommand("Item", "item");
        this.addCommand("Trocar", "switch");
        this.addCommand("Fugir", "run");
    };
    Window_BattleCmd.prototype.maxCols = function() { return 2; };
    Window_BattleCmd.prototype.setBackEnabled = function(enabled) { this._backEnabled = enabled; };
    Window_BattleCmd.prototype.isCancelEnabled = function() { return !!this._backEnabled; };

    function Window_BattleMoves() { this.initialize(...arguments); }
    Window_BattleMoves.prototype = Object.create(Window_Selectable.prototype);
    Window_BattleMoves.prototype.constructor = Window_BattleMoves;
    Window_BattleMoves.prototype.initialize = function(rect) {
        Window_Selectable.prototype.initialize.call(this, rect);
        this._unit = null;
    };
    Window_BattleMoves.prototype.setUnit = function(unit) { this._unit = unit; this.refresh(); };
    Window_BattleMoves.prototype.maxCols = function() { return 2; };
    Window_BattleMoves.prototype.maxItems = function() { return this._unit ? this._unit.moves.length : 0; };
    Window_BattleMoves.prototype.drawItem = function(index) {
        const move = this._unit.moves[index];
        if (!move) return;
        const md = MON.Core.move(move.id);
        const rect = this.itemLineRect(index);
        this.changePaintOpacity(move.pp > 0);
        this.drawText(md ? md.name : move.id, rect.x, rect.y, rect.width - 90, "left");
        this.drawText("PP " + move.pp + "/" + move.ppMax, rect.x + rect.width - 90, rect.y, 90, "right");
        this.changePaintOpacity(true);
    };

    // lista genérica de unidades: alvos, reserva e alvo de item
    function Window_BattleUnits() { this.initialize(...arguments); }
    Window_BattleUnits.prototype = Object.create(Window_Selectable.prototype);
    Window_BattleUnits.prototype.constructor = Window_BattleUnits;
    Window_BattleUnits.prototype.initialize = function(rect) {
        Window_Selectable.prototype.initialize.call(this, rect);
        this._units = [];
        this._onCursor = null;
    };
    Window_BattleUnits.prototype.setUnits = function(units) {
        this._units = units || [];
        this.scrollTo(0, 0);
        this.refresh();
    };
    Window_BattleUnits.prototype.setCursorCallback = function(fn) { this._onCursor = fn; };
    Window_BattleUnits.prototype.maxItems = function() { return this._units.length; };
    Window_BattleUnits.prototype.currentUnit = function() { return this._units[this.index()] || null; };
    Window_BattleUnits.prototype.callUpdateHelp = function() {
        if (this._onCursor && this.active) this._onCursor(this.currentUnit());
    };
    Window_BattleUnits.prototype.drawItem = function(index) {
        const unit = this._units[index];
        if (!unit) return;
        const rect = this.itemLineRect(index);
        this.changePaintOpacity(!unit.isFainted());
        this.drawText(unit.name + unit.genderSymbol(), rect.x, rect.y, rect.width - 210, "left");
        this.drawText("Nv." + unit.level, rect.x + rect.width - 210, rect.y, 70, "left");
        this.drawText(unit.hp + "/" + unit.maxHp + (unit.status ? " " + unit.status : ""),
            rect.x + rect.width - 140, rect.y, 140, "right");
        this.changePaintOpacity(true);
    };

    // lista de itens da mochila: bolas de captura e remédios
    function Window_BattleEntries() { this.initialize(...arguments); }
    Window_BattleEntries.prototype = Object.create(Window_Selectable.prototype);
    Window_BattleEntries.prototype.constructor = Window_BattleEntries;
    Window_BattleEntries.prototype.initialize = function(rect) {
        Window_Selectable.prototype.initialize.call(this, rect);
        this._entries = [];
    };
    Window_BattleEntries.prototype.setEntries = function(entries) {
        this._entries = entries || [];
        this.scrollTo(0, 0);
        this.refresh();
    };
    Window_BattleEntries.prototype.maxCols = function() { return 2; };
    Window_BattleEntries.prototype.maxItems = function() { return this._entries.length; };
    Window_BattleEntries.prototype.currentEntry = function() { return this._entries[this.index()] || null; };
    Window_BattleEntries.prototype.drawItem = function(index) {
        const entry = this._entries[index];
        if (!entry) return;
        const rect = this.itemLineRect(index);
        this.drawText(entry.data.name, rect.x, rect.y, rect.width - 70, "left");
        this.drawText("×" + entry.qty, rect.x + rect.width - 70, rect.y, 70, "right");
    };

    function Window_BattleYesNo() { this.initialize(...arguments); }
    Window_BattleYesNo.prototype = Object.create(Window_Command.prototype);
    Window_BattleYesNo.prototype.constructor = Window_BattleYesNo;
    Window_BattleYesNo.prototype.makeCommandList = function() {
        this.addCommand("Sim", "yes");
        this.addCommand("Não", "no");
    };
})();
