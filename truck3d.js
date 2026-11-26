// Interactive 3D Mouka truck for the Dispatch overview. Built from simple shapes, so no model files are needed.
import * as THREE from './vendor/three.module.min.js';

const views = {angle:[.66,.2], side:[0,.07], front:[1.38,.12], rear:[-2.15,.2]};
const calm = matchMedia('(prefers-reduced-motion: reduce)');

const paint = (color, roughness=.38, metalness=.12) => new THREE.MeshStandardMaterial({color, roughness, metalness});
const materials = {
  cab: paint('#f4efe3',.3,.18), box: paint('#efebe1',.55,.05), rib: paint('#ffffff',.45,.05), trim: paint('#b9bec4',.35,.75),
  dark: paint('#2a2f35',.6,.3), black: paint('#121416',.85,0), tyre: paint('#17181a',.92,0), rim: paint('#c9ced4',.28,.85),
  glass: paint('#172634',.08,.85), lamp: new THREE.MeshStandardMaterial({color:'#ffffff', emissive:'#fff6d8', emissiveIntensity:.8}),
  amber: new THREE.MeshStandardMaterial({color:'#f29b12', emissive:'#c96f00', emissiveIntensity:.5}),
  red: new THREE.MeshStandardMaterial({color:'#c9262f', emissive:'#8d0f16', emissiveIntensity:.5}),
  brand: paint('#1768b8',.4,.2)
};

function mesh(parent, geometry, material, x=0, y=0, z=0) {
  const item = new THREE.Mesh(geometry, material);
  item.position.set(x,y,z);
  item.castShadow = item.receiveShadow = true;
  parent.add(item);
  return item;
}
const block = (parent, material, width, height, depth, x, y, z=0) => mesh(parent, new THREE.BoxGeometry(width,height,depth), material, x, y, z);

// A side profile pushed across the width of the truck, with softened edges.
function slab(parent, material, points, depth, z=0, bevel=.07) {
  const shape = new THREE.Shape(points.map(([x,y]) => new THREE.Vector2(x,y)));
  const geometry = new THREE.ExtrudeGeometry(shape, {depth:depth - bevel * 2, bevelEnabled:bevel > 0, bevelSize:bevel, bevelThickness:bevel, bevelSegments:4});
  geometry.translate(0,0,z - depth / 2 + bevel);
  return mesh(parent, geometry, material);
}

function wheel(parent, x, z) {
  const group = new THREE.Group();
  group.position.set(x,.56,z);
  const outer = Math.sign(z);
  mesh(group, new THREE.TorusGeometry(.4,.165,20,44), materials.tyre).scale.z = 1.25;
  mesh(group, new THREE.CylinderGeometry(.42,.42,.3,40), materials.black).rotation.x = Math.PI / 2;
  mesh(group, new THREE.CylinderGeometry(.31,.31,.36,40), materials.rim).rotation.x = Math.PI / 2;
  mesh(group, new THREE.TorusGeometry(.25,.028,10,36), materials.trim, 0, 0, outer * .19);
  mesh(group, new THREE.CylinderGeometry(.11,.13,.13,24), materials.dark, 0, 0, outer * .22).rotation.x = Math.PI / 2;
  for (let i = 0; i < 8; i++) {
    const angle = i / 8 * Math.PI * 2;
    mesh(group, new THREE.SphereGeometry(.027,10,8), materials.trim, Math.cos(angle) * .18, Math.sin(angle) * .18, outer * .2);
  }
  parent.add(group);
}
const axle = (parent, x) => [-1.06,1.06].forEach(z => wheel(parent,x,z));

function fender(parent, x, z) {
  const arch = mesh(parent, new THREE.TorusGeometry(.7,.075,10,32,Math.PI), materials.dark, x, .56, z);
  arch.scale.z = 2.2;
}

function label(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  draw(canvas.getContext('2d'), texture);
  return new THREE.MeshStandardMaterial({map:texture, transparent:true, roughness:.45, polygonOffset:true, polygonOffsetFactor:-2});
}

