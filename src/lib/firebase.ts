import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInAnonymously, User } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Use specified databaseId or default
export const db: Firestore = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Firebase Storage
export const storage: FirebaseStorage = getStorage(app);

let authUserPromise: Promise<User | null> | null = null;

export async function ensureAuth(): Promise<User | null> {
  if (auth.currentUser) {
    return auth.currentUser;
  }
  if (!authUserPromise) {
    authUserPromise = signInAnonymously(auth)
      .then((cred) => cred.user)
      .catch((err) => {
        // Anonymous authentication might be disabled in Firebase Console (auth/admin-restricted-operation or auth/operation-not-allowed).
        // Since room-based security & Firestore operate smoothly without requiring anonymous tokens,
        // we gracefully allow unauthenticated access without breaking the app.
        if (
          err?.code === 'auth/admin-restricted-operation' ||
          err?.code === 'auth/operation-not-allowed' ||
          err?.message?.includes('admin-restricted-operation')
        ) {
          console.info('Firebase Anonymous Auth is restricted; continuing in unauthenticated mode.');
        } else {
          console.warn('Firebase Auth notice:', err?.message || err);
        }
        return null;
      });
  }
  return authUserPromise;
}

// Auto initialize auth on import
ensureAuth();
