export function StatsGridSkeleton() {
  return (
    <div className="stats-grid" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, idx) => (
        <div key={idx} className="card stat-card">
          <div style={{ flex: 1 }}>
            <div className="skeleton" style={{ height: 12, width: "55%", marginBottom: 10 }} />
            <div className="skeleton" style={{ height: 28, width: "35%" }} />
          </div>
          <div className="skeleton" style={{ width: 44, height: 44, borderRadius: 12 }} />
        </div>
      ))}
    </div>
  );
}

export function SnackGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="snack-grid" aria-hidden="true">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="card snack-card">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div className="skeleton" style={{ height: 18, width: "70%", marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 20, width: "35%", borderRadius: 999 }} />
            </div>
            <div className="skeleton" style={{ height: 24, width: 76, borderRadius: 999 }} />
          </div>
          <div>
            <div className="skeleton" style={{ height: 14, width: "45%", marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 7, width: "100%", borderRadius: 999 }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10 }}>
            <div className="skeleton" style={{ height: 32, width: 72 }} />
            <div className="skeleton" style={{ height: 32, width: 105 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="card table-wrap" aria-hidden="true">
      <table className="data-table">
        <thead>
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i}>
                <div className="skeleton" style={{ height: 12, width: 70 }} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }).map((__, c) => (
                <td key={c}>
                  <div className="skeleton" style={{ height: 16, width: c === 0 ? "80%" : "60%" }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

