import {
  Activity,
  BarChart3,
  Home,
  Layers,
  type LucideIcon,
  Settings,
  Sparkles,
  Upload,
  Users,
  Video,
} from "lucide-react";

export const APP_NAME = "IceWorms.ai";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
}

/** Sidebar navigation, grouped like the Fireflies sidebar. */
export const NAV_GROUPS: NavItem[][] = [
  [
    { href: "/", label: "Home", icon: Home },
    { href: "/meetings", label: "Meetings", icon: Video },
    { href: "/meeting-status", label: "Meeting Status", icon: Activity },
    { href: "/uploads", label: "Uploads", icon: Upload },
  ],
  [
    { href: "/integrations", label: "Integrations", icon: Layers, badge: "NEW" },
    { href: "/analytics", label: "Analytics", icon: BarChart3 },
    { href: "/ai-skills", label: "AI Skills", icon: Sparkles },
  ],
  [
    { href: "/team", label: "Team", icon: Users },
    { href: "/settings", label: "Settings", icon: Settings },
  ],
];

/** Sections that render a "Coming soon" page (see app/[section]/page.tsx). */
export const COMING_SOON: Record<string, { title: string; description: string }> = {
  integrations: {
    title: "Integrations",
    description: "Connect Zoom, Google Meet, Microsoft Teams, your calendar and your CRM.",
  },
  analytics: {
    title: "Analytics",
    description: "Track talk time, topics and meeting trends across your whole team.",
  },
  "ai-skills": {
    title: "AI Skills",
    description: "Run custom AI prompts on every meeting: sales scorecards, interview feedback and more.",
  },
  team: {
    title: "Team",
    description: "Invite teammates, share meetings and collaborate on notes.",
  },
};

export const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];

export const CATEGORY_LABELS: Record<string, string> = {
  date: "Date & Time",
  metric: "Metrics",
  question: "Questions",
  task: "Tasks",
  pricing: "Pricing",
};

export const CATEGORY_COLORS: Record<string, string> = {
  date: "#14b8a6",
  metric: "#06b6d4",
  question: "#ec4899",
  task: "#f97316",
  pricing: "#6366f1",
};

export const SENTIMENT_COLORS: Record<string, string> = {
  neutral: "#ec4899",
  positive: "#22d3ee",
  negative: "#f97316",
};
