import { getPendingMarks, deleteMark } from './offlineQueue';
import { fetchApi } from './api';

export async function syncPendingMarks(): Promise<number> {
  const pendingMarks = await getPendingMarks();
  if (pendingMarks.length === 0) return 0;

  let syncedCount = 0;

  for (const mark of pendingMarks) {
    if (!mark.id) continue;
    try {
      await fetchApi(`/sessions/${mark.sessionId}/records/${mark.studentId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: mark.status,
          method: mark.method,
          confidence: mark.confidence,
        }),
      });
      // Delete from local DB if synced successfully
      await deleteMark(mark.id);
      syncedCount++;
    } catch (err: any) {
      console.error(`Failed to sync mark for student ${mark.studentId}:`, err);
      // Depending on error, we might want to drop it or keep it in queue.
      // Assuming server errors should be kept in queue and retried later.
    }
  }

  return syncedCount;
}
