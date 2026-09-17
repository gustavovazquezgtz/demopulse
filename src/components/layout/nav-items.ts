import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Video,
  CalendarDays,
  Users,
  UsersRound,
  ClipboardCheck,
  Trophy,
  BarChart3,
  Scale,
  Sparkles,
  Bell,
  Award,
  FileBarChart,
  Settings,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  ceoOnly?: boolean;
  managerOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/demos", label: "Demos", icon: Video },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/people", label: "People", icon: Users },
  { href: "/teams", label: "Teams / Projects", icon: UsersRound },
  { href: "/evaluations", label: "Evaluations", icon: ClipboardCheck, managerOnly: true },
  { href: "/ranking", label: "Engineer Ranking", icon: Trophy },
  { href: "/team-comparison", label: "Team Comparison", icon: BarChart3 },
  { href: "/manager-comparison", label: "Manager Comparison", icon: Scale },
  { href: "/insights", label: "Insights", icon: Sparkles },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/recognition", label: "Recognition", icon: Award },
  { href: "/reports", label: "Reports", icon: FileBarChart },
  { href: "/settings", label: "Settings", icon: Settings },
];
