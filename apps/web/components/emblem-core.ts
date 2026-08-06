/* The Nimanto emblem — the invitation fold.
 *
 * A notched, jaali-pierced card whose corner peels back on a hinge to reveal
 * the vermilion light behind it. That is the product thesis as an object: an
 * invitation you open yourself, nothing sent on your behalf.
 *
 * Adapted from the first-party brand source vendored at
 * docs/superpowers/specs/assets/nimanto-emblem.source.js. Two deliberate
 * changes from that source:
 *
 *   1. three is imported, never fetched. The original pulled r160 from unpkg;
 *      Nimanto makes no external requests, and the workbench has to run offline.
 *      Imports are named rather than a namespace so the bundler can drop the
 *      large majority of three this scene never touches.
 *   2. Only the fold ships. The source also carries an "MA seal" and a "fold
 *      lotus"; they are real code, but dead code in a bundle is still bytes.
 *
 * Every colour here is a token from tokens.css, not an invention. */

import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  BackSide,
  BoxGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  PCFShadowMap,
  Path,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  PointLight,
  SRGBColorSpace,
  Scene,
  Shape,
  ShadowMaterial,
  WebGLRenderer,
} from "three";

const INK = 0x0a0908;
const IVORY = 0xd5ccb9;
const BRASS = 0xb8935a;
const INLAY = 0x9d7c4a;
const VERMILION = "#D6472C";

const DEG = Math.PI / 180;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const outQuint = (t: number) => 1 - Math.pow(1 - t, 5);
const inOutQuint = (t: number) =>
  t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;
