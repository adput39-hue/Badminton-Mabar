"use client";

import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getFirestore, doc, setDoc, onSnapshot, collection, Unsubscribe, Timestamp } from "firebase/firestore";

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

export function listenAllLiveScores(callback: (scores: Record<string, Record<string, unknown>>) => void): Unsubscribe | null {
  if (!isFirebaseConfigured()) return null;
  const a = getApp();
  if (!a) return null;
  const db = getFirestore(a);
  const colRef = collection(db, "live");
  return onSnapshot(colRef, (snapshot) => {
    const scores: Record<string, Record<string, unknown>> = {};
    snapshot.forEach((doc) => {
      scores[doc.id] = doc.data();
    });
    callback(scores);
  });
}
