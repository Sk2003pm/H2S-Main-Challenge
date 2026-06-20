import { describe, it, expect, beforeEach, vi } from 'vitest';
import { storage, hashPassword } from './storage';

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    getStore: () => store
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true
});

describe('MindAlign Client-side Crypto & Storage Unit Tests', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  describe('hashPassword', () => {
    it('should correctly hash a password to a SHA-256 hex string', async () => {
      const hash1 = await hashPassword('password123');
      const hash2 = await hashPassword('password123');
      const hash3 = await hashPassword('different_password');

      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(hash3);
      expect(hash1.length).toBe(64); // SHA-256 is 64 characters long in hex representation
    });
  });

  describe('User Registration & Authentication', () => {
    it('should successfully register a new user and retrieve their credentials', async () => {
      const res = await storage.registerUser(
        'alice',
        'password123',
        'Alice Smith',
        'JEE Main & Advanced',
        '2026-11-20',
        '🧘'
      );

      expect(res.success).toBe(true);

      const db = storage.getUsersDb();
      expect(db['alice']).toBeDefined();
      expect(db['alice'].name).toBe('Alice Smith');
      expect(db['alice'].exam).toBe('JEE Main & Advanced');
      expect(db['alice'].avatar).toBe('🧘');
      expect(db['alice'].passwordHash).not.toBe('password123'); // Hashed
    });

    it('should fail registration when username is already taken', async () => {
      await storage.registerUser('alice', 'password123', 'Alice S', 'NEET UG', '2026-06-20', '🧘');
      const res = await storage.registerUser('alice', 'pass321', 'Alice S2', 'NEET UG', '2026-06-20', '🧘');
      
      expect(res.success).toBe(false);
      expect(res.message).toBe('Username already exists');
    });

    it('should successfully login with correct credentials and set active session', async () => {
      await storage.registerUser('bob', 'password123', 'Bob Marley', 'UPSC CSE', '2026-10-01', '🧠');
      
      const loginRes = await storage.loginUser('bob', 'password123');
      expect(loginRes.success).toBe(true);
      expect(loginRes.user.name).toBe('Bob Marley');
      
      const activeUser = storage.getActiveUser();
      expect(activeUser.username).toBe('bob');
      expect(storage.getActiveUsername()).toBe('bob');
    });

    it('should fail authentication with incorrect password', async () => {
      await storage.registerUser('bob', 'password123', 'Bob Marley', 'UPSC CSE', '2026-10-01', '🧠');
      
      const loginRes = await storage.loginUser('bob', 'wrongpassword');
      expect(loginRes.success).toBe(false);
      expect(loginRes.message).toBe('Invalid username or password');
    });

    it('should sign out clean active sessions', async () => {
      await storage.registerUser('bob', 'password123', 'Bob Marley', 'UPSC CSE', '2026-10-01', '🧠');
      await storage.loginUser('bob', 'password123');
      
      expect(storage.getActiveUsername()).toBe('bob');
      storage.logoutUser();
      expect(storage.getActiveUsername()).toBe('');
      expect(storage.getActiveUser()).toBeNull();
    });
  });

  describe('Multi-user Journal Isolation', () => {
    it('should keep journals isolated and store them latest-first', async () => {
      // Setup User Alice
      await storage.registerUser('alice', 'password123', 'Alice S', 'NEET UG', '2026-06-20', '🧘');
      await storage.loginUser('alice', 'password123');
      
      const aliceLog = {
        id: 1,
        date: new Date().toISOString(),
        text: 'Alice study log 1',
        stress_input: 40,
        analysis: { mood_score: 60, primary_emotions: [], triggers: [], coping_strategies: [] }
      };
      storage.addJournalLog(aliceLog);
      
      // Setup User Bob
      await storage.registerUser('bob', 'password123', 'Bob M', 'UPSC CSE', '2026-10-01', '🧠');
      await storage.loginUser('bob', 'password123');
      
      const bobLog = {
        id: 2,
        date: new Date().toISOString(),
        text: 'Bob study log 1',
        stress_input: 70,
        analysis: { mood_score: 30, primary_emotions: [], triggers: [], coping_strategies: [] }
      };
      storage.addJournalLog(bobLog);

      // Verify Bob's logs
      const bobLogs = storage.getJournalLogs();
      expect(bobLogs.length).toBe(1);
      expect(bobLogs[0].text).toBe('Bob study log 1');

      // Verify Alice's logs
      await storage.loginUser('alice', 'password123');
      const aliceLogs = storage.getJournalLogs();
      expect(aliceLogs.length).toBe(1);
      expect(aliceLogs[0].text).toBe('Alice study log 1');
    });
  });

  describe('System Clear & Wipe Operations', () => {
    it('should clear all users, active status, and isolated databases', async () => {
      await storage.registerUser('alice', 'password123', 'Alice', 'GATE', '2026-02-01', '🧘');
      await storage.loginUser('alice', 'password123');
      
      const log = { id: 1, text: 'Entry', stress_input: 20, analysis: { mood_score: 80, primary_emotions: [], triggers: [], coping_strategies: [] } };
      storage.addJournalLog(log);
      
      expect(storage.getUsersDb()['alice']).toBeDefined();
      expect(storage.getJournalLogs().length).toBe(1);
      
      const wiped = storage.clearAllData();
      expect(wiped).toBe(true);
      
      expect(storage.getUsersDb()).toEqual({});
      expect(storage.getActiveUser()).toBeNull();
      expect(storage.getJournalLogs()).toEqual([]);
    });
  });
});
