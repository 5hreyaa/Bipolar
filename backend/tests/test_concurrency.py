from concurrent.futures import ThreadPoolExecutor
import threading

from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.database import get_db
from app.main import app
from app.models.activity import Activity, ActivityAction
from app.models.snack import Snack, SnackCategory
from app.models.vote import Vote


def test_concurrent_consumption_of_last_3_packets(
    session_factory, db_session, admin_headers, member_headers
):
    """10 simultaneous requests trying to consume 1 packet when only 3 remain.
    Exactly 3 must succeed (200) and 7 must fail with 409 Conflict; stock must end at 0.
    """
    snack = Snack(
        name="Last 3 Cookies",
        category=SnackCategory.SWEET.value,
        quantity=3,
        low_stock_threshold=5,
    )
    db_session.add(snack)
    db_session.commit()
    db_session.refresh(snack)
    snack_id = snack.id

    def override_get_db():
        db = session_factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    try:
        barrier = threading.Barrier(10)

        def worker(_index: int) -> int:
            local_client = TestClient(app)
            barrier.wait(timeout=10)
            resp = local_client.post(
                f"/snacks/{snack_id}/consume",
                json={"amount": 1},
                headers=member_headers,
            )
            return resp.status_code

        with ThreadPoolExecutor(max_workers=10) as pool:
            status_codes = list(pool.map(worker, range(10)))

        success_count = status_codes.count(200)
        conflict_count = status_codes.count(409)

        assert success_count == 3, f"Expected 3 successes, got {status_codes}"
        assert conflict_count == 7, f"Expected 7 conflicts (409), got {status_codes}"

        # Verify database state directly with a fresh session
        verify_db = session_factory()
        try:
            updated_snack = verify_db.execute(
                select(Snack).where(Snack.id == snack_id)
            ).scalar_one()
            assert updated_snack.quantity == 0
            assert updated_snack.status == "gone"

            activity_count = verify_db.execute(
                select(func.count(Activity.id)).where(
                    Activity.snack_id == snack_id,
                    Activity.action == ActivityAction.CONSUME.value,
                )
            ).scalar_one()
            assert activity_count == 3
        finally:
            verify_db.close()
    finally:
        app.dependency_overrides.clear()


def test_concurrent_duplicate_voting_same_user(
    session_factory, db_session, member_headers
):
    """5 simultaneous vote requests by the same user for the same snack.
    PostgreSQL/SQLite UNIQUE(user_id, snack_id) ensures only 1 succeeds and 4 get 409.
    """
    snack = Snack(
        name="Concurrent Vote Chips",
        category=SnackCategory.SAVOURY.value,
        quantity=10,
        low_stock_threshold=5,
    )
    db_session.add(snack)
    db_session.commit()
    db_session.refresh(snack)
    snack_id = snack.id

    def override_get_db():
        db = session_factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    try:
        barrier = threading.Barrier(5)

        def worker(_index: int) -> int:
            local_client = TestClient(app)
            barrier.wait(timeout=10)
            resp = local_client.post(
                f"/snacks/{snack_id}/vote",
                headers=member_headers,
            )
            return resp.status_code

        with ThreadPoolExecutor(max_workers=5) as pool:
            status_codes = list(pool.map(worker, range(5)))

        assert status_codes.count(201) == 1, f"Expected 1 created, got {status_codes}"
        assert status_codes.count(409) == 4, f"Expected 4 conflicts, got {status_codes}"

        verify_db = session_factory()
        try:
            vote_count = verify_db.execute(
                select(func.count(Vote.id)).where(Vote.snack_id == snack_id)
            ).scalar_one()
            assert vote_count == 1
        finally:
            verify_db.close()
    finally:
        app.dependency_overrides.clear()

