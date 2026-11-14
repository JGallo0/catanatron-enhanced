import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { setLanguage } from "../i18n";
import ResourceCards from "./ResourceCards";

afterEach(() => {
  cleanup();
  localStorage.clear();
  setLanguage("pt");
});

const OWN_HAND = {
  P0_WOOD_IN_HAND: 2,
  P0_BRICK_IN_HAND: 0,
  P0_SHEEP_IN_HAND: 1,
  P0_WHEAT_IN_HAND: 0,
  P0_ORE_IN_HAND: 0,
  P0_KNIGHT_IN_HAND: 1,
  P0_VICTORY_POINT_IN_HAND: 0,
  P0_MONOPOLY_IN_HAND: 0,
  P0_YEAR_OF_PLENTY_IN_HAND: 0,
  P0_ROAD_BUILDING_IN_HAND: 0,
};

/** What an opponent's seat looks like once the server knows who is asking. */
const THEIR_HAND = {
  P1_NUM_RESOURCES_IN_HAND: 5,
  P1_NUM_DEVELOPMENT_CARDS_IN_HAND: 2,
};

test("shows every card of a hand it is allowed to read", () => {
  const { container } = render(
    <ResourceCards playerState={OWN_HAND} playerKey="P0" />
  );

  expect(container.querySelectorAll(".wood-cards")).toHaveLength(1);
  expect(container.querySelectorAll(".sheep-cards")).toHaveLength(1);
  expect(container.querySelectorAll(".hidden-cards")).toHaveLength(0);
  expect(screen.getByTitle("1 carta(s) de Cavaleiro")).toBeInTheDocument();
});

test("shows an opponent's hand as two face-down counts", () => {
  const { container } = render(
    <ResourceCards playerState={THEIR_HAND} playerKey="P1" />
  );

  expect(container.querySelectorAll(".wood-cards")).toHaveLength(0);
  expect(
    screen.getByTitle("5 carta(s) de recurso, virada(s) para baixo")
  ).toBeInTheDocument();
  expect(
    screen.getByTitle("2 carta(s) de desenvolvimento, virada(s) para baixo")
  ).toBeInTheDocument();
});

test("draws nothing for an empty hand", () => {
  const { container } = render(
    <ResourceCards
      playerState={{
        P1_NUM_RESOURCES_IN_HAND: 0,
        P1_NUM_DEVELOPMENT_CARDS_IN_HAND: 0,
      }}
      playerKey="P1"
    />
  );

  expect(container.querySelectorAll(".card")).toHaveLength(0);
});

test("supports interactive dev cards with playable action, Nova (Próx. turno) lock, and +1 PV badge", () => {
  const onPlayKnight = vi.fn();
  render(
    <ResourceCards
      playerState={{
        ...OWN_HAND,
        P0_KNIGHT_IN_HAND: 1,
        P0_MONOPOLY_IN_HAND: 1,
        P0_MONOPOLY_BOUGHT_THIS_TURN: 1,
        P0_VICTORY_POINT_IN_HAND: 1,
      }}
      playerKey="P0"
      showEmptySlots={true}
      interactiveDevCards={true}
      playableDevCallbacks={{ KNIGHT: onPlayKnight }}
    />
  );

  expect(screen.getByText("+1 PV")).toBeInTheDocument();
  expect(screen.getByText("Nova (Próx. turno)")).toBeInTheDocument();

  const knightBtn = screen.getByRole("button", { name: /Cavaleiro.*Clique para jogar/i });
  fireEvent.click(knightBtn);

  const playBtn = screen.getByRole("button", { name: /Jogar Carta/i });
  fireEvent.click(playBtn);
  expect(onPlayKnight).toHaveBeenCalledTimes(1);
});

test("shows the five resource counters and keeps development cards playable in the icon hand", () => {
  const playKnight = vi.fn();
  const { container } = render(
    <ResourceCards
      playerState={OWN_HAND}
      playerKey="P0"
      showEmptySlots
      iconOnly
      interactiveDevCards
      playableDevCallbacks={{ KNIGHT: playKnight }}
    />
  );

  expect(screen.getByRole("img", { name: "Madeira (2)" })).toHaveTextContent("2");
  expect(screen.getByRole("img", { name: "Argila (0)" })).toHaveTextContent("0");
  expect(screen.getAllByRole("img")).toHaveLength(5);
  expect(container.querySelector(".resource-card-item__bg-art")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /Cavaleiro.*Clique para jogar/i }));
  fireEvent.click(screen.getByRole("button", { name: /Jogar Carta/i }));
  expect(playKnight).toHaveBeenCalledOnce();
});
