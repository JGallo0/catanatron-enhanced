import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MODELS_ROOT = path.resolve(__dirname, "../public/assets/models/avatars");

const CHUNK_TYPE_JSON = 0x4e4f534a;
const CHUNK_TYPE_BIN = 0x004e4942;

export const AVATAR_MODEL_MANIFEST = [
  // bodies/
  { relPath: "bodies/athletic.glb", allOf: ["mat_skin"] },
  { relPath: "bodies/sturdy.glb", allOf: ["mat_skin"] },
  { relPath: "bodies/slender.glb", allOf: ["mat_skin"] },

  // heads/
  { relPath: "heads/oval.glb", allOf: ["mat_skin", "mat_eyes", "mat_hair", "mat_secondary"] },
  { relPath: "heads/square.glb", allOf: ["mat_skin", "mat_eyes", "mat_hair", "mat_secondary"] },
  { relPath: "heads/heart.glb", allOf: ["mat_skin", "mat_eyes", "mat_hair", "mat_secondary"] },
  { relPath: "heads/chiseled.glb", allOf: ["mat_skin", "mat_eyes", "mat_hair", "mat_secondary"] },

  // hair/
  { relPath: "hair/short.glb", allOf: ["mat_hair"] },
  { relPath: "hair/wavy.glb", allOf: ["mat_hair"] },
  { relPath: "hair/bun.glb", allOf: ["mat_hair"] },
  { relPath: "hair/braids.glb", allOf: ["mat_hair"] },
  { relPath: "hair/curly.glb", allOf: ["mat_hair"] },
  { relPath: "hair/long.glb", allOf: ["mat_hair"] },
  { relPath: "hair/navigator.glb", allOf: ["mat_hair"] },
  { relPath: "hair/royal_bun.glb", allOf: ["mat_hair"] },

  // beards/
  { relPath: "beards/goatee.glb", allOf: ["mat_hair"] },
  { relPath: "beards/full.glb", allOf: ["mat_hair"] },
  { relPath: "beards/mustache.glb", allOf: ["mat_hair"] },
  { relPath: "beards/captain_trimmed.glb", allOf: ["mat_hair"] },
  { relPath: "beards/full_viking.glb", allOf: ["mat_hair"] },

  // outfits/
  { relPath: "outfits/settler.glb", allOf: ["mat_primary", "mat_secondary", "mat_metal"] },
  { relPath: "outfits/captain.glb", allOf: ["mat_primary", "mat_secondary", "mat_metal"] },
  { relPath: "outfits/armor.glb", allOf: ["mat_primary", "mat_secondary", "mat_metal"] },
  { relPath: "outfits/merchant.glb", allOf: ["mat_primary", "mat_secondary", "mat_metal"] },
  { relPath: "outfits/imperial_lord.glb", allOf: ["mat_primary", "mat_secondary", "mat_metal"] },

  // legs/
  { relPath: "legs/traveler.glb", allOf: ["mat_primary", "mat_secondary", "mat_metal"] },
  { relPath: "legs/cuffed_boots.glb", allOf: ["mat_primary", "mat_secondary", "mat_metal"] },
  { relPath: "legs/greaves.glb", allOf: ["mat_primary", "mat_secondary", "mat_metal"] },
  { relPath: "legs/royal_greaves.glb", allOf: ["mat_primary", "mat_secondary", "mat_metal"] },

  // capes/
  { relPath: "capes/traveler.glb", allOf: ["mat_primary", "mat_secondary", "mat_metal"] },
  { relPath: "capes/navy_commander.glb", allOf: ["mat_primary", "mat_secondary", "mat_metal"] },
  { relPath: "capes/royal_mantle.glb", allOf: ["mat_primary", "mat_secondary", "mat_metal"] },

  // hats/
  { relPath: "hats/captain.glb", anyOf: ["mat_primary", "mat_metal"] },
  { relPath: "hats/explorer.glb", anyOf: ["mat_primary", "mat_metal"] },
  { relPath: "hats/bandana.glb", anyOf: ["mat_primary", "mat_metal"] },
  { relPath: "hats/helm.glb", anyOf: ["mat_primary", "mat_metal"] },
  { relPath: "hats/crown_gold.glb", anyOf: ["mat_primary", "mat_metal"] },
  { relPath: "hats/admiral_bicorne.glb", anyOf: ["mat_primary", "mat_metal"] },

  // props_hand/
  { relPath: "props_hand/spyglass.glb", allOf: ["mat_metal", "mat_secondary"] },
  { relPath: "props_hand/scroll.glb", allOf: ["mat_metal", "mat_secondary"] },
  { relPath: "props_hand/royal_scepter.glb", allOf: ["mat_metal", "mat_secondary"] },
  { relPath: "props_hand/sun_rapier.glb", allOf: ["mat_metal", "mat_secondary"] },

  // props_back/
  { relPath: "props_back/explorer_pack.glb", allOf: ["mat_backpack", "mat_secondary", "mat_metal"] },
  { relPath: "props_back/sheathed_sword.glb", allOf: ["mat_primary", "mat_secondary", "mat_metal"] },
  { relPath: "props_back/imperial_shield.glb", allOf: ["mat_primary", "mat_secondary", "mat_metal"] },

  // pets/
  { relPath: "pets/owl.glb", allOf: ["mat_primary", "mat_secondary", "mat_metal"] },
  { relPath: "pets/parrot.glb", allOf: ["mat_primary", "mat_secondary", "mat_metal"] },
  { relPath: "pets/falcon.glb", allOf: ["mat_primary", "mat_secondary", "mat_metal"] },

  // mounts/
  { relPath: "mounts/island_horse.glb", allOf: ["mat_mount", "mat_secondary", "mat_metal"] },
  { relPath: "mounts/snow_wolf.glb", allOf: ["mat_mount", "mat_secondary", "mat_metal"] },
  { relPath: "mounts/royal_stag.glb", allOf: ["mat_mount", "mat_secondary", "mat_metal"] },
  { relPath: "mounts/imperial_griffin.glb", allOf: ["mat_mount", "mat_secondary", "mat_metal"] },

  // pedestals/
  { relPath: "pedestals/stone_wood.glb", allOf: ["mat_secondary", "mat_metal"] },
  { relPath: "pedestals/runic_gold.glb", allOf: ["mat_secondary", "mat_metal"] },
  { relPath: "pedestals/obsidian_crown.glb", allOf: ["mat_secondary", "mat_metal"] },
];

