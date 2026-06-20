// LocalStorage utility helpers with Multi-user support & client-side cryptography

const KEYS = {
  USERS_DB: 'mindalign_users_db',
  ACTIVE_USER: 'mindalign_active_user',
  COMPLETED_COPING: 'mindalign_coping_completed'
};

// Web Crypto API helper to hash passwords securely in the client
export async function hashPassword(password, salt = "") {
  try {
    // Salt the password input string to protect against pre-computed rainbow table attacks
    const saltedInput = salt ? `${password}_salt:${salt.toLowerCase()}` : password;
    const msgUint8 = new TextEncoder().encode(saltedInput);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    console.error("Crypto API not supported or failed, using fallback", e);
    // Simple fallback hash if crypto isn't available, preserving salt constraints
    const saltedInput = salt ? `${password}_salt:${salt.toLowerCase()}` : password;
    let hash = 0;
    for (let i = 0; i < saltedInput.length; i++) {
      hash = (hash << 5) - hash + saltedInput.charCodeAt(i);
      hash |= 0;
    }
    return 'fb_' + hash.toString(16);
  }
}

export const storage = {
  // Get all registered users
  getUsersDb: () => {
    try {
      const data = localStorage.getItem(KEYS.USERS_DB);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      console.error("Error reading users database", e);
      return {};
    }
  },

  // Save users database
  saveUsersDb: (db) => {
    try {
      localStorage.setItem(KEYS.USERS_DB, JSON.stringify(db));
      return true;
    } catch (e) {
      console.error("Error saving users database", e);
      return false;
    }
  },

  // Register a new user
  registerUser: async (username, password, name, exam, examDate, avatar) => {
    const db = storage.getUsersDb();
    const cleanUsername = username.trim().toLowerCase();
    
    if (db[cleanUsername]) {
      return { success: false, message: 'Username already exists' };
    }

    // Hash password salted with unique lowercase username
    const passwordHash = await hashPassword(password, cleanUsername);
    db[cleanUsername] = {
      username: cleanUsername,
      passwordHash,
      name: name.trim(),
      exam,
      examDate,
      avatar
    };

    storage.saveUsersDb(db);
    return { success: true };
  },

  // Authenticate user
  loginUser: async (username, password) => {
    const db = storage.getUsersDb();
    const cleanUsername = username.trim().toLowerCase();
    
    const user = db[cleanUsername];
    if (!user) {
      return { success: false, message: 'Invalid username or password' };
    }

    // Verify salted credentials
    const passwordHash = await hashPassword(password, cleanUsername);
    if (user.passwordHash !== passwordHash) {
      return { success: false, message: 'Invalid username or password' };
    }

    // Set active user
    localStorage.setItem(KEYS.ACTIVE_USER, cleanUsername);
    return { success: true, user };
  },

  // Get active logged-in user profile
  getActiveUser: () => {
    try {
      const activeUsername = localStorage.getItem(KEYS.ACTIVE_USER);
      if (!activeUsername) return null;
      
      const db = storage.getUsersDb();
      return db[activeUsername] || null;
    } catch (e) {
      console.error("Error getting active user", e);
      return null;
    }
  },

  // Sign out active user
  logoutUser: () => {
    localStorage.removeItem(KEYS.ACTIVE_USER);
  },

  // Get active username string
  getActiveUsername: () => {
    return localStorage.getItem(KEYS.ACTIVE_USER) || '';
  },

  // Get Journal Logs for Active User
  getJournalLogs: () => {
    const username = storage.getActiveUsername();
    if (!username) return [];
    try {
      const data = localStorage.getItem(`mindalign_journals_${username}`);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error("Error reading journal logs", e);
      return [];
    }
  },

  saveJournalLogs: (logs) => {
    const username = storage.getActiveUsername();
    if (!username) return false;
    try {
      localStorage.setItem(`mindalign_journals_${username}`, JSON.stringify(logs));
      return true;
    } catch (e) {
      console.error("Error saving journal logs", e);
      return false;
    }
  },

  addJournalLog: (log) => {
    const logs = storage.getJournalLogs();
    logs.unshift(log); // Add to beginning (latest first)
    storage.saveJournalLogs(logs);
    return logs;
  },

  // Get Chat Messages for Active User
  getChatMessages: () => {
    const username = storage.getActiveUsername();
    if (!username) return [];
    try {
      const data = localStorage.getItem(`mindalign_chats_${username}`);
      return data ? JSON.parse(data) : [
        {
          role: 'model',
          content: 'Hi! I am Aura, your wellness companion. How is your exam preparation going today? Feel free to share your thoughts, fears, or goals, and we will work through them together.',
          timestamp: new Date().toISOString()
        }
      ];
    } catch (e) {
      console.error("Error reading chat history", e);
      return [];
    }
  },

  saveChatMessages: (messages) => {
    const username = storage.getActiveUsername();
    if (!username) return false;
    try {
      localStorage.setItem(`mindalign_chats_${username}`, JSON.stringify(messages));
      return true;
    } catch (e) {
      console.error("Error saving chat history", e);
      return false;
    }
  },

  // Clear all databases
  clearAllData: () => {
    try {
      localStorage.removeItem(KEYS.USERS_DB);
      localStorage.removeItem(KEYS.ACTIVE_USER);
      localStorage.removeItem(KEYS.COMPLETED_COPING);
      
      // Clear dynamic keys
      const keys = Object.keys(localStorage);
      keys.forEach(k => {
        if (k.startsWith('mindalign_journals_') || k.startsWith('mindalign_chats_')) {
          localStorage.removeItem(k);
        }
      });
      return true;
    } catch (e) {
      console.error("Error clearing local storage", e);
      return false;
    }
  }
};
