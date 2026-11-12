from datetime import timedelta

from app.models.user import User
from app.services.auth import create_access_token


def test_login_success_admin_and_member(client, admin_user: User, member_user: User):
    res_admin = client.post(
        "/auth/login",
        json={"email": "admin@test.com", "password": "adminpass123"},
    )
    assert res_admin.status_code == 200
    data = res_admin.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "admin@test.com"
    assert data["user"]["role"] == "admin"
    assert "password_hash" not in data["user"]

    # Case-insensitive email check
    res_member = client.post(
        "/auth/login",
        json={"email": "MEMBER@TEST.COM", "password": "memberpass123"},
    )
    assert res_member.status_code == 200
    assert res_member.json()["user"]["role"] == "member"


def test_password_not_stored_in_plaintext(admin_user: User):
    assert admin_user.password_hash != "adminpass123"
    assert admin_user.password_hash.startswith("$argon2")


def test_login_invalid_credentials(client, member_user: User):
    res_wrong_pw = client.post(
        "/auth/login",
        json={"email": "member@test.com", "password": "wrongpassword"},
    )
    assert res_wrong_pw.status_code == 401
    err = res_wrong_pw.json()
    assert "error" in err
    assert err["error"]["code"] == "INVALID_CREDENTIALS"

    res_unknown_email = client.post(
        "/auth/login",
        json={"email": "nobody@test.com", "password": "memberpass123"},
    )
    assert res_unknown_email.status_code == 401
    assert res_unknown_email.json()["error"]["code"] == "INVALID_CREDENTIALS"


def test_jwt_validation_and_expired_token(client, member_user: User):
    # No token
    res_no_token = client.get("/auth/me")
    assert res_no_token.status_code == 401
    assert res_no_token.json()["error"]["code"] == "UNAUTHORIZED"

    # Malformed token
    res_bad = client.get("/auth/me", headers={"Authorization": "Bearer not.a.jwt"})
    assert res_bad.status_code == 401
    assert res_bad.json()["error"]["code"] == "INVALID_TOKEN"

    # Expired token
    expired_token = create_access_token(member_user, expires_delta=timedelta(minutes=-5))
    res_exp = client.get("/auth/me", headers={"Authorization": f"Bearer {expired_token}"})
    assert res_exp.status_code == 401
    assert res_exp.json()["error"]["code"] == "INVALID_TOKEN"

    # Valid token
    valid_token = create_access_token(member_user)
    res_ok = client.get("/auth/me", headers={"Authorization": f"Bearer {valid_token}"})
    assert res_ok.status_code == 200
    assert res_ok.json()["email"] == "member@test.com"


def test_member_blocked_from_admin_endpoints(client, member_headers, seeded_snacks):
    snack_id = seeded_snacks[0].id

    res_create = client.post(
        "/snacks",
        json={"name": "New Snack", "category": "sweet", "quantity": 10},
        headers=member_headers,
    )
    assert res_create.status_code == 403
    assert res_create.json()["error"]["code"] == "FORBIDDEN"

    res_patch = client.patch(
        f"/snacks/{snack_id}",
        json={"name": "Renamed Snack"},
        headers=member_headers,
    )
    assert res_patch.status_code == 403
    assert res_patch.json()["error"]["code"] == "FORBIDDEN"

    res_delete = client.delete(f"/snacks/{snack_id}", headers=member_headers)
    assert res_delete.status_code == 403
    assert res_delete.json()["error"]["code"] == "FORBIDDEN"

    res_restock = client.post(
        f"/snacks/{snack_id}/restock",
        json={"amount": 5},
        headers=member_headers,
    )
    assert res_restock.status_code == 403
    assert res_restock.json()["error"]["code"] == "FORBIDDEN"

    res_activities = client.get("/activities", headers=member_headers)
    assert res_activities.status_code == 403
    assert res_activities.json()["error"]["code"] == "FORBIDDEN"

