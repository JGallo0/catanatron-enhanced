import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import cn from "classnames";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { AvatarConfig, AvatarConfigV2 } from "../../utils/api.types";
import {
  AVATAR_BACKGROUND_OPTIONS,
  MAX_PORTRAIT_SNAPSHOT_CHARS,
  resolveAvatarConfig,
} from "../../config/avatarCatalog";
import PlayerAvatar from "../PlayerAvatar";
import { applyAvatarMaterials } from "./materialTint";
import {
  clearAvatarGltfCache,
  clearGroupChildren,
  createAuraEffect,
  createAvatarRig,
  createStudioLights,
  disposeObjectTree,
  getResolvedModelAssignments,
  populateAvatarRig,
  updateAvatarAnimation,
  updateAvatarBodyProportions,
  updateAvatarFacialFeatures,
  type AvatarRigInstance,
} from "./sceneComposer";
import "./Avatar3DCanvas.scss";

export type Avatar3DCanvasHandle = {
  capturePortraitSnapshot: () => string | null;
};

export type Avatar3DCanvasProps = {
  config: AvatarConfigV2 | Partial<AvatarConfig> | Record<string, unknown>;
  mode?: "studio" | "hero" | "card";
  cameraFocus?: "full" | "portrait";
  interactive?: boolean;
  className?: string;
  backgroundMode?: "themed" | "transparent";
  username?: string | null;
  fallbackSize?: number;
  fallbackTestId?: string | null;
  onReady?: () => void;
};

const CAMERA_PRESETS = {
  full: {
    fov: 36,
    position: [0.34, 1.18, 3.65] as const,
    target: [0, 0.88, 0] as const,
  },
  portrait: {
    fov: 32,
    position: [0.11, 1.61, 0.86] as const,
    target: [0, 1.59, 0] as const,
  },
};

