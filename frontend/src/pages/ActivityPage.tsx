import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Activity as ActivityIcon, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";

import { fetchActivities } from "../api/activities";
import { EmptyState } from "../components/common/EmptyState";
import { TableSkeleton } from "../components/common/Skeleton";
import { useWebSocket } from "../context/WebSocketContext";
import { Activity, ActivityAction } from "../types";

const ACTION_FILTERS: Array<{ value: ActivityAction | ""; label: string }> = [
  { value: "", label: "All Actions" },
  { value: "consume", label: "Consume" },
  { value: "restock", label: "Restock" },
  { value: "create", label: "Create" },
  { value: "update", label: "Update" },
  { value: "delete", label: "Delete" },
];

export function ActivityPage() {
  const { subscribe } = useWebSocket();

  const [actionFilter, setActionFilter] = useState<ActivityAction | "">("");
  const [page, setPage] = useState(1);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadActivities = useCallback(
    async (showSpinner = false) => {
      if (showSpinner) setLoading(true);
      setError("");
      try {
        const res = await fetchActivities({
          page,
          per_page: 15,
          action: actionFilter,
        });
        setActivities(res.items);
        setTotal(res.total);
        setTotalPages(res.total_pages);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load activity log.");
      } finally {
        setLoading(false);
      }
    },
    [page, actionFilter]
  );

  useEffect(() => {
    void loadActivities(true);
  }, [loadActivities]);

  useEffect(() => {
    return subscribe((msg) => {
      if (
        msg.event === "stock_updated" ||
        msg.event === "snack_created" ||
        msg.event === "snack_updated" ||
        msg.event === "snack_deleted"
      ) {
        void loadActivities(false);
      }
    });
  }, [subscribe, loadActivities]);

  const formatAmountDelta = (act: Activity): string => {
    if (act.action === "consume") return `-${act.amount}`;
    if (act.action === "restock") return `+${act.amount}`;
    return String(act.amount);
  };

  return (
    <main className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Pantry Activity Log</h1>
          <p className="page-subtitle">
            Auditable transaction history for consumptions, restocks, and catalog changes.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => void loadActivities(true)}
        >
          <RefreshCw size={14} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="card" style={{ padding: 14, marginBottom: 20 }}>
        <div className="pill-group" role="group" aria-label="Filter activities by action">
          {ACTION_FILTERS.map((item) => (
            <button
              key={item.label}
              type="button"
              className={`filter-pill${actionFilter === item.value ? " active" : ""}`}
              onClick={() => {
                setActionFilter(item.value);
                setPage(1);
              }}
              aria-pressed={actionFilter === item.value}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          <span>{error}</span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void loadActivities(true)}
          >
            <RefreshCw size={14} />
            <span>Retry</span>
          </button>
        </div>
      )}

      {loading ? (
        <TableSkeleton rows={10} cols={5} />
      ) : activities.length === 0 ? (
        <EmptyState
          icon={<ActivityIcon size={26} />}
          title="No activity records found"
          description="Pantry consumptions, restocks, and admin edits will appear here."
          action={
            actionFilter ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setActionFilter("");
                  setPage(1);
                }}
              >
                Show All Actions
              </button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="card table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Snack</th>
                  <th style={{ textAlign: "right" }}>Units</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((act) => (
                  <tr key={act.id}>
                    <td style={{ color: "var(--text-secondary)", whiteSpace: "nowrap", fontSize: "0.85rem" }}>
                      {new Date(act.created_at).toLocaleString()}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{act.user_name || "Unknown User"}</div>
                      {act.user_email && (
                        <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                          {act.user_email}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`action-badge ${act.action}`}>{act.action}</span>
                    </td>
                    <td>
                      {act.snack_id ? (
                        <Link
                          to={`/snacks/${act.snack_id}`}
                          style={{ fontWeight: 600, color: "var(--brand-sky)" }}
                        >
                          {act.snack_name}
                        </Link>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>
                          {act.snack_name} (removed)
                        </span>
                      )}
                    </td>
                    <td
                      className="tabular-nums"
                      style={{
                        textAlign: "right",
                        fontWeight: 700,
                        color:
                          act.action === "consume"
                            ? "#0369a1"
                            : act.action === "restock"
                              ? "#15803d"
                              : "var(--text-primary)",
                      }}
                    >
                      {formatAmountDelta(act)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <div className="pagination-info tabular-nums">
                Page {page} of {totalPages} ({total} events)
              </div>
              <div className="pagination-controls">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={15} />
                  <span>Previous</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <span>Next</span>
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}

