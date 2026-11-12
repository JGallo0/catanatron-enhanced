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
  // Local-origin bone sockets (relative to riderPivot)
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

export type MountProfile = {
  riderY: number;
  riderZ: number;
  turnY: number;
  thighPitch: number;
  thighSpread: number;
  calfBend: number;
  calfInward: number;
  footPitch: number;
  torsoLean: number;
  pedestalScale: readonly [number, number, number];
};

export const MOUNT_PROFILES: Record<string, MountProfile> = {
  island_horse: {
    riderY: 0.22,
    riderZ: -0.01,
    turnY: 0.44,
    thighPitch: -0.58,
    thighSpread: 0.34,
    calfBend: 0.72,
    calfInward: 0.16,
    footPitch: -0.12,
    torsoLean: 0.04,
    pedestalScale: [1.26, 1.0, 1.38],
  },
  snow_wolf: {
    riderY: -0.01,
    riderZ: -0.02,
    turnY: 0.44,
    thighPitch: -0.66,
    thighSpread: 0.32,
    calfBend: 0.84,
    calfInward: 0.15,
    footPitch: -0.14,
    torsoLean: 0.09,
    pedestalScale: [1.24, 1.0, 1.38],
  },
  royal_stag: {
    riderY: 0.25,
    riderZ: -0.02,
    turnY: 0.44,
    thighPitch: -0.56,
    thighSpread: 0.30,
    calfBend: 0.70,
    calfInward: 0.15,
    footPitch: -0.12,
    torsoLean: 0.03,
    pedestalScale: [1.26, 1.0, 1.38],
  },
  imperial_griffin: {
    riderY: 0.15,
    riderZ: -0.01,
    turnY: 0.44,
    thighPitch: -0.58,
    thighSpread: 0.34,
    calfBend: 0.74,
    calfInward: 0.16,
    footPitch: -0.12,
    torsoLean: 0.05,
    pedestalScale: [1.34, 1.0, 1.44],
  },
};

export type AvatarRigFitWrappers = {
  handPropFit: THREE.Group;
  backPropFit: THREE.Group;
  petFit: THREE.Group;
};

