import Phaser from 'phaser';

const VW=854,VH=480,SAVE_KEY='wild-meat-tycoon-v1';
type Animal={x:number;z:number;kind:'bear'|'deer';hp:number;alive:boolean;vx:number;vz:number;bob:number;sprite?:Phaser.GameObjects.Image};
type Drop={x:number;z:number;count:number;phase:number};
type Save={money:number;bag:number;products:number;capacity:number;speedLevel:number;toolLevel:number;workers:number;highlands:boolean};

export class WildTycoon extends Phaser.Scene {
  world!:Phaser.GameObjects.Graphics; background!:Phaser.GameObjects.Image; hero!:Phaser.GameObjects.Image;
  bearTexture='wild-bear'; rangerTexture='wild-ranger';
  player={x:0,z:-90,vx:0,vz:0,face:1,speed:170,anim:0,moving:false};
  save:Save={money:0,bag:0,products:0,capacity:5,speedLevel:0,toolLevel:0,workers:0,highlands:false};
  animals:Animal[]=[]; drops:Drop[]=[]; trees:{x:number;z:number;size:number;pine:boolean}[]=[];
  keys!:Phaser.Input.Keyboard.KeyboardPlugin; held=new Set<string>();
  stick={id:null as number|null,x:88,y:392,dx:0,dy:0};
  hud!:Phaser.GameObjects.Text; actionText!:Phaser.GameObjects.Text; messageText!:Phaser.GameObjects.Text; rotateText!:Phaser.GameObjects.Text; rotateShade!:Phaser.GameObjects.Graphics; backText!:Phaser.GameObjects.Text; stickText!:Phaser.GameObjects.Text; stationLabels:Phaser.GameObjects.Text[]=[];
  message='';messageTimer=0;attackCooldown=0;anim=0;autoSale=0;portrait=false;lastAction='';

  constructor(){super('wild')}
  preload(){
    this.load.image('wild-bg',new URL('./assets/wild-clearing-wide.png',import.meta.url).href);
    this.load.image(this.rangerTexture,new URL('./assets/wild-ranger.png',import.meta.url).href);
    this.load.image(this.bearTexture,new URL('./assets/wild-bear.png',import.meta.url).href);
    this.load.image('wild-deer',new URL('./assets/wild-deer.png',import.meta.url).href);
  }
  create(){
    this.scale.setGameSize(VW,VH);this.loadSave();
    this.background=this.add.image(VW/2,VH/2,'wild-bg').setDisplaySize(VW,VH).setDepth(-20);
    this.world=this.add.graphics().setScrollFactor(0).setDepth(5);
    this.hero=this.add.image(VW/2,352,this.rangerTexture).setOrigin(.5,.88).setDisplaySize(112,168).setDepth(180);
    this.makeMap();this.spawnAnimals();
    this.keys=this.input.keyboard!;this.input.addPointer(4);
    this.input.on('pointerdown',(p:Phaser.Input.Pointer)=>this.pointerDown(p));
    this.input.on('pointermove',(p:Phaser.Input.Pointer)=>this.pointerMove(p));
    this.input.on('pointerup',(p:Phaser.Input.Pointer)=>this.pointerUp(p));
    this.input.on('pointerupoutside',(p:Phaser.Input.Pointer)=>this.pointerUp(p));
    this.input.keyboard?.on('keydown',(e:KeyboardEvent)=>this.keyDown(e));
    this.input.keyboard?.on('keyup',(e:KeyboardEvent)=>this.held.delete(e.key.toLowerCase()));
    this.hud=this.add.text(20,16,'',{fontFamily:'Trebuchet MS',fontSize:'19px',color:'#fff5d7',stroke:'#24341d',strokeThickness:4}).setDepth(300).setScrollFactor(0);
    this.stationLabels=['ATELIER','MARCHÉ','ÉQUIPEMENT'].map(label=>this.add.text(0,0,label,{fontFamily:'Trebuchet MS',fontSize:'12px',fontStyle:'bold',color:'#fff2ca',stroke:'#3d3423',strokeThickness:3}).setOrigin(.5).setDepth(310).setScrollFactor(0));
    this.actionText=this.add.text(VW-94,VH-88,'EXPLORER',{fontFamily:'Trebuchet MS',fontSize:'15px',fontStyle:'bold',color:'#fff7df',align:'center',wordWrap:{width:114},stroke:'#593c20',strokeThickness:3}).setOrigin(.5).setDepth(301).setScrollFactor(0);
    this.messageText=this.add.text(VW/2,VH-180,'',{fontFamily:'Trebuchet MS',fontSize:'17px',fontStyle:'bold',color:'#fff7df',align:'center',stroke:'#25321d',strokeThickness:4}).setOrigin(.5).setDepth(301).setScrollFactor(0);
    this.rotateShade=this.add.graphics().setDepth(490).setScrollFactor(0);
    this.rotateText=this.add.text(VW/2,VH/2,'TOURNE TON TÉLÉPHONE\nÀ L’HORIZONTALE',{fontFamily:'Trebuchet MS',fontSize:'42px',fontStyle:'bold',color:'#fff7df',align:'center',stroke:'#284126',strokeThickness:6}).setOrigin(.5).setDepth(500).setScrollFactor(0).setVisible(false);
    this.backText=this.add.text(53,34,'MENU',{fontFamily:'Trebuchet MS',fontSize:'11px',fontStyle:'bold',color:'#fff7df',align:'center',stroke:'#23331f',strokeThickness:3}).setOrigin(.5).setDepth(301).setScrollFactor(0);
    this.stickText=this.add.text(88,VH-176,'GLISSE',{fontFamily:'Trebuchet MS',fontSize:'12px',fontStyle:'bold',color:'#fff7df',align:'center',stroke:'#23331f',strokeThickness:3}).setOrigin(.5).setDepth(301).setScrollFactor(0);
    this.events.on('destroy',()=>this.saveGame());
    this.scale.on('resize',()=>this.checkOrientation());window.addEventListener('orientationchange',()=>this.checkOrientation());this.checkOrientation();
    this.showMessage('Explore la forêt. Approche un animal et touche CHASSER.');
  }

