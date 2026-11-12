def test_vote_duplicate_and_unvote_flow(
    client, member_headers, second_member_headers, seeded_snacks
):
    snack_id = seeded_snacks[0].id

    # Member 1 votes
    res1 = client.post(f"/snacks/{snack_id}/vote", headers=member_headers)
    assert res1.status_code == 201
    assert res1.json()["vote_count"] == 1
    assert res1.json()["has_voted"] is True

    # Member 1 attempts duplicate vote -> 409 Conflict
    res_dup = client.post(f"/snacks/{snack_id}/vote", headers=member_headers)
    assert res_dup.status_code == 409
    assert res_dup.json()["error"]["code"] == "ALREADY_VOTED"

    # Member 2 votes -> count becomes 2
    res2 = client.post(f"/snacks/{snack_id}/vote", headers=second_member_headers)
    assert res2.status_code == 201
    assert res2.json()["vote_count"] == 2
    assert res2.json()["has_voted"] is True

    # Verify snack details shows has_voted=True and vote_count=2
    snack_detail = client.get(f"/snacks/{snack_id}", headers=member_headers).json()
    assert snack_detail["vote_count"] == 2
    assert snack_detail["has_voted"] is True

    # Member 1 unvotes -> count becomes 1
    res_unvote = client.delete(f"/snacks/{snack_id}/vote", headers=member_headers)
    assert res_unvote.status_code == 200
    assert res_unvote.json()["vote_count"] == 1
    assert res_unvote.json()["has_voted"] is False

    # Member 1 unvotes again -> 404
    res_unvote_again = client.delete(f"/snacks/{snack_id}/vote", headers=member_headers)
    assert res_unvote_again.status_code == 404
    assert res_unvote_again.json()["error"]["code"] == "VOTE_NOT_FOUND"

    # Unknown snack -> 404
    res_missing = client.post("/snacks/99999/vote", headers=member_headers)
    assert res_missing.status_code == 404

