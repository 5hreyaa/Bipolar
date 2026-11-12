import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Clock,
  Edit3,
  PlusCircle,
  ShoppingBag,
  ThumbsUp,
  Trash2,
} from "lucide-react";

import { fetchActivities } from "../api/activities";
import {
  consumeSnack,
  deleteSnack,
  fetchSnackById,
  restockSnack,
  unvoteSnack,
  updateSnack,
  voteSnack,
} from "../api/snacks";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { EmptyState } from "../components/common/EmptyState";
import { SnackImage } from "../components/common/SnackImage";
import { StatusBadge } from "../components/common/StatusBadge";
import { RestockModal } from "../components/snacks/RestockModal";
import { SnackFormModal } from "../components/snacks/SnackFormModal";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useWebSocket } from "../context/WebSocketContext";
import { Activity, Snack, SnackCreateInput } from "../types";

export function SnackDetailPage() {
  const { id } = useParams<{ id: string }>();
  const snackId = Number(id);
  const { isAdmin } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { subscribe } = useWebSocket();

  const [snack, setSnack] = useState<Snack | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [consumeAmount, setConsumeAmount] = useState("1");
  const [isBusy, setIsBusy] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [restockOpen, setRestockOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const loadDetail = useCallback(
    async (showSpinner = false) => {
      if (!Number.isInteger(snackId) || snackId <= 0) {
        setError("Invalid snack identifier.");
        setLoading(false);
        return;
      }

      if (showSpinner) setLoading(true);
      setError("");
      try {
        const snackData = await fetchSnackById(snackId);
        setSnack(snackData);

        if (isAdmin) {
          const actRes = await fetchActivities({ snack_id: snackId, page: 1, per_page: 8 });
          setActivities(actRes.items);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load snack details.");
      } finally {
        setLoading(false);
      }
    },
    [snackId, isAdmin]
  );

  useEffect(() => {
    void loadDetail(true);
  }, [loadDetail]);

  useEffect(() => {
    return subscribe((msg) => {
      if (msg.event === "snack_deleted" && Number(msg.data.snack_id) === snackId) {
        toast.warning("This snack was removed by an administrator.");
        navigate("/snacks", { replace: true });
        return;
      }
      void loadDetail(false);
    });
  }, [subscribe, loadDetail, snackId, navigate, toast]);

  const handleConsume = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!snack) return;
    const amount = Number(consumeAmount);
    if (!Number.isInteger(amount) || amount < 1) {
      toast.error("Please enter a valid positive number of packets.");
      return;
    }

    setIsBusy(true);
    try {
      const res = await consumeSnack(snack.id, amount);
      toast.success(
        `Consumed ${res.consumed_amount} × ${snack.name}. (${res.remaining_quantity} remaining)`,
        "Enjoy!"
      );
      setConsumeAmount("1");
      await loadDetail(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to consume snack.");
      await loadDetail(false);
    } finally {
      setIsBusy(false);
    }
  };

  const handleToggleVote = async () => {
    if (!snack) return;
    setIsBusy(true);
    try {
      if (snack.has_voted) {
        await unvoteSnack(snack.id);
        toast.info(`Removed vote for ${snack.name}.`);
      } else {
        await voteSnack(snack.id);
        toast.success(`Voted for ${snack.name}!`);
      }
      await loadDetail(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update vote.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleUpdate = async (values: SnackCreateInput) => {
    if (!snack) return;
    setIsBusy(true);
    try {
      await updateSnack(snack.id, values);
      toast.success(`Updated ${values.name}.`);
      setEditOpen(false);
      await loadDetail(false);
    } finally {
      setIsBusy(false);
    }
  };

  const handleRestock = async (_id: number, amount: number) => {
    if (!snack) return;
    setIsBusy(true);
    try {
      await restockSnack(snack.id, amount);
      toast.success(`Added ${amount} units to ${snack.name}.`);
      setRestockOpen(false);
      await loadDetail(false);
    } finally {
      setIsBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!snack) return;
    setIsBusy(true);
    try {
      await deleteSnack(snack.id);
      toast.success(`Deleted ${snack.name} from pantry.`);
      navigate("/snacks", { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete snack.");
      setIsBusy(false);
    }
  };

  if (loading) {
    return (
      <main className="page-container">
        <div className="skeleton" style={{ height: 24, width: 140, marginBottom: 20 }} />
        <div className="detail-grid">
          <div className="skeleton" style={{ height: 280, borderRadius: 12 }} />
          <div className="skeleton" style={{ height: 280, borderRadius: 12 }} />
        </div>
      </main>
    );
  }

  if (error || !snack) {
    return (
      <main className="page-container">
        <Link to="/snacks" className="btn btn-secondary btn-sm" style={{ marginBottom: 18 }}>
          <ArrowLeft size={15} />
          <span>Back to Snacks</span>
        </Link>
        <EmptyState
          title="Snack unavailable"
          description={error || "We couldn't find this snack in the pantry."}
          action={
            <Link to="/snacks" className="btn btn-primary">
              Browse All Snacks
            </Link>
          }
        />
      </main>
    );
  }

  const meterScale = Math.max(snack.low_stock_threshold * 3, 15);
  const meterPercent = Math.min(100, Math.round((snack.quantity / meterScale) * 100));

  return (
    <main className="page-container">
      <div style={{ marginBottom: 18 }}>
        <Link to="/snacks" className="btn btn-secondary btn-sm">
          <ArrowLeft size={15} />
          <span>Back to Catalog</span>
        </Link>
      </div>

      <div className="detail-grid">
        {/* Left: Main Snack Card */}
        <section className="card" style={{ padding: 24 }}>
          <div style={{ marginBottom: 20 }}>
            <SnackImage imageUrl={snack.image_url} alt={snack.name} variant="detail" />
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 18,
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                <span className="category-chip">{snack.category}</span>
                {snack.brand && <span className="snack-brand-text" style={{ marginTop: 0 }}>{snack.brand}</span>}
                {snack.price !== null && snack.price !== undefined && (
                  <span className="price-tag tabular-nums">₹{Number(snack.price).toFixed(2)}</span>
                )}
              </div>
              <h1 className="page-title" style={{ marginTop: 4 }}>
                {snack.name}
              </h1>
            </div>
            <StatusBadge status={snack.status} />
          </div>

          <div
            style={{
              padding: 18,
              borderRadius: 12,
              background: "var(--bg-subtle)",
              marginBottom: 22,
            }}
          >
            <div className="stock-meter-row" style={{ marginBottom: 8 }}>
              <span style={{ fontSize: "0.95rem", color: "var(--text-secondary)" }}>
                Available Quantity
              </span>
              <span className="tabular-nums" style={{ fontSize: "1.6rem", fontWeight: 800 }}>
                {snack.quantity}
              </span>
            </div>
            <div className="progress-track" style={{ height: 10 }}>
              <div
                className={`progress-fill ${snack.status}`}
                style={{ width: `${snack.quantity === 0 ? 0 : Math.max(6, meterPercent)}%` }}
              />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 8,
                fontSize: "0.8rem",
                color: "var(--text-muted)",
              }}
            >
              <span>Running low alert at ≤ {snack.low_stock_threshold}</span>
              <span>Updated {new Date(snack.updated_at).toLocaleString()}</span>
            </div>
          </div>

          {/* Member Actions: Vote + Consume */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-end" }}>
            <button
              type="button"
              className={`vote-btn${snack.has_voted ? " voted" : ""}`}
              style={{ padding: "10px 16px" }}
              onClick={handleToggleVote}
              disabled={isBusy}
              aria-pressed={snack.has_voted}
            >
              <ThumbsUp size={16} />
              <span>{snack.has_voted ? "Voted" : "Vote for Snack of the Week"}</span>
              <strong className="tabular-nums">({snack.vote_count})</strong>
            </button>

            <form
              onSubmit={handleConsume}
              style={{ display: "flex", alignItems: "flex-end", gap: 10, marginLeft: "auto" }}
            >
              <div>
                <label
                  htmlFor="consume-amount"
                  className="form-label"
                  style={{ display: "block", marginBottom: 4 }}
                >
                  Amount
                </label>
                <input
                  id="consume-amount"
                  type="number"
                  min={1}
                  max={Math.max(1, snack.quantity)}
                  className="input tabular-nums"
                  style={{ width: 84 }}
                  value={consumeAmount}
                  onChange={(e) => setConsumeAmount(e.target.value)}
                  disabled={snack.quantity === 0 || isBusy}
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={snack.quantity === 0 || isBusy}
              >
                <ShoppingBag size={16} />
                <span>{snack.quantity === 0 ? "Out of Stock" : "Consume"}</span>
              </button>
            </form>
          </div>
        </section>

        {/* Right: Admin Controls OR Pantry Guidelines */}
        <section style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {isAdmin ? (
            <div className="card" style={{ padding: 22 }}>
              <h2 style={{ margin: "0 0 14px", fontSize: "1.05rem", fontWeight: 700 }}>
                Admin Controls
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setRestockOpen(true)}
                  disabled={isBusy}
                >
                  <PlusCircle size={16} />
                  <span>Restock Inventory</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditOpen(true)}
                  disabled={isBusy}
                >
                  <Edit3 size={16} />
                  <span>Edit Details & Threshold</span>
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => setDeleteOpen(true)}
                  disabled={isBusy}
                >
                  <Trash2 size={16} />
                  <span>Delete Snack</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: 22 }}>
              <h2 style={{ margin: "0 0 8px", fontSize: "1.05rem", fontWeight: 700 }}>
                About Office Voting & Stock
              </h2>
              <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: 1.6 }}>
                Every team member gets one vote per snack. Top-voted snacks are highlighted as Snack
                of the Week and prioritized during restocks. Stock updates automatically across all
                connected browsers in real time.
              </p>
            </div>
          )}

          {isAdmin && (
            <div className="card" style={{ padding: 22 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 14,
                }}
              >
                <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700 }}>
                  Recent Snack Activity
                </h2>
                <Link
                  to="/admin/activity"
                  style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--brand-sky)" }}
                >
                  View all
                </Link>
              </div>

              {activities.length === 0 ? (
                <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--text-muted)" }}>
                  No recorded activity for this snack yet.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {activities.map((act) => (
                    <div
                      key={act.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                        paddingBottom: 10,
                        borderBottom: "1px solid var(--border)",
                        fontSize: "0.85rem",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600 }}>{act.user_name || "Unknown"}</div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            color: "var(--text-muted)",
                            fontSize: "0.76rem",
                          }}
                        >
                          <Clock size={12} />
                          <span>{new Date(act.created_at).toLocaleString()}</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className={`action-badge ${act.action}`}>{act.action}</span>
                        <span className="tabular-nums" style={{ fontWeight: 700 }}>
                          {act.action === "consume" ? `-${act.amount}` : `+${act.amount}`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {isAdmin && (
        <>
          <SnackFormModal
            isOpen={editOpen}
            onClose={() => setEditOpen(false)}
            onSubmit={handleUpdate}
            initialSnack={snack}
            isSubmitting={isBusy}
          />
          <RestockModal
            snack={restockOpen ? snack : null}
            onClose={() => setRestockOpen(false)}
            onSubmit={handleRestock}
            isSubmitting={isBusy}
          />
          <ConfirmDialog
            isOpen={deleteOpen}
            onClose={() => setDeleteOpen(false)}
            onConfirm={handleDelete}
            title="Delete Snack"
            message={`Are you sure you want to permanently remove "${snack.name}" from the office pantry? Existing activity logs will be preserved.`}
            confirmLabel="Delete Snack"
            isLoading={isBusy}
          />
        </>
      )}
    </main>
  );
}