function plateMaterial(text) {
  return label(512,128,context => {
    context.fillStyle = '#fff'; context.fillRect(0,0,512,128);
    context.strokeStyle = '#15304d'; context.lineWidth = 10; context.strokeRect(5,5,502,118);
    context.fillStyle = '#15304d'; context.font = '700 52px "Segoe UI", sans-serif';
    context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(text,256,68,470);
  });
}

function cargo(parent, logo, from, to, floor, roof) {
  const length = to - from;
  slab(parent, materials.box, [[from,floor],[to,floor],[to,roof],[from,roof]], 2.5, 0, .06);
  for (const z of [-1.256,1.256]) {
    for (let x = from + .55; x < to - .3; x += .55) block(parent, materials.rib, .035, roof - floor - .16, .012, x, (floor + roof) / 2, z);
    block(parent, materials.trim, length, .09, .03, (from + to) / 2, floor + .045, z);
    block(parent, materials.trim, length, .07, .03, (from + to) / 2, roof - .035, z);
    block(parent, materials.brand, length - .1, .055, .016, (from + to) / 2, floor + .24, z);
    const decal = mesh(parent, new THREE.PlaneGeometry(2.25,1.55), logo, (from + to) / 2, floor + (roof - floor) * .53, Math.sign(z) * 1.272);
    if (z < 0) decal.rotation.y = Math.PI;
    decal.userData.nearCab = to - 1.3;
  }
  // Rear doors, locking bars and lamps.
  block(parent, materials.trim, .03, roof - floor, .05, from - .06, (floor + roof) / 2, 0);
  for (const z of [-.78,-.28,.28,.78]) {
    block(parent, materials.trim, .045, roof - floor - .18, .035, from - .085, (floor + roof) / 2, z);
    block(parent, materials.dark, .06, .06, .2, from - .105, floor + .75, z);
  }
  block(parent, materials.dark, .14, .16, 2.42, from + .02, floor - .13, 0);
  for (const z of [-.98,.98]) block(parent, materials.red, .06, .11, .3, from - .09, floor - .13, z);
}

function cab(parent, x, plate) {
  const group = new THREE.Group();
  group.position.x = x;
  slab(group, materials.cab, [[0,1],[2,1],[2.02,1.95],[1.8,3.02],[1.55,3.14],[0,3.14]], 2.4, 0, .1);
  slab(group, materials.cab, [[.08,3.14],[1.35,3.14],[.5,3.62],[.08,3.66]], 2.16, 0, .07);
  const screen = slab(group, materials.glass, [[0,0],[.05,0],[.05,.92],[0,.92]], 2.16, 0, .015);
  screen.position.set(2.075,2.05,0);
  screen.rotation.z = .2;
  block(group, materials.black, .03, .9, .035, 2.04, 2.5, 0).rotation.z = .2;
  for (const z of [-1.2,1.2]) {
    slab(group, materials.glass, [[.78,2.08],[1.86,2.08],[1.7,2.92],[.78,2.92]], .035, z, .008);
    block(group, materials.dark, .018, 1.75, .012, .68, 1.98, z * 1.008);
    block(group, materials.dark, .018, .92, .012, 1.92, 1.58, z * 1.008);
    block(group, materials.trim, .24, .055, .03, .92, 1.82, z * 1.015);
    block(group, materials.brand, 1.75, .07, .016, 1.02, 1.5, z * 1.008);
    block(group, materials.dark, .52, .09, .22, 1.02, .78, z * .98);
    // Mirrors
    block(group, materials.dark, .05, .05, .34, 1.9, 2.62, z * 1.13);
    block(group, materials.black, .11, .62, .2, 1.93, 2.28, z * 1.27);
  }
  block(group, materials.dark, .07, .62, 1.78, 2.11, 1.5, 0);
  for (let i = 0; i < 5; i++) block(group, materials.trim, .035, .035, 1.62, 2.155, 1.28 + i * .115, 0);
  const badge = mesh(group, new THREE.CylinderGeometry(.13,.13,.04,28), materials.rim, 2.18, 1.74, 0);
  badge.rotation.z = Math.PI / 2;
  slab(group, materials.dark, [[1.72,.62],[2.16,.62],[2.2,.86],[2.1,1.12],[1.72,1.12]], 2.46, 0, .05);
  for (const z of [-.86,.86]) {
    block(group, materials.lamp, .06, .17, .4, 2.22, .9, z);
    block(group, materials.amber, .06, .08, .2, 2.22, 1.07, z * 1.1);
  }
  const number = mesh(group, new THREE.PlaneGeometry(.82,.2), plate, 2.256, .76, 0);
  number.rotation.y = Math.PI / 2;
  for (let i = -2; i <= 2; i++) mesh(group, new THREE.SphereGeometry(.04,12,8), materials.amber, 1.62, 3.21, i * .38);
  parent.add(group);
}

