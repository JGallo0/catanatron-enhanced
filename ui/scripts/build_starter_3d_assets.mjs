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
      mode: 4,
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
      generator: "rule-the-isle-starter-3d-builder-v2",
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

  const binBuffer = Buffer.concat(
    binChunks.map((c) => Buffer.from(c.buffer, c.byteOffset, c.byteLength))
  );
  const totalLength = 12 + 8 + jsonChunk.length + 8 + binBuffer.length;

  const glb = Buffer.alloc(totalLength);
  let offset = 0;

  glb.write("glTF", offset, 4, "ascii");
  offset += 4;
  glb.writeUInt32LE(2, offset);
  offset += 4;
  glb.writeUInt32LE(totalLength, offset);
  offset += 4;

  glb.writeUInt32LE(jsonChunk.length, offset);
  offset += 4;
  glb.writeUInt32LE(0x4e4f534a, offset);
  offset += 4;
  jsonChunk.copy(glb, offset);
  offset += jsonChunk.length;

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
    metalness: opts.metalness ?? 0.05,
    side: opts.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
  });
}

function createMaterials() {
  return {
    skin: makeMat("mat_skin", 0xe4b287, { roughness: 0.54, metalness: 0.02 }),
    hair: makeMat("mat_hair", 0x432316, { roughness: 0.72, metalness: 0.04 }),
    eyes: makeMat("mat_eyes", 0x0284c7, { roughness: 0.25, metalness: 0.05 }),
    sclera: makeMat("mat_sclera", 0xf8fafc, { roughness: 0.3, metalness: 0.0 }),
    pupil: makeMat("mat_pupil", 0x0f172a, { roughness: 0.2, metalness: 0.05 }),
    primary: makeMat("mat_primary", 0x1d4ed8, { roughness: 0.64, metalness: 0.04, doubleSided: true }),
    secondary: makeMat("mat_secondary", 0x991b1b, { roughness: 0.68, metalness: 0.05, doubleSided: true }),
    metal: makeMat("mat_metal", 0xfacc15, { roughness: 0.26, metalness: 0.84 }),
    mount: makeMat("mat_mount", 0xd6d3d1, { roughness: 0.64, metalness: 0.08 }),
    backpack: makeMat("mat_backpack", 0x92400e, { roughness: 0.66, metalness: 0.04, doubleSided: true }),
    darkDetail: makeMat("mat_dark_fixed", 0x1e1b18, { roughness: 0.52, metalness: 0.08 }),
    ivoryDetail: makeMat("mat_ivory_fixed", 0xf1ebd8, { roughness: 0.45, metalness: 0.04 }),
  };
}

// ============================================================================
// Organic Sculpting & Skeleton Helpers
// ============================================================================

function addGroup(parent, name, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(pos[0], pos[1], pos[2]);
  g.rotation.set(rot[0], rot[1], rot[2]);
  g.scale.set(scale[0], scale[1], scale[2]);
  parent.add(g);
  return g;
}

function addMesh(parent, name, geometry, material, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) {
  const m = new THREE.Mesh(geometry, material);
  m.name = name;
  m.position.set(pos[0], pos[1], pos[2]);
  m.rotation.set(rot[0], rot[1], rot[2]);
  m.scale.set(scale[0], scale[1], scale[2]);
  parent.add(m);
  return m;
}

function makeLathe(points, segments = 22) {
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
  const curve = new THREE.CatmullRomCurve3(
    points.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    closed
  );
  return new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, closed);
}

/**
 * Custom Cross-Sectional Anatomical Lofter.
 * Creates realistic non-circular, contoured 3D meshes along Y with harmonics:
 * - squircle: 0 = ellipse, >0 = broad shoulders/chest/boots
 * - chestCrease / spineGroove: sternum or dorsal furrow
 * - frontBulge / backFlat / sideFlat: pectoral / occiput / jaw flatness
 * - foldFreq / foldAmp: cloth pleats & tunic hem drapes
 * - customDeform(theta, ring): optional custom radial multiplier
 */
