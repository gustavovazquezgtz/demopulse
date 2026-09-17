import Link from "next/link";
import { requireSession } from "@/lib/permissions";
import { UNSCOPED } from "@/lib/queries/dashboard";
import { listRecognitions } from "@/lib/queries/ai-feeds";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Award } from "lucide-react";
import { initials } from "@/lib/utils";

export default async function RecognitionPage() {
  await requireSession();
  const scope = UNSCOPED; // every manager sees the full org (CEO parity), per explicit product decision
  const recognitions = await listRecognitions(scope);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Recognition</h1>
        <p className="text-sm text-muted-foreground">Consistent high performers, surfaced automatically and shareable with the team.</p>
      </div>

      {recognitions.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">No recognition yet — it appears once someone strings together strong demos.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {recognitions.map((r) => (
            <Card key={r.id}>
              <CardContent className="flex items-start gap-3 py-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-positive-muted text-positive">
                  <Award className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <Link href={`/people/${r.developerId}`} className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-[10px]">{initials(r.developer.name)}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium text-foreground">{r.developer.name}</span>
                    </Link>
                    <Badge variant={r.source === "AI" ? "info" : "secondary"} className="text-[10px]">
                      {r.source === "AI" ? "AI-generated" : "Manager"}
                    </Badge>
                  </div>
                  <p className="mt-1.5 text-sm font-medium text-foreground">{r.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{r.body}</p>
                  {r.acknowledged && <Badge variant="positive" className="mt-2 text-[10px]">Acknowledged</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
