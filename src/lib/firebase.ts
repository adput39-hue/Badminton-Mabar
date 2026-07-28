"use client";

import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getDatabase, ref, set, onValue, off, DatabaseReference, Unsubscribe } from "firebase/database";
import type { ApiMatch } from "./api-types";

const FIREBASE_CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || "",
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
  return !!FIREBASE_CONFIG.apiKey && !!FIREBASE_CONFIG.databaseURL;
}

export function writeLiveScore(matchId: string, data: {
  scoreTeam1?: number | null;
  scoreTeam2?: number | null;
  scoreTeam1Game2?: number | null;
  scoreTeam2Game2?: number | null;
  status?: string | null;
  winnerTeam?: number | null;
}) {
  if (!isFirebaseConfigured()) return;
  const a = getApp();
  if (!a) return;
  const db = getDatabase(a);
  const dbRef = ref(db, `live/${matchId}`);
  set(dbRef, data);
}

export function listenLiveScore(matchId: string, callback: (data: Record<string, unknown> | null) => void): Unsubscribe | null {
  if (!isFirebaseConfigured()) return null;
  const a = getApp();
  if (!a) return null;
  const db = getDatabase(a);
  const dbRef = ref(db, `live/${matchId}`);
  onValue(dbRef, (snapshot) => {
    callback(snapshot.val());
  });
  return () => off(dbRef);
}

export function listenAllLiveScores(callback: (scores: Record<string, Record<string, unknown>>) => void): Unsubscribe | null {
  if (!isFirebaseConfigured()) return null;
  const a = getApp();
  if (!a) return null;
  const db = getDatabase(a);
  const dbRef = ref(db, "live");
  onValue(dbRef, (snapshot) => {
    const val = snapshot.val();
    callback(val || {});
  });
  return () => off(dbRef);
}