function makeLoftedSection(rings, radialSegs = 28, opts = {}) {
  const capBottom = opts.capBottom !== false;
  const capTop = opts.capTop !== false;
  const isDescending =
    rings.length > 1 && rings[rings.length - 1].y < rings[0].y;
  const orderedRings = isDescending ? [...rings].reverse() : rings;

  const positions = [];
  const uvs = [];
  const indices = [];

  const rowStride = radialSegs + 1;

  for (let r = 0; r < orderedRings.length; r++) {
    const ring = orderedRings[r];
    const v = orderedRings.length > 1 ? r / (orderedRings.length - 1) : 0;
    const rx = ring.rx ?? 0.1;
    const rz = ring.rz ?? rx;
    const cx = ring.cx ?? 0;
    const cz = ring.cz ?? 0;
    const squircle = ring.squircle ?? 0;
    const frontBulge = ring.frontBulge ?? 0;
    const backFlat = ring.backFlat ?? 0;
    const pecSplit = ring.pecSplit ?? 0;
    const foldFreq = ring.foldFreq ?? 0;
    const foldAmp = ring.foldAmp ?? 0;
    const foldPhase = ring.foldPhase ?? 0;
    const pinchLats = ring.pinchLats ?? 0;

    for (let s = 0; s <= radialSegs; s++) {
      const u = s / radialSegs;
      const theta = u * Math.PI * 2;
      const sinT = Math.sin(theta); // +X = sin(theta) at pi/2
      const cosT = Math.cos(theta); // +Z = cos(theta) at 0

      // Super-elliptical shaping (squircle)
      let px = sinT;
      let pz = cosT;
      if (squircle !== 0) {
        const exp = Math.max(0.55, 1 - squircle * 0.42);
        px = Math.sign(px) * Math.pow(Math.abs(px), exp);
        pz = Math.sign(pz) * Math.pow(Math.abs(pz), exp);
      }

      let mulX = 1;
      let mulZ = 1;

      if (frontBulge !== 0 && cosT > 0) {
        mulZ += frontBulge * Math.pow(cosT, 1.4);
      }
      if (backFlat !== 0 && cosT < 0) {
        mulZ -= backFlat * Math.pow(-cosT, 1.5);
      }
      if (pecSplit !== 0 && cosT > 0.25) {
        const centerFactor = Math.exp(-Math.pow(sinT / 0.28, 2));
        const pecMound = Math.exp(-Math.pow((Math.abs(sinT) - 0.52) / 0.34, 2));
        mulZ += pecSplit * (pecMound * 0.14 - centerFactor * 0.11);
      }
      if (pinchLats !== 0 && cosT < 0.1) {
        const sideFactor = Math.abs(sinT);
        mulX += pinchLats * sideFactor * 0.1;
      }
      if (foldAmp !== 0 && foldFreq > 0) {
        const foldWave = Math.cos(theta * foldFreq + foldPhase);
        mulX += foldWave * foldAmp;
        mulZ += foldWave * foldAmp;
      }

      if (typeof ring.deform === "function") {
        const d = ring.deform(theta, cosT, sinT);
        if (d) {
          mulX *= d.mx ?? 1;
          mulZ *= d.mz ?? 1;
        }
      }

      positions.push(cx + px * rx * mulX, ring.y, cz + pz * rz * mulZ);
      uvs.push(u, v);
    }
  }

  for (let r = 0; r < orderedRings.length - 1; r++) {
    for (let s = 0; s < radialSegs; s++) {
      const a = r * rowStride + s;
      const b = a + rowStride;
      const c = b + 1;
      const d = a + 1;
      // Outward winding (+Z around Y axis)
      indices.push(a, d, b);
      indices.push(b, d, c);
    }
  }

  if (capBottom && orderedRings.length > 0 && (orderedRings[0].rx ?? 0) > 0.002) {
    const first = orderedRings[0];
    const centerIdx = positions.length / 3;
    positions.push(first.cx ?? 0, first.y, first.cz ?? 0);
    uvs.push(0.5, 0);
    for (let s = 0; s < radialSegs; s++) {
      // Outward -Y bottom normal
      indices.push(centerIdx, s + 1, s);
    }
  }

  if (
    capTop &&
    orderedRings.length > 0 &&
    (orderedRings[orderedRings.length - 1].rx ?? 0) > 0.002
  ) {
    const last = orderedRings[orderedRings.length - 1];
    const baseRow = (orderedRings.length - 1) * rowStride;
    const centerIdx = positions.length / 3;
    positions.push(last.cx ?? 0, last.y, last.cz ?? 0);
    uvs.push(0.5, 1);
    for (let s = 0; s < radialSegs; s++) {
      // Outward +Y top normal
      indices.push(centerIdx, baseRow + s, baseRow + s + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  // Weld wrap-seam vertex normals (s=0 & s=radialSegs) so no centerline shading crease appears on front +Z!
  const normAttr = geo.getAttribute("normal");
  for (let r = 0; r < orderedRings.length; r++) {
    const idx0 = r * rowStride;
    const idxLast = idx0 + radialSegs;
    const nx = normAttr.getX(idx0) + normAttr.getX(idxLast);
    const ny = normAttr.getY(idx0) + normAttr.getY(idxLast);
    const nz = normAttr.getZ(idx0) + normAttr.getZ(idxLast);
    const len = Math.hypot(nx, ny, nz) || 1;
    normAttr.setXYZ(idx0, nx / len, ny / len, nz / len);
    normAttr.setXYZ(idxLast, nx / len, ny / len, nz / len);
  }
  normAttr.needsUpdate = true;

  return geo;
}

/**
 * Builds a closed, variable-radius curved mesh along 3D stations [{ pos: [x,y,z], rx, rz }]
 * with outward end caps — eliminating hollow TubeGeometry open pipe ends on necks, tails, beaks, and antlers!
 */
function makeTaperedCurvedTube(stations, radialSegs = 14) {
  const pts = stations.map((s) => new THREE.Vector3(...s.pos));
  const curve = new THREE.CatmullRomCurve3(pts, false);
  const segCount = Math.max(stations.length * 4, 12);
  const frames = curve.computeFrenetFrames(segCount, false);
  const rowStride = radialSegs + 1;

  const lerpVal = (t, key, fallbackKey) => {
    const fIdx = t * (stations.length - 1);
    const i0 = Math.min(stations.length - 1, Math.floor(fIdx));
    const i1 = Math.min(stations.length - 1, i0 + 1);
    const alpha = fIdx - i0;
    const v0 = stations[i0][key] ?? stations[i0][fallbackKey] ?? 0.03;
    const v1 = stations[i1][key] ?? stations[i1][fallbackKey] ?? 0.03;
    return v0 + (v1 - v0) * alpha;
  };

  const positions = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= segCount; i++) {
    const t = i / segCount;
    const p = curve.getPointAt(t);
    const N = frames.normals[i];
    const B = frames.binormals[i];
    const rx = lerpVal(t, "rx", "r");
    const rz = lerpVal(t, "rz", "rx");

    for (let j = 0; j <= radialSegs; j++) {
      const theta = (j / radialSegs) * Math.PI * 2;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);
      const vx = p.x + N.x * (cosT * rx) + B.x * (sinT * rz);
      const vy = p.y + N.y * (cosT * rx) + B.y * (sinT * rz);
      const vz = p.z + N.z * (cosT * rx) + B.z * (sinT * rz);
      positions.push(vx, vy, vz);
      uvs.push(j / radialSegs, t);
    }
  }

  for (let i = 0; i < segCount; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = i * rowStride + j;
      const b = a + rowStride;
      const c = b + 1;
      const d = a + 1;
      // Outward winding around tangent +T (det(N,B,T) = +1 => (d-a) x (b-a) = B x T = +N)
      indices.push(a, d, b);
      indices.push(b, d, c);
    }
  }

  // Start cap (outward normal -T)
  const p0 = curve.getPointAt(0);
  const startCenter = positions.length / 3;
  positions.push(p0.x, p0.y, p0.z);
  uvs.push(0.5, 0);
  for (let j = 0; j < radialSegs; j++) {
    indices.push(startCenter, j + 1, j);
  }

  // End cap (outward normal +T)
  const p1 = curve.getPointAt(1);
  const endBase = segCount * rowStride;
  const endCenter = positions.length / 3;
  positions.push(p1.x, p1.y, p1.z);
  uvs.push(0.5, 1);
  for (let j = 0; j < radialSegs; j++) {
    indices.push(endCenter, endBase + j, endBase + j + 1);
  }

  // Verify closed signed volume > 0; if Frenet orientation flipped, reverse triangle winding
  let signedVol = 0;
  for (let tIdx = 0; tIdx < indices.length; tIdx += 3) {
    const ia = indices[tIdx] * 3;
    const ib = indices[tIdx + 1] * 3;
    const ic = indices[tIdx + 2] * 3;
    const ax = positions[ia], ay = positions[ia + 1], az = positions[ia + 2];
    const bx = positions[ib], by = positions[ib + 1], bz = positions[ib + 2];
    const cx = positions[ic], cy = positions[ic + 1], cz = positions[ic + 2];
    signedVol +=
      (ax * (by * cz - bz * cy) +
        ay * (bz * cx - bx * cz) +
        az * (bx * cy - by * cx)) /
      6.0;
  }
  if (signedVol < 0) {
    for (let tIdx = 0; tIdx < indices.length; tIdx += 3) {
      const tmp = indices[tIdx + 1];
      indices[tIdx + 1] = indices[tIdx + 2];
      indices[tIdx + 2] = tmp;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const normAttr = geo.getAttribute("normal");
  for (let i = 0; i <= segCount; i++) {
    const idx0 = i * rowStride;
    const idxLast = idx0 + radialSegs;
    const nx = normAttr.getX(idx0) + normAttr.getX(idxLast);
    const ny = normAttr.getY(idx0) + normAttr.getY(idxLast);
    const nz = normAttr.getZ(idx0) + normAttr.getZ(idxLast);
    const len = Math.hypot(nx, ny, nz) || 1;
    normAttr.setXYZ(idx0, nx / len, ny / len, nz / len);
    normAttr.setXYZ(idxLast, nx / len, ny / len, nz / len);
  }
  normAttr.needsUpdate = true;

  return geo;
}

/**
 * Adds a detailed Parrot-grade layered animal eye (brow lid + white sclera + colored iris + pupil + glint).
 */
function addExpressiveAnimalEye(
  parent,
  namePrefix,
  pos,
  yawRad,
  mats,
  opts = {}
) {
  const scale = opts.scale ?? 1.0;
  const irisMat = opts.irisMat ?? mats.eyes;
  const browMat = opts.browMat ?? mats.mount;
  const g = addGroup(parent, namePrefix, pos, [0, yawRad, opts.tiltZ ?? 0]);
  // Brow hood / upper eyelid
  addMesh(
    g,
    `${namePrefix}_brow`,
    new THREE.SphereGeometry(0.022 * scale, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
    browMat,
    [0, 0.004 * scale, -0.002 * scale],
    [-0.18, 0, 0],
    [1.15, 0.78, 0.92]
  );
  // White sclera
  addMesh(
    g,
    `${namePrefix}_sclera`,
    new THREE.SphereGeometry(0.018 * scale, 12, 10),
    mats.sclera,
    [0, 0, 0],
    [0, 0, 0],
    [1.15, 0.88, 0.65]
  );
  // Colored iris
  addMesh(
    g,
    `${namePrefix}_iris`,
    new THREE.SphereGeometry(0.0125 * scale, 10, 8),
    irisMat,
    [0, -0.001 * scale, 0.007 * scale],
    [0, 0, 0],
    [1.0, 1.0, 0.58]
  );
  // Dark pupil
  addMesh(
    g,
    `${namePrefix}_pupil`,
    new THREE.SphereGeometry(0.0078 * scale, 8, 8),
    mats.pupil,
    [0, -0.001 * scale, 0.0105 * scale],
    [0, 0, 0],
    [1.0, 1.0, 0.55]
  );
  // Specular catchlight glint
  addMesh(
    g,
    `${namePrefix}_glint`,
    new THREE.SphereGeometry(0.0032 * scale, 6, 6),
    mats.ivoryDetail,
    [0.0045 * scale, 0.0042 * scale, 0.0125 * scale]
  );
  return g;
}

/**
 * Builds an anatomical lofted limb starting at local (0,0,0) and ending at `endVec`.
 * Ensures clean rotation from the joint pivot!
 */
function buildContouredBoneLimb(endVec, stations, mat, name, radialSegs = 18) {
  const end = new THREE.Vector3(...endVec);
  const len = end.length();
  const rings = stations.map((st) => ({
    y: st.t * len,
    rx: st.rx,
    rz: st.rz ?? st.rx,
    cx: st.cx ?? 0,
    cz: st.cz ?? 0,
    frontBulge: st.frontBulge ?? 0,
    backFlat: st.backFlat ?? 0,
    squircle: st.squircle ?? 0.15,
  }));

  const geo = makeLoftedSection(rings, radialSegs);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = name;
  if (len > 1e-5) {
    const dir = end.clone().normalize();
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  }
  return mesh;
}

/**
 * Builds a truly sculpted 5-finger anatomical hand rooted at wrist (0,0,0),
 * extending down along -Y toward fingertips (~ -0.155m).
 * Supports both relaxed natural curl ("relaxed") and closed prop/rein curl ("grip").
 */
function buildSculptedHandGroup(side, mat, thickness = 1.0, pose = "relaxed") {
  // side: +1 = left hand (+X outer thumb on inner side = -X in +Y-up/+Z-front)
  const handGroup = new THREE.Group();
  handGroup.name = side > 0 ? "sculpted_hand_l" : "sculpted_hand_r";
  const thumbDir = -side; // thumb is on medial/anterior side (pointing inward + forward)
  const curlMul = pose === "grip" ? 1.85 : 1.0;

  // Wrist collar
  const palm = addMesh(
    handGroup,
    `palm_${side > 0 ? "l" : "r"}`,
    makeLoftedSection(
      [
        { y: 0.015, rx: 0.026 * thickness, rz: 0.018 * thickness, squircle: 0.4 },
        { y: -0.020, rx: 0.032 * thickness, rz: 0.019 * thickness, squircle: 0.45 },
        { y: -0.062, rx: 0.038 * thickness, rz: 0.018 * thickness, squircle: 0.55 },
        { y: -0.088, rx: 0.036 * thickness, rz: 0.015 * thickness, squircle: 0.5 },
      ],
      16
    ),
    mat,
    [0, 0, 0]
  );
  palm.rotation.y = side > 0 ? -0.18 : 0.18;

  // Sculpted thumb (basal metacarpal + proximal + distal phalanx)
  const thumbBase = addGroup(
    handGroup,
    `thumb_${side > 0 ? "l" : "r"}`,
    [thumbDir * 0.030 * thickness, -0.032, 0.013 * thickness],
    [0.24 * curlMul, thumbDir * -0.32, thumbDir * 0.52]
  );
  addMesh(
    thumbBase,
    "thumb_phalanx_1",
    makeLoftedSection(
      [
        { y: 0.005, rx: 0.0125 * thickness, rz: 0.012 * thickness },
        { y: -0.032, rx: 0.0105 * thickness, rz: 0.010 * thickness },
      ],
      10
    ),
    mat
  );
  const thumbTip = addGroup(thumbBase, "thumb_distal", [0, -0.030, 0], [0.35 * curlMul, 0, thumbDir * -0.18]);
  addMesh(
    thumbTip,
    "thumb_phalanx_2",
    makeLoftedSection(
      [
        { y: 0.003, rx: 0.010 * thickness, rz: 0.0095 * thickness },
        { y: -0.026, rx: 0.0072 * thickness, rz: 0.007 * thickness },
      ],
      10
    ),
    mat
  );

  // 4 Individual fingers (index, middle, ring, pinky) descending from knuckles
  const fingerDefs = [
    { name: "index", offset: 0.024, length: 0.068, radius: 0.0092, splayZ: -0.04, curlBase: 0.24 },
    { name: "middle", offset: 0.008, length: 0.074, radius: 0.0094, splayZ: 0.0, curlBase: 0.28 },
    { name: "ring", offset: -0.009, length: 0.068, radius: 0.0088, splayZ: 0.04, curlBase: 0.34 },
    { name: "pinky", offset: -0.025, length: 0.055, radius: 0.0078, splayZ: 0.09, curlBase: 0.42 },
  ];

  fingerDefs.forEach((f) => {
    const knuckleX = thumbDir * f.offset * thickness;
    const fBase = addGroup(
      handGroup,
      `finger_${f.name}`,
      [knuckleX, -0.084, 0.002],
      [f.curlBase * curlMul, 0, thumbDir * -f.splayZ]
    );
    const seg1 = f.length * 0.56;
    const seg2 = f.length * 0.44;
    addMesh(
      fBase,
      `${f.name}_prox`,
      makeLoftedSection(
        [
          { y: 0.004, rx: f.radius * thickness, rz: f.radius * 0.95 * thickness },
          { y: -seg1, rx: f.radius * 0.86 * thickness, rz: f.radius * 0.84 * thickness },
        ],
        8
      ),
      mat
    );
    const fMid = addGroup(fBase, `${f.name}_dist`, [0, -seg1 + 0.002, 0], [0.42 * curlMul, 0, 0]);
    addMesh(
      fMid,
      `${f.name}_tip`,
      makeLoftedSection(
        [
          { y: 0.003, rx: f.radius * 0.84 * thickness, rz: f.radius * 0.82 * thickness },
          { y: -seg2, rx: f.radius * 0.58 * thickness, rz: f.radius * 0.56 * thickness },
        ],
        8
      ),
      mat
    );
  });

  return handGroup;
}

// ============================================================================
// Canonical Articulated Skeleton Offsets (Shared by Bodies, Outfits & Legs!)
// ============================================================================

const RIG_OFFSETS = {
  hips: [0, 0.92, 0], // world Y = 0.92
  torso: [0, 0.02, 0], // relative to hips => world Y = 0.94
  shoulderL: [0.205, 0.43, 0.005], // relative to torso => world (0.205, 1.37, 0.005)
  shoulderR: [-0.205, 0.43, 0.005],
  elbowRelL: [0.056, -0.245, -0.01],
  elbowRelR: [-0.056, -0.245, -0.01],
  wristRelL: [0.044, -0.225, 0.075], // standing wrist world ~(0.305, 0.90, 0.07)
  wristRelR: [-0.044, -0.225, 0.095], // standing wrist world ~(-0.305, 0.90, 0.09)
  thighL: [0.098, -0.01, 0.0], // relative to hips => world Y = 0.91
  thighR: [-0.098, -0.01, 0.0],
  kneeRelL: [0.008, -0.43, 0.015], // world Y = 0.48
  kneeRelR: [-0.008, -0.43, 0.015],
  ankleRelL: [0.004, -0.41, -0.018], // world Y = 0.07
  ankleRelR: [-0.004, -0.41, -0.018],
};

function createHumanSkeletonNodes(root) {
  const hips = addGroup(root, "rig_hips", RIG_OFFSETS.hips);
  const torso = addGroup(hips, "rig_torso", RIG_OFFSETS.torso);
  const neckBase = addGroup(torso, "rig_neck_base", [0, 0.50, 0]);

  const skirtFront = addGroup(hips, "rig_skirt_front", [0, 0.01, 0.025]);
  const skirtBack = addGroup(hips, "rig_skirt_back", [0, 0.01, -0.025]);

  const shoulderL = addGroup(torso, "rig_shoulder_l", RIG_OFFSETS.shoulderL);
  const upperArmL = addGroup(shoulderL, "rig_upper_arm_l", [0, 0, 0]);
  const forearmL = addGroup(upperArmL, "rig_forearm_l", RIG_OFFSETS.elbowRelL);
  const handL = addGroup(forearmL, "rig_hand_l", RIG_OFFSETS.wristRelL);

  const shoulderR = addGroup(torso, "rig_shoulder_r", RIG_OFFSETS.shoulderR);
  const upperArmR = addGroup(shoulderR, "rig_upper_arm_r", [0, 0, 0]);
  const forearmR = addGroup(upperArmR, "rig_forearm_r", RIG_OFFSETS.elbowRelR);
  const handR = addGroup(forearmR, "rig_hand_r", RIG_OFFSETS.wristRelR);

  const thighL = addGroup(hips, "rig_thigh_l", RIG_OFFSETS.thighL);
  const calfL = addGroup(thighL, "rig_calf_l", RIG_OFFSETS.kneeRelL);
  const footL = addGroup(calfL, "rig_foot_l", RIG_OFFSETS.ankleRelL);

  const thighR = addGroup(hips, "rig_thigh_r", RIG_OFFSETS.thighR);
  const calfR = addGroup(thighR, "rig_calf_r", RIG_OFFSETS.kneeRelR);
  const footR = addGroup(calfR, "rig_foot_r", RIG_OFFSETS.ankleRelR);

  return {
    hips,
    torso,
    neckBase,
    skirtFront,
    skirtBack,
    shoulderL,
    upperArmL,
    forearmL,
    handL,
    shoulderR,
    upperArmR,
    forearmR,
    handR,
    thighL,
    calfL,
    footL,
    thighR,
    calfR,
    footR,
  };
}

// ============================================================================
// 1. BODIES (Athletic / Sturdy / Slender — strictly recessed under clothes, sculpted visible neck/forearms/5-finger hands!)
// ============================================================================

function buildBody(variant) {
  const mats = createMaterials();
  const root = new THREE.Group();
  root.name = `body_${variant}`;
  const skel = createHumanSkeletonNodes(root);

  const cfg = {
    athletic: { neckMul: 1.0, limbMul: 1.0, handMul: 1.0, coreScale: 1.0 },
    sturdy: { neckMul: 1.15, limbMul: 1.13, handMul: 1.12, coreScale: 1.02 },
    slender: { neckMul: 0.89, limbMul: 0.89, handMul: 0.92, coreScale: 0.95 },
  }[variant];

  // Recessed inner pelvis (strictly inside garment hips/trouser waist <= 0.125!)
  addMesh(
    skel.hips,
    "pelvis_core",
    makeLoftedSection(
      [
        { y: -0.055, rx: 0.105 * cfg.coreScale, rz: 0.072 * cfg.coreScale, squircle: 0.3 },
        { y: 0.025, rx: 0.118 * cfg.coreScale, rz: 0.082 * cfg.coreScale, squircle: 0.35 },
      ],
      20
    ),
    mats.skin
  );

  // Sculpted anatomical torso core (strictly <= 0.122 waist / 0.156 chest so ZERO skin pokes through ANY outfit!)
  addMesh(
    skel.torso,
    "torso_core",
    makeLoftedSection(
      [
        { y: -0.01, rx: 0.114 * cfg.coreScale, rz: 0.080 * cfg.coreScale, squircle: 0.25 },
        { y: 0.12, rx: 0.116 * cfg.coreScale, rz: 0.084 * cfg.coreScale, squircle: 0.32, frontBulge: 0.06 },
        { y: 0.28, rx: 0.146 * cfg.coreScale, rz: 0.098 * cfg.coreScale, squircle: 0.42, pecSplit: 0.85, pinchLats: 0.35 },
        { y: 0.41, rx: 0.152 * cfg.coreScale, rz: 0.094 * cfg.coreScale, squircle: 0.48, frontBulge: 0.08 },
        { y: 0.47, rx: 0.076 * cfg.neckMul, rz: 0.064 * cfg.neckMul, squircle: 0.15 },
      ],
      24
    ),
    mats.skin
  );

  // Exposed sculpted neck (from collar up to socket_head at Y=1.46 + overlap to 1.54)
  addMesh(
    skel.neckBase,
    "neck_sculpt",
    makeLoftedSection(
      [
        { y: -0.03, rx: 0.066 * cfg.neckMul, rz: 0.058 * cfg.neckMul, backFlat: 0.06 },
        { y: 0.025, rx: 0.052 * cfg.neckMul, rz: 0.052 * cfg.neckMul, frontBulge: 0.06 },
        { y: 0.085, rx: 0.049 * cfg.neckMul, rz: 0.051 * cfg.neckMul },
      ],
      20
    ),
    mats.skin
  );

  // Arms: recessed upper arm core inside sleeves; sculpted muscular forearm + wrist cuff opening + REAL 5-FINGER HANDS!
  for (const [side, sh, ua, fa, ha, elbowRel, wristRel] of [
    [1, skel.shoulderL, skel.upperArmL, skel.forearmL, skel.handL, RIG_OFFSETS.elbowRelL, RIG_OFFSETS.wristRelL],
    [-1, skel.shoulderR, skel.upperArmR, skel.forearmR, skel.handR, RIG_OFFSETS.elbowRelR, RIG_OFFSETS.wristRelR],
  ]) {
    addMesh(sh, `shoulder_cap_${side > 0 ? "l" : "r"}`, new THREE.SphereGeometry(0.044, 12, 10), mats.skin);

    ua.add(
      buildContouredBoneLimb(
        elbowRel,
        [
          { t: 0.0, rx: 0.041, rz: 0.041 },
          { t: 0.45, rx: 0.042, rz: 0.044, frontBulge: 0.06 },
          { t: 0.96, rx: 0.035, rz: 0.036 },
        ],
        mats.skin,
        `upper_arm_core_${side > 0 ? "l" : "r"}`,
        14
      )
    );

    fa.add(
      buildContouredBoneLimb(
        wristRel,
        [
          { t: 0.0, rx: 0.036 * cfg.limbMul, rz: 0.036 * cfg.limbMul },
          { t: 0.35, rx: 0.038 * cfg.limbMul, rz: 0.037 * cfg.limbMul, frontBulge: 0.08 },
          { t: 0.78, rx: 0.030 * cfg.limbMul, rz: 0.026 * cfg.limbMul, squircle: 0.25 },
          { t: 1.0, rx: 0.025 * cfg.limbMul, rz: 0.020 * cfg.limbMul, squircle: 0.35 },
        ],
        mats.skin,
        `forearm_${side > 0 ? "l" : "r"}`,
        16
      )
    );

    // Wrist tendon overlap + full sculpted 5-finger hand!
    ha.add(buildSculptedHandGroup(side, mats.skin, cfg.handMul, "relaxed"));
  }

  // Legs: strictly recessed inside trouser & boot outer shells (<= 0.058 thigh, <= 0.042 calf)
  for (const [side, th, ca, fo, kneeRel, ankleRel] of [
    [1, skel.thighL, skel.calfL, skel.footL, RIG_OFFSETS.kneeRelL, RIG_OFFSETS.ankleRelL],
    [-1, skel.thighR, skel.calfR, skel.footR, RIG_OFFSETS.kneeRelR, RIG_OFFSETS.ankleRelR],
  ]) {
    th.add(
      buildContouredBoneLimb(
        kneeRel,
        [
          { t: 0.0, rx: 0.058, rz: 0.060 },
          { t: 0.38, rx: 0.057, rz: 0.059 },
          { t: 0.96, rx: 0.045, rz: 0.046 },
        ],
        mats.skin,
        `thigh_core_${side > 0 ? "l" : "r"}`,
        14
      )
    );
    ca.add(
      buildContouredBoneLimb(
        ankleRel,
        [
          { t: 0.0, rx: 0.043, rz: 0.043 },
          { t: 0.35, rx: 0.045, rz: 0.046 },
          { t: 0.96, rx: 0.031, rz: 0.032 },
        ],
        mats.skin,
        `calf_core_${side > 0 ? "l" : "r"}`,
        14
      )
    );
    addMesh(
      fo,
      `foot_core_${side > 0 ? "l" : "r"}`,
      new THREE.CapsuleGeometry(0.028, 0.07, 4, 10),
      mats.skin,
      [0, -0.042, 0.03],
      [Math.PI / 2, 0, 0]
    );
  }

  return root;
}

// ============================================================================
// 2. HEADS (Anatomical Cranium + Brow/Cheekbones/Jaw + Ears)
// ============================================================================

function buildHead(variant) {
  const mats = createMaterials();
  const root = new THREE.Group();
  root.name = `head_${variant}`;

  const shapeProfile = {
    oval: { jawW: 0.78, cheekW: 0.98, chinW: 0.56, browSq: 0.25, chinZ: 0.088 },
    square: { jawW: 0.94, cheekW: 1.02, chinW: 0.74, browSq: 0.45, chinZ: 0.094 },
    heart: { jawW: 0.68, cheekW: 1.03, chinW: 0.44, browSq: 0.22, chinZ: 0.092 },
    chiseled: { jawW: 0.84, cheekW: 1.04, chinW: 0.60, browSq: 0.40, chinZ: 0.096 },
  }[variant];

  // Anatomical sculpted cranium/face (front facial plane around Z = +0.098..0.102 across all 4 variants!)
  const headGeo = makeLoftedSection(
    [
      { y: -0.025, rx: 0.050, rz: 0.050, cz: -0.008 }, // neck insert base
      { y: 0.008, rx: 0.054, rz: 0.056, cz: -0.002 }, // upper neck / submental
      {
        y: 0.028,
        rx: 0.072 * shapeProfile.chinW + 0.018,
        rz: shapeProfile.chinZ,
        cz: 0.008,
        squircle: 0.35,
        frontBulge: 0.14,
        backFlat: 0.12,
      }, // chin + mandible
      {
        y: 0.068,
        rx: 0.084 * shapeProfile.jawW + 0.012,
        rz: 0.096,
        cz: 0.004,
        squircle: shapeProfile.browSq,
        frontBulge: 0.08,
        backFlat: 0.06,
      }, // mouth / jaw angle
      {
        y: 0.112,
        rx: 0.092 * shapeProfile.cheekW,
        rz: 0.102,
        cz: -0.002,
        squircle: 0.3,
        frontBulge: 0.04,
      }, // cheekbones / midface
      {
        y: 0.152,
        rx: 0.094,
        rz: 0.106,
        cz: -0.006,
        squircle: shapeProfile.browSq,
        frontBulge: 0.05,
      }, // brow ridge / temples
      { y: 0.195, rx: 0.088, rz: 0.102, cz: -0.010, squircle: 0.18 }, // upper forehead
      { y: 0.232, rx: 0.064, rz: 0.076, cz: -0.014, squircle: 0.1 }, // parietal dome
      { y: 0.252, rx: 0.024, rz: 0.028, cz: -0.014 }, // crown cap
    ],
    32
  );
  addMesh(root, "cranium", headGeo, mats.skin);

  // Subtle sculpted collar/scarf accent at neck base (provides required mat_secondary & blends smoothly into outfits)
  addMesh(
    root,
    "collar_accent",
    makeLoftedSection(
      [
        { y: -0.028, rx: 0.064, rz: 0.064, frontBulge: 0.12 },
        { y: -0.008, rx: 0.068, rz: 0.068, frontBulge: 0.10 },
        { y: 0.008, rx: 0.060, rz: 0.060 },
      ],
      24
    ),
    mats.secondary
  );

  // Sculpted ears (outer helix rim + inner concha depth)
  for (const side of [-1, 1]) {
    const earGroup = addGroup(
      root,
      side > 0 ? "ear_l" : "ear_r",
      [side * (0.091 * shapeProfile.cheekW), 0.118, -0.008],
      [0.05, side * -0.22, side * 0.12]
    );
    addMesh(
      earGroup,
      "ear_outer",
      makeLoftedSection(
        [
          { y: -0.022, rx: 0.010, rz: 0.012 },
          { y: 0.0, rx: 0.012, rz: 0.018 },
          { y: 0.020, rx: 0.010, rz: 0.015 },
        ],
        12
      ),
      mats.skin
    );
  }

  // Facial material registration anchors embedded cleanly inside cranium (visible modular eyes/brows/nose/mouth come from sceneComposer)
  addMesh(root, "eye_socket_anchor", new THREE.SphereGeometry(0.010, 8, 6), mats.eyes, [0, 0.136, 0.0]);
  addMesh(root, "brow_socket_anchor", new THREE.SphereGeometry(0.010, 8, 6), mats.hair, [0, 0.16, 0.0]);

  return root;
}

// ============================================================================
// 3. HAIR (Split into `hair_crown_mass` & `hair_lower_flow` so Hats Tuck Cleanly!)
// ============================================================================

function buildHair(variant) {
  const mats = createMaterials();
  const root = new THREE.Group();
  root.name = `hair_${variant}`;

  const crown = addGroup(root, "hair_crown_mass");
  const lower = addGroup(root, "hair_lower_flow");

  // Fitted cranial hair base inside crown group
  const baseCap = makeLoftedSection(
    [
      { y: 0.095, rx: 0.092, rz: 0.098, cz: -0.036, backFlat: 0.04 },
      { y: 0.155, rx: 0.100, rz: 0.106, cz: -0.020 },
      { y: 0.215, rx: 0.088, rz: 0.098, cz: -0.016 },
      { y: 0.252, rx: 0.046, rz: 0.054, cz: -0.016 },
    ],
    24
  );
  addMesh(crown, "hair_cap", baseCap, mats.hair);

  // Temple / sideburn framing locks in lower flow (always visible even under a hat!)
  for (const side of [-1, 1]) {
    addMesh(
      lower,
      `temple_lock_${side}`,
      makeTube(
        [
          [side * 0.076, 0.185, 0.046],
          [side * 0.094, 0.135, 0.032],
          [side * 0.088, 0.082, 0.015],
        ],
        0.016,
        10,
        8
      ),
      mats.hair
    );
  }

  if (variant === "short") {
    for (let i = -2; i <= 2; i++) {
      addMesh(
        crown,
        `short_lock_${i}`,
        makeTube(
          [
            [i * 0.025, 0.225, -0.02],
            [i * 0.027, 0.242, 0.055],
            [i * 0.022, 0.198, 0.098],
          ],
          0.022 - Math.abs(i) * 0.0025,
          12,
          8
        ),
        mats.hair
      );
    }
    addMesh(
      lower,
      "short_nape",
      makeLoftedSection(
        [
          { y: 0.045, rx: 0.068, rz: 0.038, cz: -0.075 },
          { y: 0.125, rx: 0.086, rz: 0.046, cz: -0.082 },
        ],
        16
      ),
      mats.hair
    );
  } else if (variant === "wavy") {
    addMesh(
      crown,
      "wavy_top_part",
      makeLoftedSection(
        [
          { y: 0.19, rx: 0.102, rz: 0.108, cz: -0.012 },
          { y: 0.245, rx: 0.085, rz: 0.096, cz: -0.012, foldFreq: 7, foldAmp: 0.06 },
        ],
        22
      ),
      mats.hair
    );
    for (const side of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const zOff = 0.01 - k * 0.038;
        addMesh(
          lower,
          `wave_${side}_${k}`,
          makeTube(
            [
              [side * 0.078, 0.195, zOff],
              [side * 0.110, 0.125, zOff - 0.012],
              [side * 0.098, 0.055, zOff - 0.022],
              [side * 0.110, -0.015, zOff - 0.026],
            ],
            0.025,
            14,
            8
          ),
          mats.hair
        );
      }
    }
    addMesh(
      lower,
      "wave_back",
      makeLoftedSection(
        [
          { y: -0.02, rx: 0.095, rz: 0.048, cz: -0.088, foldFreq: 8, foldAmp: 0.08 },
          { y: 0.14, rx: 0.098, rz: 0.052, cz: -0.084, foldFreq: 8, foldAmp: 0.06 },
        ],
        20
      ),
      mats.hair
    );
  } else if (variant === "bun") {
    addMesh(
      crown,
      "top_bun",
      makeLoftedSection(
        [
          { y: 0.215, rx: 0.038, rz: 0.038, cz: -0.058 },
          { y: 0.252, rx: 0.062, rz: 0.062, cz: -0.058 },
          { y: 0.295, rx: 0.048, rz: 0.048, cz: -0.058 },
          { y: 0.312, rx: 0.016, rz: 0.016, cz: -0.058 },
        ],
        18
      ),
      mats.hair
    );
    addMesh(crown, "bun_coil", new THREE.TorusGeometry(0.050, 0.016, 10, 20), mats.hair, [0, 0.248, -0.058], [Math.PI / 2, 0, 0]);
  } else if (variant === "braids") {
    for (const side of [-1, 1]) {
      for (let seg = 0; seg < 7; seg++) {
        const y = 0.15 - seg * 0.036;
        const x = side * (0.098 + Math.sin(seg * 0.8) * 0.008);
        const z = -0.018 + seg * 0.010;
        addMesh(lower, `braid_${side}_${seg}`, new THREE.SphereGeometry(0.024 - seg * 0.0018, 10, 8), mats.hair, [x, y, z]);
      }
    }
  } else if (variant === "curly") {
    const crownCurls = [
      [0, 0.255, 0.025], [-0.055, 0.242, 0.032], [0.055, 0.242, 0.032],
      [-0.088, 0.195, 0.01], [0.088, 0.195, 0.01], [-0.058, 0.23, -0.058], [0.058, 0.23, -0.058],
      [0, 0.215, -0.096],
    ];
    const lowerCurls = [
      [-0.098, 0.135, -0.018], [0.098, 0.135, -0.018],
      [-0.068, 0.135, -0.088], [0.068, 0.135, -0.088],
      [-0.092, 0.078, -0.048], [0.092, 0.078, -0.048],
    ];
    crownCurls.forEach(([x, y, z], i) => {
      addMesh(crown, `curl_top_${i}`, new THREE.SphereGeometry(0.042, 12, 10), mats.hair, [x, y, z]);
    });
    lowerCurls.forEach(([x, y, z], i) => {
      addMesh(lower, `curl_low_${i}`, new THREE.SphereGeometry(0.040, 12, 10), mats.hair, [x, y, z]);
    });
  } else if (variant === "long") {
    addMesh(
      lower,
      "long_back_flow",
      makeLoftedSection(
        [
          { y: -0.14, rx: 0.132, rz: 0.042, cz: -0.115, foldFreq: 9, foldAmp: 0.09 },
          { y: 0.01, rx: 0.118, rz: 0.044, cz: -0.105, foldFreq: 8, foldAmp: 0.07 },
          { y: 0.14, rx: 0.100, rz: 0.048, cz: -0.088 },
        ],
        22
      ),
      mats.hair
    );
    for (const side of [-1, 1]) {
      addMesh(
        lower,
        `long_side_${side}`,
        makeTube(
          [
            [side * 0.082, 0.185, 0.032],
            [side * 0.106, 0.095, 0.022],
            [side * 0.108, -0.055, -0.008],
          ],
          0.024,
          14,
          8
        ),
        mats.hair
      );
    }
  } else if (variant === "navigator") {
    for (let i = -3; i <= 3; i++) {
      addMesh(
        crown,
        `nav_sweep_${i}`,
        makeTube(
          [
            [i * 0.022, 0.215, 0.078],
            [i * 0.025, 0.258, 0.012],
            [i * 0.026, 0.205, -0.092],
          ],
          0.023 - Math.abs(i) * 0.002,
          14,
          8
        ),
        mats.hair
      );
    }
    addMesh(
      lower,
      "nav_back_tail",
      makeLoftedSection(
        [
          { y: 0.03, rx: 0.062, rz: 0.038, cz: -0.095 },
          { y: 0.14, rx: 0.085, rz: 0.045, cz: -0.085 },
        ],
        16
      ),
      mats.hair
    );
  } else if (variant === "royal_bun") {
    addMesh(crown, "halo_braid", new THREE.TorusGeometry(0.100, 0.019, 12, 28), mats.hair, [0, 0.205, -0.005], [Math.PI / 2 - 0.16, 0, 0]);
    addMesh(crown, "royal_chignon", new THREE.SphereGeometry(0.064, 18, 14), mats.hair, [0, 0.268, -0.040], [0, 0, 0], [1.1, 0.95, 1.0]);
    addMesh(lower, "royal_nape_roll", new THREE.CapsuleGeometry(0.030, 0.082, 6, 12), mats.hair, [0, 0.075, -0.096], [0, 0, Math.PI / 2]);
  }

  return root;
}

// ============================================================================
// 4. BEARDS (Contoured outside all 4 headShape jaws without covering lips!)
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
            [0, 0.082, 0.104],
            [side * 0.026 * scale, 0.081, 0.103],
            [side * 0.052 * scale, 0.075, 0.093],
            [side * 0.070 * scale, 0.083, 0.082],
          ],
          0.011 * scale,
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
      makeLoftedSection(
        [
          { y: -0.042, rx: 0.010, rz: 0.010, cz: 0.086 },
          { y: -0.008, rx: 0.030, rz: 0.022, cz: 0.092, frontBulge: 0.15 },
          { y: 0.032, rx: 0.036, rz: 0.024, cz: 0.090, frontBulge: 0.15 },
          { y: 0.052, rx: 0.026, rz: 0.018, cz: 0.094 },
        ],
        16
      ),
      mats.hair
    );
  } else if (variant === "captain_trimmed") {
    addStache(1.0);
    addMesh(
      root,
      "jaw_strap",
      makeTube(
        [
          [-0.086, 0.096, 0.034],
          [-0.068, 0.034, 0.076],
          [0, 0.008, 0.100],
          [0.068, 0.034, 0.076],
          [0.086, 0.096, 0.034],
        ],
        0.020,
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
      makeLoftedSection(
        [
          { y: -0.055, rx: 0.020, rz: 0.018, cz: 0.084 },
          { y: -0.015, rx: 0.058, rz: 0.042, cz: 0.074, frontBulge: 0.25 },
          { y: 0.032, rx: 0.084, rz: 0.054, cz: 0.056, frontBulge: 0.22 },
          { y: 0.072, rx: 0.092, rz: 0.048, cz: 0.042 },
        ],
        20
      ),
      mats.hair
    );
  } else if (variant === "full_viking") {
    addStache(1.18);
    addMesh(
      root,
      "viking_cheek_wrap",
      makeTube(
        [
          [-0.092, 0.098, 0.038],
          [-0.076, 0.030, 0.086],
          [0, -0.004, 0.108],
          [0.076, 0.030, 0.086],
          [0.092, 0.098, 0.038],
        ],
        0.026,
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
            [side * 0.034, 0.012, 0.098],
            [side * 0.038, -0.048, 0.095],
            [side * 0.032, -0.105, 0.085],
          ],
          0.020,
          12,
          8
        ),
        mats.hair
      );
      addMesh(root, `viking_clasp_${side}`, new THREE.TorusGeometry(0.021, 0.005, 8, 14), mats.metal, [side * 0.034, -0.072, 0.091], [Math.PI / 2, 0, 0]);
    }
  }

  return root;
}

