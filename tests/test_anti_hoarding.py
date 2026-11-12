from unittest.mock import patch

from catanatron.game import Game
from catanatron.models.actions import generate_playable_actions
from catanatron.models.enums import Action, ActionPrompt, ActionType
from catanatron.models.player import Color, SimplePlayer
from catanatron.players.minimax import AlphaBetaPlayer
from catanatron.players.search import VictoryPointPlayer
from catanatron.players.tree_search_utils import prune_robber_actions
from catanatron.players.value import ValueFunctionPlayer, base_fn
from catanatron.players.weighted_random import WeightedRandomPlayer
from catanatron.state_functions import (
    get_player_freqdeck,
    player_freqdeck_add,
    player_freqdeck_subtract,
    player_key,
    player_num_resource_cards,
)


def _set_hand(game: Game, color: Color, target):
    cur = get_player_freqdeck(game.state, color)
    player_freqdeck_subtract(game.state, color, cur)
    player_freqdeck_add(game.state, color, target)


def _advance_initial_phase(game: Game):
    while game.state.is_initial_build_phase:
        game.execute(game.playable_actions[0])


@patch("catanatron.apply_action.roll_dice", return_value=(2, 3))
def _prepare_post_roll(players, _mock_roll, seed=42, discard_limit=7):
    game = Game(players, seed=seed, discard_limit=discard_limit)
    _advance_initial_phase(game)
    turn_color = game.state.current_color()
    game.execute(Action(turn_color, ActionType.ROLL, None))
    return game, turn_color


def test_bots_spend_or_trade_excess_hands_instead_of_ending_turn():
    for seed, excess_hand in ((11, [2, 1, 4, 4, 1]), (29, [2, 1, 1, 4, 7])):
        for make_bot in (
            lambda c: AlphaBetaPlayer(
                c, AlphaBetaPlayer.Params(depth=2, prunning=True)
            ),
            lambda c: ValueFunctionPlayer(c),
            lambda c: VictoryPointPlayer(c),
            lambda c: WeightedRandomPlayer(c),
        ):
            players = [
                make_bot(c)
                for c in (Color.RED, Color.BLUE, Color.ORANGE, Color.WHITE)
            ]
            game, active_color = _prepare_post_roll(players, seed=seed)
            bot = next(p for p in game.state.players if p.color == active_color)
            _set_hand(game, active_color, excess_hand)
            game.playable_actions = generate_playable_actions(game.state)
            assert any(
                a.action_type
                in (
                    ActionType.BUY_DEVELOPMENT_CARD,
                    ActionType.MARITIME_TRADE,
                    ActionType.BUILD_CITY,
                    ActionType.BUILD_SETTLEMENT,
                    ActionType.BUILD_ROAD,
                )
                for a in game.playable_actions
            )

            chosen = bot.decide(game, game.playable_actions)
            assert chosen.action_type != ActionType.END_TURN, (
                f"{type(bot).__name__} hoarded {excess_hand} instead of spending/trading"
            )


def test_base_fn_respects_custom_discard_limit_and_pending_discard():
    val_fn = base_fn()

    g_high = Game(
        [SimplePlayer(Color.RED), SimplePlayer(Color.BLUE)],
        seed=7,
        discard_limit=10,
    )
    _advance_initial_phase(g_high)
    p0 = g_high.state.colors[0]
    _set_hand(g_high, p0, [2, 2, 2, 1, 1])  # 8 cards

    g_std = g_high.copy()
    g_std.state.discard_limit = 7

    g_low = g_high.copy()
    g_low.state.discard_limit = 5

    # Higher excess over smaller discard_limit receives progressively harsher score
    assert val_fn(g_high, p0) > val_fn(g_std, p0) > val_fn(g_low, p0)

    # Simulate roll-of-7 pending discard: leaf value must not treat pending discard as free
    g_discarding = g_std.copy()
    g_discarding.state.is_discarding = True
    g_discarding.state.discard_counts[g_discarding.state.color_to_index[p0]] = 4
    assert val_fn(g_discarding, p0) < val_fn(g_std, p0)


