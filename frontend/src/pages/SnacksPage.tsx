import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";

import {
  consumeSnack,
  fetchSnacks,
  restockSnack,
  unvoteSnack,
  voteSnack,
} from "../api/snacks";
import { EmptyState } from "../components/common/EmptyState";
import { SnackGridSkeleton } from "../components/common/Skeleton";
import { RestockModal } from "../components/snacks/RestockModal";
import { SnackCard } from "../components/snacks/SnackCard";
import { SnackFilter } from "../components/snacks/SnackFilter";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useWebSocket } from "../context/WebSocketContext";
import { Snack, SnackCategory, SnackStatus } from "../types";

export function SnacksPage() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const { subscribe } = useWebSocket();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialSearch = searchParams.get("search") || "";
  const initialCategory = (searchParams.get("category") || "") as SnackCategory | "";
  const initialStatus = (searchParams.get("status") || "") as SnackStatus | "";
  const initialSortBy = (searchParams.get("sort_by") || "name") as "name" | "quantity" | "votes";
  const initialSortOrder = (searchParams.get("sort_order") || "asc") as "asc" | "desc";
  const initialPage = Math.max(1, Number(searchParams.get("page") || "1"));

  const [searchInput, setSearchInput] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [category, setCategory] = useState<SnackCategory | "">(initialCategory);
  const [statusFilter, setStatusFilter] = useState<SnackStatus | "">(initialStatus);
  const [sortBy, setSortBy] = useState<"name" | "quantity" | "votes">(initialSortBy);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(initialSortOrder);
  const [page, setPage] = useState(initialPage);

  const [snacks, setSnacks] = useState<Snack[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busySnackId, setBusySnackId] = useState<number | null>(null);
  const [restockTarget, setRestockTarget] = useState<Snack | null>(null);
  const [isRestocking, setIsRestocking] = useState(false);

  // Debounce search query
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  // Keep URL query params synchronized
  useEffect(() => {
    const next = new URLSearchParams();
    if (debouncedSearch.trim()) next.set("search", debouncedSearch.trim());
    if (category) next.set("category", category);
    if (statusFilter) next.set("status", statusFilter);
    if (sortBy !== "name") next.set("sort_by", sortBy);
    if (sortOrder !== "asc") next.set("sort_order", sortOrder);
    if (page > 1) next.set("page", String(page));
    setSearchParams(next, { replace: true });
  }, [debouncedSearch, category, statusFilter, sortBy, sortOrder, page, setSearchParams]);

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
          per_page: 9,
        });
        setSnacks(res.items);
        setTotal(res.total);
        setTotalPages(res.total_pages);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load snacks.");
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

  const handleConsume = async (snack: Snack) => {
    setBusySnackId(snack.id);
    try {
      const res = await consumeSnack(snack.id, 1);
      toast.success(
        `Grabbed 1 ${snack.name}. (${res.remaining_quantity} left)`,
        "Snack consumed"
      );
      await loadSnacks(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to consume snack.");
      await loadSnacks(false);
    } finally {
      setBusySnackId(null);
    }
  };

  const handleToggleVote = async (snack: Snack) => {
    setBusySnackId(snack.id);
    try {
      if (snack.has_voted) {
        await unvoteSnack(snack.id);
        toast.info(`Removed your vote for ${snack.name}.`);
      } else {
        await voteSnack(snack.id);
        toast.success(`Voted for ${snack.name}!`);
      }
      await loadSnacks(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to update vote.");
    } finally {
      setBusySnackId(null);
    }
  };

  const handleRestockSubmit = async (snackId: number, amount: number) => {
    setIsRestocking(true);
    try {
      const res = await restockSnack(snackId, amount);
      toast.success(`Restocked ${res.snack.name} (+${amount}).`, "Inventory updated");
      setRestockTarget(null);
      await loadSnacks(false);
    } finally {
      setIsRestocking(false);
    }
  };

  const resetFilters = () => {
    setSearchInput("");
    setDebouncedSearch("");
    setCategory("");
    setStatusFilter("");
    setSortBy("name");
    setSortOrder("asc");
    setPage(1);
  };

  return (
    <main className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Snack Catalog</h1>
          <p className="page-subtitle">
            Browse, search, filter, vote for favorites, or grab a snack from the pantry.
          </p>
        </div>
        <div style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }} className="tabular-nums">
          {total} {total === 1 ? "snack" : "snacks"} found
        </div>
      </div>

      <SnackFilter
        search={searchInput}
        onSearchChange={setSearchInput}
        category={category}
        onCategoryChange={(val) => {
          setCategory(val);
          setPage(1);
        }}
        status={statusFilter}
        onStatusChange={(val) => {
          setStatusFilter(val);
          setPage(1);
        }}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={(field, order) => {
          setSortBy(field);
          setSortOrder(order);
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
        <SnackGridSkeleton count={9} />
      ) : snacks.length === 0 ? (
        <EmptyState
          title="No matching snacks found"
          description="Try adjusting your search query, category filter, or stock status filter."
          action={
            <button type="button" className="btn btn-secondary" onClick={resetFilters}>
              Reset All Filters
            </button>
          }
        />
      ) : (
        <>
          <div className="snack-grid">
            {snacks.map((snack) => (
              <SnackCard
                key={snack.id}
                snack={snack}
                isAdmin={isAdmin}
                onConsume={handleConsume}
                onToggleVote={handleToggleVote}
                onRestock={isAdmin ? setRestockTarget : undefined}
                busySnackId={busySnackId}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <div className="pagination-info tabular-nums">
                Page {page} of {totalPages} ({total} total)
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

      <RestockModal
        snack={restockTarget}
        onClose={() => setRestockTarget(null)}
        onSubmit={handleRestockSubmit}
        isSubmitting={isRestocking}
      />
    </main>
  );
}