const REQUIRED_ARTICULATED_NODES_BY_PREFIX = {
  "bodies/": [
    "rig_hips",
    "rig_torso",
    "rig_thigh_l",
    "rig_calf_l",
    "rig_foot_l",
    "rig_hand_l",
    "rig_hand_r",
    "sculpted_hand_l",
    "sculpted_hand_r",
  ],
  "outfits/": [
    "rig_hips",
    "rig_torso",
    "rig_skirt_front",
    "rig_skirt_back",
    "rig_shoulder_l",
    "rig_forearm_r",
  ],
  "legs/": [
    "rig_hips",
    "rig_thigh_l",
    "rig_calf_l",
    "rig_foot_l",
    "rig_thigh_r",
    "rig_calf_r",
    "rig_foot_r",
  ],
  "capes/": ["rig_cape_collar", "rig_cape_drape"],
  "hair/": ["hair_crown_mass", "hair_lower_flow"],
};

const REQUIRED_SPECIFIC_NODES = {
  "pets/owl.glb": ["owl_facial_disc", "owl_ear_tuft_1"],
  "pets/parrot.glb": ["parrot_upper_bill", "parrot_long_tail_0"],
  "pets/falcon.glb": ["falcon_brow_1", "falcon_wing_1"],
  "mounts/snow_wolf.glb": ["wolf_fang_1", "wolf_paw_fl", "wolf_ruff_spike_0"],
  "mounts/royal_stag.glb": ["antler_beam_1", "antler_brow_tine_1", "antler_crown_fork_1"],
  "mounts/imperial_griffin.glb": ["griffin_beak", "mount_wing_l", "griffin_talon_fl"],
};

function normalizeMaterialKey(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\.\d+$/, "");
}

