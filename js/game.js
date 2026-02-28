// ═══════════════════════════════════════════════════
//  js/game.js  —  Game class (main loop)
// ═══════════════════════════════════════════════════

class Game {
  constructor(canvas, images, sounds) {
    this.canvas   = canvas;
    this.ctx      = canvas.getContext('2d');
    this.images   = images;
    this.sounds   = sounds;
    this.state    = STATE.INTRO;
    this.running  = true;
    this.lastTime = 0;
    this.accumulator = 0;
    this.stepMs   = 1000 / FPS;

    this.enemies  = []; this.bullets  = [];
    this.bbullets = []; this.ebullets = [];
    this.items    = [];

    this.player   = new Player(images);
    this.cage     = new Cage();
    this.boss     = new Boss(images);
    this.friend   = new Friend(images, WIDTH/2, HUD_H + GAME_H/2);

    this.spawnTimer = 0; this.killed = 0;
    this.introTimer = 0; this.introPhase = 0;
    this.boss.y = HUD_H - 150;
    this.gameTimer      = 0;    // นับเฟรมตั้งแต่เริ่ม PLAYING (ใช้คำนวณ bonus)
    this.gameTimerActive = false;

    this.victoryTimer   = 0;
    this.victoryCanExit = false;
    this.reachedFriend  = false;

    // Ranking
    this.rankingScreen = new RankingScreen(canvas);

    this.keys   = {};
    this.joypad = new VirtualJoypad(canvas);
    this.joypad._onShoot = () => this._joyShoot();
    this.joypad._onBomb  = () => this._joyBomb();

    // tap detection for ranking screen
    canvas.addEventListener('touchstart', e => {
      if (!this.rankingScreen.visible) return;
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      const t = e.changedTouches[0];
      const scX = WIDTH  / r.width;
      const scY = HEIGHT / r.height;
      this.rankingScreen.handleTap((t.clientX-r.left)*scX, (t.clientY-r.top)*scY);
    }, { passive:false });
    canvas.addEventListener('mousedown', e => {
      if (!this.rankingScreen.visible) return;
      const r  = canvas.getBoundingClientRect();
      const scX = WIDTH/r.width, scY = HEIGHT/r.height;
      this.rankingScreen.handleTap((e.clientX-r.left)*scX, (e.clientY-r.top)*scY);
    });

    this._bindKeys();
    this._playBGM();
  }

  // ── Audio ─────────────────────────────────────────
  _playBGM() {
    if (!this.sounds.bgm) return;
    this.sounds.bgm.loop   = true;
    this.sounds.bgm.volume = 0.4;
    // ถ้า AudioContext ยัง suspended (iOS ก่อน interact) → เก็บ pending ไว้
    const p = this.sounds.bgm.play();
    if (p !== undefined) {
      p.catch(() => {
        // autoplay blocked → mark pending, จะ play เมื่อ user interact
        this._bgmPending = true;
      });
    }
  }

  // เรียกหลัง user interaction ครั้งแรก เพื่อ resume pending BGM
  _resumeBGMIfPending() {
    if (!this._bgmPending) return;
    this._bgmPending = false;
    this.sounds.bgm.play().catch(() => {});
  }
  _stopBGM() {
    if (!this.sounds.bgm) return;
    this.sounds.bgm.pause(); this.sounds.bgm.currentTime=0;
  }
  _play(key) {
    const s=this.sounds[key]; if(!s) return;
    const c=s.cloneNode(); c.volume=0.6; c.play().catch(()=>{});
  }

