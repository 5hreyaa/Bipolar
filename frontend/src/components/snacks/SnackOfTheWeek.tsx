import { Link } from "react-router-dom";
import { Award, ThumbsUp, ShoppingBag, ArrowRight } from "lucide-react";

import { Snack } from "../../types";
import { SnackImage } from "../common/SnackImage";
import { StatusBadge } from "../common/StatusBadge";

interface SnackOfTheWeekProps {
  snack: Snack | null;
  onConsume: (snack: Snack) => void;
  onToggleVote: (snack: Snack) => void;
  busySnackId: number | null;
}

export function SnackOfTheWeek({
  snack,
  onConsume,
  onToggleVote,
  busySnackId,
}: SnackOfTheWeekProps) {
  if (!snack) {
    return null;
  }

  const isBusy = busySnackId === snack.id;

  return (
    <section className="sotw-card" aria-label="Snack of the Week">
      <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
        <Link to={`/snacks/${snack.id}`} aria-label={`View ${snack.name}`}>
          <SnackImage imageUrl={snack.image_url} alt={snack.name} variant="sotw" />
        </Link>

        <div>
          <span className="sotw-badge">
            <Award size={14} />
            Snack of the Week
          </span>
          <h2 className="sotw-title">
            <Link to={`/snacks/${snack.id}`} style={{ textDecoration: "none" }}>
              {snack.name}
            </Link>
          </h2>
          <div className="sotw-meta">
            {snack.brand && <strong style={{ color: "var(--text-primary)" }}>{snack.brand}</strong>}
            <span className="category-chip">{snack.category}</span>
            <StatusBadge status={snack.status} />
            <span className="tabular-nums">
              <strong>{snack.quantity}</strong> left in pantry
            </span>
            <span className="tabular-nums">
              <strong>{snack.vote_count}</strong> {snack.vote_count === 1 ? "vote" : "votes"}
            </span>
          </div>
        </div>
      </div>

      <div className="sotw-actions">
        <button
          type="button"
          className={`vote-btn${snack.has_voted ? " voted" : ""}`}
          onClick={() => onToggleVote(snack)}
          disabled={isBusy}
          aria-pressed={snack.has_voted}
        >
          <ThumbsUp size={15} />
          <span>{snack.has_voted ? "Voted" : "Vote"}</span>
          <span className="tabular-nums">({snack.vote_count})</span>
        </button>

        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => onConsume(snack)}
          disabled={snack.quantity === 0 || isBusy}
        >
          <ShoppingBag size={15} />
          <span>{snack.quantity === 0 ? "Out of stock" : "Grab 1"}</span>
        </button>

        <Link to={`/snacks/${snack.id}`} className="btn btn-secondary btn-sm">
          <span>Details</span>
          <ArrowRight size={14} />
        </Link>
      </div>
    </section>
  );
}
