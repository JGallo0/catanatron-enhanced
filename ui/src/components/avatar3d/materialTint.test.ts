import * as THREE from "three";
import { describe, expect, test } from "vitest";
import type { AvatarColors } from "../../utils/api.types";
import { applyAvatarMaterials, normalizeMaterialName } from "./materialTint";

const TEST_COLORS: AvatarColors = {
  skin: "#f3cfb3",
  hair: "#c2410c",
  eyes: "#0284c7",
  outfitPrimary: "#dc2626",
  outfitSecondary: "#1e3a8a",
  outfitTrim: "#facc15",
  mount: "#854d0e",
};

const ALT_COLORS: AvatarColors = {
  skin: "#633722",
  hair: "#eab308",
  eyes: "#16a34a",
  outfitPrimary: "#059669",
  outfitSecondary: "#78350f",
  outfitTrim: "#38bdf8",
  mount: "#e2e8f0",
};

function expectMaterialHex(mat: THREE.Material, hex: string): void {
  const colored = mat as THREE.MeshStandardMaterial;
  const expected = new THREE.Color(hex);
  expect(colored.color.getHexString()).toBe(expected.getHexString());
}

describe("materialTint", () => {
  test("normalizes material names by trimming, lowercasing, and stripping Blender .001 suffixes", () => {
    expect(normalizeMaterialName("mat_skin")).toBe("mat_skin");
    expect(normalizeMaterialName("  MAT_PRIMARY.001  ")).toBe("mat_primary");
    expect(normalizeMaterialName("Mat_Metal.012")).toBe("mat_metal");
    expect(normalizeMaterialName("mat_sclera.002")).toBe("mat_sclera");
  });

  test("applies all 7 reserved material channels across Standard, Physical, Basic, and array materials", () => {
    const group = new THREE.Group();

    const matSkin = new THREE.MeshStandardMaterial({ name: "mat_skin", color: "#ffffff" });
    const matHair = new THREE.MeshStandardMaterial({ name: "MAT_HAIR.001", color: "#ffffff" });
    const matEyes = new THREE.MeshBasicMaterial({ name: "  mat_eyes.002 ", color: "#ffffff" });
    const matPrimary = new THREE.MeshPhysicalMaterial({ name: "mat_primary", color: "#ffffff" });
    const matSecondary = new THREE.MeshStandardMaterial({ name: "mat_secondary.003", color: "#ffffff" });
    const matMetal = new THREE.MeshStandardMaterial({ name: "mat_metal", color: "#ffffff" });
    const matMount = new THREE.MeshStandardMaterial({ name: "mat_mount", color: "#ffffff" });

    const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(), matSkin);
    const headMesh = new THREE.Mesh(new THREE.BoxGeometry(), [matHair, matEyes]);
    const coatMesh = new THREE.Mesh(new THREE.BoxGeometry(), [matPrimary, matSecondary, matMetal]);
    const mountMesh = new THREE.Mesh(new THREE.BoxGeometry(), matMount);

    group.add(bodyMesh, headMesh, coatMesh, mountMesh);
    applyAvatarMaterials(group, TEST_COLORS);

    expectMaterialHex(bodyMesh.material as THREE.Material, TEST_COLORS.skin);

    const headMats = headMesh.material as THREE.Material[];
    expectMaterialHex(headMats[0], TEST_COLORS.hair);
    expectMaterialHex(headMats[1], TEST_COLORS.eyes);

    const coatMats = coatMesh.material as THREE.Material[];
    expectMaterialHex(coatMats[0], TEST_COLORS.outfitPrimary);
    expectMaterialHex(coatMats[1], TEST_COLORS.outfitSecondary);
    expectMaterialHex(coatMats[2], TEST_COLORS.outfitTrim);

    expectMaterialHex(mountMesh.material as THREE.Material, TEST_COLORS.mount);
  });

  test("leaves non-reserved materials such as mat_sclera, mat_pupil, and mat_fixed_stone untouched", () => {
    const group = new THREE.Group();
    const sclera = new THREE.MeshStandardMaterial({ name: "mat_sclera", color: "#f8fafc" });
    const pupil = new THREE.MeshBasicMaterial({ name: "mat_pupil.001", color: "#020617" });
    const stone = new THREE.MeshStandardMaterial({ name: "mat_fixed_stone", color: "#64748b" });
    const unnamed = new THREE.MeshStandardMaterial({ color: "#94a3b8" });

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), [sclera, pupil, stone, unnamed]);
    group.add(mesh);

    applyAvatarMaterials(group, TEST_COLORS);

    const mats = mesh.material as THREE.Material[];
    expect(mats[0]).toBe(sclera);
    expect(mats[1]).toBe(pupil);
    expect(mats[2]).toBe(stone);
    expect(mats[3]).toBe(unnamed);

    expectMaterialHex(mats[0], "#f8fafc");
    expectMaterialHex(mats[1], "#020617");
    expectMaterialHex(mats[2], "#64748b");
    expectMaterialHex(mats[3], "#94a3b8");
  });

  test("clones shared materials per instance with __avatarCloned so cached glTF materials are never mutated", () => {
    const pooledPrimary = new THREE.MeshStandardMaterial({ name: "mat_primary", color: "#ffffff" });
    const pooledMetal = new THREE.MeshStandardMaterial({ name: "mat_metal", color: "#aaaaaa" });

    const avatarA = new THREE.Group();
    const meshA1 = new THREE.Mesh(new THREE.BoxGeometry(), pooledPrimary);
    const meshA2 = new THREE.Mesh(new THREE.BoxGeometry(), [pooledPrimary, pooledMetal]);
    avatarA.add(meshA1, meshA2);

    const avatarB = new THREE.Group();
    const meshB1 = new THREE.Mesh(new THREE.BoxGeometry(), pooledPrimary);
    avatarB.add(meshB1);

    applyAvatarMaterials(avatarA, TEST_COLORS);
    applyAvatarMaterials(avatarB, ALT_COLORS);

    // Pooled source materials must remain completely untouched
    expectMaterialHex(pooledPrimary, "#ffffff");
    expectMaterialHex(pooledMetal, "#aaaaaa");
    expect(pooledPrimary.userData.__avatarCloned).toBeUndefined();

    // Avatar A and B each have distinct cloned materials with their own colors
    const matA1 = meshA1.material as THREE.MeshStandardMaterial;
    const matA2List = meshA2.material as THREE.MeshStandardMaterial[];
    const matB1 = meshB1.material as THREE.MeshStandardMaterial;

    expect(matA1).not.toBe(pooledPrimary);
    expect(matA1.userData.__avatarCloned).toBe(true);
    // Shared material within the same root reuses the same instance clone
    expect(matA2List[0]).toBe(matA1);

    expect(matB1).not.toBe(pooledPrimary);
    expect(matB1).not.toBe(matA1);
    expect(matB1.userData.__avatarCloned).toBe(true);

    expectMaterialHex(matA1, TEST_COLORS.outfitPrimary);
    expectMaterialHex(matA2List[1], TEST_COLORS.outfitTrim);
    expectMaterialHex(matB1, ALT_COLORS.outfitPrimary);
  });

  test("re-applying colors on an already-cloned instance updates colors in place without re-cloning", () => {
    const pooledSkin = new THREE.MeshStandardMaterial({ name: "mat_skin", color: "#ffffff" });
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), pooledSkin);
    group.add(mesh);

    applyAvatarMaterials(group, TEST_COLORS);
    const clonedOnce = mesh.material as THREE.MeshStandardMaterial;
    expect(clonedOnce).not.toBe(pooledSkin);
    expectMaterialHex(clonedOnce, TEST_COLORS.skin);

    applyAvatarMaterials(group, ALT_COLORS);
    const afterSecondPass = mesh.material as THREE.MeshStandardMaterial;
    expect(afterSecondPass).toBe(clonedOnce);
    expectMaterialHex(afterSecondPass, ALT_COLORS.skin);
  });
});
