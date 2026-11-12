import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MODELS_ROOT = path.resolve(__dirname, "../public/assets/models/avatars");

// ============================================================================
// Dependency-free glTF 2.0 Binary (.glb) Serializer for Node + Three.js
// ============================================================================

function align4(n) {
  return (n + 3) & ~3;
}

function serializeGroupToGlb(rootGroup) {
  rootGroup.updateMatrixWorld(true);

  const materials = [];
  const materialMap = new Map();

  const gltfMeshes = [];
  const gltfNodes = [];
  const gltfBuffers = [];
  const gltfBufferViews = [];
  const gltfAccessors = [];

  const binChunks = [];
  let binByteOffset = 0;

  function appendBinaryChunk(typedArray, target) {
    const srcBytes = new Uint8Array(
      typedArray.buffer,
      typedArray.byteOffset,
      typedArray.byteLength
    );
    const paddedLen = align4(srcBytes.byteLength);
    const offset = binByteOffset;
    binChunks.push(srcBytes);
    if (paddedLen > srcBytes.byteLength) {
      binChunks.push(new Uint8Array(paddedLen - srcBytes.byteLength));
    }
    binByteOffset += paddedLen;

    const bvIndex = gltfBufferViews.length;
    const bv = {
      buffer: 0,
      byteOffset: offset,
      byteLength: srcBytes.byteLength,
    };
    if (target !== undefined) bv.target = target;
    gltfBufferViews.push(bv);
    return bvIndex;
  }

  function registerMaterial(mat) {
    if (materialMap.has(mat)) return materialMap.get(mat);
    const idx = materials.length;
    materialMap.set(mat, idx);

    const color = mat.color ?? new THREE.Color(0xffffff);
    const opacity = typeof mat.opacity === "number" ? mat.opacity : 1;
    const gltfMat = {
      name: mat.name || `material_${idx}`,
      pbrMetallicRoughness: {
        baseColorFactor: [
          Number(color.r.toFixed(5)),
          Number(color.g.toFixed(5)),
          Number(color.b.toFixed(5)),
          Number(opacity.toFixed(4)),
        ],
        metallicFactor: Number((mat.metalness ?? 0).toFixed(4)),
        roughnessFactor: Number((mat.roughness ?? 0.65).toFixed(4)),
      },
    };

    if (mat.emissive && (mat.emissive.r > 0 || mat.emissive.g > 0 || mat.emissive.b > 0)) {
      const ei = mat.emissiveIntensity ?? 1;
      gltfMat.emissiveFactor = [
        Math.min(1, Number((mat.emissive.r * ei).toFixed(5))),
        Math.min(1, Number((mat.emissive.g * ei).toFixed(5))),
        Math.min(1, Number((mat.emissive.b * ei).toFixed(5))),
      ];
    }

    if (mat.side === THREE.DoubleSide) {
      gltfMat.doubleSided = true;
    }
    if (mat.transparent && opacity < 1) {
      gltfMat.alphaMode = "BLEND";
    }

    materials.push(gltfMat);
    return idx;
  }

  function registerGeometry(geometry, matIndex, meshName) {
    if (!geometry.getAttribute("normal")) {
      geometry.computeVertexNormals();
    }

    const posAttr = geometry.getAttribute("position");
    const normAttr = geometry.getAttribute("normal");
    const uvAttr = geometry.getAttribute("uv");

    const posArray = new Float32Array(posAttr.count * 3);
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const y = posAttr.getY(i);
      const z = posAttr.getZ(i);
      posArray[i * 3] = x;
      posArray[i * 3 + 1] = y;
      posArray[i * 3 + 2] = z;
      if (x < min[0]) min[0] = x;
      if (y < min[1]) min[1] = y;
      if (z < min[2]) min[2] = z;
      if (x > max[0]) max[0] = x;
      if (y > max[1]) max[1] = y;
      if (z > max[2]) max[2] = z;
    }

    const posBv = appendBinaryChunk(posArray, 34962);
    const posAccessor = gltfAccessors.length;
    gltfAccessors.push({
      bufferView: posBv,
      componentType: 5126,
      count: posAttr.count,
      type: "VEC3",
      min,
      max,
    });

    const attributes = { POSITION: posAccessor };

    if (normAttr) {
      const normArray = new Float32Array(normAttr.count * 3);
      for (let i = 0; i < normAttr.count; i++) {
        normArray[i * 3] = normAttr.getX(i);
        normArray[i * 3 + 1] = normAttr.getY(i);
        normArray[i * 3 + 2] = normAttr.getZ(i);
      }
      const normBv = appendBinaryChunk(normArray, 34962);
      const normAccessor = gltfAccessors.length;
      gltfAccessors.push({
        bufferView: normBv,
        componentType: 5126,
        count: normAttr.count,
        type: "VEC3",
      });
      attributes.NORMAL = normAccessor;
    }

    if (uvAttr) {
      const uvArray = new Float32Array(uvAttr.count * 2);
      for (let i = 0; i < uvAttr.count; i++) {
        uvArray[i * 2] = uvAttr.getX(i);
        uvArray[i * 2 + 1] = uvAttr.getY(i);
      }
      const uvBv = appendBinaryChunk(uvArray, 34962);
      const uvAccessor = gltfAccessors.length;
      gltfAccessors.push({
        bufferView: uvBv,
        componentType: 5126,
        count: uvAttr.count,
        type: "VEC2",
      });
      attributes.TEXCOORD_0 = uvAccessor;
    }

    const primitive = {
      attributes,
      material: matIndex,
      mode: 4, // TRIANGLES
    };

    const indexAttr = geometry.getIndex();
    if (indexAttr) {
      let maxIdx = 0;
      for (let i = 0; i < indexAttr.count; i++) {
        const v = indexAttr.getX(i);
        if (v > maxIdx) maxIdx = v;
      }
      const useUint32 = maxIdx > 65535;
      const idxArray = useUint32
        ? new Uint32Array(indexAttr.count)
        : new Uint16Array(indexAttr.count);
      for (let i = 0; i < indexAttr.count; i++) {
        idxArray[i] = indexAttr.getX(i);
      }
      const idxBv = appendBinaryChunk(idxArray, 34963);
      const idxAccessor = gltfAccessors.length;
      gltfAccessors.push({
        bufferView: idxBv,
        componentType: useUint32 ? 5125 : 5123,
        count: indexAttr.count,
        type: "SCALAR",
      });
      primitive.indices = idxAccessor;
    }

    const meshIndex = gltfMeshes.length;
    gltfMeshes.push({
      name: meshName || `mesh_${meshIndex}`,
      primitives: [primitive],
    });
    return meshIndex;
  }

  function visitNode(obj) {
    const nodeIdx = gltfNodes.length;
    const node = {};
    if (obj.name) node.name = obj.name;
    gltfNodes.push(node);

    const p = obj.position;
    if (Math.abs(p.x) > 1e-6 || Math.abs(p.y) > 1e-6 || Math.abs(p.z) > 1e-6) {
      node.translation = [
        Number(p.x.toFixed(6)),
        Number(p.y.toFixed(6)),
        Number(p.z.toFixed(6)),
      ];
    }

    const q = obj.quaternion;
    if (
      Math.abs(q.x) > 1e-6 ||
      Math.abs(q.y) > 1e-6 ||
      Math.abs(q.z) > 1e-6 ||
      Math.abs(q.w - 1) > 1e-6
    ) {
      node.rotation = [
        Number(q.x.toFixed(6)),
        Number(q.y.toFixed(6)),
        Number(q.z.toFixed(6)),
        Number(q.w.toFixed(6)),
      ];
    }

    const s = obj.scale;
    if (
      Math.abs(s.x - 1) > 1e-6 ||
      Math.abs(s.y - 1) > 1e-6 ||
      Math.abs(s.z - 1) > 1e-6
    ) {
      node.scale = [
        Number(s.x.toFixed(6)),
        Number(s.y.toFixed(6)),
        Number(s.z.toFixed(6)),
      ];
    }

    if (obj.isMesh && obj.geometry) {
      const mat = Array.isArray(obj.material) ? obj.material[0] : obj.material;
      const matIdx = registerMaterial(mat);
      node.mesh = registerGeometry(obj.geometry, matIdx, obj.name);
    }

    if (obj.children && obj.children.length > 0) {
      node.children = obj.children.map((child) => visitNode(child));
    }

    return nodeIdx;
  }

  visitNode(rootGroup);

  gltfBuffers.push({
    byteLength: binByteOffset,
  });

  const gltfJson = {
    asset: {
      version: "2.0",
      generator: "rule-the-isle-starter-3d-builder",
    },
    scene: 0,
    scenes: [{ name: "Scene", nodes: [0] }],
    nodes: gltfNodes,
    meshes: gltfMeshes,
    materials,
    accessors: gltfAccessors,
    bufferViews: gltfBufferViews,
    buffers: gltfBuffers,
  };

  const jsonRaw = Buffer.from(JSON.stringify(gltfJson), "utf8");
  const jsonPaddedLen = align4(jsonRaw.length);
  const jsonChunk = Buffer.alloc(jsonPaddedLen, 0x20);
  jsonRaw.copy(jsonChunk);

  const binBuffer = Buffer.concat(binChunks.map((c) => Buffer.from(c.buffer, c.byteOffset, c.byteLength)));
  const totalLength = 12 + 8 + jsonChunk.length + 8 + binBuffer.length;

  const glb = Buffer.alloc(totalLength);
  let offset = 0;

  // Header
  glb.write("glTF", offset, 4, "ascii");
  offset += 4;
  glb.writeUInt32LE(2, offset);
  offset += 4;
  glb.writeUInt32LE(totalLength, offset);
  offset += 4;

  // JSON chunk
  glb.writeUInt32LE(jsonChunk.length, offset);
  offset += 4;
  glb.writeUInt32LE(0x4e4f534a, offset);
  offset += 4;
  jsonChunk.copy(glb, offset);
  offset += jsonChunk.length;

  // BIN chunk
  glb.writeUInt32LE(binBuffer.length, offset);
  offset += 4;
  glb.writeUInt32LE(0x004e4942, offset);
  offset += 4;
  binBuffer.copy(glb, offset);

  return glb;
}