function buildTruck(type, plateText, logo) {
  const truck = new THREE.Group();
  const trailer = type === 'Trailer';
  const plate = plateMaterial(plateText);
  const tail = trailer ? -6 : -3.9;
  if (trailer) {
    cargo(truck, logo, -6, 2.55, 1.42, 4.02);
    cab(truck, 3.05, plate);
    block(truck, materials.dark, 3.9, .24, 1.5, 3.1, .93);
    block(truck, materials.dark, 7.6, .2, 1.6, -2.1, 1.2);
    for (const x of [4.35,2.45,1.15,-3.2,-4.25,-5.3]) axle(truck,x);
    for (const z of [-1.1,1.1]) {
      for (const x of [4.35,-3.2,-4.25,-5.3]) fender(truck,x,z);
      block(truck, materials.trim, 3.4, .09, .06, -.7, .78, z * 1.02);
      for (const x of [-2.3,.9]) block(truck, materials.dark, .08, .42, .08, x, .98, z * 1.02);
      block(truck, materials.dark, .12, .8, .12, .05, .8, z * .6);
    }
    const tank = mesh(truck, new THREE.CylinderGeometry(.34,.34,.8,28), materials.rim, 3.36, .84, -1.0);
    tank.rotation.z = Math.PI / 2;
  } else {
    cargo(truck, logo, -3.9, 1.2, 1.32, 3.82);
    cab(truck, 1.35, plate);
    block(truck, materials.dark, 7.1, .24, 1.5, -.3, 1.03);
    for (const x of [2.65,-2.4]) { axle(truck,x); for (const z of [-1.1,1.1]) fender(truck,x,z); }
    for (const z of [-1.1,1.1]) block(truck, materials.trim, 2.5, .09, .06, -.15, .76, z * 1.02);
    const tank = mesh(truck, new THREE.CylinderGeometry(.32,.32,1.05,28), materials.rim, .6, .82, -.98);
    tank.rotation.z = Math.PI / 2;
  }
  const rearPlate = mesh(truck, new THREE.PlaneGeometry(.82,.2), plate, tail - .125, 1.2 - (trailer ? 0 : .1), 0);
  rearPlate.rotation.y = -Math.PI / 2;
  const bounds = new THREE.Box3().setFromObject(truck);
  truck.position.x = -(bounds.min.x + bounds.max.x) / 2;
  return {truck, length:bounds.max.x - bounds.min.x, height:bounds.max.y};
}

