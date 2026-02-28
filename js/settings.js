// ═══════════════════════════════════════════════════
//  settings.js  —  mirrors settings.py
// ═══════════════════════════════════════════════════

const WIDTH  = 390;
const HEIGHT = 720;

const HUD_H  = 52;
const PAD_H  = 160;
const GAME_H = HEIGHT - HUD_H - PAD_H;   // 508

const FPS = 60;

const COL = {
  WHITE  : '#ffffff',
  BLACK  : '#000000',
  RED    : 'rgb(220,40,60)',
  GREEN  : 'rgb(0,255,0)',
  CYAN   : 'rgb(0,220,240)',
  YELLOW : 'rgb(255,230,0)',
  PURPLE : 'rgb(153,51,255)',
  DARK   : 'rgb(3,5,15)',
  HP_COL : 'rgb(220,40,60)',
};

const PLAYER_SPEED     = 7;
const BULLET_SPEED_VAL = 12;
const SPECIAL_SPEED    = 9;
const ITEM_SPEED       = 3;
const START_SPECIALS   = 2;
const MAX_SPECIALS     = 9;
const MAX_WEAPON_LEVEL = 4;   // Lv1=1shot Lv2=3shot Lv3=6shot Lv4=spread full

const STATE = {
  INTRO      : 'intro',
  PLAYING    : 'playing',
  BOSS_FIGHT : 'boss_fight',
  VICTORY    : 'victory',
  GAME_OVER  : 'game_over',
  RANKING    : 'ranking',
};

const IMG = {
  PLAYER : 'assets/images/player.png',
  ENEMY  : 'assets/images/enemy.png',
  BOSS   : 'assets/images/boss.png',
  FRIEND : 'assets/images/friend.png',
  BG     : 'assets/images/background.jpg',
  BULLET : 'assets/images/bullet.png',   // กระสุนของผู้เล่น (PNG โปร่งใส)
  // Item sprites
  ITEM_LIFE    : 'assets/images/items/item_life.png',
  ITEM_SHIELD  : 'assets/images/items/item_shield.png',
  ITEM_SPECIAL : 'assets/images/items/item_special.png',   // เปลี่ยนจาก bomb
  ITEM_WEAPON  : 'assets/images/items/item_weapon.png',
};

const SND = {
  BGM     : 'assets/sounds/bgm.mp3',
  SHOOT   : 'assets/sounds/shoot.wav',
  HIT     : 'assets/sounds/player_hit.wav',
  ITEM    : 'assets/sounds/pickup.wav',
  B_SHOOT : 'assets/sounds/boss_shoot.wav',
  EXPLODE : 'assets/sounds/explosion.wav',
  WIN     : 'assets/sounds/victory.wav',
};

// ── Sprite util: remove white/near-white bg from image ──────────────
// Returns an offscreen canvas with background removed (alpha=0)
function removeBackground(img, tolerance = 30) {
  const oc  = document.createElement('canvas');
  oc.width  = img.naturalWidth  || img.width;
  oc.height = img.naturalHeight || img.height;
  const c   = oc.getContext('2d');
  c.drawImage(img, 0, 0);
  try {
    const id  = c.getImageData(0, 0, oc.width, oc.height);
    const d   = id.data;
    const thr = 255 - tolerance;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] >= thr && d[i+1] >= thr && d[i+2] >= thr) d[i+3] = 0;
    }
    c.putImageData(id, 0, 0);
  } catch(e) {
    // CORS: just return canvas as-is (PNG with real alpha will still work)
    console.warn('removeBackground skipped (CORS):', e.message);
  }
  return oc;
}
