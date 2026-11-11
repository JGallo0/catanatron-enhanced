import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import LeaderboardModal from "./LeaderboardModal";

vi.mock("../utils/apiClient", () => ({
  getLeaderboard: vi.fn().mockResolvedValue({
    is_offline_fallback: false,
    leaderboard: [
      {
        rank: 1,
        username: "pedro",
        display_name: "Pedro",
        avatar_config: { hat: "captain", background: "ocean", frame: "bronze" },
        wins: 4,
        losses: 1,
        games_played: 5,
        win_rate: 80.0,
      },
    ],
  }),
  getMatchHistory: vi.fn().mockResolvedValue({
    is_offline_fallback: false,
    matches: [
      {
        game_id: "g1",
        mode: "SOLO",
        map_template: "BASE",
        vps_to_win: 10,
        num_turns: 33,
        winning_color: "BLUE",
        winner_name: "IA (CATANATRON)",
        winner_username: null,
        winner_is_bot: true,
        finished_at: 1794340000,
        participants: [
          {
            color: "BLUE",
            seat_kind: "BOT",
            username: null,
            player_key: "CATANATRON",
            display_name: "IA (CATANATRON)",
            victory_points: 10,
            is_winner: true,
          },
          {
            color: "RED",
            seat_kind: "USER",
            username: "pedro",
            player_key: "HUMAN",
            display_name: "Pedro",
            victory_points: 8,
            is_winner: false,
          },
        ],
      },
    ],
  }),
}));

describe("LeaderboardModal", () => {
  test("renders ranking with wins and win_rate and switches to match history including AI wins", async () => {
    const user = userEvent.setup();
    render(<LeaderboardModal open={true} onClose={() => {}} currentUsername="pedro" />);

    expect(await screen.findByText("Pedro")).toBeInTheDocument();
    expect(screen.getAllByTestId("player-avatar").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /Histórico de Partidas/i }));
    const elements = await screen.findAllByText(/IA \(CATANATRON\)/i);
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });
});