function verifyGlbFile(entry) {
  const fullPath = path.join(MODELS_ROOT, entry.relPath);
  if (!fs.existsSync(fullPath)) {
    return { ok: false, error: "File does not exist" };
  }
  const buf = fs.readFileSync(fullPath);
  if (buf.length < 28) {
    return { ok: false, error: `File too small (${buf.length} bytes)` };
  }

  const magic = buf.toString("ascii", 0, 4);
  const version = buf.readUInt32LE(4);
  const declaredLength = buf.readUInt32LE(8);
  if (magic !== "glTF") {
    return { ok: false, error: `Invalid magic "${magic}" (expected "glTF")` };
  }
  if (version !== 2) {
    return { ok: false, error: `Invalid version ${version} (expected 2)` };
  }
  if (declaredLength !== buf.length) {
    return {
      ok: false,
      error: `Header length ${declaredLength} !== actual file length ${buf.length}`,
    };
  }

  const chunk0Len = buf.readUInt32LE(12);
  const chunk0Type = buf.readUInt32LE(16);
  if (chunk0Type !== CHUNK_TYPE_JSON) {
    return {
      ok: false,
      error: `Chunk 0 type 0x${chunk0Type.toString(16)} !== JSON`,
    };
  }
  const chunk0Start = 20;
  const chunk0End = chunk0Start + chunk0Len;
  if (chunk0End > buf.length) {
    return { ok: false, error: "JSON chunk exceeds file length" };
  }

  let gltf;
  try {
    gltf = JSON.parse(buf.toString("utf8", chunk0Start, chunk0End));
  } catch (err) {
    return { ok: false, error: `Invalid JSON chunk: ${err.message}` };
  }

  if (chunk0End < buf.length) {
    if (chunk0End + 8 > buf.length) {
      return { ok: false, error: "Truncated BIN chunk header" };
    }
    const chunk1Len = buf.readUInt32LE(chunk0End);
    const chunk1Type = buf.readUInt32LE(chunk0End + 4);
    if (chunk1Type !== CHUNK_TYPE_BIN) {
      return {
        ok: false,
        error: `Chunk 1 type 0x${chunk1Type.toString(16)} !== BIN`,
      };
    }
    if (chunk0End + 8 + chunk1Len !== buf.length) {
      return { ok: false, error: "BIN chunk length mismatch" };
    }
  }

  if (!gltf.asset || gltf.asset.version !== "2.0") {
    return { ok: false, error: `Invalid glTF asset.version "${gltf.asset?.version}"` };
  }
  if (!Array.isArray(gltf.meshes) || gltf.meshes.length === 0) {
    return { ok: false, error: "Non-empty meshes array required" };
  }
  if (!Array.isArray(gltf.accessors) || gltf.accessors.length === 0) {
    return { ok: false, error: "Non-empty accessors array required" };
  }
  if (!Array.isArray(gltf.bufferViews) || gltf.bufferViews.length === 0) {
    return { ok: false, error: "Non-empty bufferViews array required" };
  }
  if (!Array.isArray(gltf.buffers) || gltf.buffers.length === 0) {
    return { ok: false, error: "Non-empty buffers array required" };
  }

  for (const mesh of gltf.meshes) {
    if (!Array.isArray(mesh.primitives) || mesh.primitives.length === 0) {
      return { ok: false, error: `Mesh "${mesh.name || "unnamed"}" has no primitives` };
    }
    for (const prim of mesh.primitives) {
      if (prim.attributes?.POSITION === undefined) {
        return { ok: false, error: `Mesh "${mesh.name || "unnamed"}" primitive missing POSITION` };
      }
      if (prim.material === undefined || !gltf.materials?.[prim.material]) {
        return { ok: false, error: `Mesh "${mesh.name || "unnamed"}" primitive missing valid material` };
      }
    }
  }

  const rawMatNames = (gltf.materials || []).map((m) => m?.name).filter(Boolean);
  const normalizedMats = new Set(rawMatNames.map(normalizeMaterialKey));

  if (entry.allOf) {
    const missing = entry.allOf.filter((req) => !normalizedMats.has(req));
    if (missing.length > 0) {
      return {
        ok: false,
        error: `Missing required material(s): ${missing.join(", ")} (found: ${rawMatNames.join(", ") || "none"})`,
      };
    }
  }
  if (entry.anyOf) {
    const hasOne = entry.anyOf.some((req) => normalizedMats.has(req));
    if (!hasOne) {
      return {
        ok: false,
        error: `Missing at least one material from [${entry.anyOf.join(", ")}] (found: ${rawMatNames.join(", ") || "none"})`,
      };
    }
  }

  const nodeNames = new Set((gltf.nodes || []).map((n) => n?.name).filter(Boolean));
  for (const [prefix, reqNodes] of Object.entries(REQUIRED_ARTICULATED_NODES_BY_PREFIX)) {
    if (entry.relPath.startsWith(prefix)) {
      const missingNodes = reqNodes.filter((n) => !nodeNames.has(n));
      if (missingNodes.length > 0) {
        return {
          ok: false,
          error: `Missing required articulated node(s): ${missingNodes.join(", ")}`,
        };
      }
    }
  }
  const exactReq = REQUIRED_SPECIFIC_NODES[entry.relPath];
  if (exactReq) {
    const missingExact = exactReq.filter((n) => !nodeNames.has(n));
    if (missingExact.length > 0) {
      return {
        ok: false,
        error: `Missing required species node(s): ${missingExact.join(", ")}`,
      };
    }
  }

  return {
    ok: true,
    bytes: buf.length,
    meshes: gltf.meshes.length,
    materials: rawMatNames,
  };
}

function main() {
  let passed = 0;
  const failures = [];

  for (const entry of AVATAR_MODEL_MANIFEST) {
    const result = verifyGlbFile(entry);
    if (result.ok) {
      passed += 1;
    } else {
      failures.push({ relPath: entry.relPath, error: result.error });
    }
  }

  if (failures.length > 0) {
    console.error(
      `[verify_starter_3d_assets] FAIL: ${passed}/${AVATAR_MODEL_MANIFEST.length} valid, ${failures.length} failed:`
    );
    for (const f of failures) {
      console.error(`  - ${f.relPath}: ${f.error}`);
    }
    process.exit(1);
  }

  console.log(
    `[verify_starter_3d_assets] PASS: ${passed}/${AVATAR_MODEL_MANIFEST.length} .glb assets verified under ${MODELS_ROOT}`
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}
