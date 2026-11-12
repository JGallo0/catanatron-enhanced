import * as THREE from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import {
  findAvatarCatalogItem,
  type ResolvedAvatarConfig,
} from "../../config/avatarCatalog";
import type { AvatarItemSlot } from "../../utils/api.types";
import { applyAvatarMaterials } from "./materialTint";

export type AvatarSocketName =
  | "socket_torso"
  | "socket_legs"
  | "socket_cape"
  | "socket_mount"
  | "socket_pedestal"
  | "socket_head"
  | "socket_hand_r"
  | "socket_back"
  | "socket_shoulder_l";

export const AVATAR_SOCKET_OFFSETS: Record<
  AvatarSocketName,
  readonly [number, number, number]
> = {
  // World / rig-space sockets at (0, 0, 0)
  socket_torso: [0, 0, 0],
  socket_legs: [0, 0, 0],
  socket_cape: [0, 0, 0],
  socket_mount: [0, 0, 0],
  socket_pedestal: [0, 0, 0],
  // Local-origin bone sockets
  socket_head: [0, 1.46, 0],
  socket_hand_r: [-0.36, 0.88, 0.12],
  socket_back: [0, 1.15, -0.17],
  socket_shoulder_l: [0.27, 1.41, 0.01],
};

export const AVATAR_SLOT_TO_SOCKET: Array<{
  slot: AvatarItemSlot;
  socket: AvatarSocketName;
}> = [
  { slot: "pedestal", socket: "socket_pedestal" },
  { slot: "bodyType", socket: "socket_torso" },
  { slot: "outfit", socket: "socket_torso" },
  { slot: "legsBoots", socket: "socket_legs" },
  { slot: "cape", socket: "socket_cape" },
  { slot: "mount", socket: "socket_mount" },
  { slot: "headShape", socket: "socket_head" },
  { slot: "hair", socket: "socket_head" },
  { slot: "beard", socket: "socket_head" },
  { slot: "hat", socket: "socket_head" },
  { slot: "handProp", socket: "socket_hand_r" },
  { slot: "backProp", socket: "socket_back" },
  { slot: "pet", socket: "socket_shoulder_l" },
];

export type AvatarRigInstance = {
  root: THREE.Group;
  sockets: Record<AvatarSocketName, THREE.Group>;
  auraSlot: THREE.Group;
};

type AuraParticleMeta = {
  basePositions: Float32Array;
  phases: Float32Array;
  speeds: Float32Array;
  radii: Float32Array;
  angles: Float32Array;
};

const DRACO_DECODER_PATH =
  "https://www.gstatic.com/draco/versioned/decoders/1.5.7/";

const gltfCache = new Map<string, Promise<THREE.Group>>();
let sharedGltfLoader: GLTFLoader | null = null;
let sharedDracoLoader: DRACOLoader | null = null;

function getGltfLoader(): GLTFLoader {
  if (!sharedGltfLoader) {
    const loader = new GLTFLoader();
    if (!sharedDracoLoader) {
      sharedDracoLoader = new DRACOLoader();
      sharedDracoLoader.setDecoderPath(DRACO_DECODER_PATH);
    }
    loader.setDRACOLoader(sharedDracoLoader);
    sharedGltfLoader = loader;
  }
  return sharedGltfLoader;
}

export function clearAvatarGltfCache(): void {
  gltfCache.clear();
  sharedGltfLoader = null;
}

function markGltfCachedResources(group: THREE.Object3D): void {
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (mesh.geometry) {
      mesh.geometry.userData = {
        ...mesh.geometry.userData,
        __gltfCached: true,
      };
    }
    const mats = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    for (const mat of mats) {
      if (mat) {
        mat.userData = {
          ...mat.userData,
          __gltfCached: true,
        };
      }
    }
  });
}

export async function loadAvatarPartGroup(
  modelPath: string
): Promise<THREE.Group> {
  let cachedPromise = gltfCache.get(modelPath);
  if (!cachedPromise) {
    cachedPromise = getGltfLoader()
      .loadAsync(modelPath)
      .then((gltf) => {
        markGltfCachedResources(gltf.scene);
        return gltf.scene;
      })
      .catch((err) => {
        gltfCache.delete(modelPath);
        throw err;
      });
    gltfCache.set(modelPath, cachedPromise);
  }
  const template = await cachedPromise;
  const cloned = SkeletonUtils.clone(template) as THREE.Group;
  cloned.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });
  return cloned;
}

