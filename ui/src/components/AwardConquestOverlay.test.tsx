import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import AwardConquestOverlay from "./AwardConquestOverlay";
import type { AwardConquestFX } from "../utils/tabletopPacing";

afterEach(cleanup);

const roadAward: AwardConquestFX = {
  type: "ROAD",
  color: "ORANGE",
  playerName: "Guiri",
  previousHolderName: null,
  metricCount: 6,
};

describe("AwardConquestOverlay", () => {
  test("renders the road crest with player identity and points", () => {
    const { container } = render(<AwardConquestOverlay award={roadAward} />);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "assertive");
    expect(status).toHaveClass("award-conquest-overlay--road");
    expect(screen.getByAltText("Brasão de Maior Estrada")).toHaveAttribute(
      "src",
      "/assets/illustrations/ui/longest-road-crest.png"
    );
    expect(screen.getByText("Guiri")).toBeInTheDocument();
    expect(screen.getByText("+2 PV")).toBeInTheDocument();
    expect(container.querySelector(".award-conquest-overlay__rays")).toBeNull();
  });

  test("renders the army crest", () => {
    render(
      <AwardConquestOverlay
        award={{
          ...roadAward,
          type: "ARMY",
          color: "RED",
          playerName: "Creitu",
          metricCount: 3,
        }}
      />
    );

    expect(screen.getByRole("status")).toHaveClass(
      "award-conquest-overlay--army"
    );
    expect(screen.getByAltText("Brasão de Maior Exército")).toHaveAttribute(
      "src",
      "/assets/illustrations/ui/largest-army-crest.png"
    );
    expect(screen.getByText("Creitu")).toBeInTheDocument();
  });

  test("keeps a long player name in the lower identity plate", () => {
    const longName = "Explorador das Sete Correntes da Ilha";
    render(
      <AwardConquestOverlay award={{ ...roadAward, playerName: longName }} />
    );

    const name = screen.getByText(longName);
    expect(name).toHaveClass("award-conquest-overlay__player-name");
    expect(name).toHaveAttribute("title", longName);
    expect(name.closest(".award-conquest-overlay__identity-plate")).not.toBeNull();
  });
});