export type AvatarRigInstance = {
  root: THREE.Group;
  riderPivot: THREE.Group;
  sockets: Record<AvatarSocketName, THREE.Group>;
  fitWrappers: AvatarRigFitWrappers;
  faceSlot: THREE.Group;
  auraSlot: THREE.Group;
  bodyScale: [number, number, number];
  isMounted: boolean;
  mountId: string;
  baseRiderPos: [number, number, number];
  baseRiderRotY: number;
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

const RIDER_SOCKET_NAMES: ReadonlySet<AvatarSocketName> = new Set([
  "socket_torso",
  "socket_legs",
  "socket_cape",
  "socket_head",
  "socket_hand_r",
  "socket_back",
  "socket_shoulder_l",
]);

export function createAvatarRig(): AvatarRigInstance {
  const root = new THREE.Group();
  root.name = "avatar_root";

  const riderPivot = new THREE.Group();
  riderPivot.name = "avatar_rider_pivot";
  root.add(riderPivot);

  const sockets = {} as Record<AvatarSocketName, THREE.Group>;
  (Object.keys(AVATAR_SOCKET_OFFSETS) as AvatarSocketName[]).forEach(
    (socketName) => {
      const group = new THREE.Group();
      group.name = socketName;
      const [x, y, z] = AVATAR_SOCKET_OFFSETS[socketName];
      group.position.set(x, y, z);
      if (RIDER_SOCKET_NAMES.has(socketName)) {
        riderPivot.add(group);
      } else {
        root.add(group);
      }
      sockets[socketName] = group;
    }
  );

  const faceSlot = new THREE.Group();
  faceSlot.name = "socket_face";
  sockets.socket_head.add(faceSlot);

  const handPropFit = new THREE.Group();
  handPropFit.name = "art_hand_fit";
  sockets.socket_hand_r.add(handPropFit);

  const backPropFit = new THREE.Group();
  backPropFit.name = "art_back_fit";
  sockets.socket_back.add(backPropFit);

  const petFit = new THREE.Group();
  petFit.name = "art_pet_fit";
  sockets.socket_shoulder_l.add(petFit);

  const auraSlot = new THREE.Group();
  auraSlot.name = "socket_aura";
  root.add(auraSlot);

  return {
    root,
    riderPivot,
    sockets,
    fitWrappers: { handPropFit, backPropFit, petFit },
    faceSlot,
    auraSlot,
    bodyScale: [1, 1, 1],
    isMounted: false,
    mountId: "none",
    baseRiderPos: [0, 0, 0],
    baseRiderRotY: 0,
  };
}

export function createStudioLights(): THREE.Group {
  const lights = new THREE.Group();
  lights.name = "rule_the_isle_studio_lights";

  const hemi = new THREE.HemisphereLight(0xe2e8f0, 0x1e293b, 1.15);
  hemi.position.set(0, 4, 0);
  lights.add(hemi);

  const key = new THREE.DirectionalLight(0xffd27d, 2.25);
  key.position.set(2.4, 4.1, 3.2);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0005;
  lights.add(key);

  const fill = new THREE.DirectionalLight(0x38bdf8, 0.95);
  fill.position.set(-3.0, 2.2, 2.1);
  lights.add(fill);

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
  const geo = new THREE.TubeGeometry(curve, 14, radius, 8, false);
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
    roughness: 0.54,
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
    roughness: 0.52,
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

  // 1. Eyes & Expression (6 distinct sculpted 3D styles recessed flush on facial plane)
  const eyeStyle = config.eyeStyle ?? "calm";
  const isFierce = eyeStyle === "fierce";
  const isNoble = eyeStyle === "noble";
  const isWise = eyeStyle === "wise";
  const isCheerful = eyeStyle === "cheerful";
  const isSharp = eyeStyle === "sharp";

  for (const side of [-1, 1] as const) {
    const ex = side * 0.036;
    const ey = isCheerful ? 0.138 : 0.136;
    const ez = 0.095;
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
        new THREE.SphereGeometry(0.017, 14, 12),
        scleraMat,
        [ex, ey, ez],
        [0, 0, rotZ],
        scleraScale
      )
    );
    group.add(
      makeFaceMesh(
        `eye_iris_${side}`,
        new THREE.SphereGeometry(isFierce ? 0.0095 : 0.0108, 14, 12),
        eyeMat,
        [ex, ey + (isNoble ? 0.001 : 0), ez + 0.0090],
        [0, 0, 0],
        [1, 1, 0.55]
      )
    );
    group.add(
      makeFaceMesh(
        `eye_pupil_${side}`,
        new THREE.SphereGeometry(0.0055, 10, 10),
        pupilMat,
        [ex, ey + (isNoble ? 0.001 : 0), ez + 0.0136],
        [0, 0, 0],
        [1, 1, 0.45]
      )
    );

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
    // Subtle lower eyelid fold for depth
    group.add(
      makeFaceTube(
        `eye_lower_lid_${side}`,
        [
          [ex - side * 0.014, ey - 0.009, ez + 0.009],
          [ex, ey - 0.012, ez + 0.013],
          [ex + side * 0.014, ey - 0.008, ez + 0.008],
        ],
        0.0020,
        skinMat
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
          [side * 0.036, 0.136, 0.116],
          [0, side * 0.14, 0]
        )
      );
      group.add(
        makeFaceTube(
          `glasses_arm_${side}`,
          [
            [side * 0.059, 0.138, 0.112],
            [side * 0.095, 0.132, 0.058],
            [side * 0.098, 0.125, -0.005],
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
          [-0.014, 0.138, 0.117],
          [0, 0.142, 0.122],
          [0.014, 0.138, 0.117],
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
        [0.036, 0.136, 0.117],
        [0, 0.14, 0]
      )
    );
    group.add(
      makeFaceTube(
        "monocle_chain",
        [
          [0.058, 0.128, 0.111],
          [0.074, 0.092, 0.096],
          [0.068, 0.048, 0.074],
        ],
        0.0018,
        metalMat
      )
    );
  }

  // 2. Eyebrows (4 distinct 3D styles contoured over brow ridge)
  const browStyle = config.browStyle ?? "calm";
  for (const side of [-1, 1] as const) {
    const browRadius =
      browStyle === "thick" ? 0.0080 : browStyle === "scarred" ? 0.0064 : 0.0050;
    const pts: Array<[number, number, number]> =
      browStyle === "arched"
        ? [
            [side * 0.016, 0.161, 0.104],
            [side * 0.038, 0.177, 0.102],
            [side * 0.060, 0.163, 0.091],
          ]
        : browStyle === "thick"
          ? [
              [side * 0.014, 0.162, 0.105],
              [side * 0.038, 0.165, 0.105],
              [side * 0.062, 0.162, 0.093],
            ]
          : browStyle === "scarred"
            ? [
                [side * 0.014, 0.159, 0.104],
                [side * 0.038, 0.165, 0.104],
                [side * 0.060, 0.167, 0.092],
              ]
            : [
                [side * 0.017, 0.161, 0.103],
                [side * 0.038, 0.167, 0.102],
                [side * 0.058, 0.161, 0.091],
              ];
    group.add(makeFaceTube(`brow_${side}`, pts, browRadius, hairMat));
  }

  if (browStyle === "scarred") {
    group.add(
      makeFaceTube(
        "brow_scar_slash",
        [
          [-0.048, 0.184, 0.101],
          [-0.041, 0.150, 0.111],
          [-0.032, 0.106, 0.105],
        ],
        0.0036,
        scarMat
      )
    );
  }

  // 3. Sculpted Noses with Alar Wings / Nostrils (4 distinct 3D styles)
  const noseStyle = config.noseStyle ?? "straight";
  const nostrilScale = noseStyle === "broad" ? 0.012 : noseStyle === "button" ? 0.0075 : 0.009;
  const nostrilY = noseStyle === "button" ? 0.108 : noseStyle === "aquiline" ? 0.098 : 0.102;
  const nostrilZ = noseStyle === "aquiline" ? 0.112 : 0.108;
  for (const side of [-1, 1] as const) {
    group.add(
      makeFaceMesh(
        `nose_ala_${side}`,
        new THREE.SphereGeometry(nostrilScale, 10, 8),
        skinMat,
        [side * (noseStyle === "broad" ? 0.011 : 0.0085), nostrilY, nostrilZ],
        [0, 0, 0],
        [0.95, 0.85, 0.85]
      )
    );
  }
  if (noseStyle === "aquiline") {
    group.add(
      makeFaceTube(
        "nose_aquiline_bridge",
        [
          [0, 0.140, 0.103],
          [0, 0.120, 0.125],
          [0, 0.098, 0.118],
        ],
        0.0108,
        skinMat
      )
    );
    group.add(
      makeFaceMesh(
        "nose_aquiline_tip",
        new THREE.SphereGeometry(0.012, 12, 10),
        skinMat,
        [0, 0.098, 0.119],
        [0, 0, 0],
        [0.95, 0.9, 1.15]
      )
    );
  } else if (noseStyle === "broad") {
    group.add(
      makeFaceMesh(
        "nose_broad_bridge",
        new THREE.CapsuleGeometry(0.013, 0.025, 6, 10),
        skinMat,
        [0, 0.118, 0.104],
        [0.32, 0, 0],
        [1.3, 1.0, 1.0]
      )
    );
    group.add(
      makeFaceMesh(
        "nose_broad_tip",
        new THREE.SphereGeometry(0.015, 12, 10),
        skinMat,
        [0, 0.103, 0.114],
        [0, 0, 0],
        [1.45, 0.85, 1.05]
      )
    );
  } else if (noseStyle === "button") {
    group.add(
      makeFaceMesh(
        "nose_button_bridge",
        new THREE.CapsuleGeometry(0.0085, 0.016, 6, 10),
        skinMat,
        [0, 0.122, 0.103],
        [0.36, 0, 0]
      )
    );
    group.add(
      makeFaceMesh(
        "nose_button_tip",
        new THREE.SphereGeometry(0.0125, 12, 10),
        skinMat,
        [0, 0.110, 0.113],
        [0, 0, 0],
        [1.0, 0.85, 0.95]
      )
    );
  } else {
    group.add(
      makeFaceMesh(
        "nose_straight_bridge",
        new THREE.CapsuleGeometry(0.0108, 0.028, 6, 10),
        skinMat,
        [0, 0.118, 0.103],
        [0.3, 0, 0]
      )
    );
    group.add(
      makeFaceMesh(
        "nose_straight_tip",
        new THREE.SphereGeometry(0.0125, 12, 10),
        skinMat,
        [0, 0.103, 0.113],
        [0, 0, 0],
        [1.05, 0.85, 0.98]
      )
    );
  }

  // 4. Sculpted Cupid's Bow Upper + Lower Lips (4 distinct 3D styles)
  const mouthStyle = config.mouthStyle ?? "confident";
  if (mouthStyle === "smile") {
    group.add(
      makeFaceTube(
        "mouth_smile_curve",
        [
          [-0.026, 0.072, 0.096],
          [-0.010, 0.064, 0.104],
          [0, 0.066, 0.105],
          [0.010, 0.064, 0.104],
          [0.026, 0.072, 0.096],
        ],
        0.0042,
        lipsMat
      )
    );
    group.add(
      makeFaceTube(
        "mouth_smile_lower",
        [
          [-0.023, 0.070, 0.096],
          [0, 0.056, 0.104],
          [0.023, 0.070, 0.096],
        ],
        0.0048,
        lipsMat
      )
    );
    group.add(
      makeFaceMesh(
        "mouth_smile_teeth",
        new THREE.SphereGeometry(0.015, 12, 10),
        scleraMat,
        [0, 0.064, 0.101],
        [0, 0, 0],
        [1.35, 0.40, 0.45]
      )
    );
  } else if (mouthStyle === "serious") {
    group.add(
      makeFaceTube(
        "mouth_serious_line",
        [
          [-0.021, 0.061, 0.098],
          [-0.006, 0.066, 0.104],
          [0.006, 0.066, 0.104],
          [0.021, 0.061, 0.098],
        ],
        0.0044,
        lipsMat
      )
    );
    group.add(
      makeFaceTube(
        "mouth_serious_lower",
        [
          [-0.016, 0.059, 0.099],
          [0, 0.057, 0.103],
          [0.016, 0.059, 0.099],
        ],
        0.0044,
        lipsMat
      )
    );
  } else if (mouthStyle === "smirk") {
    group.add(
      makeFaceTube(
        "mouth_smirk_line",
        [
          [-0.019, 0.062, 0.098],
          [0.002, 0.064, 0.104],
          [0.025, 0.074, 0.097],
        ],
        0.0046,
        lipsMat
      )
    );
    group.add(
      makeFaceTube(
        "mouth_smirk_lower",
        [
          [-0.014, 0.058, 0.099],
          [0.003, 0.058, 0.103],
          [0.021, 0.067, 0.098],
        ],
        0.0044,
        lipsMat
      )
    );
  } else {
    group.add(
      makeFaceTube(
        "mouth_confident_line",
        [
          [-0.021, 0.067, 0.097],
          [-0.006, 0.064, 0.104],
          [0.006, 0.064, 0.104],
          [0.021, 0.067, 0.097],
        ],
        0.0044,
        lipsMat
      )
    );
    group.add(
      makeFaceTube(
        "mouth_confident_lower",
        [
          [-0.016, 0.062, 0.098],
          [0, 0.057, 0.103],
          [0.016, 0.062, 0.098],
        ],
        0.0046,
        lipsMat
      )
    );
  }

  return group;
}

