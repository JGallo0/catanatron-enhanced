from catanatron.features import build_production_features
from catanatron.models.enums import ActionType
from catanatron.models.player import Player
from catanatron.game import Game
from catanatron.players.trade_evaluator import (
    _score_hand_utility,
    evaluate_trade_decision,
)
from catanatron.players.tree_search_utils import prune_robber_actions
from catanatron.state_functions import (
    get_longest_road_length,
    get_player_freqdeck,
    player_key,
    player_num_dev_cards,
    player_num_resource_cards,
)


class VictoryPointPlayer(Player):
    """
    Player that chooses actions by maximizing Victory Points greedily.
    When multiple actions achieve the same Victory Points, breaks ties using
    hand/dev/board progress so it builds, trades excess cards, and discards smartly.
    """

    LABEL = "Victory Point"

    def decide(self, game: Game, playable_actions):
        if len(playable_actions) == 1:
            return playable_actions[0]

        trade_action = evaluate_trade_decision(self.color, game, playable_actions)
        if trade_action is not None:
            return trade_action

        action_types = {a.action_type for a in playable_actions}
        if ActionType.MOVE_ROBBER in action_types:
            candidates = list(prune_robber_actions(self.color, game, playable_actions))
        else:
            candidates = playable_actions

        current_hand = get_player_freqdeck(game.state, self.color)
        current_hand_utility = _score_hand_utility(game.state, self.color, current_hand)
        total_cards = sum(current_hand)
        discard_limit = max(1, int(getattr(game.state, "discard_limit", 7)))
        prod_features = (
            build_production_features(True) if game.state.is_initial_build_phase else None
        )

        best_vp = float("-inf")
        best_tie = float("-inf")
        best_actions = []

        for action in candidates:
            # Skip strictly harmful maritime trades so we never waste cards below limit
            if action.action_type == ActionType.MARITIME_TRADE:
                give_cards = [r for r in action.value[:-1] if r is not None]
                recv_card = action.value[-1]
                after_hand = list(current_hand)
                from catanatron.models.enums import RESOURCES

                if give_cards and recv_card:
                    g_idx = RESOURCES.index(give_cards[0])
                    r_idx = RESOURCES.index(recv_card)
                    after_hand[g_idx] -= len(give_cards)
                    after_hand[r_idx] += 1
                    trade_delta = (
                        _score_hand_utility(game.state, self.color, after_hand)
                        - current_hand_utility
                    )
                    if total_cards <= discard_limit and trade_delta <= 0.5:
                        continue
                    if total_cards > discard_limit and trade_delta < -0.5:
                        continue

            game_copy = game.copy()
            game_copy.execute(action, validate_action=False)

            key = player_key(game_copy.state, self.color)
            vp = game_copy.state.player_state[f"{key}_ACTUAL_VICTORY_POINTS"]

            if game.state.is_initial_build_phase and prod_features is not None:
                sample = prod_features(game_copy, self.color)
                tie_score = sum(
                    v for k, v in sample.items() if k.startswith("EFFECTIVE_P0_")
                ) * 100.0 + len(game_copy.state.board.buildable_node_ids(self.color))
            else:
                after_hand = get_player_freqdeck(game_copy.state, self.color)
                hand_u = _score_hand_utility(game_copy.state, self.color, after_hand)
                devs = player_num_dev_cards(game_copy.state, self.color)
                road_len = get_longest_road_length(game_copy.state, self.color)
                buildables = len(game_copy.state.board.buildable_node_ids(self.color))
                post_cards = player_num_resource_cards(game_copy.state, self.color)
                after_excess = max(0, post_cards - discard_limit)
                tie_score = (
                    hand_u
                    + devs * 4.5
                    + road_len * 0.8
                    + buildables * 1.2
                    - (after_excess * 2.5 if after_excess > 0 else 0.0)
                )
                if action.action_type == ActionType.END_TURN:
                    tie_score -= 0.25 if total_cards <= discard_limit else 5.0
                elif action.action_type in (
                    ActionType.PLAY_KNIGHT_CARD,
                    ActionType.PLAY_ROAD_BUILDING,
                    ActionType.PLAY_YEAR_OF_PLENTY,
                    ActionType.PLAY_MONOPOLY,
                ):
                    tie_score += 2.0

            if vp > best_vp or (vp == best_vp and tie_score > best_tie + 1e-6):
                best_vp = vp
                best_tie = tie_score
                best_actions = [action]
            elif vp == best_vp and abs(tie_score - best_tie) <= 1e-6:
                best_actions.append(action)

        if not best_actions:
            return candidates[0]
        return game.state.random.choice(best_actions)
