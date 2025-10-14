import { defineStore } from "pinia";
import type { BackendAudioResponse } from "~/utils";

interface AudioData {
  messageId: string;
  audioData: BackendAudioResponse;
  timestamp: number;
  contentKey?: string; // Add content key for better matching
}

export const useAudioStore = defineStore("audio", () => {
  // In-memory cache for small audio files
  const audioCache = ref<Map<string, BackendAudioResponse>>(new Map());

  // Track recent bot messages (LRU cache for 10 messages)
  const recentBotMessages = ref<Set<string>>(new Set());
  const maxRecentMessages = 10;
  const MAX_MEMORY_CACHE_ENTRIES = 20;

  // Add message to recent list (LRU)
  const addToRecentMessages = (messageId: string) => {
    if (recentBotMessages.value.has(messageId)) {
      // Move to end (most recent)
      recentBotMessages.value.delete(messageId);
    }
    recentBotMessages.value.add(messageId);

    // Remove oldest if we exceed limit
    if (recentBotMessages.value.size > maxRecentMessages) {
      const firstMessageId = recentBotMessages.value.values().next().value;
      if (firstMessageId) {
        recentBotMessages.value.delete(firstMessageId);
      }
    }
  };

  // Check if message is in recent list
  const isRecentMessage = (messageId: string): boolean => {
    return recentBotMessages.value.has(messageId);
  };

  // IndexedDB configuration
  const dbName = "LanguageBuddyAudioDB";
  const storeName = "audioData";
  const dbVersion = 2;

  // Initialize IndexedDB
  const initIndexedDB = async (): Promise<IDBDatabase | null> => {
    if (!window.indexedDB) {
      return null;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, dbVersion);

      request.onerror = () => {
        reject(request.error);
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        let store: IDBObjectStore;
        if (!db.objectStoreNames.contains(storeName)) {
          store = db.createObjectStore(storeName, {
            keyPath: "messageId",
          });
        } else {
          store = (request.transaction as IDBTransaction).objectStore(
            storeName
          );
        }

        // Ensure required indices exist (idempotent guards)
        if (!store.indexNames.contains("timestamp")) {
          store.createIndex("timestamp", "timestamp", { unique: false });
        }
        if (!store.indexNames.contains("contentKey_timestamp")) {
          store.createIndex(
            "contentKey_timestamp",
            ["contentKey", "timestamp"],
            {
              unique: false,
            }
          );
        }
        // Remove obsolete single-field index if it exists
        if (store.indexNames.contains("contentKey")) {
          try {
            store.deleteIndex("contentKey");
          } catch (e) {
            // ignore
          }
        }
      };
    });
  };

  // Save audio data to IndexedDB
  const saveAudioToIndexedDB = async (
    messageId: string,
    audioData: BackendAudioResponse,
    contentKey?: string
  ): Promise<boolean> => {
    try {
      const db = await initIndexedDB();
      if (!db) {
        console.error("❌ IndexedDB not available");
        return false;
      }

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], "readwrite");
        const store = transaction.objectStore(storeName);

        const audioRecord: AudioData = {
          messageId,
          audioData,
          timestamp: Date.now(),
          contentKey, // Store the content key for content-based lookup
        };

        const request = store.put(audioRecord);

        request.onsuccess = () => {
          resolve(true);
        };

        request.onerror = () => {
          const errorMsg = `Failed to save audio to IndexedDB for message ${messageId}`;
          console.error(`❌ ${errorMsg}:`, request.error);

          // Add user alert for IndexedDB save failures
          const appStore = useAppStore();
          appStore.addAlert(
            "Failed to save audio data. Audio may not be available for replay."
          );

          reject(request.error);
        };
      });
    } catch (error) {
      console.error("❌ Error saving audio to IndexedDB:", error);

      // Add user alert for general IndexedDB errors
      const appStore = useAppStore();
      appStore.addAlert(
        "Failed to save audio data. Audio may not be available for replay."
      );

      return false;
    }
  };

  // Load audio data from IndexedDB
  const loadAudioFromIndexedDB = async (
    messageId: string
  ): Promise<BackendAudioResponse | null> => {
    try {
      const db = await initIndexedDB();
      if (!db) {
        console.error("❌ IndexedDB not available for loading");
        return null;
      }

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], "readonly");
        const store = transaction.objectStore(storeName);
        const request = store.get(messageId);

        request.onsuccess = () => {
          if (request.result) {
            resolve(request.result.audioData);
          } else {
            resolve(null);
          }
        };

        request.onerror = () => {
          console.error(
            `❌ Error loading audio from IndexedDB for message ${messageId}:`,
            request.error
          );
          reject(request.error);
        };
      });
    } catch (error) {
      console.error(
        `❌ Exception loading audio from IndexedDB for message ${messageId}:`,
        error
      );
      return null;
    }
  };

  // Load audio data by content (for reloaded conversations)
  const loadAudioByContent = async (
    contentKey: string
  ): Promise<BackendAudioResponse | null> => {
    try {
      const db = await initIndexedDB();
      if (!db) return null;

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], "readonly");
        const store = transaction.objectStore(storeName);
        // Use only the compound index for efficient latest lookup
        if (store.indexNames.contains("contentKey_timestamp")) {
          const index = store.index("contentKey_timestamp");
          const range = IDBKeyRange.bound(
            [contentKey, 0],
            [contentKey, Number.MAX_SAFE_INTEGER]
          );
          const cursorRequest = index.openCursor(range, "prev");
          cursorRequest.onsuccess = () => {
            const cursor = cursorRequest.result as IDBCursorWithValue | null;
            if (cursor && cursor.value) {
              resolve((cursor.value as AudioData).audioData);
            } else {
              resolve(null);
            }
          };
          cursorRequest.onerror = () => reject(cursorRequest.error);
          return;
        }

        // Last resort: iterate entire store (older DB versions)
        const getAllReq = store.getAll();
        getAllReq.onsuccess = () => {
          const results = (getAllReq.result as AudioData[]) || [];
          const matching = results
            .filter((r) => r.contentKey === contentKey)
            .sort((a, b) => b.timestamp - a.timestamp)[0];
          resolve(matching ? matching.audioData : null);
        };
        getAllReq.onerror = () => reject(getAllReq.error);
      });
    } catch (error) {
      return null;
    }
  };

  // Save audio data (tries IndexedDB first, falls back to memory)
  const saveAudio = async (
    messageId: string,
    audioData: BackendAudioResponse,
    contentKey?: string
  ): Promise<boolean> => {
    // Add to recent messages
    addToRecentMessages(messageId);

    // Try IndexedDB first
    const savedToIndexedDB = await saveAudioToIndexedDB(
      messageId,
      audioData,
      contentKey
    );

    if (savedToIndexedDB) {
      return true;
    }

    // Fallback to memory cache (for small audio files)
    const sizeInMB = audioData.data.length / (1024 * 1024);
    if (sizeInMB <= 0.5) {
      // Only cache small files in memory
      audioCache.value.set(messageId, audioData);
      pruneMemoryCache();
      return true;
    }

    return false;
  };

  // Load audio data (tries memory first, then IndexedDB)
  const loadAudio = async (
    messageId: string
  ): Promise<BackendAudioResponse | null> => {
    // Try memory cache first
    if (audioCache.value.has(messageId)) {
      return audioCache.value.get(messageId)!;
    }

    // Try IndexedDB
    const audioData = await loadAudioFromIndexedDB(messageId);
    if (audioData) {
      // Cache in memory for future access
      audioCache.value.set(messageId, audioData);
      return audioData;
    }

    return null;
  };

  // Check if audio exists
  const hasAudio = async (messageId: string): Promise<boolean> => {
    return (
      audioCache.value.has(messageId) ||
      (await loadAudioFromIndexedDB(messageId)) !== null
    );
  };

  // Ensure memory cache does not grow unbounded; prefer keeping recent messages
  const pruneMemoryCache = () => {
    if (audioCache.value.size <= MAX_MEMORY_CACHE_ENTRIES) return;
    for (const key of audioCache.value.keys()) {
      if (!recentBotMessages.value.has(key)) {
        audioCache.value.delete(key);
      }
      if (audioCache.value.size <= MAX_MEMORY_CACHE_ENTRIES) break;
    }
  };

  // Clear old audio data (cleanup)
  const cleanupOldAudio = async (
    maxAge: number = 24 * 60 * 60 * 1000 // Defaults to 24 hours
  ): Promise<void> => {
    try {
      const db = await initIndexedDB();
      if (!db) return;

      const transaction = db.transaction([storeName], "readwrite");
      const store = transaction.objectStore(storeName);
      const index = store.index("timestamp");
      const cutoffTime = Date.now() - maxAge;

      const request = index.openCursor(IDBKeyRange.upperBound(cutoffTime));

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
    } catch (error) {
      console.error("Error cleaning up old audio:", error);
    }
  };

  // Initialize the store
  const init = async () => {
    await initIndexedDB();
    // Clean up old audio data on startup
    await cleanupOldAudio();
  };

  return {
    init,
    saveAudio,
    loadAudio,
    loadAudioByContent,
    hasAudio,
    cleanupOldAudio,
    addToRecentMessages,
    isRecentMessage,
  };
});