// ============================================================================
// 5. OUTFITS (Articulated Catan-Universe-Inspired Garments wrapping outside body cores!)
// ============================================================================

function buildOutfit(variant) {
  const mats = createMaterials();
  const root = new THREE.Group();
  root.name = `outfit_${variant}`;
  const skel = createHumanSkeletonNodes(root);

  const isArmored = variant === "armor" || variant === "imperial_lord";
  const torsoMat = variant === "armor" ? mats.metal : mats.primary;
  const sleeveMat = variant === "armor" ? mats.secondary : mats.primary;

  // Tailored torso garment strictly larger than recessed body torso_core (>= +2.5cm clearance everywhere)
  const torsoMesh = makeLoftedSection(
    [
      { y: -0.02, rx: 0.152, rz: 0.114, squircle: 0.35, foldFreq: 8, foldAmp: 0.025 }, // waist hem base (world 0.92)
      { y: 0.08, rx: 0.148, rz: 0.112, squircle: 0.35, frontBulge: 0.08 }, // cinched waist
      { y: 0.24, rx: 0.184, rz: 0.132, squircle: 0.48, pecSplit: isArmored ? 1.1 : 0.7, pinchLats: 0.35 }, // ribcage/chest
      { y: 0.38, rx: 0.194, rz: 0.130, squircle: 0.54, frontBulge: 0.10 }, // broad shoulder chest
      { y: 0.46, rx: 0.108, rz: 0.095, squircle: 0.25 }, // collar opening (world 1.40)
    ],
    28
  );
  addMesh(skel.torso, "garment_torso", torsoMesh, torsoMat);

  // Articulated Tunic Skirt / Coat Tails (Front & Back flaps so riding a mount bends skirts smoothly around knees!)
  const skirtFrontGeo = makeLoftedSection(
    [
      { y: -0.25, rx: 0.198, rz: 0.096, cz: 0.036, squircle: 0.45, foldFreq: 6, foldAmp: 0.045, backFlat: 0.65 },
      { y: -0.10, rx: 0.172, rz: 0.088, cz: 0.024, squircle: 0.40, foldFreq: 6, foldAmp: 0.03, backFlat: 0.65 },
      { y: 0.01, rx: 0.150, rz: 0.078, cz: 0.012, squircle: 0.35, backFlat: 0.65 },
    ],
    22,
    { capBottom: true, capTop: true }
  );
  const skirtBackGeo = makeLoftedSection(
    [
      { y: -0.28, rx: 0.205, rz: 0.098, cz: -0.038, squircle: 0.45, foldFreq: 6, foldAmp: 0.045, frontBulge: -0.65 },
      { y: -0.11, rx: 0.176, rz: 0.088, cz: -0.024, squircle: 0.40, foldFreq: 6, foldAmp: 0.03, frontBulge: -0.65 },
      { y: 0.01, rx: 0.152, rz: 0.078, cz: -0.012, squircle: 0.35, frontBulge: -0.65 },
    ],
    22,
    { capBottom: true, capTop: true }
  );
  addMesh(skel.skirtFront, "garment_skirt_front", skirtFrontGeo, mats.primary);
  addMesh(skel.skirtBack, "garment_skirt_back", skirtBackGeo, mats.primary);

  // Articulated Upper-Arm + Forearm Sleeves with Sculpted Cuffs/Bracers (aligned identically to body elbow/wrist pivots!)
  for (const [side, sh, ua, fa, elbowRel, wristRel] of [
    [1, skel.shoulderL, skel.upperArmL, skel.forearmL, RIG_OFFSETS.elbowRelL, RIG_OFFSETS.wristRelL],
    [-1, skel.shoulderR, skel.upperArmR, skel.forearmR, RIG_OFFSETS.elbowRelR, RIG_OFFSETS.wristRelR],
  ]) {
    addMesh(sh, `sleeve_shoulder_${side > 0 ? "l" : "r"}`, new THREE.SphereGeometry(0.062, 14, 12), sleeveMat);

    ua.add(
      buildContouredBoneLimb(
        elbowRel,
        [
          { t: 0.0, rx: 0.061, rz: 0.061, squircle: 0.25 },
          { t: 0.48, rx: 0.060, rz: 0.062, squircle: 0.25 },
          { t: 1.0, rx: 0.052, rz: 0.052, squircle: 0.20 },
        ],
        sleeveMat,
        `upper_sleeve_${side > 0 ? "l" : "r"}`,
        16
      )
    );

    // Three-quarter / forearm sleeve + rolled cuff or bracer leaving hands clean & uncovered!
    fa.add(
      buildContouredBoneLimb(
        wristRel,
        [
          { t: 0.0, rx: 0.053, rz: 0.053, squircle: 0.20 },
          { t: 0.48, rx: 0.049, rz: 0.048, squircle: 0.22 },
          { t: 0.72, rx: 0.047, rz: 0.046, squircle: 0.30 },
          { t: 0.76, rx: 0.042, rz: 0.041, squircle: 0.30 },
        ],
        variant === "settler" ? mats.secondary : sleeveMat,
        `forearm_sleeve_${side > 0 ? "l" : "r"}`,
        16
      )
    );

    // Ornate wrist bracer/cuff ring
    const cuffMat = isArmored ? mats.metal : mats.secondary;
    const endV = new THREE.Vector3(...wristRel);
    const cuffPos = endV.clone().multiplyScalar(0.68);
    const cuffMesh = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.010, 8, 16), cuffMat);
    cuffMesh.name = `wrist_cuff_${side > 0 ? "l" : "r"}`;
    cuffMesh.position.copy(cuffPos);
    cuffMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), endV.clone().normalize());
    fa.add(cuffMesh);
  }

  // Sculpted Waist Belt + Sash + Metal Buckle (nested in torso base so belt moves seamlessly!)
  addMesh(
    skel.torso,
    "belt_strap",
    makeLoftedSection(
      [
        { y: -0.005, rx: 0.160, rz: 0.122, squircle: 0.38 },
        { y: 0.032, rx: 0.162, rz: 0.124, squircle: 0.40 },
        { y: 0.068, rx: 0.158, rz: 0.120, squircle: 0.38 },
      ],
      24
    ),
    mats.secondary
  );
  addMesh(skel.torso, "belt_buckle", new THREE.TorusGeometry(0.032, 0.010, 8, 18), mats.metal, [0, 0.032, 0.130]);
  // Side leather pouch (authentic Catan colonist detail!)
  addMesh(
    skel.torso,
    "belt_pouch",
    makeLoftedSection(
      [
        { y: -0.055, rx: 0.036, rz: 0.024, squircle: 0.6 },
        { y: 0.0, rx: 0.032, rz: 0.022, squircle: 0.6 },
        { y: 0.025, rx: 0.024, rz: 0.018, squircle: 0.5 },
      ],
      14
    ),
    mats.secondary,
    [-0.162, 0.01, 0.048],
    [0.05, -0.35, -0.14]
  );

  // Style-specific Catan-Universe-inspired details
  if (variant === "settler") {
    // Draped V-neck colonist cowl/scarf framing the shoulders (like Catan Universe!)
    const cowlGeo = makeLoftedSection(
      [
        { y: 0.33, rx: 0.115, rz: 0.135, frontBulge: 0.25, squircle: 0.3 },
        { y: 0.42, rx: 0.172, rz: 0.136, squircle: 0.45, frontBulge: 0.16 },
        { y: 0.47, rx: 0.105, rz: 0.098, squircle: 0.2 },
      ],
      24
    );
    addMesh(skel.torso, "settler_cowl", cowlGeo, mats.secondary);
    addMesh(
      skel.torso,
      "cross_strap",
      makeTube(
        [
          [-0.14, 0.43, 0.08],
          [0, 0.22, 0.155],
          [0.14, 0.03, 0.09],
        ],
        0.020,
        14,
        8
      ),
      mats.secondary
    );
  } else if (variant === "captain") {
    for (const side of [-1, 1]) {
      const lapel = new THREE.Shape();
      lapel.moveTo(0, 0);
      lapel.lineTo(side * 0.088, -0.04);
      lapel.lineTo(side * 0.048, -0.30);
      lapel.lineTo(0, -0.32);
      lapel.closePath();
      addMesh(skel.torso, `lapel_${side}`, makeBeveledShape(lapel, 0.018, 0.005, 0.005), mats.secondary, [side * 0.025, 0.44, 0.118], [0.14, side * -0.12, 0]);
      addMesh(
        side > 0 ? skel.shoulderL : skel.shoulderR,
        `epaulet_${side}`,
        makeLoftedSection(
          [
            { y: 0.032, rx: 0.048, rz: 0.065, squircle: 0.5 },
            { y: 0.068, rx: 0.056, rz: 0.072, squircle: 0.6 },
          ],
          14
        ),
        mats.metal,
        [side * 0.01, 0.018, 0],
        [0, 0, side * -0.18]
      );
    }
    for (let b = 0; b < 4; b++) {
      addMesh(skel.torso, `btn_${b}`, new THREE.SphereGeometry(0.012, 10, 8), mats.metal, [0, 0.10 + b * 0.075, 0.146]);
    }
  } else if (variant === "armor") {
    for (const [side, sh] of [
      [1, skel.shoulderL],
      [-1, skel.shoulderR],
    ]) {
      addMesh(
        sh,
        `pauldron_${side}`,
        new THREE.SphereGeometry(0.094, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.56),
        mats.metal,
        [side * 0.018, 0.012, 0],
        [0, 0, -side * 0.34]
      );
      addMesh(
        sh,
        `pauldron_rim_${side}`,
        new THREE.TorusGeometry(0.088, 0.012, 8, 20),
        mats.secondary,
        [side * 0.018, -0.002, 0],
        [Math.PI / 2, side * 0.34, 0]
      );
    }
    addMesh(skel.torso, "chest_emblem", new THREE.OctahedronGeometry(0.050, 0), mats.secondary, [0, 0.28, 0.152], [0, 0, 0], [0.88, 1.25, 0.36]);
  } else if (variant === "merchant") {
    for (const side of [-1, 1]) {
      addMesh(
        skel.torso,
        `stole_${side}`,
        makeTube(
          [
            [side * 0.075, 0.46, -0.02],
            [side * 0.115, 0.38, 0.115],
            [side * 0.098, 0.14, 0.152],
            [side * 0.105, -0.08, 0.135],
          ],
          0.036,
          16,
          10
        ),
        mats.secondary
      );
    }
    addMesh(skel.torso, "merchant_medallion", new THREE.CylinderGeometry(0.038, 0.038, 0.015, 16), mats.metal, [0, 0.30, 0.154], [Math.PI / 2, 0, 0]);
  } else if (variant === "imperial_lord") {
    addMesh(
      skel.torso,
      "high_collar",
      new THREE.CylinderGeometry(0.120, 0.102, 0.095, 22, 1, true, Math.PI * 0.35, Math.PI * 1.3),
      mats.secondary,
      [0, 0.48, -0.018]
    );
    for (const [side, sh] of [
      [1, skel.shoulderL],
      [-1, skel.shoulderR],
    ]) {
      addMesh(
        sh,
        `imperial_pauldron_${side}`,
        new THREE.SphereGeometry(0.100, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.56),
        mats.metal,
        [side * 0.022, 0.018, 0],
        [0, 0, -side * 0.38]
      );
    }
    addMesh(
      skel.torso,
      "imperial_sash",
      makeTube(
        [
          [-0.145, 0.43, 0.088],
          [0, 0.22, 0.158],
          [0.148, 0.03, 0.096],
        ],
        0.025,
        14,
        8
      ),
      mats.secondary
    );
    addMesh(skel.torso, "imperial_crest", new THREE.OctahedronGeometry(0.056, 0), mats.metal, [0, 0.28, 0.158], [0, 0, 0], [0.9, 1.25, 0.4]);
  }

  if (isArmored) {
    for (const [side, th] of [
      [1, skel.thighL],
      [-1, skel.thighR],
    ]) {
      addMesh(
        th,
        `tasset_${side}`,
        makeLoftedSection(
          [
            { y: -0.18, rx: 0.086, rz: 0.072, cz: 0.02, squircle: 0.55 },
            { y: -0.02, rx: 0.078, rz: 0.068, cz: 0.02, squircle: 0.55 },
          ],
          14
        ),
        mats.metal,
        [side * 0.025, 0, 0.01],
        [0, 0, side * 0.14]
      );
    }
  }

  return root;
}