  // ── Keys ──────────────────────────────────────────
  _bindKeys() {
    window.addEventListener('keydown', e => { this.keys[e.key]=true; this._handleKeyDown(e.key); });
    window.addEventListener('keyup',   e => { this.keys[e.key]=false; });
  }
  _handleKeyDown(key) {
    this._resumeBGMIfPending();   // iOS BGM unlock on first key
    if (this.rankingScreen.visible) return;
    if (this.state===STATE.VICTORY) {
      // ล็อกปุ่มจนกว่า end scene จบและ victoryCanExit = true
      if (this.victoryCanExit) { this._goRanking(); }
      return;
    }
    if (this.state===STATE.GAME_OVER) { this._goRanking(); return; }
    if (this.state===STATE.PLAYING||this.state===STATE.BOSS_FIGHT) {
      if (key===' ') this.shootPlayer();
      if (key==='b'||key==='B') this.shootBomb();
    }
  }
  _joyShoot() {
    this._resumeBGMIfPending();   // iOS BGM unlock on first tap
    if (this.rankingScreen.visible) return;
    if (this.state===STATE.PLAYING||this.state===STATE.BOSS_FIGHT) { this.shootPlayer(); return; }
    if (this.state===STATE.VICTORY) {
      // ล็อกจนกว่า victoryCanExit
      if (this.victoryCanExit) { this._goRanking(); }
      return;
    }
    if (this.state===STATE.GAME_OVER) { this._goRanking(); return; }
  }
  _joyBomb() {
    this._resumeBGMIfPending();
    if (this.rankingScreen.visible) return;
    if (this.state===STATE.PLAYING||this.state===STATE.BOSS_FIGHT) this.shootBomb();
  }

  // ── Ranking transition ────────────────────────────
  _goRanking() {
    this.rankingScreen.show(this.player.score, () => {
      // Done → restart
      this.restart();
    });
  }

  // ── Restart ───────────────────────────────────────
  restart() {
    this.enemies=[]; this.bullets=[]; this.bbullets=[]; this.ebullets=[]; this.items=[];

    this.player     = new Player(this.images);
    this.cage       = new Cage();
    this.boss       = new Boss(this.images);
    this.friend     = new Friend(this.images, WIDTH/2, HUD_H + GAME_H/2);
    this.boss.y     = HUD_H - 150;   // เริ่มนอกจอด้านบน เหมือนรอบแรก

    this.spawnTimer  = 0;
    this.killed      = 0;
    this.gameTimer   = 0;
    this.gameTimerActive = false;
    this.bonusBreakdown  = null;

    // กลับไป INTRO เหมือนรอบแรก
    this.introTimer  = 0;
    this.introPhase  = 0;
    this.state       = STATE.INTRO;

    this._playBGM();
  }

  // ── Boss scene ────────────────────────────────────
  _addBossScene() {
    this.cage.x = this.boss.cx - this.cage.w/2;
    this.cage.y = this.boss.top - this.cage.h - 5;
    this.friend = new Friend(this.images, this.cage.cx, this.cage.cy);
  }
  _syncCage() {
    this.cage.x = this.boss.cx - this.cage.w/2;
    this.cage.y = this.boss.top - this.cage.h - 5;
    if (this.friend && this.friend.alive) {
      this.friend.x = this.cage.cx - this.friend.w/2 + this.cage.struggleOffset();
      this.friend.y = this.cage.cy - this.friend.h/2;
    }
  }

  // ── Shooting ──────────────────────────────────────
  shootPlayer() {
    this._play('shoot');
    const cx=this.player.cx, y=this.player.top, lv=this.player.weaponLevel, spd=BULLET_SPEED_VAL;
    const add=(x,vx,vy)=>{ this.bullets.push(new Bullet(x,y,vx,vy??-spd,this.images)); };
    if      (lv===1) { add(cx,0); }
    else if (lv===2) { [-18,0,18].forEach(dx=>add(cx+dx,0)); }
    else if (lv===3) { [-28,-10,10,28,-19,19].forEach(dx=>add(cx+dx,0)); }
    else {
      // Lv4 (was Lv5): 9-way spread
      add(cx,0);
      [20,40,60,80].forEach(deg=>{
        const a=deg*Math.PI/180;
        add(cx,-Math.sin(a)*spd,-Math.cos(a)*spd);
        add(cx, Math.sin(a)*spd,-Math.cos(a)*spd);
      });
    }
  }
  shootBomb() {
    if (this.player.specials<=0) return;
    this.player.specials--;
    this._play('explode');
    this.bbullets.push(new SpecialBullet(this.player.cx, this.player.top));
  }
  shootBoss() {
    this._play('bShoot');
    this.boss.getBullets().forEach(b=>this.ebullets.push(new BossBullet(b.x,b.y,b.vx,b.vy)));
  }