function writeGlb(relPath, rootGroup) {
  const fullPath = path.join(MODELS_ROOT, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  const glb = serializeGroupToGlb(rootGroup);
  fs.writeFileSync(fullPath, glb);
  return glb.length;
}

// ============================================================================
// Material Palette (Named Channels for Runtime Recolor)
// ============================================================================

function makeMat(name, hex, opts = {}) {
  return new THREE.MeshStandardMaterial({
    name,
    color: hex,
    roughness: opts.roughness ?? 0.62,
    metalness: opts.metalness ?? 0.06,
    side: opts.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
  });
}

function createMaterials() {
  return {
    skin: makeMat("mat_skin", 0xe4b287, { roughness: 0.58, metalness: 0.02 }),
    hair: makeMat("mat_hair", 0x432316, { roughness: 0.72, metalness: 0.04 }),
    eyes: makeMat("mat_eyes", 0x0284c7, { roughness: 0.25, metalness: 0.05 }),
    sclera: makeMat("mat_sclera", 0xf8fafc, { roughness: 0.3, metalness: 0.0 }),
    pupil: makeMat("mat_pupil", 0x0f172a, { roughness: 0.2, metalness: 0.05 }),
    primary: makeMat("mat_primary", 0x1d4ed8, { roughness: 0.66, metalness: 0.05, doubleSided: true }),
    secondary: makeMat("mat_secondary", 0x991b1b, { roughness: 0.68, metalness: 0.05, doubleSided: true }),
    metal: makeMat("mat_metal", 0xfacc15, { roughness: 0.26, metalness: 0.86 }),
    mount: makeMat("mat_mount", 0xd6d3d1, { roughness: 0.64, metalness: 0.08 }),
  };
}

// ============================================================================
// Geometry Helpers
// ============================================================================

function addMesh(parent, name, geometry, material, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) {
  const m = new THREE.Mesh(geometry, material);
  m.name = name;
  m.position.set(pos[0], pos[1], pos[2]);
  m.rotation.set(rot[0], rot[1], rot[2]);
  m.scale.set(scale[0], scale[1], scale[2]);
  parent.add(m);
  return m;
}

function makeLathe(points, segments = 20) {
  const vecs = points.map(([r, y]) => new THREE.Vector2(r, y));
  return new THREE.LatheGeometry(vecs, segments);
}

function makeBeveledShape(shape, depth = 0.04, bevelSize = 0.012, bevelThickness = 0.012) {
  return new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize,
    bevelThickness,
    curveSegments: 16,
  });
}

function makeTube(points, radius = 0.02, tubularSegments = 20, radialSegments = 10, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)), closed);
  return new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, closed);
}

function makeLimbBetween(parent, name, p1, p2, rTop, rBot, mat) {
  const v1 = new THREE.Vector3(...p1);
  const v2 = new THREE.Vector3(...p2);
  const dir = new THREE.Vector3().subVectors(v2, v1);
  const len = dir.length();
  const mid = new THREE.Vector3().addVectors(v1, v2).multiplyScalar(0.5);
  const geo = new THREE.CylinderGeometry(rTop, rBot, len, 14, 1);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = name;
  mesh.position.copy(mid);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  parent.add(mesh);

  const joint = new THREE.Mesh(new THREE.SphereGeometry(rBot * 1.03, 12, 10), mat);
  joint.name = `${name}_joint`;
  joint.position.copy(v2);
  parent.add(joint);
  return mesh;
}

// ============================================================================
// 1. BODIES (World space Y=0..1.48, +Z front, hand_r=(-0.36,0.88,0.12), sh_l=(0.27,1.41,0.01))
// ============================================================================

function buildBody(variant) {
  const mats = createMaterials();
  const root = new THREE.Group();
  root.name = `body_${variant}`;

  const cfg = {
    athletic: { shoulderX: 0.235, chestW: 1.18, waistR: 0.125, hipR: 0.145, limb: 1.0 },
    sturdy: { shoulderX: 0.265, chestW: 1.28, waistR: 0.155, hipR: 0.168, limb: 1.18 },
    slender: { shoulderX: 0.205, chestW: 1.06, waistR: 0.105, hipR: 0.132, limb: 0.88 },
  }[variant];

  // Sculpted torso from pelvis (0.86) through waist (1.06) and chest (1.30) to neck (1.48)
  const torsoGeo = makeLathe(
    [
      [0.01, 0.84],
      [cfg.hipR, 0.90],
      [cfg.waistR, 1.06],
      [cfg.waistR * 1.24, 1.24],
      [cfg.waistR * 1.28, 1.35],
      [0.068, 1.40],
      [0.056, 1.48],
      [0.005, 1.49],
    ],
    24
  );
  addMesh(root, "torso_sculpt", torsoGeo, mats.skin, [0, 0, 0], [0, 0, 0], [cfg.chestW, 1, 0.78]);

  // Pelvis base
  addMesh(
    root,
    "pelvis",
    new THREE.SphereGeometry(cfg.hipR * 0.96, 16, 12),
    mats.skin,
    [0, 0.89, 0],
    [0, 0, 0],
    [1.12, 0.78, 0.76]
  );

  // Shoulders (left shoulder top aligns with socket_shoulder_l at (0.27, 1.41, 0.01))
  const shY = 1.36;
  const shR = 0.066 * cfg.limb;
  addMesh(root, "shoulder_l", new THREE.SphereGeometry(shR, 14, 12), mats.skin, [cfg.shoulderX, shY, 0.01]);
  addMesh(root, "shoulder_r", new THREE.SphereGeometry(shR, 14, 12), mats.skin, [-cfg.shoulderX, shY, 0.01]);

  // Left arm (relaxed hero stance)
  const lElbow = [cfg.shoulderX + 0.08, 1.13, 0.03];
  const lHand = [0.35, 0.88, 0.08];
  makeLimbBetween(root, "upper_arm_l", [cfg.shoulderX, shY, 0.01], lElbow, 0.052 * cfg.limb, 0.044 * cfg.limb, mats.skin);
  makeLimbBetween(root, "forearm_l", lElbow, lHand, 0.044 * cfg.limb, 0.036 * cfg.limb, mats.skin);
  addMesh(root, "hand_l", new THREE.SphereGeometry(0.043, 12, 10), mats.skin, lHand, [0, 0, 0], [0.85, 1.15, 0.78]);

  // Right arm (positioned precisely so hand lands at socket_hand_r (-0.36, 0.88, 0.12))
  const rElbow = [-(cfg.shoulderX + 0.08), 1.13, 0.03];
  const rHand = [-0.36, 0.88, 0.12];
  makeLimbBetween(root, "upper_arm_r", [-cfg.shoulderX, shY, 0.01], rElbow, 0.052 * cfg.limb, 0.044 * cfg.limb, mats.skin);
  makeLimbBetween(root, "forearm_r", rElbow, rHand, 0.044 * cfg.limb, 0.036 * cfg.limb, mats.skin);
  addMesh(root, "hand_r", new THREE.SphereGeometry(0.044, 12, 10), mats.skin, rHand, [0, 0, 0], [0.85, 1.15, 0.85]);

  // Legs resting cleanly on Y=0
  for (const [side, sx] of [["l", 0.105], ["r", -0.105]]) {
    const hip = [sx, 0.87, 0];
    const knee = [sx * 1.04, 0.46, 0.02];
    const ankle = [sx * 1.05, 0.07, -0.01];
    makeLimbBetween(root, `thigh_${side}`, hip, knee, 0.078 * cfg.limb, 0.062 * cfg.limb, mats.skin);
    makeLimbBetween(root, `calf_${side}`, knee, ankle, 0.06 * cfg.limb, 0.045 * cfg.limb, mats.skin);
    addMesh(
      root,
      `foot_${side}`,
      new THREE.CapsuleGeometry(0.038, 0.09, 6, 12),
      mats.skin,
      [sx * 1.05, 0.038, 0.035],
      [Math.PI / 2, 0, 0],
      [1.05, 1.0, 0.85]
    );
  }

  return root;
}

