import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Plus,
  PlusCircle,
  RefreshCw,
  Trash2,
} from "lucide-react";

import {
  createSnack,
  deleteSnack,
  fetchSnacks,
  restockSnack,
  updateSnack,
} from "../api/snacks";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { EmptyState } from "../components/common/EmptyState";
import { SnackImage } from "../components/common/SnackImage";
import { TableSkeleton } from "../components/common/Skeleton";
import { StatusBadge } from "../components/common/StatusBadge";
import { RestockModal } from "../components/snacks/RestockModal";
import { SnackFilter } from "../components/snacks/SnackFilter";
import { SnackFormModal } from "../components/snacks/SnackFormModal";
import { useToast } from "../context/ToastContext";
import { useWebSocket } from "../context/WebSocketContext";
import { Snack, SnackCategory, SnackCreateInput, SnackStatus } from "../types";

export function AdminSnacksPage() {
  const toast = useToast();
  const { subscribe } = useWebSocket();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState<SnackCategory | "">("");
  const [statusFilter, setStatusFilter] = useState<SnackStatus | "">("");
  const [sortBy, setSortBy] = useState<"name" | "quantity" | "votes">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  const [snacks, setSnacks] = useState<Snack[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingSnack, setEditingSnack] = useState<Snack | null>(null);
  const [restockTarget, setRestockTarget] = useState<Snack | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Snack | null>(null);
  const [isMutating, setIsMutating] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadSnacks = useCallback(
    async (showSpinner = false) => {
      if (showSpinner) setLoading(true);
      setError("");
      try {
        const res = await fetchSnacks({
          search: debouncedSearch,
          category,
          status: statusFilter,
          sort_by: sortBy,
          sort_order: sortOrder,
          page,
          per_page: 12,
        });
        setSnacks(res.items);
        setTotal(res.total);
        setTotalPages(res.total_pages);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load inventory.");
      } finally {
        setLoading(false);
      }
    },
    [debouncedSearch, category, statusFilter, sortBy, sortOrder, page]
  );

  useEffect(() => {
    void loadSnacks(true);
  }, [loadSnacks]);

  useEffect(() => {
    return subscribe(() => {
      void loadSnacks(false);
    });
  }, [subscribe, loadSnacks]);

  const handleSaveSnack = async (values: SnackCreateInput) => {
    setIsMutating(true);
    try {
      if (editingSnack) {
        await updateSnack(editingSnack.id, values);
        toast.success(`Updated "${values.name}".`);
      } else {
        await createSnack(values);
        toast.success(`Added "${values.name}" to the pantry.`);
      }
      setFormOpen(false);
      setEditingSnack(null);
      await loadSnacks(false);
    } finally {
      setIsMutating(false);
    }
  };

  const handleRestock = async (snackId: number, amount: number) => {
    setIsMutating(true);
    try {
      const res = await restockSnack(snackId, amount);
      toast.success(`Restocked ${res.snack.name} (+${amount} units).`);
      setRestockTarget(null);
      await loadSnacks(false);
    } finally {
      setIsMutating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsMutating(true);
    try {
      await deleteSnack(deleteTarget.id);
      toast.success(`Deleted "${deleteTarget.name}".`);
      setDeleteTarget(null);
      await loadSnacks(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete snack.");
    } finally {
      setIsMutating(false);
    }
  };

  return (
    <main className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Manage Pantry Inventory</h1>
          <p className="page-subtitle">
            Add new snacks, update thresholds, restock shelves, or retire items.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link to="/admin/scanner" className="btn btn-blue">
            <Camera size={16} />
            <span>Smart Snack Scanner</span>
          </Link>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setEditingSnack(null);
              setFormOpen(true);
            }}
          >
            <Plus size={17} />
            <span>Add Snack</span>
          </button>
        </div>
      </div>

      <SnackFilter
        search={search}
        onSearchChange={setSearch}
        category={category}
        onCategoryChange={(v) => {
          setCategory(v);
          setPage(1);
        }}
        status={statusFilter}
        onStatusChange={(v) => {
          setStatusFilter(v);
          setPage(1);
        }}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={(f, o) => {
          setSortBy(f);
          setSortOrder(o);
          setPage(1);
        }}
      />

      {error && (
        <div className="alert alert-error" role="alert">
          <span>{error}</span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void loadSnacks(true)}
          >
            <RefreshCw size={14} />
            <span>Retry</span>
          </button>
        </div>
      )}

      {loading ? (
        <TableSkeleton rows={8} cols={6} />
      ) : snacks.length === 0 ? (
        <EmptyState
          title="No snacks found"
          description="No snacks match your current filters, or the pantry is empty."
          action={
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setEditingSnack(null);
                setFormOpen(true);
              }}
            >
              <Plus size={16} />
              <span>Add Snack</span>
            </button>
          }
        />
      ) : (
        <>
          <div className="card table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Snack</th>
                  <th>Category</th>
                  <th>Stock</th>
                  <th>Threshold</th>
                  <th>Status</th>
                  <th>Votes</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {snacks.map((snack) => (
                  <tr key={snack.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <SnackImage imageUrl={snack.image_url} alt={snack.name} variant="thumb" />
                        <div>
                          <Link
                            to={`/snacks/${snack.id}`}
                            style={{ fontWeight: 700, color: "var(--text-primary)" }}
                          >
                            {snack.name}
                          </Link>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 2 }}>
                            {snack.brand && (
                              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                                {snack.brand}
                              </span>
                            )}
                            {snack.price !== null && snack.price !== undefined && (
                              <span className="price-tag tabular-nums">
                                ₹{Number(snack.price).toFixed(0)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="category-chip">{snack.category}</span>
                    </td>
                    <td className="tabular-nums" style={{ fontWeight: 700 }}>
                      {snack.quantity}
                    </td>
                    <td className="tabular-nums" style={{ color: "var(--text-muted)" }}>
                      {snack.low_stock_threshold}
                    </td>
                    <td>
                      <StatusBadge status={snack.status} />
                    </td>
                    <td className="tabular-nums">{snack.vote_count}</td>
                    <td>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => setRestockTarget(snack)}
                          title="Restock"
                        >
                          <PlusCircle size={14} />
                          <span>Restock</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setEditingSnack(snack);
                            setFormOpen(true);
                          }}
                          aria-label={`Edit ${snack.name}`}
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => setDeleteTarget(snack)}
                          aria-label={`Delete ${snack.name}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <div className="pagination-info tabular-nums">
                Page {page} of {totalPages} ({total} snacks)
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

      <SnackFormModal
        isOpen={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingSnack(null);
        }}
        onSubmit={handleSaveSnack}
        initialSnack={editingSnack}
        isSubmitting={isMutating}
      />

      <RestockModal
        snack={restockTarget}
        onClose={() => setRestockTarget(null)}
        onSubmit={handleRestock}
        isSubmitting={isMutating}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Snack"
        message={
          deleteTarget
            ? `Are you sure you want to delete "${deleteTarget.name}"? This removes the snack from the catalog while preserving past activity logs.`
            : ""
        }
        confirmLabel="Delete Snack"
        isLoading={isMutating}
      />
    </main>
  );
}

