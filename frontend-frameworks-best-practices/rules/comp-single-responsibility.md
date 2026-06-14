---
title: Keep components focused on a single responsibility
impact: CRITICAL
impactDescription: Large multi-purpose components are impossible to test, reuse, or debug — and they grow exponentially over time.
tags: react, vue, components, architecture, single-responsibility
---

## Keep components focused on a single responsibility

**Impact: CRITICAL**

Each component should do one thing well. When a component exceeds ~150 lines or handles multiple concerns — layout, data fetching, business logic, and rendering — it becomes nearly impossible to test in isolation, reuse elsewhere, or debug when something breaks. Splitting early prevents the exponential growth that turns files into 1000-line monsters.

**Incorrect (monolithic component handling everything):**

```tsx
// ❌ One component owns layout, filtering, charting, and table rendering
function Dashboard() {
  const [filter, setFilter] = useState({ dateRange: "7d", status: "all" });
  const [data, setData] = useState<SalesRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/sales?range=${filter.dateRange}&status=${filter.status}`)
      .then((res) => res.json())
      .then((json) => { setData(json); setLoading(false); });
  }, [filter]);

  const chartData = data.map((d) => ({ x: d.date, y: d.revenue }));
  const totalRevenue = data.reduce((sum, d) => sum + d.revenue, 0);

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Sales Dashboard</h1>
        <span>Total: ${totalRevenue.toLocaleString()}</span>
      </header>
      <aside className="dashboard-sidebar">
        <select value={filter.dateRange} onChange={(e) => setFilter({ ...filter, dateRange: e.target.value })}>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
        </select>
        <select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}>
          <option value="all">All</option>
          <option value="completed">Completed</option>
          <option value="pending">Pending</option>
        </select>
      </aside>
      <main>
        {loading ? <Spinner /> : (
          <>
            <div className="chart-container">
              <LineChart data={chartData} xKey="x" yKey="y" height={300} />
            </div>
            <table className="data-table">
              <thead>
                <tr><th>Date</th><th>Customer</th><th>Revenue</th><th>Status</th></tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.id}>
                    <td>{row.date}</td><td>{row.customer}</td>
                    <td>${row.revenue}</td><td>{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </main>
    </div>
  );
}
```

**Correct (split into focused, composable sub-components):**

```tsx
// ✅ Each component has a single job — fetch, filter, chart, or table

function Dashboard() {
  const [filter, setFilter] = useState({ dateRange: "7d", status: "all" });
  const { data, loading } = useSalesData(filter);

  return (
    <DashboardLayout
      header={<DashboardHeader totalRevenue={data?.totalRevenue ?? 0} />}
      sidebar={<DashboardFilters filter={filter} onChange={setFilter} />}
    >
      {loading ? <Spinner /> : (
        <>
          <DashboardChart data={data.records} />
          <DataTable columns={salesColumns} rows={data.records} />
        </>
      )}
    </DashboardLayout>
  );
}

function DashboardFilters({ filter, onChange }: DashboardFiltersProps) {
  return (
    <aside className="dashboard-sidebar">
      <Select label="Date range" value={filter.dateRange}
        options={DATE_RANGE_OPTIONS}
        onChange={(dateRange) => onChange({ ...filter, dateRange })} />
      <Select label="Status" value={filter.status}
        options={STATUS_OPTIONS}
        onChange={(status) => onChange({ ...filter, status })} />
    </aside>
  );
}

function DataTable<T>({ columns, rows }: DataTableProps<T>) {
  return (
    <table className="data-table">
      <thead>
        <tr>{columns.map((col) => <th key={col.key}>{col.label}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>{columns.map((col) => <td key={col.key}>{col.render(row)}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}
```

A good litmus test: if you can't describe what the component does in one sentence without using "and", it's doing too much.
