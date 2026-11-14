from unittest.mock import patch
import pytest

from catanatron.game import Game, is_valid_action, is_valid_trade
from catanatron.models.enums import Action, ActionPrompt, ActionType
from catanatron.models.player import Color, RandomPlayer, SimplePlayer
from catanatron.players.mcts import MCTSPlayer
from catanatron.players.minimax import AlphaBetaPlayer, SameTurnAlphaBetaPlayer
from catanatron.players.playouts import GreedyPlayoutsPlayer
from catanatron.players.search import VictoryPointPlayer
from catanatron.players.tree_search_utils import DETERMINISTIC_ACTIONS, execute_spectrum
from catanatron.players.value import ValueFunctionPlayer
from catanatron.players.weighted_random import WeightedRandomPlayer
from catanatron.state_functions import (
    get_player_freqdeck,
    player_freqdeck_add,
    player_freqdeck_subtract,
    player_key,
)


def _set_hand(game: Game, color: Color, target_freqdeck):
    current = get_player_freqdeck(game.state, color)
    player_freqdeck_subtract(game.state, color, current)
    player_freqdeck_add(game.state, color, target_freqdeck)


def _complete_initial_phase(game: Game):
    while game.state.is_initial_build_phase:
        game.execute(game.playable_actions[0])


def test_proposer_can_cancel_while_waiting_for_responses():
    game = _prepare_post_roll_game([SimplePlayer(Color.RED), SimplePlayer(Color.BLUE), SimplePlayer(Color.ORANGE)])
    _set_hand(game, Color.RED, [2, 0, 0, 0, 0])
    game.execute(Action(Color.RED, ActionType.OFFER_TRADE, (1, 0, 0, 0, 0, 0, 1, 0, 0, 0)))
    assert game.state.current_prompt == ActionPrompt.DECIDE_TRADE
    responder = game.state.current_color()
    with pytest.raises(ValueError):
        game.execute(Action(responder, ActionType.CANCEL_TRADE, None))
    game.execute(Action(Color.RED, ActionType.CANCEL_TRADE, None))
    assert game.state.current_color() == Color.RED
    assert game.state.current_prompt == ActionPrompt.PLAY_TURN
    assert not game.state.is_resolving_trade
    assert get_player_freqdeck(game.state, Color.RED) == [2, 0, 0, 0, 0]


@patch("catanatron.apply_action.roll_dice", return_value=(2, 3))
def _prepare_post_roll_game(
    players, _mock_roll, seed=42, proposer_color=Color.RED
):
    game = Game(players, seed=seed)
    _complete_initial_phase(game)
    while game.state.current_color() != proposer_color:
        roller = game.state.current_color()
        game.execute(Action(roller, ActionType.ROLL, None))
        game.execute(Action(roller, ActionType.END_TURN, None))
    game.execute(Action(proposer_color, ActionType.ROLL, None))
    return game


def test_is_valid_trade_rejects_malformed_values():
    assert not is_valid_trade((1, 0, 0, 0, 0, 0, 1, 0, 0))  # wrong length (9)
    assert not is_valid_trade((1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0))  # wrong length (11)
    assert not is_valid_trade((-1, 0, 0, 0, 0, 0, 1, 0, 0, 0))  # negative
    assert not is_valid_trade((True, 0, 0, 0, 0, 0, 1, 0, 0, 0))  # bool
    assert not is_valid_trade((1.0, 0, 0, 0, 0, 0, 1, 0, 0, 0))  # float
    assert not is_valid_trade("not-a-trade")  # non-sequence


