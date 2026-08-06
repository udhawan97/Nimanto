/* <nimanto-emblem> — sculptural 3D monogram for Nimanto.
   Two marks: "A" (MA Seal) and "B" (Fold Lotus). Three.js loaded on demand. */
(() => {
if (customElements.get('nimanto-emblem')) return;

const CDN = 'https://unpkg.com/three@0.160.0/build/three.module.js';
function getTHREE() {
  if (window.__nimTHREE) return window.__nimTHREE;
  const SRC = (window.__resources && window.__resources.three) || CDN;
  window.__nimTHREE = new Promise((res, rej) => {
    if (window.__THREE__) return res(window.__THREE__);
    const s = document.createElement('script');
    s.type = 'module';
    s.textContent = "import * as T from '" + SRC + "';window.__THREE__=T;window.dispatchEvent(new Event('nim-three'));";
    window.addEventListener('nim-three', () => res(window.__THREE__), { once: true });
    setTimeout(() => { if (!window.__THREE__) rej(new Error('three-load-failed')); }, 20000);
    document.head.appendChild(s);
  });
  return window.__nimTHREE;
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const outQuint = t => 1 - Math.pow(1 - t, 5);
const inOutQuint = t => t < .5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;
const outBack = t => { const c1 = 1.24, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const DEG = Math.PI / 180;

/* ---------- shapes ---------- */
function roundedRect(THREE, w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
function diamond(THREE, cx, cy, r) {
  const p = new THREE.Path();
  p.moveTo(cx, cy - r); p.lineTo(cx + r, cy); p.lineTo(cx, cy + r); p.lineTo(cx - r, cy);
  p.closePath(); return p;
}
/* L-bracket = [0,h]^2 minus [0,i]^2, jaali diamonds along the inner arms */
function bracketShape(THREE, h, i) {
  const s = new THREE.Shape();
  s.moveTo(i, 0); s.lineTo(h, 0); s.lineTo(h, h); s.lineTo(0, h);
  s.lineTo(0, i); s.lineTo(i, i); s.closePath();
  const off = 0.105, r = 0.026, span = i - 0.10, n = 7;
  for (let k = 0; k < n; k++) {
    const u = 0.055 + span * (k / (n - 1));
    s.holes.push(diamond(THREE, i + off, u, r));
    s.holes.push(diamond(THREE, u, i + off, r));
  }
  s.holes.push(diamond(THREE, i + off, i + off, r * 1.5));
  return s;
}
/* N monogram outline, centred */
function nPath(THREE, w, h, st, dt) {
  const p = new THREE.Path(), ox = -w / 2, oy = -h / 2, X = v => v + ox, Y = v => v + oy;
  p.moveTo(X(0), Y(0));
  p.lineTo(X(st), Y(0));
  p.lineTo(X(st), Y(h - dt));
  p.lineTo(X(w - st), Y(0));
  p.lineTo(X(w), Y(0));
  p.lineTo(X(w), Y(h));
  p.lineTo(X(w - st), Y(h));
  p.lineTo(X(w - st), Y(dt));
  p.lineTo(X(st), Y(h));
  p.lineTo(X(0), Y(h));
  p.closePath();
  return p;
}
/* pierced annulus — jaali screen */
function annulusJaali(THREE, rIn, rOut, n, hr) {
  const s = new THREE.Shape();
  s.absarc(0, 0, rOut, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, rIn, 0, Math.PI * 2, true);
  s.holes.push(hole);
  const rm = (rIn + rOut) / 2;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    s.holes.push(diamond(THREE, Math.cos(a) * rm, Math.sin(a) * rm, hr));
  }
  return s;
}
function barShape(THREE, w, h, skew) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 - skew, -h / 2); s.lineTo(w / 2 - skew, -h / 2);
  s.lineTo(w / 2 + skew, h / 2); s.lineTo(-w / 2 + skew, h / 2); s.closePath();
  return s;
}
function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(128, 128, 4, 128, 128, 126);
  g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(0.32, 'rgba(255,255,255,.22)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  return c;
}
/* notched-card polygon, inset by d */
function notchPoly(s, c, d) {
  const K = 2 * s - c - d * Math.SQRT2;
  return [[-s + d, -s + d], [s - d, -s + d], [s - d, K - (s - d)], [K - (s - d), s - d], [-s + d, s - d]];
}
function polyShape(THREE, pts) {
  const sh = new THREE.Shape();
  pts.forEach((p, i) => i ? sh.lineTo(p[0], p[1]) : sh.moveTo(p[0], p[1]));
  sh.closePath(); return sh;
}
function polyPath(THREE, pts) {
  const p = new THREE.Path();
  pts.forEach((q, i) => i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1]));
  p.closePath(); return p;
}
function petalShape(THREE, W, H, sign) {
  const s = new THREE.Shape(), x = v => v * sign;
  s.moveTo(0, 0);
  s.lineTo(0, H);
  s.quadraticCurveTo(x(W * 0.98), H * 0.70, x(W * 0.66), H * 0.30);
  s.quadraticCurveTo(x(W * 0.40), H * 0.055, 0, 0);
  return s;
}