  // ── Collision ─────────────────────────────────────
  _overlap(a,b){ return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y; }

  handleCollisions() {
    const pR=this.player.getRect();
    // normal bullets → enemies
    this.bullets=this.bullets.filter(b=>{
      if(!b.alive) return false;
      let hit=false;
      this.enemies=this.enemies.filter(e=>{
        if(!e.alive||!this._overlap(b.getRect(),e.getRect())) return true;
        this.player.score+=10; this.killed++;
        this._maybeDrop(e.cx,e.cy); b.alive=false; hit=true; return false;
      });
      return !hit;
    });
    // bomb bullets → enemies (pass-through)
    this.bbullets.forEach(b=>{
      if(!b.alive) return;
      this.enemies=this.enemies.filter(e=>{
        if(!e.alive||!this._overlap(b.getRect(),e.getRect())) return true;
        this.player.score+=15; this.killed++; this._maybeDrop(e.cx,e.cy); return false;
      });
    });
    // bullets → boss
    if (this.state===STATE.BOSS_FIGHT&&this.boss.alive) {
      const bR=this.boss.getRect();
      this.bullets=this.bullets.filter(b=>{
        if(!b.alive||!this._overlap(b.getRect(),bR)) return true;
        this.boss.hp-=20; b.alive=false; this._checkBossDead(); return false;
      });
      this.bbullets=this.bbullets.filter(b=>{
        if(!b.alive||!this._overlap(b.getRect(),bR)) return true;
        this.boss.hp-=250; b.alive=false; this._checkBossDead(); return false;
      });
    }
    // enemy/ebullets → player
    if (![STATE.VICTORY,STATE.INTRO,STATE.GAME_OVER].includes(this.state)) {
      let hit=false;
      this.enemies=this.enemies.filter(e=>{
        if(e.alive&&this._overlap(e.getRect(),pR)){hit=true;return false;} return true;
      });
      this.ebullets=this.ebullets.filter(b=>{
        if(b.alive&&this._overlap(b.getRect(),pR)){hit=true;b.alive=false;return false;} return true;
      });
      if(hit){
        this._play('hit');
        if(this.player.shieldHp>0) this.player.shieldHp-=20;
        else this.player.hp-=10;
        if(this.player.hp<=0){
          this._play('explode'); this.state=STATE.GAME_OVER;
          this.gameTimerActive = false;
          this._stopBGM();
        }
      }
    }
    // items → player
    this.items=this.items.filter(it=>{
      if(!it.alive||!this._overlap(it.getRect(),pR)) return it.alive;
      this._play('item');
      if(it.type==='life')   this.player.hp=Math.min(100,this.player.hp+20);
      if(it.type==='shield') { this.player.shieldHp=100; this.player.shieldTimer=600; }
      if(it.type==='special')   this.player.specials=Math.min(MAX_SPECIALS,this.player.specials+1);
      if(it.type==='weapon'&&this.player.weaponLevel<MAX_WEAPON_LEVEL) this.player.weaponLevel++;
      return false;
    });
  }

  _maybeDrop(x,y){
    if(Math.random()<0.28){
      const types=['life','life','shield','special','weapon'];
      const t=types[Math.floor(Math.random()*types.length)];
      this.items.push(new Item(x, y, t, this.images));
    }
  }

