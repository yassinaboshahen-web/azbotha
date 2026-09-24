import { getDB, getInMemoryStore } from './dbEngine';
import { PlannerMetadataRecord } from '../types';

export const metadataRepository = {
  /**
   * Get planner metadata by key.
   */
  async getMetadata<T = unknown>(key: string): Promise<T | null> {
    const db = await getDB();
    if (db) {
      try {
        const record = await db.get('planner_metadata', key);
        return record ? (record.value as T) : null;
      } catch (err) {
        console.warn('metadataRepository.getMetadata DB error:', err);
      }
    }
    const memRecord = getInMemoryStore('planner_metadata').get(key);
    return memRecord ? (memRecord.value as T) : null;
  },

  /**
   * Set planner metadata value for key.
   */
  async setMetadata(key: string, value: unknown): Promise<void> {
    const now = new Date().toISOString();
    const record: PlannerMetadataRecord = {
      key,
      value,
      updated_at: now,
    };

    const db = await getDB();
    if (db) {
      try {
        await db.put('planner_metadata', record);
      } catch (err) {
        console.warn('metadataRepository.setMetadata DB error:', err);
      }
    } else {
      getInMemoryStore('planner_metadata').set(key, record);
    }
  },
};
