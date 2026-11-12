def test_list_snacks_search_filter_and_pagination(client, member_headers, seeded_snacks):
    # Unfiltered
    res = client.get("/snacks?per_page=2&page=1", headers=member_headers)
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 4
    assert body["total_pages"] == 2
    assert len(body["items"]) == 2

    # Search
    res_search = client.get("/snacks?search=chocolate", headers=member_headers)
    assert res_search.status_code == 200
    assert res_search.json()["total"] == 1
    assert res_search.json()["items"][0]["name"] == "Almond Chocolate"

    # Category filter
    res_cat = client.get("/snacks?category=savoury", headers=member_headers)
    assert res_cat.status_code == 200
    assert res_cat.json()["total"] == 1
    assert res_cat.json()["items"][0]["name"] == "Spicy Chips"

    # Status filters: stocked, running_low, gone
    res_stocked = client.get("/snacks?status=stocked", headers=member_headers)
    assert res_stocked.status_code == 200
    assert {s["name"] for s in res_stocked.json()["items"]} == {"Almond Chocolate", "Protein Bar"}

    res_low = client.get("/snacks?status=running_low", headers=member_headers)
    assert res_low.status_code == 200
    assert [s["name"] for s in res_low.json()["items"]] == ["Spicy Chips"]

    res_gone = client.get("/snacks?status=gone", headers=member_headers)
    assert res_gone.status_code == 200
    assert [s["name"] for s in res_gone.json()["items"]] == ["Oat Latte"]


def test_dynamic_status_boundary_transitions(client, admin_headers, member_headers):
    # Create snack with qty=6 and threshold=5 -> stocked
    res = client.post(
        "/snacks",
        json={"name": "Boundary Crackers", "category": "savoury", "quantity": 6, "low_stock_threshold": 5},
        headers=admin_headers,
    )
    assert res.status_code == 201
    snack = res.json()
    assert snack["status"] == "stocked"
    snack_id = snack["id"]

    # Consume 1 -> qty=5 (inclusive threshold) -> running_low
    res_c1 = client.post(f"/snacks/{snack_id}/consume", json={"amount": 1}, headers=member_headers)
    assert res_c1.status_code == 200
    assert res_c1.json()["snack"]["quantity"] == 5
    assert res_c1.json()["snack"]["status"] == "running_low"

    # Consume 5 -> qty=0 -> gone
    res_c2 = client.post(f"/snacks/{snack_id}/consume", json={"amount": 5}, headers=member_headers)
    assert res_c2.status_code == 200
    assert res_c2.json()["snack"]["quantity"] == 0
    assert res_c2.json()["snack"]["status"] == "gone"

    # Restock 10 -> qty=10 -> stocked
    res_r = client.post(f"/snacks/{snack_id}/restock", json={"amount": 10}, headers=admin_headers)
    assert res_r.status_code == 200
    assert res_r.json()["snack"]["quantity"] == 10
    assert res_r.json()["snack"]["status"] == "stocked"


def test_admin_crud_and_validation(client, admin_headers, member_headers):
    # Validation: invalid category, negative quantity, blank name
    res_bad_cat = client.post(
        "/snacks",
        json={"name": "Mystery", "category": "invalid_cat", "quantity": 5},
        headers=admin_headers,
    )
    assert res_bad_cat.status_code == 422
    assert res_bad_cat.json()["error"]["code"] == "VALIDATION_ERROR"

    res_neg_qty = client.post(
        "/snacks",
        json={"name": "Bad Qty", "category": "sweet", "quantity": -2},
        headers=admin_headers,
    )
    assert res_neg_qty.status_code == 422

    res_blank = client.post(
        "/snacks",
        json={"name": "   ", "category": "sweet", "quantity": 3},
        headers=admin_headers,
    )
    assert res_blank.status_code == 422

    # Valid Create
    res_create = client.post(
        "/snacks",
        json={"name": "Mango Dried Slices", "category": "healthy-ish", "quantity": 10, "low_stock_threshold": 3},
        headers=admin_headers,
    )
    assert res_create.status_code == 201
    created = res_create.json()
    snack_id = created["id"]

    # Duplicate name (case-insensitive) -> 409
    res_dup = client.post(
        "/snacks",
        json={"name": "mango dried slices", "category": "healthy-ish", "quantity": 5},
        headers=admin_headers,
    )
    assert res_dup.status_code == 409
    assert res_dup.json()["error"]["code"] == "SNACK_ALREADY_EXISTS"

    # Read single
    res_get = client.get(f"/snacks/{snack_id}", headers=member_headers)
    assert res_get.status_code == 200
    assert res_get.json()["name"] == "Mango Dried Slices"

    # Update
    res_patch = client.patch(
        f"/snacks/{snack_id}",
        json={"name": "Organic Mango Slices", "low_stock_threshold": 4},
        headers=admin_headers,
    )
    assert res_patch.status_code == 200
    assert res_patch.json()["name"] == "Organic Mango Slices"
    assert res_patch.json()["low_stock_threshold"] == 4

    # Delete
    res_del = client.delete(f"/snacks/{snack_id}", headers=admin_headers)
    assert res_del.status_code == 200

    # Verify deleted -> 404
    res_missing = client.get(f"/snacks/{snack_id}", headers=member_headers)
    assert res_missing.status_code == 404
    assert res_missing.json()["error"]["code"] == "SNACK_NOT_FOUND"