def test_offer_trade_validation_in_game():
    # 1. Initial build phase rejects OFFER_TRADE
    init_game = Game([SimplePlayer(Color.RED), SimplePlayer(Color.BLUE)], seed=1)
    red_offer = Action(
        Color.RED, ActionType.OFFER_TRADE, (1, 0, 0, 0, 0, 0, 1, 0, 0, 0)
    )
    assert not is_valid_action(init_game.playable_actions, init_game.state, red_offer)

    # 2. Pre-roll PLAY_TURN rejects OFFER_TRADE
    pre_roll = Game([SimplePlayer(Color.RED), SimplePlayer(Color.BLUE)], seed=2)
    _complete_initial_phase(pre_roll)
    p0 = pre_roll.state.current_color()
    _set_hand(pre_roll, p0, [2, 0, 0, 0, 0])
    offer = Action(p0, ActionType.OFFER_TRADE, (1, 0, 0, 0, 0, 0, 1, 0, 0, 0))
    assert not is_valid_action(pre_roll.playable_actions, pre_roll.state, offer)

    # 3. Post-roll with missing cards in hand rejects OFFER_TRADE
    post_roll = _prepare_post_roll_game(
        [SimplePlayer(Color.RED), SimplePlayer(Color.BLUE)], seed=3
    )
    p0 = post_roll.state.current_color()
    offer = Action(p0, ActionType.OFFER_TRADE, (1, 0, 0, 0, 0, 0, 1, 0, 0, 0))
    _set_hand(post_roll, p0, [0, 0, 0, 0, 0])
    assert not is_valid_action(post_roll.playable_actions, post_roll.state, offer)

    # 4. Post-roll with offered cards in hand is valid
    _set_hand(post_roll, p0, [1, 0, 0, 0, 0])
    assert is_valid_action(post_roll.playable_actions, post_roll.state, offer)

    # 5. Wrong player color cannot offer
    other = next(c for c in post_roll.state.colors if c != p0)
    wrong_color_offer = Action(
        other, ActionType.OFFER_TRADE, (1, 0, 0, 0, 0, 0, 1, 0, 0, 0)
    )
    assert not is_valid_action(
        post_roll.playable_actions, post_roll.state, wrong_color_offer
    )

    # 6. Road building blocks OFFER_TRADE
    post_roll.state.is_road_building = True
    assert not is_valid_action(post_roll.playable_actions, post_roll.state, offer)
    post_roll.state.is_road_building = False

    # 7. Already resolving trade blocks nested OFFER_TRADE
    post_roll.execute(offer)
    assert post_roll.state.is_resolving_trade
    assert not is_valid_action(post_roll.playable_actions, post_roll.state, offer)


def test_tree_search_handles_domestic_trade_actions():
    for action_type in (
        ActionType.OFFER_TRADE,
        ActionType.ACCEPT_TRADE,
        ActionType.REJECT_TRADE,
        ActionType.CONFIRM_TRADE,
        ActionType.CANCEL_TRADE,
    ):
        assert action_type in DETERMINISTIC_ACTIONS

    players = [AlphaBetaPlayer(Color.RED), MCTSPlayer(Color.BLUE)]
    game = _prepare_post_roll_game(players, seed=5, proposer_color=Color.RED)
    proposer = Color.RED
    respondent = Color.BLUE
    _set_hand(game, proposer, [2, 0, 0, 0, 0])
    _set_hand(game, respondent, [1, 1, 1, 1, 0])

    offer = Action(proposer, ActionType.OFFER_TRADE, (1, 0, 0, 0, 0, 0, 0, 0, 1, 0))
    outcomes = execute_spectrum(game, offer)
    assert len(outcomes) == 1
    assert outcomes[0][0].state.current_prompt == ActionPrompt.DECIDE_TRADE

    game.execute(offer)
    assert game.state.current_prompt == ActionPrompt.DECIDE_TRADE
    for action in game.playable_actions:
        res = execute_spectrum(game, action)
        assert len(res) == 1

    # AlphaBeta / MCTS decide safely during DECIDE_TRADE
    decider = game.state.current_player()
    chosen = decider.decide(game, game.playable_actions)
    assert chosen in game.playable_actions


@pytest.mark.parametrize(
    "make_bot",
    [
        lambda c: ValueFunctionPlayer(c),
        lambda c: AlphaBetaPlayer(c),
        lambda c: SameTurnAlphaBetaPlayer(c),
        lambda c: MCTSPlayer(c),
        lambda c: WeightedRandomPlayer(c),
        lambda c: VictoryPointPlayer(c),
        lambda c: GreedyPlayoutsPlayer(c),
    ],
)
def test_strategic_bots_accept_beneficial_trade_and_reject_giveaway(make_bot):
    players = [SimplePlayer(Color.RED), make_bot(Color.BLUE)]
    game = _prepare_post_roll_game(players, seed=11, proposer_color=Color.RED)
    proposer = Color.RED
    bot_color = Color.BLUE
    bot_player = next(p for p in game.state.players if p.color == bot_color)

    # Case A: Mutually helpful trade — bot has Wood+2Brick+Sheep and only needs Wheat to build Settlement!
    _set_hand(game, proposer, [0, 0, 0, 2, 0])
    _set_hand(game, bot_color, [1, 2, 1, 0, 0])
    good_game = game.copy()
    good_game.execute(
        Action(proposer, ActionType.OFFER_TRADE, (0, 0, 0, 1, 0, 0, 1, 0, 0, 0))
    )
    assert good_game.state.current_color() == bot_color
    good_choice = bot_player.decide(good_game, good_game.playable_actions)
    assert good_choice.action_type == ActionType.ACCEPT_TRADE

    # Case B: Unfair giveaway — bot gives away 2 Ore + 1 Wheat (which breaks its City/Settlement) for 1 Wood!
    _set_hand(game, proposer, [2, 0, 0, 0, 0])
    _set_hand(game, bot_color, [1, 1, 1, 1, 3])
    bad_game = game.copy()
    bad_game.execute(
        Action(proposer, ActionType.OFFER_TRADE, (1, 0, 0, 0, 0, 0, 0, 0, 1, 2))
    )
    assert bad_game.state.current_color() == bot_color
    bad_choice = bot_player.decide(bad_game, bad_game.playable_actions)
    assert bad_choice.action_type == ActionType.REJECT_TRADE


