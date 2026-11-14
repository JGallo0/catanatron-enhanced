from catanatron.apply_action import yield_resources
from catanatron.models.board import Board
from catanatron.models.player import Color
from catanatron.models.enums import SETTLEMENT, CITY
import pytest
from catanatron.models.decks import (
    freqdeck_count,
    freqdeck_draw,
    starting_resource_bank,
)


@pytest.mark.parametrize("building,quantity", [(SETTLEMENT, 1), (CITY, 2)])
def test_robber_blocks_only_occupied_hex_not_shared_adjacent_hex(building, quantity):
    board = Board()
    # A shared vertex belongs to both tiles. Give them the same resource and roll
    # to catch both an accidental vertex-wide and a resource-wide blockade.
    tiles = [(coord, tile) for coord, tile in board.map.land_tiles.items() if tile.resource is not None]
    coordinate, blocked = tiles[0]
    other_coordinate, adjacent = next((coord, tile) for coord, tile in tiles[1:]
                                    if set(tile.nodes.values()) & set(blocked.nodes.values()))
    node = next(iter(set(blocked.nodes.values()) & set(adjacent.nodes.values())))
    for _, tile in tiles:
        tile.number = 12
    blocked.number = adjacent.number = 6
    adjacent.resource = blocked.resource
    board.buildings = {node: (Color.RED, building)}
    for robber_coordinate in (coordinate, other_coordinate):
        board.robber_coordinate = robber_coordinate
        payout, depleted = yield_resources(board, starting_resource_bank(), 6)
        assert not depleted
        assert sum(payout[Color.RED]) == quantity
        assert freqdeck_count(payout[Color.RED], blocked.resource) == quantity


def test_yield_resources():
    board = Board()
    resource_freqdeck = starting_resource_bank()

    tile = board.map.land_tiles[(0, 0, 0)]
    if tile.resource is None:  # is desert
        tile = board.map.land_tiles[(-1, 0, 1)]

    board.build_settlement(Color.RED, 3, initial_build_phase=True)
    payout, depleted = yield_resources(board, resource_freqdeck, tile.number)
    assert len(depleted) == 0
    assert freqdeck_count(payout[Color.RED], tile.resource) >= 1  # type: ignore


def test_yield_resources_two_settlements():
    board = Board()
    resource_freqdeck = starting_resource_bank()

    tile, edge2, node2 = board.map.land_tiles[(0, 0, 0)], (4, 5), 5
    if tile.resource is None:  # is desert
        tile, edge2, node2 = board.map.land_tiles[(-1, 0, 1)], (4, 15), 15

    board.build_settlement(Color.RED, 3, initial_build_phase=True)
    board.build_road(Color.RED, (3, 4))
    board.build_road(Color.RED, edge2)
    board.build_settlement(Color.RED, node2)
    payout, depleted = yield_resources(board, resource_freqdeck, tile.number)
    assert len(depleted) == 0
    assert freqdeck_count(payout[Color.RED], tile.resource) >= 2  # type: ignore


def test_yield_resources_two_players_and_city():
    board = Board()
    resource_freqdeck = starting_resource_bank()

    tile, edge1, edge2, red_node, blue_node = (
        board.map.land_tiles[(0, 0, 0)],
        (2, 3),
        (3, 4),
        4,
        0,
    )
    if tile.resource is None:  # is desert
        tile, edge1, edge2, red_node, blue_node = (
            board.map.land_tiles[(1, -1, 0)],
            (9, 2),
            (9, 8),
            8,
            6,
        )

    # red has one settlements and one city on tile
    board.build_settlement(Color.RED, 2, initial_build_phase=True)
    board.build_road(Color.RED, edge1)
    board.build_road(Color.RED, edge2)
    board.build_settlement(Color.RED, red_node)
    board.build_city(Color.RED, red_node)

    # blue has a city in tile
    board.build_settlement(Color.BLUE, blue_node, initial_build_phase=True)
    board.build_city(Color.BLUE, blue_node)
    payout, depleted = yield_resources(board, resource_freqdeck, tile.number)
    assert len(depleted) == 0
    assert freqdeck_count(payout[Color.RED], tile.resource) >= 3  # type: ignore
    assert freqdeck_count(payout[Color.BLUE], tile.resource) >= 2  # type: ignore


def test_empty_payout_if_not_enough_resources():
    board = Board()
    resource_freqdeck = starting_resource_bank()

    tile = board.map.land_tiles[(0, 0, 0)]
    if tile.resource is None:  # is desert
        tile = board.map.land_tiles[(-1, 0, 1)]

    board.build_settlement(Color.RED, 3, initial_build_phase=True)
    board.build_city(Color.RED, 3)
    freqdeck_draw(resource_freqdeck, 18, tile.resource)  # type: ignore

    payout, depleted = yield_resources(board, resource_freqdeck, tile.number)
    assert depleted == [tile.resource]
    assert (
        Color.RED not in payout or freqdeck_count(payout[Color.RED], tile.resource) == 0  # type: ignore
    )
