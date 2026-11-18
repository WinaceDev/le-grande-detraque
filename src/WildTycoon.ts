import Phaser from 'phaser';
import * as THREE from 'three';
import { reportGameError } from './diagnostics';
import './wild-tycoon.css';

type AnimalKind='bear'|'deer';
type Animal={kind:AnimalKind;root:THREE.Group;legs:THREE.Group[];hp:number;alive:boolean;phase:number;home:THREE.Vector3};
type Drop={root:THREE.Group;amount:number};
type Save={money:number;bag:number;products:number;capacity:number;speed:number;tool:number;workers:number;highlands:boolean;story:number;guide:number};
type TutorialStep={title:string;body:string;target?:THREE.Vector3;action?:string;chapter:string};

const SAVE_KEY='wild-meat-tycoon-3d-story-v2';

export class WildTycoon extends Phaser.Scene {
  root!:HTMLDivElement;threeRenderer!:THREE.WebGLRenderer;world!:THREE.Scene;camera!:THREE.PerspectiveCamera;clock=new THREE.Clock();
  player!:THREE.Group;legs:THREE.Group[]=[];animals:Animal[]=[];drops:Drop[]=[];trees:THREE.Group[]=[];targetRing!:THREE.Mesh;
  gate?:THREE.Group;
  storyNpc!:THREE.Group;cookingFire!:THREE.Group;
  cameraYaw=0;cameraPitch=.45;cameraDistance=8;cameraPointer=-1;cameraLastX=0;cameraLastY=0;
  save:Save={money:0,bag:0,products:0,capacity:5,speed:0,tool:0,workers:0,highlands:false,story:0,guide:0};
  held=new Set<string>();stick={id:-1,x:0,y:0};move={x:0,z:0};tutorialStep=0;attackCooldown=0;elapsed=0;lastHud=0;messageUntil=0;message='';autoSale=0;respawnTimer=0;cleaned=false;
  hud!:HTMLElement;guide!:HTMLElement;actionButton!:HTMLButtonElement;joystick!:HTMLElement;joystickKnob!:HTMLElement;messageBox!:HTMLElement;
  onResize=()=>this.resize3D();onKeyDown=(e:KeyboardEvent)=>this.keyDown(e);onKeyUp=(e:KeyboardEvent)=>this.held.delete(e.key.toLowerCase());onVisibility=()=>{if(document.hidden)this.clock.stop();else this.clock.start()};
  onCameraDown=(e:PointerEvent)=>this.cameraDown(e);onCameraMove=(e:PointerEvent)=>this.cameraMove(e);onCameraUp=(e:PointerEvent)=>this.cameraUp(e);
  steps:TutorialStep[]=[];

