import pytest
from starlette.websockets import WebSocketDisconnect

from app.services.auth import create_access_token


def test_websocket_rejects_missing_or_invalid_token(client):
    with pytest.raises(WebSocketDisconnect) as exc_info:
        with client.websocket_connect("/ws"):
            pass
    assert exc_info.value.code == 4001

    with pytest.raises(WebSocketDisconnect) as exc_info_bad:
        with client.websocket_connect("/ws?token=invalid.jwt.token"):
            pass
    assert exc_info_bad.value.code == 4001


def test_websocket_receives_post_commit_stock_and_vote_updates(
    client, member_user, seeded_snacks
):
    token = create_access_token(member_user)
    headers = {"Authorization": f"Bearer {token}"}
    snack_id = seeded_snacks[0].id

    with client.websocket_connect(f"/ws?token={token}") as ws:
        hello = ws.receive_json()
        assert hello == {"event": "connected", "data": {"status": "ok"}}

        # Ping / Pong
        ws.send_text("ping")
        pong = ws.receive_json()
        assert pong == {"event": "pong", "data": {}}

        # Trigger consume via REST API -> WS receives stock_updated after commit
        res_consume = client.post(
            f"/snacks/{snack_id}/consume",
            json={"amount": 1},
            headers=headers,
        )
        assert res_consume.status_code == 200
        stock_msg = ws.receive_json()
        assert stock_msg["event"] == "stock_updated"
        assert stock_msg["data"]["snack_id"] == snack_id
        assert stock_msg["data"]["quantity"] == res_consume.json()["remaining_quantity"]

        # Trigger vote via REST API -> WS receives vote_updated after commit
        res_vote = client.post(f"/snacks/{snack_id}/vote", headers=headers)
        assert res_vote.status_code == 201
        vote_msg = ws.receive_json()
        assert vote_msg["event"] == "vote_updated"
        assert vote_msg["data"]["snack_id"] == snack_id
        assert vote_msg["data"]["vote_count"] == 1