// Lights, reflections and a floor that catches the shadow.
function createScene(renderer) {
  const scene = new THREE.Scene();
  // A soft studio surround gives the paint, glass and wheels something to reflect.
  const studio = new THREE.Scene();
  studio.background = new THREE.Color('#8d949c');
  for (const [color,x,y,z,w,h] of [['#ffffff',0,9,0,12,12],['#fff4e0',-9,3,4,6,8],['#dcecff',9,3,-5,6,8],['#ffffff',0,3,-10,14,5]]) {
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(w,h), new THREE.MeshBasicMaterial({color, side:THREE.DoubleSide}));
    panel.position.set(x,y,z); panel.lookAt(0,0,0); studio.add(panel);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(studio,.04).texture;
  scene.add(new THREE.HemisphereLight('#ffffff','#9a9288',.9));
  const sun = new THREE.DirectionalLight('#fff8ec',1.7);
  sun.position.set(5,12,-7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048,2048);
  sun.shadow.radius = 5;
  sun.shadow.bias = -.0004;
  Object.assign(sun.shadow.camera,{left:-10,right:10,top:10,bottom:-10});
  scene.add(sun);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60,60), new THREE.ShadowMaterial({opacity:.2}));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  return scene;
}

const loadLogo = () => new Promise(resolve => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => resolve(null);
  image.src = '/mouka-track-delivery/assets/mouka.svg';
});

let studioShot;
export async function truckSnapshot(type, plate, target) {
  await shoot(type, plate, source => target.getContext('2d').drawImage(source,0,0,target.width,target.height));
}
export async function truckPicture(type, plate) {
  let picture;
  await shoot(type, plate, source => { picture = source.toDataURL('image/png'); });
  return picture;
}

async function shoot(type, plate, use) {
  const image = await loadLogo();
  if (!studioShot) {
    const renderer = new THREE.WebGLRenderer({antialias:true, alpha:true, preserveDrawingBuffer:true});
    renderer.setSize(720,400,false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    studioShot = {renderer, scene:createScene(renderer), camera:new THREE.PerspectiveCamera(15,720 / 400,.1,300)};
  }
  const {renderer, scene, camera} = studioShot;
  const logo = label(660,456,context => { if (image) context.drawImage(image,0,0,660,456); });
  const {truck} = buildTruck(type,plate,logo);
  // Card pictures are cropped at the back, so the logo moves towards the cab.
  truck.traverse(item => { if (item.userData.nearCab !== undefined) item.position.x = item.userData.nearCab; });
  scene.add(truck);
  // Frame the cab and most of the load area; long trailers run off the right edge like a photo.
  const bounds = new THREE.Box3().setFromObject(truck);
  const front = bounds.max.x;
  const span = Math.min(bounds.max.x - bounds.min.x, 7.9);
  const aim = new THREE.Vector3(front - span / 2, bounds.max.y * .47, 0);
  const distance = span * .6 / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2 * camera.aspect) + 1.6;
  const azimuth = .3, elevation = .07;
  camera.position.set(aim.x + Math.sin(azimuth) * Math.cos(elevation) * distance, aim.y + Math.sin(elevation) * distance, -Math.cos(azimuth) * Math.cos(elevation) * distance);
  camera.lookAt(aim);
  renderer.render(scene,camera);
  use(renderer.domElement);
  scene.remove(truck);
  truck.traverse(item => item.geometry?.dispose());
}

