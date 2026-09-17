import { ExternalLink, Code2, PenTool, FileText, Globe, Rocket } from "lucide-react";

const TYPE_ICON: Record<string, typeof Globe> = {
  PRODUCTION: Rocket,
  STAGING: Globe,
  GITHUB: Code2,
  DOCUMENTATION: FileText,
  FIGMA: PenTool,
  DEMO_ENV: Globe,
  OTHER: ExternalLink,
};

export function UrlCards({ urls }: { urls: { id: string; type: string; label: string; url: string }[] }) {
  if (urls.length === 0) return <p className="text-sm text-muted-foreground">No links added yet.</p>;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {urls.map((u) => {
        const Icon = TYPE_ICON[u.type] ?? ExternalLink;
        return (
          <a
            key={u.id}
            href={u.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm transition-colors hover:bg-surface-muted"
          >
            <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate text-foreground">{u.label}</span>
            <ExternalLink className="ml-auto h-3 w-3 shrink-0 text-muted-foreground" />
          </a>
        );
      })}
    </div>
  );
}