// ============================================================================
// 6. LEGS & BOOTS (Articulated Trousers, Knee Pads, Wraps, Soles/Heels/Toe-Boxes!)
// ============================================================================

function buildLegs(variant) {
  const mats = createMaterials();
  const root = new THREE.Group();
  root.name = `legs_${variant}`;
  const skel = createHumanSkeletonNodes(root);

  // Articulated hip waist-band connecting trousers seamlessly inside torso belt
  addMesh(
    skel.hips,
    "trouser_pelvis",
    makeLoftedSection(
      [
        { y: -0.05, rx: 0.132, rz: 0.096, squircle: 0.42 },
        { y: 0.03, rx: 0.138, rz: 0.100, squircle: 0.42 },
      ],
      22
    ),
    mats.primary
  );

  for (const [side, th, ca, fo, kneeRel, ankleRel] of [
    [1, skel.thighL, skel.calfL, skel.footL, RIG_OFFSETS.kneeRelL, RIG_OFFSETS.ankleRelL],
    [-1, skel.thighR, skel.calfR, skel.footR, RIG_OFFSETS.kneeRelR, RIG_OFFSETS.ankleRelR],
  ]) {
    // Contoured pleated breeches (strictly wider than recessed thigh_core <= 0.058!)
    th.add(
      buildContouredBoneLimb(
        kneeRel,
        [
          { t: 0.0, rx: 0.084, rz: 0.084, squircle: 0.25 },
          { t: 0.40, rx: 0.080, rz: 0.082, frontBulge: 0.06 },
          { t: 0.88, rx: 0.067, rz: 0.068 },
          { t: 1.0, rx: 0.064, rz: 0.064 },
        ],
        mats.primary,
        `trouser_${side > 0 ? "l" : "r"}`,
        18
      )
    );

    // Boot shaft / wrapped calf (strictly wider than calf_core <= 0.045!)
    const bootShaftMat = variant === "traveler" ? mats.primary : mats.secondary;
    ca.add(
      buildContouredBoneLimb(
        ankleRel,
        [
          { t: 0.0, rx: 0.066, rz: 0.066, squircle: 0.20 },
          { t: 0.25, rx: 0.068, rz: 0.070, frontBulge: 0.06 },
          { t: 0.60, rx: 0.060, rz: 0.062 },
          { t: 0.96, rx: 0.052, rz: 0.054 },
        ],
        bootShaftMat,
        `calf_cover_${side > 0 ? "l" : "r"}`,
        18
      )
    );

    // Sculpted anatomical boot foot resting cleanly at Y=0.00 (local foot origin at ankle Y=0.07 -> sole at local Y=-0.07!)
    addMesh(
      fo,
      `boot_upper_${side > 0 ? "l" : "r"}`,
      makeLoftedSection(
        [
          { y: -0.062, rx: 0.054, rz: 0.110, cz: 0.046, squircle: 0.5, frontBulge: 0.10 },
          { y: -0.032, rx: 0.050, rz: 0.095, cz: 0.036, squircle: 0.45 },
          { y: 0.008, rx: 0.052, rz: 0.056, cz: 0.004, squircle: 0.25 },
        ],
        18
      ),
      mats.secondary
    );
    // Thick beveled leather/armored sole touching Y = -0.070 (= World Y = 0.000!)
    addMesh(
      fo,
      `boot_sole_${side > 0 ? "l" : "r"}`,
      makeLoftedSection(
        [
          { y: -0.070, rx: 0.058, rz: 0.118, cz: 0.048, squircle: 0.58 },
          { y: -0.056, rx: 0.057, rz: 0.115, cz: 0.048, squircle: 0.58 },
        ],
        18
      ),
      mats.metal
    );

    if (variant === "traveler") {
      // Catan-Universe-inspired spiral leather leg wraps!
      for (let w = 0; w < 4; w++) {
        const yOff = -0.07 - w * 0.078;
        addMesh(
          ca,
          `calf_wrap_${side > 0 ? "l" : "r"}_${w}`,
          new THREE.TorusGeometry(0.064 - w * 0.003, 0.011, 8, 18),
          mats.secondary,
          [0, yOff, 0],
          [Math.PI / 2 + 0.16, 0, 0]
        );
      }
      addMesh(ca, `boot_buckle_${side > 0 ? "l" : "r"}`, new THREE.TorusGeometry(0.015, 0.0045, 6, 12), mats.metal, [0, -0.32, 0.058]);
    } else if (variant === "cuffed_boots") {
      addMesh(
        ca,
        `boot_cuff_${side > 0 ? "l" : "r"}`,
        makeLoftedSection(
          [
            { y: -0.10, rx: 0.070, rz: 0.072, squircle: 0.3 },
            { y: -0.02, rx: 0.082, rz: 0.084, squircle: 0.35 },
          ],
          18
        ),
        mats.secondary
      );
      addMesh(ca, `cuff_buckle_${side > 0 ? "l" : "r"}`, new THREE.TorusGeometry(0.017, 0.005, 6, 12), mats.metal, [0, -0.14, 0.068]);
    } else if (variant === "greaves" || variant === "royal_greaves") {
      addMesh(ca, `knee_plate_${side > 0 ? "l" : "r"}`, new THREE.SphereGeometry(0.068, 14, 12), mats.metal, [0, 0.005, 0.022], [0, 0, 0], [1, 1.12, 0.78]);
      addMesh(ca, `shin_greave_${side > 0 ? "l" : "r"}`, new THREE.CylinderGeometry(0.068, 0.052, 0.31, 14, 1, false, -Math.PI * 0.45, Math.PI * 0.9), mats.metal, [0, -0.21, 0.005]);
      if (variant === "royal_greaves") {
        addMesh(ca, `royal_spur_${side > 0 ? "l" : "r"}`, new THREE.ConeGeometry(0.020, 0.062, 8), mats.metal, [0, 0.045, 0.045], [-0.25, 0, 0]);
      }
    }
  }

  return root;
}

// ============================================================================
// 7. CAPES (Split shoulder collar + `rig_cape_drape` for mounted flow!)
// ============================================================================

