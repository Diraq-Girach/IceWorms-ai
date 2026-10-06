// API contract — mirrors backend/app/schemas.py. Keep the two in sync.
// All datetimes are ISO-8601 strings in UTC (e.g. "2026-10-06T11:00:00Z").

export type Sentiment = "positive" | "neutral" | "negative";
export type Category = "question" | "task" | "metric" | "date" | "pricing";
export type MeetingSource = "seed" | "upload" | "paste" | "form";
export type Platform = "google_meet" | "zoom" | "teams" | "upload";

export interface User {
  id: number;
  name: string;
  email: string;
  avatar_color: string;
}

export interface Participant {
  id: number;
  name: string;
  email: string | null;
  avatar_color: string;
  is_host: boolean;
}

export interface ParticipantInput {
  name: string;
  email?: string | null;
}

export interface OverviewBullet {
  emoji: string;
  title: string;
  text: string;
}

export interface MeetingListItem {
  id: number;
  title: string;
  date: string;
  duration_sec: number;
  source: MeetingSource;
  platform: Platform;
  host: Participant | null;
  participants: Participant[];
  action_items_total: number;
  action_items_open: number;
  overview_preview: OverviewBullet[]; // Home feed expandable bullets
}

export interface MeetingList {
  items: MeetingListItem[];
  total: number;
}

export interface Summary {
  overview: OverviewBullet[];
  keywords: string[];
  generated_by: "seed" | "heuristic";
}

export interface NoteBullet {
  id: number;
  text: string;
  start_sec: number;
}

export interface NoteSection {
  id: number;
  title: string;
  summary: string;
  start_sec: number;
  bullets: NoteBullet[];
}

export interface ActionItem {
  id: number;
  meeting_id: number;
  meeting_title: string | null; // only set on GET /api/action-items
  text: string;
  details: string[];
  start_sec: number | null;
  is_completed: boolean;
  assignee: Participant | null;
  created_at: string;
}

export interface MeetingDetail {
  id: number;
  title: string;
  date: string;
  duration_sec: number;
  language: string;
  source: MeetingSource;
  platform: Platform;
  host: Participant | null;
  participants: Participant[];
  summary: Summary | null;
  notes: NoteSection[];
  action_items: ActionItem[];
}

export interface Segment {
  id: number;
  seq: number;
  start_sec: number;
  end_sec: number;
  text: string;
  sentiment: Sentiment;
  category: Category | null;
  speaker: Participant | null;
}

export interface SpeakerStat {
  speaker: Participant;
  talk_sec: number;
  talktime_pct: number;
  words: number;
  wpm: number;
}

export interface Analytics {
  speakers: SpeakerStat[];
  sentiments: Record<Sentiment, number>; // percentages
  categories: Record<Category, number>; // counts
}

export interface Stats {
  meetings: number;
  contacts: number;
  open_tasks: number;
  new_tasks_7d: number;
}

// ---------- request bodies ----------
export interface MeetingListParams {
  q?: string;
  scope?: "title" | "all";
  participant_id?: number;
  date_from?: string;
  date_to?: string;
  sort?: "newest" | "oldest" | "longest";
  limit?: number;
  offset?: number;
}

export interface MeetingCreate {
  title: string;
  date?: string;
  participants?: ParticipantInput[];
  transcript_text?: string;
  duration_sec?: number;
  language?: string;
}

export interface MeetingUpdate {
  title?: string;
  date?: string;
  participants?: ParticipantInput[]; // replaces the full list
}

export interface ActionItemCreate {
  text: string;
  assignee_id?: number | null;
  start_sec?: number | null;
  details?: string[];
}

export interface ActionItemUpdate {
  text?: string;
  assignee_id?: number;
  clear_assignee?: boolean;
  is_completed?: boolean;
  details?: string[];
}
