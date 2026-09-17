"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { Search, Bell, LogOut } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initials } from "@/lib/utils";

export interface TopbarNotification {
  id: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
}

export function Topbar({
  user,
  notifications,
}: {
  user: { name: string; email: string; role: string };
  notifications: TopbarNotification[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const unread = notifications.filter((n) => !n.read).length;

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
  }

  return (
    <header className="flex h-14 items-center gap-4 border-b border-border bg-surface px-4">
      <form onSubmit={submitSearch} className="flex-1 max-w-md">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search people, teams, projects, demos..."
            className="pl-8 h-8"
          />
        </div>
      </form>

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="relative rounded-md p-2 text-muted-foreground hover:bg-surface-muted hover:text-foreground transition-colors">
              <Bell className="h-4 w-4" />
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-critical text-[10px] font-semibold text-white">
                  {unread}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifications.length === 0 && (
              <div className="px-2 py-4 text-center text-xs text-muted-foreground">No notifications</div>
            )}
            {notifications.slice(0, 6).map((n) => (
              <DropdownMenuItem key={n.id} asChild>
                <Link href={n.link ?? "#"} className="flex flex-col items-start gap-0.5 whitespace-normal">
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                    {n.title}
                  </span>
                  <span className="text-xs text-muted-foreground">{n.body}</span>
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface-muted transition-colors">
              <Avatar className="h-7 w-7">
                <AvatarFallback>{initials(user.name)}</AvatarFallback>
              </Avatar>
              <div className="hidden text-left sm:block">
                <div className="text-xs font-medium leading-tight text-foreground">{user.name}</div>
                <Badge variant="secondary" className="mt-0.5 py-0 text-[10px]">
                  {user.role}
                </Badge>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
