/* The Nimanto emblem — the fold lotus.
 *
 * Five brass-edged petals opening about a single axis: two ivory outer, three
 * lacquer inner, an emerald seed at the centre with the vermilion light behind
 * it. That is the product thesis as an object — something that opens because
 * you opened it, nothing sent on your behalf.
 *
 * Adapted from the first-party brand source vendored at
 * docs/superpowers/specs/assets/nimanto-emblem.source.js. Two deliberate
 * changes from that source:
 *
 *   1. three is imported, never fetched. The original pulled r160 from unpkg;
 *      Nimanto makes no external requests, and the workbench has to run offline.
 *      Imports are named rather than a namespace so the bundler can drop the
 *      large majority of three this scene never touches.
 *   2. Only the lotus ships. The source also carries an "MA seal" and an
 *      "invitation fold"; they are real code, but dead code is still bytes.
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
  CircleGeometry,
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
  TorusGeometry,
  WebGLRenderer,
} from "three";

const INK = 0x0a0908;
const IVORY = 0xd5ccb9;
const BRASS = 0xb8935a;
const LACQUER = 0x101013;
const EMERALD = 0x16543f;
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

/** Half a petal, mirrored by `sign`. Two of these back to back make one petal,
 *  which is what gives the brass seam down its spine. */
function petalShape(w: number, h: number, sign: number): Shape {
  const shape = new Shape();
  const x = (v: number) => v * sign;
  shape.moveTo(0, 0);
  shape.lineTo(0, h);
  shape.quadraticCurveTo(x(w * 0.98), h * 0.7, x(w * 0.66), h * 0.3);
  shape.quadraticCurveTo(x(w * 0.4), h * 0.055, 0, 0);
  return shape;
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
  #petals: Group[] = [];
  #glow!: Mesh;
  #halo!: Mesh;
  #glowLight!: PointLight;
  #key!: DirectionalLight;
  #rim!: DirectionalLight;
  #materials!: {
    ivory: MeshPhysicalMaterial;
    lacquer: MeshPhysicalMaterial;
    brass: MeshPhysicalMaterial;
    emerald: MeshPhysicalMaterial;
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
      lacquer: new MeshPhysicalMaterial({
        color: LACQUER,
        roughness: 0.36,
        metalness: 0.04,
        clearcoat: 1,
        clearcoatRoughness: 0.24,
        envMapIntensity: 0.55,
      }),
      emerald: new MeshPhysicalMaterial({
        color: EMERALD,
        roughness: 0.22,
        metalness: 0.1,
        clearcoat: 1,
        clearcoatRoughness: 0.1,
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
    this.#root.add(this.#buildLotus());
  }

  /* Five petals fanned about a single axis: two ivory outer, three lacquer
   * inner, every edge caught in brass. At the axis sits the emerald seed — the
   * palette reserves emerald for exactly one confirmed thing, and this is it —
   * with the vermilion light behind. */
  #buildLotus(): Group {
    const group = new Group();
    const spec = [
      { angle: -64, w: 0.33, h: 1.1, material: "ivory" as const },
      { angle: -33, w: 0.4, h: 1.44, material: "lacquer" as const },
      { angle: -3, w: 0.45, h: 1.66, material: "lacquer" as const },
      { angle: 27, w: 0.38, h: 1.38, material: "lacquer" as const },
      { angle: 56, w: 0.31, h: 1.02, material: "ivory" as const },
    ];
    const axis = -0.62;

    spec.forEach((petal, index) => {
      const holder = new Group();
      for (const sign of [1, -1]) {
        const geometry = new ExtrudeGeometry(petalShape(petal.w, petal.h, sign), {
          depth: 0.045,
          bevelEnabled: true,
          bevelThickness: 0.012,
          bevelSize: 0.012,
          bevelSegments: 2,
          curveSegments: 10,
        });
        geometry.translate(0, 0, -0.022);
        const half = new Mesh(geometry, [this.#materials[petal.material], this.#materials.brass]);
        half.castShadow = true;
        half.receiveShadow = true;
        half.userData.sign = sign;
        holder.add(half);
      }
      const radians = petal.angle * DEG;
      const radius = 0.12;
      holder.userData.rest = {
        rz: radians,
        x: -Math.sin(radians) * radius,
        y: Math.cos(radians) * radius + axis,
        z: (index - 2) * 0.016,
        fold: 8 * DEG,
      };
      group.add(holder);
      this.#petals.push(holder);
    });

    const hub = new Mesh(new TorusGeometry(0.155, 0.032, 10, 44), this.#materials.brass);
    hub.position.y = axis;
    hub.castShadow = true;
    group.add(hub);

    const seed = new Mesh(new CircleGeometry(0.115, 32), this.#materials.emerald);
    seed.position.set(0, axis, 0.01);
    group.add(seed);

    this.#glow = new Mesh(new CircleGeometry(0.34, 40), this.#materials.accent.clone());
    this.#glow.position.set(0, axis, -0.09);
    group.add(this.#glow);

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
    const subject = 3.05;
    // Fraction of the frame the mark should occupy. It is the page's one
    // subject, so it fills most of its box rather than floating in it.
    const need = subject / (height < 620 ? 0.78 : 0.9);
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
    root.rotation.z = Math.sin(drift * 0.13) * 0.018 * breath + Math.PI * 2 * turn;
    // Scroll drifts the mark up and settles it to 0.88 as the thesis arrives.
    root.position.y = 0.18 + Math.sin(drift * 0.37) * 0.022 * breath - this.#scroll * 0.15;
    const breathScale = 1 + Math.sin(drift * 0.5) * 0.005 * breath;
    root.scale.setScalar(breathScale * (1 - this.#scroll * 0.12));

    const progress = instant ? 1 : clamp(t / d, 0, 1);
    // Petals open in sequence rather than together, so the mark assembles.
    const stagger = (index: number) => {
      const begin = (index / 5) * d * 0.42;
      return clamp((t - begin) / (d * 0.58), 0, 1);
    };

    this.#petals.forEach((petal, index) => {
      const eased = instant ? 1 : outQuint(stagger(index));
      const rest = petal.userData.rest as {
        rz: number;
        x: number;
        y: number;
        z: number;
        fold: number;
      };
      // The ceremony closes the lotus and lets it open again.
      const open = eased * (1 - swell * 0.92) * (1 + Math.sin(drift * 0.17) * 0.07 * breath);
      petal.rotation.z = rest.rz * open;
      petal.position.set(rest.x * eased, rest.y, rest.z + (1 - eased) * -1.4 + swell * 0.1);
      petal.scale.setScalar(0.55 + 0.45 * eased);
      const fold =
        rest.fold * eased * (1 + swell * 0.9) + Math.sin(drift * 0.42 + index) * 0.012 * breath;
      for (const half of petal.children) {
        if (half.userData.sign) half.rotation.y = fold * (half.userData.sign as number);
      }
    });

    const glow = (0.22 + this.#hover * 0.7 + swell * 0.35) * progress;
    this.#materials.accent.opacity = clamp(glow * 0.15, 0, 1);
    (this.#glow.material as MeshBasicMaterial).opacity = clamp(glow * 0.26, 0, 1);
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