// ============================================================================
// 2. HEADS (Local socket_head (0,0,0), centered around (0, 0.12, 0))
// ============================================================================

function buildHead(variant) {
  const mats = createMaterials();
  const root = new THREE.Group();
  root.name = `head_${variant}`;

  const profiles = {
    oval: {
      scale: [0.96, 1.0, 0.96],
      pts: [
        [0.01, 0.0],
        [0.055, 0.02],
        [0.092, 0.08],
        [0.108, 0.15],
        [0.102, 0.21],
        [0.07, 0.245],
        [0.005, 0.255],
      ],
    },
    square: {
      scale: [1.02, 0.99, 0.97],
      pts: [
        [0.01, 0.0],
        [0.078, 0.018],
        [0.102, 0.065],
        [0.11, 0.145],
        [0.105, 0.21],
        [0.072, 0.245],
        [0.005, 0.255],
      ],
    },
    heart: {
      scale: [0.98, 1.0, 0.95],
      pts: [
        [0.01, 0.0],
        [0.042, 0.018],
        [0.084, 0.085],
        [0.112, 0.155],
        [0.106, 0.21],
        [0.072, 0.245],
        [0.005, 0.255],
      ],
    },
    chiseled: {
      scale: [0.95, 1.03, 0.98],
      pts: [
        [0.01, 0.0],
        [0.064, 0.014],
        [0.094, 0.075],
        [0.108, 0.15],
        [0.104, 0.212],
        [0.07, 0.245],
        [0.005, 0.255],
      ],
    },
  }[variant];

  // Cranium + jaw sculpt
  addMesh(
    root,
    "cranium",
    makeLathe(profiles.pts, 26),
    mats.skin,
    [0, 0, 0],
    [0, 0, 0],
    profiles.scale
  );

  // Subtle sculpted collar/neckband at base of socket_head (uses mat_secondary cleanly!)
  addMesh(
    root,
    "collar_accent",
    new THREE.TorusGeometry(0.068, 0.014, 10, 24),
    mats.secondary,
    [0, 0.002, 0],
    [Math.PI / 2, 0, 0]
  );

  // Ears
  for (const side of [-1, 1]) {
    addMesh(
      root,
      side > 0 ? "ear_l" : "ear_r",
      new THREE.SphereGeometry(0.024, 12, 10),
      mats.skin,
      [side * 0.104 * profiles.scale[0], 0.118, -0.005],
      [0, 0, side * 0.18],
      [0.48, 1.05, 0.72]
    );
  }

  // Internal facial rig anchors (sceneComposer renders modular eyeStyle/browStyle/noseStyle/mouthStyle on top)
  addMesh(
    root,
    "eye_socket_anchor",
    new THREE.SphereGeometry(0.012, 8, 6),
    mats.eyes,
    [0, 0.136, 0.0]
  );
  addMesh(
    root,
    "brow_socket_anchor",
    new THREE.SphereGeometry(0.012, 8, 6),
    mats.hair,
    [0, 0.16, 0.0]
  );

  return root;
}

// ============================================================================
// 3. HAIR (Relative to socket_head (0, 0.12, 0))
// ============================================================================

function buildHair(variant) {
  const mats = createMaterials();
  const root = new THREE.Group();
  root.name = `hair_${variant}`;

  // Base skull cap (covers top/back cleanly without clipping face)
  const cap = new THREE.SphereGeometry(0.114, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.58);
  addMesh(root, "hair_cap", cap, mats.hair, [0, 0.135, -0.012], [-0.22, 0, 0], [1.01, 1.05, 1.04]);

  if (variant === "short") {
    for (let i = -2; i <= 2; i++) {
      addMesh(
        root,
        `short_tuft_${i}`,
        makeTube(
          [
            [i * 0.026, 0.23, 0.01],
            [i * 0.028, 0.245, 0.065],
            [i * 0.024, 0.205, 0.105],
          ],
          0.024 - Math.abs(i) * 0.003,
          12,
          8
        ),
        mats.hair
      );
    }
  } else if (variant === "wavy") {
    for (const side of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const zOff = -0.02 - k * 0.035;
        addMesh(
          root,
          `wave_${side}_${k}`,
          makeTube(
            [
              [side * 0.075, 0.22, zOff],
              [side * 0.12, 0.15, zOff - 0.01],
              [side * 0.105, 0.08, zOff - 0.02],
              [side * 0.122, 0.02, zOff - 0.025],
            ],
            0.028,
            16,
            8
          ),
          mats.hair
        );
      }
    }
    addMesh(
      root,
      "wave_back",
      new THREE.CapsuleGeometry(0.085, 0.11, 8, 14),
      mats.hair,
      [0, 0.09, -0.075],
      [0.12, 0, 0],
      [1.15, 1, 0.65]
    );
  } else if (variant === "bun") {
    addMesh(root, "top_bun", new THREE.SphereGeometry(0.062, 18, 14), mats.hair, [0, 0.265, -0.045]);
    addMesh(root, "bun_coil", new THREE.TorusGeometry(0.052, 0.018, 10, 20), mats.hair, [0, 0.245, -0.045], [Math.PI / 2, 0, 0]);
  } else if (variant === "braids") {
    for (const side of [-1, 1]) {
      for (let seg = 0; seg < 6; seg++) {
        const y = 0.16 - seg * 0.036;
        const x = side * (0.105 + Math.sin(seg * 0.7) * 0.008);
        const z = -0.015 + seg * 0.008;
        addMesh(root, `braid_${side}_${seg}`, new THREE.SphereGeometry(0.025 - seg * 0.0018, 10, 8), mats.hair, [x, y, z]);
      }
    }
  } else if (variant === "curly") {
    const offsets = [
      [0, 0.255, 0.03], [-0.06, 0.24, 0.04], [0.06, 0.24, 0.04],
      [-0.095, 0.19, 0.01], [0.095, 0.19, 0.01], [-0.105, 0.13, -0.02], [0.105, 0.13, -0.02],
      [-0.06, 0.23, -0.06], [0.06, 0.23, -0.06], [0, 0.21, -0.10],
      [-0.065, 0.14, -0.095], [0.065, 0.14, -0.095],
    ];
    offsets.forEach(([x, y, z], i) => {
      addMesh(root, `curl_${i}`, new THREE.SphereGeometry(0.044, 12, 10), mats.hair, [x, y, z]);
    });
  } else if (variant === "long") {
    const capeShape = new THREE.Shape();
    capeShape.moveTo(-0.11, 0.18);
    capeShape.quadraticCurveTo(0, 0.22, 0.11, 0.18);
    capeShape.lineTo(0.135, -0.12);
    capeShape.quadraticCurveTo(0, -0.16, -0.135, -0.12);
    capeShape.closePath();
    addMesh(
      root,
      "long_back_flow",
      makeBeveledShape(capeShape, 0.045, 0.015, 0.015),
      mats.hair,
      [0, 0, -0.115],
      [0.1, 0, 0]
    );
    for (const side of [-1, 1]) {
      addMesh(
        root,
        `long_side_${side}`,
        makeTube(
          [
            [side * 0.085, 0.21, 0.03],
            [side * 0.115, 0.11, 0.02],
            [side * 0.112, -0.05, -0.01],
          ],
          0.026,
          14,
          8
        ),
        mats.hair
      );
    }
  } else if (variant === "navigator") {
    for (let i = -3; i <= 3; i++) {
      addMesh(
        root,
        `nav_sweep_${i}`,
        makeTube(
          [
            [i * 0.022, 0.225, 0.075],
            [i * 0.026, 0.265, 0.01],
            [i * 0.028, 0.21, -0.095],
          ],
          0.024 - Math.abs(i) * 0.002,
          14,
          8
        ),
        mats.hair
      );
    }
  } else if (variant === "royal_bun") {
    // Braided halo + ornate twin crown chignon
    addMesh(root, "halo_braid", new THREE.TorusGeometry(0.105, 0.02, 12, 28), mats.hair, [0, 0.205, -0.005], [Math.PI / 2 - 0.18, 0, 0]);
    addMesh(root, "royal_chignon", new THREE.SphereGeometry(0.068, 18, 14), mats.hair, [0, 0.268, -0.035], [0, 0, 0], [1.1, 0.95, 1.0]);
    addMesh(root, "royal_nape_roll", new THREE.CapsuleGeometry(0.032, 0.085, 6, 12), mats.hair, [0, 0.08, -0.102], [0, 0, Math.PI / 2]);
  }

  return root;
}

