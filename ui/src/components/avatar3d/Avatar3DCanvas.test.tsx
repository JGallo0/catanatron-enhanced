import { createRef } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import * as THREE from "three";
import Avatar3DCanvas, {
  isWebGLSupported,
  type Avatar3DCanvasHandle,
} from "./Avatar3DCanvas";
import {
  MOUNT_PROFILES,
  applyAvatarCombinationAndPose,
  clearAvatarGltfCache,
  composeAvatarScene,
  createFacialFeaturesGroup,
  disposeObjectTree,
  updateAvatarAnimation,
  updateAvatarBodyProportions,
  updateAvatarFacialFeatures,
} from "./sceneComposer";
import { resolveAvatarConfig } from "../../config/avatarCatalog";

vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal<typeof import("three")>();

  class MockWebGLRenderer {
    domElement: HTMLCanvasElement;
    shadowMap = { enabled: false, type: actual.PCFSoftShadowMap };
    outputColorSpace = actual.SRGBColorSpace;
    toneMapping = actual.ACESFilmicToneMapping;
    toneMappingExposure = 1;
    private width = 320;
    private height = 320;
    private pixelRatio = 1;

    setPixelRatio = vi.fn((r: number) => {
      this.pixelRatio = r;
    });
    getPixelRatio = vi.fn(() => this.pixelRatio);
    setSize = vi.fn((w: number, h: number) => {
      this.width = w;
      this.height = h;
    });
    getSize = vi.fn((target: { set: (w: number, h: number) => unknown }) =>
      target.set(this.width, this.height)
    );
    setClearColor = vi.fn();
    ["render"] = vi.fn();
    dispose = vi.fn();

    constructor(opts?: { canvas?: HTMLCanvasElement }) {
      if (mockState.throwOnRendererInit) {
        throw new Error("Simulated WebGL context failure");
      }
      this.domElement = opts?.canvas ?? document.createElement("canvas");
      mockRendererInstances.push(this);
    }
  }

  return {
    ...actual,
    WebGLRenderer: MockWebGLRenderer,
  };
});

vi.mock("three/examples/jsm/controls/OrbitControls.js", () => {
  class MockOrbitControls {
    target = {
      x: 0,
      y: 0,
      z: 0,
      set(nx: number, ny: number, nz: number) {
        this.x = nx;
        this.y = ny;
        this.z = nz;
        return this;
      },
    };
    enablePan = true;
    enableZoom = true;
    enableDamping = false;
    dampingFactor = 0.05;
    minDistance = 0;
    maxDistance = Infinity;
    minPolarAngle = 0;
    maxPolarAngle = Math.PI;
    autoRotate = false;
    update = vi.fn();
    dispose = vi.fn();

    constructor() {
      mockOrbitControlsInstances.push(this);
    }
  }
  return { OrbitControls: MockOrbitControls };
});

vi.mock("three/examples/jsm/loaders/DRACOLoader.js", () => {
  class MockDRACOLoader {
    setDecoderPath = vi.fn().mockReturnThis();
    dispose = vi.fn();
  }
  return { DRACOLoader: MockDRACOLoader };
});

vi.mock("three/examples/jsm/loaders/GLTFLoader.js", () => {
  class MockGLTFLoader {
    setDRACOLoader = vi.fn().mockReturnThis();
    loadAsync = (url: string) => mockLoadAsync(url);
  }
  return { GLTFLoader: MockGLTFLoader };
});

const mockRendererInstances: Array<{
  domElement: HTMLCanvasElement;
  setPixelRatio: ReturnType<typeof vi.fn>;
  setSize: ReturnType<typeof vi.fn>;
  setClearColor: ReturnType<typeof vi.fn>;
  render: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
  getSize: ReturnType<typeof vi.fn>;
  getPixelRatio: ReturnType<typeof vi.fn>;
  shadowMap: { enabled: boolean; type: number };
  outputColorSpace: string;
  toneMapping: number;
  toneMappingExposure: number;
}> = [];

const mockOrbitControlsInstances: Array<{
  target: { x: number; y: number; z: number; set: (x: number, y: number, z: number) => unknown };
  enablePan: boolean;
  enableZoom: boolean;
  enableDamping: boolean;
  dampingFactor: number;
  minDistance: number;
  maxDistance: number;
  minPolarAngle: number;
  maxPolarAngle: number;
  autoRotate: boolean;
  update: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
}> = [];

