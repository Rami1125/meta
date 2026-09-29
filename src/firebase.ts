import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  databaseURL: "https://saban-ai-drive-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "saban-ai-drive"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getDatabase(app);
export default app;
