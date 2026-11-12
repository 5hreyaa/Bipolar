def test_activity_records_created_for_operations(
    client, admin_headers, member_headers
):
    # Admin creates a snack
    res_create = client.post(
        "/snacks",
        json={"name": "Cashew Clusters", "category": "healthy-ish", "quantity": 5, "low_stock_threshold": 2},
        headers=admin_headers,
    )
    assert res_create.status_code == 201
    snack_id = res_create.json()["id"]

    # Member consumes 2
    res_consume = client.post(
        f"/snacks/{snack_id}/consume",
        json={"amount": 2},
        headers=member_headers,
    )
    assert res_consume.status_code == 200

    # Admin restocks 10
    res_restock = client.post(
        f"/snacks/{snack_id}/restock",
        json={"amount": 10},
        headers=admin_headers,
    )
    assert res_restock.status_code == 200

    # Admin updates snack
    res_update = client.patch(
        f"/snacks/{snack_id}",
        json={"low_stock_threshold": 3},
        headers=admin_headers,
    )
    assert res_update.status_code == 200

    # Member cannot read activities
    assert client.get("/activities", headers=member_headers).status_code == 403

    # Admin lists paginated activities
    res_act = client.get("/activities?per_page=2&page=1", headers=admin_headers)
    assert res_act.status_code == 200
    body = res_act.json()
    assert body["total"] == 4
    assert body["total_pages"] == 2
    assert len(body["items"]) == 2
    # Ordered newest first
    assert body["items"][0]["action"] == "update"
    assert body["items"][1]["action"] == "restock"
    assert body["items"][1]["amount"] == 10

    # Filter by action=consume
    res_consume_filter = client.get("/activities?action=consume", headers=admin_headers)
    assert res_consume_filter.status_code == 200
    consume_items = res_consume_filter.json()["items"]
    assert len(consume_items) == 1
    assert consume_items[0]["amount"] == 2
    assert consume_items[0]["user_email"] == "member@test.com"
    assert consume_items[0]["snack_name"] == "Cashew Clusters"

    # Admin deletes snack -> activity log preserves delete record without crashing
    res_del = client.delete(f"/snacks/{snack_id}", headers=admin_headers)
    assert res_del.status_code == 200

    res_all = client.get("/activities?per_page=10", headers=admin_headers)
    assert res_all.status_code == 200
    assert res_all.json()["total"] == 5
    assert res_all.json()["items"][0]["action"] == "delete"
    assert res_all.json()["items"][0]["snack_name"] == "Cashew Clusters"

