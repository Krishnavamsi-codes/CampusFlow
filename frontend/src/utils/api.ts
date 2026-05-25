export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export interface OngoingClassInfo {
  course: string;
  section: number;
  batch: string;
  endTime: string;
  isMovedIn: boolean;
}

export interface NextClassInfo {
  course: string;
  section: number;
  batch: string;
  startTime: string;
  isMovedIn: boolean;
}

export interface TimelineSlot {
  startTime: string;
  endTime: string;
  status: "FREE" | "OCCUPIED";
  label: string;
  isMovedIn: boolean;
  isCancelled: boolean;
  batch?: string;
  section?: number;
}

export interface RoomStatus {
  roomId: string;
  roomName: string;
  category: string;
  status: "FREE" | "OCCUPIED";
  ongoingClass: OngoingClassInfo | null;
  nextClass: NextClassInfo | null;
  freeUntil: string | null;
  freeDurationMinutes: number | null;
  timeline: TimelineSlot[];
}

export interface RawSchedule {
  id: string;
  batch: string;
  course: string;
  section: number;
  roomName: string;
  day: string;
  startTime: string;
  endTime: string;
  overrides: {
    id: string;
    type: string;
    date: string;
    targetRoomId: string | null;
  }[];
}

export interface MovedInSchedule {
  id: string;
  type: string;
  date: string;
  scheduleId: string;
  originalRoomId: string;
  targetRoomId: string;
  schedule: {
    id: string;
    batch: string;
    course: string;
    section: number;
    startTime: string;
    endTime: string;
  };
}

export interface RoomDetails extends RoomStatus {
  rawSchedules: RawSchedule[];
  movedInSchedules: MovedInSchedule[];
}

export interface GroupedRooms {
  G_ROOMS: RoomStatus[];
  B_ROOMS: RoomStatus[];
  FIRST_FLOOR: RoomStatus[];
}

export interface CRUser {
  id: string;
  username: string;
  name: string;
  batch: string;
  section: number;
}

export interface LoginResponse {
  token: string;
  user: CRUser;
}

// Client helper for token
export function getAuthToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem("cr_jwt_token");
  }
  return null;
}

export function saveAuthToken(token: string, user: CRUser) {
  if (typeof window !== "undefined") {
    localStorage.setItem("cr_jwt_token", token);
    localStorage.setItem("cr_user_meta", JSON.stringify(user));
  }
}

export function clearAuthToken() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("cr_jwt_token");
    localStorage.removeItem("cr_user_meta");
  }
}

export function getCRUserMeta(): CRUser | null {
  if (typeof window !== "undefined") {
    const meta = localStorage.getItem("cr_user_meta");
    return meta ? JSON.parse(meta) : null;
  }
  return null;
}

// Global fetcher with auth header auto-injection
async function apiRequest<T>(
  endpoint: string,
  method = "GET",
  body?: unknown
): Promise<T> {
  const token = getAuthToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "An API error occurred");
  }

  return data as T;
}

export const api = {
  getRooms: (date?: string, time?: string) => {
    let query = "";
    if (date || time) {
      const params = new URLSearchParams();
      if (date) params.append("date", date);
      if (time) params.append("time", time);
      query = `?${params.toString()}`;
    }
    return apiRequest<{ targetDate: string; targetTime: string; groupedRooms: GroupedRooms }>(
      `/rooms${query}`
    );
  },

  getRoomDetails: (id: string, date?: string, time?: string) => {
    let query = "";
    if (date || time) {
      const params = new URLSearchParams();
      if (date) params.append("date", date);
      if (time) params.append("time", time);
      query = `?${params.toString()}`;
    }
    return apiRequest<RoomDetails>(`/rooms/${id}${query}`);
  },

  getFreeRooms: (date?: string, time?: string) => {
    let query = "";
    if (date || time) {
      const params = new URLSearchParams();
      if (date) params.append("date", date);
      if (time) params.append("time", time);
      query = `?${params.toString()}`;
    }
    return apiRequest<{ targetDate: string; targetTime: string; freeRooms: RoomStatus[] }>(
      `/availability${query}`
    );
  },

  login: (username: string, password: string) => {
    return apiRequest<LoginResponse>("/auth/login", "POST", { username, password });
  },

  cancelClass: (scheduleId: string, date: string) => {
    return apiRequest<{ message: string; override: unknown }>("/override/cancel", "POST", {
      scheduleId,
      date,
    });
  },

  moveClass: (scheduleId: string, date: string, targetRoomId: string) => {
    return apiRequest<{ message: string; override: unknown }>("/override/move", "POST", {
      scheduleId,
      date,
      targetRoomId,
    });
  },

  getCRSchedules: () => {
    return apiRequest<{ schedules: RawSchedule[] }>("/cr/schedules");
  },

  deleteOverride: (overrideId: string) => {
    return apiRequest<{ message: string }>(`/override/${overrideId}`, "DELETE");
  },
};
