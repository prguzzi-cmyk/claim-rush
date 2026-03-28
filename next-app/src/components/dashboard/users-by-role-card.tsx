import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { UsersByRole } from "@/types/dashboard";

interface UsersByRoleCardProps {
  data: UsersByRole[];
}

export function UsersByRoleCard({ data }: UsersByRoleCardProps) {
  const filteredData = data.filter((d) => d.display_name && d.users_count);

  if (filteredData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Users by Role</CardTitle>
        </CardHeader>
        <CardContent className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
          No data available
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Users by Role</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3">
          {filteredData.map((item) => (
            <div
              key={item.name}
              className="flex items-center gap-2 rounded-lg border bg-card p-3"
            >
              <span className="text-sm font-medium">{item.display_name}</span>
              <Badge variant="secondary">{item.users_count}</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