  loadSave(){try{const raw=localStorage.getItem(SAVE_KEY);if(raw){const s=JSON.parse(raw) as Partial<Save>;this.save={...this.save,...s};this.save.money=Math.max(0,Number(this.save.money)||0);this.player.speed=170+this.save.speedLevel*25}}catch{/* Storage can be unavailable in private browsing. */}}
  saveGame(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(this.save))}catch{/* The game stays playable without persistence. */}}
  makeMap(){
    let seed=73;const rand=()=>{seed=(seed*9301+49297)%233280;return seed/233280};
    for(let i=0;i<155;i++){const x=(rand()-.5)*2100,z=-520+rand()*2700;if(Math.abs(x)>210||z<20)this.trees.push({x,z,size:38+rand()*38,pine:rand()>.22})}
  }
  spawnAnimals(){
    if(!this.animals.some(a=>a.kind==='bear'))for(let i=0;i<9;i++)this.animals.push(this.makeAnimal({x:(i%2?1:-1)*(130+((i*97)%450)),z:260+i*92,kind:'bear',hp:2+this.save.toolLevel,alive:true,vx:0,vz:0,bob:i}));
    if(this.save.highlands&&!this.animals.some(a=>a.kind==='deer'))for(let i=0;i<6;i++)this.animals.push(this.makeAnimal({x:(i%2?1:-1)*(190+i*55),z:1190+i*125,kind:'deer',hp:1+this.save.toolLevel,alive:true,vx:0,vz:0,bob:i+12}));
  }
  makeAnimal(animal:Animal){animal.sprite=this.add.image(0,0,animal.kind==='deer'?'wild-deer':this.bearTexture).setOrigin(.5,.9).setVisible(false).setDepth(200);return animal}
  pointerDown(p:Phaser.Input.Pointer){
    const x=p.x,y=p.y;
    if(x<90&&y<70){this.backToMenu();return}
    if(x<180&&y>VH-180){this.stick.id=p.id;this.pointerMove(p);return}
    if(x>VW-165&&y>VH-170)this.performAction();
  }
  pointerMove(p:Phaser.Input.Pointer){if(this.stick.id!==p.id)return;const dx=(p.x-this.stick.x)/58,dy=(p.y-this.stick.y)/58,len=Math.hypot(dx,dy)||1,k=Math.max(1,len);this.stick.dx=dx/k;this.stick.dy=dy/k}
  pointerUp(p:Phaser.Input.Pointer){if(this.stick.id===p.id){this.stick.id=null;this.stick.dx=0;this.stick.dy=0}}
  keyDown(e:KeyboardEvent){const k=e.key.toLowerCase();if(k==='escape'||k==='backspace'){this.backToMenu();return}this.held.add(k);if(k==='e'||k===' '){e.preventDefault();this.performAction()}}
  backToMenu(){this.saveGame();this.scale.setGameSize(480,854);this.requestDisplay('portrait');this.scene.start('theatre')}
  requestDisplay(orientation:'portrait'|'landscape'){
    const root=document.documentElement;
    const enter=()=>root.requestFullscreen?.().catch(()=>undefined);
    const screenOrientation=screen.orientation as unknown as {lock?:(value:'portrait'|'landscape')=>Promise<void>};
    const lock=()=>screenOrientation.lock?.(orientation).catch(()=>undefined);
    const promise=enter();if(promise)void promise.then(lock);else void lock();
  }
  checkOrientation(){this.portrait=window.matchMedia('(orientation: portrait)').matches;this.rotateText.setVisible(this.portrait)}
  showMessage(message:string){this.message=message;this.messageTimer=2.3;if(this.messageText)this.messageText.setText(message)}

  project(x:number,z:number){
    const dz=z-this.player.z,scale=Phaser.Math.Clamp(1/(1+Math.max(0,dz)/1500),.48,1.2);
    return{x:VW/2+(x-this.player.x)*.38*scale,y:VH*.67-dz*.24*scale,scale};
  }
  distance(x:number,z:number){return Math.hypot(x-this.player.x,z-this.player.z)}
  nearestAnimal(){return this.animals.filter(a=>a.alive).map(a=>({a,d:this.distance(a.x,a.z)})).sort((a,b)=>a.d-b.d)[0]}
  nearestDrop(){return this.drops.map(d=>({d,dist:this.distance(d.x,d.z)})).sort((a,b)=>a.dist-b.dist)[0]}
  station(which:'processor'|'market'|'upgrade'){return which==='processor'?{x:-205,z:-110}:which==='market'?{x:205,z:-110}:{x:0,z:-295}}
  nearStation(which:'processor'|'market'|'upgrade',range:number){const s=this.station(which);return this.distance(s.x,s.z)<range}
  actionName(){
    const drop=this.nearestDrop();if(drop&&drop.dist<125&&this.save.bag<this.save.capacity)return'RAMASSER';
    const animal=this.nearestAnimal();if(animal&&animal.d<265)return animal.a.kind==='deer'?'CHASSER LE CERF':'CHASSER';
    if(this.nearStation('processor',150)&&this.save.bag>0)return'TRANSFORMER';
    if(this.nearStation('market',150)&&this.save.products>0)return'VENDRE';
    if(this.nearStation('upgrade',155))return'AMÉLIORER';
    if(!this.save.highlands&&Math.abs(this.player.z-930)<180)return'OUVRIR LA ZONE';
    return'EXPLORER';
  }
  performAction(){
    const drop=this.nearestDrop();
    if(drop&&drop.dist<125){if(this.save.bag>=this.save.capacity){this.showMessage('Sac plein. Retourne à l’atelier.');return}this.save.bag+=Math.min(drop.d.count,this.save.capacity-this.save.bag);this.drops.splice(this.drops.indexOf(drop.d),1);this.saveGame();this.showMessage(`Récolte ramassée · sac ${this.save.bag}/${this.save.capacity}`);return}
    const target=this.nearestAnimal();
    if(target&&target.d<265&&this.attackCooldown<=0){this.attackCooldown=.48;target.a.hp-=1+this.save.toolLevel;if(target.a.hp<=0){target.a.alive=false;const count=target.a.kind==='deer'?3:2;this.drops.push({x:target.a.x,z:target.a.z,count,phase:0});this.showMessage(`${target.a.kind==='deer'?'Cerf':'Ours'} calmé · ${count} pièces à ramasser`)}else this.showMessage('Bien visé ! Encore un coup.');return}
    if(this.nearStation('processor',150)&&this.save.bag>0){const amount=this.save.bag;this.save.products+=amount;this.showMessage(`${amount} portions préparées à l’atelier`);this.save.bag=0;this.saveGame();return}
    if(this.nearStation('market',150)&&this.save.products>0){const amount=this.save.products;const revenue=amount*(this.save.highlands?20:12);this.save.products=0;this.save.money+=revenue;this.saveGame();this.showMessage(`Vente réussie · +${revenue} pièces`);return}
    if(this.nearStation('upgrade',155)){this.buyUpgrade();return}
    if(!this.save.highlands&&Math.abs(this.player.z-930)<180){if(this.save.money<120){this.showMessage('Le pont demande 120 pièces. Vends quelques portions.');return}this.save.money-=120;this.save.highlands=true;this.spawnAnimals();this.saveGame();this.showMessage('NOUVELLE ZONE : LES HAUTES TERRES !');return}
    this.showMessage('Explore, approche un animal ou retourne à ta base.');
  }
  buyUpgrade(){
    if(this.save.capacity<14){const cost=60+this.save.capacity*12;if(this.save.money>=cost){this.save.money-=cost;this.save.capacity+=3;this.showMessage(`Sac agrandi · capacité ${this.save.capacity}`)}else this.showMessage(`Sac +3 : ${cost} pièces`)}
    else if(this.save.speedLevel<3){const cost=90+this.save.speedLevel*65;if(this.save.money>=cost){this.save.money-=cost;this.save.speedLevel++;this.player.speed=170+this.save.speedLevel*25;this.showMessage('Bottes améliorées · déplacement plus rapide')}else this.showMessage(`Bottes rapides : ${cost} pièces`)}
    else if(this.save.toolLevel<3){const cost=120+this.save.toolLevel*80;if(this.save.money>=cost){this.save.money-=cost;this.save.toolLevel++;this.showMessage('Outil amélioré · moins de coups pour chasser')}else this.showMessage(`Outil renforcé : ${cost} pièces`)}
    else if(this.save.workers<3){const cost=180+this.save.workers*120;if(this.save.money>=cost){this.save.money-=cost;this.save.workers++;this.showMessage('Employé embauché · il vend les produits automatiquement')}else this.showMessage(`Employé : ${cost} pièces`)}
    else this.showMessage('Toutes les améliorations sont achetées !');
    this.saveGame();
  }

  update(_time:number,delta:number){
    const dt=Math.min(delta/1000,.04);this.anim+=dt;
    if(this.attackCooldown>0)this.attackCooldown-=dt;if(this.messageTimer>0){this.messageTimer-=dt;if(this.messageTimer<=0)this.messageText.setText('')}
    if(!this.portrait){
      const k=this.held,keyboardX=(k.has('d')||k.has('arrowright')?1:0)-(k.has('a')||k.has('arrowleft')?1:0),keyboardZ=(k.has('w')||k.has('arrowup')?1:0)-(k.has('s')||k.has('arrowdown')?1:0);
      let dx=this.stick.id!==null?this.stick.dx:keyboardX,dz=this.stick.id!==null?-this.stick.dy:keyboardZ;const len=Math.hypot(dx,dz);if(len>1){dx/=len;dz/=len}
      const speed=this.player.speed,response=1-Math.exp(-dt*10);
      this.player.vx=Phaser.Math.Linear(this.player.vx,dx*speed,response);this.player.vz=Phaser.Math.Linear(this.player.vz,dz*speed,response);
      this.player.moving=Math.hypot(this.player.vx,this.player.vz)>18;this.player.anim+=dt*(this.player.moving?8+Math.hypot(this.player.vx,this.player.vz)/speed*8:1.5);
      this.player.x=Phaser.Math.Clamp(this.player.x+this.player.vx*dt,-1000,1000);this.player.z=Phaser.Math.Clamp(this.player.z+this.player.vz*dt,-480,this.save.highlands?2450:900);
      if(dx)this.player.face=dx<0?-1:1;
      for(const a of this.animals){if(!a.alive)continue;a.bob+=dt*4;const px=this.player.x-a.x,pz=this.player.z-a.z,d=Math.hypot(px,pz);if(d<230){a.vx+=Math.sign(px)*24*dt;a.vz+=Math.sign(pz)*27*dt}else if(Math.sin(this.anim+a.bob)>0.985){a.vx=(Math.sin(this.anim*2+a.bob))*24;a.vz=(Math.cos(this.anim*2+a.bob))*20}a.x+=a.vx*dt;a.z+=a.vz*dt;a.vx*=Math.pow(.85,dt*60);a.vz*=Math.pow(.85,dt*60)}
      for(const drop of this.drops)drop.phase+=dt*2;
      if(this.save.workers>0&&this.save.products>0){this.autoSale+=dt;if(this.autoSale>9){this.autoSale=0;const sold=Math.min(this.save.products,this.save.workers);this.save.products-=sold;this.save.money+=sold*(this.save.highlands?20:12);this.saveGame();this.showMessage(`Tes employés ont vendu ${sold} portions.`)}}
    }
    this.background.setPosition(VW/2-this.player.x*.012,VH/2+this.player.z*.008).setTint(this.save.highlands&&this.player.z>1000?0xd8e8f1:0xffffff);
    const bounce=this.player.moving?Math.abs(Math.sin(this.player.anim*2.5)):0;
    this.hero.setPosition(VW/2+this.player.x*-.015,352+Math.sin(this.player.anim*2)*(this.player.moving?4:1)).setFlipX(this.player.face<0).setRotation(Math.sin(this.player.anim*1.4)*(this.player.moving ? .045 : .012)).setDisplaySize(112*(1+bounce*.035),168*(1-bounce*.035));
    this.drawWorld();this.updateHud();
  }

  drawTree(x:number,y:number,size:number,pine:boolean){
    const g=this.world,s=size;
    g.fillStyle(0x2b291f,.28);g.fillEllipse(x,y+4,s*1.1,s*.24);
    g.fillStyle(0x684b31,1);g.fillRoundedRect(x-s*.09,y-s*.65,s*.18,s*.72,s*.06);
    const color=pine?0x315d37:0x54723a,light=pine?0x467947:0x78924a;
    g.fillStyle(color,1);
    if(pine){g.fillTriangle(x,y-s*1.9,x-s*.58,y-s*.35,x+s*.58,y-s*.35);g.fillTriangle(x,y-s*1.5,x-s*.48,y-s*.05,x+s*.48,y-s*.05)}
    else{g.fillCircle(x,y-s*1.1,s*.53);g.fillCircle(x-s*.3,y-s*.88,s*.38);g.fillCircle(x+s*.3,y-s*.88,s*.4)}
    g.fillStyle(light,.58);g.fillCircle(x-s*.2,y-s*1.25,s*.15);
  }
  drawBuilding(x:number,z:number,color:number,label:string,kind:'market'|'processor'|'upgrade'){
    const q=this.project(x,z),g=this.world,s=q.scale;
    if(q.y<-40||q.y>VH+120||q.x<-140||q.x>VW+140)return;
    g.fillStyle(0x172719,.28);g.fillEllipse(q.x,q.y+4,110*s,24*s);
    g.fillStyle(0xc89a60,1);g.fillRect(q.x-46*s,q.y-45*s,92*s,46*s);
    g.fillStyle(color,1);g.fillTriangle(q.x-55*s,q.y-43*s,q.x,q.y-82*s,q.x+55*s,q.y-43*s);
    g.lineStyle(2,0x5c432d,.9);g.strokeRect(q.x-46*s,q.y-45*s,92*s,46*s);
    g.fillStyle(kind==='market'?0xffcf70:kind==='processor'?0x87bcb0:0xe4c778,1);g.fillRoundedRect(q.x-24*s,q.y-30*s,48*s,21*s,5*s);
    g.fillStyle(0x413325,.9);g.fillRect(q.x-8*s,q.y-28*s,16*s,28*s);
    g.fillStyle(0x263a28,.9);g.fillRoundedRect(q.x-62*s,q.y-103*s,124*s,17*s,7*s);
    g.lineStyle(1,0xf1dcad,.75);g.strokeRoundedRect(q.x-62*s,q.y-103*s,124*s,17*s,7*s);
    if(q.scale>.75)this.smallLabel(label,q.x,q.y-95*s);
  }
  smallLabel(label:string,x:number,y:number){const badge=label==='MARCHÉ'?0xffd37a:label==='ATELIER'?0x89c7ba:0xe5c679;this.world.fillStyle(0x23331f,.88);this.world.fillRoundedRect(x-57,y-12,114,22,7);this.world.lineStyle(1,0xe8d29d,.8);this.world.strokeRoundedRect(x-57,y-12,114,22,7);this.world.fillStyle(badge,1);this.world.fillCircle(x-45,y-1,3);}
  drawWorld(){
    const g=this.world;g.clear();
    for(const tree of this.trees){const q=this.project(tree.x,tree.z);if(q.y>-70&&q.y<VH+100&&q.x>-100&&q.x<VW+100)this.drawTree(q.x,q.y,tree.size*q.scale,tree.pine)}
    this.drawBuilding(-205,-110,0x6f8964,'ATELIER','processor');this.drawBuilding(205,-110,0x9a633b,'MARCHÉ','market');this.drawBuilding(0,-295,0x687d4a,'ÉQUIPEMENT','upgrade');
    // Winding river, trail markers and animated grass keep the landscape in motion as the camera travels.
    for(let i=0;i<9;i++){const z=120+i*180,q=this.project(575+Math.sin(this.anim*.35+i)*48,z);if(q.y>150&&q.y<VH){g.lineStyle(3+q.scale*10,0x55a7b2,.25);g.lineBetween(q.x-34*q.scale,q.y,q.x+34*q.scale,q.y+4*q.scale);g.lineStyle(1,0xd8e4a0,.4);g.lineBetween(q.x-18*q.scale,q.y-2*q.scale,q.x+24*q.scale,q.y-1*q.scale)}}
    for(const a of this.animals){if(!a.alive){a.sprite?.setVisible(false);continue}const q=this.project(a.x,a.z);if(q.y<-70||q.y>VH+110||q.x<-100||q.x>VW+100){a.sprite?.setVisible(false);continue}g.fillStyle(0x202b1b,.24);g.fillEllipse(q.x,q.y+2,55*q.scale,14*q.scale);if(a.sprite)a.sprite.setVisible(true).setPosition(q.x,q.y-18*q.scale+Math.sin(a.bob)*2).setDisplaySize((a.kind==='deer'?74:88)*q.scale,(a.kind==='deer'?56:64)*q.scale).setDepth(Math.round(q.y+20))}
    for(const drop of this.drops){const q=this.project(drop.x,drop.z),bob=Math.sin(drop.phase)*3;g.fillStyle(0x1e2a1c,.22);g.fillEllipse(q.x,q.y+4,34*q.scale,9*q.scale);g.fillStyle(0x815333,1);g.fillRoundedRect(q.x-18*q.scale,q.y-16*q.scale+bob,36*q.scale,22*q.scale,5*q.scale);g.lineStyle(2,0xe8c47b,1);g.strokeRoundedRect(q.x-18*q.scale,q.y-16*q.scale+bob,36*q.scale,22*q.scale,5*q.scale);g.fillStyle(0xffd77b,1);g.fillCircle(q.x,q.y-6*q.scale+bob,5*q.scale);g.fillStyle(0xfff1bd,1);g.fillCircle(q.x+8*q.scale,q.y-9*q.scale+bob,3*q.scale)}
    this.drawGate();this.drawCustomers();this.drawInterface();
  }
  drawGate(){const g=this.world,z=930,q=this.project(0,z);if(q.y<145||q.y>VH)return;g.fillStyle(0x574331,.85);g.fillRect(q.x-58*q.scale,q.y-18*q.scale,116*q.scale,10*q.scale);for(let i=-2;i<=2;i++)g.fillRect(q.x+i*21*q.scale-3*q.scale,q.y-59*q.scale,6*q.scale,42*q.scale);g.fillStyle(this.save.highlands?0x7ec27d:0xe3bd73,.8);g.fillCircle(q.x,q.y-45*q.scale,8*q.scale);}
  drawCustomers(){const g=this.world,q=this.project(205,-68);if(q.y<100||q.y>VH+70)return;for(let i=0;i<Math.min(4,2+this.save.workers);i++){const x=q.x-42*q.scale+i*26*q.scale,y=q.y+20*q.scale+Math.sin(this.anim*2+i)*2;g.fillStyle(0x1b2c1e,.25);g.fillEllipse(x,y+2,17*q.scale,5*q.scale);g.fillStyle([0xd88960,0x6f96b5,0xd8ba63,0x8e74a5][i],1);g.fillRoundedRect(x-7*q.scale,y-27*q.scale,14*q.scale,25*q.scale,6*q.scale);g.fillStyle(0xe9be91,1);g.fillCircle(x,y-32*q.scale,7*q.scale);g.fillStyle(0x514130,1);g.fillEllipse(x,y-38*q.scale,14*q.scale,6*q.scale)} }
  drawInterface(){
    const g=this.world,locked=!this.save.highlands;
    g.fillStyle(0x183020,.82);g.fillRoundedRect(14,12,340,61,13);g.lineStyle(2,0xe5d29c,.9);g.strokeRoundedRect(14,12,340,61,13);
    this.hud.setText(`WILD MEAT TYCOON   ·   ${this.save.money} pièces\nSAC ${this.save.bag}/${this.save.capacity}   ·   PRODUITS ${this.save.products}   ·   ${locked?'FORÊT':'HAUTES TERRES'}`);
    g.fillStyle(0x17291e,.56);g.fillCircle(this.stick.x,this.stick.y,68);g.lineStyle(3,0xf2d69c,.92);g.strokeCircle(this.stick.x,this.stick.y,68);g.fillStyle(0x8e663f,.96);g.fillCircle(this.stick.x+this.stick.dx*32,this.stick.y+this.stick.dy*32,31);g.lineStyle(2,0xffe8bc,1);g.strokeCircle(this.stick.x+this.stick.dx*32,this.stick.y+this.stick.dy*32,31);
    g.fillStyle(0x183020,.86);g.fillCircle(VW-94,VH-88,62);g.lineStyle(4,0xe7c878,1);g.strokeCircle(VW-94,VH-88,62);g.lineStyle(1,0xfff0c6,.55);g.strokeCircle(VW-94,VH-88,54);
    g.fillStyle(0x183020,.85);g.fillRoundedRect(12,VH-57,128,42,11);g.lineStyle(2,0xe5d29c,.85);g.strokeRoundedRect(12,VH-57,128,42,11);
    this.actionText.setPosition(VW-94,VH-88).setText(this.actionName());
    this.messageText.setAlpha(this.messageTimer>0?1:0);
    this.rotateShade.clear();if(this.portrait){this.rotateShade.fillStyle(0x142017,.96);this.rotateShade.fillRect(0,0,VW,VH);this.rotateText.setVisible(true)}else this.rotateText.setVisible(false);
    this.world.fillStyle(0x183020,.75);this.world.fillRoundedRect(15,18,78,31,10);this.world.lineStyle(2,0xe5d29c,.75);this.world.strokeRoundedRect(15,18,78,31,10);
  }
  updateHud(){
    const label=this.actionName();if(label!==this.lastAction){this.lastAction=label;this.actionText.setText(label)}
    const stations:[number,number][]=[[-205,-110],[205,-110],[0,-295]];
    for(let i=0;i<stations.length;i++){const q=this.project(stations[i][0],stations[i][1]);this.stationLabels[i].setPosition(q.x,q.y-94*q.scale).setScale(Phaser.Math.Clamp(q.scale,.72,1.05)).setVisible(!this.portrait&&q.y>105&&q.y<VH-80&&q.x>70&&q.x<VW-70)}
  }
}