def test_prune_robber_actions_evaluates_all_enemies_in_4p_game():
    players = [SimplePlayer(c) for c in (Color.RED, Color.BLUE, Color.ORANGE, Color.WHITE)]
    game = Game(players, seed=19)
    _advance_initial_phase(game)

    actor = Color.RED
    # Seat WHITE/ORANGE in 4p may sit at higher production & VP than P1 (BLUE)
    target_enemy = Color.ORANGE
    target_key = player_key(game.state, target_enemy)
    game.state.player_state[f"{target_key}_VICTORY_POINTS"] = 8
    game.state.player_state[f"{target_key}_ACTUAL_VICTORY_POINTS"] = 8
    _set_hand(game, target_enemy, [3, 3, 3, 3, 3])  # 15 cards!

    # Zero out P1's cards and keep P1 low VP so ORANGE is clearly the biggest threat
    p1_other = next(c for c in game.state.colors if c not in (actor, target_enemy))
    _set_hand(game, p1_other, [0, 0, 0, 0, 0])

    idx = game.state.color_to_index[actor]
    game.state.current_turn_index = idx
    game.state.current_player_index = idx
    game.state.current_prompt = ActionPrompt.MOVE_ROBBER
    actions = generate_playable_actions(game.state)
    # Only include MOVE_ROBBER actions hitting an enemy with cards (e.g. target_enemy)
    steal_from_target = [
        a
        for a in actions
        if a.action_type == ActionType.MOVE_ROBBER and a.value[1] == target_enemy
    ]
    assert len(steal_from_target) > 0

    pruned = list(prune_robber_actions(actor, game, actions))
    robber_choices = [a for a in pruned if a.action_type == ActionType.MOVE_ROBBER]
    assert len(robber_choices) == 1
    assert robber_choices[0].value[1] == target_enemy


def test_bots_discard_surplus_before_breaking_city_hand():
    players = [
        AlphaBetaPlayer(Color.RED, AlphaBetaPlayer.Params(depth=2, prunning=True)),
        ValueFunctionPlayer(Color.BLUE),
        VictoryPointPlayer(Color.ORANGE),
    ]
    game = Game(players, seed=5)
    _advance_initial_phase(game)

    for color in (Color.RED, Color.BLUE, Color.ORANGE):
        idx = game.state.color_to_index[color]
        game.state.current_turn_index = idx
        game.state.current_player_index = idx
        game.state.current_prompt = ActionPrompt.DISCARD
        game.state.is_discarding = True
        game.state.discard_counts = [0] * len(game.state.colors)
        game.state.discard_counts[idx] = 1
        # City ready [2W, 3O] + 3 excess Wood -> discarding Wood keeps City intact!
        _set_hand(game, color, [3, 0, 0, 2, 3])
        game.playable_actions = generate_playable_actions(game.state)
        bot = next(p for p in game.state.players if p.color == color)
        chosen = bot.decide(game, game.playable_actions)
        assert chosen == Action(color, ActionType.DISCARD_RESOURCE, "WOOD"), (
            f"{type(bot).__name__} discarded {chosen.value} instead of surplus WOOD"
        )


def test_full_mixed_ai_match_prevents_hoarding_above_10_at_end_turn():
    players = [
        AlphaBetaPlayer(Color.RED, AlphaBetaPlayer.Params(depth=2, prunning=True)),
        ValueFunctionPlayer(Color.BLUE),
        VictoryPointPlayer(Color.ORANGE),
        WeightedRandomPlayer(Color.WHITE),
    ]
    game = Game(players, seed=103)
    while game.winning_color() is None and game.state.num_turns < 400:
        acting = game.state.current_color()
        rec = game.play_tick()
        if rec.action.action_type == ActionType.END_TURN:
            if acting in (Color.RED, Color.BLUE, Color.ORANGE):
                assert player_num_resource_cards(game.state, acting) < 10

    assert game.winning_color() is not None
