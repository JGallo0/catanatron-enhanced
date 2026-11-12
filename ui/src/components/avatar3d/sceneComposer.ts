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
  faceSlot: THREE.Group;
  auraSlot: THREE.Group;
  bodyScale: [number, number, number];
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

  const faceSlot = new THREE.Group();
  faceSlot.name = "socket_face";
  sockets.socket_head.add(faceSlot);

  const auraSlot = new THREE.Group();
  auraSlot.name = "socket_aura";
  root.add(auraSlot);

  return { root, sockets, faceSlot, auraSlot, bodyScale: [1, 1, 1] };
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

function makeFaceMesh(
  name: string,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  pos: readonly [number, number, number] = [0, 0, 0],
  rot: readonly [number, number, number] = [0, 0, 0],
  scale: readonly [number, number, number] = [1, 1, 1]
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(pos[0], pos[1], pos[2]);
  mesh.rotation.set(rot[0], rot[1], rot[2]);
  mesh.scale.set(scale[0], scale[1], scale[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function makeFaceTube(
  name: string,
  pts: ReadonlyArray<readonly [number, number, number]>,
  radius: number,
  material: THREE.Material
): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(
    pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    false
  );
  const geo = new THREE.TubeGeometry(curve, 12, radius, 8, false);
  return makeFaceMesh(name, geo, material);
}

export function createFacialFeaturesGroup(
  config: ResolvedAvatarConfig
): THREE.Group {
  const group = new THREE.Group();
  group.name = "facial_features";

  const skinMat = new THREE.MeshStandardMaterial({
    name: "mat_skin",
    color: 0xe4b287,
    roughness: 0.58,
    metalness: 0.02,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    name: "mat_hair",
    color: 0x432316,
    roughness: 0.72,
    metalness: 0.04,
  });
  const eyeMat = new THREE.MeshStandardMaterial({
    name: "mat_eyes",
    color: 0x0284c7,
    roughness: 0.25,
    metalness: 0.05,
  });
  const scleraMat = new THREE.MeshStandardMaterial({
    name: "mat_sclera",
    color: 0xf8fafc,
    roughness: 0.25,
    metalness: 0.0,
  });
  const pupilMat = new THREE.MeshStandardMaterial({
    name: "mat_pupil",
    color: 0x0f172a,
    roughness: 0.2,
    metalness: 0.05,
  });
  const lashesMat = new THREE.MeshStandardMaterial({
    name: "mat_lashes",
    color: 0x1e1b18,
    roughness: 0.6,
    metalness: 0.02,
  });
  const lipsMat = new THREE.MeshStandardMaterial({
    name: "mat_lips",
    color: 0xa84b44,
    roughness: 0.55,
    metalness: 0.02,
  });
  const scarMat = new THREE.MeshStandardMaterial({
    name: "mat_scar",
    color: 0x993b36,
    roughness: 0.62,
    metalness: 0.02,
  });
  const metalMat = new THREE.MeshStandardMaterial({
    name: "mat_metal",
    color: 0xfacc15,
    roughness: 0.26,
    metalness: 0.86,
  });

  // 1. Eyes & Expression (6 distinct 3D styles)
  const eyeStyle = config.eyeStyle ?? "calm";
  const isFierce = eyeStyle === "fierce";
  const isNoble = eyeStyle === "noble";
  const isWise = eyeStyle === "wise";
  const isCheerful = eyeStyle === "cheerful";
  const isSharp = eyeStyle === "sharp";

  for (const side of [-1, 1] as const) {
    const ex = side * 0.037;
    const ey = isCheerful ? 0.138 : 0.136;
    const ez = 0.097;
    const scleraScale: [number, number, number] = isFierce
      ? [1.18, 0.72, 0.75]
      : isSharp
        ? [1.16, 0.68, 0.75]
        : isNoble
          ? [1.14, 0.96, 0.75]
          : isCheerful
            ? [1.15, 0.82, 0.75]
            : [1.1, 0.9, 0.75];
    const rotZ = isFierce ? side * 0.24 : isSharp ? side * 0.16 : isNoble ? side * 0.08 : 0;

    group.add(
      makeFaceMesh(
        `eye_sclera_${side}`,
        new THREE.SphereGeometry(0.0175, 14, 12),
        scleraMat,
        [ex, ey, ez],
        [0, 0, rotZ],
        scleraScale
      )
    );
    group.add(
      makeFaceMesh(
        `eye_iris_${side}`,
        new THREE.SphereGeometry(isFierce ? 0.0098 : 0.0112, 14, 12),
        eyeMat,
        [ex, ey + (isNoble ? 0.001 : 0), ez + 0.0092],
        [0, 0, 0],
        [1, 1, 0.55]
      )
    );
    group.add(
      makeFaceMesh(
        `eye_pupil_${side}`,
        new THREE.SphereGeometry(0.0058, 10, 10),
        pupilMat,
        [ex, ey + (isNoble ? 0.001 : 0), ez + 0.014],
        [0, 0, 0],
        [1, 1, 0.45]
      )
    );

    // Sculpted upper eyelid / lash accent
    const lidY = isFierce ? ey + 0.007 : isSharp ? ey + 0.005 : ey + 0.010;
    const lidCurvePts: Array<[number, number, number]> = isCheerful
      ? [
          [ex - side * 0.017, ey + 0.004, ez + 0.011],
          [ex, ey + 0.014, ez + 0.016],
          [ex + side * 0.017, ey + 0.004, ez + 0.009],
        ]
      : [
          [ex - side * 0.017, lidY + (isFierce ? 0.004 : 0), ez + 0.010],
          [ex, lidY + (isNoble ? 0.005 : 0.002), ez + 0.016],
          [ex + side * 0.017, lidY - (isFierce ? 0.006 : 0.001), ez + 0.009],
        ];
    group.add(
      makeFaceTube(
        `eye_lid_${side}`,
        lidCurvePts,
        isNoble ? 0.0032 : 0.0035,
        isNoble ? metalMat : lashesMat
      )
    );
  }

  // Wise golden spectacles
  if (isWise) {
    for (const side of [-1, 1] as const) {
      group.add(
        makeFaceMesh(
          `glasses_rim_${side}`,
          new THREE.TorusGeometry(0.023, 0.0028, 8, 22),
          metalMat,
          [side * 0.037, 0.136, 0.118],
          [0, side * 0.14, 0]
        )
      );
      group.add(
        makeFaceTube(
          `glasses_arm_${side}`,
          [
            [side * 0.06, 0.138, 0.114],
            [side * 0.098, 0.132, 0.058],
            [side * 0.104, 0.125, -0.005],
          ],
          0.0022,
          metalMat
        )
      );
    }
    group.add(
      makeFaceTube(
        "glasses_bridge",
        [
          [-0.015, 0.138, 0.119],
          [0, 0.142, 0.124],
          [0.015, 0.138, 0.119],
        ],
        0.0024,
        metalMat
      )
    );
  }

  // Strategist golden monocle
  if (isSharp) {
    group.add(
      makeFaceMesh(
        "strategist_monocle",
        new THREE.TorusGeometry(0.0235, 0.0032, 8, 22),
        metalMat,
        [0.037, 0.136, 0.119],
        [0, 0.14, 0]
      )
    );
    group.add(
      makeFaceTube(
        "monocle_chain",
        [
          [0.059, 0.128, 0.113],
          [0.075, 0.092, 0.098],
          [0.070, 0.048, 0.076],
        ],
        0.0018,
        metalMat
      )
    );
  }

  // 2. Eyebrows (4 distinct 3D styles)
  const browStyle = config.browStyle ?? "calm";
  for (const side of [-1, 1] as const) {
    const browRadius =
      browStyle === "thick" ? 0.0085 : browStyle === "scarred" ? 0.0068 : 0.0052;
    const pts: Array<[number, number, number]> =
      browStyle === "arched"
        ? [
            [side * 0.016, 0.162, 0.106],
            [side * 0.038, 0.179, 0.105],
            [side * 0.061, 0.164, 0.094],
          ]
        : browStyle === "thick"
          ? [
              [side * 0.014, 0.164, 0.107],
              [side * 0.038, 0.166, 0.108],
              [side * 0.062, 0.164, 0.096],
            ]
          : browStyle === "scarred"
            ? [
                [side * 0.014, 0.160, 0.106],
                [side * 0.038, 0.166, 0.107],
                [side * 0.060, 0.169, 0.095],
              ]
            : [
                [side * 0.017, 0.163, 0.105],
                [side * 0.038, 0.168, 0.105],
                [side * 0.058, 0.162, 0.094],
              ];
    group.add(makeFaceTube(`brow_${side}`, pts, browRadius, hairMat));
  }

  if (browStyle === "scarred") {
    group.add(
      makeFaceTube(
        "brow_scar_slash",
        [
          [-0.048, 0.184, 0.103],
          [-0.041, 0.150, 0.114],
          [-0.032, 0.106, 0.107],
        ],
        0.0038,
        scarMat
      )
    );
  }

  // 3. Nose (4 distinct 3D styles)
  const noseStyle = config.noseStyle ?? "straight";
  if (noseStyle === "aquiline") {
    group.add(
      makeFaceTube(
        "nose_aquiline_bridge",
        [
          [0, 0.140, 0.106],
          [0, 0.120, 0.127],
          [0, 0.098, 0.120],
        ],
        0.0115,
        skinMat
      )
    );
    group.add(
      makeFaceMesh(
        "nose_aquiline_tip",
        new THREE.SphereGeometry(0.013, 12, 10),
        skinMat,
        [0, 0.098, 0.122],
        [0, 0, 0],
        [0.95, 0.9, 1.15]
      )
    );
  } else if (noseStyle === "broad") {
    group.add(
      makeFaceMesh(
        "nose_broad_bridge",
        new THREE.CapsuleGeometry(0.014, 0.025, 6, 10),
        skinMat,
        [0, 0.118, 0.106],
        [0.32, 0, 0],
        [1.35, 1.0, 1.0]
      )
    );
    group.add(
      makeFaceMesh(
        "nose_broad_tip",
        new THREE.SphereGeometry(0.016, 12, 10),
        skinMat,
        [0, 0.103, 0.117],
        [0, 0, 0],
        [1.55, 0.85, 1.05]
      )
    );
  } else if (noseStyle === "button") {
    group.add(
      makeFaceMesh(
        "nose_button_bridge",
        new THREE.CapsuleGeometry(0.0085, 0.016, 6, 10),
        skinMat,
        [0, 0.122, 0.105],
        [0.36, 0, 0]
      )
    );
    group.add(
      makeFaceMesh(
        "nose_button_tip",
        new THREE.SphereGeometry(0.0135, 12, 10),
        skinMat,
        [0, 0.111, 0.116],
        [0, 0, 0],
        [1.0, 0.85, 0.95]
      )
    );
  } else {
    group.add(
      makeFaceMesh(
        "nose_straight_bridge",
        new THREE.CapsuleGeometry(0.0115, 0.028, 6, 10),
        skinMat,
        [0, 0.118, 0.106],
        [0.3, 0, 0]
      )
    );
    group.add(
      makeFaceMesh(
        "nose_straight_tip",
        new THREE.SphereGeometry(0.0135, 12, 10),
        skinMat,
        [0, 0.103, 0.116],
        [0, 0, 0],
        [1.08, 0.85, 0.98]
      )
    );
  }

  // 4. Mouth & Expression (4 distinct 3D styles)
  const mouthStyle = config.mouthStyle ?? "confident";
  if (mouthStyle === "smile") {
    group.add(
      makeFaceTube(
        "mouth_smile_curve",
        [
          [-0.028, 0.072, 0.098],
          [-0.012, 0.060, 0.106],
          [0.012, 0.060, 0.106],
          [0.028, 0.072, 0.098],
        ],
        0.0052,
        lipsMat
      )
    );
    group.add(
      makeFaceMesh(
        "mouth_smile_teeth",
        new THREE.SphereGeometry(0.016, 12, 10),
        scleraMat,
        [0, 0.066, 0.103],
        [0, 0, 0],
        [1.35, 0.42, 0.45]
      )
    );
  } else if (mouthStyle === "serious") {
    group.add(
      makeFaceTube(
        "mouth_serious_line",
        [
          [-0.022, 0.061, 0.100],
          [0, 0.065, 0.106],
          [0.022, 0.061, 0.100],
        ],
        0.005,
        lipsMat
      )
    );
  } else if (mouthStyle === "smirk") {
    group.add(
      makeFaceTube(
        "mouth_smirk_line",
        [
          [-0.020, 0.062, 0.100],
          [0.002, 0.063, 0.106],
          [0.026, 0.075, 0.099],
        ],
        0.005,
        lipsMat
      )
    );
  } else {
    group.add(
      makeFaceTube(
        "mouth_confident_line",
        [
          [-0.022, 0.067, 0.099],
          [0, 0.062, 0.106],
          [0.022, 0.067, 0.099],
        ],
        0.0048,
        lipsMat
      )
    );
  }

  return group;
}

export function getBodyScaleForType(
  bodyType: ResolvedAvatarConfig["bodyType"]
): [number, number, number] {
  if (bodyType === "sturdy") return [1.13, 1.0, 1.10];
  if (bodyType === "slender") return [0.87, 1.0, 0.89];
  return [1.0, 1.0, 1.0];
}

export function updateAvatarFacialFeatures(
  rig: AvatarRigInstance,
  config: ResolvedAvatarConfig
): void {
  clearGroupChildren(rig.faceSlot);
  const faceGroup = createFacialFeaturesGroup(config);
  rig.faceSlot.add(faceGroup);
  applyAvatarMaterials(rig.faceSlot, config.colors);
}

export function updateAvatarBodyProportions(
  rig: AvatarRigInstance,
  bodyType: ResolvedAvatarConfig["bodyType"]
): void {
  const [sx, sy, sz] = getBodyScaleForType(bodyType);
  rig.bodyScale = [sx, sy, sz];
  rig.sockets.socket_torso.scale.set(sx, sy, sz);
  rig.sockets.socket_legs.scale.set(sx, sy, sz);
  rig.sockets.socket_cape.scale.set(sx, sy, sz);
  rig.sockets.socket_hand_r.position.x = AVATAR_SOCKET_OFFSETS.socket_hand_r[0] * sx;
  rig.sockets.socket_shoulder_l.position.x =
    AVATAR_SOCKET_OFFSETS.socket_shoulder_l[0] * sx;
  rig.sockets.socket_back.position.z = AVATAR_SOCKET_OFFSETS.socket_back[2] * sz;
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
    if (socketGroup === rig.sockets.socket_head) {
      // Keep faceSlot mounted inside socket_head while clearing loaded GLB parts
      for (let i = socketGroup.children.length - 1; i >= 0; i--) {
        const child = socketGroup.children[i];
        if (child !== rig.faceSlot) {
          socketGroup.remove(child);
          disposeObjectTree(child);
        }
      }
      continue;
    }
    clearGroupChildren(socketGroup);
  }

  for (const loaded of loadedParts) {
    if (!loaded) continue;
    loaded.partGroup.name = `${loaded.slot}_${loaded.partGroup.name || "part"}`;
    rig.sockets[loaded.socket].add(loaded.partGroup);
  }

  updateAvatarBodyProportions(rig, config.bodyType);
  updateAvatarFacialFeatures(rig, config);

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

  // Subtle torso breathing while preserving bodyType silhouette and grounded boots/pedestal
  const [bsx, bsy, bsz] = rig.bodyScale;
  rig.sockets.socket_torso.scale.set(
    bsx * (1 - breath * 0.0025),
    bsy * (1 + breath * 0.0055),
    bsz * (1 - breath * 0.0025)
  );
  rig.sockets.socket_cape.scale.set(bsx, bsy * (1 + breath * 0.004), bsz);

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
    handBase[0] * bsx,
    handBase[1] + Math.sin(elapsedSeconds * 1.8 - 0.35) * 0.006,
    handBase[2]
  );
  rig.sockets.socket_hand_r.rotation.z = Math.sin(elapsedSeconds * 1.2) * 0.025;

  const backBase = AVATAR_SOCKET_OFFSETS.socket_back;
  rig.sockets.socket_back.position.set(
    backBase[0],
    backBase[1] + breath * 0.005,
    backBase[2] * bsz
  );

  const shoulderBase = AVATAR_SOCKET_OFFSETS.socket_shoulder_l;
  rig.sockets.socket_shoulder_l.position.set(
    shoulderBase[0] * bsx,
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
