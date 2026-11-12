import React from "react";
import { PackageOpen } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}

export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div className="card empty-state">
      <div className="empty-icon">{icon ?? <PackageOpen size={26} />}</div>
      <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>{title}</h3>
      <p style={{ margin: 0, color: "var(--text-secondary)", maxWidth: 420, fontSize: "0.92rem" }}>
        {description}
      </p>
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}

