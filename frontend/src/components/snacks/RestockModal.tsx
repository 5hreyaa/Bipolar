import React, { useEffect, useState } from "react";

import { Snack } from "../../types";
import { Modal } from "../common/Modal";

interface RestockModalProps {
  snack: Snack | null;
  onClose: () => void;
  onSubmit: (snackId: number, amount: number) => Promise<void>;
  isSubmitting?: boolean;
}

export function RestockModal({
  snack,
  onClose,
  onSubmit,
  isSubmitting = false,
}: RestockModalProps) {
  const [amount, setAmount] = useState("10");
  const [error, setError] = useState("");

  useEffect(() => {
    if (snack) {
      setAmount("10");
      setError("");
    }
  }, [snack]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!snack) return;
    const parsed = Number(amount);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10000) {
      setError("Restock amount must be between 1 and 10,000.");
      return;
    }

    setError("");
    try {
      await onSubmit(snack.id, parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to restock snack.");
    }
  };

  return (
    <Modal isOpen={Boolean(snack)} onClose={onClose} title={snack ? `Restock ${snack.name}` : "Restock"}>
      {snack && (
        <form onSubmit={handleSubmit}>
          {error && (
            <div className="alert alert-error" role="alert">
              <span>{error}</span>
            </div>
          )}

          <p style={{ margin: "0 0 16px", color: "var(--text-secondary)", fontSize: "0.92rem" }}>
            Current stock: <strong className="tabular-nums">{snack.quantity}</strong> packets. Select
            how many units to add:
          </p>

          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {[5, 10, 20, 50].map((preset) => (
              <button
                key={preset}
                type="button"
                className={`filter-pill${Number(amount) === preset ? " active-green" : ""}`}
                onClick={() => setAmount(String(preset))}
              >
                +{preset}
              </button>
            ))}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="restock-amount">
              Amount to Add
            </label>
            <input
              id="restock-amount"
              type="number"
              min={1}
              max={10000}
              className="input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? "Restocking..." : `Add ${amount || 0} Units`}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

