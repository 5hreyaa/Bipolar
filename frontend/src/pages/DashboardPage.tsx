import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Flame,
  Package,
  PackageX,
  RefreshCw,
  Sparkles,
} from "lucide-react";

import {
  consumeSnack,
  fetchSnacks,
  fetchSnackSummary,
  restockSnack,
  unvoteSnack,
  voteSnack,
} from "../api/snacks";
import { EmptyState } from "../components/common/EmptyState";
import { SnackGridSkeleton, StatsGridSkeleton } from "../components/common/Skeleton";
import { StatCard } from "../components/dashboard/StatCard";
import { RestockModal } from "../components/snacks/RestockModal";
import { SnackCard } from "../components/snacks/SnackCard";
import { SnackFilter } from "../components/snacks/SnackFilter";
import { SnackOfTheWeek } from "../components/snacks/SnackOfTheWeek";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useWebSocket } from "../context/WebSocketContext";
import { Snack, SnackCategory, SnackStatus, SnackSummary } from "../types";

export function DashboardPage() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { subscribe } = useWebSocket();

  const [summary, setSummary] = useState<SnackSummary | null>(null);
  const [popularSnacks, setPopularSnacks] = useState<Snack[]>([]);
  const [recentSnacks, setRecentSnacks] = useState<Snack[]>([]);
  const [catalogSnacks, setCatalogSnacks] = useState<Snack[]>([]);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [catalogTotalPages, setCatalogTotalPages] = useState(1);

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState<SnackCategory | "">("");
  const [statusFilter, setStatusFilter] = useState<SnackStatus | "">("");
  const [sortBy, setSortBy] = useState<"name" | "quantity" | "votes">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [error, setError] = useState("");
  const [busySnackId, setBusySnackId] = useState<number | null>(null);
  const [restockTarget, setRestockTarget] = useState<Snack | null>(null);
  const [isRestocking, setIsRestocking] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadHighlights = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    setError("");
    try {
      const [summaryRes, popularRes, recentRes] = await Promise.all([
        fetchSnackSummary(),
        fetchSnacks({ sort_by: "votes", sort_order: "desc", page: 1, per_page: 3 }),
        fetchSnacks({ sort_by: "created_at", sort_order: "desc", page: 1, per_page: 3 }),
      ]);
      setSummary(summaryRes);
      setPopularSnacks(popularRes.items);
      setRecentSnacks(recentRes.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCatalog = useCallback(
    async (showSpinner = false) => {
      if (showSpinner) setCatalogLoading(true);
      try {
        const res = await fetchSnacks({
          search: debouncedSearch,
          category,
          status: statusFilter,
          sort_by: sortBy,
          sort_order: sortOrder,
          page,
          per_page: 6,
        });
        setCatalogSnacks(res.items);
        setCatalogTotal(res.total);
        setCatalogTotalPages(res.total_pages);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load snacks.");
      } finally {
        setCatalogLoading(false);
      }
    },
    [debouncedSearch, category, statusFilter, sortBy, sortOrder, page]
  );

  useEffect(() => {
    void loadHighlights(true);
  }, [loadHighlights]);

  useEffect(() => {
    void loadCatalog(true);
  }, [loadCatalog]);

  useEffect(() => {
    return subscribe(() => {
      void loadHighlights(false);
      void loadCatalog(false);
    });
  }, [subscribe, loadHighlights, loadCatalog]);

  const handleConsume = async (snack: Snack) => {
    setBusySnackId(snack.id);
    try {
      const res = await consumeSnack(snack.id, 1);
      toast.success(
        `Enjoy your ${snack.name}! (${res.remaining_quantity} remaining)`,
        "Snack grabbed"
      );
      await Promise.all([loadHighlights(false), loadCatalog(false)]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to consume snack.");
      await Promise.all([loadHighlights(false), loadCatalog(false)]);
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
      await Promise.all([loadHighlights(false), loadCatalog(false)]);
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
      toast.success(`Added ${amount} units to ${res.snack.name}.`, "Pantry restocked");
      setRestockTarget(null);
      await Promise.all([loadHighlights(false), loadCatalog(false)]);
    } finally {
      setIsRestocking(false);
    }
  };

  const resetCatalogFilters = () => {
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
          <div className="brand-company" style={{ marginBottom: 4 }}>
            Bipolar Factory · Coimbatore
          </div>
          <h1 className="page-title">Welcome to the Bipolar Factory Pantry!</h1>
          <p className="page-subtitle">
            Live snack inventory, community favourites, and instant pantry checkouts.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {isAdmin && (
            <>
              <Link to="/admin/scanner" className="btn btn-blue">
                <Camera size={16} />
                <span>Smart Scanner</span>
              </Link>
              <Link to="/admin/snacks" className="btn btn-secondary">
                Manage Inventory
              </Link>
            </>
          )}
          <Link to="/snacks" className="btn btn-primary">
            <span>Full Catalog View</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          <span>{error}</span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              void loadHighlights(true);
              void loadCatalog(true);
            }}
          >
            <RefreshCw size={14} />
            <span>Retry</span>
          </button>
        </div>
      )}

      {loading ? (
        <>
          <StatsGridSkeleton />
          <div className="skeleton" style={{ height: 130, borderRadius: 16, marginBottom: 26 }} />
          <SnackGridSkeleton count={3} />
        </>
      ) : (
        <>
          {summary && (
            <div className="stats-grid">
              <StatCard
                label="Total Snack Types"
                value={summary.total_snacks}
                icon={<Package size={22} />}
                iconBg="#e0f2fe"
                iconColor="#0284c7"
                onClick={() => navigate("/snacks")}
              />
              <StatCard
                label="Stocked"
                value={summary.stocked_count}
                icon={<CheckCircle2 size={22} />}
                iconBg="#dcfce7"
                iconColor="#16a34a"
                onClick={() => navigate("/snacks?status=stocked")}
              />
              <StatCard
                label="Running Low"
                value={summary.running_low_count}
                icon={<AlertTriangle size={22} />}
                iconBg="#fef3c7"
                iconColor="#d97706"
                onClick={() => navigate("/snacks?status=running_low")}
              />
              <StatCard
                label="Gone"
                value={summary.gone_count}
                icon={<PackageX size={22} />}
                iconBg="#fee2e2"
                iconColor="#dc2626"
                onClick={() => navigate("/snacks?status=gone")}
              />
            </div>
          )}

          {summary?.snack_of_the_week && (
            <SnackOfTheWeek
              snack={summary.snack_of_the_week}
              onConsume={handleConsume}
              onToggleVote={handleToggleVote}
              busySnackId={busySnackId}
            />
          )}

          {/* Popular Snacks */}
          {popularSnacks.length > 0 && (
            <section style={{ marginBottom: 32 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 14,
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    fontSize: "1.18rem",
                    fontWeight: 700,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Flame size={19} color="#0284c7" />
                  <span>Popular Snacks</span>
                </h2>
                <Link
                  to="/snacks?sort_by=votes&sort_order=desc"
                  style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--brand-sky)" }}
                >
                  See top voted →
                </Link>
              </div>
              <div className="snack-grid">
                {popularSnacks.map((snack) => (
                  <SnackCard
                    key={`popular-${snack.id}`}
                    snack={snack}
                    isAdmin={isAdmin}
                    onConsume={handleConsume}
                    onToggleVote={handleToggleVote}
                    onRestock={isAdmin ? setRestockTarget : undefined}
                    busySnackId={busySnackId}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Recently Added Snacks */}
          {recentSnacks.length > 0 && (
            <section style={{ marginBottom: 34 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 14,
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    fontSize: "1.18rem",
                    fontWeight: 700,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Sparkles size={19} color="#059669" />
                  <span>Recently Added</span>
                </h2>
              </div>
              <div className="snack-grid">
                {recentSnacks.map((snack) => (
                  <SnackCard
                    key={`recent-${snack.id}`}
                    snack={snack}
                    isAdmin={isAdmin}
                    onConsume={handleConsume}
                    onToggleVote={handleToggleVote}
                    onRestock={isAdmin ? setRestockTarget : undefined}
                    busySnackId={busySnackId}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Searchable & Paginated Pantry Browser */}
          <section>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 14,
              }}
            >
              <h2 style={{ margin: 0, fontSize: "1.22rem", fontWeight: 800 }}>
                Browse Pantry Snacks
              </h2>
              <span className="tabular-nums" style={{ fontSize: "0.88rem", color: "var(--text-muted)" }}>
                {catalogTotal} {catalogTotal === 1 ? "item" : "items"}
              </span>
            </div>

            <SnackFilter
              search={searchInput}
              onSearchChange={setSearchInput}
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

            {catalogLoading ? (
              <SnackGridSkeleton count={6} />
            ) : catalogSnacks.length === 0 ? (
              <EmptyState
                title="No matching snacks found"
                description="Try adjusting your search query, category filter, or stock status filter."
                action={
                  <button type="button" className="btn btn-secondary" onClick={resetCatalogFilters}>
                    Reset Filters
                  </button>
                }
              />
            ) : (
              <>
                <div className="snack-grid">
                  {catalogSnacks.map((snack) => (
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

                {catalogTotalPages > 1 && (
                  <div className="pagination">
                    <div className="pagination-info tabular-nums">
                      Page {page} of {catalogTotalPages} ({catalogTotal} total)
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
                        disabled={page >= catalogTotalPages}
                        onClick={() => setPage((p) => Math.min(catalogTotalPages, p + 1))}
                      >
                        <span>Next</span>
                        <ChevronRight size={15} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
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
