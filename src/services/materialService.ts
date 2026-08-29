import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { db, storage, ensureAuth } from '../lib/firebase';
import { LearningMaterial } from '../types';

/**
 * Extract readable text from files if possible (e.g. TXT or basic text extract)
 */
export async function extractTextFromFile(file: File): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';

  if (extension === 'txt') {
    try {
      const text = await file.text();
      return text.slice(0, 5000);
    } catch (e) {
      console.warn('TXT extract error:', e);
      return '';
    }
  }

  // For other text-based or basic files, read partial text buffer safely
  if (['json', 'csv', 'md'].includes(extension)) {
    try {
      const text = await file.text();
      return text.slice(0, 5000);
    } catch {
      return '';
    }
  }

  return '';
}

/**
 * Upload file to Firebase Storage with progress tracking
 */
export async function uploadMaterialFile(
  file: File,
  teacherId: string,
  materialId: string,
  onProgress?: (percent: number) => void
): Promise<{ fileUrl: string; storagePath: string }> {
  await ensureAuth();

  const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `learningMaterials/${teacherId}/${materialId}/${cleanFileName}`;
  const fileRef = storageRef(storage, path);

  return new Promise((resolve, reject) => {
    const uploadTask = uploadBytesResumable(fileRef, file);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress =
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        if (onProgress) {
          onProgress(Math.round(progress));
        }
      },
      (error) => {
        console.error('Firebase Storage upload error:', error);
        reject(error);
      },
      async () => {
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          resolve({
            fileUrl: downloadUrl,
            storagePath: path,
          });
        } catch (urlError) {
          reject(urlError);
        }
      }
    );
  });
}

/**
 * Delete a file from Firebase Storage
 */
export async function deleteMaterialFile(storagePath: string): Promise<void> {
  try {
    const fileRef = storageRef(storage, storagePath);
    await deleteObject(fileRef);
  } catch (err) {
    console.warn('Storage file deletion error (ignored):', err);
  }
}

/**
 * Fetch all learning materials for a specific room or teacher
 */
export async function getLearningMaterials(
  roomCode: string
): Promise<LearningMaterial[]> {
  await ensureAuth();
  const col = collection(db, 'learningMaterials');
  const q = query(col, where('roomCode', '==', roomCode));
  const snap = await getDocs(q);

  const list: LearningMaterial[] = [];
  snap.forEach((d) => {
    list.push({
      id: d.id,
      ...(d.data() as Omit<LearningMaterial, 'id'>),
    });
  });

  // Sort by createdAt descending
  list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return list;
}

/**
 * Create a new learning material document in Firestore
 */
export async function createLearningMaterial(
  material: Omit<LearningMaterial, 'id'>
): Promise<string> {
  await ensureAuth();
  const col = collection(db, 'learningMaterials');
  const docRef = await addDoc(col, material);
  return docRef.id;
}

/**
 * Update an existing learning material document in Firestore
 */
export async function updateLearningMaterial(
  id: string,
  data: Partial<LearningMaterial>
): Promise<void> {
  await ensureAuth();
  const docRef = doc(db, 'learningMaterials', id);
  await updateDoc(docRef, {
    ...data,
    updatedAt: Date.now(),
  });
}

/**
 * Delete a learning material document from Firestore & Storage
 */
export async function removeLearningMaterial(
  id: string,
  storagePath?: string
): Promise<void> {
  await ensureAuth();
  if (storagePath) {
    await deleteMaterialFile(storagePath);
  }
  const docRef = doc(db, 'learningMaterials', id);
  await deleteDoc(docRef);
}
