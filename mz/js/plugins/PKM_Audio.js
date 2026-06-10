//=============================================================================
// PKM_Audio.js  — Fase 10
//=============================================================================
/*:
 * @target MZ
 * @plugindesc [PKM v0.5] Áudio: cries dos Pokémon, BGM de batalha e fanfarra de
 * vitória. Integra-se à batalha automaticamente (opcional).
 * @author Pokémon Dimensions (port MZ)
 * @base PKM_Core
 * @orderAfter PKM_Battle
 *
 * @help PKM_Audio.js
 *
 * Toca o "cry" de um Pokémon e a trilha de batalha/vitória, se os arquivos
 * existirem (se não existirem, o MZ apenas ignora — nada quebra).
 *
 * Coloque os arquivos em:
 *   audio/se/Cries/001Cry.ogg, 004Cry.ogg, …   (cries, por número de 3 dígitos)
 *   audio/bgm/<BGM de batalha>.ogg
 *   audio/me/<Fanfarra de vitória>.ogg
 *
 * @param cryFolder
 * @text Pasta dos cries (em se/)
 * @default Cries/
 * @param crySuffix
 * @text Sufixo do nome do cry
 * @default Cry
 * @param wildBgm
 * @text BGM de batalha selvagem
 * @default Battle Wild
 * @param trainerBgm
 * @text BGM de batalha de treinador
 * @default Battle Trainer
 * @param victoryWildMe
 * @text Fanfarra vitória (selvagem)
 * @default Victory Wild
 * @param victoryTrainerMe
 * @text Fanfarra vitória (treinador)
 * @default Victory Trainer
 */

var PKM = PKM || {};

(() => {
    "use strict";
    const P = PluginManager.parameters("PKM_Audio");
    const num3 = (n) => String(n).padStart(3, "0");

    PKM.Audio = {
        _savedBgm: null,

        playCry(speciesId) {
            if (!speciesId) return;
            const name = (P.cryFolder || "Cries/") + num3(speciesId) + (P.crySuffix || "Cry");
            try { AudioManager.playSe({ name, volume: 90, pitch: 100, pan: 0 }); } catch (e) {}
        },
        playBattleBgm(isTrainer) {
            if (!this._savedBgm) this._savedBgm = AudioManager.saveBgm();
            const name = isTrainer ? (P.trainerBgm || "Battle Trainer") : (P.wildBgm || "Battle Wild");
            try { AudioManager.playBgm({ name, volume: 90, pitch: 100, pan: 0 }); } catch (e) {}
        },
        restoreBgm() {
            if (this._savedBgm) {
                try { AudioManager.replayBgm(this._savedBgm); } catch (e) {}
                this._savedBgm = null;
            }
        },
        playVictory(isTrainer) {
            const name = isTrainer ? (P.victoryTrainerMe || "Victory Trainer") : (P.victoryWildMe || "Victory Wild");
            try { AudioManager.playMe({ name, volume: 90, pitch: 100, pan: 0 }); } catch (e) {}
        }
    };
})();
