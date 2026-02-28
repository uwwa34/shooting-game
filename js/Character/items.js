// ═══════════════════════════════════════════════════
//  Character/items.js
// ═══════════════════════════════════════════════════

// ── Bullet (player normal shot) ───────────────────
// ใช้ image sprite แทนสี่เหลี่ยมสีเหลือง
// images.bullet ต้องโหลดก่อน; ถ้าไม่มีจะ fallback เป็นเส้นสีเหลือง
let _bulletCanvas = null;   // shared offscreen canvas (process once)
const W_Bullet    = 40;
const H_Bullet    = 40;

function getBulletCanvas(images) {
  if (_bulletCanvas) return _bulletCanvas;
  if (images && images.bullet && images.bullet.complete && images.bullet.naturalWidth > 0) {
    _bulletCanvas = removeBackground(images.bullet, 30);
  }
  return _bulletCanvas;
}

class Bullet {
  constructor(x, y, vx, vy, images) {
    this.x  = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.w  = W_Bullet; this.h = H_Bullet;
    this.alive = true;
    this._bc = getBulletCanvas(images);
    // rotation angle จาก velocity (ตรง = 0, เอียงตาม vx/vy)
    this._angle = Math.atan2(vy, vx) + Math.PI / 2;  // +90° เพราะ sprite หันขึ้น
  }

  get cx() { return this.x + (this.w / 2) - (W_Bullet/2); }  //this.w / 2
  get cy() { return this.y + this.h / 2; }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    if (this.y + this.h < HUD_H || this.y > HUD_H + GAME_H) this.alive = false;
    if (this.x < -20 || this.x > WIDTH + 20)                this.alive = false;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.cx, this.cy);
    ctx.rotate(this._angle);
    if (this._bc) {
      ctx.drawImage(this._bc, -this.w/2, -this.h/2, this.w, this.h);
    } else {
      // fallback: กระสุนสีเหลืองเรืองแสง
      const grd = ctx.createLinearGradient(-this.w/2, -this.h/2, this.w/2, this.h/2);
      grd.addColorStop(0, 'rgb(255,255,150)');
      grd.addColorStop(1, 'rgb(255,200,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(-this.w/2, -this.h/2, this.w, this.h);
      // glow
      ctx.shadowColor = 'rgb(255,220,80)';
      ctx.shadowBlur  = 6;
      ctx.fillRect(-this.w/2, -this.h/2, this.w, this.h);
    }
    ctx.restore();
  }

  getRect() {
    // ใช้ bounding box หลังหมุน (approximate — ใช้ max(w,h) เป็น square)
    const s = Math.max(this.w, this.h) / 2;
    return { x: this.cx - s, y: this.cy - s, w: s*2, h: s*2 };
  }
}

// ── SpecialBullet (player special shot) ───────────
class SpecialBullet {
  constructor(x, y) {
    this.x  = x - 11; this.y = y - 11;
    this.r  = 11;
    this.vy = -SPECIAL_SPEED;
    this.alive = true;
    this._t = 0;
  }

  get cx() { return this.x + this.r; }
  get cy() { return this.y + this.r; }
  get w()  { return this.r * 2; }
  get h()  { return this.r * 2; }

  update() {
    this.y += this.vy;
    this._t++;
    if (this.y + this.h < HUD_H) this.alive = false;
  }

  draw(ctx) {
    ctx.save();
    // pulse glow
    const pulse = 0.7 + 0.3 * Math.sin(this._t * 0.3);
    ctx.shadowColor = 'rgba(255,120,0,0.9)';
    ctx.shadowBlur  = 14 * pulse;
    const grd = ctx.createRadialGradient(this.cx-3, this.cy-3, 2, this.cx, this.cy, this.r);
    grd.addColorStop(0, 'rgb(255,240,100)');
    grd.addColorStop(0.5,'rgb(255,160,20)');
    grd.addColorStop(1, 'rgb(200,60,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, this.r * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  getRect() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
}

// ── BossBullet ────────────────────────────────────
class BossBullet {
  constructor(x, y, vx, vy) {
    this.fx = x; this.fy = y;
    this.vx = vx; this.vy = vy;
    this.r  = 7;
    this.alive = true;
  }

  get x()  { return this.fx - this.r; }
  get y()  { return this.fy - this.r; }
  get cx() { return this.fx; }
  get cy() { return this.fy; }
  get w()  { return this.r * 2; }
  get h()  { return this.r * 2; }

  update() {
    this.fx += this.vx;
    this.fy += this.vy;
    if (this.fx < -20 || this.fx > WIDTH + 20) this.alive = false;
    if (this.fy < HUD_H - 20 || this.fy > HUD_H + GAME_H + 20) this.alive = false;
  }

  draw(ctx) {
    ctx.save();
    ctx.shadowColor = 'rgba(255,60,60,0.8)';
    ctx.shadowBlur  = 8;
    const grd = ctx.createRadialGradient(this.fx-2, this.fy-2, 1, this.fx, this.fy, this.r);
    grd.addColorStop(0, 'rgb(255,200,200)');
    grd.addColorStop(1, 'rgb(220,30,30)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(this.fx, this.fy, this.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  getRect() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
}

// ── Item ──────────────────────────────────────────
const ITEM_COLORS = {
  life    : [220, 40,  60 ],
  shield  : [0,   200, 230],
  special : [255, 120, 0  ],
  weapon  : [100, 230, 80 ],
};

class Item {
  constructor(x, y, type, images) {
    this.type  = type;
    this.r     = 18;
    this.x     = x - this.r;
    this.y     = y - this.r;
    this.alive = true;
    this._col  = ITEM_COLORS[type] || [255,255,255];
    this._t    = 0;

    const imgKey = { life:'itemLife', shield:'itemShield', special:'itemSpecial', weapon:'itemWeapon' }[type];
    const raw = images && images[imgKey];
    this._canvas = (raw && raw.complete && raw.naturalWidth > 0) ? removeBackground(raw, 30) : null;
  }

  get cx() { return this.x + this.r; }
  get cy() { return this.y + this.r; }
  get w()  { return this.r * 2; }
  get h()  { return this.r * 2; }

  update() {
    this.y += ITEM_SPEED;
    this._t++;
    if (this.y > HUD_H + GAME_H) this.alive = false;
  }

  draw(ctx) {
    const [r,g,b] = this._col;
    const pulse   = 0.85 + 0.15 * Math.sin(this._t * 0.12);
    ctx.save();

    // glow
    const glow = ctx.createRadialGradient(this.cx, this.cy, this.r*0.3, this.cx, this.cy, this.r*1.6);
    glow.addColorStop(0, `rgba(${r},${g},${b},0.4)`);
    glow.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(this.cx, this.cy, this.r*1.6, 0, Math.PI*2); ctx.fill();

    if (this._canvas) {
      ctx.drawImage(this._canvas, this.x, this.y, this.w, this.h);
    } else {
      // fallback circle
      ctx.globalAlpha = 0.9 * pulse;
      ctx.fillStyle   = `rgb(${r},${g},${b})`;
      ctx.beginPath(); ctx.arc(this.cx, this.cy, this.r, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font='bold 14px Arial';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      const icons = { life:'+', shield:'S', special:'★', weapon:'W' };
      ctx.fillText(icons[this.type]||'?', this.cx, this.cy);
    }
    ctx.restore();
  }

  getRect() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
}
