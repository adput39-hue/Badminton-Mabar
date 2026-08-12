"use client";

import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, onSnapshot, collection, Unsubscribe, Timestamp } from "firebase/firestore";

const FIREBASE_CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
};

let app: FirebaseApp | null = null;

function getApp() {
  if (!app && FIREBASE_CONFIG.apiKey && !getApps().length) {
    app = initializeApp(FIREBASE_CONFIG);
  }
  return app;
}

export function isFirebaseConfigured() {
  return !!FIREBASE_CONFIG.apiKey && !!FIREBASE_CONFIG.projectId;
}

export function writeLiveScore(matchId: string, data: {
  courtNumber?: number | null;
  scoreTeam1?: number | null;
  scoreTeam2?: number | null;
  scoreTeam1Game2?: number | null;
  scoreTeam2Game2?: number | null;
  scoreTeam1Game3?: number | null;
  scoreTeam2Game3?: number | null;
  status?: string | null;
  winnerTeam?: number | null;
}) {
  if (!isFirebaseConfigured()) return;
  const a = getApp();
  if (!a) return;
  const db = getFirestore(a);
  const docRef = doc(db, "live", matchId);
  setDoc(docRef, { ...data, updatedAt: Timestamp.now() }, { merge: true });
}

export async function readLiveScore(matchId: string): Promise<Record<string, unknown> | null> {
  if (!isFirebaseConfigured()) return null;
  const a = getApp();
  if (!a) return null;
  const db = getFirestore(a);
  const snap = await getDoc(doc(db, "live", matchId));
  return snap.exists() ? snap.data() : null;
}

export function listenAllLiveScores(callback: (scores: Record<string, Record<string, unknown>>) => void, onError?: (error: Error) => void): Unsubscribe | null {
  if (!isFirebaseConfigured()) return null;
  const a = getApp();
  if (!a) return null;
  const db = getFirestore(a);
  const colRef = collection(db, "live");
  return onSnapshot(colRef,
    (snapshot) => {
      const scores: Record<string, Record<string, unknown>> = {};
      snapshot.forEach((doc) => {
        scores[doc.id] = doc.data();
      });
      callback(scores);
    },
    (error) => {
      console.error("Firebase live listener error:", error);
      if (onError) onError(error);
    },
  );
}

export interface ClientBotState {
  state?: string;
  qr?: string;
  at?: string;
}

function parseBotState(data: Record<string, unknown> | undefined): ClientBotState | null {
  if (!data) return null;
  if (typeof data.raw === "string") {
    try {
      const parsed = JSON.parse(data.raw);
      if (parsed && typeof parsed.state === "string") return parsed;
    } catch {}
  }
  return null;
}

export async function readBotState(): Promise<ClientBotState | null> {
  if (!isFirebaseConfigured()) return null;
  const a = getApp();
  if (!a) return null;
  const db = getFirestore(a);
  const snap = await getDoc(doc(db, "wa", "state"));
  return snap.exists() ? parseBotState(snap.data()) : null;
}

export function listenBotState(callback: (state: ClientBotState | null) => void, onError?: (error: Error) => void): Unsubscribe | null {
  if (!isFirebaseConfigured()) return null;
  const a = getApp();
  if (!a) return null;
  const db = getFirestore(a);
  const docRef = doc(db, "wa", "state");
  return onSnapshot(docRef,
    (snap) => callback(snap.exists() ? parseBotState(snap.data()) : null),
    (error) => {
      console.error("Firebase bot-state listener error:", error);
      if (onError) onError(error);
    },
  );
}