export function getBodyScaleForType(
  bodyType: ResolvedAvatarConfig["bodyType"]
): [number, number, number] {
  if (bodyType === "sturdy") return [1.14, 0.99, 1.12];
  if (bodyType === "slender") return [0.87, 1.01, 0.89];
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

const ENCLOSING_HATS = new Set([
  "captain",
  "explorer",
  "bandana",
  "helm",
  "admiral_bicorne",
]);
const VOLUMINOUS_HAIRS = new Set(["bun", "royal_bun", "curly", "navigator"]);
const PAULDRON_OUTFITS = new Set(["armor", "imperial_lord", "merchant"]);

function setBonesRotationIn(
  container: THREE.Object3D,
  pose: Record<string, readonly [number, number, number]>
): void {
  container.traverse((obj) => {
    const rot = pose[obj.name];
    if (rot) {
      obj.rotation.set(rot[0], rot[1], rot[2]);
    }
  });
}

function findObjectInContainer(
  container: THREE.Object3D,
  namePrefix: string
): THREE.Object3D | null {
  let found: THREE.Object3D | null = null;
  container.traverse((obj) => {
    if (!found && obj.name.startsWith(namePrefix)) {
      found = obj;
    }
  });
  return found;
}

/**
 * Applies articulated standing OR riding bone poses + universal cross-slot compatibility
 * (hat-over-hair tuck, cape-behind-backProp push, pauldron pet perch, handProp grip sync).
 */
export function applyAvatarCombinationAndPose(
  rig: AvatarRigInstance,
  config: ResolvedAvatarConfig
): void {
  const mountProfile =
    config.mount && config.mount !== "none"
      ? MOUNT_PROFILES[config.mount] ?? MOUNT_PROFILES.island_horse
      : null;

  rig.isMounted = Boolean(mountProfile);
  rig.mountId = config.mount || "none";

  const hasHandProp = Boolean(config.handProp && config.handProp !== "none");
  const hasCape = Boolean(config.cape && config.cape !== "none");
  const hasPauldrons = PAULDRON_OUTFITS.has(config.outfit);
  const [sx, sy, sz] = rig.bodyScale;

  // 1. Mount / Rider Root Transform & Pedestal Footprint
  if (mountProfile) {
    rig.baseRiderPos = [0, mountProfile.riderY, mountProfile.riderZ];
    rig.baseRiderRotY = mountProfile.turnY;
    rig.riderPivot.position.set(0, mountProfile.riderY, mountProfile.riderZ);
    rig.riderPivot.rotation.set(0, mountProfile.turnY, 0);
    rig.sockets.socket_mount.rotation.set(0, mountProfile.turnY, 0);
    rig.sockets.socket_pedestal.scale.set(...mountProfile.pedestalScale);
  } else {
    rig.baseRiderPos = [0, 0, 0];
    rig.baseRiderRotY = 0;
    rig.riderPivot.position.set(0, 0, 0);
    rig.riderPivot.rotation.set(0, 0, 0);
    rig.sockets.socket_mount.rotation.set(0, 0, 0);
    rig.sockets.socket_pedestal.scale.set(1, 1, 1);
  }

  // 2. Articulated Bone Pose (Shared identically across body + outfit + legs + cape!)
  const bonePose: Record<string, readonly [number, number, number]> = mountProfile
    ? {
        rig_hips: [0.06, 0, 0],
        rig_torso: [mountProfile.torsoLean, 0, 0],
        rig_skirt_front: [-0.62, 0, 0],
        rig_skirt_back: [0.46, 0, 0],
        rig_cape_drape: [0.50, 0, 0],
        rig_thigh_l: [mountProfile.thighPitch, 0, mountProfile.thighSpread],
        rig_thigh_r: [mountProfile.thighPitch, 0, -mountProfile.thighSpread],
        rig_calf_l: [mountProfile.calfBend, 0, -mountProfile.calfInward],
        rig_calf_r: [mountProfile.calfBend, 0, mountProfile.calfInward],
        rig_foot_l: [mountProfile.footPitch, 0, -0.06],
        rig_foot_r: [mountProfile.footPitch, 0, 0.06],
        // Left arm reaches forward & inward to hold reins!
        rig_shoulder_l: [0, 0, 0.08],
        rig_upper_arm_l: [-0.46, -0.18, -0.14],
        rig_forearm_l: [-0.62, -0.22, -0.18],
        rig_hand_l: [0.3, 0.4, 0.25],
        // Right arm: abducts cleanly outward (-rz on -X side) so hand props ride heroically clear of flanks/knees
        rig_shoulder_r: [0, 0, -0.08],
        rig_upper_arm_r: hasHandProp ? [-0.36, 0.08, -0.22] : [-0.18, 0.0, -0.14],
        rig_forearm_r: hasHandProp ? [-0.66, -0.10, -0.06] : [-0.42, 0.08, 0.06],
        rig_hand_r: hasHandProp ? [-0.24, -0.16, -0.12] : [0, 0, 0],
      }
    : {
        rig_hips: [0, 0, 0],
        rig_torso: [0, 0, 0],
        rig_skirt_front: [0, 0, 0],
        rig_skirt_back: [0, 0, 0],
        rig_cape_drape: [0, 0, 0],
        rig_thigh_l: [0, 0, 0],
        rig_thigh_r: [0, 0, 0],
        rig_calf_l: [0, 0, 0],
        rig_calf_r: [0, 0, 0],
        rig_foot_l: [0, 0, 0],
        rig_foot_r: [0, 0, 0],
        rig_shoulder_l: [0, 0, 0],
        rig_upper_arm_l: [0, 0, 0.05],
        rig_forearm_l: [-0.08, 0, -0.03],
        rig_hand_l: [0, 0, 0],
        rig_shoulder_r: [0, 0, 0],
        rig_upper_arm_r: hasHandProp ? [-0.14, 0, -0.06] : [0, 0, -0.05],
        rig_forearm_r: hasHandProp ? [-0.34, 0.08, 0.04] : [-0.08, 0, 0.03],
        rig_hand_r: [0, 0, 0],
      };

  setBonesRotationIn(rig.sockets.socket_torso, bonePose);
  setBonesRotationIn(rig.sockets.socket_legs, bonePose);
  setBonesRotationIn(rig.sockets.socket_cape, bonePose);

  // 3. Synchronize right-hand prop exact palm center from articulated `rig_hand_r`!
  rig.riderPivot.updateMatrixWorld(true);
  const handRNode = findObjectInContainer(rig.sockets.socket_torso, "rig_hand_r");
  if (handRNode) {
    // Palm grip center is -0.045 down the sculpted hand along its local -Y axis
    const palmLocalPos = new THREE.Vector3(0, -0.045, 0.012);
    handRNode.localToWorld(palmLocalPos);
    rig.sockets.socket_hand_r.worldToLocal(palmLocalPos);
    rig.fitWrappers.handPropFit.position.copy(palmLocalPos);

    const handWorldQuat = new THREE.Quaternion();
    handRNode.getWorldQuaternion(handWorldQuat);
    const socketWorldQuat = new THREE.Quaternion();
    rig.sockets.socket_hand_r.getWorldQuaternion(socketWorldQuat);
    rig.fitWrappers.handPropFit.quaternion
      .copy(socketWorldQuat.invert().multiply(handWorldQuat));
  } else {
    rig.fitWrappers.handPropFit.position.set(0, 0, 0);
    rig.fitWrappers.handPropFit.rotation.set(0, 0, 0);
  }

  // 4. Cape vs BackProp clearance (backpack/sword/shield never sink into cloak!)
  const extraBackZ = hasCape ? -0.065 : 0;
  const extraBackY = hasPauldrons && hasCape ? 0.025 : 0;
  rig.fitWrappers.backPropFit.position.set(0, extraBackY, extraBackZ);

  // Lift cape shoulder anchor slightly over bulky armor pauldrons
  const capeCollar = findObjectInContainer(rig.sockets.socket_cape, "rig_cape_collar");
  if (capeCollar) {
    capeCollar.position.set(0, hasPauldrons ? 1.405 : 1.38, hasPauldrons ? -0.015 : 0);
  }

  // 5. Outfit pauldrons vs Left-Shoulder Pet perch clearance
  const petLiftY =
    config.outfit === "imperial_lord" || config.outfit === "armor"
      ? 0.045
      : config.outfit === "merchant" || config.outfit === "captain"
        ? 0.022
        : 0.0;
  const petShiftX = (sx - 1) * -0.02 + (hasPauldrons ? 0.022 : 0);
  const petFwdZ = mountProfile ? 0.02 : 0;
  rig.fitWrappers.petFit.position.set(petShiftX, petLiftY, petFwdZ);

  // 6. Hair vs Hat compatibility solver (never poke spikes through hats!)
  const hairCrown = findObjectInContainer(rig.sockets.socket_head, "hair_crown_mass");
  const hatPart = findObjectInContainer(rig.sockets.socket_head, "hat_");
  if (hairCrown) {
    if (hatPart && ENCLOSING_HATS.has(config.hat)) {
      // Compress crown hair puff smoothly inside cap/helm while lower locks remain flowing!
      hairCrown.scale.set(0.84, 0.56, 0.84);
      hairCrown.position.set(0, 0.072, -0.012);
    } else {
      hairCrown.scale.set(1, 1, 1);
      hairCrown.position.set(0, 0, 0);
    }
  }
  if (hatPart) {
    if (config.hat === "crown_gold" && VOLUMINOUS_HAIRS.has(config.hair)) {
      hatPart.position.set(0, 0.022, 0);
    } else {
      hatPart.position.set(0, 0, 0);
    }
  }

  // Subtle torso lean adjustment for upper sockets when crouched on Snow Wolf
  if (mountProfile && mountProfile.torsoLean > 0.05) {
    const leanZ = Math.sin(mountProfile.torsoLean) * 0.45;
    const leanY = -(1 - Math.cos(mountProfile.torsoLean)) * 0.45 * sy;
    rig.fitWrappers.backPropFit.position.z += leanZ - 0.015 * sz;
    rig.fitWrappers.backPropFit.position.y += leanY;
  }
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

    phases[i] = i * 0.61803398875 * Math.PI * 2;
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

  // Clear sockets carefully while preserving permanent structural sub-groups!
  const preservedBySocket = new Map<THREE.Group, Set<THREE.Object3D>>([
    [rig.sockets.socket_head, new Set([rig.faceSlot])],
    [rig.sockets.socket_hand_r, new Set([rig.fitWrappers.handPropFit])],
    [rig.sockets.socket_back, new Set([rig.fitWrappers.backPropFit])],
    [rig.sockets.socket_shoulder_l, new Set([rig.fitWrappers.petFit])],
  ]);

  for (const socketGroup of Object.values(rig.sockets)) {
    const preserved = preservedBySocket.get(socketGroup);
    if (preserved) {
      for (let i = socketGroup.children.length - 1; i >= 0; i--) {
        const child = socketGroup.children[i];
        if (!preserved.has(child)) {
          socketGroup.remove(child);
          disposeObjectTree(child);
        }
      }
      for (const wrapper of preserved) {
        if (wrapper !== rig.faceSlot && wrapper instanceof THREE.Group) {
          clearGroupChildren(wrapper);
        }
      }
      continue;
    }
    clearGroupChildren(socketGroup);
  }

  for (const loaded of loadedParts) {
    if (!loaded) continue;
    loaded.partGroup.name = `${loaded.slot}_${loaded.partGroup.name || "part"}`;
    if (loaded.socket === "socket_hand_r") {
      rig.fitWrappers.handPropFit.add(loaded.partGroup);
    } else if (loaded.socket === "socket_back") {
      rig.fitWrappers.backPropFit.add(loaded.partGroup);
    } else if (loaded.socket === "socket_shoulder_l") {
      rig.fitWrappers.petFit.add(loaded.partGroup);
    } else {
      rig.sockets[loaded.socket].add(loaded.partGroup);
    }
  }

  updateAvatarBodyProportions(rig, config.bodyType);
  updateAvatarFacialFeatures(rig, config);
  applyAvatarCombinationAndPose(rig, config);

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

  const [bsx, bsy, bsz] = rig.bodyScale;
  rig.sockets.socket_torso.scale.set(
    bsx * (1 - breath * 0.0025),
    bsy * (1 + breath * 0.005),
    bsz * (1 - breath * 0.0025)
  );
  rig.sockets.socket_cape.scale.set(bsx, bsy * (1 + breath * 0.004), bsz);

  // Subtle living saddle bob when mounted, preserving baseRiderPos!
  if (rig.isMounted) {
    const rideBob = Math.sin(elapsedSeconds * 2.1) * 0.008;
    rig.riderPivot.position.set(
      rig.baseRiderPos[0],
      rig.baseRiderPos[1] + rideBob,
      rig.baseRiderPos[2]
    );
    rig.riderPivot.rotation.y =
      rig.baseRiderRotY + Math.sin(elapsedSeconds * 0.85) * 0.015;
    rig.sockets.socket_mount.rotation.y = rig.riderPivot.rotation.y;

    const mountNeck = rig.sockets.socket_mount.getObjectByName("mount_neck_pivot");
    if (mountNeck) {
      mountNeck.rotation.x = Math.sin(elapsedSeconds * 1.4) * 0.045;
      mountNeck.rotation.y = Math.sin(elapsedSeconds * 0.7) * 0.06;
    }
    const mountTail = rig.sockets.socket_mount.getObjectByName("mount_tail_pivot");
    if (mountTail) {
      mountTail.rotation.y = Math.sin(elapsedSeconds * 2.3) * 0.14;
      mountTail.rotation.x = Math.sin(elapsedSeconds * 1.6) * 0.04;
    }
    const wingL = rig.sockets.socket_mount.getObjectByName("mount_wing_l");
    const wingR = rig.sockets.socket_mount.getObjectByName("mount_wing_r");
    if (wingL && wingR) {
      const flap = Math.sin(elapsedSeconds * 2.2) * 0.075;
      wingL.rotation.z = -0.18 + flap;
      wingR.rotation.z = 0.18 - flap;
    }
  }

  const headBase = AVATAR_SOCKET_OFFSETS.socket_head;
  rig.sockets.socket_head.position.set(
    headBase[0],
    headBase[1] + breath * 0.005,
    headBase[2]
  );
  rig.sockets.socket_head.rotation.set(
    Math.sin(elapsedSeconds * 1.25) * 0.015,
    gentleSway * 0.032,
    0
  );

  const handBase = AVATAR_SOCKET_OFFSETS.socket_hand_r;
  rig.sockets.socket_hand_r.position.set(
    handBase[0] * bsx,
    handBase[1] + Math.sin(elapsedSeconds * 1.8 - 0.35) * 0.005,
    handBase[2]
  );
  rig.sockets.socket_hand_r.rotation.z = Math.sin(elapsedSeconds * 1.2) * 0.02;

  const backBase = AVATAR_SOCKET_OFFSETS.socket_back;
  rig.sockets.socket_back.position.set(
    backBase[0],
    backBase[1] + breath * 0.0045,
    backBase[2] * bsz
  );

  const shoulderBase = AVATAR_SOCKET_OFFSETS.socket_shoulder_l;
  rig.sockets.socket_shoulder_l.position.set(
    shoulderBase[0] * bsx,
    shoulderBase[1] + Math.sin(elapsedSeconds * 2.5 + 0.7) * 0.010,
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