export function createTruckViewer() {
  const renderer = new THREE.WebGLRenderer({antialias:true, alpha:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  const canvas = renderer.domElement;
  canvas.className = 'ov-canvas';
  canvas.tabIndex = 0;
  canvas.setAttribute('role','img');

  const scene = createScene(renderer);
  const camera = new THREE.PerspectiveCamera(24,2,.1,200);

  const logo = label(660,456,(context,texture) => {
    const image = new Image();
    image.onload = () => { context.drawImage(image,0,0,660,456); texture.needsUpdate = true; draw(); };
    image.src = '/mouka-track-delivery/assets/mouka.svg';
  });

  let model, key = '', host, frame = 0, spin = false, drag, size = {length:7, height:3.8};
  let [azimuth,elevation] = views.angle;
  let target = [azimuth,elevation], slide = 0;

  function draw() {
    if (!canvas.isConnected) return;
    const vertical = THREE.MathUtils.degToRad(camera.fov) / 2;
    const horizontal = Math.atan(Math.tan(vertical) * camera.aspect);
    const across = Math.abs(Math.cos(azimuth)) * size.length + Math.abs(Math.sin(azimuth)) * 2.9;
    const deep = Math.abs(Math.sin(azimuth)) * size.length / 2;
    const distance = Math.max(across * .57 / Math.tan(horizontal), size.height * .72 / Math.tan(vertical)) + deep * .7 + 1.5;
    const middle = size.height * .43;
    camera.position.set(Math.sin(azimuth) * Math.cos(elevation) * distance, middle + Math.sin(elevation) * distance, -Math.cos(azimuth) * Math.cos(elevation) * distance);
    camera.lookAt(0,middle,0);
    renderer.render(scene,camera);
  }
  function tick() {
    frame = 0;
    if (!canvas.isConnected) return;
    let moving = false;
    if (spin && !drag) { target = [target[0] + .004, target[1]]; azimuth += .004; moving = true; }
    for (const [index,current] of [azimuth,elevation].entries()) {
      const gap = target[index] - current;
      if (Math.abs(gap) > .001) {
        moving = true;
        if (index) elevation += gap * .14; else azimuth += gap * .14;
      }
    }
    if (Math.abs(slide) > .01) { slide *= .86; moving = true; } else slide = 0;
    if (model) model.position.x = model.userData.home - slide;
    draw();
    if (moving) request();
  }
  const request = () => { frame ||= requestAnimationFrame(tick); };
  const turnTo = (to) => {
    // Take the shortest way round after spinning.
    const turns = Math.round((azimuth - to[0]) / (Math.PI * 2));
    target = [to[0] + turns * Math.PI * 2, to[1]];
    if (calm.matches) [azimuth,elevation] = target;
    request();
  };
  const turnBy = (across, up=0) => {
    target = [target[0] + across, THREE.MathUtils.clamp(target[1] + up, .02, .75)];
    request();
  };

  canvas.addEventListener('pointerdown',event => {
    drag = {x:event.clientX, y:event.clientY};
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add('dragging');
  });
  canvas.addEventListener('pointermove',event => {
    if (!drag) return;
    azimuth -= (event.clientX - drag.x) * .008;
    elevation = THREE.MathUtils.clamp(elevation + (event.clientY - drag.y) * .004, .02, .75);
    target = [azimuth,elevation];
    drag = {x:event.clientX, y:event.clientY};
    request();
  });
  for (const name of ['pointerup','pointercancel']) canvas.addEventListener(name,() => { drag = undefined; canvas.classList.remove('dragging'); request(); });
  canvas.addEventListener('keydown',event => {
    const step = {ArrowLeft:[.25,0], ArrowRight:[-.25,0], ArrowUp:[0,.1], ArrowDown:[0,-.1]}[event.key];
    if (!step) return;
    event.preventDefault();
    turnBy(...step);
  });

  const resize = new ResizeObserver(() => {
    const {clientWidth:width, clientHeight:height} = host || {};
    if (!width || !height) return;
    renderer.setSize(width,height,false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    draw();
  });

  return {
    mount(element, {type, plate}) {
      if (host !== element) { resize.disconnect(); host = element; host.append(canvas); resize.observe(host); }
      const next = `${type}|${plate}`;
      if (next !== key) {
        if (model) {
          scene.remove(model);
          model.traverse(item => item.geometry?.dispose());
          slide = calm.matches ? 0 : 5;
        }
        const built = buildTruck(type,plate,logo);
        model = built.truck;
        model.userData.home = model.position.x;
        size = built;
        scene.add(model);
        key = next;
      }
      canvas.setAttribute('aria-label',`3D model of ${type === 'Trailer' ? 'a trailer truck' : 'a box truck'}, plate ${plate}. Drag or use the arrow keys to turn it.`);
      host.classList.add('ready');
      request();
      draw();
    },
    view(name) { if (views[name]) { spin = false; turnTo(views[name]); } },
    turn: turnBy,
    toggleSpin() { spin = !spin; request(); return spin; },
    get spinning() { return spin; }
  };
}