  _checkBossDead(){
    if(this.boss.hp<=0&&this.boss.alive){
      this._play('explode'); this.boss.alive=false;
      const cx=this.cage.cx, cy=this.cage.cy;
      this.cage.startBreak();
      if(this.friend) this.friend.alive=false;
      this.friend=new Friend(this.images,cx,cy);
      this.state=STATE.VICTORY;
      this.victoryTimer=0; this.reachedFriend=false; this.victoryCanExit=false;
      this.gameTimerActive = false;   // หยุดนับเวลา

      // ── Bonus Score ────────────────────────────────
      // time bonus: ยิ่งเร็วยิ่งได้เยอะ (สูงสุด 5000, ลดลงทุก 10 วินาที 60fps)
      const secElapsed = Math.floor(this.gameTimer / FPS);
      const timeBonus  = Math.max(0, 5000 - secElapsed * 30);
      // HP bonus: HP ที่เหลือ × 20
      const hpBonus    = this.player.hp * 20;
      // Special bonus: special ที่เหลือ × 300
      const spBonus    = this.player.specials * 300;
      const totalBonus = timeBonus + hpBonus + spBonus;
      this.player.score += totalBonus;
      this.bonusBreakdown = { timeBonus, hpBonus, spBonus, totalBonus, secElapsed };

      this._stopBGM(); this._play('win');
    }
  }

  // ── Intro ─────────────────────────────────────────
  updateIntro(){
    this.introTimer++;
    const t=this.introTimer;
    if(this.introPhase===0){
      const target=HUD_H+120;
      if(this.boss.y<target) this.boss.y+=2;
      if(t>=150){
        this.introPhase=1;
        this.cage.x=this.friend.cx-this.cage.w/2;
        this.cage.y=this.friend.cy-this.cage.h/2;
        this.boss.alive=true;
      }
    } else if(this.introPhase===1){
      this.cage.x=this.boss.cx-this.cage.w/2;
      this.cage.y=this.boss.top-this.cage.h-5;
      this.friend.x=this.cage.cx-this.friend.w/2;
      this.friend.y=this.cage.cy-this.friend.h/2;
      if(t>=270) this.introPhase=2;
    } else {
      this.boss.y-=2;
      this.cage.x=this.boss.cx-this.cage.w/2;
      this.cage.y=this.boss.top-this.cage.h-5;
      this.friend.x=this.cage.cx-this.friend.w/2;
      this.friend.y=this.cage.cy-this.friend.h/2;
      if(this.boss.bottom<HUD_H){
        this.boss=new Boss(this.images); this.cage=new Cage(); this.friend=null;
        this.gameTimer = 0; this.gameTimerActive = true;  // เริ่มจับเวลาเมื่อเข้าเกมจริง
        this.state=STATE.PLAYING;
      }
    }
  }

  // ── Victory ───────────────────────────────────────
  updateVictory(){
    if(!this.reachedFriend){
      const tx=this.friend.right+25, ty=this.friend.cy;
      const dx=tx-this.player.cx, dy=ty-this.player.cy;
      if(Math.abs(dx)>3) this.player.x+=dx>0?3:-3;
      if(Math.abs(dy)>3) this.player.y+=dy>0?3:-3;
      if(Math.abs(dx)<=6&&Math.abs(dy)<=6){this.reachedFriend=true;this.victoryTimer=0;}
    } else {
      this.victoryTimer++;
      if(this.victoryTimer>=FPS*2) this.victoryCanExit=true;
    }
  }