/* ---------- environment ---------- */
function studioEnv(THREE, renderer) {
  const sc = new THREE.Scene();
  const g = new THREE.PlaneGeometry(1, 1);
  const panel = (hex, mul, pos, scale) => {
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(mul) }));
    m.position.set(...pos); m.scale.set(...scale); m.lookAt(0, 0, 0); sc.add(m);
  };
  const shell = new THREE.Mesh(new THREE.BoxGeometry(30, 30, 30),
    new THREE.MeshBasicMaterial({ color: 0x0a0908, side: THREE.BackSide }));
  sc.add(shell);
  panel(0xfff2df, 3.4, [4, 5, 4], [7, 7, 1]);
  panel(0x9fb6cf, 0.8, [-6, 1, 3], [8, 8, 1]);
  panel(0xffcf9a, 1.7, [-2, 2.5, -6], [6, 6, 1]);
  panel(0xffe6c8, 1.5, [0.5, 1.2, 7], [8, 8, 1]);
  panel(0xd6472c, 0.5, [2, -3, -4], [4, 4, 1]);
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(sc, 0.03).texture;
  pm.dispose();
  return tex;
}
function wallTexture(inner, outer) {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(256, 210, 20, 256, 240, 330);
  gr.addColorStop(0, inner); gr.addColorStop(0.55, '#14110d'); gr.addColorStop(1, outer);
  x.fillStyle = gr; x.fillRect(0, 0, 512, 512);
  return c;
}

class NimantoEmblem extends HTMLElement {
  constructor() {
    super();
    this._concept = 'C'; this._accent = '#D6472C'; this._assembly = 5;
    this._ambient = true; this._glowMax = 1; this._scroll = 0;
    this.hoverT = 0; this.hover = 0; this.ceremony = -1;
    this.px = 0; this.py = 0; this.tx = 0; this.ty = 0;
    this.ready = false; this.visible = true;
  }
  static get observedAttributes() { return ['concept', 'accent', 'assembly', 'ambient', 'glow']; }
  attributeChangedCallback(n, o, v) { this[n] = v; }
  set concept(v) {
    const s = String(v == null ? 'C' : v).trim().toUpperCase();
    const c = (s.startsWith('B') || s.startsWith('LOT')) ? 'B' : (s.startsWith('A') || s.startsWith('SEAL') || s.startsWith('MA')) ? 'A' : 'C';
    if (c === this._concept) return; this._concept = c; if (this.ready) this.switchConcept();
  }
  get concept() { return this._concept; }
  set accent(v) { this._accent = v || '#D6472C'; if (this.ready) this.applyAccent(); }
  get accent() { return this._accent; }
  set assembly(v) { const n = parseFloat(v); if (!isNaN(n)) { this._assembly = clamp(n, 0.5, 12); this.t0 = performance.now(); } }
  get assembly() { return this._assembly; }
  set ambient(v) { this._ambient = !(v === false || v === 'false' || v === 0 || v === '0'); }
  get ambient() { return this._ambient; }
  set glow(v) { const n = parseFloat(v); if (!isNaN(n)) this._glowMax = clamp(n, 0, 2.5); }
  get glow() { return this._glowMax; }

