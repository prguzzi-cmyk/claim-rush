interface DashboardGridProps {
  children: React.ReactNode;
}

export function DashboardGrid({ children }: DashboardGridProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2">{children}</div>
  );
}
