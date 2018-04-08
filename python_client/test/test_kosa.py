import re

from kosa import Client

def test_can_connect_and_receive_id():
    client = Client()

    uuid_regex = re.compile('[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')

    assert uuid_regex.match(client.player_id) is not None, client.player_id + ' is not a uuid'

def test_can_get_wating():
    client = Client()
    client.join_a_game()

    assert isinstance(client.get_waiting_games(), list)
    assert len(client.get_waiting_games()) == 1

    client.start()

    assert client.get_waiting_games() == []

def test_perfoming_actions():
    client = Client()
    client.join_a_game()
    client.start()

    assert client.get_available_actions() == ['TRADE', 'BOLSTER', 'MOVE', 'PRODUCE']
    assert len(client.get_available_options('MOVE')) > 10

    client.perform_action('MOVE', 10)

def test_import_export():
    client = Client()
    client.join_a_game()
    client.start()

    game = client.export_game()

    client2 = Client()

    client2.import_game(game)