  connectedCallback() {
    if (this._booted) return; this._booted = true;
    this.style.display = 'block';
    this.style.position = 'absolute';
    this.style.inset = '0';
    this.style.overflow = 'hidden'; this.style.touchAction = 'manipulation';
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ph = document.createElement('div');
    ph.style.cssText = 'position:absolute;inset:0;display:grid;place-items:center;transition:opacity .9s ease';
    ph.innerHTML = '<div style="width:54px;height:54px;position:relative;opacity:.34">' +
      ['top:0;left:0;border-top:1px solid #B8935A;border-left:1px solid #B8935A',
       'top:0;right:0;border-top:1px solid #B8935A;border-right:1px solid #B8935A',
       'bottom:0;left:0;border-bottom:1px solid #B8935A;border-left:1px solid #B8935A',
       'bottom:0;right:0;border-bottom:1px solid #B8935A;border-right:1px solid #B8935A']
      .map(s => '<i style="position:absolute;width:17px;height:17px;' + s + '"></i>').join('') +
      '<i style="position:absolute;inset:19px;background:#D6472C"></i></div>';
    this.appendChild(ph); this._ph = ph;
    getTHREE().then(T => this.init(T)).catch(() => { ph.innerHTML = ''; this.fallback(); });
  }
  disconnectedCallback() { cancelAnimationFrame(this._raf); this._ro && this._ro.disconnect(); }
  fallback() {
    const d = document.createElement('div');
    d.style.cssText = 'position:absolute;inset:0;display:grid;place-items:center;color:#8b8175;font:11px/1.6 ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase';
    d.textContent = 'Static mark — 3D unavailable';
    this.appendChild(d);
  }

  /* ---------- build ---------- */
  init(THREE) {
    this.T = THREE;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    } catch (e) { this._ph.remove(); return this.fallback(); }
    this.renderer = renderer;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    this.appendChild(renderer.domElement);

    const scene = new THREE.Scene(); this.scene = scene;
    scene.background = new THREE.Color(0x0a0908);
    scene.environment = studioEnv(THREE, renderer);

    const cam = new THREE.PerspectiveCamera(26, 1, 0.1, 60); this.cam = cam;
    cam.position.set(0, 0.06, 6.6);