def test_consume_insufficient_stock_and_validation(client, member_headers, seeded_snacks):
    # Spicy Chips has quantity=3
    spicy_chips = next(s for s in seeded_snacks if s.name == "Spicy Chips")

    # Requesting 5 when only 3 available -> 409
    res_over = client.post(
        f"/snacks/{spicy_chips.id}/consume",
        json={"amount": 5},
        headers=member_headers,
    )
    assert res_over.status_code == 409
    assert res_over.json()["error"]["code"] == "INSUFFICIENT_STOCK"

    # Stock remains unchanged
    res_check = client.get(f"/snacks/{spicy_chips.id}", headers=member_headers)
    assert res_check.json()["quantity"] == 3

    # Amount <= 0 -> 422
    res_zero = client.post(
        f"/snacks/{spicy_chips.id}/consume",
        json={"amount": 0},
        headers=member_headers,
    )
    assert res_zero.status_code == 422

    # Unknown snack -> 404
    res_unknown = client.post(
        "/snacks/99999/consume",
        json={"amount": 1},
        headers=member_headers,
    )
    assert res_unknown.status_code == 404


def test_summary_and_snack_of_the_week_tie_breaker(
    client, admin_headers, member_headers, second_member_headers, seeded_snacks
):
    # Vote for Protein Bar (2 votes) and Almond Chocolate (2 votes) -> tie!
    # Deterministic tie-breaker: alphabetical name ("Almond Chocolate" < "Protein Bar")
    almond = next(s for s in seeded_snacks if s.name == "Almond Chocolate")
    protein = next(s for s in seeded_snacks if s.name == "Protein Bar")

    client.post(f"/snacks/{protein.id}/vote", headers=member_headers)
    client.post(f"/snacks/{protein.id}/vote", headers=second_member_headers)
    client.post(f"/snacks/{almond.id}/vote", headers=member_headers)
    client.post(f"/snacks/{almond.id}/vote", headers=second_member_headers)

    res = client.get("/snacks/summary", headers=member_headers)
    assert res.status_code == 200
    summary = res.json()
    assert summary["total_snacks"] == 4
    assert summary["stocked_count"] == 2
    assert summary["running_low_count"] == 1
    assert summary["gone_count"] == 1
    assert summary["total_units"] == 23
    assert summary["total_votes"] == 4
    assert summary["snack_of_the_week"]["name"] == "Almond Chocolate"

    # Admin adds 1 more vote to Protein Bar -> Protein Bar wins with 3 votes
    client.post(f"/snacks/{protein.id}/vote", headers=admin_headers)
    res2 = client.get("/snacks/summary", headers=member_headers)
    assert res2.json()["snack_of_the_week"]["name"] == "Protein Bar"
    assert res2.json()["snack_of_the_week"]["vote_count"] == 3


def test_sorting_restock_errors_and_empty_summary(client, admin_headers, member_headers):
    # Empty summary when pantry has no snacks
    res_empty = client.get("/snacks/summary", headers=member_headers)
    assert res_empty.status_code == 200
    assert res_empty.json()["total_snacks"] == 0
    assert res_empty.json()["snack_of_the_week"] is None

    # Restock nonexistent -> 404
    res_nf = client.post("/snacks/99999/restock", json={"amount": 5}, headers=admin_headers)
    assert res_nf.status_code == 404
    assert res_nf.json()["error"]["code"] == "SNACK_NOT_FOUND"

    # Restock invalid amount -> 422
    res_bad = client.post("/snacks/1/restock", json={"amount": 0}, headers=admin_headers)
    assert res_bad.status_code == 422
    assert res_bad.json()["error"]["code"] == "VALIDATION_ERROR"

    # Create two snacks and test sorting by quantity desc & votes desc
    s1 = client.post(
        "/snacks",
        json={"name": "Alpha", "category": "sweet", "quantity": 2},
        headers=admin_headers,
    ).json()
    s2 = client.post(
        "/snacks",
        json={"name": "Beta", "category": "drink", "quantity": 20},
        headers=admin_headers,
    ).json()
    client.post(f"/snacks/{s1['id']}/vote", headers=member_headers)

    res_qty = client.get("/snacks?sort_by=quantity&sort_order=desc", headers=member_headers)
    assert [x["name"] for x in res_qty.json()["items"]] == ["Beta", "Alpha"]

    res_votes = client.get("/snacks?sort_by=votes&sort_order=desc", headers=member_headers)
    assert [x["name"] for x in res_votes.json()["items"]] == ["Alpha", "Beta"]

