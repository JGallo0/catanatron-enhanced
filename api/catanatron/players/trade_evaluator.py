"""Strategic trade evaluation for AI players during domestic P2P negotiation.

Handles ActionPrompt.DECIDE_TRADE (ACCEPT_TRADE vs REJECT_TRADE) and
ActionPrompt.DECIDE_ACCEPTEES (CONFIRM_TRADE vs CANCEL_TRADE) by simulating the
post-swap resource hand rather than the intermediate pre-confirmation state.
"""

from typing import Optional, Sequence

from catanatron.models.decks import (
    CITY_COST_FREQDECK,
    DEVELOPMENT_CARD_COST_FREQDECK,
    ROAD_COST_FREQDECK,
    SETTLEMENT_COST_FREQDECK,
    freqdeck_contains,
)
from catanatron.models.enums import Action, ActionPrompt, ActionType, CITY, SETTLEMENT
from catanatron.state_functions import (
    get_player_buildings,
    get_player_freqdeck,
    get_visible_victory_points,
    player_key,
)


def _score_hand_utility(state, color, hand: Sequence[int]) -> float:
    """Compute a normalized strategic utility score for a resource freqdeck."""
    key = player_key(state, color)
    cities_avail = state.player_state[f"{key}_CITIES_AVAILABLE"]
    settlements_avail = state.player_state[f"{key}_SETTLEMENTS_AVAILABLE"]
    roads_avail = state.player_state[f"{key}_ROADS_AVAILABLE"]
    owned_settlements = len(get_player_buildings(state, color, SETTLEMENT))
    can_expand_settlement = (
        settlements_avail > 0 and len(state.board.buildable_node_ids(color)) > 0
    )
    can_expand_road = roads_avail > 0 and len(state.board.buildable_edges(color)) > 0
    can_upgrade_city = cities_avail > 0 and owned_settlements > 0
    has_dev_deck = len(state.development_listdeck) > 0

    dist_city = (max(2 - hand[3], 0) + max(3 - hand[4], 0)) / 5.0
    dist_settlement = (
        max(1 - hand[0], 0)
        + max(1 - hand[1], 0)
        + max(1 - hand[2], 0)
        + max(1 - hand[3], 0)
    ) / 4.0
    dist_dev = (
        max(1 - hand[2], 0) + max(1 - hand[3], 0) + max(1 - hand[4], 0)
    ) / 3.0
    dist_road = (max(1 - hand[0], 0) + max(1 - hand[1], 0)) / 2.0

    city_weight = 8.0 if can_upgrade_city else 1.5
    settlement_weight = 7.5 if can_expand_settlement else 1.5
    dev_weight = 3.5 if has_dev_deck else 0.5
    road_weight = 2.5 if can_expand_road else 0.5

    unlock_bonus = 0.0
    if can_upgrade_city and freqdeck_contains(hand, CITY_COST_FREQDECK):
        unlock_bonus += 12.0
    if can_expand_settlement and freqdeck_contains(hand, SETTLEMENT_COST_FREQDECK):
        unlock_bonus += 10.0
    if has_dev_deck and freqdeck_contains(hand, DEVELOPMENT_CARD_COST_FREQDECK):
        unlock_bonus += 4.0
    if can_expand_road and freqdeck_contains(hand, ROAD_COST_FREQDECK):
        unlock_bonus += 2.5

    total_cards = sum(hand)
    discard_penalty = 4.5 if total_cards > state.discard_limit else 0.0
    surplus_penalty = sum(max(count - 2, 0) * 0.45 for count in hand)

    return (
        unlock_bonus
        + total_cards * 1.4
        - dist_city * city_weight
        - dist_settlement * settlement_weight
        - dist_dev * dev_weight
        - dist_road * road_weight
        - discard_penalty
        - surplus_penalty
    )


def evaluate_trade_decision(
    player_color,
    game,
    playable_actions,
    accept_threshold: float = 0.4,
) -> Optional[Action]:
    """Return a strategic domestic trade decision, or None outside trade prompts."""
    prompt = game.state.current_prompt
    if prompt not in (ActionPrompt.DECIDE_TRADE, ActionPrompt.DECIDE_ACCEPTEES):
        return None
    if not playable_actions:
        return None
    if len(playable_actions) == 1:
        return playable_actions[0]

    if prompt == ActionPrompt.DECIDE_TRADE:
        accept_action = next(
            (a for a in playable_actions if a.action_type == ActionType.ACCEPT_TRADE),
            None,
        )
        reject_action = next(
            (a for a in playable_actions if a.action_type == ActionType.REJECT_TRADE),
            None,
        )
        if accept_action is None:
            return reject_action or playable_actions[0]
        if reject_action is None:
            return accept_action

        trade_value = accept_action.value or game.state.current_trade
        offering = trade_value[:5]
        asking = trade_value[5:10]
        proposer_idx = (
            trade_value[10] if len(trade_value) > 10 else game.state.current_turn_index
        )
        proposer_color = game.state.colors[proposer_idx]

        my_hand = get_player_freqdeck(game.state, player_color)
        after_hand = [
            held + gain - give for held, gain, give in zip(my_hand, offering, asking)
        ]
        if any(c < 0 for c in after_hand):
            return reject_action

        before_score = _score_hand_utility(game.state, player_color, my_hand)
        after_score = _score_hand_utility(game.state, player_color, after_hand)

        proposer_vp = get_visible_victory_points(game.state, proposer_color)
        if proposer_vp >= game.vps_to_win - 1:
            leader_penalty = 5.5
        elif proposer_vp >= game.vps_to_win - 2:
            leader_penalty = 2.0
        else:
            leader_penalty = 0.0

        net_gain = (after_score - before_score) - leader_penalty
        return accept_action if net_gain >= accept_threshold else reject_action

    # ActionPrompt.DECIDE_ACCEPTEES
    cancel_action = next(
        (a for a in playable_actions if a.action_type == ActionType.CANCEL_TRADE),
        None,
    )
    confirm_actions = [
        a for a in playable_actions if a.action_type == ActionType.CONFIRM_TRADE
    ]
    if not confirm_actions:
        return cancel_action or playable_actions[0]

    my_hand = get_player_freqdeck(game.state, player_color)
    before_score = _score_hand_utility(game.state, player_color, my_hand)

    best_action = None
    best_combined_score = float("-inf")
    best_hand_delta = float("-inf")

    for action in confirm_actions:
        offering = action.value[:5]
        asking = action.value[5:10]
        partner_color = action.value[10]
        after_hand = [
            held - give + gain for held, give, gain in zip(my_hand, offering, asking)
        ]
        if any(c < 0 for c in after_hand):
            continue
        after_score = _score_hand_utility(game.state, player_color, after_hand)
        hand_delta = after_score - before_score
        partner_vp = get_visible_victory_points(game.state, partner_color)
        partner_penalty = 0.75 * partner_vp + (
            4.0 if partner_vp >= game.vps_to_win - 1 else 0.0
        )
        combined = hand_delta - partner_penalty
        if combined > best_combined_score:
            best_combined_score = combined
            best_hand_delta = hand_delta
            best_action = action

    if best_action is None or (cancel_action is not None and best_hand_delta < -2.0):
        return cancel_action or playable_actions[0]
    return best_action