  // ── Update ────────────────────────────────────────
  update(){
    if(this.rankingScreen.visible) return;  // pause game while ranking shown

    this.player.padLeft  = this.joypad.state.left;
    this.player.padRight = this.joypad.state.right;

    if     (this.state===STATE.INTRO)      { this.updateIntro(); }
    else if(this.state===STATE.PLAYING)    {
      this.spawnTimer++;
      if(this.spawnTimer>=60){ this.enemies.push(new Enemy(this.images)); this.spawnTimer=0; }
      if(this.killed>=30){ this.state=STATE.BOSS_FIGHT; this._addBossScene(); }
      this.player.update(this.keys);
    }
    else if(this.state===STATE.BOSS_FIGHT){
      this.spawnTimer++;
      if(this.spawnTimer>=90){ this.enemies.push(new Enemy(this.images)); this.spawnTimer=0; }
      if(this.boss.alive&&this.boss.update()) this.shootBoss();
      this._syncCage();
      this.player.update(this.keys);
    }
    else if(this.state===STATE.VICTORY)   { this.updateVictory(); this.cage.update(); }

    if (this.gameTimerActive) this.gameTimer++;

    this.enemies  = this.enemies .filter(o=>{o.update();return o.alive;});
    this.bullets  = this.bullets .filter(o=>{o.update();return o.alive;});
    this.bbullets = this.bbullets.filter(o=>{o.update();return o.alive;});
    this.ebullets = this.ebullets.filter(o=>{o.update();return o.alive;});
    this.items    = this.items   .filter(o=>{o.update();return o.alive;});

    if(this.state===STATE.PLAYING||this.state===STATE.BOSS_FIGHT) this.handleCollisions();
  }

  // ── Draw ──────────────────────────────────────────
  draw(){
    const ctx=this.ctx;

    // Background
    ctx.fillStyle=COL.DARK; ctx.fillRect(0,0,WIDTH,HEIGHT);
    if(this.images.bg) ctx.drawImage(this.images.bg,0,HUD_H,WIDTH,GAME_H);
    else { ctx.fillStyle='rgb(5,8,20)'; ctx.fillRect(0,HUD_H,WIDTH,GAME_H); }

    // Clip game zone
    ctx.save();
    ctx.beginPath(); ctx.rect(0,HUD_H,WIDTH,GAME_H); ctx.clip();

    this.enemies.forEach(o=>o.draw(ctx));
    this.items  .forEach(o=>o.draw(ctx));

    // ── cage & friend: only in INTRO, BOSS_FIGHT, VICTORY ──
    if ([STATE.INTRO, STATE.BOSS_FIGHT, STATE.VICTORY].includes(this.state)) {
      if (this.friend) this.friend.draw(ctx);
      this.cage.draw(ctx);
    }

    if(this.boss.alive) this.boss.draw(ctx);
    this.bullets .forEach(o=>o.draw(ctx));
    this.bbullets.forEach(o=>o.draw(ctx));
    this.ebullets.forEach(o=>o.draw(ctx));
    this.player.draw(ctx);

    ctx.restore();

    this._drawHUD();
    if(this.state===STATE.BOSS_FIGHT&&this.boss.alive) this._drawBossHP();

    // Joypad only when not in ranking
    if(!this.rankingScreen.visible) this.joypad.draw(ctx, this.player.specials);

    if(this.state===STATE.INTRO)     this._drawIntroCaption();
    if(this.state===STATE.VICTORY)   this._drawVictory();
    if(this.state===STATE.GAME_OVER) this._drawGameOver();

    // Ranking screen drawn on top
    this.rankingScreen.draw();
  }