function buildCape(variant) {
  const mats = createMaterials();
  const root = new THREE.Group();
  root.name = `cape_${variant}`;

  const collarAnchor = addGroup(root, "rig_cape_collar", [0, 1.38, 0]);
  const drapePivot = addGroup(collarAnchor, "rig_cape_drape", [0, 0.02, -0.115]);

  const drop = variant === "traveler" ? 0.86 : variant === "navy_commander" ? 0.94 : 1.04;
  const botW = variant === "royal_mantle" ? 0.39 : 0.31;

  const capeShape = new THREE.Shape();
  capeShape.moveTo(-0.18, 0);
  capeShape.lineTo(0.18, 0);
  capeShape.quadraticCurveTo(botW * 0.92, -drop * 0.5, botW, -drop);
  capeShape.quadraticCurveTo(0, -drop - 0.055, -botW, -drop);
  capeShape.quadraticCurveTo(-botW * 0.92, -drop * 0.5, -0.18, 0);
  capeShape.closePath();

  addMesh(drapePivot, "cape_cloth", makeBeveledShape(capeShape, 0.022, 0.008, 0.008), mats.primary, [0, 0, -0.025], [0.09, 0, 0]);

  addMesh(
    collarAnchor,
    "cape_collar",
    new THREE.TorusGeometry(0.155, 0.028, 10, 22, Math.PI * 1.15),
    mats.secondary,
    [0, 0.01, -0.045],
    [Math.PI / 2 - 0.25, 0, Math.PI * 0.92]
  );

  for (const side of [-1, 1]) {
    addMesh(collarAnchor, `clasp_${side}`, new THREE.CylinderGeometry(0.025, 0.025, 0.014, 14), mats.metal, [side * 0.168, 0.01, -0.032], [Math.PI / 2, 0, 0]);
  }

  if (variant === "navy_commander" || variant === "royal_mantle") {
    addMesh(
      collarAnchor,
      "shoulder_chain",
      makeTube(
        [
          [-0.16, 0.01, 0.02],
          [0, -0.06, 0.145],
          [0.16, 0.01, 0.02],
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
// 8. HATS (Calibrated around cranium at socket_head (0, 0.12, 0))
// ============================================================================

function buildHat(variant) {
  const mats = createMaterials();
  const root = new THREE.Group();
  root.name = `hat_${variant}`;

  if (variant === "captain") {
    addMesh(root, "tricorne_crown", new THREE.SphereGeometry(0.114, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.54), mats.primary, [0, 0.205, -0.008]);
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
    addMesh(root, "tricorne_brim", makeBeveledShape(brim, 0.016, 0.006, 0.006), mats.primary, [0, 0.214, -0.008], [Math.PI / 2, 0, 0]);
    addMesh(root, "tricorne_emblem", new THREE.CylinderGeometry(0.024, 0.024, 0.014, 16), mats.metal, [-0.08, 0.255, 0.095], [Math.PI / 2, 0, -0.4]);
  } else if (variant === "explorer") {
    addMesh(root, "explorer_brim", new THREE.CylinderGeometry(0.222, 0.232, 0.015, 28), mats.primary, [0, 0.214, -0.006]);
    addMesh(
      root,
      "explorer_crown",
      makeLathe(
        [
          [0.116, 0],
          [0.108, 0.075],
          [0.086, 0.114],
          [0.01, 0.110],
        ],
        22
      ),
      mats.primary,
      [0, 0.214, -0.006]
    );
    addMesh(root, "explorer_band", new THREE.CylinderGeometry(0.115, 0.119, 0.024, 24), mats.metal, [0, 0.228, -0.006]);
  } else if (variant === "bandana") {
    addMesh(root, "bandana_wrap", new THREE.SphereGeometry(0.115, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.56), mats.primary, [0, 0.165, -0.008], [-0.15, 0, 0]);
    addMesh(root, "bandana_knot", new THREE.SphereGeometry(0.026, 12, 10), mats.primary, [0.06, 0.19, -0.118]);
    addMesh(
      root,
      "bandana_tail",
      makeTube(
        [
          [0.06, 0.19, -0.118],
          [0.09, 0.13, -0.148],
          [0.11, 0.06, -0.158],
        ],
        0.016,
        10,
        8
      ),
      mats.primary
    );
    addMesh(root, "bandana_ring", new THREE.TorusGeometry(0.022, 0.005, 8, 16), mats.metal, [0.06, 0.18, -0.120], [0, 0.5, 0]);
  } else if (variant === "helm") {
    addMesh(root, "helm_dome", new THREE.SphereGeometry(0.124, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.62), mats.metal, [0, 0.174, -0.008]);
    addMesh(root, "helm_nasal", new THREE.BoxGeometry(0.020, 0.088, 0.018), mats.metal, [0, 0.165, 0.118]);
    addMesh(root, "helm_cheek_l", new THREE.BoxGeometry(0.018, 0.085, 0.072), mats.metal, [0.112, 0.125, 0.022], [0, 0, 0.12]);
    addMesh(root, "helm_cheek_r", new THREE.BoxGeometry(0.018, 0.085, 0.072), mats.metal, [-0.112, 0.125, 0.022], [0, 0, -0.12]);
    addMesh(
      root,
      "helm_plume",
      makeTube(
        [
          [0, 0.28, 0.072],
          [0, 0.342, 0.0],
          [0, 0.318, -0.096],
          [0, 0.238, -0.146],
        ],
        0.025,
        14,
        10
      ),
      mats.primary
    );
  } else if (variant === "crown_gold") {
    addMesh(root, "crown_velvet", new THREE.SphereGeometry(0.102, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.45), mats.primary, [0, 0.214, -0.006]);
    addMesh(root, "crown_band", new THREE.CylinderGeometry(0.114, 0.108, 0.036, 24), mats.metal, [0, 0.228, -0.006]);
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const x = Math.sin(angle) * 0.111;
      const z = -0.006 + Math.cos(angle) * 0.111;
      addMesh(root, `crown_spire_${i}`, new THREE.ConeGeometry(0.018, 0.056, 6), mats.metal, [x, 0.270, z]);
    }
  } else if (variant === "admiral_bicorne") {
    const crescent = new THREE.Shape();
    crescent.moveTo(-0.24, 0);
    crescent.quadraticCurveTo(0, 0.15, 0.24, 0);
    crescent.quadraticCurveTo(0, 0.03, -0.24, 0);
    crescent.closePath();
    addMesh(root, "bicorne_crest", makeBeveledShape(crescent, 0.065, 0.012, 0.012), mats.primary, [0, 0.215, -0.034]);
    addMesh(root, "bicorne_cockade", new THREE.CylinderGeometry(0.03, 0.03, 0.018, 16), mats.metal, [0, 0.275, 0.046], [Math.PI / 2, 0, 0]);
  }

  return root;
}

// ============================================================================
// 9. PROPS_HAND & 10. PROPS_BACK
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

function buildBackProp(variant) {
  const mats = createMaterials();
  const root = new THREE.Group();
  root.name = `backprop_${variant}`;

  if (variant === "explorer_pack") {
    addMesh(
      root,
      "pack_body",
      makeLoftedSection(
        [
          { y: -0.16, rx: 0.13, rz: 0.075, squircle: 0.55 },
          { y: 0.0, rx: 0.14, rz: 0.088, squircle: 0.55 },
          { y: 0.14, rx: 0.125, rz: 0.078, squircle: 0.55 },
        ],
        18
      ),
      mats.backpack,
      [0, 0, -0.05]
    );
    addMesh(root, "pack_bedroll", new THREE.CylinderGeometry(0.052, 0.052, 0.32, 16), mats.secondary, [0, 0.18, -0.05], [0, 0, Math.PI / 2]);
    addMesh(root, "pack_buckle", new THREE.BoxGeometry(0.045, 0.045, 0.02), mats.metal, [0, 0.03, -0.14]);
  } else if (variant === "sheathed_sword") {
    addMesh(root, "scabbard", new THREE.CylinderGeometry(0.022, 0.014, 0.78, 10), mats.secondary, [0, -0.04, -0.03], [0, 0, -0.58]);
    addMesh(root, "baldric", new THREE.TorusGeometry(0.185, 0.016, 8, 22), mats.primary, [0, 0.02, 0.105], [0.15, 0.55, 0.55]);
    addMesh(root, "sword_hilt", new THREE.CylinderGeometry(0.014, 0.014, 0.18, 10), mats.metal, [-0.24, 0.31, -0.03], [0, 0, -0.58]);
    addMesh(root, "sword_guard", new THREE.BoxGeometry(0.14, 0.018, 0.024), mats.metal, [-0.195, 0.245, -0.03], [0, 0, -0.58]);
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
// 11. PETS (Dramatically Distinct Silhouettes: Owl vs Parrot vs Falcon!)
// ============================================================================

function buildPet(variant) {
  const mats = createMaterials();
  const root = new THREE.Group();
  root.name = `pet_${variant}`;

  // Articulated feet/talons gripping shoulder at (0,0,0)
  for (const side of [-1, 1]) {
    addMesh(root, `talon_${side}`, new THREE.CylinderGeometry(0.008, 0.012, 0.034, 8), mats.metal, [side * 0.026, 0.016, 0.008]);
  }

  if (variant === "owl") {
    // CORUJA CARTÓGRAFA: Plump round silhouette, broad flat heart facial disc, forward amber owl eyes, tiny downward beak, ear tufts, short fan tail & mini satchel!
    addMesh(
      root,
      "owl_plump_body",
      makeLoftedSection(
        [
          { y: 0.025, rx: 0.044, rz: 0.042 },
          { y: 0.085, rx: 0.070, rz: 0.064, frontBulge: 0.14 },
          { y: 0.148, rx: 0.058, rz: 0.054 },
          { y: 0.195, rx: 0.056, rz: 0.050, backFlat: 0.08 },
          { y: 0.228, rx: 0.030, rz: 0.028 },
        ],
        20
      ),
      mats.primary
    );
    // Broad flat owl facial disc!
    addMesh(root, "owl_facial_disc", new THREE.CylinderGeometry(0.052, 0.048, 0.022, 18), mats.ivoryDetail, [0, 0.184, 0.038], [Math.PI / 2, 0, 0], [1.22, 1.0, 0.96]);
    for (const side of [-1, 1]) {
      // Large forward-facing owl eyes inside ringed brow feathers
      addMesh(root, `owl_eye_ring_${side}`, new THREE.TorusGeometry(0.017, 0.004, 8, 16), mats.secondary, [side * 0.021, 0.188, 0.050]);
      addMesh(root, `owl_eye_${side}`, new THREE.SphereGeometry(0.011, 10, 8), mats.pupil, [side * 0.021, 0.188, 0.050]);
      // Prominent Asio ear tufts!
      addMesh(root, `owl_ear_tuft_${side}`, new THREE.ConeGeometry(0.015, 0.052, 7), mats.secondary, [side * 0.036, 0.232, 0.018], [-0.15, 0, -side * 0.52]);
      // Rounded broad barred wings hugging plump body
      addMesh(root, `owl_wing_${side}`, new THREE.SphereGeometry(0.054, 12, 10), mats.secondary, [side * 0.060, 0.100, -0.008], [0.15, 0, side * 0.16], [0.36, 1.25, 0.85]);
    }
    // Small downward hooked owl beak tucked between the huge eyes
    addMesh(root, "owl_beak", new THREE.ConeGeometry(0.010, 0.024, 6), mats.metal, [0, 0.170, 0.058], [Math.PI * 0.72, 0, 0]);
    // Short wide rounded owl tail
    addMesh(root, "owl_tail", new THREE.CylinderGeometry(0.026, 0.044, 0.075, 10), mats.secondary, [0, 0.035, -0.062], [0.65, 0, 0], [1.25, 1.0, 0.35]);
    // Miniature cartographer brass/leather satchel!
    addMesh(root, "owl_satchel", new THREE.BoxGeometry(0.036, 0.032, 0.018), mats.metal, [0.052, 0.088, 0.045], [0, -0.4, 0.2]);
  } else if (variant === "parrot") {
    // PAPAGAIO CORSÁRIO: Sleek upright macaw posture, huge 2-part curved macaw hooked beak, bare white cheek patch, multi-feather sweeping crest, very LONG cascading stepped macaw tail!
    addMesh(
      root,
      "parrot_sleek_body",
      makeLoftedSection(
        [
          { y: 0.025, rx: 0.032, rz: 0.036 },
          { y: 0.095, rx: 0.048, rz: 0.054, frontBulge: 0.18 },
          { y: 0.168, rx: 0.036, rz: 0.042 },
          { y: 0.218, rx: 0.036, rz: 0.046, cz: 0.014 },
          { y: 0.248, rx: 0.020, rz: 0.024, cz: 0.012 },
        ],
        18
      ),
      mats.primary,
      [0, 0, 0],
      [0.12, 0, 0]
    );
    // Bold two-part curved tropical Macaw hooked beak!
    addMesh(
      root,
      "parrot_upper_bill",
      makeTube(
        [
          [0, 0.228, 0.042],
          [0, 0.226, 0.084],
          [0, 0.200, 0.098],
          [0, 0.184, 0.092],
        ],
        0.016,
        10,
        8
      ),
      mats.metal
    );
    addMesh(root, "parrot_lower_bill", new THREE.SphereGeometry(0.014, 10, 8), mats.darkDetail, [0, 0.202, 0.062], [0, 0, 0], [0.85, 0.8, 1.15]);
    // White bare macaw eye cheek patches + side eyes!
    for (const side of [-1, 1]) {
      addMesh(root, `parrot_cheek_${side}`, new THREE.SphereGeometry(0.018, 10, 8), mats.ivoryDetail, [side * 0.026, 0.222, 0.030], [0, side * 0.3, 0], [0.45, 0.85, 1.15]);
      addMesh(root, `parrot_eye_${side}`, new THREE.SphereGeometry(0.007, 8, 8), mats.pupil, [side * 0.032, 0.224, 0.038]);
      // Layered tropical flight wing feathers
      addMesh(root, `parrot_wing_${side}`, new THREE.SphereGeometry(0.044, 12, 10), mats.secondary, [side * 0.044, 0.112, -0.016], [0.22, 0, side * 0.15], [0.35, 1.45, 0.8]);
    }
    // Tall 3-plume tropical crest!
    for (let c = 0; c < 3; c++) {
      addMesh(
        root,
        `parrot_crest_${c}`,
        makeTube(
          [
            [0, 0.244, 0.018],
            [0, 0.278 - c * 0.010, -0.005 - c * 0.018],
            [0, 0.285 - c * 0.015, -0.038 - c * 0.025],
          ],
          0.0085,
          8,
          6
        ),
        mats.secondary
      );
    }
    // Signature LONG cascading stepped Macaw tail (hangs dramatically down behind shoulder!)
    for (let t = -1; t <= 1; t++) {
      const len = t === 0 ? 0.30 : 0.22;
      addMesh(
        root,
        `parrot_long_tail_${t}`,
        new THREE.ConeGeometry(0.014, len, 6),
        t === 0 ? mats.secondary : mats.metal,
        [t * 0.014, 0.015 - len * 0.38, -0.068 - Math.abs(t) * 0.004],
        [-2.85, 0, t * 0.06]
      );
    }
  } else {
    // FALCÃO REAL: Lean fierce forward raptor, sharp overhanging brow ridge, notched falcon beak, broad shoulders with swept pointed falcon wings!
    addMesh(
      root,
      "falcon_body",
      makeLoftedSection(
        [
          { y: 0.030, rx: 0.036, rz: 0.038 },
          { y: 0.105, rx: 0.056, rz: 0.062, cz: 0.015, frontBulge: 0.20, squircle: 0.35 },
          { y: 0.168, rx: 0.042, rz: 0.048, cz: 0.024 },
          { y: 0.210, rx: 0.036, rz: 0.046, cz: 0.030 },
        ],
        18
      ),
      mats.primary
    );
    // Sharp hooked raptor beak + golden cere
    addMesh(root, "falcon_cere", new THREE.SphereGeometry(0.013, 8, 8), mats.metal, [0, 0.194, 0.070]);
    addMesh(root, "falcon_beak", new THREE.ConeGeometry(0.012, 0.034, 6), mats.darkDetail, [0, 0.186, 0.084], [Math.PI * 0.62, 0, 0]);
    for (const side of [-1, 1]) {
      // Fierce angled raptor brow hood!
      addMesh(root, `falcon_brow_${side}`, new THREE.BoxGeometry(0.022, 0.008, 0.026), mats.secondary, [side * 0.022, 0.206, 0.058], [0.22, 0, side * -0.24]);
      addMesh(root, `falcon_eye_${side}`, new THREE.SphereGeometry(0.008, 8, 8), mats.pupil, [side * 0.024, 0.197, 0.058]);
      // Long pointed swept-back falcon wings crossing cleanly behind!
      const wingShape = new THREE.Shape();
      wingShape.moveTo(0, 0.14);
      wingShape.quadraticCurveTo(0.045, 0.12, 0.042, 0.02);
      wingShape.lineTo(0.016, -0.18);
      wingShape.quadraticCurveTo(-0.012, -0.05, 0, 0.14);
      addMesh(
        root,
        `falcon_wing_${side}`,
        makeBeveledShape(wingShape, 0.014, 0.004, 0.004),
        mats.secondary,
        [side * 0.048, 0.045, -0.015],
        [-0.32, side * 0.28, side * -0.14]
      );
    }
    // Crisp banded tapered falcon tail
    addMesh(root, "falcon_tail", new THREE.ConeGeometry(0.022, 0.16, 6), mats.secondary, [0, 0.005, -0.072], [-2.58, 0, 0], [1.1, 1.0, 0.35]);
    // Royal falconry hood plume
    addMesh(root, "falcon_jesses", new THREE.TorusGeometry(0.016, 0.004, 6, 12), mats.metal, [0, 0.024, 0.010], [Math.PI / 2, 0, 0]);
  }

  return root;
}

// ============================================================================
// 12. MOUNTS (Center-stage Riding Scale! Saddle at X=0, Z=0.02; Y calibrated per species!)
//     Horse vs Wolf (fangs, thick ruff, clawed digitigrade paws!) vs Stag (tall 6-tine antlers!) vs Griffin (eagle head/talons + lion hind + spreading wings!)
// ============================================================================

// ============================================================================
// 12. MOUNTS (Closed Organic Anatomy, Parrot-Grade Faces, Zero Holes!)
//     Horse vs Wolf vs Stag vs Griffin — articulated limbs, sculpted heads/eyes,
//     snug harness/bridle, and smooth closed toroidal/tapered meshes!
// ============================================================================

function addMountLimbJointed(
  parent,
  id,
  hipPos,
  kneePos,
  footPos,
  topRx,
  midRx,
  lowRx,
  mat,
  radialSegs = 14
) {
  const legGroup = addGroup(parent, `mount_leg_${id}`, hipPos);
  // Sculpted shoulder/haunch dome bridging torso seamlessly into upper leg
  addMesh(
    legGroup,
    `mount_hip_dome_${id}`,
    new THREE.SphereGeometry(topRx * 0.96, 14, 12),
    mat,
    [0, 0.01, 0],
    [0, 0, 0],
    [0.88, 1.15, 1.05]
  );

  const midVec = [
    kneePos[0] - hipPos[0],
    kneePos[1] - hipPos[1],
    kneePos[2] - hipPos[2],
  ];
  legGroup.add(
    buildContouredBoneLimb(
      midVec,
      [
        { t: 0.0, rx: topRx * 0.95, rz: topRx * 1.08 },
        { t: 0.45, rx: (topRx + midRx) * 0.5, rz: (topRx + midRx) * 0.56 },
        { t: 1.0, rx: midRx, rz: midRx * 1.04 },
      ],
      mat,
      `mount_upper_leg_${id}`,
      radialSegs
    )
  );

  // Smooth anatomical knee/hock joint sphere (zero open cap gap on bend!)
  addMesh(
    legGroup,
    `mount_joint_${id}`,
    new THREE.SphereGeometry(midRx * 1.04, 12, 10),
    mat,
    midVec
  );

  const shinGroup = addGroup(legGroup, `mount_lower_piv_${id}`, midVec);
  const footVec = [
    footPos[0] - kneePos[0],
    footPos[1] - kneePos[1],
    footPos[2] - kneePos[2],
  ];
  shinGroup.add(
    buildContouredBoneLimb(
      footVec,
      [
        { t: 0.0, rx: midRx * 0.96, rz: midRx },
        { t: 0.55, rx: (midRx + lowRx) * 0.48, rz: (midRx + lowRx) * 0.5 },
        { t: 1.0, rx: lowRx, rz: lowRx * 1.04 },
      ],
      mat,
      `mount_cannon_${id}`,
      radialSegs
    )
  );
  // Ankle/fetlock condyle
  addMesh(
    shinGroup,
    `mount_fetlock_${id}`,
    new THREE.SphereGeometry(lowRx * 1.08, 10, 8),
    mat,
    footVec
  );

  return { legGroup, shinGroup, footVec };
}

function addMountSaddleAndHarness(
  saddleGroup,
  mats,
  opts
) {
  const { bodyY, chestZ = 0.46, headY, headZ, muzzleReinY, muzzleReinZ, halfWidth = 0.19 } = opts;
  const saddleY = bodyY + 0.21;

  // Contoured curved saddle blanket draping flanks cleanly (sized to mount barrel width, zero clipping!)
  const padW = Math.min(0.23, halfWidth + 0.032);
  const padShape = new THREE.Shape();
  padShape.moveTo(-padW, -0.015);
  padShape.quadraticCurveTo(0, 0.095, padW, -0.015);
  padShape.lineTo(padW + 0.022, -0.145);
  padShape.quadraticCurveTo(padW * 0.88, -0.215, padW * 0.50, -0.215);
  padShape.quadraticCurveTo(0, -0.155, -padW * 0.50, -0.215);
  padShape.quadraticCurveTo(-padW * 0.88, -0.215, -(padW + 0.022), -0.145);
  padShape.closePath();
  addMesh(
    saddleGroup,
    "mount_saddle_pad",
    makeBeveledShape(padShape, 0.36, 0.014, 0.014),
    mats.primary,
    [0, bodyY + 0.15, -0.17]
  );

  // Cushioned sculpted leather saddle seat + front pommel + rear cantle sitting cleanly atop blanket
  addMesh(
    saddleGroup,
    "mount_saddle",
    makeLoftedSection(
      [
        { y: -0.17, rx: 0.155, rz: 0.055, squircle: 0.45 },
        { y: 0.0, rx: 0.17, rz: 0.05, squircle: 0.45 },
        { y: 0.17, rx: 0.14, rz: 0.055, squircle: 0.45 },
      ],
      18
    ),
    mats.secondary,
    [0, saddleY + 0.015, 0.01],
    [Math.PI / 2, 0, 0]
  );
  addMesh(
    saddleGroup,
    "mount_saddle_cantle",
    new THREE.TorusGeometry(0.125, 0.028, 10, 18, Math.PI),
    mats.metal,
    [0, saddleY + 0.05, -0.155],
    [-0.36, 0, 0]
  );
  addMesh(
    saddleGroup,
    "mount_saddle_pommel",
    new THREE.TorusGeometry(0.105, 0.022, 8, 16, Math.PI),
    mats.metal,
    [0, saddleY + 0.045, 0.17],
    [0.32, 0, 0]
  );

  // Royal Chest Breastplate Harness & Medallion wrapping smoothly over front chest
  addMesh(
    saddleGroup,
    "mount_chest_strap",
    makeTaperedCurvedTube(
      [
        { pos: [-halfWidth, saddleY - 0.06, 0.16], rx: 0.015 },
        { pos: [-halfWidth * 0.72, bodyY - 0.01, chestZ * 0.88], rx: 0.016 },
        { pos: [0, bodyY - 0.03, chestZ], rx: 0.020 },
        { pos: [halfWidth * 0.72, bodyY - 0.01, chestZ * 0.88], rx: 0.016 },
        { pos: [halfWidth, saddleY - 0.06, 0.16], rx: 0.015 },
      ],
      10
    ),
    mats.secondary
  );
  addMesh(
    saddleGroup,
    "mount_chest_medallion",
    new THREE.CylinderGeometry(0.044, 0.044, 0.018, 16),
    mats.metal,
    [0, bodyY - 0.03, chestZ + 0.012],
    [Math.PI / 2 + 0.15, 0, 0]
  );

  // Stirrups & Sweeping Curved Reins connecting bit/jaw cleanly to pommel!
  for (const side of [-1, 1]) {
    addMesh(
      saddleGroup,
      `stirrup_strap_${side}`,
      makeTaperedCurvedTube(
        [
          { pos: [side * 0.175, saddleY - 0.01, 0.05], rx: 0.011 },
          { pos: [side * (halfWidth + 0.03), bodyY - 0.16, 0.06], rx: 0.010 },
          { pos: [side * (halfWidth + 0.04), saddleY - 0.46, 0.065], rx: 0.010 },
        ],
        8
      ),
      mats.secondary
    );
    addMesh(
      saddleGroup,
      `stirrup_iron_${side}`,
      new THREE.TorusGeometry(0.040, 0.008, 8, 14),
      mats.metal,
      [side * (halfWidth + 0.045), saddleY - 0.49, 0.065],
      [0, Math.PI / 2, 0]
    );
    const reinStartZ = muzzleReinZ ?? headZ + 0.16;
    const reinStartY = muzzleReinY ?? headY - 0.06;
    addMesh(
      saddleGroup,
      `mount_rein_${side}`,
      makeTaperedCurvedTube(
        [
          { pos: [side * (muzzleReinZ ? 0.056 : 0.065), reinStartY, reinStartZ], rx: 0.0068 },
          { pos: [side * 0.125, Math.min(reinStartY, saddleY + 0.18) - 0.06, (reinStartZ + 0.18) * 0.52], rx: 0.0068 },
          { pos: [side * 0.088, saddleY + 0.06, 0.18], rx: 0.0068 },
        ],
        8
      ),
      mats.secondary
    );
  }
}

function buildMount(variant) {
  const mats = createMaterials();
  const root = new THREE.Group();
  root.name = `mount_${variant}`;

  const anchor = addGroup(root, "mount_anchor", [0, 0, 0]);
  const saddleGroup = addGroup(anchor, "mount_saddle_group");
  const neckPivot = addGroup(anchor, "mount_neck_pivot");
  const tailPivot = addGroup(anchor, "mount_tail_pivot");

  if (variant === "snow_wolf") {
    // =========================================================================
    // LOBO DAS NEVES: Closed predator torso, thick shoulder fur mantle, sculpted
    // fierce snout, 4 fangs, expressive almond eyes, clawed digitigrade paws!
    // =========================================================================
    const bodyY = 0.72;
    const wolfBody = makeLoftedSection(
      [
        { y: -0.52, rx: 0.012, rz: 0.012 }, // smooth closed rump tip
        { y: -0.46, rx: 0.125, rz: 0.132, squircle: 0.25 },
        { y: -0.35, rx: 0.168, rz: 0.178, squircle: 0.30 },
        { y: -0.14, rx: 0.148, rz: 0.158, frontBulge: -0.14 }, // tucked athletic loin
        { y: 0.08, rx: 0.195, rz: 0.215, squircle: 0.28, frontBulge: 0.14 },
        { y: 0.26, rx: 0.215, rz: 0.235, squircle: 0.30, frontBulge: 0.18 }, // deep wolf ribcage
        { y: 0.39, rx: 0.175, rz: 0.188, frontBulge: 0.14 },
        { y: 0.46, rx: 0.115, rz: 0.122 },
        { y: 0.50, rx: 0.014, rz: 0.014 }, // smooth closed chest tip
      ],
      26
    );
    addMesh(anchor, "wolf_body", wolfBody, mats.mount, [0, bodyY, 0], [Math.PI / 2, 0, 0]);

    // Sculpted furry shoulder ruff collar anchored cleanly around neck base (zero Z-fighting with chest!)
    addMesh(
      neckPivot,
      "wolf_shoulder_mantle",
      makeLoftedSection(
        [
          { y: -0.09, rx: 0.02, rz: 0.02 },
          { y: -0.02, rx: 0.198, rz: 0.212, foldFreq: 8, foldAmp: 0.08 },
          { y: 0.10, rx: 0.172, rz: 0.184, foldFreq: 8, foldAmp: 0.08 },
          { y: 0.20, rx: 0.125, rz: 0.132 },
          { y: 0.24, rx: 0.02, rz: 0.02 },
        ],
        24
      ),
      mats.secondary,
      [0, -0.01, -0.02],
      [0.72, 0, 0]
    );
    for (let r = 0; r < 10; r++) {
      const a = (r / 10) * Math.PI * 2;
      addMesh(
        neckPivot,
        `wolf_ruff_spike_${r}`,
        new THREE.ConeGeometry(0.048, 0.14, 8),
        mats.secondary,
        [Math.sin(a) * 0.145, 0.04 + Math.cos(a) * 0.125, -0.01],
        [-0.78, 0, -Math.sin(a) * 0.42]
      );
    }

    // 4 Articulated Canine Legs + Joint Spheres + Padded Clawed Paws
    const wolfLegs = [
      { id: "fl", x: 0.145, z: 0.29, hind: false },
      { id: "fr", x: -0.145, z: 0.29, hind: false },
      { id: "bl", x: 0.140, z: -0.34, hind: true },
      { id: "br", x: -0.140, z: -0.34, hind: true },
    ];
    for (const lg of wolfLegs) {
      const hipPos = [lg.x, 0.65, lg.z];
      const hockPos = [lg.x, 0.32, lg.hind ? lg.z - 0.10 : lg.z + 0.02];
      const pawPos = [lg.x, 0.055, lg.hind ? lg.z - 0.02 : lg.z + 0.05];
      const { shinGroup, footVec } = addMountLimbJointed(
        anchor,
        lg.id,
        hipPos,
        hockPos,
        pawPos,
        lg.hind ? 0.105 : 0.088,
        0.052,
        0.040,
        mats.mount,
        14
      );
      const pawGroup = addGroup(shinGroup, `wolf_paw_${lg.id}`, footVec);
      addMesh(
        pawGroup,
        `paw_pad_${lg.id}`,
        new THREE.SphereGeometry(0.054, 12, 10),
        mats.mount,
        [0, -0.024, 0.028],
        [0, 0, 0],
        [1.02, 0.62, 1.38]
      );
      for (const c of [-1.2, -0.4, 0.4, 1.2]) {
        const idx = Math.round(c + 2);
        addMesh(
          pawGroup,
          `toe_${lg.id}_${idx}`,
          new THREE.SphereGeometry(0.018, 8, 8),
          mats.mount,
          [c * 0.020, -0.032, 0.072],
          [0, 0, 0],
          [0.9, 0.8, 1.35]
        );
        addMesh(
          pawGroup,
          `claw_${lg.id}_${idx}`,
          new THREE.ConeGeometry(0.0085, 0.034, 6),
          mats.darkDetail,
          [c * 0.020, -0.036, 0.098],
          [Math.PI / 1.9, 0, 0]
        );
      }
    }

    // Arched Lupine Neck (smooth closed curve!)
    neckPivot.position.set(0, bodyY + 0.06, 0.32);
    addMesh(
      neckPivot,
      "wolf_neck",
      makeTaperedCurvedTube(
        [
          { pos: [0, -0.04, -0.04], rx: 0.165, rz: 0.175 },
          { pos: [0, 0.07, 0.08], rx: 0.145, rz: 0.155 },
          { pos: [0, 0.18, 0.21], rx: 0.118, rz: 0.125 },
        ],
        16
      ),
      mats.mount
    );

    // Sculpted Fierce Wolf Head & Face
    const head = addGroup(neckPivot, "mount_head_pivot", [0, 0.18, 0.22]);
    // Cranium + continuous nasal bridge + tapered muzzle (all solid smooth loft facing +Z!)
    addMesh(
      head,
      "wolf_head_sculpt",
      makeLoftedSection(
        [
          { y: -0.09, rx: 0.02, rz: 0.02 },
          { y: -0.04, rx: 0.115, rz: 0.112, squircle: 0.25 },
          { y: 0.04, rx: 0.122, rz: 0.110, frontBulge: 0.08 }, // broad cheekbones & brow
          { y: 0.13, rx: 0.072, rz: 0.066, cz: -0.012 }, // tapered bridge
          { y: 0.23, rx: 0.056, rz: 0.048, cz: -0.018 }, // upper muzzle
          { y: 0.295, rx: 0.038, rz: 0.032, cz: -0.020 },
          { y: 0.312, rx: 0.010, rz: 0.010, cz: -0.020 }, // closed tip
        ],
        22
      ),
      mats.mount,
      [0, 0.0, 0.0],
      [Math.PI / 2 + 0.08, 0, 0]
    );
    // Cheek ruffs + lower jaw (slightly parted for fierce wolf fangs!)
    for (const side of [-1, 1]) {
      addMesh(
        head,
        `wolf_cheek_ruff_${side}`,
        new THREE.ConeGeometry(0.056, 0.135, 8),
        mats.secondary,
        [side * 0.105, -0.018, 0.035],
        [-0.35, side * -0.45, side * -1.15]
      );
      addMesh(
        head,
        `wolf_brow_${side}`,
        new THREE.SphereGeometry(0.028, 10, 8),
        mats.secondary,
        [side * 0.058, 0.072, 0.104],
        [0.10, side * 0.25, side * -0.22],
        [1.05, 0.44, 1.20]
      );
      addExpressiveAnimalEye(
        head,
        `wolf_eye_${side}`,
        [side * 0.064, 0.048, 0.122],
        side * 0.42,
        mats,
        { scale: 1.12, irisMat: mats.metal, browMat: mats.secondary, tiltZ: side * -0.14 }
      );
      // Articulated wolf ears with pale inner fur
      addMesh(
        head,
        `wolf_ear_${side}`,
        new THREE.ConeGeometry(0.050, 0.15, 8),
        mats.mount,
        [side * 0.072, 0.135, 0.005],
        [0.14, side * 0.18, side * -0.24],
        [0.85, 1.0, 0.65]
      );
      addMesh(
        head,
        `wolf_ear_inner_${side}`,
        new THREE.ConeGeometry(0.030, 0.105, 6),
        mats.ivoryDetail,
        [side * 0.073, 0.128, 0.022],
        [0.14, side * 0.18, side * -0.24],
        [0.80, 1.0, 0.45]
      );
      // Upper + lower fangs!
      addMesh(
        head,
        `wolf_fang_${side}`,
        new THREE.ConeGeometry(0.009, 0.034, 6),
        mats.ivoryDetail,
        [side * 0.026, -0.046, 0.252],
        [Math.PI - 0.1, 0, 0]
      );
      addMesh(
        head,
        `wolf_lower_fang_${side}`,
        new THREE.ConeGeometry(0.007, 0.026, 6),
        mats.ivoryDetail,
        [side * 0.022, -0.066, 0.242],
        [0.18, 0, 0]
      );
    }
    // Lower jaw sculpted cleanly & tucked
    addMesh(
      head,
      "wolf_jaw_lower",
      makeLoftedSection(
        [
          { y: -0.02, rx: 0.015, rz: 0.012 },
          { y: 0.02, rx: 0.056, rz: 0.036 },
          { y: 0.13, rx: 0.038, rz: 0.026 },
          { y: 0.19, rx: 0.024, rz: 0.018 },
          { y: 0.21, rx: 0.008, rz: 0.008 },
        ],
        16
      ),
      mats.mount,
      [0, -0.045, 0.085],
      [Math.PI / 2 + 0.24, 0, 0]
    );
    // Dark snout bridge & sculpted triangular wet nose
    addMesh(
      head,
      "wolf_nose",
      new THREE.SphereGeometry(0.028, 12, 10),
      mats.darkDetail,
      [0, 0.002, 0.295],
      [0.2, 0, 0],
      [1.18, 0.85, 1.05]
    );

    // Thick Tapered Sweeping Wolf Tail (closed curve!)
    tailPivot.position.set(0, bodyY + 0.04, -0.45);
    addMesh(
      tailPivot,
      "wolf_tail",
      makeTaperedCurvedTube(
        [
          { pos: [0, 0, 0.04], rx: 0.045, rz: 0.048 },
          { pos: [0, 0.06, -0.14], rx: 0.072, rz: 0.078 },
          { pos: [0, -0.03, -0.34], rx: 0.064, rz: 0.070 },
          { pos: [0, -0.18, -0.47], rx: 0.026, rz: 0.028 },
          { pos: [0, -0.22, -0.50], rx: 0.006, rz: 0.006 },
        ],
        14
      ),
      mats.secondary
    );

    addMountSaddleAndHarness(saddleGroup, mats, {
      bodyY,
      chestZ: 0.45,
      headY: 0.96,
      headZ: 0.56,
      muzzleReinY: 0.92,
      muzzleReinZ: 0.72,
      halfWidth: 0.18,
    });
  } else {
    // =========================================================================
    // ISLAND HORSE / ROYAL STAG / IMPERIAL GRIFFIN (Closed Organic Sculpt + Expressive Faces!)
    // =========================================================================
    const isStag = variant === "royal_stag";
    const isGriffin = variant === "imperial_griffin";
    const bodyMat = mats.mount;
    const bodyY = isStag ? 0.98 : isGriffin ? 0.88 : 0.95;

    // 1. Fully Closed Organic Barrel Torso (zero flat cylinder rims front or rear!)
    addMesh(
      anchor,
      "mount_body",
      makeLoftedSection(
        [
          { y: -0.52, rx: 0.012, rz: 0.012 }, // closed croup end
          { y: -0.46, rx: isStag ? 0.125 : 0.155, rz: 0.145, squircle: 0.25 },
          { y: -0.34, rx: isStag ? 0.165 : isGriffin ? 0.188 : 0.200, rz: 0.195, squircle: 0.28 },
          { y: -0.10, rx: isStag ? 0.168 : isGriffin ? 0.202 : 0.214, rz: 0.218, squircle: 0.28 },
          { y: 0.16, rx: isStag ? 0.174 : isGriffin ? 0.224 : 0.222, rz: 0.232, squircle: 0.30, frontBulge: 0.14 },
          { y: 0.34, rx: isStag ? 0.168 : isGriffin ? 0.220 : 0.212, rz: 0.224, squircle: 0.32, frontBulge: 0.20 },
          { y: 0.44, rx: isStag ? 0.125 : 0.160, rz: 0.165, frontBulge: 0.15 },
          { y: 0.50, rx: 0.075, rz: 0.080 },
          { y: 0.53, rx: 0.012, rz: 0.012 }, // closed chest end
        ],
        28
      ),
      bodyMat,
      [0, bodyY, 0],
      [Math.PI / 2, 0, 0]
    );

    // Sculpted bilateral Chest Pectoral Mounds & Muscular Haunches (no blocky tube appearance from front/back!)
    for (const side of [-1, 1]) {
      addMesh(
        anchor,
        `mount_pectoral_${side}`,
        new THREE.SphereGeometry(isStag ? 0.105 : 0.125, 14, 12),
        bodyMat,
        [side * (isStag ? 0.068 : 0.086), bodyY - 0.025, 0.38],
        [0, 0, 0],
        [0.95, 1.15, 1.05]
      );
      addMesh(
        anchor,
        `mount_haunch_${side}`,
        new THREE.SphereGeometry(isStag ? 0.115 : 0.135, 14, 12),
        bodyMat,
        [side * (isStag ? 0.082 : 0.100), bodyY - 0.01, -0.35],
        [0, 0, 0],
        [0.92, 1.16, 1.15]
      );
    }

    // 2. 4 Jointed Muscular Legs (with shoulder domes, knee/hock spheres, fetlocks & solid feet)
    const mountLegs = [
      { id: "fl", x: isStag ? 0.125 : isGriffin ? 0.175 : 0.15, z: isGriffin ? 0.33 : 0.31, hind: false },
      { id: "fr", x: isStag ? -0.125 : isGriffin ? -0.175 : -0.15, z: isGriffin ? 0.33 : 0.31, hind: false },
      { id: "bl", x: isStag ? 0.125 : isGriffin ? 0.165 : 0.15, z: -0.34, hind: true },
      { id: "br", x: isStag ? -0.125 : isGriffin ? -0.165 : -0.15, z: -0.34, hind: true },
    ];
    for (const lg of mountLegs) {
      const hipY = bodyY - 0.07;
      const kneeY = isGriffin ? 0.42 : 0.44;
      const legR = isStag ? 0.044 : isGriffin ? 0.066 : 0.060;
      const kneeZ = lg.z + (lg.hind ? -0.065 : isGriffin ? 0.055 : 0.025);
      const footZ = kneeZ + (lg.hind ? 0.05 : 0.0);
      const { shinGroup, footVec } = addMountLimbJointed(
        anchor,
        lg.id,
        [lg.x, hipY, lg.z],
        [lg.x, kneeY, kneeZ],
        [lg.x, 0.055, footZ],
        legR * (lg.hind ? 1.55 : 1.32),
        legR * 0.72,
        legR * 0.58,
        bodyMat,
        14
      );

      if (isGriffin && !lg.hind) {
        // Griffin Front Eagle Talons with curved black claws!
        const talon = addGroup(shinGroup, `griffin_talon_${lg.id}`, footVec);
        addMesh(talon, `talon_ank_${lg.id}`, new THREE.SphereGeometry(0.042, 10, 8), mats.metal, [0, -0.015, 0.015]);
        for (const c of [-1, 0, 1]) {
          addMesh(talon, `eagle_toe_${lg.id}_${c}`, new THREE.CapsuleGeometry(0.013, 0.042, 4, 8), mats.metal, [c * 0.025, -0.032, 0.045], [Math.PI / 2.2, 0, c * -0.16]);
          addMesh(talon, `eagle_claw_${lg.id}_${c}`, new THREE.ConeGeometry(0.011, 0.045, 6), mats.darkDetail, [c * 0.030, -0.038, 0.088], [Math.PI / 1.85, 0, c * -0.16]);
        }
      } else if (isGriffin && lg.hind) {
        // Griffin Hind Lion Paws + Claws
        const lPaw = addGroup(shinGroup, `griffin_hindpaw_${lg.id}`, footVec);
        addMesh(lPaw, `lion_paw_${lg.id}`, new THREE.SphereGeometry(0.056, 12, 10), mats.mount, [0, -0.024, 0.025], [0, 0, 0], [1.0, 0.65, 1.35]);
        for (const c of [-1, 0, 1]) {
          addMesh(lPaw, `lion_claw_${lg.id}_${c}`, new THREE.ConeGeometry(0.008, 0.030, 5), mats.darkDetail, [c * 0.022, -0.035, 0.088], [Math.PI / 1.9, 0, 0]);
        }
      } else {
        // Sculpted Fetlock + Angled Solid Equine/Cervid Hoof!
        addMesh(
          shinGroup,
          `mount_fetlock_tuft_${lg.id}`,
          new THREE.ConeGeometry(legR * 0.72, 0.055, 10),
          mats.secondary,
          [footVec[0], footVec[1] + 0.005, footVec[2] - 0.005],
          [Math.PI, 0, 0]
        );
        addMesh(
          shinGroup,
          `mount_hoof_${lg.id}`,
          new THREE.CylinderGeometry(legR * 0.64, legR * 0.88, 0.056, 14),
          mats.darkDetail,
          [footVec[0], footVec[1] - 0.024, footVec[2] + 0.008],
          [0.08, 0, 0]
        );
      }
    }

    // 3. Gracefully Curved Closed Neck (S-arch flowing out of chest!)
    neckPivot.position.set(0, bodyY + 0.05, 0.29);
    const neckEnd = isStag ? [0, 0.45, 0.22] : isGriffin ? [0, 0.39, 0.18] : [0, 0.43, 0.19];
    addMesh(
      neckPivot,
      "mount_neck",
      makeTaperedCurvedTube(
        [
          { pos: [0, -0.06, -0.05], rx: isStag ? 0.115 : 0.148, rz: isStag ? 0.132 : 0.172 },
          { pos: [0, neckEnd[1] * 0.38, neckEnd[2] * 0.22], rx: isStag ? 0.095 : 0.128, rz: isStag ? 0.112 : 0.150 },
          { pos: [0, neckEnd[1] * 0.72, neckEnd[2] * 0.56], rx: isStag ? 0.080 : 0.106, rz: isStag ? 0.095 : 0.125 },
          { pos: neckEnd, rx: isStag ? 0.072 : 0.092, rz: isStag ? 0.085 : 0.105 },
        ],
        18
      ),
      bodyMat
    );

    const head = addGroup(neckPivot, "mount_head_pivot", neckEnd);

    if (variant === "island_horse") {
      // Sweeping Continuous Horse Mane + Charming Forelock!
      addMesh(
        neckPivot,
        "horse_mane_crest",
        makeTaperedCurvedTube(
          [
            { pos: [0, 0.02, -0.07], rx: 0.032, rz: 0.065 },
            { pos: [0, 0.18, -0.03], rx: 0.038, rz: 0.072 },
            { pos: [0, 0.34, 0.05], rx: 0.036, rz: 0.068 },
            { pos: [0, 0.47, 0.14], rx: 0.022, rz: 0.044 },
          ],
          12
        ),
        mats.secondary
      );
      for (let m = 0; m < 6; m++) {
        const f = m / 5;
        addMesh(
          neckPivot,
          `horse_mane_${m}`,
          new THREE.ConeGeometry(0.038, 0.13, 8),
          mats.secondary,
          [0.036, 0.08 + f * 0.34, -0.045 + f * 0.18],
          [0.35, 0.2, -0.85]
        );
      }

      // Sculpted Equine Head Group pitched gracefully forward & slightly down (proud carriage; -Z is forehead/top!)
      const hSkull = addGroup(head, "horse_head_sculpt", [0, 0.01, 0.01], [Math.PI / 2 + 0.36, 0, 0]);
      addMesh(
        hSkull,
        "horse_head",
        makeLoftedSection(
          [
            { y: -0.08, rx: 0.015, rz: 0.015 },
            { y: -0.04, rx: 0.092, rz: 0.100, squircle: 0.25 }, // poll
            { y: 0.04, rx: 0.096, rz: 0.106, squircle: 0.25 }, // cheeks/forehead
            { y: 0.14, rx: 0.064, rz: 0.074, cz: -0.010 }, // nasal bridge (-Z is top ridge)
            { y: 0.25, rx: 0.054, rz: 0.060, cz: -0.014 }, // broad horse muzzle
            { y: 0.295, rx: 0.042, rz: 0.044, cz: -0.014 },
            { y: 0.312, rx: 0.012, rz: 0.012, cz: -0.014 }, // smooth closed nose tip
          ],
          22
        ),
        bodyMat
      );
      // Velvety Contrasting Muzzle Pad + Sculpted Nostrils
      addMesh(
        hSkull,
        "horse_muzzle_pad",
        new THREE.SphereGeometry(0.054, 14, 12),
        mats.secondary,
        [0, 0.255, -0.014],
        [0, 0, 0],
        [0.98, 0.85, 1.04]
      );
      // Forelock tuft sweeping between eyes on crown (-Z)!
      addMesh(
        hSkull,
        "horse_forelock",
        new THREE.ConeGeometry(0.032, 0.11, 8),
        mats.secondary,
        [0, 0.035, -0.105],
        [0.24, 0, 0]
      );
      // Snug Leather + Gold Bridle (Noseband + Cheek Straps + Browband + Bit Rings!)
      addMesh(
        hSkull,
        "horse_bridle_noseband",
        new THREE.TorusGeometry(0.060, 0.009, 8, 18),
        mats.secondary,
        [0, 0.205, -0.014],
        [Math.PI / 2, 0, 0]
      );
      addMesh(
        hSkull,
        "horse_bridle_brow",
        new THREE.TorusGeometry(0.092, 0.009, 8, 18, Math.PI),
        mats.secondary,
        [0, 0.015, -0.032],
        [-2.75, 0, 0]
      );
      addMesh(
        hSkull,
        "horse_bridle",
        new THREE.TorusGeometry(0.050, 0.008, 8, 16),
        mats.metal,
        [0, 0.245, -0.014],
        [Math.PI / 2, 0, 0]
      );
      for (const side of [-1, 1]) {
        // Muscular Jowls / Cheekbones (+Z underside of skull)
        addMesh(
          hSkull,
          `horse_cheek_${side}`,
          new THREE.SphereGeometry(0.054, 12, 10),
          bodyMat,
          [side * 0.056, 0.035, 0.025],
          [0, 0, 0],
          [0.75, 1.15, 0.95]
        );
        // Sculpted Nostrils on upper muzzle bridge (-Z)
        addMesh(
          hSkull,
          `horse_nostril_${side}`,
          new THREE.SphereGeometry(0.014, 8, 8),
          mats.darkDetail,
          [side * 0.030, 0.268, -0.048],
          [0, side * 0.35, 0],
          [0.75, 1.15, 0.6]
        );
        // Cheek bridle straps & Gold bit rings
        addMesh(
          hSkull,
          `horse_cheek_strap_${side}`,
          new THREE.CylinderGeometry(0.007, 0.007, 0.22, 6),
          mats.secondary,
          [side * 0.064, 0.125, -0.020],
          [0.05, 0, side * 0.14]
        );
        addMesh(
          hSkull,
          `horse_bit_ring_${side}`,
          new THREE.TorusGeometry(0.018, 0.0045, 6, 12),
          mats.metal,
          [side * 0.052, 0.240, 0.004],
          [0, Math.PI / 2, 0]
        );
        // Alert Upright Cupped Horse Ears + Inner Ear on crown (-Z pointing UP)
        addMesh(
          hSkull,
          `horse_ear_${side}`,
          new THREE.ConeGeometry(0.028, 0.115, 8),
          bodyMat,
          [side * 0.055, -0.025, -0.088],
          [-Math.PI / 2 - 0.15, side * 0.18, side * -0.22],
          [0.85, 1.0, 0.65]
        );
        addMesh(
          hSkull,
          `horse_ear_inner_${side}`,
          new THREE.ConeGeometry(0.016, 0.078, 6),
          mats.secondary,
          [side * 0.055, -0.018, -0.088],
          [-Math.PI / 2 - 0.15, side * 0.18, side * -0.22],
          [0.75, 1.0, 0.45]
        );
        // Expressive Equine Eyes level on temples!
        addExpressiveAnimalEye(
          head,
          `horse_eye_${side}`,
          [side * 0.070, 0.052, 0.088],
          side * 0.66,
          mats,
          { scale: 1.08, irisMat: mats.eyes, browMat: bodyMat }
        );
      }

      // Lush Dock + Cascading Horse Tail (zero air gap at croup!)
      tailPivot.position.set(0, bodyY + 0.05, -0.45);
      addMesh(
        tailPivot,
        "horse_tail_dock",
        new THREE.SphereGeometry(0.064, 12, 10),
        mats.secondary,
        [0, 0, 0.01],
        [0, 0, 0],
        [0.85, 1.0, 1.25]
      );
      addMesh(
        tailPivot,
        "horse_tail",
        makeTaperedCurvedTube(
          [
            { pos: [0, 0.0, 0.0], rx: 0.055, rz: 0.055 },
            { pos: [0, -0.10, -0.13], rx: 0.068, rz: 0.072 },
            { pos: [0, -0.34, -0.17], rx: 0.052, rz: 0.056 },
            { pos: [0, -0.56, -0.15], rx: 0.018, rz: 0.020 },
            { pos: [0, -0.60, -0.14], rx: 0.005, rz: 0.005 },
          ],
          12
        ),
        mats.secondary
      );

      addMountSaddleAndHarness(saddleGroup, mats, {
        bodyY,
        chestZ: 0.49,
        headY: 1.44,
        headZ: 0.48,
        muzzleReinY: 1.35,
        muzzleReinZ: 0.71,
        halfWidth: 0.19,
      });
    } else if (isStag) {
      // =========================================================================
      // CERVO REAL: Form-fitting Fur Neck Mantle + Ivory Throat Patch, Sculpted
      // Cervid Head with Expressive Eyes & Nostrils, Coronet-Burr Antlers!
      // =========================================================================
      // Snug contoured chest & throat fur collar + ivory blaze (zero awkward poking chunks!)
      addMesh(
        neckPivot,
        "stag_chest_ruff",
        makeTaperedCurvedTube(
          [
            { pos: [0, -0.06, -0.02], rx: 0.155, rz: 0.168 },
            { pos: [0, 0.07, 0.05], rx: 0.128, rz: 0.142 },
            { pos: [0, 0.20, 0.11], rx: 0.098, rz: 0.110 },
          ],
          18
        ),
        mats.secondary
      );
      addMesh(
        neckPivot,
        "stag_ivory_blaze",
        makeTaperedCurvedTube(
          [
            { pos: [0, -0.05, 0.06], rx: 0.078, rz: 0.065 },
            { pos: [0, 0.10, 0.12], rx: 0.062, rz: 0.055 },
            { pos: [0, 0.25, 0.17], rx: 0.044, rz: 0.040 },
          ],
          12
        ),
        mats.ivoryDetail
      );

      // Sculpted Graceful Stag Head facing proud (+Z angled softly down; -Z is crown/bridge!)
      const sSkull = addGroup(head, "stag_head_sculpt", [0, 0.01, 0.01], [Math.PI / 2 + 0.32, 0, 0]);
      addMesh(
        sSkull,
        "stag_head",
        makeLoftedSection(
          [
            { y: -0.08, rx: 0.015, rz: 0.015 },
            { y: -0.04, rx: 0.082, rz: 0.088, squircle: 0.22 },
            { y: 0.03, rx: 0.086, rz: 0.092, squircle: 0.22 }, // brows/temples
            { y: 0.13, rx: 0.050, rz: 0.060, cz: -0.010 }, // slender nasal bridge (-Z top ridge)
            { y: 0.23, rx: 0.038, rz: 0.042, cz: -0.014 }, // fine cervid muzzle
            { y: 0.28, rx: 0.028, rz: 0.028, cz: -0.014 },
            { y: 0.295, rx: 0.008, rz: 0.008, cz: -0.014 },
          ],
          20
        ),
        bodyMat
      );
      // Pale chin underside (+Z) & Contoured Wet Dark Nose!
      addMesh(
        sSkull,
        "stag_chin_patch",
        new THREE.SphereGeometry(0.032, 10, 8),
        mats.ivoryDetail,
        [0, 0.225, 0.014],
        [0, 0, 0],
        [0.95, 1.35, 0.72]
      );
      addMesh(
        sSkull,
        "stag_nose",
        new THREE.SphereGeometry(0.024, 12, 10),
        mats.darkDetail,
        [0, 0.282, -0.014],
        [0, 0, 0],
        [1.15, 0.85, 1.05]
      );

      for (const side of [-1, 1]) {
        // Leaf-shaped deer ears with ivory inner cups on crown (-Z pointing upward/outward cleanly below antlers!)
        addMesh(
          sSkull,
          `stag_ear_${side}`,
          new THREE.ConeGeometry(0.034, 0.135, 8),
          bodyMat,
          [side * 0.072, -0.025, -0.070],
          [-Math.PI / 2 - 0.10, side * 0.22, side * -0.52],
          [0.85, 1.0, 0.45]
        );
        addMesh(
          sSkull,
          `stag_ear_inner_${side}`,
          new THREE.ConeGeometry(0.020, 0.095, 6),
          mats.ivoryDetail,
          [side * 0.072, -0.018, -0.070],
          [-Math.PI / 2 - 0.10, side * 0.22, side * -0.52],
          [0.75, 1.0, 0.30]
        );
        // Expressive Noble Cervid Eyes level on temples!
        addExpressiveAnimalEye(
          head,
          `stag_eye_${side}`,
          [side * 0.062, 0.048, 0.080],
          side * 0.64,
          mats,
          { scale: 1.05, irisMat: mats.eyes, browMat: bodyMat }
        );
      }

      // Grand Branching Tapered Stag Antlers anchored with Golden Coronet Burrs!
      for (const side of [-1, 1]) {
        addMesh(
          head,
          `antler_burr_${side}`,
          new THREE.CylinderGeometry(0.032, 0.028, 0.035, 10),
          mats.metal,
          [side * 0.048, 0.088, 0.005],
          [0.18, 0, side * -0.35]
        );
        addMesh(
          head,
          `antler_beam_${side}`,
          makeTaperedCurvedTube(
            [
              { pos: [side * 0.048, 0.090, 0.005], rx: 0.022 },
              { pos: [side * 0.19, 0.24, 0.00], rx: 0.018 },
              { pos: [side * 0.36, 0.43, 0.03], rx: 0.014 },
              { pos: [side * 0.41, 0.61, 0.10], rx: 0.008 },
              { pos: [side * 0.42, 0.66, 0.13], rx: 0.003 },
            ],
            10
          ),
          mats.metal
        );
        addMesh(
          head,
          `antler_brow_tine_${side}`,
          makeTaperedCurvedTube(
            [
              { pos: [side * 0.082, 0.13, 0.015], rx: 0.016 },
              { pos: [side * 0.145, 0.22, 0.17], rx: 0.012 },
              { pos: [side * 0.135, 0.33, 0.24], rx: 0.007 },
              { pos: [side * 0.125, 0.37, 0.26], rx: 0.0025 },
            ],
            8
          ),
          mats.metal
        );
        addMesh(
          head,
          `antler_crown_fork_${side}`,
          makeTaperedCurvedTube(
            [
              { pos: [side * 0.28, 0.35, 0.015], rx: 0.015 },
              { pos: [side * 0.32, 0.50, 0.17], rx: 0.011 },
              { pos: [side * 0.28, 0.63, 0.22], rx: 0.006 },
              { pos: [side * 0.26, 0.67, 0.23], rx: 0.0025 },
            ],
            8
          ),
          mats.metal
        );
      }

      // Anchored Flush Sculpted White-Trimmed Deer Scut Tail (zero gap!)
      tailPivot.position.set(0, bodyY + 0.04, -0.46);
      addMesh(
        tailPivot,
        "stag_tail_under",
        new THREE.SphereGeometry(0.046, 10, 8),
        mats.ivoryDetail,
        [0, 0.0, 0.0],
        [-0.35, 0, 0],
        [0.85, 1.45, 0.72]
      );
      addMesh(
        tailPivot,
        "stag_tail",
        new THREE.ConeGeometry(0.042, 0.13, 10),
        bodyMat,
        [0, 0.02, -0.025],
        [-0.65, 0, 0],
        [0.82, 1.0, 0.65]
      );

      addMountSaddleAndHarness(saddleGroup, mats, {
        bodyY,
        chestZ: 0.46,
        headY: 1.48,
        headZ: 0.52,
        muzzleReinY: 1.42,
        muzzleReinZ: 0.72,
        halfWidth: 0.165,
      });
    } else if (isGriffin) {
      // =========================================================================
      // GRIFO IMPERIAL: Eagle Cranium + Swept Plumes, Two-Part Hooked Beak,
      // Parrot-Grade Fierce Eyes, Feathered Hackles, Sweeping Layered Wings!
      // =========================================================================
      // Sculpted Feathered Collar Hackles bridging neck cleanly into chest
      addMesh(
        neckPivot,
        "griffin_hackles",
        makeLoftedSection(
          [
            { y: -0.06, rx: 0.02, rz: 0.02 },
            { y: 0.04, rx: 0.185, rz: 0.195, foldFreq: 9, foldAmp: 0.10 },
            { y: 0.18, rx: 0.155, rz: 0.165, foldFreq: 9, foldAmp: 0.09 },
            { y: 0.30, rx: 0.118, rz: 0.125 },
            { y: 0.36, rx: 0.02, rz: 0.02 },
          ],
          24
        ),
        mats.secondary,
        [0, -0.02, 0.02],
        [0.36, 0, 0]
      );

      // Eagle Head Cranium + Swept Crest Plumes
      addMesh(
        head,
        "griffin_eagle_head",
        makeLoftedSection(
          [
            { y: -0.09, rx: 0.02, rz: 0.02 },
            { y: -0.03, rx: 0.108, rz: 0.108 },
            { y: 0.05, rx: 0.102, rz: 0.098 },
            { y: 0.12, rx: 0.068, rz: 0.064 },
            { y: 0.15, rx: 0.02, rz: 0.02 },
          ],
          20
        ),
        bodyMat,
        [0, 0.02, 0.0],
        [Math.PI / 2, 0, 0]
      );
      // 3 Arched Eagle Crest Feathers!
      for (let c = -1; c <= 1; c++) {
        addMesh(
          head,
          `griffin_crest_${c + 1}`,
          makeTaperedCurvedTube(
            [
              { pos: [c * 0.018, 0.09, 0.04], rx: 0.016 },
              { pos: [c * 0.035, 0.135, -0.05], rx: 0.015 },
              { pos: [c * 0.050, 0.115, -0.15], rx: 0.008 },
              { pos: [c * 0.055, 0.095, -0.19], rx: 0.0025 },
            ],
            8
          ),
          mats.secondary
        );
      }

      // Cere + Sculpted Two-Part Hooked Eagle Beak (upper hooked mandible + lower mandible!)
      addMesh(
        head,
        "griffin_cere",
        new THREE.SphereGeometry(0.052, 12, 10),
        mats.metal,
        [0, 0.026, 0.118],
        [0, 0, 0],
        [0.88, 0.78, 0.85]
      );
      addMesh(
        head,
        "griffin_beak",
        makeTaperedCurvedTube(
          [
            { pos: [0, 0.022, 0.12], rx: 0.042, rz: 0.038 },
            { pos: [0, 0.012, 0.21], rx: 0.032, rz: 0.026 },
            { pos: [0, -0.032, 0.26], rx: 0.016, rz: 0.014 },
            { pos: [0, -0.072, 0.245], rx: 0.004, rz: 0.004 },
          ],
          12
        ),
        mats.metal
      );
      addMesh(
        head,
        "griffin_lower_beak",
        new THREE.ConeGeometry(0.024, 0.085, 8),
        mats.secondary,
        [0, -0.014, 0.175],
        [Math.PI / 1.85, 0, 0],
        [0.9, 1.0, 0.65]
      );

      for (const side of [-1, 1]) {
        // Swept feathered ear tufts + Fierce angled raptor brow hood + Parrot-grade Eyes!
        addMesh(
          head,
          `griffin_ear_tuft_${side}`,
          new THREE.ConeGeometry(0.028, 0.14, 8),
          mats.secondary,
          [side * 0.078, 0.095, -0.03],
          [-0.45, side * -0.18, side * -0.52]
        );
        addMesh(
          head,
          `griffin_brow_hood_${side}`,
          new THREE.BoxGeometry(0.034, 0.012, 0.052),
          bodyMat,
          [side * 0.068, 0.065, 0.082],
          [0.24, side * 0.42, side * -0.26]
        );
        addExpressiveAnimalEye(
          head,
          `griffin_eye_${side}`,
          [side * 0.076, 0.042, 0.090],
          side * 0.56,
          mats,
          { scale: 1.12, irisMat: mats.metal, browMat: bodyMat, tiltZ: side * -0.18 }
        );

        // Sweeping Multi-Layered Feathered Eagle Wings positioned cleanly BEHIND saddle!
        const wingPivot = addGroup(
          anchor,
          side > 0 ? "mount_wing_l" : "mount_wing_r",
          [side * 0.20, bodyY + 0.15, -0.08],
          [-0.08, side * 0.58, side * -0.16]
        );
        const wingShape = new THREE.Shape();
        wingShape.moveTo(0, 0.04);
        wingShape.quadraticCurveTo(side * 0.36, 0.56, side * 0.86, 0.66);
        wingShape.lineTo(side * 0.75, 0.34);
        wingShape.lineTo(side * 0.60, 0.18);
        wingShape.lineTo(side * 0.44, 0.06);
        wingShape.quadraticCurveTo(side * 0.20, -0.05, 0, -0.06);
        wingShape.closePath();
        addMesh(
          wingPivot,
          `wing_primary_${side}`,
          makeBeveledShape(wingShape, 0.028, 0.008, 0.008),
          bodyMat
        );
        addMesh(
          wingPivot,
          `wing_coverts_${side}`,
          makeBeveledShape(wingShape, 0.036, 0.008, 0.008),
          mats.metal,
          [side * 0.01, -0.02, 0.022],
          [0, 0, 0],
          [0.64, 0.64, 1]
        );
      }

      // Tapered Lion Tail + Bushy Terminal Tuft (zero air gap!)
      tailPivot.position.set(0, bodyY + 0.03, -0.45);
      addMesh(
        tailPivot,
        "lion_tail_shaft",
        makeTaperedCurvedTube(
          [
            { pos: [0, 0, 0.03], rx: 0.032 },
            { pos: [0.03, 0.08, -0.20], rx: 0.026 },
            { pos: [0.02, -0.10, -0.41], rx: 0.022 },
          ],
          10
        ),
        bodyMat
      );
      addMesh(
        tailPivot,
        "lion_tail_tuft",
        new THREE.ConeGeometry(0.056, 0.14, 10),
        mats.secondary,
        [0.02, -0.14, -0.45],
        [-2.2, 0, 0]
      );

      addMountSaddleAndHarness(saddleGroup, mats, {
        bodyY,
        chestZ: 0.48,
        headY: 1.32,
        headZ: 0.49,
        muzzleReinY: 1.20,
        muzzleReinZ: 0.56,
        halfWidth: 0.19,
      });
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

  addMesh(root, "plinth_base", new THREE.CylinderGeometry(0.84, 0.90, 0.09, 6), mats.secondary, [0, -0.115, 0]);
  addMesh(root, "plinth_top", new THREE.CylinderGeometry(0.74, 0.80, 0.07, 6), mats.secondary, [0, -0.035, 0]);
  addMesh(root, "plinth_trim_ring", new THREE.TorusGeometry(0.77, 0.018, 8, 6), mats.metal, [0, -0.005, 0], [Math.PI / 2, 0, Math.PI / 6]);

  if (variant === "runic_gold" || variant === "obsidian_crown") {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      const px = Math.cos(a) * 0.80;
      const pz = Math.sin(a) * 0.80;
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
// Build All 55 Modular Articulated Assets
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
    `[build_starter_3d_assets] Built ${jobs.length} articulated .glb assets (${(totalBytes / 1024).toFixed(1)} KB total) under ${MODELS_ROOT}`
  );
}

main();