export function isWebGLSupported(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function getBackgroundSwatches(bgId: string): {
  primary: string;
  secondary: string;
} {
  const found = AVATAR_BACKGROUND_OPTIONS.find((opt) => opt.value === bgId);
  return {
    primary: found?.swatch ?? "#0e4d7a",
    secondary: found?.secondarySwatch ?? "#06213c",
  };
}

function applyCameraPreset(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls | null,
  focus: "full" | "portrait"
): void {
  const preset = CAMERA_PRESETS[focus];
  camera.fov = preset.fov;
  camera.position.set(
    preset.position[0],
    preset.position[1],
    preset.position[2]
  );
  if (controls) {
    controls.target.set(preset.target[0], preset.target[1], preset.target[2]);
    controls.update();
  } else {
    camera.lookAt(preset.target[0], preset.target[1], preset.target[2]);
  }
  camera.updateProjectionMatrix();
}

export const Avatar3DCanvas = forwardRef<
  Avatar3DCanvasHandle,
  Avatar3DCanvasProps
>(function Avatar3DCanvas(
  {
    config,
    mode = "studio",
    cameraFocus = "full",
    interactive = false,
    className,
    backgroundMode,
    username,
    fallbackSize,
    fallbackTestId = "player-avatar",
    onReady,
  },
  ref
) {
  const resolved = useMemo(
    () => resolveAvatarConfig(config, username),
    [config, username]
  );

  const effectiveBgMode =
    backgroundMode ?? (mode === "hero" ? "transparent" : "themed");
  const bgSwatches = useMemo(
    () => getBackgroundSwatches(resolved.background),
    [resolved.background]
  );

  const [webglFailed, setWebglFailed] = useState(() => !isWebGLSupported());

  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const rigRef = useRef<AvatarRigInstance | null>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  const lastModelKeyRef = useRef<string>("");
  const lastFaceKeyRef = useRef<string>("");
  const lastAuraRef = useRef<string>("");
  const hasSignaledReadyRef = useRef<boolean>(false);

  const modelSignature = useMemo(
    () =>
      getResolvedModelAssignments(resolved)
        .map((a) => `${a.slot}:${a.modelPath}`)
        .join("|"),
    [resolved]
  );

  const faceSignature = `${resolved.eyeStyle}|${resolved.browStyle}|${resolved.noseStyle}|${resolved.mouthStyle}|${resolved.bodyType}`;

  useImperativeHandle(
    ref,
    () => ({
      capturePortraitSnapshot: () => {
        const renderer = rendererRef.current;
        const scene = sceneRef.current;
        const camera = cameraRef.current;
        if (webglFailed || !renderer || !scene || !camera) {
          return null;
        }

        const prevSize = new THREE.Vector2();
        renderer.getSize(prevSize);
        const prevPixelRatio = renderer.getPixelRatio();
        const prevAspect = camera.aspect;
        const prevFov = camera.fov;
        const prevPos = camera.position.clone();
        const prevQuat = camera.quaternion.clone();
        const prevBackground = scene.background;

        try {
          const portraitPreset = CAMERA_PRESETS.portrait;
          camera.fov = portraitPreset.fov;
          camera.aspect = 1;
          camera.position.set(
            portraitPreset.position[0],
            portraitPreset.position[1],
            portraitPreset.position[2]
          );
          camera.lookAt(
            portraitPreset.target[0],
            portraitPreset.target[1],
            portraitPreset.target[2]
          );
          camera.updateProjectionMatrix();

          scene.background = new THREE.Color(bgSwatches.secondary);
          renderer.setPixelRatio(1);
          renderer.setSize(256, 256, false);
          renderer.render(scene, camera);

          const canvas = renderer.domElement;
          let dataUrl = canvas.toDataURL("image/webp", 0.86);
          if (dataUrl.length > MAX_PORTRAIT_SNAPSHOT_CHARS) {
            dataUrl = canvas.toDataURL("image/webp", 0.72);
          }
          if (
            !dataUrl ||
            dataUrl.length > MAX_PORTRAIT_SNAPSHOT_CHARS ||
            !dataUrl.startsWith("data:image/")
          ) {
            const pngFallback = canvas.toDataURL("image/png");
            if (pngFallback && pngFallback.length <= MAX_PORTRAIT_SNAPSHOT_CHARS) {
              dataUrl = pngFallback;
            }
          }

          return dataUrl && dataUrl.length <= MAX_PORTRAIT_SNAPSHOT_CHARS
            ? dataUrl
            : null;
        } catch {
          return null;
        } finally {
          camera.fov = prevFov;
          camera.aspect = prevAspect;
          camera.position.copy(prevPos);
          camera.quaternion.copy(prevQuat);
          camera.updateProjectionMatrix();
          scene.background = prevBackground;
          renderer.setPixelRatio(prevPixelRatio);
          renderer.setSize(
            Math.max(1, prevSize.x),
            Math.max(1, prevSize.y),
            false
          );
          renderer.render(scene, camera);
        }
      },
    }),
    [webglFailed, bgSwatches.secondary]
  );

  // Initialize Three.js WebGLRenderer, Scene, Lights, Camera, Controls, RAF, ResizeObserver
  useEffect(() => {
    if (webglFailed) return;
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
        powerPreference: "high-performance",
      });
    } catch {
      setWebglFailed(true);
      return;
    }

    const width = Math.max(container.clientWidth || 320, 64);
    const height = Math.max(container.clientHeight || 320, 64);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.className = "avatar-3d-canvas__viewport";

    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const lights = createStudioLights();
    scene.add(lights);

    const rig = createAvatarRig();
    scene.add(rig.root);

    const camera = new THREE.PerspectiveCamera(
      CAMERA_PRESETS[cameraFocus].fov,
      width / height,
      0.1,
      50
    );

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.7;
    controls.maxDistance = 5.2;
    controls.minPolarAngle = Math.PI * 0.22;
    controls.maxPolarAngle = Math.PI * 0.52;
    controls.enableZoom = interactive && mode === "studio";
    controls.enabled = interactive;
    applyCameraPreset(camera, controls, cameraFocus);

    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = camera;
    controlsRef.current = controls;
    rigRef.current = rig;
    lastModelKeyRef.current = "";
    lastFaceKeyRef.current = "";
    lastAuraRef.current = "";
    hasSignaledReadyRef.current = false;

    const handleResize = () => {
      const nextW = Math.max(container.clientWidth || 320, 64);
      const nextH = Math.max(container.clientHeight || 320, 64);
      camera.aspect = nextW / nextH;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(nextW, nextH, false);
    };

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(handleResize)
        : null;
    resizeObserver?.observe(container);

    let rafId = 0;
    const startMs = performance.now();
    const animate = (nowMs: number) => {
      rafId = requestAnimationFrame(animate);
      const elapsedSeconds = (nowMs - startMs) / 1000;
      updateAvatarAnimation(rig, elapsedSeconds);
      if (controls.enabled) {
        controls.update();
      }
      renderer.render(scene, camera);
    };
    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver?.disconnect();
      controls.dispose();
      disposeObjectTree(rig.root);
      disposeObjectTree(lights);
      scene.clear();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
      rigRef.current = null;
    };
  }, [webglFailed]);

  // Update camera focus & interactivity without destroying WebGLRenderer
  useEffect(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    controls.enabled = interactive;
    controls.enableZoom = interactive && mode === "studio";
    applyCameraPreset(camera, controls, cameraFocus);
  }, [cameraFocus, interactive, mode]);

  // Compose/update modular parts, aura, and material colors
  useEffect(() => {
    const rig = rigRef.current;
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (webglFailed || !rig) return;

    const controller = new AbortController();
    const modelsChanged = lastModelKeyRef.current !== modelSignature;
    const faceChanged = lastFaceKeyRef.current !== faceSignature;
    const auraChanged = lastAuraRef.current !== resolved.aura;

    if (!modelsChanged) {
      if (faceChanged) {
        updateAvatarBodyProportions(rig, resolved.bodyType);
        updateAvatarFacialFeatures(rig, resolved);
        lastFaceKeyRef.current = faceSignature;
      }
      if (auraChanged) {
        clearGroupChildren(rig.auraSlot);
        const auraEffect = createAuraEffect(resolved.aura);
        if (auraEffect) {
          rig.auraSlot.add(auraEffect);
        }
        lastAuraRef.current = resolved.aura;
      }
      applyAvatarMaterials(rig.root, resolved.colors);
      if (renderer && scene && camera) {
        renderer.render(scene, camera);
      }
      if (!hasSignaledReadyRef.current) {
        hasSignaledReadyRef.current = true;
        onReadyRef.current?.();
      }
      return;
    }

    lastModelKeyRef.current = modelSignature;
    lastFaceKeyRef.current = faceSignature;
    lastAuraRef.current = resolved.aura;

    populateAvatarRig(rig, resolved, { signal: controller.signal }).then(() => {
      if (controller.signal.aborted) return;
      if (renderer && scene && camera) {
        renderer.render(scene, camera);
      }
      if (!hasSignaledReadyRef.current) {
        hasSignaledReadyRef.current = true;
        onReadyRef.current?.();
      }
    });

    return () => {
      controller.abort();
    };
  }, [webglFailed, resolved, modelSignature, faceSignature]);

  const computedFallbackSize =
    fallbackSize ?? (mode === "card" ? 84 : mode === "hero" ? 136 : 160);

  const themedStyle =
    effectiveBgMode === "themed"
      ? ({
          "--avatar-bg-primary": bgSwatches.primary,
          "--avatar-bg-secondary": bgSwatches.secondary,
        } as CSSProperties)
      : undefined;

  if (webglFailed) {
    return (
      <div
        className={cn(
          "avatar-3d-canvas",
          "avatar-3d-canvas--fallback",
          `avatar-3d-canvas--${mode}`,
          `avatar-3d-canvas--bg-${effectiveBgMode}`,
          className
        )}
        style={themedStyle}
        data-testid="avatar-3d-fallback"
      >
        <PlayerAvatar
          config={resolved}
          username={username}
          size={computedFallbackSize}
          testId={fallbackTestId}
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "avatar-3d-canvas",
        `avatar-3d-canvas--${mode}`,
        `avatar-3d-canvas--bg-${effectiveBgMode}`,
        { "avatar-3d-canvas--interactive": interactive },
        className
      )}
      style={themedStyle}
      data-testid="avatar-3d-canvas"
    />
  );
});

export { clearAvatarGltfCache };
export default Avatar3DCanvas;