// ============================================================================
// 4. BEARDS (Relative to socket_head (0, 0.12, 0))
// ============================================================================

function buildBeard(variant) {
  const mats = createMaterials();
  const root = new THREE.Group();
  root.name = `beard_${variant}`;

  const addStache = (scale = 1) => {
    for (const side of [-1, 1]) {
      addMesh(
        root,
        `mustache_${side}`,
        makeTube(
          [
            [0, 0.082, 0.103],
            [side * 0.028 * scale, 0.081, 0.102],
            [side * 0.056 * scale, 0.074, 0.092],
            [side * 0.074 * scale, 0.083, 0.082],
          ],
          0.0115 * scale,
          12,
          8
        ),
        mats.hair
      );
    }
  };

  if (variant === "mustache") {
    addStache(1.15);
  } else if (variant === "goatee") {
    addStache(0.95);
    addMesh(
      root,
      "goatee_chin",
      makeLathe(
        [
          [0.003, -0.045],
          [0.026, -0.02],
          [0.036, 0.015],
          [0.032, 0.045],
          [0.005, 0.05],
        ],
        16
      ),
      mats.hair,
      [0, 0.01, 0.078],
      [-0.18, 0, 0],
      [1.05, 1, 0.7]
    );
  } else if (variant === "captain_trimmed") {
    addStache(1.0);
    addMesh(
      root,
      "jaw_strap",
      makeTube(
        [
          [-0.088, 0.095, 0.032],
          [-0.068, 0.032, 0.072],
          [0, 0.002, 0.095],
          [0.068, 0.032, 0.072],
          [0.088, 0.095, 0.032],
        ],
        0.022,
        18,
        10
      ),
      mats.hair
    );
  } else if (variant === "full") {
    addStache(1.05);
    addMesh(
      root,
      "full_beard_mass",
      makeLathe(
        [
          [0.005, -0.065],
          [0.055, -0.03],
          [0.082, 0.02],
          [0.094, 0.075],
          [0.06, 0.095],
          [0.01, 0.095],
        ],
        20
      ),
      mats.hair,
      [0, 0.005, 0.028],
      [-0.12, 0, 0],
      [1.0, 1, 0.92]
    );
  } else if (variant === "full_viking") {
    addStache(1.18);
    addMesh(
      root,
      "viking_cheek_wrap",
      makeTube(
        [
          [-0.095, 0.095, 0.035],
          [-0.075, 0.025, 0.085],
          [0, -0.01, 0.105],
          [0.075, 0.025, 0.085],
          [0.095, 0.095, 0.035],
        ],
        0.028,
        18,
        10
      ),
      mats.hair
    );
    for (const side of [-1, 1]) {
      addMesh(
        root,
        `viking_braid_${side}`,
        makeTube(
          [
            [side * 0.034, 0.01, 0.095],
            [side * 0.038, -0.05, 0.092],
            [side * 0.032, -0.105, 0.082],
          ],
          0.02,
          12,
          8
        ),
        mats.hair
      );
    }
  }

  return root;
}

// ============================================================================
// 5. OUTFITS (World space Y=0.78..1.43)
// ============================================================================

