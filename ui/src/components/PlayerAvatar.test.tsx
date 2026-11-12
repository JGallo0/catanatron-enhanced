import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import PlayerAvatar from "./PlayerAvatar";
import { setLanguage } from "../i18n";

afterEach(() => {
  cleanup();
  setLanguage("pt");
});

describe("PlayerAvatar", () => {
  test("renders valid data:image/webp portraitSnapshot as img.player-avatar__snapshot with vip_dragon frame", () => {
    const validSnapshot = "data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=";
    const { container } = render(
      <PlayerAvatar
        username="Soberano"
        size={64}
        config={{
          version: 2,
          frame: "vip_dragon",
          portraitSnapshot: validSnapshot,
        }}
      />
    );

    const root = screen.getByTestId("player-avatar");
    expect(root).toHaveAttribute("data-frame", "vip_dragon");
    expect(root.className).toContain("player-avatar--frame-vip_dragon");

    const img = container.querySelector("img.player-avatar__snapshot") as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute("src", validSnapshot);
    expect(img).toHaveAttribute("width", "64");
    expect(img).toHaveAttribute("height", "64");
    expect(img).toHaveAttribute("alt", "Avatar de Soberano");
    expect(container.querySelector("svg.player-avatar__svg")).toBeNull();
  });

  test("falls back to <svg role='img'> when portraitSnapshot is invalid or malicious (svg+xml, javascript:, oversized)", () => {
    const { container, rerender } = render(
      <PlayerAvatar
        username="Corsario"
        config={{
          frame: "gold",
          portraitSnapshot: "data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+PC9zdmc+",
        }}
      />
    );

    expect(container.querySelector("img.player-avatar__snapshot")).toBeNull();
    const svg = container.querySelector("svg.player-avatar__svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("role", "img");
    expect(svg).toHaveAttribute("aria-label", "Avatar de Corsario");

    rerender(
      <PlayerAvatar
        username="Corsario"
        config={{
          portraitSnapshot: "javascript:alert(1)",
        }}
      />
    );
    expect(container.querySelector("img.player-avatar__snapshot")).toBeNull();
    expect(container.querySelector("svg.player-avatar__svg")).toBeInTheDocument();

    rerender(
      <PlayerAvatar
        username="Corsario"
        config={{
          portraitSnapshot: `data:image/png;base64,${"A".repeat(70000)}`,
        }}
      />
    );
    expect(container.querySelector("img.player-avatar__snapshot")).toBeNull();
    expect(container.querySelector("svg.player-avatar__svg")).toBeInTheDocument();
  });

  test("applies V2 hex colors (skin, outfitPrimary, eyes) directly to SVG fallback fills and supports V2 items", () => {
    const customSkin = "#d19c77";
    const customOutfitPrimary = "#581c87";
    const customEyes = "#7c3aed";

    const { container } = render(
      <PlayerAvatar
        username="Almirante"
        config={{
          version: 2,
          hair: "navigator",
          beard: "captain_trimmed",
          outfit: "imperial_lord",
          hat: "admiral_bicorne",
          browStyle: "scarred",
          mouthStyle: "smirk",
          noseStyle: "aquiline",
          colors: {
            skin: customSkin,
            hair: "#1f242d",
            eyes: customEyes,
            outfitPrimary: customOutfitPrimary,
            outfitSecondary: "#1e293b",
            outfitTrim: "#fde047",
            mount: "#854d0e",
          },
        }}
      />
    );

    const svg = container.querySelector("svg.player-avatar__svg");
    expect(svg).not.toBeNull();
    expect(svg!.querySelector(`[fill="${customSkin}"]`)).not.toBeNull();
    expect(svg!.querySelector(`[fill="${customOutfitPrimary}"]`)).not.toBeNull();
    expect(svg!.querySelector(`[fill="${customEyes}"]`)).not.toBeNull();
  });

  test("displays localized vip_dragon frame label when showFrameLabel is true (PT and EN)", () => {
    setLanguage("pt");
    const { rerender } = render(
      <PlayerAvatar
        username="Dragao"
        showFrameLabel
        config={{ frame: "vip_dragon" }}
      />
    );

    expect(screen.getByText(/Dragão Imperial/i)).toBeInTheDocument();

    setLanguage("en");
    rerender(
      <PlayerAvatar
        username="Dragao"
        showFrameLabel
        config={{ frame: "vip_dragon" }}
      />
    );

    expect(screen.getByText(/Imperial Dragon/i)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Dragao's avatar" })).toBeInTheDocument();
  });
});
