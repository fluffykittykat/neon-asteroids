import { Game } from './src/game/Game.js';

const canvas = document.getElementById('game-canvas');
const game = new Game(canvas);

game.start();