const outBack = (t: number) => {
  const c1 = 1.24;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

/* ── shapes ─────────────────────────────────────────────────────────────── */

function diamond(cx: number, cy: number, r: number): Path {
  const p = new Path();
  p.moveTo(cx, cy - r);
  p.lineTo(cx + r, cy);
  p.lineTo(cx, cy + r);
  p.lineTo(cx - r, cy);
  p.closePath();
  return p;
}

/** The card outline: a square with one corner cut away, inset by `d`. */
function notchPoly(s: number, c: number, d: number): [number, number][] {
  const k = 2 * s - c - d * Math.SQRT2;
  return [
    [-s + d, -s + d],
    [s - d, -s + d],
    [s - d, k - (s - d)],
    [k - (s - d), s - d],
    [-s + d, s - d],
  ];
}

function polyShape(points: [number, number][]): Shape {
  const shape = new Shape();
  points.forEach((p, i) => (i ? shape.lineTo(p[0], p[1]) : shape.moveTo(p[0], p[1])));
  shape.closePath();
  return shape;
}

function polyPath(points: [number, number][]): Path {
  const path = new Path();
  points.forEach((p, i) => (i ? path.lineTo(p[0], p[1]) : path.moveTo(p[0], p[1])));
  path.closePath();
  return path;
}

function glowTexture(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(128, 128, 4, 128, 128, 126);
  gradient.addColorStop(0, "rgba(255,255,255,.9)");
  gradient.addColorStop(0.32, "rgba(255,255,255,.22)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  return canvas;
}

/* A five-panel studio rig baked to an environment map. This is what puts a
 * believable specular roll across the brass edge; without it the metal reads
 * as flat orange plastic. */
function studioEnvironment(renderer: WebGLRenderer) {
  const scene = new Scene();
  const plane = new PlaneGeometry(1, 1);
  const panel = (
    hex: number,
    multiplier: number,
    position: [number, number, number],
    scale: [number, number, number],
  ) => {
    const mesh = new Mesh(
      plane,
      new MeshBasicMaterial({ color: new Color(hex).multiplyScalar(multiplier) }),
    );
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    mesh.lookAt(0, 0, 0);
    scene.add(mesh);
  };
  scene.add(
    new Mesh(new BoxGeometry(30, 30, 30), new MeshBasicMaterial({ color: INK, side: BackSide })),
  );
  panel(0xfff2df, 3.4, [4, 5, 4], [7, 7, 1]);
  panel(0x9fb6cf, 0.8, [-6, 1, 3], [8, 8, 1]);
  panel(0xffcf9a, 1.7, [-2, 2.5, -6], [6, 6, 1]);
  panel(0xffe6c8, 1.5, [0.5, 1.2, 7], [8, 8, 1]);
  panel(0xd6472c, 0.5, [2, -3, -4], [4, 4, 1]);
  const generator = new PMREMGenerator(renderer);
  const texture = generator.fromScene(scene, 0.03).texture;
  generator.dispose();
  return texture;
}

export type EmblemOptions = {
  /** Seconds the assembly takes. */
  assembly?: number;
  /** Ambient breathing and parallax. Off under prefers-reduced-motion. */
  ambient?: boolean;
  reducedMotion?: boolean;
};

export class NimantoEmblem {
  #host: HTMLElement;
  #renderer: WebGLRenderer;
  #scene = new Scene();
  #camera = new PerspectiveCamera(26, 1, 0.1, 60);
  #root = new Group();
  #card = new Group();
  #flap = new Group();
  #spark!: Mesh;
  #halo!: Mesh;
  #glowLight!: PointLight;
  #key!: DirectionalLight;
  #rim!: DirectionalLight;
  #materials!: {
    ivory: MeshPhysicalMaterial;
    brass: MeshPhysicalMaterial;
    inlay: MeshPhysicalMaterial;
    vermilion: MeshPhysicalMaterial;
    accent: MeshBasicMaterial;
  };

  #assembly: number;
  #ambient: boolean;
  #reduced: boolean;
  #start = 0;
  #raf = 0;
  #visible = true;
  #scroll = 0;
  #hover = 0;
  #hoverTarget = 0;
  #px = 0;
  #py = 0;
  #tx = 0;
  #ty = 0;
  #ceremony = -1;
  #observer?: ResizeObserver;
  #intersection?: IntersectionObserver;
  #disposed = false;

  constructor(host: HTMLElement, options: EmblemOptions = {}) {
    this.#host = host;
    this.#assembly = clamp(options.assembly ?? 5, 0.5, 12);
    this.#reduced = options.reducedMotion ?? false;
    this.#ambient = (options.ambient ?? true) && !this.#reduced;

    this.#renderer = new WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.#renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.#renderer.toneMapping = ACESFilmicToneMapping;
    this.#renderer.toneMappingExposure = 1.02;
    this.#renderer.outputColorSpace = SRGBColorSpace;
    this.#renderer.shadowMap.enabled = true;
    // PCFSoftShadowMap was deprecated between the r160 the scene was tuned
    // against and the r185 we bundle; it now silently falls back and warns, and
    // the e2e journey asserts a clean console.
    this.#renderer.shadowMap.type = PCFShadowMap;
    this.#renderer.domElement.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%;display:block";
    host.appendChild(this.#renderer.domElement);

    this.#build();
    this.#bind();
    this.#start = performance.now();
    this.resize();

    // Under reduced motion we render exactly one frame at the assembled rest
    // pose and never start a loop.
    if (this.#reduced) this.#frame(true);
    else this.#loop();
  }

  #build() {
    this.#scene.background = null;
    this.#scene.environment = studioEnvironment(this.#renderer);
    this.#camera.position.set(0, 0.06, 6.6);

    /* No wall mesh. The original drew a lit backdrop plane, which on an ink page
     * paints a visible rectangle exactly the size of the canvas — the mark ends
     * up sitting in a box instead of in the page. The umber atmosphere is a CSS
     * radial wash behind the canvas instead, and the canvas itself is
     * transparent. */
    const floor = new Mesh(new PlaneGeometry(30, 30), new ShadowMaterial({ opacity: 0.46 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.62;
    floor.receiveShadow = true;
    this.#scene.add(floor);

    this.#key = new DirectionalLight(0xfff1e0, 2.5);
    this.#key.position.set(3.2, 4.4, 4.2);
    this.#key.castShadow = true;
    this.#key.shadow.mapSize.set(1024, 1024);
    this.#key.shadow.radius = 4;
    this.#key.shadow.bias = -0.0012;
    const shadowCamera = this.#key.shadow.camera;
    shadowCamera.left = -3.2;
    shadowCamera.right = 3.2;
    shadowCamera.top = 3.2;
    shadowCamera.bottom = -3.2;
    shadowCamera.near = 1;
    shadowCamera.far = 16;
    this.#scene.add(this.#key);

    this.#rim = new DirectionalLight(0xffd3a0, 1.5);
    this.#rim.position.set(-2.6, 1.8, -3.6);
    this.#scene.add(this.#rim);

    const fill = new DirectionalLight(0x93aec9, 0.45);
    fill.position.set(-4, 0.6, 2.4);
    this.#scene.add(fill);

    this.#glowLight = new PointLight(new Color(VERMILION), 0.3, 4.5, 2);
    this.#glowLight.position.set(0, 0, -0.35);
    this.#scene.add(this.#glowLight);

    this.#materials = {
      ivory: new MeshPhysicalMaterial({
        color: IVORY,
        roughness: 0.78,
        metalness: 0.02,
        clearcoat: 0.2,
        envMapIntensity: 0.58,
      }),
      brass: new MeshPhysicalMaterial({
        color: BRASS,
        roughness: 0.29,
        metalness: 1,
        envMapIntensity: 1.45,
      }),
      inlay: new MeshPhysicalMaterial({
        color: INLAY,
        roughness: 0.44,
        metalness: 1,
        envMapIntensity: 0.85,
      }),
      vermilion: new MeshPhysicalMaterial({
        color: new Color(VERMILION).multiplyScalar(0.72),
        roughness: 0.3,
        metalness: 0.06,
        clearcoat: 1,
        clearcoatRoughness: 0.18,
        envMapIntensity: 0.5,
      }),
      accent: new MeshBasicMaterial({
        color: new Color(VERMILION),
        transparent: true,
        opacity: 0.3,
        side: DoubleSide,
        depthWrite: false,
      }),
    };

    const haloMap = new CanvasTexture(glowTexture());
    haloMap.colorSpace = SRGBColorSpace;
    this.#halo = new Mesh(
      new PlaneGeometry(6.2, 6.2),
      new MeshBasicMaterial({
        map: haloMap,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        color: new Color(VERMILION),
        opacity: 0.16,
      }),
    );
    this.#halo.position.set(0, 0.46, -1.9);
    this.#scene.add(this.#halo);

    this.#scene.add(this.#root);
    this.#root.add(this.#buildFold());
  }

  #buildFold(): Group {
    const group = new Group();
    const s = 0.775;
    const c = 0.62;

    const card = polyShape(notchPoly(s, c, 0));
    // Three jaali piercings stepping along the diagonal toward the notch.
    for (let i = 0; i < 3; i++) {
      const u = (i + 0.5) / 3;
      const l = 0.5;
      card.holes.push(diamond(-s + l * u + 0.27, -s + l * (1 - u) + 0.27, 0.058));
    }
    const cardGeometry = new ExtrudeGeometry(card, {
      depth: 0.16,
      bevelEnabled: true,
      bevelThickness: 0.016,
      bevelSize: 0.016,
      bevelSegments: 2,
      curveSegments: 3,
    });
    cardGeometry.translate(0, 0, -0.08);
    const cardMesh = new Mesh(cardGeometry, [this.#materials.ivory, this.#materials.brass]);
    cardMesh.castShadow = true;
    cardMesh.receiveShadow = true;

    // A recessed brass rule tracking the card outline one step inside it.
    const rule = polyShape(notchPoly(s, c, 0.125));
    rule.holes.push(polyPath(notchPoly(s, c, 0.149)));
    const ruleGeometry = new ExtrudeGeometry(rule, {
      depth: 0.014,
      bevelEnabled: false,
      curveSegments: 2,
    });
    ruleGeometry.translate(0, 0, 0.082);

    this.#card.add(cardMesh);
    this.#card.add(new Mesh(ruleGeometry, this.#materials.inlay));
    group.add(this.#card);

    this.#spark = new Mesh(new PlaneGeometry(0.88, 0.28), this.#materials.accent.clone());
    this.#spark.position.set(-0.255, -0.255, -0.115);
    this.#spark.rotation.z = -Math.PI / 4;
    this.#card.add(this.#spark);

    // The flap: the cut corner, hinged so it turns back over the light.
    const angle = Math.PI * 0.75;
    const mx = s - c / 2;
    const my = s - c / 2;
    const triangle = new Shape();
    triangle.moveTo(s, s - c);
    triangle.lineTo(s, s);
    triangle.lineTo(s - c, s);
    triangle.closePath();
    const flapGeometry = new ExtrudeGeometry(triangle, {
      depth: 0.1,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.012,
      bevelSegments: 2,
      curveSegments: 2,
    });
    flapGeometry.translate(-mx, -my, -0.105);
    flapGeometry.rotateZ(-angle);
    const flapMesh = new Mesh(flapGeometry, [this.#materials.vermilion, this.#materials.brass]);
    flapMesh.castShadow = true;
    this.#flap.add(flapMesh);
    const pivot = new Group();
    pivot.position.set(mx, my, 0.08);
    pivot.rotation.z = angle;
    pivot.add(this.#flap);
    this.#card.add(pivot);

    return group;
  }

  #bind() {
    const host = this.#host;
    host.addEventListener("pointermove", this.#onPointerMove);
    host.addEventListener("pointerenter", this.#onPointerEnter);
    host.addEventListener("pointerleave", this.#onPointerLeave);
    host.addEventListener("pointerdown", this.#onPointerDown);
    window.addEventListener("scroll", this.#onScroll, { passive: true });
    this.#observer = new ResizeObserver(() => this.resize());
    this.#observer.observe(host);
    this.#intersection = new IntersectionObserver(
      (entries) => {
        this.#visible = entries[0]?.isIntersecting ?? true;
      },
      { threshold: 0 },
    );
    this.#intersection.observe(host);
    this.#onScroll();
  }

  #onPointerMove = (event: PointerEvent) => {
    const rect = this.#host.getBoundingClientRect();
    this.#tx = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    this.#ty = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    if (this.#reduced) this.#frame(true);
  };
  #onPointerEnter = () => {
    this.#hoverTarget = 1;
  };
  #onPointerLeave = () => {
    this.#hoverTarget = 0;
    this.#tx = 0;
    this.#ty = 0;
  };
  /** The ceremony: the fold opens and closes once, then returns to rest. It
   *  leaves no state, so it is re-triggerable and never a navigation. */
  #onPointerDown = () => {
    if (this.#ceremony < 0 && !this.#reduced) this.#ceremony = 0;
    this.#hoverTarget = 1;
  };
  #onScroll = () => {
    const rect = this.#host.getBoundingClientRect();
    this.#scroll = clamp(-rect.top / Math.max(rect.height, 1), 0, 1);
  };

  resize() {
    const width = this.#host.clientWidth || 1;
    const height = this.#host.clientHeight || 1;
    this.#renderer.setSize(width, height, false);
    this.#camera.aspect = width / height;
    const subject = 2.72;
    // Fraction of the frame the mark should occupy. It is the page's one
    // subject, so it fills most of its box rather than floating in it.
    const need = subject / (height < 620 ? 0.68 : 0.78);
    this.#camera.position.z =
      need / (2 * Math.tan((this.#camera.fov / 2) * DEG) * Math.min(1, this.#camera.aspect));
    this.#camera.updateProjectionMatrix();
    if (this.#reduced) this.#frame(true);
  }

  #loop = () => {
    if (this.#disposed) return;
    this.#raf = requestAnimationFrame(this.#loop);
    if (!this.#visible) return;
    this.#frame(false);
  };

  #frame(instant: boolean) {
    const now = performance.now();
    const t = (now - this.#start) / 1000;
    const d = this.#assembly;

    this.#hover = instant ? this.#hoverTarget : lerp(this.#hover, this.#hoverTarget, 0.055);
    this.#px = instant ? this.#tx : lerp(this.#px, this.#tx, 0.045);
    this.#py = instant ? this.#ty : lerp(this.#py, this.#ty, 0.045);

    let ceremony = 0;
    if (this.#ceremony >= 0) {
      this.#ceremony += 1 / (2.9 * 60);
      if (this.#ceremony >= 1) this.#ceremony = -1;
      else ceremony = this.#ceremony;
    }
    const swell = Math.sin(Math.PI * ceremony);
    const turn = inOutQuint(ceremony);

    const breath = this.#ambient && !instant ? 1 : 0;
    const drift = t * breath;

    const root = this.#root;
    const targetY = this.#px * 0.22 + Math.sin(drift * 0.23) * 0.05 * breath;
    const targetX = -this.#py * 0.15 + Math.sin(drift * 0.19) * 0.035 * breath;
    root.rotation.y = instant ? targetY : lerp(root.rotation.y, targetY, 0.08);
    root.rotation.x = instant ? targetX : lerp(root.rotation.x, targetX, 0.08);
    root.rotation.z = Math.sin(drift * 0.13) * 0.018 * breath;
    // Scroll drifts the mark up and settles it to 0.88 as the thesis arrives.
    root.position.y = 0.46 + Math.sin(drift * 0.37) * 0.022 * breath - this.#scroll * 0.15;
    const breathScale = 1 + Math.sin(drift * 0.5) * 0.005 * breath;
    root.scale.setScalar(breathScale * (1 - this.#scroll * 0.12));

    const progress = instant ? 1 : clamp(t / d, 0, 1);
    const entry = instant ? 1 : outQuint(clamp(t / (d * 0.62), 0, 1));
    const card = this.#card;
    card.rotation.y = (1 - entry) * -2.15 + swell * 0.44;
    card.rotation.z = Math.sin(drift * 0.16) * 0.022 * breath + (1 - entry) * 0.22;
    card.position.set(0, (1 - entry) * -0.55, (1 - entry) * -2.2 + swell * 0.28);
    card.scale.setScalar(0.74 + 0.26 * entry);

    const flapEase = instant ? 1 : outBack(clamp((t - d * 0.48) / (d * 0.52), 0, 1));
    const rest = Math.PI * 0.94;
    const flapBreath = Math.sin(drift * 0.34) * 0.05 * breath;
    this.#flap.rotation.x =
      (rest + flapBreath - this.#hover * 0.07) * flapEase * (1 - swell * 0.97);

    const glow = (0.22 + this.#hover * 0.7 + swell * 0.35) * progress;
    this.#materials.accent.opacity = clamp(glow * 0.15, 0, 1);
    (this.#spark.material as MeshBasicMaterial).opacity = clamp(glow * 0.75, 0, 1);
    (this.#halo.material as MeshBasicMaterial).opacity = clamp(0.09 + glow * 0.26, 0, 1);
    this.#glowLight.intensity = 0.12 + glow * 1.3;
    this.#materials.brass.envMapIntensity = 1.38 + this.#hover * 0.4;

    if (breath) {
      this.#key.position.set(
        3.2 + Math.sin(drift * 0.11) * 0.9,
        4.4,
        4.2 + Math.cos(drift * 0.09) * 0.7,
      );
      this.#rim.position.set(-2.6 + Math.sin(drift * 0.07) * 1.1, 1.8, -3.6);
    }
    this.#camera.position.x = lerp(this.#camera.position.x, this.#px * 0.16, 0.06);
    this.#camera.position.y = lerp(this.#camera.position.y, 0.06 - this.#py * 0.1, 0.06);
    this.#camera.lookAt(0, 0, 0);
    this.#renderer.render(this.#scene, this.#camera);
  }

  dispose() {
    this.#disposed = true;
    cancelAnimationFrame(this.#raf);
    this.#observer?.disconnect();
    this.#intersection?.disconnect();
    const host = this.#host;
    host.removeEventListener("pointermove", this.#onPointerMove);
    host.removeEventListener("pointerenter", this.#onPointerEnter);
    host.removeEventListener("pointerleave", this.#onPointerLeave);
    host.removeEventListener("pointerdown", this.#onPointerDown);
    window.removeEventListener("scroll", this.#onScroll);
    this.#scene.traverse((object) => {
      const mesh = object as Mesh;
      mesh.geometry?.dispose?.();
      const material = mesh.material;
      if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
      else material?.dispose?.();
    });
    this.#renderer.dispose();
    this.#renderer.domElement.remove();
  }
}