export function createAvatarRig(): AvatarRigInstance {
  const root = new THREE.Group();
  root.name = "avatar_root";

  const sockets = {} as Record<AvatarSocketName, THREE.Group>;
  (Object.keys(AVATAR_SOCKET_OFFSETS) as AvatarSocketName[]).forEach(
    (socketName) => {
      const group = new THREE.Group();
      group.name = socketName;
      const [x, y, z] = AVATAR_SOCKET_OFFSETS[socketName];
      group.position.set(x, y, z);
      root.add(group);
      sockets[socketName] = group;
    }
  );

  const auraSlot = new THREE.Group();
  auraSlot.name = "socket_aura";
  root.add(auraSlot);

  return { root, sockets, auraSlot };
}

export function createStudioLights(): THREE.Group {
  const lights = new THREE.Group();
  lights.name = "rule_the_isle_studio_lights";

  // Hemisphere ambient (#e2e8f0 sky / #1e293b ground)
  const hemi = new THREE.HemisphereLight(0xe2e8f0, 0x1e293b, 1.1);
  hemi.position.set(0, 4, 0);
  lights.add(hemi);

  // Warm golden key light (#ffd27d)
  const key = new THREE.DirectionalLight(0xffd27d, 2.2);
  key.position.set(2.4, 4.1, 3.2);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0005;
  lights.add(key);

  // Soft sky fill light (#38bdf8)
  const fill = new THREE.DirectionalLight(0x38bdf8, 0.95);
  fill.position.set(-3.0, 2.2, 2.1);
  lights.add(fill);

  // Amber rim light (#f59e0b)
  const rim = new THREE.DirectionalLight(0xf59e0b, 1.35);
  rim.position.set(-1.5, 2.9, -3.2);
  lights.add(rim);

  return lights;
}

const AURA_PALETTES: Record<
  string,
  { ringColor: number; particleColor: number; secondRingColor: number }
> = {
  sun_motes: {
    ringColor: 0xfacc15,
    particleColor: 0xfef08a,
    secondRingColor: 0xf59e0b,
  },
  sea_mist: {
    ringColor: 0x38bdf8,
    particleColor: 0xbae6fd,
    secondRingColor: 0x0ea5e9,
  },
  imperial_flame: {
    ringColor: 0xf97316,
    particleColor: 0xfde047,
    secondRingColor: 0xef4444,
  },
};