def test_proposer_bot_confirms_best_partner_avoiding_match_point_leader():
    players = [
        ValueFunctionPlayer(Color.RED),
        ValueFunctionPlayer(Color.BLUE),
        ValueFunctionPlayer(Color.ORANGE),
    ]
    game = _prepare_post_roll_game(players, seed=17, proposer_color=Color.RED)
    proposer = Color.RED
    proposer_player = next(p for p in game.state.players if p.color == proposer)
    weak_partner, leader_partner = Color.BLUE, Color.ORANGE

    # Put leader_partner at 9 visible VPs
    leader_key = player_key(game.state, leader_partner)
    game.state.player_state[f"{leader_key}_VICTORY_POINTS"] = 9
    game.state.player_state[f"{leader_key}_ACTUAL_VICTORY_POINTS"] = 9

    # Proposer gives away 1 surplus Wood for 1 needed Wheat (completing settlement!)
    _set_hand(game, proposer, [2, 1, 1, 0, 0])
    _set_hand(game, weak_partner, [0, 0, 0, 1, 0])
    _set_hand(game, leader_partner, [0, 0, 0, 1, 0])

    game.execute(
        Action(proposer, ActionType.OFFER_TRADE, (1, 0, 0, 0, 0, 0, 0, 0, 1, 0))
    )
    # Both respondents accept
    while game.state.current_prompt == ActionPrompt.DECIDE_TRADE:
        accept_action = next(
            a for a in game.playable_actions if a.action_type == ActionType.ACCEPT_TRADE
        )
        game.execute(accept_action)

    assert game.state.current_prompt == ActionPrompt.DECIDE_ACCEPTEES
    assert game.state.current_color() == proposer
    confirm = proposer_player.decide(game, game.playable_actions)
    assert confirm.action_type == ActionType.CONFIRM_TRADE
    assert confirm.value[10] == weak_partner


def test_full_three_step_domestic_trade_roundtrip():
    players = [
        SimplePlayer(Color.RED),
        SimplePlayer(Color.BLUE),
        ValueFunctionPlayer(Color.WHITE),
    ]
    game = _prepare_post_roll_game(players, seed=21, proposer_color=Color.RED)
    p0 = Color.RED
    p1, p2 = Color.BLUE, Color.WHITE

    # P0 wants 1 Brick, offers 1 Wheat. P1 refuses (doesn't have Brick), P2 has [1 Wood, 2 Brick, 1 Sheep, 0 Wheat, 0 Ore] -> unlocks Settlement!
    _set_hand(game, p0, [1, 0, 1, 2, 0])
    _set_hand(game, p1, [0, 0, 1, 0, 1])
    _set_hand(game, p2, [1, 2, 1, 0, 0])

    game.execute(Action(p0, ActionType.OFFER_TRADE, (0, 0, 0, 1, 0, 0, 1, 0, 0, 0)))
    assert game.state.is_resolving_trade
    assert game.state.current_prompt == ActionPrompt.DECIDE_TRADE

    while game.state.current_prompt == ActionPrompt.DECIDE_TRADE:
        game.play_tick()

    assert game.state.current_prompt == ActionPrompt.DECIDE_ACCEPTEES
    assert game.state.current_color() == p0
    confirm_p2 = next(
        a
        for a in game.playable_actions
        if a.action_type == ActionType.CONFIRM_TRADE and a.value[10] == p2
    )
    game.execute(confirm_p2)

    assert not game.state.is_resolving_trade
    assert game.state.current_prompt == ActionPrompt.PLAY_TURN
    assert get_player_freqdeck(game.state, p0) == [1, 1, 1, 1, 0]
    assert get_player_freqdeck(game.state, p2) == [1, 1, 1, 1, 0]


def test_random_player_behavior_preserved():
    players = [SimplePlayer(Color.RED), RandomPlayer(Color.BLUE)]
    game = _prepare_post_roll_game(players, seed=99, proposer_color=Color.RED)
    p0 = Color.RED
    p1 = Color.BLUE
    _set_hand(game, p0, [1, 0, 0, 0, 0])
    _set_hand(game, p1, [0, 1, 0, 0, 0])
    game.execute(Action(p0, ActionType.OFFER_TRADE, (1, 0, 0, 0, 0, 0, 1, 0, 0, 0)))
    bot = next(p for p in game.state.players if p.color == p1)
    assert isinstance(bot, RandomPlayer)
    choice = bot.decide(game, game.playable_actions)
    assert choice in game.playable_actions
