import * as THREE from "three";
import type { AvatarColors } from "../../utils/api.types";

export const RESERVED_MATERIAL_COLOR_MAP: Record<string, keyof AvatarColors> = {
  mat_skin: "skin",
  mat_hair: "hair",
  mat_eyes: "eyes",
  mat_primary: "outfitPrimary",
  mat_secondary: "outfitSecondary",
  mat_metal: "outfitTrim",
  mat_mount: "mount",
};

type ColorableMaterial =
  | THREE.MeshStandardMaterial
  | THREE.MeshPhysicalMaterial
  | THREE.MeshBasicMaterial;

export function normalizeMaterialName(name: string | undefined | null): string {
  return String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/\.\d+$/, "");
}

function isColorableMaterial(mat: THREE.Material): mat is ColorableMaterial {
  if (
    mat instanceof THREE.MeshStandardMaterial ||
    mat instanceof THREE.MeshPhysicalMaterial ||
    mat instanceof THREE.MeshBasicMaterial
  ) {
    return true;
  }
  const flags = mat as unknown as {
    isMeshStandardMaterial?: boolean;
    isMeshPhysicalMaterial?: boolean;
    isMeshBasicMaterial?: boolean;
  };
  return Boolean(
    flags.isMeshStandardMaterial ||
      flags.isMeshPhysicalMaterial ||
      flags.isMeshBasicMaterial
  );
}

function tintMaterial(
  mat: THREE.Material,
  colors: AvatarColors,
  clonedBySource: Map<THREE.Material, THREE.Material>
): THREE.Material {
  if (!isColorableMaterial(mat)) {
    return mat;
  }

  const normalized = normalizeMaterialName(mat.name);
  const channel = RESERVED_MATERIAL_COLOR_MAP[normalized];
  if (!channel) {
    return mat;
  }

  const hex = colors[channel];
  if (typeof hex !== "string" || !hex.trim()) {
    return mat;
  }

  if (mat.userData?.__avatarCloned === true) {
    mat.color.set(hex);
    return mat;
  }

  const existingClone = clonedBySource.get(mat);
  if (existingClone && isColorableMaterial(existingClone)) {
    existingClone.color.set(hex);
    return existingClone;
  }

  const cloned = mat.clone();
  cloned.userData = {
    ...mat.userData,
    __avatarCloned: true,
  };
  delete cloned.userData.__gltfCached;
  cloned.color.set(hex);
  clonedBySource.set(mat, cloned);
  return cloned;
}

export function applyAvatarMaterials(
  root: THREE.Object3D,
  colors: AvatarColors
): void {
  const clonedBySource = new Map<THREE.Material, THREE.Material>();

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) {
      return;
    }

    if (Array.isArray(mesh.material)) {
      let changed = false;
      const nextMaterials = mesh.material.map((mat) => {
        if (!mat) return mat;
        const tinted = tintMaterial(mat, colors, clonedBySource);
        if (tinted !== mat) changed = true;
        return tinted;
      });
      if (changed) {
        mesh.material = nextMaterials;
      }
    } else {
      const tinted = tintMaterial(mesh.material, colors, clonedBySource);
      if (tinted !== mesh.material) {
        mesh.material = tinted;
      }
    }
  });
}