  constructor(){super('wild')}
  preload(){}
  init(){this.save=this.loadSave();this.held.clear();this.animals=[];this.drops=[];this.trees=[];this.legs=[];this.tutorialStep=this.save.guide;this.elapsed=0;this.autoSale=0;this.respawnTimer=0;this.cleaned=false;this.clock=new THREE.Clock()}
  create(){
    try{
      this.root=document.createElement('div');this.root.className='wild3d';this.root.innerHTML=`
        <div class="w3d-top"><div class="w3d-brand"><span class="w3d-mark">🌲</span><span><b>WILD MEAT</b><small>TYCOON · FRONTIERA NORD</small></span></div><button class="w3d-menu" type="button">☰</button></div>
        <div class="w3d-stats"><span>🪙 <b data-money>0</b></span><span>🥩 <b data-bag>0/5</b></span><span>🍲 <b data-products>0</b></span></div>
        <section class="w3d-guide"><div class="w3d-guide-head"><span data-story>CHAPITRE 1 · LE CAMP DE MAËLLE</span><span data-step>1 / 11</span></div><b data-guide-title>Parle à Maëlle</b><p data-guide-body>La gardienne t’attend près du feu de camp.</p><div class="w3d-progress"><i data-progress></i></div></section>
        <div class="w3d-toast" aria-live="polite"></div>
        <div class="w3d-left-hint">GLISSE POUR<br>EXPLORER</div>
        <div class="w3d-stick"><i></i></div>
        <button class="w3d-action" type="button"><span>✦</span><b>EXPLORER</b></button>
        <button class="w3d-guide-toggle" type="button">GUIDE</button>
        <div class="w3d-controls-hint">JOYSTICK : BOUGER · GLISSE SUR LE DÉCOR : TOURNER LA CAMÉRA</div>`;
      document.body.appendChild(this.root);
      this.game.canvas.style.display='none';
      this.hud=this.root.querySelector('.w3d-stats')!;this.guide=this.root.querySelector('.w3d-guide')!;
      this.actionButton=this.root.querySelector('.w3d-action')!;this.joystick=this.root.querySelector('.w3d-stick')!;this.joystickKnob=this.joystick.querySelector('i')!;this.messageBox=this.root.querySelector('.w3d-toast')!;
      this.root.querySelector('.w3d-menu')!.addEventListener('click',()=>this.backToMenu());
      this.root.querySelector('.w3d-guide-toggle')!.addEventListener('click',()=>this.guide.classList.toggle('w3d-guide-open'));
      this.actionButton.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();this.performAction()});
      this.joystick.addEventListener('pointerdown',e=>this.stickDown(e));this.joystick.addEventListener('pointermove',e=>this.stickMove(e));
      this.joystick.addEventListener('pointerup',e=>this.stickUp(e));this.joystick.addEventListener('pointercancel',e=>this.stickUp(e));
      this.root.querySelector('canvas')?.addEventListener('pointerdown',this.onCameraDown);
      this.root.querySelector('canvas')?.addEventListener('pointermove',this.onCameraMove);
      this.root.querySelector('canvas')?.addEventListener('pointerup',this.onCameraUp);
      this.root.querySelector('canvas')?.addEventListener('pointercancel',this.onCameraUp);
      window.addEventListener('keydown',this.onKeyDown);window.addEventListener('keyup',this.onKeyUp);window.addEventListener('resize',this.onResize);window.addEventListener('orientationchange',this.onResize);document.addEventListener('visibilitychange',this.onVisibility);
      this.events.once('shutdown',()=>this.cleanup());
      this.build3DWorld();this.buildTutorial();this.resize3D();this.updateGuide();this.updateHud();
      document.body.dataset.wildState='ready';this.clock.start();this.animate();
    }catch(error){reportGameError(`Échec de création du monde 3D : ${error instanceof Error?error.message:String(error)}`)}
  }

  loadSave():Save{try{const raw=localStorage.getItem(SAVE_KEY);if(raw){const s=JSON.parse(raw) as Partial<Save>;return{money:Math.max(0,Number(s.money)||0),bag:Math.max(0,Number(s.bag)||0),products:Math.max(0,Number(s.products)||0),capacity:Math.max(5,Number(s.capacity)||5),speed:Math.max(0,Number(s.speed)||0),tool:Math.max(0,Number(s.tool)||0),workers:Math.max(0,Number(s.workers)||0),highlands:Boolean(s.highlands),story:Math.max(0,Number(s.story)||0),guide:Math.max(0,Number(s.guide)||0)}}}catch{/* Storage can be unavailable in private browsing. */}return{money:0,bag:0,products:0,capacity:5,speed:0,tool:0,workers:0,highlands:false,story:0,guide:0}}
  saveGame(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(this.save))}catch{/* Keep the game playable without persistence. */}}
  mat(color:number,roughness=1,metalness=0){return new THREE.MeshStandardMaterial({color,roughness,metalness})}
  box(parent:THREE.Object3D,size:[number,number,number],color:number,pos:[number,number,number],mat?:THREE.Material){const m=new THREE.Mesh(new THREE.BoxGeometry(...size),mat||this.mat(color));m.position.set(...pos);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
  sphere(parent:THREE.Object3D,r:number,color:number,pos:[number,number,number],scale:[number,number,number]=[1,1,1]){const m=new THREE.Mesh(new THREE.SphereGeometry(r,16,12),this.mat(color));m.position.set(...pos);m.scale.set(...scale);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
  group(parent:THREE.Object3D,pos:[number,number,number]=[0,0,0]){const g=new THREE.Group();g.position.set(...pos);parent.add(g);return g}
  build3DWorld(){
    this.world=new THREE.Scene();this.world.background=new THREE.Color(0x8dd1e8);this.world.fog=new THREE.Fog(0x8dd1e8,70,190);
    this.camera=new THREE.PerspectiveCamera(62,1,.1,260);this.camera.position.set(0,5.2,9.5);
    this.threeRenderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});this.threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));this.threeRenderer.shadowMap.enabled=true;this.threeRenderer.shadowMap.type=THREE.PCFSoftShadowMap;this.threeRenderer.outputColorSpace=THREE.SRGBColorSpace;this.threeRenderer.toneMapping=THREE.ACESFilmicToneMapping;this.threeRenderer.toneMappingExposure=1.15;this.root.prepend(this.threeRenderer.domElement);this.threeRenderer.domElement.className='w3d-canvas';
    this.world.add(new THREE.HemisphereLight(0xcaf1ff,0x557243,2.15));const sun=new THREE.DirectionalLight(0xffe1a2,3.2);sun.position.set(-35,55,18);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-65;sun.shadow.camera.right=65;sun.shadow.camera.top=70;sun.shadow.camera.bottom=-70;this.world.add(sun);
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(240,240),this.mat(0x70aa4b));ground.rotation.x=-Math.PI/2;ground.position.set(0,-.22,-42);ground.receiveShadow=true;this.world.add(ground);
    this.createPath();this.createRiver();this.createBridge();this.createMountains();this.createForest();this.createFlowers();
    this.player=this.makeRanger();this.world.add(this.player);this.player.position.set(0,0,3);
    this.addAnimal('bear',-2,-21,2);this.addAnimal('bear',9,-39,3);this.addAnimal('bear',-17,-57,4);
    if(this.save.highlands){this.addAnimal('deer',4,-104,1);this.addAnimal('deer',-12,-118,1)}
    const ring=new THREE.Mesh(new THREE.RingGeometry(1.3,1.65,32),new THREE.MeshBasicMaterial({color:0xffdd67,side:THREE.DoubleSide,transparent:true,opacity:.8}));ring.rotation.x=-Math.PI/2;ring.position.y=.08;this.world.add(ring);this.targetRing=ring;
    this.createStations();
  }
  createPath(){
    const path=new THREE.Mesh(new THREE.PlaneGeometry(9,155),this.mat(0xc99455));path.rotation.x=-Math.PI/2;path.position.set(0,-.1,-42);path.receiveShadow=true;this.world.add(path);
    const edge=new THREE.Mesh(new THREE.PlaneGeometry(11,155),this.mat(0x9c7242));edge.rotation.x=-Math.PI/2;edge.position.set(0,-.12,-42);this.world.add(edge);path.position.y=-.08;path.renderOrder=2;edge.renderOrder=1;
    const path2=new THREE.Mesh(new THREE.PlaneGeometry(48,5),this.mat(0xc99455));path2.rotation.x=-Math.PI/2;path2.position.set(0,-.06,17);this.world.add(path2);
  }
  createRiver(){
    const water=new THREE.Mesh(new THREE.PlaneGeometry(8,200),new THREE.MeshStandardMaterial({color:0x38b8ce,roughness:.24,metalness:.08,transparent:true,opacity:.9}));water.rotation.x=-Math.PI/2;water.position.set(22,-.12,-43);this.world.add(water);
    for(const x of [17.2,26.8]){const bank=new THREE.Mesh(new THREE.PlaneGeometry(1.8,200),this.mat(0xb39b62));bank.rotation.x=-Math.PI/2;bank.position.set(x,-.1,-43);this.world.add(bank)}
    for(let i=0;i<30;i++){const z=-136+i*6.5;const rock=this.sphere(this.world,.45,0x98aa8b,[18.5+Math.sin(i*7)*.4,-.02,z],[1.7,.65,.7]);rock.rotation.y=i*.8}
  }
  createBridge(){const g=this.group(this.world,[22,.2,-15]);for(let i=0;i<9;i++)this.box(g,[8,.22,1.1],i%2?0x9d7043:0xb7824b,[0,0,-4+i]);for(const x of [-3.5,3.5])for(const z of [-4,4])this.box(g,[.24,1.5,.24],0x704b31,[x,.75,z]);for(const x of [-3.5,3.5])this.box(g,[.22,.22,8.5],0x81583a,[x,1.43,0])}
  createMountains(){for(let i=0;i<11;i++){const h=18+(i*17%27),r=13+(i*13%15),m=new THREE.Mesh(new THREE.ConeGeometry(r,h,7),this.mat(i%2?0x748e76:0x90a982));m.position.set(-90+i*18,h/2-2,-133-(i%3)*11);m.castShadow=true;this.world.add(m);const snow=new THREE.Mesh(new THREE.ConeGeometry(r*.32,h*.34,7),this.mat(0xe9f0d8));snow.position.set(m.position.x,h*.82-2,m.position.z);this.world.add(snow)}}
  createForest(){
    let seed=931;const rand=()=>{seed=(seed*16807)%2147483647;return(seed&0x7fffffff)/2147483647};
    for(let i=0;i<44;i++){const side=rand()<.5?-1:1,x=side*(14+rand()*48),z=11-rand()*140;if(Math.abs(x-22)<8)continue;this.addTree(x,z,.7+rand()*.9,rand()>.58)}
    for(const side of [-1,1])for(let i=0;i<12;i++)this.addTree(side*(66+rand()*23),12-i*8,.8+rand()*.9,rand()>.4);
  }
  addTree(x:number,z:number,size:number,pine:boolean){const g=this.group(this.world,[x,0,z]);const trunk=this.mat(0x795036);const tm=new THREE.Mesh(new THREE.CylinderGeometry(.22*size,.38*size,2.4*size,7),trunk);tm.position.y=1.2*size;tm.castShadow=true;g.add(tm);if(pine){for(let i=0;i<3;i++){const crown=new THREE.Mesh(new THREE.ConeGeometry((2.1-i*.35)*size,(3.1-i*.2)*size,7),this.mat([0x397448,0x4b8750,0x609755][i]));crown.position.y=(3+i*1.3)*size;crown.castShadow=true;g.add(crown)}}else{this.sphere(g,1.65*size,0x57934b,[0,3.15*size,0],[1.15,1,.95]);this.sphere(g,1.05*size,0x79a94e,[-.8*size,3.5*size,.1],[1,1,.95]);this.sphere(g,.94*size,0x679d4c,[.9*size,3.7*size,-.1],[1.1,.9,1])}this.trees.push(g)}
  createFlowers(){for(let i=0;i<34;i++){const x=Math.sin(i*82.19)*13,z=-70+((i*29)%120);if(Math.abs(x)<5)continue;const f=this.group(this.world,[x,.02,z]);const stem=this.box(f,[.045,.35,.045],0x527c3b,[0,.17,0]);stem.castShadow=false;this.sphere(f,.12,[0xffd675,0xfff3c7,0xf39163,0xb7a8e2][i%4],[0,.38,0],[1,.45,1])}}
  makeRanger(){const g=new THREE.Group();const outfit=this.mat(0x397563),pants=this.mat(0x74563b),skin=this.mat(0xf0bc8a),boots=this.mat(0x4a3425),yellow=this.mat(0xe5ae48),hair=this.mat(0x593727);
    const body=this.sphere(g,.48,0x397563,[0,1.55,0],[.82,1.08,.62]);body.material=outfit;
    this.sphere(g,.38,0xf0bc8a,[0,2.42,-.03],[.83,1,.82]);this.sphere(g,.4,0x593727,[0,2.68,.02],[1,.55,.9]);this.sphere(g,.11,0xfff3d2,[-.13,2.44,-.34],[.55,.65,.35]);this.sphere(g,.11,0xfff3d2,[.13,2.44,-.34],[.55,.65,.35]);this.sphere(g,.052,0x263a32,[-.13,2.43,-.39]);this.sphere(g,.052,0x263a32,[.13,2.43,-.39]);
    this.sphere(g,.42,0xd78d35,[0,1.65,.43],[.84,1,.45]);this.box(g,[.16,.58,.13],0xd0a44f,[-.12,1.65,.82]);this.box(g,[.16,.58,.13],0xd0a44f,[.12,1.65,.82]);
    for(const side of [-1,1]){const arm=this.group(g,[side*.45,1.9,0]);const upper=this.sphere(arm,.17,0x397563,[side*.13,-.25,0],[.9,1.25,1]);upper.material=outfit;this.sphere(arm,.16,0xf0bc8a,[side*.22,-.52,-.02]);const leg=this.group(g,[side*.19,.76,0]);const thigh=this.sphere(leg,.18,0x74563b,[0,-.25,0],[1,1.35,1]);thigh.material=pants;this.sphere(leg,.19,0x4a3425,[0,-.55,-.07],[1.2,.55,1.6]);g.add(leg);this.legs.push(leg)}
    g.userData.arms=Array.from(g.children).filter((c:any)=>c.isGroup).slice(0,2);g.userData.outfit=outfit;g.userData.materials={outfit,pants,skin,boots,yellow,hair};return g;
  }
  addAnimal(kind:AnimalKind,x:number,z:number,hp:number){const root=new THREE.Group(),legs:THREE.Group[]=[];const fur=this.mat(kind==='bear'?0x604536:0x9b754b),dark=this.mat(kind==='bear'?0x392920:0x634629);
    this.sphere(root,kind==='bear'?.85:.62,kind==='bear'?0x604536:0x9b754b,[0,1,0],[kind==='bear'?1.1:1.3,.84,.78]);
    const head=this.group(root,[0,1.62,-.47]);this.sphere(head,kind==='bear'?.56:.4,kind==='bear'?0x684d3a:0xa88152,[0,0,0],[1,.9,.95]);
    if(kind==='bear'){for(const x0 of [-.36,.36]){this.sphere(head,.2,0x52392a,[x0,.42,0]);this.sphere(head,.1,0xe0bba1,[x0,.42,-.11])}this.sphere(head,.32,0x71523a,[0,-.14,-.37],[1,.62,.8]);this.sphere(head,.09,0x28231f,[0,-.07,-.68]);for(const x0 of [-.17,.17])this.sphere(head,.07,0x28231f,[x0,.12,-.44])}
    else{this.sphere(head,.18,0xe4d2a8,[0,-.1,-.35],[.75,.7,1.3]);for(const x0 of [-.22,.22]){const antler=this.box(head,[.09,.86,.09],0xc9ae7c,[x0*1.4,.74,0]);antler.rotation.z=x0>0?-.25:.25;this.box(head,[.42,.08,.08],0xc9ae7c,[x0*1.65,1.02,0])}this.sphere(head,.07,0x22221d,[-.15,.04,-.37]);this.sphere(head,.07,0x22221d,[.15,.04,-.37])}
    for(const sx of [-1,1])for(const sz of [-1,1]){const leg=this.group(root,[sx*(kind==='bear'?.55:.38),.63,sz*.43]);const shin=this.sphere(leg,.17,kind==='bear'?0x514033:0x80603e,[0,-.27,0],[.85,1.7,.95]);shin.material=fur;this.sphere(leg,.18,kind==='bear'?0x4e3c30:0x775839,[0,-.48,-.05],[1,.48,1.3]).material=dark;legs.push(leg)}
    root.position.set(x,0,z);this.world.add(root);this.animals.push({kind,root,legs,hp,alive:true,phase:Math.random()*6,home:new THREE.Vector3(x,0,z)});
  }
  createCabin(x:number,z:number,type:'workshop'|'market'|'upgrade'){
    const g=this.group(this.world,[x,0,z]),wall=type==='workshop'?0xf2d29b:type==='market'?0xf4e8cf:0xcbdc9b,roof=type==='workshop'?0x438160:type==='market'?0xc86d45:0x778e4f;
    this.box(g,[7,3.4,5],wall,[0,1.8,0]);const roofMesh=new THREE.Mesh(new THREE.ConeGeometry(5.1,2.6,4),this.mat(roof));roofMesh.rotation.y=Math.PI/4;roofMesh.position.set(0,4.7,0);roofMesh.scale.z=.7;roofMesh.castShadow=true;g.add(roofMesh);
    this.box(g,[1.3,2.35,.2],0x765033,[0,1.18,2.58]);this.sphere(g,.1,0xffd268,[.42,1.2,2.72],[.6,.6,.3]);
    const sign=this.makeSign(type==='workshop'?'ATELIER':type==='market'?'MARCHÉ':'ÉQUIPEMENT',type==='market'?0xd87040:0x41805b);const board=new THREE.Mesh(new THREE.PlaneGeometry(5.4,1.05),new THREE.MeshBasicMaterial({map:sign,transparent:true}));board.position.set(0,3.35,2.64);g.add(board);
    if(type==='workshop'){this.box(g,[.8,2,.8],0x88654a,[-2.5,4,0]);for(let i=0;i<3;i++){const puff=this.sphere(g,.38,0xe3e4dc,[-2.5+Math.sin(i)*.3,5.4+i*.35,Math.cos(i)*.2],[1,1,1]);puff.material.transparent=true;puff.material.opacity=.45}}
    if(type==='market'){for(const x0 of [-2,0,2]){const fruit=this.sphere(g,.3,[0xe56d47,0xeca931,0x9bc04d][(x0+2)/2],[x0,2.7,2.96]);fruit.scale.setScalar(.65)}}
    if(type==='upgrade'){const flag=this.box(g,[.15,3,.15],0x795639,[3.4,3.1,.3]);const pennant=new THREE.Mesh(new THREE.ConeGeometry(.6,1.3,3),this.mat(0xe2b84e));pennant.position.set(3.1,4.1,.3);pennant.rotation.z=-Math.PI/2;g.add(pennant);void flag}
    return g;
  }
  createStations(){this.createCabin(-10,16,'workshop');this.createCabin(10,16,'market');this.createCabin(0,27,'upgrade');this.createCookingStation();this.createAurore();this.createGate()}
  createCookingStation(){
    const g=this.group(this.world,[-10,0,29]);
    for(let i=0;i<8;i++){const a=i*Math.PI/4,rock=this.sphere(g,.43,0x7b7460,[Math.cos(a)*1.25,.28,Math.sin(a)*1.25],[1,.65,.85]);rock.rotation.y=a}
    const logs=this.box(g,[2.1,.24,.34],0x725036,[0,.25,0]);logs.rotation.y=.45;const log2=this.box(g,[2.1,.24,.34],0x8a603b,[0,.29,0]);log2.rotation.y=-.45;
    this.cookingFire=this.group(g,[0,.65,0]);const flame=new THREE.Mesh(new THREE.ConeGeometry(.52,1.35,7),new THREE.MeshStandardMaterial({color:0xf68a35,emissive:0xc44418,emissiveIntensity:1.5}));flame.position.y=.55;this.cookingFire.add(flame);const inner=new THREE.Mesh(new THREE.ConeGeometry(.27,.82,7),new THREE.MeshStandardMaterial({color:0xffd45c,emissive:0xff8c25,emissiveIntensity:1.8}));inner.position.set(0,.38,-.04);this.cookingFire.add(inner);
    for(const x of [-.68,.68]){const pole=this.box(g,[.12,2.5,.12],0x715036,[x,1.45,0]);pole.rotation.z=x*.17}this.box(g,[1.75,.13,.13],0x715036,[0,2.68,0]);
    const pot=new THREE.Mesh(new THREE.CylinderGeometry(.72,.48,.62,12),this.mat(0x4d554b,.42,.5));pot.position.set(0,2.28,0);pot.castShadow=true;g.add(pot);const soup=new THREE.Mesh(new THREE.CircleGeometry(.62,16),new THREE.MeshStandardMaterial({color:0xb96d38,roughness:.4}));soup.rotation.x=-Math.PI/2;soup.position.set(0,2.6,0);g.add(soup);
    const sign=this.makeSign('POSTE DE CUISSON',0xb76a35);const board=new THREE.Mesh(new THREE.PlaneGeometry(5.2,1),new THREE.MeshBasicMaterial({map:sign,transparent:true}));board.position.set(0,3.55,2.2);g.add(board);
  }
  createAurore(){
    const g=this.group(this.world,[-3.6,0,4.1]),coat=this.mat(0x477561),scarf=this.mat(0xe6ae4d);
    this.sphere(g,.48,0x477561,[0,1.45,0],[.8,1.1,.65]).material=coat;this.sphere(g,.34,0xe8b587,[0,2.27,-.05],[.9,1,.88]);this.sphere(g,.38,0x5b3828,[0,2.5,.02],[1,.48,.95]);this.sphere(g,.44,0xe6ae4d,[0,1.94,.1],[.83,.25,.74]).material=scarf;
    for(const x of [-.17,.17]){this.sphere(g,.055,0xfff3d6,[x,2.28,-.34]);this.sphere(g,.026,0x202a22,[x,2.28,-.38])}
    for(const x of [-.16,.16]){this.sphere(g,.15,0x74533a,[x,.48,0],[1,1.5,1]);this.box(g,[.3,.18,.48],0x503829,[x,.08,-.04])}
    const badge=new THREE.Mesh(new THREE.SphereGeometry(.3,12,8),new THREE.MeshBasicMaterial({color:0xffdc58}));badge.position.set(0,3.75,0);g.add(badge);this.storyNpc=g;
  }
  createGate(){const g=this.group(this.world,[0,0,-79]);for(const x of [-5,-2.5,0,2.5,5])this.box(g,[.35,5,.35],0x74583a,[x,2.5,0]);this.box(g,[12,.45,.5],0x8b673f,[0,5,0]);for(let i=-2;i<=2;i++)this.box(g,[1.6,.14,.2],0xbca06a,[i*2.4,2.6,.05]);this.makeSign('HAUTES TERRES',0x54834e,g,[0,4.1,-.34],5,1);this.gate=g}
  makeSign(label:string,color:number,parent:THREE.Object3D=this.world,pos:[number,number,number]=[0,0,0],w=5,h=1){const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d');if(!ctx)return new THREE.CanvasTexture(c);ctx.fillStyle=`#${color.toString(16).padStart(6,'0')}`;ctx.fillRect(4,4,504,120);ctx.fillStyle='#fff9dc';ctx.font='bold 52px Trebuchet MS, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label,256,66);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:tex,transparent:true}));mesh.position.set(...pos);parent.add(mesh);return tex}
  buildTutorial(){this.steps=[
    {chapter:'CHAPITRE 1 · LE CAMP DE MAËLLE',title:'Parle à Maëlle',body:'La gardienne t’attend près du feu. Approche-toi et touche PARLER.',target:new THREE.Vector3(-3.6,0,4.1),action:'PARLER'},
    {chapter:'CHAPITRE 1 · LE CAMP DE MAËLLE',title:'Trouve de la viande',body:'Suis le sentier vers le grand sapin. Approche l’ours et touche CHASSER.',target:new THREE.Vector3(-2,0,-21),action:'CHASSER'},
    {chapter:'CHAPITRE 1 · LE CAMP DE MAËLLE',title:'Ramasse la récolte',body:'L’ours a laissé une caisse. Approche-la et touche RAMASSER.',target:new THREE.Vector3(-2,0,-21),action:'RAMASSER'},
    {chapter:'CHAPITRE 1 · LE CAMP DE MAËLLE',title:'Allume la cuisine',body:'Ramène la viande au poste de cuisson. Prépare le premier repas du camp.',target:new THREE.Vector3(-10,0,29),action:'CUISINER'},
    {chapter:'CHAPITRE 1 · LE CAMP DE MAËLLE',title:'Nourris le camp',body:'Apporte les repas au marché. Maëlle pourra enfin rouvrir la route commerciale.',target:new THREE.Vector3(10,0,16),action:'VENDRE'},
    {chapter:'CHAPITRE 2 · LE COL OUBLIÉ',title:'Prépare l’expédition',body:'Maëlle a retrouvé la carte du col. Améliore tes bottes à la cabane ÉQUIPEMENT.',target:new THREE.Vector3(0,0,27),action:'AMÉLIORER'},
    {chapter:'CHAPITRE 2 · LE COL OUBLIÉ',title:'Rouvre le passage',body:'La porte est au nord. Il faut 120 pièces pour réparer le vieux pont et rejoindre les Hautes Terres.',target:new THREE.Vector3(0,0,-79),action:'OUVRIR LA PORTE'},
    {chapter:'CHAPITRE 3 · LES TRACES DANS LA NEIGE',title:'Suis les traces du cerf',body:'Au-delà du col, trouve un cerf et rapporte sa viande rare au camp.',target:new THREE.Vector3(4,0,-105),action:'CHASSER LE CERF'},
    {chapter:'CHAPITRE 3 · LES TRACES DANS LA NEIGE',title:'Ramasse la viande rare',body:'Le cerf a laissé trois morceaux. Ramasse-les avant de retourner au camp.',target:new THREE.Vector3(4,0,-105),action:'RAMASSER'},
    {chapter:'CHAPITRE 3 · LES TRACES DANS LA NEIGE',title:'Cuisine le festin',body:'Retourne au feu et prépare un repas rare pour les voyageurs du col.',target:new THREE.Vector3(-10,0,29),action:'CUISINER'},
    {chapter:'CHAPITRE 4 · LE MARCHÉ DES SOMMETS',title:'Rétablis la route',body:'Vends le festin au marché pour sceller l’accord entre le camp et les Hautes Terres.',target:new THREE.Vector3(10,0,16),action:'VENDRE'},
  ]}
  resize3D(){if(!this.threeRenderer||!this.camera||!this.root)return;const w=Math.max(1,this.root.clientWidth),h=Math.max(1,this.root.clientHeight);this.camera.aspect=w/h;this.camera.fov=h>w?68:56;this.cameraDistance=h>w?7.3:8.5;this.camera.updateProjectionMatrix();this.threeRenderer.setSize(w,h,false)}
  cameraDown(e:PointerEvent){if(e.button!==0||e.clientX<window.innerWidth*.34)return;this.cameraPointer=e.pointerId;this.cameraLastX=e.clientX;this.cameraLastY=e.clientY;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)}
  cameraMove(e:PointerEvent){if(e.pointerId!==this.cameraPointer)return;const dx=e.clientX-this.cameraLastX,dy=e.clientY-this.cameraLastY;this.cameraLastX=e.clientX;this.cameraLastY=e.clientY;this.cameraYaw-=dx*.006;this.cameraPitch=THREE.MathUtils.clamp(this.cameraPitch+dy*.004,.2,.95)}
  cameraUp(e:PointerEvent){if(e.pointerId===this.cameraPointer)this.cameraPointer=-1}
  stickDown(e:PointerEvent){e.preventDefault();this.stick.id=e.pointerId;this.joystick.setPointerCapture(e.pointerId);this.stickMove(e)}
  stickMove(e:PointerEvent){if(e.pointerId!==this.stick.id)return;const r=this.joystick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=e.clientX-cx,dy=e.clientY-cy,len=Math.hypot(dx,dy)||1,k=Math.min(1,42/len);this.move.x=dx/42*k;this.move.z=dy/42*k;this.joystickKnob.style.transform=`translate(${this.move.x*35}px,${this.move.z*35}px)`}
  stickUp(e:PointerEvent){if(e.pointerId!==this.stick.id)return;this.stick.id=-1;this.move.x=0;this.move.z=0;this.joystickKnob.style.transform='translate(0,0)'}
  keyDown(e:KeyboardEvent){const key=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(key))e.preventDefault();if(key==='escape'||key==='backspace'){this.backToMenu();return}if(key==='e'||key===' ')this.performAction();this.held.add(key)}
  backToMenu(){this.scene.start('theatre')}
  nearestAnimal(){return this.animals.filter(a=>a.alive).map(a=>({animal:a,d:a.root.position.distanceTo(this.player.position)})).sort((a,b)=>a.d-b.d)[0]}
  nearestDrop(){return this.drops.map(d=>({drop:d,d:d.root.position.distanceTo(this.player.position)})).sort((a,b)=>a.d-b.d)[0]}
  nearestStation(){return ([{type:'cook' as const,pos:new THREE.Vector3(-10,0,29),name:'POSTE DE CUISSON'},{type:'market' as const,pos:new THREE.Vector3(10,0,16),name:'MARCHÉ'},{type:'upgrade' as const,pos:new THREE.Vector3(0,0,27),name:'ÉQUIPEMENT'}]).map(s=>({...s,d:s.pos.distanceTo(this.player.position)})).sort((a,b)=>a.d-b.d)[0]}
  actionName(){const drop=this.nearestDrop();if(drop&&drop.d<3.5)return'RAMASSER';const animal=this.nearestAnimal();if(animal&&animal.d<5)return animal.animal.kind==='bear'?'CHASSER':'CHASSER LE CERF';if(this.tutorialStep===0&&this.storyNpc.position.distanceTo(this.player.position)<4.8)return'PARLER';const s=this.nearestStation();if(s.d<6&&s.type==='cook'&&this.save.bag>0)return'CUISINER';if(s.d<6&&s.type==='market'&&this.save.products>0)return'VENDRE';if(s.d<6&&s.type==='upgrade')return'AMÉLIORER';if(this.gate&&!this.save.highlands&&this.gate.position.distanceTo(this.player.position)<10)return this.save.money>=120?'OUVRIR LE COL':`COL · ${this.save.money}/120`;return'EXPLORER'}
  performAction(){
    if(this.tutorialStep===0&&this.storyNpc.position.distanceTo(this.player.position)<4.8){this.setTutorial(1,'Maëlle : « La tempête a coupé le col. Sans repas chauds, le camp va fermer. Aide-moi à rallumer la cuisine et nous sauverons la vallée. »');return}
    const drop=this.nearestDrop();if(drop&&drop.d<3.5){const n=Math.min(drop.drop.amount,this.save.capacity-this.save.bag);if(n<=0){this.toast('Ton sac est plein. Retourne au camp.');return}this.save.bag+=n;this.drops.splice(this.drops.indexOf(drop.drop),1);this.world.remove(drop.drop.root);this.saveGame();this.toast(`+${n} viande crue · sac ${this.save.bag}/${this.save.capacity}`);if(this.tutorialStep===2)this.setTutorial(3);else if(this.tutorialStep===8)this.setTutorial(9);return}
    const a=this.nearestAnimal();if(a&&a.d<5&&this.attackCooldown<=0){this.attackCooldown=.55;a.animal.hp-=1+this.save.tool;if(a.animal.hp<=0){a.animal.alive=false;this.world.remove(a.animal.root);const amount=a.animal.kind==='deer'?3:2;this.drops.push({root:this.makeCrate(a.animal.root.position),amount});this.toast(`Récolte prête · ${amount} morceaux`);if(this.tutorialStep===1)this.setTutorial(2);else if(this.tutorialStep===7&&a.animal.kind==='deer')this.setTutorial(8)}else{a.animal.root.scale.setScalar(.92);window.setTimeout(()=>a.animal.root.scale.setScalar(1),160);this.toast('Encore un coup !')}return}
    const s=this.nearestStation();if(s.d<6&&s.type==='cook'){if(!this.save.bag){this.toast('Apporte de la viande crue pour cuisiner.');return}const amount=this.save.bag;this.save.products+=amount;this.save.bag=0;this.saveGame();this.toast(`Le ragoût est prêt : ${amount} repas chauds !`);if(this.tutorialStep===3)this.setTutorial(4);else if(this.tutorialStep===9)this.setTutorial(10);return}
    if(s.d<6&&s.type==='market'){if(!this.save.products){this.toast('Apporte tes repas cuisinés au marché.');return}const amount=this.save.products,revenue=amount*(this.save.highlands?28:18);this.save.products=0;this.save.money+=revenue;this.saveGame();this.toast(`Vente réussie · +${revenue} pièces !`);if(this.tutorialStep===4)this.setTutorial(5,'Maëlle : « Le marché revit ! J’ai trouvé la carte d’un ancien passage vers les Hautes Terres. »');else if(this.tutorialStep===10)this.setTutorial(11,'Maëlle : « La route est rouverte. Les deux vallées vont prospérer ensemble. Notre histoire ne fait que commencer ! »');return}
    if(s.d<6&&s.type==='upgrade'){this.buyUpgrade();if(this.tutorialStep===5&&this.save.speed>0)this.setTutorial(6);return}
    if(this.gate&&this.gate.position.distanceTo(this.player.position)<10&&!this.save.highlands){if(this.save.money<120){this.toast('Le col demande 120 pièces pour réparer le pont. Cuisine et vends encore des repas.');return}this.save.money-=120;this.save.highlands=true;this.saveGame();this.addAnimal('deer',3,-105,1);this.addAnimal('deer',-11,-119,1);if(this.tutorialStep===6)this.setTutorial(7,'Maëlle : « Le pont tient ! Suis les traces du cerf, puis cuisine un festin pour le marché des sommets. »');else this.toast('NOUVEAU BIOME · HAUTES TERRES !');return}
    this.toast('Approche un animal, une caisse ou un bâtiment.');
  }
  buyUpgrade(){
    let cost=0,label='';let improve=()=>{};
    if(this.save.speed<3){cost=this.save.speed===0?20:40+this.save.speed*25;label='Bottes améliorées · tu cours plus vite !';improve=()=>this.save.speed++}
    else if(this.save.capacity<14){cost=70+this.save.capacity*8;label='Sac agrandi · tu peux transporter plus !';improve=()=>this.save.capacity+=3}
    else if(this.save.tool<3){cost=100+this.save.tool*60;label='Outil renforcé · chasse plus efficace !';improve=()=>this.save.tool++}
    else if(this.save.workers<3){cost=160+this.save.workers*100;label='Employé embauché · il vend automatiquement !';improve=()=>this.save.workers++}
    else{this.toast('Toutes les améliorations sont achetées !');return}
    if(this.save.money<cost){this.toast(`Il te faut ${cost} pièces pour cette amélioration.`);return}improve();this.save.money-=cost;this.saveGame();this.toast(label)
  }
  makeCrate(position:THREE.Vector3){const g=new THREE.Group();const wood=this.mat(0x9c693b),meat=this.mat(0xba5542);this.box(g,[1,.5,.8],0x9c693b,[0,.25,0],wood);this.box(g,[.08,.55,.85],0xd4a45e,[0,.27,0]);this.sphere(g,.24,0xb64438,[0,.66,-.04],[1,.7,.8]).material=meat;g.position.copy(position);g.position.y=.04;this.world.add(g);return g}
  setTutorial(step:number,narrative?:string){this.tutorialStep=Math.min(step,this.steps.length);this.save.guide=this.tutorialStep;this.save.story=this.tutorialStep===0?0:this.tutorialStep<=4?1:this.tutorialStep<=6?2:this.tutorialStep<=8?3:this.tutorialStep<=10?4:5;this.saveGame();this.updateGuide();this.toast(narrative||(step>=this.steps.length?'HISTOIRE TERMINÉE · Le marché des sommets est ouvert.':'Nouvel objectif : '+this.steps[step].title))}
  updateGuide(){const s=this.steps[this.tutorialStep];if(!s){this.guide.innerHTML='<div class="w3d-guide-head"><span>ÉPILOGUE · LE MARCHÉ DES SOMMETS</span><span>HISTOIRE TERMINÉE</span></div><b>La route est rouverte !</b><p>Le camp et les Hautes Terres commercent à nouveau. Continue à cuisiner, vendre, recruter et développer les deux vallées.</p>';this.targetRing.visible=false;return}this.guide.querySelector('[data-story]')!.textContent=s.chapter;this.guide.querySelector('[data-step]')!.textContent=`${this.tutorialStep+1} / ${this.steps.length}`;this.guide.querySelector('[data-guide-title]')!.textContent=s.title;this.guide.querySelector('[data-guide-body]')!.textContent=s.body;(this.guide.querySelector('[data-progress]') as HTMLElement).style.width=`${this.tutorialStep/this.steps.length*100}%`;if(s.target){this.targetRing.visible=true;this.targetRing.position.x=s.target.x;this.targetRing.position.z=s.target.z}}
  updateHud(){this.root.querySelector('[data-money]')!.textContent=String(this.save.money);this.root.querySelector('[data-bag]')!.textContent=`${this.save.bag}/${this.save.capacity}`;this.root.querySelector('[data-products]')!.textContent=String(this.save.products);this.actionButton.querySelector('b')!.textContent=this.actionName();const step=this.steps[this.tutorialStep];if(step?.action&&this.actionName()===step.action)this.actionButton.classList.add('w3d-ready');else this.actionButton.classList.remove('w3d-ready')}
  toast(message:string){this.message=message;this.messageUntil=this.elapsed+2.6;this.messageBox.textContent=message;this.messageBox.classList.add('w3d-show')}
  movePlayer(dt:number){let sx=this.move.x,sz=this.move.z;if(this.held.has('a')||this.held.has('arrowleft'))sx=-1;if(this.held.has('d')||this.held.has('arrowright'))sx=1;if(this.held.has('w')||this.held.has('arrowup'))sz=-1;if(this.held.has('s')||this.held.has('arrowdown'))sz=1;const len=Math.hypot(sx,sz)||1;if(Math.hypot(sx,sz)>1){sx/=len;sz/=len}const forward=-sz,c=Math.cos(this.cameraYaw),s=Math.sin(this.cameraYaw),x=sx*c+forward*s,z=sx*s-forward*c,speed=5.3+this.save.speed*.7;this.player.position.x=THREE.MathUtils.clamp(this.player.position.x+x*speed*dt,-68,68);this.player.position.z=THREE.MathUtils.clamp(this.player.position.z+z*speed*dt,-145,38);if(Math.hypot(x,z)>.08)this.player.rotation.y=Math.atan2(-x,-z);const moving=Math.hypot(sx,sz)>.08;for(let i=0;i<this.legs.length;i++)this.legs[i].rotation.x=moving?Math.sin(this.elapsed*11+i*Math.PI)*.55:Math.sin(this.elapsed*2+i)*.025;const arms=this.player.userData.arms as THREE.Group[];for(let i=0;i<arms.length;i++)arms[i].rotation.x=moving?Math.sin(this.elapsed*11+i*Math.PI+Math.PI)*.38:0;this.player.position.y=moving?Math.abs(Math.sin(this.elapsed*11))*.05:Math.sin(this.elapsed*2)*.018;const target=new THREE.Vector3(this.player.position.x,1.45+this.player.position.y,this.player.position.z);const horizontal=Math.cos(this.cameraPitch)*this.cameraDistance;const desired=new THREE.Vector3(target.x+Math.sin(this.cameraYaw)*horizontal,target.y+Math.sin(this.cameraPitch)*this.cameraDistance,target.z+Math.cos(this.cameraYaw)*horizontal);this.camera.position.lerp(desired,1-Math.exp(-dt*5));this.camera.lookAt(target.x+Math.sin(this.cameraYaw)*1.1,target.y-.2,target.z-Math.cos(this.cameraYaw)*1.1)}
  updateAnimals(dt:number){for(const a of this.animals){if(!a.alive)continue;a.phase+=dt*2;const t=a.phase;a.root.position.x=a.home.x+Math.sin(t*.42)*1.35;a.root.position.z=a.home.z+Math.cos(t*.33)*1.1;a.root.rotation.y=Math.sin(t*.42)*.24;a.root.position.y=Math.abs(Math.sin(t*2))*.045;for(let i=0;i<a.legs.length;i++)a.legs[i].rotation.x=Math.sin(t*2+i*Math.PI)*.08}}
  updateQuest(){if(this.targetRing.visible){this.targetRing.rotation.z+=.009;const pulse=.92+Math.sin(this.elapsed*3)*.07;this.targetRing.scale.setScalar(pulse)}if(this.cookingFire)this.cookingFire.scale.y=.9+Math.sin(this.elapsed*11)*.12}
  raf=0;animate=()=>{if(this.cleaned||!this.threeRenderer)return;this.raf=requestAnimationFrame(this.animate);const dt=Math.min(this.clock.getDelta(),.05);this.elapsed+=dt;if(this.attackCooldown>0)this.attackCooldown-=dt;this.movePlayer(dt);this.updateAnimals(dt);this.respawnTimer+=dt;if(this.respawnTimer>14&&this.animals.filter(a=>a.alive&&a.kind==='bear').length<4){this.respawnTimer=0;this.addAnimal('bear',(Math.random()-.5)*34,-45-Math.random()*65,2+this.save.tool)}this.updateQuest();if(this.save.workers&&this.save.products){this.autoSale+=dt;if(this.autoSale>8){this.autoSale=0;const sold=Math.min(this.save.products,this.save.workers);this.save.products-=sold;this.save.money+=sold*12;this.saveGame();this.toast(`Tes employés ont vendu ${sold} portions.`)}}if(this.messageUntil&&this.elapsed>this.messageUntil){this.messageUntil=0;this.messageBox.classList.remove('w3d-show')}if(this.elapsed-this.lastHud>.12){this.lastHud=this.elapsed;this.updateHud()}this.threeRenderer.render(this.world,this.camera)};
  cleanup(){if(this.cleaned)return;this.cleaned=true;cancelAnimationFrame(this.raf);window.removeEventListener('keydown',this.onKeyDown);window.removeEventListener('keyup',this.onKeyUp);window.removeEventListener('resize',this.onResize);window.removeEventListener('orientationchange',this.onResize);document.removeEventListener('visibilitychange',this.onVisibility);this.threeRenderer?.dispose();this.world?.traverse(o=>{const m=o as THREE.Mesh;if(m.geometry)m.geometry.dispose();if(m.material){for(const mat of Array.isArray(m.material)?m.material:[m.material]){const texture=(mat as THREE.MeshStandardMaterial).map;if(texture)texture.dispose();mat.dispose()}}});this.root?.remove();if(this.game.canvas)this.game.canvas.style.display='block';document.body.dataset.wildState='menu';this.scale.setGameSize(480,854)}
  update(){/* Three.js owns the Tycoon render loop. */}
}
