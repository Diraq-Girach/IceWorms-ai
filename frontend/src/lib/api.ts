// Typed API client. One function per endpoint; components never call fetch directly.
import type {
  ActionItem,
  ActionItemCreate,
  ActionItemUpdate,
  Analytics,
  MeetingCreate,
  MeetingDetail,
  MeetingList,
  MeetingListParams,
  MeetingUpdate,
  Participant,
  Segment,
  Stats,
  User,
} from "./types";

const BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isForm = init?.body instanceof FormData;
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: isForm ? init?.headers : { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const body = await res.json();
      // FastAPI: {"detail": "msg"} or {"detail": [{msg, loc}, ...]} for validation errors
      msg = typeof body.detail === "string" ? body.detail : body.detail?.[0]?.msg ?? msg;
    } catch {}
    throw new ApiError(res.status, msg);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

function qs(params: object): string {
  const s = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") s.set(k, String(v));
  });
  const str = s.toString();
  return str ? `?${str}` : "";
}

const json = (body: unknown) => JSON.stringify(body);

export const api = {
  // misc
  me: () => request<User>("/api/me"),
  stats: () => request<Stats>("/api/stats"),
  participants: () => request<Participant[]>("/api/participants"),

  // meetings
  listMeetings: (p: MeetingListParams = {}) => request<MeetingList>(`/api/meetings${qs(p)}`),
  getMeeting: (id: number) => request<MeetingDetail>(`/api/meetings/${id}`),
  getTranscript: (id: number) => request<Segment[]>(`/api/meetings/${id}/transcript`),
  getAnalytics: (id: number) => request<Analytics>(`/api/meetings/${id}/analytics`),
  createMeeting: (body: MeetingCreate) =>
    request<MeetingDetail>("/api/meetings", { method: "POST", body: json(body) }),
  uploadTranscript: (file: File, extra: { title?: string; date?: string; language?: string } = {}) => {
    const fd = new FormData();
    fd.append("file", file);
    Object.entries(extra).forEach(([k, v]) => v && fd.append(k, v));
    return request<MeetingDetail>("/api/meetings/upload", { method: "POST", body: fd });
  },
  updateMeeting: (id: number, body: MeetingUpdate) =>
    request<MeetingDetail>(`/api/meetings/${id}`, { method: "PATCH", body: json(body) }),
  deleteMeeting: (id: number) => request<void>(`/api/meetings/${id}`, { method: "DELETE" }),

  // action items
  listActionItems: (p: { completed?: boolean; assignee_id?: number } = {}) =>
    request<ActionItem[]>(`/api/action-items${qs(p)}`),
  createActionItem: (meetingId: number, body: ActionItemCreate) =>
    request<ActionItem>(`/api/meetings/${meetingId}/action-items`, { method: "POST", body: json(body) }),
  updateActionItem: (id: number, body: ActionItemUpdate) =>
    request<ActionItem>(`/api/action-items/${id}`, { method: "PATCH", body: json(body) }),
  deleteActionItem: (id: number) => request<void>(`/api/action-items/${id}`, { method: "DELETE" }),
};