function buildOutfit(variant) {
  const mats = createMaterials();
  const root = new THREE.Group();
  root.name = `outfit_${variant}`;

  const isArmored = variant === "armor" || variant === "imperial_lord";
  const torsoMat = variant === "armor" ? mats.metal : mats.primary;

  // Main tailored torso garment
  const torsoGeo = makeLathe(
    [
      [0.01, 0.78],
      [0.185, 0.80],
      [0.142, 0.98],
      [0.168, 1.24],
      [0.172, 1.37],
      [0.088, 1.43],
      [0.01, 1.43],
    ],
    24
  );
  addMesh(root, "garment_torso", torsoGeo, torsoMat, [0, 0, 0], [0, 0, 0], [1.24, 1, 0.84]);

  // Sleeves wrapping upper arms
  for (const side of [-1, 1]) {
    addMesh(
      root,
      `sleeve_${side}`,
      new THREE.CapsuleGeometry(0.062, 0.22, 6, 12),
      mats.primary,
      [side * 0.27, 1.25, 0.02],
      [0, 0, side * 0.34]
    );
  }

  // Waist belt + metal buckle
  addMesh(root, "belt_strap", new THREE.CylinderGeometry(0.148, 0.152, 0.065, 22), mats.secondary, [0, 0.96, 0], [0, 0, 0], [1.22, 1, 0.86]);
  addMesh(root, "belt_buckle", new THREE.TorusGeometry(0.034, 0.011, 8, 16), mats.metal, [0, 0.96, 0.132]);

  if (variant === "settler") {
    // Cross-chest leather sash
    addMesh(
      root,
      "cross_strap",
      makeTube(
        [
          [-0.13, 1.40, 0.07],
          [0, 1.18, 0.142],
          [0.14, 0.97, 0.08],
        ],
        0.022,
        14,
        8
      ),
      mats.secondary
    );
  } else if (variant === "captain") {
    // Broad lapels + gold epaulets + brass buttons
    for (const side of [-1, 1]) {
      const lapel = new THREE.Shape();
      lapel.moveTo(0, 0);
      lapel.lineTo(side * 0.08, -0.05);
      lapel.lineTo(side * 0.04, -0.26);
      lapel.lineTo(0, -0.28);
      lapel.closePath();
      addMesh(root, `lapel_${side}`, makeBeveledShape(lapel, 0.018, 0.005, 0.005), mats.secondary, [side * 0.03, 1.38, 0.11], [0.16, 0, 0]);
      addMesh(root, `epaulet_${side}`, new THREE.CapsuleGeometry(0.036, 0.075, 6, 10), mats.metal, [side * 0.23, 1.41, 0.01], [0, 0, Math.PI / 2 - side * 0.15]);
    }
    for (let b = 0; b < 3; b++) {
      addMesh(root, `btn_${b}`, new THREE.SphereGeometry(0.013, 10, 8), mats.metal, [0, 1.07 + b * 0.08, 0.142]);
    }
  } else if (variant === "armor") {
    // Layered pauldrons + chest crest
    for (const side of [-1, 1]) {
      addMesh(
        root,
        `pauldron_${side}`,
        new THREE.SphereGeometry(0.088, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.6),
        mats.metal,
        [side * 0.24, 1.37, 0.01],
        [0, 0, -side * 0.35]
      );
    }
    addMesh(root, "chest_emblem", new THREE.OctahedronGeometry(0.048, 0), mats.secondary, [0, 1.24, 0.148], [0, 0, 0], [0.85, 1.2, 0.35]);
  } else if (variant === "merchant") {
    // Plush fur/velvet stole draping both sides of chest
    for (const side of [-1, 1]) {
      addMesh(
        root,
        `stole_${side}`,
        makeTube(
          [
            [side * 0.07, 1.43, -0.02],
            [side * 0.11, 1.36, 0.105],
            [side * 0.095, 1.08, 0.14],
            [side * 0.10, 0.82, 0.125],
          ],
          0.036,
          16,
          10
        ),
        mats.secondary
      );
    }
    addMesh(root, "merchant_medallion", new THREE.CylinderGeometry(0.036, 0.036, 0.014, 16), mats.metal, [0, 1.25, 0.148], [Math.PI / 2, 0, 0]);
  } else if (variant === "imperial_lord") {
    // High royal collar + ornate gold breastplate filigree + winged pauldrons
    addMesh(
      root,
      "high_collar",
      new THREE.CylinderGeometry(0.115, 0.098, 0.09, 20, 1, true, Math.PI * 0.35, Math.PI * 1.3),
      mats.secondary,
      [0, 1.44, -0.02]
    );
    for (const side of [-1, 1]) {
      addMesh(
        root,
        `imperial_pauldron_${side}`,
        new THREE.SphereGeometry(0.096, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.58),
        mats.metal,
        [side * 0.25, 1.38, 0.01],
        [0, 0, -side * 0.38]
      );
    }
    addMesh(
      root,
      "imperial_sash",
      makeTube(
        [
          [-0.14, 1.39, 0.08],
          [0, 1.18, 0.148],
          [0.145, 0.97, 0.09],
        ],
        0.026,
        14,
        8
      ),
      mats.secondary
    );
    addMesh(root, "imperial_crest", new THREE.OctahedronGeometry(0.056, 0), mats.metal, [0, 1.24, 0.154], [0, 0, 0], [0.9, 1.25, 0.4]);
  }

  if (isArmored) {
    // Tassets over hips
    for (const side of [-1, 1]) {
      addMesh(root, `tasset_${side}`, new THREE.CylinderGeometry(0.075, 0.092, 0.15, 8), mats.metal, [side * 0.135, 0.84, 0.03], [0, 0, side * 0.18], [1, 1, 0.72]);
    }
  }

  return root;
}

// ============================================================================
// 6. LEGS & BOOTS (World space Y=0..0.95)
// ============================================================================

function buildLegs(variant) {
  const mats = createMaterials();
  const root = new THREE.Group();
  root.name = `legs_${variant}`;

  for (const [side, sx] of [["l", 0.105], ["r", -0.105]]) {
    // Trousers thigh
    makeLimbBetween(root, `trouser_${side}`, [sx, 0.90, 0], [sx * 1.04, 0.46, 0.02], 0.088, 0.072, mats.primary);

    // Boot shaft
    const bootTopY = variant === "traveler" ? 0.34 : 0.46;
    makeLimbBetween(root, `boot_shaft_${side}`, [sx * 1.04, bootTopY, 0.015], [sx * 1.05, 0.07, -0.01], 0.072, 0.056, mats.secondary);

    // Boot foot resting cleanly on Y=0
    addMesh(
      root,
      `boot_foot_${side}`,
      new THREE.CapsuleGeometry(0.048, 0.11, 8, 14),
      mats.secondary,
      [sx * 1.05, 0.048, 0.042],
      [Math.PI / 2, 0, 0],
      [1.08, 1.0, 0.86]
    );

    if (variant === "traveler") {
      addMesh(root, `boot_buckle_${side}`, new THREE.TorusGeometry(0.016, 0.005, 6, 12), mats.metal, [sx * 1.04, 0.30, 0.075]);
    } else if (variant === "cuffed_boots") {
      addMesh(root, `boot_cuff_${side}`, new THREE.CylinderGeometry(0.088, 0.076, 0.08, 16), mats.secondary, [sx * 1.04, 0.45, 0.015]);
      addMesh(root, `cuff_buckle_${side}`, new THREE.TorusGeometry(0.018, 0.006, 6, 12), mats.metal, [sx * 1.04, 0.36, 0.075]);
    } else if (variant === "greaves" || variant === "royal_greaves") {
      addMesh(root, `knee_plate_${side}`, new THREE.SphereGeometry(0.068, 14, 12), mats.metal, [sx * 1.04, 0.47, 0.036], [0, 0, 0], [1, 1.15, 0.82]);
      addMesh(root, `shin_greave_${side}`, new THREE.CylinderGeometry(0.068, 0.052, 0.32, 14, 1, false, -Math.PI * 0.45, Math.PI * 0.9), mats.metal, [sx * 1.05, 0.25, 0.015]);
      if (variant === "royal_greaves") {
        addMesh(root, `royal_spur_${side}`, new THREE.ConeGeometry(0.022, 0.065, 8), mats.metal, [sx * 1.04, 0.51, 0.055], [-0.25, 0, 0]);
      }
    }
  }

  return root;
}

// ============================================================================
// 7. CAPES (World space Y=0.35..1.42, Z=-0.16)
// ============================================================================

function buildCape(variant) {
  const mats = createMaterials();
  const root = new THREE.Group();
  root.name = `cape_${variant}`;

  const topY = 1.41;
  const botY = variant === "traveler" ? 0.52 : variant === "navy_commander" ? 0.44 : 0.35;
  const botW = variant === "royal_mantle" ? 0.38 : 0.30;

  const capeShape = new THREE.Shape();
  capeShape.moveTo(-0.18, topY);
  capeShape.lineTo(0.18, topY);
  capeShape.quadraticCurveTo(botW * 0.92, (topY + botY) * 0.5, botW, botY);
  capeShape.quadraticCurveTo(0, botY - 0.06, -botW, botY);
  capeShape.quadraticCurveTo(-botW * 0.92, (topY + botY) * 0.5, -0.18, topY);
  capeShape.closePath();

  addMesh(
    root,
    "cape_cloth",
    makeBeveledShape(capeShape, 0.022, 0.008, 0.008),
    mats.primary,
    [0, 0, -0.16],
    [0.08, 0, 0]
  );

  // Secondary trim hem / collar drape
  addMesh(
    root,
    "cape_collar",
    new THREE.TorusGeometry(0.145, 0.028, 10, 22, Math.PI * 1.15),
    mats.secondary,
    [0, 1.39, -0.05],
    [Math.PI / 2 - 0.25, 0, Math.PI * 0.92]
  );

  // Twin shoulder clasps in mat_metal
  for (const side of [-1, 1]) {
    addMesh(root, `clasp_${side}`, new THREE.CylinderGeometry(0.026, 0.026, 0.014, 14), mats.metal, [side * 0.165, 1.39, -0.04], [Math.PI / 2, 0, 0]);
  }

  if (variant === "navy_commander" || variant === "royal_mantle") {
    addMesh(
      root,
      "shoulder_chain",
      makeTube(
        [
          [-0.16, 1.39, 0.02],
          [0, 1.32, 0.135],
          [0.16, 1.39, 0.02],
        ],
        0.008,
        14,
        6
      ),
      mats.metal
    );
  }

  return root;
}

// ============================================================================
// 8. HATS (Relative to socket_head, resting around (0, 0.22, 0))
// ============================================================================

