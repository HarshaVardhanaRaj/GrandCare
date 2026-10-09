import { useEffect, useState } from "react";

export type Slot = "morning" | "evening" | "night";
export type Meal = "before" | "after";

export type Prescription = {
  id: string;
  name: string;
  dosage: string;
  slot?: Slot;
  meal?: Meal;
  source: "image" | "manual" | "number";
  reference?: string;
  imageName?: string;
  calendarEventId?: string;
  /** Length of the course in days, counting the day it was added. Unset = lifetime. */
  courseDays?: number;
  createdAt: number;
};

export type Lifestyle = { breakfast: string; lunch: string; dinner: string };

const KEY = "prescriptions";
const LIFE = "lifestyle";
const USER = "user";

export function readPrescriptions(): Prescription[] {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function usePrescriptions() {
  const [items, setItems] = useState<Prescription[]>([]);
  useEffect(() => setItems(readPrescriptions()), []);
  const save = (next: Prescription[]) => {
    sessionStorage.setItem(KEY, JSON.stringify(next));
    setItems(next);
  };
  return {
    items,
    add: (p: Omit<Prescription, "id" | "createdAt">) =>
      save([{ ...p, id: crypto.randomUUID(), createdAt: Date.now() }, ...readPrescriptions()]),
    remove: (id: string) => save(readPrescriptions().filter((p) => p.id !== id)),
    update: (id: string, patch: Partial<Prescription>) =>
      save(readPrescriptions().map((p) => (p.id === id ? { ...p, ...patch } : p))),
  };
}

export function readLifestyle(): Lifestyle | null {
  try {
    return JSON.parse(sessionStorage.getItem(LIFE) || "null");
  } catch {
    return null;
  }
}
export const saveLifestyle = (l: Lifestyle) => sessionStorage.setItem(LIFE, JSON.stringify(l));
export type User = { email: string; autoCalendar?: boolean };
export function readUser(): User | null {
  try {
    return JSON.parse(sessionStorage.getItem(USER) || "null");
  } catch {
    return null;
  }
}
export const saveUser = (email: string, autoCalendar = false) =>
  sessionStorage.setItem(USER, JSON.stringify({ email, autoCalendar }));
export const setAutoCalendar = (on: boolean) => {
  const u = readUser();
  if (u) saveUser(u.email, on);
};

/** Storage-level update, for code outside a component (e.g. calendar sync). */
export const patchPrescription = (id: string, patch: Partial<Prescription>) =>
  sessionStorage.setItem(
    KEY,
    JSON.stringify(readPrescriptions().map((p) => (p.id === id ? { ...p, ...patch } : p))),
  );

const slotMeal: Record<Slot, keyof Lifestyle> = {
  morning: "breakfast",
  evening: "lunch",
  night: "dinner",
};

/** Meal time minus 10 min if before food, plus 10 min if after food. */
export function alarmTime(p: Prescription, l: Lifestyle | null): string | null {
  if (!p.slot || !p.meal || !l) return null;
  const base = l[slotMeal[p.slot]];
  if (!base) return null;
  const [h = 0, m = 0] = base.split(":").map(Number);
  const total = (h * 60 + m + (p.meal === "before" ? -10 : 10) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

const DAY = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Last moment of the course's final day (local time), or null for lifetime. */
export function courseEnd(p: Prescription): Date | null {
  if (!p.courseDays) return null;
  const end = startOfDay(new Date(p.createdAt));
  end.setDate(end.getDate() + p.courseDays);
  return new Date(end.getTime() - 1);
}

/** Lifetime prescriptions are always active; courses until the end of their last day. */
export const isActive = (p: Prescription, now = new Date()) => {
  const end = courseEnd(p);
  return !end || now <= end;
};

/** Days left including today (1 = last day), or null for lifetime. */
export function daysLeft(p: Prescription, now = new Date()): number | null {
  const end = courseEnd(p);
  if (!end) return null;
  return Math.max(0, Math.round((startOfDay(end).getTime() - startOfDay(now).getTime()) / DAY) + 1);
}
