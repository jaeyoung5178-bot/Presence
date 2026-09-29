const slide = document.querySelector('.self-cinematic');
const host = document.querySelector('#innerPowerStage');
const button = document.querySelector('#innerPowerMotion');
let pending = false, render = null, frame = 0, last = 0, elapsed = 0;
const active = () => !slide.hidden && !document.hidden && !document.body.classList.contains('panel-open');
const paused = () => document.body.classList.contains('motion-disabled');

function update() {
  cancelAnimationFrame(frame); frame = 0; last = 0;
  button.textContent = paused() ? '모션 재생' : '모션 멈춤';
  if (!active()) return;
  if (!pending) { pending = true; initialize(); }
  if (!render) return;
  render(elapsed);
  if (!paused()) frame = requestAnimationFrame(tick);
}

function tick(now) {
  if (!active() || paused()) { frame = 0; return; }
  if (!last || now - last >= 32) {
    elapsed += last ? Math.min((now - last) / 1000, .08) : 0;
    last = now; render(elapsed);
  }
  frame = requestAnimationFrame(tick);
}

async function initialize() {
  let renderer;
  try {
    const [THREE, { GLTFLoader }, { EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }] = await Promise.all([
      import('three'), import('./vendor/three/examples/jsm/loaders/GLTFLoader.js'),
      import('./vendor/three/examples/jsm/postprocessing/EffectComposer.js'),
      import('./vendor/three/examples/jsm/postprocessing/RenderPass.js'),
      import('./vendor/three/examples/jsm/postprocessing/UnrealBloomPass.js'),
      import('./vendor/three/examples/jsm/postprocessing/OutputPass.js')
    ]);
    const gltf = await new GLTFLoader().loadAsync('./media/inner-power.glb');
    renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = .9;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0b110e');
    scene.fog = new THREE.FogExp2('#0b110e', .022);
    scene.add(gltf.scene, new THREE.HemisphereLight(0xd6cfb6, 0x122519, 1.1));
    const camera = gltf.cameras[0];
    if (!camera?.isOrthographicCamera) throw new Error('Missing delivery camera');
    camera.updateWorldMatrix(true, false);
    const originalPosition = camera.position.clone();
    const mixer = new THREE.AnimationMixer(gltf.scene);
    gltf.animations.forEach(clip => mixer.clipAction(clip).play());
    const core = [], dust = [];
    gltf.scene.traverse(object => {
      if (object.isMesh && object.material?.emissiveIntensity > 2) core.push(object.material);
      if (object.name.startsWith('Floating_amber')) dust.push(object);
    });
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), .85, .65, .7);
    composer.addPass(bloom); composer.addPass(new OutputPass());
    renderer.domElement.setAttribute('aria-hidden', 'true');
    host.prepend(renderer.domElement);
    function resize() {
      const { width, height } = host.getBoundingClientRect();
      if (!width || !height) return;
      const mobile = width < 701;
      const viewWidth = mobile ? 5.8 : 10.8;
      camera.left = -viewWidth / 2; camera.right = viewWidth / 2;
      camera.top = viewWidth * height / width / 2; camera.bottom = -camera.top;
      camera.position.copy(originalPosition);
      if (mobile) camera.position.x += 2.2;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height); composer.setSize(width, height);
      if (render) render(elapsed);
    }
    render = time => {
      mixer.setTime(time * .22);
      core.forEach(material => { material.emissiveIntensity = 2.7 + Math.sin(time * .65) * .45; });
      dust.forEach((object, i) => { object.visible = Math.sin(time * .4 + i * 1.7) > -.75; });
      composer.render();
    };
    renderer.domElement.addEventListener('webglcontextlost', event => {
      event.preventDefault(); cancelAnimationFrame(frame); render = null;
      host.classList.remove('is-ready'); button.hidden = true;
    });
    new ResizeObserver(resize).observe(host);
    resize(); host.classList.add('is-ready'); button.hidden = false; update();
  } catch {
    renderer?.dispose();
    host.classList.remove('is-ready'); button.hidden = true;
  }
}

button.addEventListener('click', () => document.dispatchEvent(new Event('sales-motion-toggle')));
new MutationObserver(update).observe(slide, { attributes: true, attributeFilter: ['hidden'] });
new MutationObserver(update).observe(document.body, { attributes: true, attributeFilter: ['class'] });
document.addEventListener('visibilitychange', update);
update();