export function createAuraEffect(auraId: string): THREE.Group | null {
  if (!auraId || auraId === "none") return null;
  const palette = AURA_PALETTES[auraId] ?? AURA_PALETTES.sun_motes;

  const group = new THREE.Group();
  group.name = `aura_${auraId}`;

  // Ground halo ring around pedestal
  const ringGeo = new THREE.TorusGeometry(0.76, 0.015, 10, 48);
  const ringMat = new THREE.MeshBasicMaterial({
    color: palette.ringColor,
    transparent: true,
    opacity: 0.62,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.name = "aura_ring_outer";
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.018;
  group.add(ring);

  const innerRingGeo = new THREE.TorusGeometry(0.58, 0.009, 8, 40);
  const innerRingMat = new THREE.MeshBasicMaterial({
    color: palette.secondRingColor,
    transparent: true,
    opacity: 0.45,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
  innerRing.name = "aura_ring_inner";
  innerRing.rotation.x = Math.PI / 2;
  innerRing.position.y = 0.03;
  group.add(innerRing);

  // Floating particles around character
  const count = 36;
  const positions = new Float32Array(count * 3);
  const basePositions = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const speeds = new Float32Array(count);
  const radii = new Float32Array(count);
  const angles = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + (i % 3) * 0.25;
    const radius = 0.56 + ((i * 7) % 11) * 0.03;
    const y = 0.08 + ((i * 13) % 19) * 0.085;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    basePositions[i * 3] = x;
    basePositions[i * 3 + 1] = y;
    basePositions[i * 3 + 2] = z;

    phases[i] = (i * 0.61803398875) * Math.PI * 2;
    speeds[i] = 0.55 + (i % 5) * 0.14;
    radii[i] = radius;
    angles[i] = angle;
  }

  const ptsGeo = new THREE.BufferGeometry();
  ptsGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const ptsMat = new THREE.PointsMaterial({
    color: palette.particleColor,
    size: 0.045,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const points = new THREE.Points(ptsGeo, ptsMat);
  points.name = "aura_particles";
  const meta: AuraParticleMeta = {
    basePositions,
    phases,
    speeds,
    radii,
    angles,
  };
  points.userData.__auraMeta = meta;
  group.add(points);

  return group;
}

export function getResolvedModelAssignments(
  config: ResolvedAvatarConfig
): Array<{ slot: AvatarItemSlot; socket: AvatarSocketName; modelPath: string }> {
  const assignments: Array<{
    slot: AvatarItemSlot;
    socket: AvatarSocketName;
    modelPath: string;
  }> = [];

  for (const { slot, socket } of AVATAR_SLOT_TO_SOCKET) {
    const id = config[slot];
    if (typeof id !== "string" || !id) continue;
    const item = findAvatarCatalogItem(slot, id);
    if (!item?.modelPath) continue;
    assignments.push({ slot, socket, modelPath: item.modelPath });
  }

  return assignments;
}

export function clearGroupChildren(group: THREE.Group): void {
  while (group.children.length > 0) {
    const child = group.children[group.children.length - 1];
    group.remove(child);
    disposeObjectTree(child);
  }
}

export async function populateAvatarRig(
  rig: AvatarRigInstance,
  config: ResolvedAvatarConfig,
  options?: { signal?: AbortSignal }
): Promise<void> {
  const signal = options?.signal;
  const assignments = getResolvedModelAssignments(config);

  const loadedParts = await Promise.all(
    assignments.map(async (entry) => {
      try {
        const partGroup = await loadAvatarPartGroup(entry.modelPath);
        return { ...entry, partGroup };
      } catch (err) {
        console.warn(
          `[avatar3d] Failed to load model "${entry.modelPath}" for slot "${entry.slot}":`,
          err
        );
        return null;
      }
    })
  );

  if (signal?.aborted) {
    for (const loaded of loadedParts) {
      if (loaded?.partGroup) {
        disposeObjectTree(loaded.partGroup);
      }
    }
    return;
  }

  for (const socketGroup of Object.values(rig.sockets)) {
    clearGroupChildren(socketGroup);
  }

  for (const loaded of loadedParts) {
    if (!loaded) continue;
    loaded.partGroup.name = `${loaded.slot}_${loaded.partGroup.name || "part"}`;
    rig.sockets[loaded.socket].add(loaded.partGroup);
  }

  clearGroupChildren(rig.auraSlot);
  const auraEffect = createAuraEffect(config.aura);
  if (auraEffect) {
    rig.auraSlot.add(auraEffect);
  }

  applyAvatarMaterials(rig.root, config.colors);
}

export async function composeAvatarScene(
  config: ResolvedAvatarConfig,
  options?: { signal?: AbortSignal }
): Promise<AvatarRigInstance> {
  const rig = createAvatarRig();
  await populateAvatarRig(rig, config, options);
  return rig;
}

export function updateAvatarAnimation(
  rig: AvatarRigInstance,
  elapsedSeconds: number
): void {
  const breath = Math.sin(elapsedSeconds * 1.8);
  const gentleSway = Math.sin(elapsedSeconds * 0.85);

  // Subtle torso breathing while boots/pedestal remain grounded at Y=0
  rig.sockets.socket_torso.scale.set(
    1 - breath * 0.0025,
    1 + breath * 0.0055,
    1 - breath * 0.0025
  );
  rig.sockets.socket_cape.scale.y = 1 + breath * 0.004;

  const headBase = AVATAR_SOCKET_OFFSETS.socket_head;
  rig.sockets.socket_head.position.set(
    headBase[0],
    headBase[1] + breath * 0.0055,
    headBase[2]
  );
  rig.sockets.socket_head.rotation.set(
    Math.sin(elapsedSeconds * 1.25) * 0.015,
    gentleSway * 0.035,
    0
  );

  const handBase = AVATAR_SOCKET_OFFSETS.socket_hand_r;
  rig.sockets.socket_hand_r.position.set(
    handBase[0],
    handBase[1] + Math.sin(elapsedSeconds * 1.8 - 0.35) * 0.006,
    handBase[2]
  );
  rig.sockets.socket_hand_r.rotation.z = Math.sin(elapsedSeconds * 1.2) * 0.025;

  const backBase = AVATAR_SOCKET_OFFSETS.socket_back;
  rig.sockets.socket_back.position.set(
    backBase[0],
    backBase[1] + breath * 0.005,
    backBase[2]
  );

  const shoulderBase = AVATAR_SOCKET_OFFSETS.socket_shoulder_l;
  rig.sockets.socket_shoulder_l.position.set(
    shoulderBase[0],
    shoulderBase[1] + Math.sin(elapsedSeconds * 2.5 + 0.7) * 0.011,
    shoulderBase[2]
  );
  rig.sockets.socket_shoulder_l.rotation.y =
    Math.sin(elapsedSeconds * 1.4) * 0.06;

  // Aura particles & rings
  const auraEffect = rig.auraSlot.children[0];
  if (auraEffect) {
    const outerRing = auraEffect.getObjectByName("aura_ring_outer") as
      | THREE.Mesh
      | undefined;
    const innerRing = auraEffect.getObjectByName("aura_ring_inner") as
      | THREE.Mesh
      | undefined;
    const points = auraEffect.getObjectByName("aura_particles") as
      | THREE.Points
      | undefined;

    if (outerRing) {
      outerRing.rotation.z = elapsedSeconds * 0.35;
      const mat = outerRing.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.52 + Math.sin(elapsedSeconds * 2.1) * 0.14;
    }
    if (innerRing) {
      innerRing.rotation.z = -elapsedSeconds * 0.55;
      innerRing.position.y = 0.03 + Math.sin(elapsedSeconds * 2.4) * 0.012;
    }
    if (points && points.userData?.__auraMeta) {
      const meta = points.userData.__auraMeta as AuraParticleMeta;
      const posAttr = points.geometry.getAttribute(
        "position"
      ) as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      const count = meta.phases.length;
      for (let i = 0; i < count; i++) {
        const t = elapsedSeconds * meta.speeds[i] + meta.phases[i];
        const angle = meta.angles[i] + elapsedSeconds * 0.25;
        const r = meta.radii[i] + Math.sin(t * 1.4) * 0.035;
        arr[i * 3] = Math.cos(angle) * r;
        arr[i * 3 + 1] =
          ((meta.basePositions[i * 3 + 1] + elapsedSeconds * 0.14) % 1.75) +
          0.05;
        arr[i * 3 + 2] = Math.sin(angle) * r;
      }
      posAttr.needsUpdate = true;
    }
  }
}

function shouldDisposeMaterial(mat: THREE.Material): boolean {
  if (mat.userData?.__avatarCloned === true) return true;
  return mat.userData?.__gltfCached !== true;
}

export function disposeObjectTree(root: THREE.Object3D): void {
  const disposedGeometries = new Set<THREE.BufferGeometry>();
  const disposedMaterials = new Set<THREE.Material>();

  root.traverse((obj) => {
    const renderable = obj as THREE.Mesh | THREE.Points | THREE.Line;
    const geom = renderable.geometry;
    if (
      geom &&
      geom.userData?.__gltfCached !== true &&
      !disposedGeometries.has(geom)
    ) {
      disposedGeometries.add(geom);
      geom.dispose();
    }

    const material = (renderable as THREE.Mesh).material;
    if (!material) return;
    const list = Array.isArray(material) ? material : [material];
    for (const mat of list) {
      if (mat && shouldDisposeMaterial(mat) && !disposedMaterials.has(mat)) {
        disposedMaterials.add(mat);
        mat.dispose();
      }
    }
  });
}