function buildHat(variant) {
  const mats = createMaterials();
  const root = new THREE.Group();
  root.name = `hat_${variant}`;

  if (variant === "captain") {
    // Classic Tricorne
    addMesh(root, "tricorne_crown", new THREE.SphereGeometry(0.118, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), mats.primary, [0, 0.205, -0.005]);
    const brim = new THREE.Shape();
    for (let i = 0; i <= 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      const r = 0.205 + 0.055 * Math.cos(3 * a - Math.PI / 2);
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) brim.moveTo(x, y);
      else brim.lineTo(x, y);
    }
    brim.closePath();
    addMesh(root, "tricorne_brim", makeBeveledShape(brim, 0.016, 0.006, 0.006), mats.primary, [0, 0.215, -0.005], [Math.PI / 2, 0, 0]);
    addMesh(root, "tricorne_emblem", new THREE.CylinderGeometry(0.024, 0.024, 0.014, 16), mats.metal, [-0.08, 0.255, 0.095], [Math.PI / 2, 0, -0.4]);
  } else if (variant === "explorer") {
    addMesh(root, "explorer_brim", new THREE.CylinderGeometry(0.225, 0.235, 0.015, 28), mats.primary, [0, 0.215, 0]);
    addMesh(
      root,
      "explorer_crown",
      makeLathe(
        [
          [0.118, 0],
          [0.11, 0.075],
          [0.088, 0.115],
          [0.01, 0.112],
        ],
        22
      ),
      mats.primary,
      [0, 0.215, 0]
    );
    addMesh(root, "explorer_band", new THREE.CylinderGeometry(0.117, 0.121, 0.024, 24), mats.metal, [0, 0.23, 0]);
  } else if (variant === "bandana") {
    addMesh(root, "bandana_wrap", new THREE.SphereGeometry(0.117, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.56), mats.primary, [0, 0.165, -0.005], [-0.15, 0, 0]);
    addMesh(root, "bandana_knot", new THREE.SphereGeometry(0.026, 12, 10), mats.primary, [0.06, 0.19, -0.115]);
    addMesh(
      root,
      "bandana_tail",
      makeTube(
        [
          [0.06, 0.19, -0.115],
          [0.09, 0.13, -0.145],
          [0.11, 0.06, -0.155],
        ],
        0.016,
        10,
        8
      ),
      mats.primary
    );
    addMesh(root, "bandana_ring", new THREE.TorusGeometry(0.022, 0.005, 8, 16), mats.metal, [0.06, 0.18, -0.118], [0, 0.5, 0]);
  } else if (variant === "helm") {
    addMesh(root, "helm_dome", new THREE.SphereGeometry(0.128, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.62), mats.metal, [0, 0.175, -0.005]);
    addMesh(root, "helm_nasal", new THREE.BoxGeometry(0.022, 0.095, 0.02), mats.metal, [0, 0.165, 0.122]);
    addMesh(root, "helm_cheek_l", new THREE.BoxGeometry(0.02, 0.09, 0.075), mats.metal, [0.116, 0.125, 0.025], [0, 0, 0.12]);
    addMesh(root, "helm_cheek_r", new THREE.BoxGeometry(0.02, 0.09, 0.075), mats.metal, [-0.116, 0.125, 0.025], [0, 0, -0.12]);
    // Plume crest in mat_primary
    addMesh(
      root,
      "helm_plume",
      makeTube(
        [
          [0, 0.28, 0.075],
          [0, 0.345, 0.0],
          [0, 0.32, -0.095],
          [0, 0.24, -0.145],
        ],
        0.026,
        14,
        10
      ),
      mats.primary
    );
  } else if (variant === "crown_gold") {
    addMesh(root, "crown_velvet", new THREE.SphereGeometry(0.106, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.45), mats.primary, [0, 0.215, 0]);
    addMesh(root, "crown_band", new THREE.CylinderGeometry(0.118, 0.112, 0.036, 24), mats.metal, [0, 0.228, 0]);
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const x = Math.sin(angle) * 0.115;
      const z = Math.cos(angle) * 0.115;
      addMesh(root, `crown_spire_${i}`, new THREE.ConeGeometry(0.018, 0.058, 6), mats.metal, [x, 0.272, z]);
    }
  } else if (variant === "admiral_bicorne") {
    const crescent = new THREE.Shape();
    crescent.moveTo(-0.24, 0);
    crescent.quadraticCurveTo(0, 0.15, 0.24, 0);
    crescent.quadraticCurveTo(0, 0.03, -0.24, 0);
    crescent.closePath();
    addMesh(root, "bicorne_crest", makeBeveledShape(crescent, 0.065, 0.012, 0.012), mats.primary, [0, 0.215, -0.032]);
    addMesh(root, "bicorne_cockade", new THREE.CylinderGeometry(0.03, 0.03, 0.018, 16), mats.metal, [0, 0.275, 0.048], [Math.PI / 2, 0, 0]);
  }

  return root;
}

// ============================================================================
// 9. PROPS_HAND (Grip at (0,0,0) for socket_hand_r (-0.36, 0.88, 0.12))
// ============================================================================

function buildHandProp(variant) {
  const mats = createMaterials();
  const root = new THREE.Group();
  root.name = `handprop_${variant}`;

  if (variant === "spyglass") {
    addMesh(
      root,
      "spyglass_barrel",
      makeLathe(
        [
          [0.018, -0.04],
          [0.022, 0.06],
          [0.026, 0.065],
          [0.026, 0.15],
          [0.032, 0.155],
          [0.032, 0.24],
          [0.005, 0.24],
        ],
        20
      ),
      mats.metal,
      [0, 0, 0],
      [Math.PI / 2.6, 0, 0]
    );
    addMesh(root, "spyglass_grip", new THREE.CylinderGeometry(0.024, 0.024, 0.09, 18), mats.secondary, [0, 0.03, 0.04], [Math.PI / 2.6, 0, 0]);
  } else if (variant === "scroll") {
    addMesh(root, "scroll_paper", new THREE.CylinderGeometry(0.032, 0.032, 0.28, 18), mats.secondary, [0, 0.04, 0.06], [0.45, 0, 0.2]);
    addMesh(root, "scroll_band", new THREE.CylinderGeometry(0.0345, 0.0345, 0.03, 18), mats.metal, [0, 0.04, 0.06], [0.45, 0, 0.2]);
  } else if (variant === "royal_scepter") {
    addMesh(root, "scepter_shaft", new THREE.CylinderGeometry(0.015, 0.013, 0.68, 14), mats.secondary, [0, 0.18, 0.04], [0.22, 0, 0]);
    addMesh(root, "scepter_orb", new THREE.SphereGeometry(0.048, 18, 14), mats.metal, [0, 0.51, 0.115]);
    addMesh(root, "scepter_finial", new THREE.OctahedronGeometry(0.036, 0), mats.metal, [0, 0.585, 0.132]);
  } else if (variant === "sun_rapier") {
    addMesh(root, "rapier_grip", new THREE.CylinderGeometry(0.014, 0.014, 0.13, 12), mats.secondary, [0, 0, 0], [0.35, 0, 0]);
    addMesh(root, "rapier_pommel", new THREE.SphereGeometry(0.022, 12, 10), mats.metal, [0, -0.07, -0.026]);
    addMesh(root, "rapier_guard", new THREE.TorusGeometry(0.046, 0.008, 8, 18), mats.metal, [0, 0.062, 0.022], [Math.PI / 2 + 0.35, 0, 0]);
    addMesh(root, "rapier_blade", new THREE.ConeGeometry(0.018, 0.72, 4), mats.metal, [0, 0.40, 0.145], [0.35, Math.PI / 4, 0]);
  }

  return root;
}

// ============================================================================
// 10. PROPS_BACK (Origin (0,0,0) for socket_back (0, 1.15, -0.17))
// ============================================================================

