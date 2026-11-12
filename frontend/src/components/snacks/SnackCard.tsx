import { Link } from "react-router-dom";
import { PlusCircle, ShoppingBag, ThumbsUp } from "lucide-react";

import { Snack } from "../../types";
import { SnackImage } from "../common/SnackImage";
import { StatusBadge } from "../common/StatusBadge";

interface SnackCardProps {
  snack: Snack;
  isAdmin: boolean;
  onConsume: (snack: Snack) => void;
  onToggleVote: (snack: Snack) => void;
  onRestock?: (snack: Snack) => void;
  busySnackId: number | null;
}

export function SnackCard({
  snack,
  isAdmin,
  onConsume,
  onToggleVote,
  onRestock,
  busySnackId,
}: SnackCardProps) {
  const isBusy = busySnackId === snack.id;
  const meterScale = Math.max(snack.low_stock_threshold * 3, 15);
  const meterPercent = Math.min(100, Math.round((snack.quantity / meterScale) * 100));

  return (
    <article className="card snack-card">
      <Link to={`/snacks/${snack.id}`} className="snack-card-media" aria-label={`View ${snack.name}`}>
        <SnackImage imageUrl={snack.image_url} alt={snack.name} variant="card" />
        {snack.status === "running_low" && (
          <span className="snack-card-ribbon running_low">Low Stock</span>
        )}
        {snack.status === "gone" && (
          <span className="snack-card-ribbon gone">Out of Stock</span>
        )}
      </Link>

      <div className="snack-card-header">
        <div>
          <Link to={`/snacks/${snack.id}`} className="snack-name-link">
            {snack.name}
          </Link>
          {snack.brand && <div className="snack-brand-text">{snack.brand}</div>}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 7 }}>
            <span className="category-chip">{snack.category}</span>
            {snack.price !== null && snack.price !== undefined && (
              <span className="price-tag tabular-nums">₹{Number(snack.price).toFixed(0)}</span>
            )}
          </div>
        </div>
        <StatusBadge status={snack.status} />
      </div>

      <div className="stock-meter-wrap">
        <div className="stock-meter-row">
          <span>
            <span className="stock-qty tabular-nums">{snack.quantity}</span>{" "}
            <span style={{ color: "var(--text-muted)" }}>
              {snack.quantity === 1 ? "packet left" : "packets left"}
            </span>
          </span>
          <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }} className="tabular-nums">
            Alert ≤ {snack.low_stock_threshold}
          </span>
        </div>
        <div className="progress-track" aria-hidden="true">
          <div
            className={`progress-fill ${snack.status}`}
            style={{ width: `${snack.quantity === 0 ? 0 : Math.max(6, meterPercent)}%` }}
          />
        </div>
      </div>

      <div className="snack-card-footer">
        <button
          type="button"
          className={`vote-btn${snack.has_voted ? " voted" : ""}`}
          onClick={() => onToggleVote(snack)}
          disabled={isBusy}
          aria-pressed={snack.has_voted}
          aria-label={`${snack.has_voted ? "Remove vote for" : "Vote for"} ${snack.name}`}
        >
          <ThumbsUp size={14} />
          <span className="tabular-nums">{snack.vote_count}</span>
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {isAdmin && onRestock && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onRestock(snack)}
              disabled={isBusy}
              title={`Restock ${snack.name}`}
              aria-label={`Restock ${snack.name}`}
            >
              <PlusCircle size={14} />
              <span>Restock</span>
            </button>
          )}

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => onConsume(snack)}
            disabled={snack.quantity === 0 || isBusy}
          >
            <ShoppingBag size={14} />
            <span>{snack.quantity === 0 ? "Empty" : "Grab 1"}</span>
          </button>
        </div>
      </div>
    </article>
  );
}
