import Phaser from 'phaser';
import './style.css';
import { WildTycoon } from './WildTycoon';

const W = 480, H = 854;
type Mode = 'title'|'intro'|'fight'|'pause'|'next'|'loading'|'win'|'lose';
type Attack = { kind:string; x:number; y:number; vx:number; vy:number; life:number; warned?:number; safe?:boolean; homing?:boolean; damage?:number; speed?:number; radius?:number; weapon?:number };
type Control = 'left'|'right'|'jump'|'dash'|'fire'|'special'|'weapon';
const WEAPON_NAMES=['AIGUILLE','ÉVENTAIL','MORTIER'];
const LEVELS=[
  {name:'LE GRAND THÉÂTRE',boss:'MONSIEUR MINUIT',stage:'stage',portrait:'minuit',stageUrl:new URL('./assets/theatre-bg-v2.png',import.meta.url).href,bossUrl:new URL('./assets/monsieur-minuit.png',import.meta.url).href},
  {name:'LES TOITS DE BELLEVILLE',boss:'MADAME VOLTIGE',stage:'roof',portrait:'voltige',stageUrl:new URL('./assets/belleville-rooftops-v2.png',import.meta.url).href,bossUrl:new URL('./assets/madame-voltige.png',import.meta.url).href},
  {name:'LA FONDERIE DES RÊVES',boss:'LE BARON ROUILLE',stage:'foundry',portrait:'baron',stageUrl:new URL('./assets/dream-foundry-v2.png',import.meta.url).href,bossUrl:new URL('./assets/baron-rouille.png',import.meta.url).href},
];

