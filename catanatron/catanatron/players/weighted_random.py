from catanatron.models.enums import ActionPrompt, RESOURCES
from catanatron.models.player import Player
from catanatron.models.actions import ActionType
from catanatron.players.trade_evaluator import (
    _score_hand_utility,
    evaluate_trade_decision,
)
from catanatron.state_functions import get_player_freqdeck


WEIGHTS_BY_ACTION_TYPE = {
    ActionType.BUILD_CITY: 10000,
    ActionType.BUILD_SETTLEMENT: 1000,
    ActionType.BUY_DEVELOPMENT_CARD: 100,
    ActionType.BUILD_ROAD: 40,
    ActionType.PLAY_ROAD_BUILDING: 40,
    ActionType.PLAY_YEAR_OF_PLENTY: 30,
    ActionType.PLAY_KNIGHT_CARD: 25,
    ActionType.PLAY_MONOPOLY: 20,
}


class WeightedRandomPlayer(Player):
    """
    Player that decides at random, but skews distribution
    to actions that are likely better (cities > settlements > dev cards > roads),
    discards low-utility resources, and uses beneficial maritime trades above limit.
    """

    LABEL = "Weighted Random"

    def decide(self, game, playable_actions):
        if len(playable_actions) == 1:
            return playable_actions[0]

        trade_action = evaluate_trade_decision(self.color, game, playable_actions)
        if trade_action is not None:
            return trade_action

        current_hand = get_player_freqdeck(game.state, self.color)
        total_cards = sum(current_hand)
        discard_limit = max(1, int(getattr(game.state, "discard_limit", 7)))

        if game.state.current_prompt == ActionPrompt.DISCARD:
            best_score = float("-inf")
            scored = []
            for action in playable_actions:
                r_idx = RESOURCES.index(action.value)
                after_hand = list(current_hand)
                after_hand[r_idx] = max(0, after_hand[r_idx] - 1)
                score = _score_hand_utility(game.state, self.color, after_hand)
                scored.append((action, score))
                if score > best_score:
                    best_score = score
            weights = [
                max(1, int(round(max(0.0, 4.0 - (best_score - sc)) ** 2)))
                for _, sc in scored
            ]
            return game.state.random.choices(
                [a for a, _ in scored], weights=weights, k=1
            )[0]

        has_base_util = any(
            a.action_type == ActionType.MARITIME_TRADE for a in playable_actions
        )
        base_utility = (
            _score_hand_utility(game.state, self.color, current_hand)
            if has_base_util
            else 0.0
        )

        action_weights = []
        has_positive_spend = False
        for action in playable_actions:
            if action.action_type == ActionType.MARITIME_TRADE:
                give_cards = [r for r in action.value[:-1] if r is not None]
                recv_card = action.value[-1]
                w = 0
                if give_cards and recv_card:
                    after_hand = list(current_hand)
                    after_hand[RESOURCES.index(give_cards[0])] -= len(give_cards)
                    after_hand[RESOURCES.index(recv_card)] += 1
                    delta = (
                        _score_hand_utility(game.state, self.color, after_hand)
                        - base_utility
                    )
                    if delta > 0.5:
                        w = max(5, min(200, int(round(delta * 20))))
                    elif total_cards > discard_limit and delta > -1.0:
                        w = 5
            elif action.action_type == ActionType.END_TURN:
                w = 1
            else:
                w = WEIGHTS_BY_ACTION_TYPE.get(action.action_type, 1)

            if action.action_type != ActionType.END_TURN and w > 1:
                has_positive_spend = True
            action_weights.append(w)

        if total_cards > discard_limit and has_positive_spend:
            action_weights = [
                0 if a.action_type == ActionType.END_TURN else w
                for a, w in zip(playable_actions, action_weights)
            ]

        if sum(action_weights) <= 0:
            return game.state.random.choice(playable_actions)
        return game.state.random.choices(
            playable_actions, weights=action_weights, k=1
        )[0]
