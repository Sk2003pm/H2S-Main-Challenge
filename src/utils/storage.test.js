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

    it('should generate different hashes for the same password when using unique username salts', async () => {
      const hashAlice = await hashPassword('password123', 'alice');
      const hashBob = await hashPassword('password123', 'bob');
      const hashNoSalt = await hashPassword('password123');

      expect(hashAlice).not.toBe(hashBob);
      expect(hashAlice).not.toBe(hashNoSalt);
      expect(hashBob).not.toBe(hashNoSalt);
      expect(hashAlice.length).toBe(64);
      expect(hashBob.length).toBe(64);
    });

    it('should produce consistent hashes for the same password+salt pair', async () => {
      const hash1 = await hashPassword('myPass', 'charlie');
      const hash2 = await hashPassword('myPass', 'charlie');
      expect(hash1).toBe(hash2);
    });

    it('should treat username salts case-insensitively', async () => {
      const hashLower = await hashPassword('testPass', 'alice');
      const hashUpper = await hashPassword('testPass', 'ALICE');
      expect(hashLower).toBe(hashUpper);
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

    it('should normalize username to lowercase on registration', async () => {
      const res = await storage.registerUser('ALICE', 'password123', 'Alice', 'JEE Main & Advanced', '2026-11-20', '🧘');
      expect(res.success).toBe(true);
      const db = storage.getUsersDb();
      expect(db['alice']).toBeDefined();
      expect(db['ALICE']).toBeUndefined();
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

    it('should fail login for non-existent username', async () => {
      const loginRes = await storage.loginUser('ghost_user', 'anyPassword');
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

    it('should return empty array when no journal logs exist for new user', async () => {
      await storage.registerUser('newUser', 'pass123', 'New User', 'GATE', '2026-05-01', '🎯');
      await storage.loginUser('newUser', 'pass123');
      const logs = storage.getJournalLogs();
      expect(logs).toEqual([]);
    });

    it('should add multiple logs and maintain latest-first order', async () => {
      await storage.registerUser('carol', 'pass123', 'Carol', 'CAT (IIM)', '2026-12-01', '🚀');
      await storage.loginUser('carol', 'pass123');

      const log1 = { id: 1, date: new Date().toISOString(), text: 'First entry', stress_input: 30, analysis: { mood_score: 70, primary_emotions: [], triggers: [], coping_strategies: [] } };
      const log2 = { id: 2, date: new Date().toISOString(), text: 'Second entry', stress_input: 60, analysis: { mood_score: 40, primary_emotions: [], triggers: [], coping_strategies: [] } };

      storage.addJournalLog(log1);
      storage.addJournalLog(log2);

      const logs = storage.getJournalLogs();
      expect(logs.length).toBe(2);
      expect(logs[0].text).toBe('Second entry'); // Latest first
      expect(logs[1].text).toBe('First entry');
    });
  });

  describe('Chat Message Persistence', () => {
    it('should save and retrieve chat messages for an active user', async () => {
      await storage.registerUser('david', 'pass123', 'David', 'NEET UG', '2026-06-01', '📚');
      await storage.loginUser('david', 'pass123');

      const messages = [
        { role: 'model', content: 'Hello David!', timestamp: new Date().toISOString() },
        { role: 'user', content: 'I am stressed.', timestamp: new Date().toISOString() }
      ];
      storage.saveChatMessages(messages);

      const loaded = storage.getChatMessages();
      expect(loaded.length).toBe(2);
      expect(loaded[1].content).toBe('I am stressed.');
    });

    it('should keep chat history isolated between users', async () => {
      await storage.registerUser('u1', 'pass', 'User One', 'JEE Main & Advanced', '2026-01-01', '🧘');
      await storage.registerUser('u2', 'pass', 'User Two', 'NEET UG', '2026-02-01', '🧠');

      await storage.loginUser('u1', 'pass');
      storage.saveChatMessages([{ role: 'user', content: 'User1 message', timestamp: new Date().toISOString() }]);

      await storage.loginUser('u2', 'pass');
      const u2Msgs = storage.getChatMessages();
      // u2 should not see u1's message
      expect(u2Msgs.every(m => m.content !== 'User1 message')).toBe(true);
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

    it('should return empty journal logs when no active user is set', () => {
      const logs = storage.getJournalLogs();
      expect(logs).toEqual([]);
    });
  });
});