function buildBackProp(variant) {
  const mats = createMaterials();
  const root = new THREE.Group();
  root.name = `backprop_${variant}`;

  if (variant === "explorer_pack") {
    addMesh(root, "pack_body", new THREE.CapsuleGeometry(0.115, 0.16, 8, 14), mats.primary, [0, 0, -0.06], [0, 0, 0], [1.15, 1, 0.72]);
    addMesh(root, "pack_bedroll", new THREE.CylinderGeometry(0.052, 0.052, 0.32, 16), mats.secondary, [0, 0.19, -0.06], [0, 0, Math.PI / 2]);
    addMesh(root, "pack_buckle", new THREE.BoxGeometry(0.045, 0.045, 0.02), mats.metal, [0, 0.03, -0.14]);
  } else if (variant === "sheathed_sword") {
    addMesh(root, "scabbard", new THREE.CylinderGeometry(0.022, 0.014, 0.78, 10), mats.secondary, [0, -0.04, -0.04], [0, 0, -0.58]);
    addMesh(root, "baldric", new THREE.TorusGeometry(0.19, 0.016, 8, 22), mats.primary, [0, 0.02, 0.11], [0.15, 0.55, 0.55]);
    addMesh(root, "sword_hilt", new THREE.CylinderGeometry(0.014, 0.014, 0.18, 10), mats.metal, [-0.24, 0.31, -0.04], [0, 0, -0.58]);
    addMesh(root, "sword_guard", new THREE.BoxGeometry(0.14, 0.018, 0.024), mats.metal, [-0.195, 0.245, -0.04], [0, 0, -0.58]);
  } else if (variant === "imperial_shield") {
    const shieldShape = new THREE.Shape();
    shieldShape.moveTo(-0.18, 0.22);
    shieldShape.lineTo(0.18, 0.22);
    shieldShape.lineTo(0.17, -0.04);
    shieldShape.quadraticCurveTo(0.12, -0.22, 0, -0.30);
    shieldShape.quadraticCurveTo(-0.12, -0.22, -0.17, -0.04);
    shieldShape.closePath();
    addMesh(root, "shield_face", makeBeveledShape(shieldShape, 0.025, 0.012, 0.012), mats.primary, [0, 0, -0.04]);
    addMesh(root, "shield_inlay", new THREE.CylinderGeometry(0.085, 0.085, 0.032, 6), mats.secondary, [0, 0.02, -0.045], [Math.PI / 2, 0, 0]);
    addMesh(root, "shield_boss", new THREE.SphereGeometry(0.042, 16, 12), mats.metal, [0, 0.02, -0.055], [0, 0, 0], [1, 1, 0.65]);
  }

  return root;
}

// ============================================================================
// 11. PETS (Claws at (0,0,0) for socket_shoulder_l (0.27, 1.41, 0.01))
// ============================================================================

function buildPet(variant) {
  const mats = createMaterials();
  const root = new THREE.Group();
  root.name = `pet_${variant}`;

  // Talons gripping shoulder at (0,0,0)
  for (const side of [-1, 1]) {
    addMesh(root, `talon_${side}`, new THREE.CylinderGeometry(0.008, 0.012, 0.03, 8), mats.metal, [side * 0.024, 0.015, 0.01]);
  }

  const bodyScale = variant === "owl" ? [1.08, 1.0, 1.0] : variant === "parrot" ? [0.92, 1.15, 0.92] : [0.96, 1.12, 0.96];
  addMesh(root, "pet_torso", new THREE.SphereGeometry(0.058, 16, 14), mats.primary, [0, 0.082, 0], [0.22, 0, 0], bodyScale);
  addMesh(root, "pet_head", new THREE.SphereGeometry(0.042, 16, 12), mats.primary, [0, 0.155, 0.024]);

  // Folded wings
  for (const side of [-1, 1]) {
    addMesh(root, `pet_wing_${side}`, new THREE.SphereGeometry(0.046, 12, 10), mats.secondary, [side * 0.048, 0.085, -0.008], [0.25, 0, side * 0.18], [0.42, 1.3, 0.85]);
  }

  // Tail feathers
  const tailLen = variant === "parrot" ? 0.18 : 0.11;
  addMesh(root, "pet_tail", new THREE.ConeGeometry(0.026, tailLen, 8), mats.secondary, [0, 0.015, -0.068], [-2.4, 0, 0]);

  // Beak & eyes
  addMesh(root, "pet_beak", new THREE.ConeGeometry(0.014, 0.036, 8), mats.metal, [0, 0.152, 0.068], [Math.PI / 2 + 0.2, 0, 0]);
  for (const side of [-1, 1]) {
    addMesh(root, `pet_eye_${side}`, new THREE.SphereGeometry(0.008, 8, 8), mats.pupil, [side * 0.022, 0.165, 0.054]);
  }

  if (variant === "owl") {
    for (const side of [-1, 1]) {
      addMesh(root, `owl_tuft_${side}`, new THREE.ConeGeometry(0.013, 0.034, 6), mats.secondary, [side * 0.026, 0.195, 0.02], [0, 0, -side * 0.35]);
    }
  } else if (variant === "parrot") {
    addMesh(root, "parrot_crest", new THREE.ConeGeometry(0.015, 0.048, 8), mats.secondary, [0, 0.205, 0.01], [-0.45, 0, 0]);
  }

  return root;
}

// ============================================================================
// 12. MOUNTS (World space standing behind-right at X=0.42, Y=0, Z=-0.42)
// ============================================================================

function buildMount(variant) {
  const mats = createMaterials();
  const root = new THREE.Group();
  root.name = `mount_${variant}`;

  const anchor = new THREE.Group();
  anchor.name = "mount_anchor";
  anchor.position.set(0.42, 0, -0.42);
  anchor.rotation.set(0, -0.28, 0);
  root.add(anchor);

  const isWolf = variant === "snow_wolf";
  const bodyY = isWolf ? 0.62 : 0.92;
  const legR = isWolf ? 0.062 : 0.058;

  // Barrel torso
  addMesh(anchor, "mount_body", new THREE.CapsuleGeometry(0.24, 0.56, 10, 18), mats.mount, [0, bodyY, 0], [Math.PI / 2, 0, 0], [0.95, 1.0, 1.08]);

  // 4 sculpted legs resting cleanly at local Y=0
  const legCoords = [
    [-0.14, 0.24],
    [0.14, 0.24],
    [-0.14, -0.24],
    [0.14, -0.24],
  ];
  legCoords.forEach(([lx, lz], i) => {
    makeLimbBetween(anchor, `mount_leg_${i}`, [lx, bodyY - 0.1, lz], [lx, 0.05, lz], legR * 1.25, legR * 0.85, mats.mount);
    addMesh(anchor, `mount_hoof_${i}`, new THREE.CylinderGeometry(legR * 0.9, legR * 1.05, 0.06, 12), mats.secondary, [lx, 0.03, lz]);
  });

  // Neck + sculpted head
  const neckTop = isWolf ? [0, 0.82, 0.42] : [0, 1.38, 0.36];
  makeLimbBetween(anchor, "mount_neck", [0, bodyY + 0.06, 0.22], neckTop, 0.15, 0.115, mats.mount);
  addMesh(anchor, "mount_head", new THREE.CapsuleGeometry(0.095, 0.20, 8, 14), mats.mount, [0, neckTop[1] + 0.04, neckTop[2] + 0.10], [1.15, 0, 0]);

  // Mane / ruff + tail
  addMesh(anchor, "mount_mane", new THREE.CapsuleGeometry(0.09, 0.26, 6, 12), mats.secondary, [0, (bodyY + neckTop[1]) * 0.5 + 0.08, 0.24], [-0.4, 0, 0]);
  addMesh(
    anchor,
    "mount_tail",
    makeTube(
      [
        [0, bodyY + 0.05, -0.34],
        [0, bodyY - 0.15, -0.48],
        [0, bodyY - 0.38, -0.52],
      ],
      isWolf ? 0.065 : 0.048,
      12,
      8
    ),
    mats.secondary
  );

  // Saddle & armor trim
  addMesh(anchor, "mount_saddle", new THREE.BoxGeometry(0.36, 0.08, 0.34), mats.secondary, [0, bodyY + 0.22, 0]);
  addMesh(anchor, "mount_chamfron", new THREE.ConeGeometry(0.09, 0.18, 6), mats.metal, [0, neckTop[1] + 0.09, neckTop[2] + 0.16], [1.1, 0, 0]);

  if (variant === "royal_stag") {
    for (const side of [-1, 1]) {
      addMesh(
        anchor,
        `antler_main_${side}`,
        makeTube(
          [
            [side * 0.04, neckTop[1] + 0.14, neckTop[2] + 0.05],
            [side * 0.18, neckTop[1] + 0.32, neckTop[2] - 0.02],
            [side * 0.26, neckTop[1] + 0.52, neckTop[2] + 0.04],
          ],
          0.018,
          12,
          8
        ),
        mats.metal
      );
      addMesh(
        anchor,
        `antler_tine_${side}`,
        makeTube(
          [
            [side * 0.16, neckTop[1] + 0.30, neckTop[2] - 0.01],
            [side * 0.14, neckTop[1] + 0.44, neckTop[2] + 0.14],
          ],
          0.014,
          8,
          6
        ),
        mats.metal
      );
    }
  } else if (variant === "imperial_griffin") {
    // Sweeping feathered wings + eagle beak
    addMesh(anchor, "griffin_beak", new THREE.ConeGeometry(0.055, 0.14, 8), mats.metal, [0, neckTop[1] + 0.01, neckTop[2] + 0.26], [Math.PI / 2 + 0.3, 0, 0]);
    for (const side of [-1, 1]) {
      const wingShape = new THREE.Shape();
      wingShape.moveTo(0, 0);
      wingShape.quadraticCurveTo(0.26, 0.44, 0.55, 0.52);
      wingShape.lineTo(0.42, 0.12);
      wingShape.quadraticCurveTo(0.22, -0.05, 0, -0.08);
      wingShape.closePath();
      addMesh(
        anchor,
        `griffin_wing_${side}`,
        makeBeveledShape(wingShape, 0.03, 0.01, 0.01),
        mats.secondary,
        [side * 0.20, bodyY + 0.14, 0.06],
        [0.15, side * -0.45, side > 0 ? 0.18 : Math.PI - 0.18],
        [1, side > 0 ? 1 : -1, 1]
      );
    }
  }

  return root;
}