  // ── HUD ───────────────────────────────────────────
  _drawHUD(){
    const ctx=this.ctx;
    ctx.fillStyle='rgba(0,10,25,0.88)'; ctx.fillRect(0,0,WIDTH,HUD_H);
    ctx.strokeStyle='rgba(0,160,200,0.3)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(0,HUD_H); ctx.lineTo(WIDTH,HUD_H); ctx.stroke();

    ctx.fillStyle=COL.CYAN; ctx.font='bold 13px Courier New';
    ctx.textBaseline='top'; ctx.textAlign='left';
    ctx.fillText('HP',10,10);

    const tx=34,ty=14,tw=110,th=11;
    ctx.fillStyle='rgb(60,0,0)'; this._rr(ctx,tx,ty,tw,th,3,true,false);
    const hw=Math.round(tw*this.player.hp/100);
    if(hw>0){ctx.fillStyle=COL.HP_COL; this._rr(ctx,tx,ty,hw,th,3,true,false);}
    ctx.strokeStyle='rgb(180,60,80)'; ctx.lineWidth=1; this._rr(ctx,tx,ty,tw,th,3,false,true);

    ctx.fillStyle=COL.YELLOW; ctx.font='bold 13px Courier New';
    ctx.textAlign='center';
    ctx.fillText(String(this.player.score).padStart(6,'0'), WIDTH/2.165, 18); //WIDTH/2, 18);

    // Weapon pips
    ctx.fillStyle='rgb(100,230,80)'; ctx.font='bold 12px Courier New'; ctx.textAlign='left';
    ctx.fillText(`WPN Lv${this.player.weaponLevel}`, WIDTH-175, 8);
    for(let i=0;i<MAX_WEAPON_LEVEL;i++){
      ctx.fillStyle=i<this.player.weaponLevel?'rgb(100,230,80)':'rgb(30,50,30)';
      this._rr(ctx,WIDTH-175+i*14,30,10,12,2,true,false);
    }

    // Bomb dots
    ctx.fillStyle='rgb(255,140,0)'; ctx.font='bold 12px Courier New'; ctx.textAlign='left';
    ctx.fillText('SPEC',WIDTH-90,8);
    for(let i=0;i<Math.min(this.player.specials,9);i++){
      const cx=WIDTH-85+i*14;
      ctx.fillStyle='rgb(255,120,0)';
      ctx.beginPath(); ctx.arc(cx,36,5,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='rgb(255,220,80)';
      ctx.beginPath(); ctx.arc(cx-1,33,2,0,Math.PI*2); ctx.fill();
    }
  }

  _rr(ctx,x,y,w,h,r,fill,stroke){
    ctx.beginPath();
    ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.arcTo(x+w,y,x+w,y+r,r);
    ctx.lineTo(x+w,y+h-r); ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
    ctx.lineTo(x+r,y+h); ctx.arcTo(x,y+h,x,y+h-r,r);
    ctx.lineTo(x,y+r); ctx.arcTo(x,y,x+r,y,r); ctx.closePath();
    if(fill) ctx.fill(); if(stroke) ctx.stroke();
  }

  _drawBossHP(){
    const ctx=this.ctx;
    const bw=12, bh=this.boss.h;
    const x=this.boss.right+8, y=this.boss.top;
    const ratio  = Math.max(0, this.boss.hp / this.boss.maxHp);
    const filled = Math.round(bh * ratio);
    // สีเปลี่ยนตาม HP: เขียว → เหลือง → แดง → rage สีแดงกระพริบ
    let barCol = ratio > 0.6 ? COL.PURPLE :
                 ratio > 0.4 ? 'rgb(255,200,50)' :
                                'rgb(255,40,40)';
    if (this.boss._rage && Math.floor(Date.now()/150)%2===0) barCol='rgb(255,120,0)';

    ctx.fillStyle='rgb(20,0,30)'; this._rr(ctx,x,y,bw,bh,4,true,false);
    if(filled){ ctx.fillStyle=barCol; this._rr(ctx,x,y+bh-filled,bw,filled,4,true,false); }
    ctx.strokeStyle='rgb(180,80,255)'; ctx.lineWidth=1; this._rr(ctx,x,y,bw,bh,4,false,true);

    // RAGE WARNING
    if (this.boss._rage) {
      ctx.save();
      ctx.fillStyle=`rgba(255,40,40,${0.6+0.4*Math.sin(Date.now()*0.01)})`;
      ctx.font='bold 11px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('RAGE', x+bw/2, y-12);
      ctx.restore();
    }
  }

  _drawIntroCaption(){
    const ctx=this.ctx;
    const caps=['A peaceful day with your friend...','The boss has kidnapped your friend!','Go rescue them!'];
    const cols=['#ffffff','rgb(220,40,60)','rgb(0,220,240)'];
    const capY=HUD_H+GAME_H-42;
    ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(0,capY,WIDTH,34);
    ctx.fillStyle=cols[this.introPhase]; ctx.font='bold 20px Arial';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(caps[this.introPhase],WIDTH/2,capY+17);
  }

  _drawVictory(){
    const ctx=this.ctx;
    const midY = HUD_H + GAME_H/2;

    ctx.fillStyle=COL.CYAN; ctx.font='bold 32px Arial';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('RESCUE SUCCESS!', WIDTH/2, midY - 80);

    // bonus breakdown (แสดงหลังเจอเพื่อน)
    if (this.reachedFriend && this.bonusBreakdown) {
      const b = this.bonusBreakdown;
      const rows = [
        { label: `⏱ Time  (${b.secElapsed}s)`, val: b.timeBonus,  col: 'rgb(100,220,255)' },
        { label: `❤ HP Bonus`,                  val: b.hpBonus,   col: 'rgb(220,80,80)'   },
        { label: `★ SPECIAL Bonus`,              val: b.spBonus,   col: 'rgb(255,160,40)'  },
        { label: `TOTAL BONUS`,                  val: b.totalBonus, col: COL.YELLOW         },
      ];
      rows.forEach((r, i) => {
        const y = midY - 40 + i * 32;
        ctx.font      = i===3 ? 'bold 20px Courier New' : '17px Courier New';
        ctx.fillStyle = r.col;
        ctx.textAlign = 'left';
        ctx.fillText(r.label, WIDTH/2 - 130, y);
        ctx.textAlign = 'right';
        ctx.fillText(`+${String(r.val).padStart(5,'0')}`, WIDTH/2 + 130, y);
      });
      // divider
      ctx.strokeStyle='rgba(255,255,255,0.15)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(WIDTH/2-130, midY+76); ctx.lineTo(WIDTH/2+130, midY+76); ctx.stroke();
    }

    if(this.victoryCanExit){
      ctx.fillStyle='#fff'; ctx.font='18px Arial'; ctx.textAlign='center';
      ctx.fillText('Tap SHOOT for Ranking', WIDTH/2, midY+120);
    }
  }

  _drawGameOver(){
    const ctx=this.ctx;
    ctx.fillStyle='rgba(0,0,0,0.67)'; ctx.fillRect(0,0,WIDTH,HEIGHT);
    ctx.fillStyle='rgb(220,40,60)'; ctx.font='bold 34px Arial';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('GAME OVER',WIDTH/2,HEIGHT/2-60);
    ctx.fillStyle=COL.YELLOW; ctx.font='bold 24px Courier New';
    ctx.fillText(`SCORE: ${String(this.player.score).padStart(6,'0')}`,WIDTH/2,HEIGHT/2-10);

    // single button
    const bx=WIDTH/2-110, by=HEIGHT/2+30, bw=220, bh=50;
    ctx.fillStyle='rgba(0,200,230,0.2)'; ctx.strokeStyle=COL.CYAN; ctx.lineWidth=2;
    this._rr(ctx,bx,by,bw,bh,10,true,true);
    ctx.fillStyle=COL.CYAN; ctx.font='bold 20px Arial';
    ctx.fillText('TAP SHOOT TO PLAY',WIDTH/2,by+bh/2);
  }

  // ── Main loop ─────────────────────────────────────
  loop(timestamp){
    if(!this.running) return;
    const delta=timestamp-this.lastTime;
    this.lastTime=timestamp;
    this.accumulator+=Math.min(delta,100);
    while(this.accumulator>=this.stepMs){ this.update(); this.accumulator-=this.stepMs; }
    this.draw();
    requestAnimationFrame(ts=>this.loop(ts));
  }

  start(){
    requestAnimationFrame(ts=>{ this.lastTime=ts; this.loop(ts); });
  }
}