class Theatre extends Phaser.Scene {
  mode:Mode='title'; g!:Phaser.GameObjects.Graphics; ui!:Phaser.GameObjects.Graphics; stageVisual!:Phaser.GameObjects.Image; mietteVisual!:Phaser.GameObjects.Image; bossVisual!:Phaser.GameObjects.Image; texts:Phaser.GameObjects.Text[]=[];
  held=new Set<Control>(); touchControls=new Map<number,Control>(); joystick={pointerId:null as number|null,baseX:82,baseY:777,dx:0}; keys!:Phaser.Input.Keyboard.KeyboardPlugin; player={x:115,y:650,vx:0,vy:0,hp:5,ground:true,invuln:0,dash:0,fire:0,charge:0,face:1,anim:0,weapon:0,recoil:0,land:0,coyote:0,jumpBuffer:0};
  boss={x:343,y:350,hp:100,max:100,phase:1,clock:0,attack:0,flash:0,pose:0}; attacks:Attack[]=[]; shots:Attack[]=[];
  clock=0; levelIndex=0; muted=false; audio?:AudioContext; hint=0; loadingWild=false; buttons:{key:Control| 'play'|'wild'|'pause'|'sound'|'retry'|'title'|'continue'; x:number;y:number;r:number;label:string}[]=[];
  titlePointerHandler?: (event:PointerEvent)=>void;
  constructor(){super('theatre')}
  preload(){
    const loadingBackdrop=this.add.rectangle(W/2,H/2,W,H,0x180b13).setDepth(1000);
    const loading=this.add.text(W/2,H/2-28,'OUVERTURE DU THÉÂTRE',{fontFamily:'Trebuchet MS',fontSize:'20px',fontStyle:'bold',color:'#f4e5c5',stroke:'#180b13',strokeThickness:5}).setOrigin(.5).setDepth(1001);
    const bar=this.add.graphics().setDepth(1001);
    const onProgress=(value:number)=>{bar.clear();bar.fillStyle(0x100910,.9);bar.fillRoundedRect(W/2-150,H/2+12,300,16,8);bar.fillStyle(0xd8b46f,1);bar.fillRoundedRect(W/2-146,H/2+16,292*value,8,4)};
    this.load.on(Phaser.Loader.Events.PROGRESS,onProgress);
    this.load.once(Phaser.Loader.Events.COMPLETE,()=>{this.load.off(Phaser.Loader.Events.PROGRESS,onProgress);loading.destroy();bar.destroy();loadingBackdrop.destroy()});
    if(!this.textures.exists('miette'))this.load.image('miette',new URL('./assets/miette.png',import.meta.url).href);
    if(!this.textures.exists(LEVELS[0].stage))this.load.image(LEVELS[0].stage,LEVELS[0].stageUrl);
    if(!this.textures.exists(LEVELS[0].portrait))this.load.image(LEVELS[0].portrait,LEVELS[0].bossUrl)
  }
  create(){this.scale.setGameSize(W,H);this.g=this.add.graphics();this.stageVisual=this.add.image(W/2,H/2,'stage').setDisplaySize(W,H).setDepth(-1);this.ui=this.add.graphics();this.mietteVisual=this.add.image(0,0,'miette').setOrigin(.5,1).setDisplaySize(86,103).setDepth(-.5);this.bossVisual=this.add.image(0,0,'minuit').setOrigin(.5,1).setDisplaySize(150,200).setDepth(-.5);this.keys=this.input.keyboard!;this.input.addPointer(4);this.scale.on('resize',()=>this.layout());this.input.on('pointerdown',(p:Phaser.Input.Pointer)=>this.pointerDown(p));this.input.on('pointermove',(p:Phaser.Input.Pointer)=>this.pointerMove(p));this.input.on('pointerup',(p:Phaser.Input.Pointer)=>this.pointerUp(p));this.input.on('pointerupoutside',(p:Phaser.Input.Pointer)=>this.pointerUp(p));this.input.keyboard?.on('keydown', (e:KeyboardEvent)=>this.keyDown(e));this.input.keyboard?.on('keyup',(e:KeyboardEvent)=>this.keyUp(e));this.titlePointerHandler=(event:PointerEvent)=>{if(this.mode!=='title')return;const rect=this.game.canvas.getBoundingClientRect(),x=(event.clientX-rect.left)*W/rect.width,y=(event.clientY-rect.top)*H/rect.height;if(x<=12||x>=W-12)return;if(y>=730&&y<=810){event.preventDefault();event.stopImmediatePropagation();this.startWild()}else if(y>=650&&y<730){event.preventDefault();event.stopImmediatePropagation();this.start()}};this.game.canvas.addEventListener('pointerdown',this.titlePointerHandler,true);this.layout();this.events.on('destroy',()=>{this.audio?.close();if(this.titlePointerHandler)this.game.canvas.removeEventListener('pointerdown',this.titlePointerHandler,true)})}
  layout(){this.cameras.main.setZoom(1);this.cameras.main.centerOn(W/2,H/2);this.cameras.main.setBounds(0,0,W,H)}
  keyDown(e:KeyboardEvent){
    if(e.repeat)return;const k=e.key.toLowerCase();
    if(k==='2'&&this.mode==='title'){this.startWild();return}
    if(k==='a'||k==='arrowleft')this.held.add('left');if(k==='d'||k==='arrowright')this.held.add('right');
    if(k===' '||k==='w'||k==='arrowup'){this.held.add('jump');this.jump()}
    if(k==='j'||k==='x'){this.held.add('fire');if(this.mode==='fight'){this.fire();this.player.fire=this.weaponCooldown()}}
    if(k==='1'||k==='2'||k==='3')this.player.weapon=Number(k)-1;
    if(k==='shift'||k==='k'){this.held.add('dash');this.dash()}
    if(k==='l'||k==='c')this.special();if(k==='escape'||k==='p')this.togglePause();
    if(k==='enter'&&this.mode==='title')this.start();else if(k==='enter'&&this.mode==='next')this.beginNextLevel()
  }
  keyUp(e:KeyboardEvent){const k=e.key.toLowerCase();if(k==='a'||k==='arrowleft')this.held.delete('left');if(k==='d'||k==='arrowright')this.held.delete('right');if(k===' '||k==='w'||k==='arrowup')this.held.delete('jump');if(k==='j'||k==='x')this.held.delete('fire');if(k==='shift'||k==='k')this.held.delete('dash')}
  pointerDown(p:Phaser.Input.Pointer){
    const point=this.cameras.main.getWorldPoint(p.x,p.y),x=point.x,y=point.y;
    if(this.mode==='title'){
      if(y>815)this.muted=!this.muted;
      else if(x>12&&x<W-12&&y>=730&&y<=810)this.startWild();
      else if(x>12&&x<W-12&&y>=650&&y<730)this.start();
      return
    }
    if(this.mode==='next'){if(y>610)this.beginNextLevel();return}
    if(this.mode==='pause'){if(y>450&&y<540){if(x<240)this.mode='fight';else this.reset('fight')}return}
    if(this.mode==='win'||this.mode==='lose'){if(y>620)this.reset(x<240?'title':'fight');return}
    if(this.mode!=='fight')return;
    if(x<158&&y>680){this.joystick.pointerId=p.id;this.pointerMove(p);return}
    const b=this.buttons.find(b=>Math.hypot(x-b.x,y-b.y)<b.r+18);if(!b)return;
    if(b.key==='pause')this.togglePause();else if(b.key==='weapon')this.cycleWeapon();else if(b.key==='left'||b.key==='right'||b.key==='fire')this.holdControl(p,b.key);else if(b.key==='jump')this.jump();else if(b.key==='dash')this.dash();else if(b.key==='special')this.special()
  }
  pointerMove(p:Phaser.Input.Pointer){if(this.joystick.pointerId!==p.id)return;const point=this.cameras.main.getWorldPoint(p.x,p.y);this.joystick.dx=Phaser.Math.Clamp((point.x-this.joystick.baseX)/42,-1,1)}
  holdControl(p:Phaser.Input.Pointer,key:Control){this.touchControls.set(p.id,key);if(key==='fire'&&!this.held.has('fire')){this.fire();this.player.fire=this.weaponCooldown()}this.held.add(key)}
  pointerUp(p:Phaser.Input.Pointer){if(this.joystick.pointerId===p.id){this.joystick.pointerId=null;this.joystick.dx=0;return}const key=this.touchControls.get(p.id);if(!key)return;this.touchControls.delete(p.id);if(!Array.from(this.touchControls.values()).includes(key))this.held.delete(key)}
  cycleWeapon(){this.player.weapon=(this.player.weapon+1)%WEAPON_NAMES.length;this.playTone(330,.06)}
  weaponCooldown(){return [0.23,0.38,0.82][this.player.weapon]}
  configureLevel(index:number){this.levelIndex=Phaser.Math.Clamp(index,0,LEVELS.length-1);const level=LEVELS[this.levelIndex];this.stageVisual.setTexture(level.stage);this.bossVisual.setTexture(level.portrait);this.boss.x=this.levelIndex===0?343:350;this.boss.y=350;this.boss.max=100+this.levelIndex*20;this.boss.hp=this.boss.max;this.boss.phase=1;this.boss.clock=0;this.boss.flash=0;this.boss.pose=0;this.boss.attack=1.25;this.attacks=[];this.shots=[]}
  requestDisplay(orientation:'portrait'|'landscape'){
    const lock=()=>{
      try{
        const screenOrientation=screen.orientation as unknown as {lock?:(value:'portrait'|'landscape')=>Promise<void>};
        const result=screenOrientation?.lock?.(orientation);if(result)void result.catch(()=>undefined);
      }catch{/* Some mobile browsers reject orientation locks synchronously. */}
    };
    try{
      const request=document.documentElement.requestFullscreen?.();
      if(request)void request.then(lock).catch(lock);else lock();
    }catch{/* Fullscreen is optional; it must never stop a game from starting. */lock()}
  }
  requestFullscreen(){try{const request=document.documentElement.requestFullscreen?.();if(request)void request.catch(()=>undefined)}catch{/* Fullscreen is optional; it must never stop a game from starting. */}}
  startWild(){if(this.mode!=='title')return;this.unlockAudio();this.mode='loading';this.loadingWild=true;this.requestFullscreen();this.scene.start('wild')}
  start(){this.unlockAudio();this.scale.setGameSize(W,H);this.requestDisplay('portrait');this.mode='intro';this.held.clear();this.touchControls.clear();this.joystick.pointerId=null;this.joystick.dx=0;this.player.weapon=0;this.player.hp=5;this.configureLevel(0);this.clock=0;this.player.x=110;this.player.y=650;this.player.vx=0;this.player.vy=0;this.player.charge=0;this.time.delayedCall(2100,()=>{if(this.mode==='intro')this.mode='fight'})}
  beginNextLevel(){const oldIndex=this.levelIndex,index=oldIndex+1,level=LEVELS[index],needed=[] as string[];this.mode='loading';this.held.clear();this.touchControls.clear();this.joystick.pointerId=null;this.joystick.dx=0;if(!this.textures.exists(level.stage)){this.load.image(level.stage,level.stageUrl);needed.push(level.stage)}if(!this.textures.exists(level.portrait)){this.load.image(level.portrait,level.bossUrl);needed.push(level.portrait)}const finish=()=>{if(oldIndex>0){this.textures.remove(LEVELS[oldIndex].stage);this.textures.remove(LEVELS[oldIndex].portrait)}this.player.hp=Math.min(5,this.player.hp+1);this.configureLevel(index);this.player.x=110;this.player.y=650;this.player.vx=0;this.player.vy=0;this.mode='fight'};if(needed.length){this.load.once(Phaser.Loader.Events.COMPLETE,finish);this.load.start()}else finish()}
  reset(m:Mode){this.mode=m;if(m==='fight'||m==='title'){this.player.hp=5;this.player.weapon=0;this.configureLevel(0);this.attacks=[];this.shots=[];this.clock=0;this.player.x=110;this.player.y=650;this.player.vx=0;this.player.vy=0;this.player.charge=0}}
  togglePause(){if(this.mode==='fight')this.mode='pause';else if(this.mode==='pause')this.mode='fight'}
  jump(){if(this.mode!=='fight')return;this.player.jumpBuffer=.15;if(this.player.ground||this.player.coyote>0)this.performJump()}
  performJump(){const p=this.player;p.vy=-525;p.ground=false;p.coyote=0;p.jumpBuffer=0;p.land=0;this.playTone(250,.07)}
  dash(){if(this.mode!=='fight'||this.player.dash>0)return;this.player.dash=.34;this.player.invuln=.48;this.player.vx=this.player.face*650;this.playTone(420,.08)}
  special(){if(this.mode!=='fight'||this.player.charge<100)return;this.player.charge=0;this.boss.hp=Math.max(0,this.boss.hp-20);this.boss.flash=.45;this.shots.push({kind:'super',x:this.player.x,y:this.player.y-35,vx:this.player.face*680,vy:0,life:.9});this.playTone(110,.28)}
  fire(){const weapon=this.player.weapon,x=this.player.x+this.player.face*27,y=this.player.y-38,dx=this.boss.x-x,dy=this.boss.y+25-y,length=Math.hypot(dx,dy)||1,angle=Math.atan2(dy,dx);this.player.recoil=.12;if(weapon===0){const speed=620;this.shots.push({kind:'shot',x,y,vx:dx/length*speed,vy:dy/length*speed,life:2,homing:true,speed,damage:1.25,radius:42,weapon})}else if(weapon===1){for(const offset of [-.24,0,.24]){const a=angle+offset,speed=540;this.shots.push({kind:'shot',x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life:1.5,damage:.7,radius:38,weapon})}}else{const speed=320;this.shots.push({kind:'shot',x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,life:2.2,damage:4.5,radius:76,weapon})}this.playTone(weapon===2?220:580,.045)}
  unlockAudio(){if(!this.muted&&!this.audio){try{this.audio=new AudioContext()}catch{}}}
  playTone(freq:number,dur:number){if(this.muted||!this.audio)return;const o=this.audio.createOscillator(),g=this.audio.createGain();o.type='triangle';o.frequency.value=freq;g.gain.setValueAtTime(.035,this.audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,this.audio.currentTime+dur);o.connect(g);g.connect(this.audio.destination);o.start();o.stop(this.audio.currentTime+dur)}
  update(_t:number,delta:number){const dt=Math.min(delta/1000,.04);this.clock+=dt;this.player.anim+=dt*9;if(this.player.recoil>0)this.player.recoil-=dt;if(this.player.land>0)this.player.land-=dt;if(this.boss.pose>0)this.boss.pose-=dt;if(this.mode==='fight')this.updateFight(dt);this.draw()}
  updateFight(dt:number){const p=this.player,b=this.boss;b.clock+=dt;if(p.invuln>0)p.invuln-=dt;if(p.dash>0)p.dash-=dt;if(b.flash>0)b.flash-=dt;
    if(p.ground)p.coyote=.13;else p.coyote=Math.max(0,p.coyote-dt);
    if(p.dash<=0){
      const buttons=(this.held.has('right')?1:0)-(this.held.has('left')?1:0),dir=this.joystick.pointerId!==null?this.joystick.dx:buttons;
      const response=1-Math.exp(-dt*(p.ground?17:8));
      if(Math.abs(dir)>.08){p.face=dir<0?-1:1;p.vx=Phaser.Math.Linear(p.vx,dir*270,response)}else p.vx=Phaser.Math.Linear(p.vx,0,1-Math.exp(-dt*(p.ground?19:3)));
    }
    p.x+=p.vx*dt;p.vy+=1550*dt;p.y+=p.vy*dt;
    if(p.y>=650){if(!p.ground&&p.vy>130)p.land=.13;p.y=650;p.vy=0;p.ground=true}
    p.x=Phaser.Math.Clamp(p.x,42,438);
    if(p.jumpBuffer>0){p.jumpBuffer=Math.max(0,p.jumpBuffer-dt);if(p.ground||p.coyote>0)this.performJump()}
    if(this.held.has('fire')){p.fire-=dt;if(p.fire<=0){this.fire();p.fire=this.weaponCooldown()}}else p.fire=0;
    const ratio=b.hp/b.max,next=ratio<.34?3:ratio<.67?2:1;if(next>b.phase){b.phase=next;b.attack=1.2;this.playTone(160,.4)}
    const range=this.levelIndex===1?(next>=2?82:48):(next>=2?52:18);b.x=350+Math.sin(b.clock*(this.levelIndex===1?.9:.36))*range;
    b.attack-=dt;if(b.attack<=0){this.spawnAttack();b.attack=Math.max(.9,2.5-(b.phase-1)*.45-this.levelIndex*.12)}
    for(const a of this.attacks){if(a.kind==='sweep'&&a.warned!>0){a.warned!-=dt;a.x=b.x-5}else{a.x+=a.vx*dt;a.y+=a.vy*dt}a.life-=dt;if(a.kind==='gear'||a.kind==='note')a.vy+=a.kind==='gear'?390*dt:0;if(a.kind==='beam'&&a.warned!>0)a.warned!-=dt;if(a.kind==='weight'&&a.warned!>0)a.warned!-=dt;
      if(a.kind==='beam'&&a.warned!>0||a.kind==='steam'&&a.warned!>0)a.warned!-=dt;
      const active=(!['beam','steam','weight','sweep'].includes(a.kind))||a.warned!<=0;if(active&&!a.safe&&p.invuln<=0&&Math.abs(a.x-p.x)<(a.kind==='beam'?310:a.kind==='steam'?38:a.kind==='sweep'?90:32)&&Math.abs(a.y-(p.y-28))<(a.kind==='beam'?35:35)){this.hit();a.life=0}}
    this.attacks=this.attacks.filter(a=>a.life>0&&a.x>-50&&a.x<530&&a.y<900);
    for(const s of this.shots){if(s.kind==='shot'&&s.homing){const dx=b.x-s.x,dy=b.y+25-s.y,distance=Math.hypot(dx,dy)||1;s.vx=dx/distance*(s.speed??520);s.vy=dy/distance*(s.speed??520)}s.x+=s.vx*dt;s.y+=s.vy*dt;s.life-=dt;if(s.kind==='shot'&&Math.hypot(s.x-b.x,s.y-(b.y+25))<(s.radius??42)){b.hp=Math.max(0,b.hp-(s.damage??1.5));p.charge=Math.min(100,p.charge+2.4);b.flash=.12;s.life=0}else if(s.kind==='super'&&Math.abs(s.x-b.x)<48&&Math.abs(s.y-(b.y+25))<95)s.life=0}
    this.shots=this.shots.filter(s=>s.life>0&&s.x>-30&&s.x<510);if(b.hp<=0){this.attacks=[];this.shots=[];this.mode=this.levelIndex<LEVELS.length-1?'next':'win'}if(p.hp<=0)this.mode='lose';
  }
  spawnAttack(){const b=this.boss,ph=b.phase,patterns=[ph===1?['sweep','weight','note']:ph===2?['gear','beam','note','weight']:['sweep','gear','beam','weight','note','finale'],ph===1?['gear','note','weight']:ph===2?['gear','beam','note','weight','finale']:['gear','beam','note','weight','finale'],ph===1?['steam','weight','note']:ph===2?['steam','gear','beam','weight']:['steam','gear','beam','weight','finale']];const opts=patterns[this.levelIndex],kind=opts[Math.floor(Math.random()*opts.length)];
    b.pose=.32;
    if(kind==='sweep'){this.attacks.push({kind,x:b.x-5,y:632,vx:-430,vy:0,life:1.9,warned:.65})}
    if(kind==='weight'){const x=Phaser.Math.Clamp(this.player.x+Phaser.Math.Between(-95,95),85,395);this.attacks.push({kind,x,y:80,vx:0,vy:340,life:2,warned:.95})}
    if(kind==='note'){const dx=this.player.x-b.x,dy=this.player.y-b.y-20,len=Math.hypot(dx,dy)||1;this.attacks.push({kind,x:b.x,y:b.y-35,vx:dx/len*190,vy:dy/len*190,life:3})}
    if(kind==='gear'){this.attacks.push({kind,x:b.x,y:b.y+20,vx:(this.player.x<b.x?-1:1)*185,vy:-300,life:3})}
    if(kind==='beam'){this.attacks.push({kind,x:240,y:620,vx:0,vy:0,life:1.35,warned:.8})}
    if(kind==='steam'){const x=Phaser.Math.Clamp(this.player.x+Phaser.Math.Between(-65,65),75,405);this.attacks.push({kind,x,y:625,vx:0,vy:0,life:1.55,warned:.9})}
    if(kind==='finale'){const safe=Phaser.Math.Between(0,1);for(let i=0;i<4;i++)this.attacks.push({kind:'weight',x:80+i*106,y:70,vx:0,vy:350,life:2,warned:.9,safe:i===safe||i===safe+1})}
  }
  hit(){const p=this.player;p.hp--;p.invuln=1.25;p.vx=-p.face*210;p.vy=-180;p.land=.16;this.cameras.main.shake(110,.003);this.playTone(90,.14)}
  draw(){const g=this.g;g.clear();this.mietteVisual.setVisible(false);this.bossVisual.setVisible(false);this.drawStageArtwork();this.drawBossArtwork();this.drawPlayer(g);this.drawAttacks(g);this.drawShots(g);this.drawUI();if(this.mode==='title')this.drawTitle();if(this.mode==='intro')this.drawIntro();if(this.mode==='next')this.drawNext();if(this.mode==='loading')this.drawLoading();if(this.mode==='pause')this.drawPause();if(this.mode==='win'||this.mode==='lose')this.drawResult()}
  drawStageArtwork(){
    const g=this.g,t=this.clock;
    this.stageVisual.setPosition(W/2+Math.sin(t*.12)*3,H/2+Math.sin(t*.24)*1.5);
    g.fillStyle(0x10080c,.1);g.fillRect(0,0,W,H);
    this.drawWorldLife(g,t);
    g.lineStyle(2,0xd9b46d,.48);g.lineBetween(0,650,W,650);
    for(let i=0;i<28;i++){
      const x=(i*79+Math.floor(t*(5+i%4))%520+520)%520-20;
      const y=(i*131+Math.floor(t*(8+i%3))%900+900)%900-20;
      const twinkle=.1+((Math.sin(t*2+i*2.13)+1)*.08);
      g.fillStyle(this.levelIndex===2?0xffb45e:0xf5dfb8,twinkle);g.fillCircle(x,y,1+(i%3)*.35);
    }
  }
  drawWorldLife(g:Phaser.GameObjects.Graphics,t:number){
    if(this.levelIndex===0){
      // The theatre's footlights breathe while two warm spotlights drift across the curtain.
      for(let i=0;i<2;i++){
        const x=138+i*205+Math.sin(t*.34+i*2)*34,alpha=.035+((Math.sin(t*1.4+i)+1)*.018);
        g.fillStyle(0xffd27c,alpha);g.fillTriangle(x-12,125,x+12,125,x+Math.sin(t*.5+i)*38,605);
      }
      for(let i=0;i<7;i++){
        const pulse=.58+Math.sin(t*3.4+i*.8)*.2;
        g.fillStyle(0xffd77e,pulse);g.fillCircle(28+i*70,637,4+Math.max(0,Math.sin(t*3.4+i*.8))*1.3);
      }
    }else if(this.levelIndex===1){
      // Slow clouds cross the Belleville skyline; chimney steam curls upward.
      for(let i=0;i<3;i++){
        const x=((i*205+t*(7+i*2))%570)-55,y=93+i*58+Math.sin(t*.35+i)*5;
        g.fillStyle(0xb4adc0,.13);g.fillEllipse(x,y,68,15);g.fillEllipse(x-15,y-5,28,13);g.fillEllipse(x+15,y-6,34,16);
      }
      for(let i=0;i<8;i++){
        const life=(t*.18+i*.137)%1,x=37+(i%2)*410+Math.sin(t*1.7+i)*8+life*12,y=268-life*92;
        g.fillStyle(0xd9d2dc,(1-life)*.18);g.fillCircle(x,y,2+life*5);
      }
      const airshipX=((t*14)%560)-40;
      g.fillStyle(0x1a1d2b,.58);g.fillEllipse(airshipX,212,30,8);g.fillRoundedRect(airshipX-8,214,16,5,2);
      g.lineStyle(1,0xd4a866,.55);g.lineBetween(airshipX-10,212,airshipX-15,210);g.lineBetween(airshipX+10,212,airshipX+15,210);
    }else{
      // The foundry breathes from its furnace; flywheels turn and hot cinders rise.
      for(const [cx,cy,radius,direction] of [[36,374,30,1],[444,435,24,-1]] as const){
        g.fillStyle(0x130e13,.6);g.fillCircle(cx,cy,radius+7);g.lineStyle(4,0xb37c43,.85);g.strokeCircle(cx,cy,radius);
        g.lineStyle(2,0xe5b861,.8);
        for(let spoke=0;spoke<8;spoke++){
          const a=t*direction+spoke*Math.PI/4;
          g.lineBetween(cx+Math.cos(a)*5,cy+Math.sin(a)*5,cx+Math.cos(a)*(radius-3),cy+Math.sin(a)*(radius-3));
        }
        g.fillStyle(0x34201c,1);g.fillCircle(cx,cy,5);
      }
      const glow=.09+((Math.sin(t*4)+1)*.045);
      g.fillStyle(0xff6c2f,glow);g.fillEllipse(240,625,190,66);
      for(let i=0;i<18;i++){
        const life=(t*.38+i*.113)%1,x=90+((i*61)%300)+Math.sin(t*3+i)*10,y=625-life*360;
        g.fillStyle(0xffb553,(1-life)*.72);g.fillCircle(x,y,1+((i*7)%3));
      }
      for(let i=0;i<2;i++){
        const life=(t*.22+i*.5)%1,x=115+i*250+Math.sin(t*2+i)*8,y=600-life*190;
        g.fillStyle(0xbcb2ad,(1-life)*.16);g.fillEllipse(x,y,13+life*13,22+life*22);
      }
    }
  }
  drawMietteArtwork(x:number,y:number,face:number,bob:number){
    const p=this.player,moving=Math.abs(p.vx)>35,run=Math.sin(p.anim*3.7),airborne=!p.ground;
    // Pose changes are driven by gameplay state so the silhouette reads clearly on small screens.
    const dash=p.dash>0,hit=p.invuln>.9&&p.land>0,shoot=p.recoil>0;
    let sx=1,sy=1,rotation=0,offsetY=0;
    if(dash){sx=1.22;sy=.78;rotation=-p.face*.16}
    else if(hit){sx=.82;sy=1.16;rotation=-p.face*.12;offsetY=-3}
    else if(airborne){sx=.91;sy=1.1;rotation=p.vy<0?-p.face*.08:p.face*.06;offsetY=p.vy<0?-2:2}
    else if(moving){sx=1+Math.abs(run)*.045;sy=1-run*.055;rotation=run*.075}
    else {const breathe=Math.sin(p.anim*.65);sx=1+breathe*.012;sy=1-breathe*.018;rotation=breathe*.018}
    if(shoot){sx*=.96;sy*=1.025;rotation-=face*.04}
    const recoil=shoot?p.recoil/.12:0;
    this.mietteVisual.setPosition(x-p.face*recoil*4,y+bob+offsetY).setDisplaySize(86*sx-recoil*3,103*sy).setRotation(rotation).setFlipX(face<0).setTint(0xffffff).setVisible(true)
  }
  drawBossArtwork(){
    const b=this.boss,anticipation=b.attack>0&&b.attack<.6?1-b.attack/.6:0,recovery=b.pose>0?b.pose/.32:0,width=this.levelIndex===0?150:180;
    const wobble=Math.sin(b.clock*(this.levelIndex===1?1.6:.8))*2;
    this.bossVisual.setPosition(b.x+wobble,b.y+104+Math.sin(b.clock*2.2)*4+recovery*4)
      .setDisplaySize(width*(1+anticipation*.07-recovery*.035),200*(1-anticipation*.04+recovery*.02))
      .setRotation(Math.sin(b.clock*1.1)*.035-anticipation*.09+recovery*.04)
      .setTint(b.flash>0?0xfff2cc:0xffffff).setVisible(true)
  }
  drawStage(g:Phaser.GameObjects.Graphics){g.fillGradientStyle(0x231019,0x231019,0x3d1823,0x3d1823,1);g.fillRect(0,0,W,H);g.fillStyle(0x180b13,.9);g.fillRect(0,0,W,72);g.fillStyle(0x6a2632,.48);g.fillRect(0,75,480,425);for(let i=0;i<8;i++){const x=12+i*65;g.fillStyle(i%2?0x4a1725:0x581e2b,1);g.fillTriangle(x,60,x+73,60,x+35,420);g.lineStyle(2,0xc49658,.55);g.lineBetween(x+34,66,x+34,415);g.fillStyle(0x8b3036,.65);g.fillTriangle(x-8,62,x+45,62,x+22,175);}
    g.fillStyle(0x25131b,1);g.fillRect(0,422,480,203);g.lineStyle(3,0xd0a766,.8);g.strokeRect(16,94,448,325);for(let i=0;i<7;i++){const x=28+i*70;g.fillStyle(0xf0cb82,.9);g.fillCircle(x,637,4);g.fillStyle(0xe6b65e,.13);g.fillTriangle(x-19,637,x+19,637,x,538)}
    g.fillGradientStyle(0x52232a,0x52232a,0x2d141c,0x2d141c,1);g.fillRect(0,650,480,204);for(let y=667;y<854;y+=36){g.lineStyle(1,0xb5824a,.19);g.lineBetween(0,y,480,y)}for(let x=-100;x<600;x+=80){g.lineStyle(1,0xb5824a,.14);g.lineBetween(240,650,x,854)}
    g.lineStyle(3,0xd9b46d,.75);g.lineBetween(0,652,480,652);g.lineStyle(1,0xffdb86,.3);g.lineBetween(0,657,480,657);
    // Deco proscenium and hand-painted scenery
    g.lineStyle(2,0xd9b46d,.52);g.strokeRect(32,115,416,290);g.lineStyle(1,0xd9b46d,.3);g.strokeRect(41,124,398,272);g.fillStyle(0xd7b97d,.17);g.fillTriangle(240,126,210,260,270,260);g.fillStyle(0xd7b97d,.08);g.fillTriangle(240,126,130,330,200,290);g.fillStyle(0xd7b97d,.08);g.fillTriangle(240,126,350,330,280,290);
    g.lineStyle(3,0x8c613a,.85);g.lineBetween(70,392,70,360);g.lineBetween(404,392,404,360);g.fillStyle(0xd8b36d,.75);g.fillCircle(70,356,5);g.fillCircle(404,356,5);
    // Grain flecks
    for(let i=0;i<18;i++){const x=(i*79+Math.floor(this.clock*8)%480)%480,y=(i*131+Math.floor(this.clock*13)%854)%854;g.fillStyle(0xf5dfb8,.11);g.fillCircle(x,y,1)}}
  drawPlayer(g:Phaser.GameObjects.Graphics){
    const p=this.player;
    if(this.mode==='title'){this.drawMietteArtwork(161,650,1,0);return}if(this.mode==='intro')return;
    const altitude=Math.max(0,650-p.y),shadowScale=Phaser.Math.Clamp(1-altitude/520,.42,1);
    g.fillStyle(0x10090d,.34);g.fillEllipse(p.x,654,48*shadowScale,13*shadowScale);
    if(p.dash>0){
      for(let i=0;i<4;i++){
        const tail=p.x-p.face*(24+i*13),fade=(1-i/4)*.32;
        g.lineStyle(5-i*.8,0xf5d298,fade);g.lineBetween(tail,p.y-32+Math.sin(this.clock*35+i)*3,tail-p.face*8,p.y-34+Math.sin(this.clock*35+i)*3);
      }
    }else if(p.ground&&Math.abs(p.vx)>90&&Math.sin(p.anim*3.7)>.65){
      const puff=(Math.sin(p.anim*3.7)-.65)*13;
      g.fillStyle(0xf0d6ab,.25);g.fillEllipse(p.x-p.face*19,645,7+puff,4+puff*.3);
      g.fillStyle(0xf0d6ab,.16);g.fillEllipse(p.x-p.face*27,641,5+puff*.5,3+puff*.2);
    }
    if(p.invuln>0&&Math.floor(this.clock*15)%2===0)return;
    this.drawMietteArtwork(p.x,p.y,p.face,Math.sin(p.anim)*2);
    if(p.recoil>0){
      const x=p.x+p.face*38,y=p.y-43,flash=Phaser.Math.Clamp(p.recoil/.12,0,1);
      g.fillStyle(0xffd47e,.85*flash);g.fillTriangle(x,y-8,x+p.face*22,y,x,y+8);
      g.fillStyle(0xfff1c4,.95*flash);g.fillCircle(x+p.face*7,y,4*flash);
    }
  }
  drawMiette(g:Phaser.GameObjects.Graphics,x:number,y:number,face:number,bob:number){const f=face;g.fillStyle(0x0d080c,.35);g.fillEllipse(x,y+3,48,12);g.lineStyle(4,0x171016,1);g.fillStyle(0xd9c8a4,1);g.fillEllipse(x,y-36+bob,33,44);g.fillStyle(0x8a3034,1);g.fillRoundedRect(x-16,y-20+bob,32,27,7);g.lineStyle(3,0x1b1214,1);g.strokeRoundedRect(x-16,y-20+bob,32,27,7);g.fillStyle(0x181116,1);g.fillEllipse(x+7*f,y-43+bob,6,10);g.fillStyle(0xffdf8c,1);g.fillCircle(x+8*f,y-44+bob,2);g.lineStyle(4,0x171016,1);g.lineBetween(x-7,y-60+bob,x+5*f,y-61+bob);g.fillStyle(0xdec9a2,1);g.fillEllipse(x-23*f,y-27+bob,13,16);g.fillEllipse(x+23*f,y-25+bob,13,16);g.fillStyle(0xede0c4,1);g.fillRoundedRect(x-27*f,y-35+bob,15,17,5);g.fillRoundedRect(x+13*f,y-32+bob,15,17,5);g.lineStyle(5,0x20151a,1);g.lineBetween(x-10,y-17+bob,x-11,y-4);g.lineBetween(x+9,y-17+bob,x+11,y-4);g.fillStyle(0x242026,1);g.fillEllipse(x-12,y-1,12,6);g.fillEllipse(x+12,y-1,12,6);g.lineStyle(2,0xbe8a4b,1);g.lineBetween(x,y-63+bob,x+3,y-72+bob);g.fillStyle(0xbe8a4b,1);g.fillCircle(x+3,y-74+bob,3)}
  drawBoss(g:Phaser.GameObjects.Graphics){if(['title','intro'].includes(this.mode))return;const b=this.boss,x=b.x,y=b.y;g.fillStyle(0x110a0e,.4);g.fillEllipse(x,y+94,86,18);g.lineStyle(5,0x211317,1);g.fillRoundedRect(x-31,y+5,62,83,12);g.fillStyle(b.flash>0?0xffffff:0x60232c,1);g.fillRoundedRect(x-35,y+5,70,78,12);g.lineStyle(3,0xd4a85e,1);g.strokeRoundedRect(x-35,y+5,70,78,12);g.fillStyle(0xa87337,1);g.fillCircle(x-26,y+20,5);g.fillCircle(x+26,y+20,5);g.lineStyle(8,0x9b6633,1);g.lineBetween(x-23,y+26,x-47,y+58);g.lineBetween(x+23,y+26,x+46,y+53);g.fillStyle(0x2d171d,1);g.fillRoundedRect(x-52,y+49,18,11,5);g.fillRoundedRect(x+37,y+46,18,11,5);g.lineStyle(9,0x9b6633,1);g.lineBetween(x-17,y+78,x-22,y+99);g.lineBetween(x+17,y+78,x+22,y+99);g.fillStyle(0x201318,1);g.fillEllipse(x-23,y+100,22,9);g.fillEllipse(x+23,y+100,22,9);
    g.lineStyle(4,0x171016,1);g.fillCircle(x,y-19,35);g.fillStyle(b.flash>0?0xffffff:0xe0c998,1);g.fillCircle(x,y-19,31);g.fillStyle(0x24131c,1);g.fillTriangle(x-2,y-49,x+31,y-18,x-2,y+12);g.lineStyle(2,0xa27644,.8);g.strokeCircle(x,y-19,32);g.fillStyle(0xffe1a0,1);g.fillCircle(x-9,y-17,4);g.fillStyle(0x1e1117,1);g.fillCircle(x-9,y-17,2);g.lineStyle(3,0x20131a,1);g.lineBetween(x-20,y-34,x-3,y-33);g.fillStyle(0xc18a47,1);g.fillTriangle(x-24,y-48,x+7,y-48,x-8,y-76);g.fillCircle(x-8,y-77,6);g.lineStyle(4,0x25141b,1);g.lineBetween(x+6,y+26,x+44,y+70);g.lineStyle(3,0xd6b36a,1);g.lineBetween(x+44,y+70,x+55,y+91);g.fillCircle(x+56,y+93,4);
    for(let i=0;i<3;i++){g.lineStyle(1,0xd8b866,.24);g.lineBetween(x-48+i*9,y-3,x-40+i*9,y+45)}}
  drawAttacks(g:Phaser.GameObjects.Graphics){const g2=g;for(const a of this.attacks){if(a.kind==='steam'){if(a.warned!>0){g2.lineStyle(2,0xed9c58,.8);g2.lineBetween(a.x,390,a.x,625);g2.strokeCircle(a.x,652,28)}else{g2.fillStyle(0xff974f,.46);g2.fillEllipse(a.x,535,65,210);g2.fillStyle(0xffd389,.8);g2.fillEllipse(a.x,592,32,130)}}else if(a.kind==='weight'){if(a.warned!>0){g2.fillStyle(0xffce74,.12);g2.fillEllipse(a.x,652,72,15);g2.lineStyle(2,0xf0c36a,.65);g2.strokeEllipse(a.x,652,68,12);g2.lineStyle(2,0xf0c36a,.42);g2.lineBetween(a.x,75,a.x,630)}else{g2.fillStyle(a.safe?0x80ceaa:0x9b6439,1);g2.fillCircle(a.x,a.y,21);g2.lineStyle(3,0x29181a,1);g2.strokeCircle(a.x,a.y,21);g2.lineStyle(2,0xe1bb75,1);g2.strokeCircle(a.x,a.y,12)}}else if(a.kind==='beam'){if(a.warned!>0){g2.lineStyle(3,0xf0d18c,.35);g2.lineBetween(18,620,462,620);g2.lineStyle(1,0xf0d18c,.5);g2.lineBetween(18,608,462,608)}else{g2.fillStyle(0xffdf98,.38);g2.fillRect(0,600,480,44);g2.fillStyle(0xfff0bd,.85);g2.fillRect(0,615,480,9)}}else if(a.kind==='sweep'){g2.lineStyle(8,0xc79b58,.9);g2.lineBetween(a.x,a.y,a.x+105,a.y-3);g2.fillStyle(0xffdda2,.25);g2.fillCircle(a.x+90,a.y,26)}else if(a.kind==='note'){g2.fillStyle(0xe7c783,1);g2.fillCircle(a.x,a.y,10);g2.lineStyle(3,0x21151a,1);g2.strokeCircle(a.x,a.y,10);g2.lineStyle(3,0xe7c783,1);g2.lineBetween(a.x+7,a.y-2,a.x+7,a.y-21);g2.lineBetween(a.x+7,a.y-21,a.x+17,a.y-17)}else{g2.fillStyle(0xb6814a,1);g2.fillCircle(a.x,a.y,17);g2.lineStyle(3,0x28181b,1);g2.strokeCircle(a.x,a.y,17);g2.lineStyle(2,0xe2bc74,1);g2.lineBetween(a.x-16,a.y,a.x+16,a.y);g2.lineBetween(a.x,a.y-16,a.x,a.y+16);g2.fillStyle(0x29171b,1);g2.fillCircle(a.x,a.y,5)}}}
  drawShots(g:Phaser.GameObjects.Graphics){for(const s of this.shots){if(s.kind==='super'){g.lineStyle(4,0xffe398,.42);g.lineBetween(s.x-s.vx*.035,s.y,s.x,s.y);g.fillStyle(0xffe398,1);g.fillEllipse(s.x,s.y,35,7);continue}g.lineStyle(s.weapon===2?5:3,s.weapon===2?0xe28d48:0xffe3a0,.28);g.lineBetween(s.x-s.vx*.025,s.y-s.vy*.025,s.x,s.y);if(s.weapon===2){g.fillStyle(0xe28d48,.9);g.fillCircle(s.x,s.y,10);g.lineStyle(2,0xffdda0,1);g.strokeCircle(s.x,s.y,10)}else if(s.weapon===1){g.fillStyle(0xf4d68e,1);g.fillCircle(s.x,s.y,5);g.fillStyle(0xfff1c8,.65);g.fillCircle(s.x-3,s.y-2,2)}else{g.fillStyle(0xffdc91,1);g.fillEllipse(s.x,s.y,14,7);g.fillStyle(0xfff0c9,.5);g.fillEllipse(s.x-5,s.y,21,3)}}}
  text(str:string,x:number,y:number,size:number,color='#f4e5c5',font='DM Mono',originX=.5){const t=this.add.text(x,y,str,{fontFamily:font,fontSize:`${size}px`,color,align:'center',stroke:'#180b13',strokeThickness:3}).setOrigin(originX,.5).setScrollFactor(0);this.texts.push(t);return t}
  drawUI(){this.texts.forEach(t=>t.destroy());this.texts=[];this.ui.clear();this.buttons=[];if(this.mode==='title'||this.mode==='intro'||this.mode==='next'||this.mode==='loading')return;
    this.text(LEVELS[this.levelIndex].boss,240,29,13,'#ead2a0');this.ui.fillStyle(0x120b10,.9);this.ui.fillRoundedRect(88,44,304,12,6);this.ui.fillStyle(0xc49450,1);this.ui.fillRoundedRect(90,46,300*(this.boss.hp/this.boss.max),8,4);this.text(`MONDE ${this.levelIndex+1}/${LEVELS.length}  ·  ACTE ${this.boss.phase}`,240,72,10,'#d0ad73');this.text('♥'.repeat(this.player.hp)+'♡'.repeat(5-this.player.hp),32,34,22,'#f1c6a3','serif',0);this.addButton('pause',438,39,18,'Ⅱ');this.text(`${Math.round(this.player.charge)}%`,423,78,10,'#edd99f');this.ui.lineStyle(2,0xcaa45e,.9);this.ui.strokeRoundedRect(391,69,64,9,4);this.ui.fillStyle(0xcaa45e,.8);this.ui.fillRoundedRect(393,71,60*this.player.charge/100,5,3);
    if(this.mode==='fight'){
      const active=this.joystick.pointerId!==null;
      this.ui.fillStyle(active?0x573c29:0x120b10,active?.72:.58);this.ui.fillCircle(this.joystick.baseX,this.joystick.baseY,70);
      this.ui.lineStyle(3,0xd4b46f,.9);this.ui.strokeCircle(this.joystick.baseX,this.joystick.baseY,70);
      this.ui.fillStyle(0x9b633d,.94);this.ui.fillCircle(this.joystick.baseX+this.joystick.dx*34,this.joystick.baseY,32);
      this.ui.lineStyle(2,0xffd88d,1);this.ui.strokeCircle(this.joystick.baseX+this.joystick.dx*34,this.joystick.baseY,32);
      this.text('←      →',this.joystick.baseX,this.joystick.baseY,15,'#fff0d2');
      this.text('GLISSE POUR BOUGER',this.joystick.baseX,694,9,'#f1d6a1');
      const arr:[Control,number,number,number,string][]=[['weapon',232,705,40,'ARME'],['fire',324,705,48,'TIR'],['special',416,705,48,'SPÉCIAL'],['jump',324,789,50,'SAUT'],['dash',416,789,50,'DASH']];
      for(const [key,x,y,r,label] of arr)this.addButton(key,x,y,r,label);
      this.text(WEAPON_NAMES[this.player.weapon],232,650,10,'#ffe2a8');
      if(this.hint<240){this.hint++;this.text('MAINTIENS TIR · SAUT ET DASH POUR ESQUIVER',319,635,9,'#f6e6c7')}
    }
    if(this.mode==='pause'){/* modal rendered after HUD */}}
  addButton(key:Control|'pause',x:number,y:number,r:number,label:string){
    const ready=key==='special'&&this.player.charge>=100,pressed=key!=='pause'&&this.held.has(key);
    this.ui.fillStyle(ready?0x9b6a34:pressed?0x704c32:0x120b10,.88);this.ui.fillCircle(x,y,r);
    this.ui.lineStyle(3,ready?0xffe19b:0xd4b46f,.98);this.ui.strokeCircle(x,y,r);
    this.ui.lineStyle(1,0xf7deb0,.42);this.ui.strokeCircle(x,y,r-5);
    const size=key==='weapon'?12:label.length>5?11:14;
    this.text(label,x,y,size,ready?'#fff0bf':'#fff0d2');this.buttons.push({key,x,y,r,label})
  }
  panel(){this.ui.fillStyle(0x100910,.83);this.ui.fillRect(0,0,W,H);this.ui.lineStyle(2,0xd0aa67,1);this.ui.strokeRoundedRect(38,265,404,310,12);this.ui.lineStyle(1,0xd0aa67,.5);this.ui.strokeRoundedRect(47,274,386,292,8)}
  drawTitle(){
    this.panel();this.text('LE GRAND',240,300,20,'#d6ae6c','Rye');this.text('DÉTRAQUÉ',240,342,36,'#f1dfbd','Rye');
    this.text('CHOISIS TON AVENTURE',240,390,12,'#d7bd8c');this.text('3 MONDES · 3 BOSS · COMBAT DE SCÈNE',240,422,9,'#bb8c58');
    this.drawMietteArtwork(156,610,1,0);this.boss.x=334;this.boss.y=535;this.drawBossArtwork();
    this.ui.fillStyle(0x70412f,.98);this.ui.fillRoundedRect(30,660,420,66,12);this.ui.lineStyle(2,0xe0bc75,1);this.ui.strokeRoundedRect(30,660,420,66,12);
    this.text('LE GRAND DÉTRAQUÉ',240,682,15,'#fff0cf','Rye');this.text('PORTRAIT · COMBAT · 3 MONDES',240,706,10,'#e8d2a7');this.buttons.push({key:'play',x:240,y:693,r:200,label:'LE GRAND DÉTRAQUÉ'});
    this.ui.fillStyle(0x42603b,.98);this.ui.fillRoundedRect(30,740,420,66,12);this.ui.lineStyle(2,0xd4e0a1,1);this.ui.strokeRoundedRect(30,740,420,66,12);
    this.text('WILD MEAT TYCOON',240,762,15,'#fff0cf','Rye');this.text('PAYSAGE · EXPLORATION · COMMERCE',240,786,9,'#e3dba9');this.buttons.push({key:'wild',x:240,y:773,r:200,label:'WILD MEAT TYCOON'});
    this.text(this.muted?'SON : OFF':'SON : ON',240,831,10,'#d7bf95');this.buttons.push({key:'sound',x:240,y:831,r:90,label:'sound'});
  }
  drawIntro(){this.drawMietteArtwork(155,650,1,0);this.boss.x=337;this.boss.y=393;this.drawBossArtwork();this.panel();this.text('MESDAMES, MESSIEURS…',240,363,14,'#edcf90','Rye');this.text(`${LEVELS[this.levelIndex].boss} ENTRE EN SCÈNE`,240,410,16,'#f4e4c3','Rye');this.text(LEVELS[this.levelIndex].name,240,460,10,'#c8ae85');this.text('Préparez-vous !',240,513,12,'#e4c783')}
  drawNext(){const next=LEVELS[this.levelIndex+1];this.panel();this.text('LE SPECTACLE CONTINUE',240,340,22,'#e9d3a5','Rye');this.text(`MONDE ${this.levelIndex+2} · ${next.name}`,240,405,13,'#e4c783');this.text(`PROCHAIN BOSS : ${next.boss}`,240,453,12,'#cbb289');this.text('MIETTE RÉCUPÈRE UN CŒUR',240,499,10,'#cbb289');this.ui.fillStyle(0x855437,1);this.ui.fillRoundedRect(118,638,244,58,8);this.ui.lineStyle(2,0xe0bc75,1);this.ui.strokeRoundedRect(118,638,244,58,8);this.text('TOUCHER POUR CONTINUER',240,667,11,'#f6e6c7')}
  drawLoading(){this.panel();this.text(this.loadingWild?'WILD MEAT TYCOON':'CHANGEMENT DE DÉCOR…',240,401,18,'#e9d3a5','Rye');this.text(this.loadingWild?'OUVERTURE DE LA FORÊT…':'MIETTE ENTRE EN SCÈNE',240,453,11,'#cbb289')}
  drawPause(){this.panel();this.text('ENTRACTE',240,342,27,'#e9d3a5','Rye');this.text('Reprenez le spectacle ?',240,400,12);this.ui.fillStyle(0x694332,1);this.ui.fillRoundedRect(73,465,145,58,7);this.ui.fillRoundedRect(262,465,145,58,7);this.text('REPRENDRE',145,494,11);this.text('RECOMMENCER',334,494,10);this.buttons.push({key:'pause',x:145,y:494,r:74,label:'resume'},{key:'retry',x:334,y:494,r:74,label:'restart'})}
  drawResult(){this.panel();const win=this.mode==='win';this.text(win?'CAMPAGNE TERMINÉE !':'À LA PROCHAINE, MIETTE.',240,352,win?21:19,'#e9d3a5','Rye');this.text(win?'LES TROIS MONDES SONT LIBRES.':`${LEVELS[this.levelIndex].boss} A GAGNÉ CE ROUND.`,240,405,10,'#cbb289');this.drawMietteArtwork(185,580,1,0);if(win)this.text('★',294,547,34,'#e1b568','serif');this.ui.fillStyle(0x855437,1);this.ui.fillRoundedRect(65,650,155,55,7);this.ui.fillRoundedRect(259,650,155,55,7);this.text('TITRE',142,678,13);this.text('REJOUER',336,678,13);this.buttons.push({key:'title',x:142,y:678,r:78,label:'title'},{key:'retry',x:336,y:678,r:78,label:'retry'})}
}
new Phaser.Game({type:Phaser.AUTO,parent:'game',backgroundColor:'#180b13',scale:{mode:Phaser.Scale.FIT,width:W,height:H,autoCenter:Phaser.Scale.CENTER_BOTH},render:{antialias:true,pixelArt:false,roundPixels:true},scene:[Theatre,WildTycoon],input:{activePointers:5},fps:{target:60,forceSetTimeOut:true}});