// ============================================================================
// 13. PEDESTALS (World space Y=-0.16..0, radius ~0.85, top surface at Y=0)
// ============================================================================

function buildPedestal(variant) {
  const mats = createMaterials();
  const root = new THREE.Group();
  root.name = `pedestal_${variant}`;

  // Lower tier (-0.16 .. -0.07) and upper tier (-0.07 .. 0.0)
  addMesh(root, "plinth_base", new THREE.CylinderGeometry(0.82, 0.88, 0.09, 6), mats.secondary, [0, -0.115, 0]);
  addMesh(root, "plinth_top", new THREE.CylinderGeometry(0.72, 0.78, 0.07, 6), mats.secondary, [0, -0.035, 0]);
  addMesh(root, "plinth_trim_ring", new THREE.TorusGeometry(0.75, 0.018, 8, 6), mats.metal, [0, -0.005, 0], [Math.PI / 2, 0, Math.PI / 6]);

  if (variant === "runic_gold" || variant === "obsidian_crown") {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      const px = Math.cos(a) * 0.78;
      const pz = Math.sin(a) * 0.78;
      addMesh(
        root,
        `corner_stud_${i}`,
        variant === "obsidian_crown" ? new THREE.ConeGeometry(0.05, 0.12, 6) : new THREE.CylinderGeometry(0.045, 0.055, 0.09, 6),
        mats.metal,
        [px, variant === "obsidian_crown" ? 0.04 : -0.03, pz]
      );
    }
  }

  return root;
}

// ============================================================================
// Build All 55 Starter Assets
// ============================================================================

function main() {
  const jobs = [
    ["bodies/athletic.glb", () => buildBody("athletic")],
    ["bodies/sturdy.glb", () => buildBody("sturdy")],
    ["bodies/slender.glb", () => buildBody("slender")],

    ["heads/oval.glb", () => buildHead("oval")],
    ["heads/square.glb", () => buildHead("square")],
    ["heads/heart.glb", () => buildHead("heart")],
    ["heads/chiseled.glb", () => buildHead("chiseled")],

    ["hair/short.glb", () => buildHair("short")],
    ["hair/wavy.glb", () => buildHair("wavy")],
    ["hair/bun.glb", () => buildHair("bun")],
    ["hair/braids.glb", () => buildHair("braids")],
    ["hair/curly.glb", () => buildHair("curly")],
    ["hair/long.glb", () => buildHair("long")],
    ["hair/navigator.glb", () => buildHair("navigator")],
    ["hair/royal_bun.glb", () => buildHair("royal_bun")],

    ["beards/goatee.glb", () => buildBeard("goatee")],
    ["beards/full.glb", () => buildBeard("full")],
    ["beards/mustache.glb", () => buildBeard("mustache")],
    ["beards/captain_trimmed.glb", () => buildBeard("captain_trimmed")],
    ["beards/full_viking.glb", () => buildBeard("full_viking")],

    ["outfits/settler.glb", () => buildOutfit("settler")],
    ["outfits/captain.glb", () => buildOutfit("captain")],
    ["outfits/armor.glb", () => buildOutfit("armor")],
    ["outfits/merchant.glb", () => buildOutfit("merchant")],
    ["outfits/imperial_lord.glb", () => buildOutfit("imperial_lord")],

    ["legs/traveler.glb", () => buildLegs("traveler")],
    ["legs/cuffed_boots.glb", () => buildLegs("cuffed_boots")],
    ["legs/greaves.glb", () => buildLegs("greaves")],
    ["legs/royal_greaves.glb", () => buildLegs("royal_greaves")],

    ["capes/traveler.glb", () => buildCape("traveler")],
    ["capes/navy_commander.glb", () => buildCape("navy_commander")],
    ["capes/royal_mantle.glb", () => buildCape("royal_mantle")],

    ["hats/captain.glb", () => buildHat("captain")],
    ["hats/explorer.glb", () => buildHat("explorer")],
    ["hats/bandana.glb", () => buildHat("bandana")],
    ["hats/helm.glb", () => buildHat("helm")],
    ["hats/crown_gold.glb", () => buildHat("crown_gold")],
    ["hats/admiral_bicorne.glb", () => buildHat("admiral_bicorne")],

    ["props_hand/spyglass.glb", () => buildHandProp("spyglass")],
    ["props_hand/scroll.glb", () => buildHandProp("scroll")],
    ["props_hand/royal_scepter.glb", () => buildHandProp("royal_scepter")],
    ["props_hand/sun_rapier.glb", () => buildHandProp("sun_rapier")],

    ["props_back/explorer_pack.glb", () => buildBackProp("explorer_pack")],
    ["props_back/sheathed_sword.glb", () => buildBackProp("sheathed_sword")],
    ["props_back/imperial_shield.glb", () => buildBackProp("imperial_shield")],

    ["pets/owl.glb", () => buildPet("owl")],
    ["pets/parrot.glb", () => buildPet("parrot")],
    ["pets/falcon.glb", () => buildPet("falcon")],

    ["mounts/island_horse.glb", () => buildMount("island_horse")],
    ["mounts/snow_wolf.glb", () => buildMount("snow_wolf")],
    ["mounts/royal_stag.glb", () => buildMount("royal_stag")],
    ["mounts/imperial_griffin.glb", () => buildMount("imperial_griffin")],

    ["pedestals/stone_wood.glb", () => buildPedestal("stone_wood")],
    ["pedestals/runic_gold.glb", () => buildPedestal("runic_gold")],
    ["pedestals/obsidian_crown.glb", () => buildPedestal("obsidian_crown")],
  ];

  let totalBytes = 0;
  for (const [relPath, builder] of jobs) {
    const group = builder();
    const bytes = writeGlb(relPath, group);
    totalBytes += bytes;
  }

  console.log(
    `[build_starter_3d_assets] Built ${jobs.length} starter .glb assets (${(totalBytes / 1024).toFixed(1)} KB total) under ${MODELS_ROOT}`
  );
}

main();
