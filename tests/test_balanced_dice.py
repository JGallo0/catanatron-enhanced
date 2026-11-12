from collections import Counter
import json

import pytest

from catanatron.apply_action import apply_action
from catanatron.game import Game
from catanatron.models.enums import Action, ActionPrompt, ActionType
from catanatron.models.player import Color, RandomPlayer, SimplePlayer
from catanatron.serialization import (
    client_view,
    state_from_json,
    state_to_json,
    web_view,
)
from catanatron.state import (
    BALANCED_DICE_RESHUFFLE_THRESHOLD,
    State,
)


def _setup_ready_to_roll_state(dice_mode="balanced", seed=42):
    players = [RandomPlayer(Color.RED), RandomPlayer(Color.BLUE)]
    game = Game(players, seed=seed, dice_mode=dice_mode)
    game.state.is_initial_build_phase = False
    game.state.current_prompt = ActionPrompt.PLAY_TURN
    return game


def test_balanced_dice_deck_contains_all_36_outcomes():
    players = [SimplePlayer(Color.RED), SimplePlayer(Color.BLUE)]
    state = State(players, dice_mode="balanced")
    assert state.dice_mode == "balanced"
    assert len(state.dice_deck) == 36
    assert set(state.dice_deck) == {
        (d1, d2) for d1 in range(1, 7) for d2 in range(1, 7)
    }

    sums = Counter(d1 + d2 for d1, d2 in state.dice_deck)
    expected = {2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1}
    assert dict(sums) == expected


def test_balanced_dice_draws_without_replacement_and_reshuffles_at_threshold():
    game = _setup_ready_to_roll_state(dice_mode="balanced", seed=123)
    state = game.state
    drawn_cycle = []

    rolls_before_reshuffle = 36 - BALANCED_DICE_RESHUFFLE_THRESHOLD
    for i in range(rolls_before_reshuffle):
        actor = state.current_color()
        key = state.color_to_index[actor]
        state.player_state[f"P{key}_HAS_ROLLED"] = False
        rec = apply_action(state, Action(actor, ActionType.ROLL, None))
        drawn_cycle.append(rec.result)
        assert len(state.dice_deck) == 36 - (i + 1)

    assert len(state.dice_deck) == BALANCED_DICE_RESHUFFLE_THRESHOLD
    assert len(set(drawn_cycle)) == rolls_before_reshuffle

    # Next roll sees <= 5 remaining cards, reshuffles a fresh 36-card deck, and pops 1 -> 35
    actor = state.current_color()
    key = state.color_to_index[actor]
    state.player_state[f"P{key}_HAS_ROLLED"] = False
    rec = apply_action(state, Action(actor, ActionType.ROLL, None))
    assert len(rec.result) == 2
    assert len(state.dice_deck) == 35


def test_state_and_game_copy_isolate_balanced_dice_deck():
    game = _setup_ready_to_roll_state(dice_mode="balanced", seed=99)
    original_deck_snapshot = list(game.state.dice_deck)

    cloned = game.copy()
    actor = cloned.state.current_color()
    apply_action(cloned.state, Action(actor, ActionType.ROLL, None))

    assert len(cloned.state.dice_deck) == 35
    assert game.state.dice_deck == original_deck_snapshot
    assert len(game.state.dice_deck) == 36


def test_balanced_dice_serialization_and_client_redaction():
    players = [RandomPlayer(Color.RED), RandomPlayer(Color.BLUE)]
    game = Game(players, seed=2026, dice_mode="balanced")
    game.state.is_initial_build_phase = False
    game.state.current_prompt = ActionPrompt.PLAY_TURN
    apply_action(
        game.state, Action(game.state.current_color(), ActionType.ROLL, None)
    )

    doc = json.loads(json.dumps(state_to_json(game)))
    assert doc["game"]["dice_mode"] == "balanced"
    assert len(doc["dice_deck"]) == 35

    restored = state_from_json(doc, players)
    assert restored.dice_mode == "balanced"
    assert restored.state.dice_mode == "balanced"
    assert restored.state.dice_deck == game.state.dice_deck

    redacted = client_view(doc, perspective=Color.RED)
    assert "dice_deck" not in redacted
    assert redacted["game"]["dice_mode"] == "balanced"
    assert redacted["dice_deck_remaining"] == 35

    ui_payload = web_view(game, perspective=Color.RED)
    assert "dice_deck" not in ui_payload
    assert ui_payload["game"]["dice_mode"] == "balanced"
    assert ui_payload["dice_deck_remaining"] == 35


def test_random_dice_mode_and_backwards_compatibility():
    players = [RandomPlayer(Color.RED), RandomPlayer(Color.BLUE)]
    game = Game(players, seed=55)  # default random
    doc = state_to_json(game)
    assert doc["game"]["dice_mode"] == "random"
    assert doc["dice_deck"] == []

    # Simulate pre-dice-mode stored doc
    legacy_doc = json.loads(json.dumps(doc))
    del legacy_doc["game"]["dice_mode"]
    del legacy_doc["dice_deck"]
    restored = state_from_json(legacy_doc, players)
    assert restored.state.dice_mode == "random"
    assert restored.state.dice_deck == []

    redacted = client_view(doc)
    assert "dice_deck" not in redacted
    assert "dice_deck_remaining" not in redacted


def test_invalid_dice_mode_raises():
    players = [SimplePlayer(Color.RED), SimplePlayer(Color.BLUE)]
    with pytest.raises(ValueError, match="dice_mode"):
        State(players, dice_mode="loaded")