    const wallTex = new THREE.CanvasTexture(wallTexture('#241c14', '#060505'));
    wallTex.colorSpace = THREE.SRGBColorSpace;
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(34, 22),
      new THREE.MeshBasicMaterial({ map: wallTex }));
    wall.position.set(0, 0.6, -5.4); scene.add(wall); this.wall = wall;

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.46 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -1.62; floor.receiveShadow = true; scene.add(floor);

    const key = new THREE.DirectionalLight(0xfff1e0, 2.5);
    key.position.set(3.2, 4.4, 4.2); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); key.shadow.radius = 4; key.shadow.bias = -0.0012;
    const sc = key.shadow.camera; sc.left = -3.2; sc.right = 3.2; sc.top = 3.2; sc.bottom = -3.2; sc.near = 1; sc.far = 16;
    scene.add(key); this.key = key;
    const rim = new THREE.DirectionalLight(0xffd3a0, 1.5); rim.position.set(-2.6, 1.8, -3.6); scene.add(rim); this.rim = rim;
    const fill = new THREE.DirectionalLight(0x93aec9, 0.45); fill.position.set(-4, 0.6, 2.4); scene.add(fill);
    const glowLight = new THREE.PointLight(new THREE.Color(this._accent), 0.3, 4.5, 2);
    glowLight.position.set(0, 0, -0.35); scene.add(glowLight); this.glowLight = glowLight;

    /* materials */
    this.mat = {
      lacquer: new THREE.MeshPhysicalMaterial({ color: 0x101013, roughness: 0.36, metalness: 0.04, clearcoat: 1, clearcoatRoughness: 0.24, envMapIntensity: 0.55 }),
      brass: new THREE.MeshPhysicalMaterial({ color: 0xb8935a, roughness: 0.29, metalness: 1, envMapIntensity: 1.45 }),
      ivory: new THREE.MeshPhysicalMaterial({ color: 0xd5ccb9, roughness: 0.78, metalness: 0.02, clearcoat: 0.2, envMapIntensity: 0.58 }),
      emerald: new THREE.MeshPhysicalMaterial({ color: 0x16543f, roughness: 0.22, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.1 }),
      vermilion: new THREE.MeshPhysicalMaterial({ color: new THREE.Color(this._accent).multiplyScalar(0.72), roughness: 0.30, metalness: 0.06, clearcoat: 1, clearcoatRoughness: 0.18, envMapIntensity: 0.5 }),
      inlay: new THREE.MeshPhysicalMaterial({ color: 0x9d7c4a, roughness: 0.44, metalness: 1, envMapIntensity: 0.85 }),
      accent: new THREE.MeshBasicMaterial({ color: new THREE.Color(this._accent), transparent: true, opacity: 0.30, side: THREE.DoubleSide, depthWrite: false })
    };

    this.root = new THREE.Group(); scene.add(this.root);    const haloTex = new THREE.CanvasTexture(glowTexture());
    haloTex.colorSpace = THREE.SRGBColorSpace;
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 6.2), new THREE.MeshBasicMaterial({
      map: haloTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      color: new THREE.Color(this._accent), opacity: 0.16
    }));
    halo.position.set(0, 0.46, -1.9); scene.add(halo); this.halo = halo;
    this.seal = this.buildSeal(); this.lotus = this.buildLotus(); this.fold = this.buildFold();
    this.root.add(this.seal); this.root.add(this.lotus); this.root.add(this.fold);
    this.switchConcept();

    this.t0 = performance.now();
    this.bindEvents();
    this._ro = new ResizeObserver(() => this.resize()); this._ro.observe(this);
    this.resize();
    this.ready = true;
    if (this._ph) { this._ph.style.opacity = '0'; setTimeout(() => this._ph && this._ph.remove(), 900); }
    this.dispatchEvent(new CustomEvent('emblem-ready', { bubbles: true }));
    if (this.reduced) { this.frame(true); } else { this.loop(); }
  }

  buildSeal() {
    const T = this.T, grp = new T.Group();
    const H = 1.2, I = 0.58, GAP = 0.036;

    const frame = new T.Group(); grp.add(frame); this.frameGrp = frame;
    const geo = new T.ExtrudeGeometry(bracketShape(T, H, I), {
      depth: 0.15, bevelEnabled: true, bevelThickness: 0.022, bevelSize: 0.022, bevelSegments: 3, curveSegments: 4
    });
    geo.translate(0, 0, -0.075);
    this.plates = [];
    for (let k = 0; k < 4; k++) {
      const m = new T.Mesh(geo, [this.mat.lacquer, this.mat.brass]);
      m.castShadow = true; m.receiveShadow = true;
      const a = (45 + 90 * k) * DEG;
      m.rotation.z = k * Math.PI / 2;
      m.userData.rest = { x: Math.cos(a) * GAP, y: Math.sin(a) * GAP, z: 0, rz: k * Math.PI / 2, dir: a };
      frame.add(m); this.plates.push(m);
    }

    const jg = new T.ExtrudeGeometry(annulusJaali(T, 0.44, 0.72, 20, 0.048), {
      depth: 0.05, bevelEnabled: true, bevelThickness: 0.009, bevelSize: 0.009, bevelSegments: 1, curveSegments: 24
    });
    jg.translate(0, 0, -0.025);
    const jaali = new T.Mesh(jg, [this.mat.ivory, this.mat.brass]);
    jaali.position.z = -0.10; jaali.castShadow = true;
    grp.add(jaali); this.jaali = jaali;

    const ring = new T.Mesh(new T.RingGeometry(0.28, 1.12, 56), this.mat.accent);
    ring.position.z = -0.30; grp.add(ring); this.sealGlow = ring;
    const spark = new T.Mesh(new T.RingGeometry(0.475, 0.695, 44), this.mat.accent.clone());
    spark.position.z = -0.135; grp.add(spark); this.sealSpark = spark;

    const core = new T.Group(); grp.add(core); this.core = core;
    const bar = (w, h, skew, depth, mats) => {
      const g2 = new T.ExtrudeGeometry(barShape(T, w, h, skew), {
        depth, bevelEnabled: true, bevelThickness: 0.011, bevelSize: 0.011, bevelSegments: 2, curveSegments: 2
      });
      g2.translate(0, 0, -depth / 2);
      const m = new T.Mesh(g2, mats); m.castShadow = true; return m;
    };
    const diagonal = bar(0.135, 0.98, 0, 0.10, [this.mat.brass, this.mat.brass]);
    diagonal.rotation.z = -36 * DEG;
    const left = bar(0.115, 0.80, 0.05, 0.085, [this.mat.lacquer, this.mat.brass]);
    left.position.set(-0.205, 0.02, 0.075);
    const right = bar(0.115, 0.50, 0.05, 0.085, [this.mat.lacquer, this.mat.brass]);
    right.position.set(0.215, -0.145, 0.075);
    const jewel = bar(0.08, 0.08, 0, 0.055, [this.mat.emerald, this.mat.brass]);
    jewel.position.set(0.215, 0.20, 0.10); jewel.rotation.z = Math.PI / 4;
    this.coreBits = [diagonal, left, right, jewel];
    this.coreBits.forEach((b, i) => { b.userData.p0 = b.position.clone(); b.userData.dir = i % 2 ? 1 : -1; core.add(b); });
    return grp;
  }

  buildLotus() {
    const T = this.T, grp = new T.Group();
    const spec = [
      { a: -64, W: 0.33, H: 1.10, mat: 'ivory' },
      { a: -33, W: 0.40, H: 1.44, mat: 'lacquer' },
      { a: -3, W: 0.45, H: 1.66, mat: 'lacquer' },
      { a: 27, W: 0.38, H: 1.38, mat: 'lacquer' },
      { a: 56, W: 0.31, H: 1.02, mat: 'ivory' }
    ];
    this.petals = [];
    spec.forEach((s, i) => {
      const p = new T.Group();
      [1, -1].forEach(sign => {
        const geo = new T.ExtrudeGeometry(petalShape(T, s.W, s.H, sign), {
          depth: 0.045, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 10
        });
        geo.translate(0, 0, -0.022);
        const half = new T.Mesh(geo, [this.mat[s.mat], this.mat.brass]);
        half.castShadow = true; half.receiveShadow = true;
        half.userData.sign = sign;
        p.add(half);
      });
      const a = s.a * DEG, r = 0.12;
      p.userData.rest = { rz: a, x: -Math.sin(a) * r, y: Math.cos(a) * r - 0.62, z: (i - 2) * 0.016, fold: 8 * DEG };
      grp.add(p); this.petals.push(p);
    });
    const hub = new T.Mesh(new T.TorusGeometry(0.155, 0.032, 10, 44), this.mat.brass);
    hub.position.y = -0.62; hub.castShadow = true; grp.add(hub);
    const seed = new T.Mesh(new T.CircleGeometry(0.115, 32), this.mat.emerald);
    seed.position.set(0, -0.62, 0.01); grp.add(seed);
    const disc = new T.Mesh(new T.CircleGeometry(0.34, 40), this.mat.accent.clone());
    disc.position.set(0, -0.62, -0.09); grp.add(disc); this.lotusGlow = disc;
    return grp;
  }

  /* III — the invitation fold: a notched card whose corner turns back */
  buildFold() {
    const T = this.T, grp = new T.Group();
    const s = 0.775, c = 0.62;
    const card = polyShape(T, notchPoly(s, c, 0));
    for (let i = 0; i < 3; i++) {
      const u = (i + 0.5) / 3, L = 0.50;
      card.holes.push(diamond(T, -s + L * u + 0.27, -s + L * (1 - u) + 0.27, 0.058));
    }
    const cg = new T.ExtrudeGeometry(card, {
      depth: 0.16, bevelEnabled: true, bevelThickness: 0.016, bevelSize: 0.016, bevelSegments: 2, curveSegments: 3
    });
    cg.translate(0, 0, -0.08);
    const cardMesh = new T.Mesh(cg, [this.mat.ivory, this.mat.brass]);
    cardMesh.castShadow = true; cardMesh.receiveShadow = true;

    const rule = polyShape(T, notchPoly(s, c, 0.125));
    rule.holes.push(polyPath(T, notchPoly(s, c, 0.149)));
    const rg = new T.ExtrudeGeometry(rule, { depth: 0.014, bevelEnabled: false, curveSegments: 2 });
    rg.translate(0, 0, 0.082);
    const ruleMesh = new T.Mesh(rg, this.mat.inlay);

    const holder = new T.Group(); holder.add(cardMesh); holder.add(ruleMesh); grp.add(holder); this.foldCard = holder;

    const spark = new T.Mesh(new T.PlaneGeometry(0.88, 0.28), this.mat.accent.clone());
    spark.position.set(-0.255, -0.255, -0.115); spark.rotation.z = -Math.PI / 4;
    holder.add(spark); this.foldSpark = spark;

    const a = Math.PI * 0.75, Mx = s - c / 2, My = s - c / 2;
    const tri = new T.Shape();
    tri.moveTo(s, s - c); tri.lineTo(s, s); tri.lineTo(s - c, s); tri.closePath();
    const tg = new T.ExtrudeGeometry(tri, {
      depth: 0.10, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 2
    });
    tg.translate(-Mx, -My, -0.105); tg.rotateZ(-a);
    const flapMesh = new T.Mesh(tg, [this.mat.vermilion, this.mat.brass]);
    flapMesh.castShadow = true;
    const inner = new T.Group(); inner.add(flapMesh);
    const pivot = new T.Group(); pivot.position.set(Mx, My, 0.08); pivot.rotation.z = a; pivot.add(inner);
    holder.add(pivot); this.flap = inner;
    return grp;
  }

  applyAccent() {
    const c = new this.T.Color(this._accent);
    [this.mat.accent, this.sealSpark.material, this.lotusGlow.material,
     this.foldSpark.material, this.halo.material].forEach(m => m.color.copy(c));
    this.mat.vermilion.color.copy(c).multiplyScalar(0.72);
    this.glowLight.color.copy(c);
  }
  switchConcept() {
    const k = this._concept;
    this.seal.visible = k === 'A'; this.lotus.visible = k === 'B'; this.fold.visible = k === 'C';
    this.t0 = performance.now();
    if (this.renderer) this.resize();
    if (this.reduced) this.frame(true);
  }

  /* ---------- interaction ---------- */
  bindEvents() {
    const el = this;
    this.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      el.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      el.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
      if (el.reduced) el.frame(true);
    });
    this.addEventListener('pointerenter', () => { el.hoverT = 1; });
    this.addEventListener('pointerleave', () => { el.hoverT = 0; el.tx = 0; el.ty = 0; });
    this.addEventListener('pointerdown', () => { if (el.ceremony < 0 && !el.reduced) el.ceremony = 0; el.hoverT = 1; });
    window.addEventListener('deviceorientation', e => {
      if (e.gamma == null || el.reduced) return;
      el.tx = clamp(e.gamma / 28, -1, 1); el.ty = clamp((e.beta - 45) / 32, -1, 1);
    });
    const io = new IntersectionObserver(en => { el.visible = en[0].isIntersecting; }, { threshold: 0 });
    io.observe(this);
    this._onScroll = () => {
      const r = el.getBoundingClientRect();
      el._scroll = clamp(-r.top / Math.max(r.height, 1), 0, 1);
    };
    window.addEventListener('scroll', this._onScroll, { passive: true });
    this._onScroll();
  }
  resize() {
    const w = this.clientWidth || 1, h = this.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    const cam = this.cam; cam.aspect = w / h;
    const obj = this._concept === 'A' ? 2.62 : this._concept === 'B' ? 3.05 : 2.72;
    const need = obj / (h < 620 ? 0.50 : 0.56);
    cam.position.z = need / (2 * Math.tan((cam.fov / 2) * DEG) * Math.min(1, cam.aspect));
    cam.updateProjectionMatrix();
    if (this.reduced) this.frame(true);
  }

  /* ---------- animation ---------- */
  loop() {
    this._raf = requestAnimationFrame(() => this.loop());
    if (!this.visible) return;
    this.frame(false);
  }
  frame(instant) {
    const T = this.T, now = performance.now();
    const t = (now - this.t0) / 1000;
    const D = this._assembly;
    const A = this._concept === 'A', C = this._concept === 'C';

    this.hover = instant ? this.hoverT : lerp(this.hover, this.hoverT, 0.055);
    this.px = instant ? this.tx : lerp(this.px, this.tx, 0.045);
    this.py = instant ? this.ty : lerp(this.py, this.ty, 0.045);

    let cer = 0;
    if (this.ceremony >= 0) {
      this.ceremony += 1 / (2.9 * 60);
      if (this.ceremony >= 1) { this.ceremony = -1; cer = 0; } else cer = this.ceremony;
    }
    const cSwell = Math.sin(Math.PI * cer);
    const cTurn = inOutQuint(cer);

    const breath = this._ambient && !instant ? 1 : 0;
    const drift = t * (breath ? 1 : 0);

    /* root motion: parallax + breathing */
    const root = this.root;
    const targetRY = this.px * 0.22 + Math.sin(drift * 0.23) * 0.05 * breath;
    const targetRX = -this.py * 0.15 + Math.sin(drift * 0.19) * 0.035 * breath;
    root.rotation.y = instant ? targetRY : lerp(root.rotation.y, targetRY, 0.08);
    root.rotation.x = instant ? targetRX : lerp(root.rotation.x, targetRX, 0.08);
    root.rotation.z = Math.sin(drift * 0.13) * 0.018 * breath + (A ? Math.PI * 0.5 * cTurn : C ? 0 : Math.PI * 2 * cTurn);
    root.position.y = 0.46 + Math.sin(drift * 0.37) * 0.022 * breath - this._scroll * 0.15;
    const bs = 1 + Math.sin(drift * 0.5) * 0.005 * breath;
    root.scale.setScalar(bs * (1 - this._scroll * 0.12));

    const prog = instant ? 1 : clamp(t / D, 0, 1);
    const frag = (i, n) => {
      const start = (i / n) * D * 0.42, span = D * 0.58;
      return clamp((t - start) / span, 0, 1);
    };

    if (C) {
      const e = instant ? 1 : outQuint(clamp(t / (D * 0.62), 0, 1));
      const h = this.foldCard;
      h.rotation.y = (1 - e) * -2.15 + cSwell * 0.44;
      h.rotation.z = Math.sin(drift * 0.16) * 0.022 * breath + (1 - e) * 0.22;
      h.position.set(0, (1 - e) * -0.55, (1 - e) * -2.2 + cSwell * 0.28);
      h.scale.setScalar(0.74 + 0.26 * e);
      const fe = instant ? 1 : outBack(clamp((t - D * 0.48) / (D * 0.52), 0, 1));
      const rest = Math.PI * 0.94;
      const breatheF = Math.sin(drift * 0.34) * 0.05 * breath;
      this.flap.rotation.x = (rest + breatheF - this.hover * 0.07) * fe * (1 - cSwell * 0.97);
    } else if (A) {
      const TURN = 9;
      const ph = (t % TURN) / TURN, q = Math.floor(t / TURN);
      const te = inOutQuint(clamp((ph - 0.5) / 0.5, 0, 1));
      const spin = breath ? (q + te) * Math.PI / 2 : 0;
      this.frameGrp.rotation.z = spin + Math.PI / 2 * cTurn;
      this.core.rotation.z = Math.sin(drift * 0.19) * 0.085 * breath - Math.PI * 2 * cTurn;
      this.jaali.rotation.z = -drift * 0.052;

      this.plates.forEach((m, i) => {
        const e = instant ? 1 : outQuint(frag(i, 4));
        const r = m.userData.rest;
        const out = (1 - e) * 0.9 + cSwell * 0.34 + this._scroll * 0.30 + Math.sin(drift * 0.31) * 0.012 * breath;
        m.position.set(r.x + Math.cos(r.dir) * out, r.y + Math.sin(r.dir) * out, r.z + (1 - e) * -1.9);
        m.rotation.z = r.rz + (1 - e) * 0.55 - cSwell * 0.12;
        m.rotation.x = (1 - e) * -0.35;
      });
      const je = instant ? 1 : outQuint(clamp((t - D * 0.34) / (D * 0.5), 0, 1));
      this.jaali.scale.setScalar(0.35 + 0.65 * je);
      this.jaali.position.z = -0.10 + (1 - je) * -0.7 + cSwell * -0.18;
      this.coreBits.forEach((b, i) => {
        const e2 = instant ? 1 : outBack(clamp((t - D * (0.44 + i * 0.06)) / (D * 0.5), 0, 1));
        const p = b.userData.p0;
        b.position.set(p.x * (0.35 + 0.65 * e2), p.y + (1 - e2) * 0.62 * b.userData.dir, p.z + (1 - e2) * -0.9 + cSwell * 0.34);
        b.scale.setScalar(0.4 + 0.6 * e2);
      });
    } else {
      this.petals.forEach((p, i) => {
        const e = instant ? 1 : outQuint(frag(i, 5));
        const r = p.userData.rest;
        const open = e * (1 - cSwell * 0.92) * (1 + Math.sin(drift * 0.17) * 0.07 * breath);
        p.rotation.z = r.rz * open;
        p.position.set(r.x * e, r.y, r.z + (1 - e) * -1.4 + cSwell * 0.1);
        p.scale.setScalar(0.55 + 0.45 * e);
        const fold = r.fold * e * (1 + cSwell * 0.9) + Math.sin(drift * 0.42 + i) * 0.012 * breath;
        p.children.forEach(h => { if (h.userData.sign) h.rotation.y = fold * h.userData.sign; });
      });
    }

    /* inlay glow */
    const gl = 0.22 + this.hover * 0.70 * this._glowMax + cSwell * 0.35;
    const gv = gl * prog;
    this.mat.accent.opacity = clamp(gv * 0.15, 0, 1);
    this.sealSpark.material.opacity = clamp(gv * 0.62, 0, 1);
    this.foldSpark.material.opacity = clamp(gv * 0.75, 0, 1);
    this.lotusGlow.material.opacity = clamp(gv * 0.26, 0, 1);
    this.halo.material.opacity = clamp(0.09 + gv * 0.26, 0, 1);
    this.glowLight.intensity = 0.12 + gv * 1.3;
    this.mat.brass.envMapIntensity = 1.38 + this.hover * 0.4;

    /* shifting reflections */
    if (breath) {
      this.key.position.set(3.2 + Math.sin(drift * 0.11) * 0.9, 4.4, 4.2 + Math.cos(drift * 0.09) * 0.7);
      this.rim.position.set(-2.6 + Math.sin(drift * 0.07) * 1.1, 1.8, -3.6);
    }
    this.cam.position.x = lerp(this.cam.position.x, this.px * 0.16, 0.06);
    this.cam.position.y = lerp(this.cam.position.y, 0.06 - this.py * 0.10, 0.06);
    this.cam.lookAt(0, 0, 0);
    this.wall.position.x = -this.px * 0.22;
    this.renderer.render(this.scene, this.cam);
  }
}
customElements.define('nimanto-emblem', NimantoEmblem);
})();