const mockState = { throwOnRendererInit: false };
const mockLoadAsync = vi.fn();

function makeMockGlbScene(matName: string): { scene: THREE.Group } {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ name: matName, color: "#ffffff" });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), mat);
  group.add(mesh);
  return { scene: group };
}

describe("Avatar3DCanvas", () => {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  const originalResizeObserver = globalThis.ResizeObserver;

  beforeEach(() => {
    vi.clearAllMocks();
    clearAvatarGltfCache();
    mockRendererInstances.length = 0;
    mockOrbitControlsInstances.length = 0;
    mockState.throwOnRendererInit = false;

    mockLoadAsync.mockImplementation(async (url: string) => {
      if (url.includes("/bodies/")) return makeMockGlbScene("mat_skin");
      if (url.includes("/heads/")) return makeMockGlbScene("mat_eyes");
      if (url.includes("/hair/") || url.includes("/beards/")) return makeMockGlbScene("mat_hair");
      if (url.includes("/mounts/")) return makeMockGlbScene("mat_mount");
      return makeMockGlbScene("mat_primary");
    });

    globalThis.ResizeObserver = class MockResizeObserver {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    } as unknown as typeof ResizeObserver;
  });

  afterEach(() => {
    cleanup();
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    globalThis.ResizeObserver = originalResizeObserver;
  });

  test("isWebGLSupported returns false cleanly in jsdom and when getContext throws", () => {
    expect(isWebGLSupported()).toBe(false);

    HTMLCanvasElement.prototype.getContext = vi.fn(() => {
      throw new Error("Canvas blocked");
    }) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    expect(isWebGLSupported()).toBe(false);
  });

  test("renders PlayerAvatar fallback without throwing when WebGL is unavailable", () => {
    const ref = createRef<Avatar3DCanvasHandle>();
    render(
      <Avatar3DCanvas
        ref={ref}
        config={{
          skin: "warm",
          outfit: "captain",
          outfitColor: "royal",
          background: "ocean",
          frame: "gold",
        }}
        username="joao"
        fallbackSize={96}
        mode="card"
      />
    );

    const fallback = screen.getByTestId("avatar-3d-fallback");
    expect(fallback).toBeInTheDocument();
    expect(screen.getByTestId("player-avatar")).toBeInTheDocument();
    expect(ref.current?.capturePortraitSnapshot()).toBeNull();
  });

  test("falls back to PlayerAvatar gracefully if WebGLRenderer throws during initialization", () => {
    HTMLCanvasElement.prototype.getContext = vi.fn((type: string) => {
      if (type === "webgl2" || type === "webgl") return {} as RenderingContext;
      return null;
    }) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    mockState.throwOnRendererInit = true;

    render(
      <Avatar3DCanvas
        config={{ outfit: "settler", background: "forest" }}
        username="capitao"
      />
    );

    expect(screen.getByTestId("avatar-3d-fallback")).toBeInTheDocument();
    expect(screen.getByTestId("player-avatar")).toBeInTheDocument();
  });

  test("mounts 3D scene when WebGL is supported, skips null modelPath slots, invokes onReady, and disposes on unmount", async () => {
    HTMLCanvasElement.prototype.getContext = vi.fn((type: string) => {
      if (type === "webgl2" || type === "webgl") return {} as RenderingContext;
      return null;
    }) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    const onReady = vi.fn();
    const { unmount } = render(
      <Avatar3DCanvas
        config={{
          version: 2,
          bodyType: "athletic",
          headShape: "oval",
          hair: "short",
          beard: "none",
          outfit: "captain",
          legsBoots: "cuffed_boots",
          cape: "none",
          hat: "captain",
          handProp: "spyglass",
          backProp: "none",
          pet: "none",
          mount: "none",
          pedestal: "stone_wood",
          aura: "sun_motes",
          background: "ocean",
        }}
        mode="studio"
        interactive={true}
        onReady={onReady}
      />
    );

    expect(screen.queryByTestId("avatar-3d-fallback")).not.toBeInTheDocument();
    expect(screen.getByTestId("avatar-3d-canvas")).toBeInTheDocument();
    expect(mockRendererInstances).toHaveLength(1);
    expect(mockOrbitControlsInstances).toHaveLength(1);
    expect(mockOrbitControlsInstances[0].enablePan).toBe(false);

    await waitFor(() => {
      expect(onReady).toHaveBeenCalledTimes(1);
    });

    // Only non-null modelPath items should be requested (beard, cape, backProp, pet, mount are "none" => null)
    const loadedUrls = mockLoadAsync.mock.calls.map((c) => c[0] as string);
    expect(loadedUrls).toContain("/assets/models/avatars/bodies/athletic.glb");
    expect(loadedUrls).toContain("/assets/models/avatars/heads/oval.glb");
    expect(loadedUrls).toContain("/assets/models/avatars/outfits/captain.glb");
    expect(loadedUrls).toContain("/assets/models/avatars/pedestals/stone_wood.glb");
    expect(loadedUrls.some((u) => u.includes("/beards/"))).toBe(false);
    expect(loadedUrls.some((u) => u.includes("/capes/"))).toBe(false);
    expect(loadedUrls.some((u) => u.includes("/mounts/"))).toBe(false);

    const renderer = mockRendererInstances[0];
    const controls = mockOrbitControlsInstances[0];

    unmount();
    expect(controls.dispose).toHaveBeenCalledTimes(1);
    expect(renderer.dispose).toHaveBeenCalledTimes(1);
  });

  test("capturePortraitSnapshot renders 256x256 portrait frame, retries on >65536 chars, and restores renderer synchronously", async () => {
    HTMLCanvasElement.prototype.getContext = vi.fn((type: string) => {
      if (type === "webgl2" || type === "webgl") return {} as RenderingContext;
      return null;
    }) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    const ref = createRef<Avatar3DCanvasHandle>();
    render(
      <Avatar3DCanvas
        ref={ref}
        config={{ bodyType: "athletic", headShape: "oval", background: "sunset" }}
        mode="studio"
        cameraFocus="full"
      />
    );

    const renderer = mockRendererInstances[0];
    const hugeDataUrl = "data:image/webp;base64," + "A".repeat(70000);
    const compactDataUrl = "data:image/webp;base64,UklGRh4AAABXRUJQVlA4";

    const toDataURLSpy = vi
      .spyOn(renderer.domElement, "toDataURL")
      .mockReturnValueOnce(hugeDataUrl)
      .mockReturnValueOnce(compactDataUrl);

    const snapshot = ref.current?.capturePortraitSnapshot();
    expect(snapshot).toBe(compactDataUrl);
    expect(toDataURLSpy).toHaveBeenNthCalledWith(1, "image/webp", 0.86);
    expect(toDataURLSpy).toHaveBeenNthCalledWith(2, "image/webp", 0.72);

    // Must switch to 256x256 for capture and synchronously restore previous size
    expect(renderer.setSize).toHaveBeenCalledWith(256, 256, false);
    const lastSetSizeCall =
      renderer.setSize.mock.calls[renderer.setSize.mock.calls.length - 1];
    expect(lastSetSizeCall[0]).not.toBe(256);
    expect(renderer.render).toHaveBeenCalled();
  });

  test("keeps background transparent in hero mode with backgroundMode='transparent'", () => {
    HTMLCanvasElement.prototype.getContext = vi.fn((type: string) => {
      if (type === "webgl2" || type === "webgl") return {} as RenderingContext;
      return null;
    }) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    render(
      <Avatar3DCanvas
        config={{ bodyType: "athletic", background: "ocean" }}
        mode="hero"
        backgroundMode="transparent"
      />
    );

    const container = screen.getByTestId("avatar-3d-canvas");
    expect(container).toHaveClass("avatar-3d-canvas--hero");
    expect(container).toHaveClass("avatar-3d-canvas--bg-transparent");
    expect(mockRendererInstances[0].setClearColor).toHaveBeenCalledWith(0x000000, 0);
  });

  test("re-applies color updates without re-fetching glTF models", async () => {
    HTMLCanvasElement.prototype.getContext = vi.fn((type: string) => {
      if (type === "webgl2" || type === "webgl") return {} as RenderingContext;
      return null;
    }) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    const baseCfg = {
      version: 2 as const,
      bodyType: "athletic" as const,
      headShape: "oval" as const,
      outfit: "captain" as const,
      colors: {
        skin: "#f3cfb3",
        hair: "#5a3821",
        eyes: "#0284c7",
        outfitPrimary: "#dc2626",
        outfitSecondary: "#1e3a8a",
        outfitTrim: "#facc15",
        mount: "#854d0e",
      },
    };

    const { rerender } = render(<Avatar3DCanvas config={baseCfg} mode="studio" />);

    await waitFor(() => {
      expect(mockLoadAsync).toHaveBeenCalled();
    });
    const callsAfterMount = mockLoadAsync.mock.calls.length;

    rerender(
      <Avatar3DCanvas
        config={{
          ...baseCfg,
          colors: { ...baseCfg.colors, outfitPrimary: "#059669" },
        }}
        mode="studio"
      />
    );

    expect(mockLoadAsync.mock.calls.length).toBe(callsAfterMount);
  });

  test("sceneComposer enforces exact socket coordinates, caches glTF downloads across instances, and disposes safely", async () => {
    const resolvedA = resolveAvatarConfig({
      version: 2,
      bodyType: "athletic",
      headShape: "oval",
      hair: "short",
      outfit: "captain",
      legsBoots: "traveler",
      cape: "traveler",
      hat: "captain",
      handProp: "spyglass",
      backProp: "explorer_pack",
      pet: "owl",
      mount: "island_horse",
      pedestal: "stone_wood",
      aura: "imperial_flame",
    });

    const rigA = await composeAvatarScene(resolvedA);
    const firstFetchCount = mockLoadAsync.mock.calls.length;
    expect(firstFetchCount).toBeGreaterThan(0);

    // Exact socket coordinate contract
    expect(rigA.sockets.socket_torso.position.toArray()).toEqual([0, 0, 0]);
    expect(rigA.sockets.socket_legs.position.toArray()).toEqual([0, 0, 0]);
    expect(rigA.sockets.socket_cape.position.toArray()).toEqual([0, 0, 0]);
    expect(rigA.sockets.socket_mount.position.toArray()).toEqual([0, 0, 0]);
    expect(rigA.sockets.socket_pedestal.position.toArray()).toEqual([0, 0, 0]);
    expect(rigA.sockets.socket_head.position.toArray()).toEqual([0, 1.46, 0]);
    expect(rigA.sockets.socket_hand_r.position.toArray()).toEqual([-0.36, 0.88, 0.12]);
    expect(rigA.sockets.socket_back.position.toArray()).toEqual([0, 1.15, -0.17]);
    expect(rigA.sockets.socket_shoulder_l.position.toArray()).toEqual([0.27, 1.41, 0.01]);
    expect(rigA.auraSlot.children.length).toBe(1);

    // Second rig with identical parts reuses cached glTF downloads (0 new fetches)
    const rigB = await composeAvatarScene({
      ...resolvedA,
      colors: { ...resolvedA.colors, outfitPrimary: "#059669" },
    });
    expect(mockLoadAsync.mock.calls.length).toBe(firstFetchCount);

    // Animation updater runs cleanly
    updateAvatarAnimation(rigA, 1.25);

    // Disposal should dispose aura geometries/cloned materials without crashing
    expect(() => disposeObjectTree(rigA.root)).not.toThrow();
    expect(() => disposeObjectTree(rigB.root)).not.toThrow();
  });

  test("renders distinct 3D facial geometry for eyeStyle, browStyle, noseStyle, mouthStyle and scales bodyType without extra GLB fetches", async () => {
    HTMLCanvasElement.prototype.getContext = vi.fn((type: string) => {
      if (type === "webgl2" || type === "webgl") return {} as RenderingContext;
      return null;
    }) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    const baseCfg = resolveAvatarConfig({
      version: 2,
      bodyType: "athletic",
      headShape: "square",
      eyeStyle: "calm",
      browStyle: "calm",
      noseStyle: "straight",
      mouthStyle: "confident",
      outfit: "captain",
      backProp: "explorer_pack",
    });

    const rig = await composeAvatarScene(baseCfg);
    expect(rig.sockets.socket_head.children).toContain(rig.faceSlot);
    expect(rig.faceSlot.getObjectByName("eye_sclera_1")).toBeDefined();
    expect(rig.faceSlot.getObjectByName("nose_straight_bridge")).toBeDefined();
    expect(rig.faceSlot.getObjectByName("mouth_confident_line")).toBeDefined();
    expect(rig.faceSlot.getObjectByName("glasses_rim_1")).toBeUndefined();
    expect(rig.faceSlot.getObjectByName("brow_scar_slash")).toBeUndefined();

    // Test every facial variant produces its expected named 3D meshes
    const wiseGroup = createFacialFeaturesGroup({
      ...baseCfg,
      eyeStyle: "wise",
      browStyle: "scarred",
      noseStyle: "aquiline",
      mouthStyle: "smile",
    });
    expect(wiseGroup.getObjectByName("glasses_rim_1")).toBeDefined();
    expect(wiseGroup.getObjectByName("glasses_bridge")).toBeDefined();
    expect(wiseGroup.getObjectByName("brow_scar_slash")).toBeDefined();
    expect(wiseGroup.getObjectByName("nose_aquiline_bridge")).toBeDefined();
    expect(wiseGroup.getObjectByName("mouth_smile_teeth")).toBeDefined();

    const sharpGroup = createFacialFeaturesGroup({
      ...baseCfg,
      eyeStyle: "sharp",
      browStyle: "arched",
      noseStyle: "broad",
      mouthStyle: "smirk",
    });
    expect(sharpGroup.getObjectByName("strategist_monocle")).toBeDefined();
    expect(sharpGroup.getObjectByName("monocle_chain")).toBeDefined();
    expect(sharpGroup.getObjectByName("nose_broad_tip")).toBeDefined();
    expect(sharpGroup.getObjectByName("mouth_smirk_line")).toBeDefined();

    const buttonGroup = createFacialFeaturesGroup({
      ...baseCfg,
      eyeStyle: "fierce",
      browStyle: "thick",
      noseStyle: "button",
      mouthStyle: "serious",
    });
    expect(buttonGroup.getObjectByName("nose_button_tip")).toBeDefined();
    expect(buttonGroup.getObjectByName("mouth_serious_line")).toBeDefined();

    // Update facial features & body proportions on existing rig
    updateAvatarFacialFeatures(rig, {
      ...baseCfg,
      eyeStyle: "wise",
      browStyle: "scarred",
    });
    expect(rig.faceSlot.getObjectByName("glasses_rim_1")).toBeDefined();
    expect(rig.faceSlot.getObjectByName("brow_scar_slash")).toBeDefined();

    updateAvatarBodyProportions(rig, "sturdy");
    expect(rig.bodyScale[0]).toBeGreaterThan(1.05);
    expect(rig.sockets.socket_torso.scale.x).toBeCloseTo(rig.bodyScale[0]);
    expect(rig.sockets.socket_hand_r.position.x).toBeLessThan(-0.38);

    updateAvatarBodyProportions(rig, "slender");
    expect(rig.bodyScale[0]).toBeLessThan(0.95);
    expect(rig.sockets.socket_hand_r.position.x).toBeGreaterThan(-0.34);

    // Rerendering Avatar3DCanvas when only face slots change triggers 0 additional GLB fetches
    const { rerender } = render(<Avatar3DCanvas config={baseCfg} mode="studio" />);
    await waitFor(() => {
      expect(mockLoadAsync).toHaveBeenCalled();
    });
    const fetchCountAfterInit = mockLoadAsync.mock.calls.length;
    const renderCountBeforeFaceEdit =
      mockRendererInstances[0].render.mock.calls.length;

    rerender(
      <Avatar3DCanvas
        config={{
          ...baseCfg,
          eyeStyle: "wise",
          browStyle: "scarred",
          noseStyle: "aquiline",
          mouthStyle: "smile",
        }}
        mode="studio"
      />
    );

    expect(mockLoadAsync.mock.calls.length).toBe(fetchCountAfterInit);
    expect(mockRendererInstances[0].render.mock.calls.length).toBeGreaterThan(
      renderCountBeforeFaceEdit
    );
    expect(() => disposeObjectTree(rig.root)).not.toThrow();
  });

  test("applies articulated seated riding poses across all 4 mounts while preserving socket contracts and animating mount pivots", async () => {
    clearAvatarGltfCache();
    mockLoadAsync.mockImplementation(async (url: string) => {
      const group = new THREE.Group();
      if (url.includes("/bodies/") || url.includes("/outfits/") || url.includes("/legs/")) {
        const hips = new THREE.Group();
        hips.name = "rig_hips";
        const torso = new THREE.Group();
        torso.name = "rig_torso";
        const upperArmL = new THREE.Group();
        upperArmL.name = "rig_upper_arm_l";
        const upperArmR = new THREE.Group();
        upperArmR.name = "rig_upper_arm_r";
        const forearmR = new THREE.Group();
        forearmR.name = "rig_forearm_r";
        const handR = new THREE.Group();
        handR.name = "rig_hand_r";
        handR.position.set(-0.34, 0.92, 0.10);
        forearmR.add(handR);
        upperArmR.add(forearmR);
        torso.add(upperArmL, upperArmR);
        const thighL = new THREE.Group();
        thighL.name = "rig_thigh_l";
        const calfL = new THREE.Group();
        calfL.name = "rig_calf_l";
        const footL = new THREE.Group();
        footL.name = "rig_foot_l";
        calfL.add(footL);
        thighL.add(calfL);
        const skirtFront = new THREE.Group();
        skirtFront.name = "rig_skirt_front";
        hips.add(torso, thighL, skirtFront);
        group.add(hips);
      } else if (url.includes("/capes/")) {
        const collar = new THREE.Group();
        collar.name = "rig_cape_collar";
        const drape = new THREE.Group();
        drape.name = "rig_cape_drape";
        collar.add(drape);
        group.add(collar);
      } else if (url.includes("/mounts/")) {
        const neckPivot = new THREE.Group();
        neckPivot.name = "mount_neck_pivot";
        const tailPivot = new THREE.Group();
        tailPivot.name = "mount_tail_pivot";
        group.add(neckPivot, tailPivot);
        if (url.includes("imperial_griffin")) {
          const wingL = new THREE.Group();
          wingL.name = "mount_wing_l";
          const wingR = new THREE.Group();
          wingR.name = "mount_wing_r";
          group.add(wingL, wingR);
        }
      } else {
        const mat = new THREE.MeshStandardMaterial({ name: "mat_primary", color: "#ffffff" });
        group.add(new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.15), mat));
      }
      return { scene: group };
    });

    for (const mountId of ["island_horse", "snow_wolf", "royal_stag", "imperial_griffin"] as const) {
      const cfg = resolveAvatarConfig({
        version: 2,
        bodyType: "sturdy",
        outfit: "settler",
        legsBoots: "traveler",
        cape: "traveler",
        handProp: "sun_rapier",
        mount: mountId,
      });
      const rig = await composeAvatarScene(cfg);
      const mp = MOUNT_PROFILES[mountId];

      expect(rig.isMounted).toBe(true);
      expect(rig.riderPivot.position.y).toBeCloseTo(mp.riderY);
      expect(rig.riderPivot.position.z).toBeCloseTo(mp.riderZ);
      expect(rig.riderPivot.rotation.y).toBeCloseTo(mp.turnY);
      expect(rig.sockets.socket_mount.rotation.y).toBeCloseTo(mp.turnY);
      expect(rig.sockets.socket_pedestal.scale.x).toBeCloseTo(mp.pedestalScale[0]);
      // Base rider sockets stay unchanged inside riderPivot
      expect(rig.sockets.socket_head.position.toArray()).toEqual([0, 1.46, 0]);

      const torsoThigh = rig.sockets.socket_torso.getObjectByName("rig_thigh_l");
      const legThigh = rig.sockets.socket_legs.getObjectByName("rig_thigh_l");
      const legCalf = rig.sockets.socket_legs.getObjectByName("rig_calf_l");
      const skirtFront = rig.sockets.socket_torso.getObjectByName("rig_skirt_front");
      const capeDrape = rig.sockets.socket_cape.getObjectByName("rig_cape_drape");
      expect(torsoThigh?.rotation.x).toBeCloseTo(mp.thighPitch);
      expect(legThigh?.rotation.z).toBeCloseTo(mp.thighSpread);
      expect(legCalf?.rotation.x).toBeCloseTo(mp.calfBend);
      expect(skirtFront?.rotation.x).toBeCloseTo(-0.62);
      expect(capeDrape?.rotation.x).toBeCloseTo(0.5);

      updateAvatarAnimation(rig, 1.5);
      const neck = rig.sockets.socket_mount.getObjectByName("mount_neck_pivot");
      const tail = rig.sockets.socket_mount.getObjectByName("mount_tail_pivot");
      expect(neck?.rotation.x).not.toBe(0);
      expect(tail?.rotation.y).not.toBe(0);
      if (mountId === "imperial_griffin") {
        const wingL = rig.sockets.socket_mount.getObjectByName("mount_wing_l");
        expect(wingL?.rotation.z).not.toBe(0);
      }

      // Unmounting returns riderPivot & leg pose smoothly to standing stance
      applyAvatarCombinationAndPose(rig, { ...cfg, mount: "none" });
      expect(rig.isMounted).toBe(false);
      expect(rig.riderPivot.position.y).toBe(0);
      expect(legThigh?.rotation.x).toBe(0);
      expect(capeDrape?.rotation.x).toBe(0);
      disposeObjectTree(rig.root);
    }
  });

  test("applies cross-slot compatibility solver for hats, voluminous hair, cape + backProp, pauldrons + pet, and handProp palm sync", async () => {
    clearAvatarGltfCache();
    mockLoadAsync.mockImplementation(async (url: string) => {
      const group = new THREE.Group();
      if (url.includes("/hair/")) {
        const crownMass = new THREE.Group();
        crownMass.name = "hair_crown_mass";
        const lowerFlow = new THREE.Group();
        lowerFlow.name = "hair_lower_flow";
        group.add(crownMass, lowerFlow);
      } else if (url.includes("/hats/")) {
        const hatNode = new THREE.Group();
        hatNode.name = "hat_mock";
        group.add(hatNode);
      } else if (url.includes("/capes/")) {
        const collar = new THREE.Group();
        collar.name = "rig_cape_collar";
        const drape = new THREE.Group();
        drape.name = "rig_cape_drape";
        collar.add(drape);
        group.add(collar);
      } else if (url.includes("/bodies/")) {
        const torso = new THREE.Group();
        torso.name = "rig_torso";
        const handR = new THREE.Group();
        handR.name = "rig_hand_r";
        handR.position.set(-0.37, 0.90, 0.14);
        torso.add(handR);
        group.add(torso);
      } else {
        const mat = new THREE.MeshStandardMaterial({ name: "mat_primary", color: "#ffffff" });
        group.add(new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.15), mat));
      }
      return { scene: group };
    });

    const helmetCfg = resolveAvatarConfig({
      version: 2,
      bodyType: "sturdy",
      hair: "royal_bun",
      hat: "helm",
      outfit: "armor",
      cape: "royal_mantle",
      backProp: "imperial_shield",
      pet: "parrot",
      handProp: "sun_rapier",
    });
    const rig = await composeAvatarScene(helmetCfg);

    const crownMass = rig.sockets.socket_head.getObjectByName("hair_crown_mass");
    const capeCollar = rig.sockets.socket_cape.getObjectByName("rig_cape_collar");
    expect(crownMass?.scale.y).toBeLessThan(0.7);
    expect(rig.fitWrappers.backPropFit.position.z).toBeLessThan(-0.04);
    expect(rig.fitWrappers.petFit.position.y).toBeGreaterThan(0.03);
    expect(capeCollar?.position.y).toBeGreaterThan(1.39);
    expect(rig.fitWrappers.handPropFit.position.length()).toBeGreaterThan(0.01);

    // Crown over voluminous hair elevates crown_gold without squashing bun
    const crownRig = await composeAvatarScene(
      resolveAvatarConfig({
        ...helmetCfg,
        hat: "crown_gold",
        hair: "royal_bun",
      })
    );
    const hatWrapper = crownRig.sockets.socket_head.getObjectByName("hat_part");
    const unSquashedCrown = crownRig.sockets.socket_head.getObjectByName("hair_crown_mass");
    expect(hatWrapper?.position.y).toBeGreaterThan(0.015);
    expect(unSquashedCrown?.scale.y).toBe(1);

    disposeObjectTree(rig.root);
    disposeObjectTree(crownRig.root);
  });

  test("tracks mounted rider elevation cleanly in cameraFocus='portrait' and capturePortraitSnapshot", async () => {
    HTMLCanvasElement.prototype.getContext = vi.fn((type: string) => {
      if (type === "webgl2" || type === "webgl") return {} as RenderingContext;
      return null;
    }) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    const ref = createRef<Avatar3DCanvasHandle>();
    render(
      <Avatar3DCanvas
        ref={ref}
        config={{
          version: 2,
          bodyType: "sturdy",
          outfit: "settler",
          mount: "royal_stag",
          background: "ocean",
        }}
        mode="studio"
        cameraFocus="portrait"
      />
    );

    const controls = mockOrbitControlsInstances[0];
    expect(controls.target.y).toBeCloseTo(1.59 + MOUNT_PROFILES.royal_stag.riderY);

    const renderer = mockRendererInstances[0];
    vi.spyOn(renderer.domElement, "toDataURL").mockReturnValue(
      "data:image/webp;base64,UklGRh4AAABXRUJQVlA4"
    );
    const snap = ref.current?.capturePortraitSnapshot();
    expect(snap).toContain("data:image/webp");
  });
});
