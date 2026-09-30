import os
import shutil
import sqlite3
import json
import logging
import tempfile
from typing import List, Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger("MindAlignDatabase")

# Committed seed database (data/mindalign.db)
SEED_DB_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
SEED_DB_PATH = os.path.join(SEED_DB_DIR, "mindalign.db")


def resolve_db_path() -> str:
    """
    Pick a writable SQLite path.

    Vercel serverless functions run from a read-only filesystem (only /tmp is writable),
    and the seed database is in WAL mode, which needs to create -wal/-shm files next to it.
    Opening it in place crashed the whole API at import time, so on Vercel (or any read-only
    deployment) the seed is copied to the temp directory on cold start.
    Note: /tmp is per-instance and ephemeral, so data written there does not persist long-term.
    """
    env_path = os.getenv("DATABASE_PATH", "").strip()
    if env_path:
        return env_path

    read_only = os.getenv("VERCEL") or not os.access(SEED_DB_DIR, os.W_OK)
    if not read_only:
        return SEED_DB_PATH

    tmp_path = os.path.join(tempfile.gettempdir(), "mindalign.db")
    if not os.path.exists(tmp_path) and os.path.exists(SEED_DB_PATH):
        try:
            shutil.copyfile(SEED_DB_PATH, tmp_path)
        except OSError as e:
            logger.error(f"Could not copy seed database to {tmp_path}: {str(e)}")
    return tmp_path


DB_PATH = resolve_db_path()


def get_db_connection():
    """Create a thread-safe connection to the SQLite database."""
    conn = sqlite3.connect(DB_PATH, timeout=15.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db():
    """Initialize database schema with all required tables and indexes."""
    conn = None
    try:
        conn = get_db_connection()
        with conn:
            # 1. Users table
            conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL COLLATE NOCASE,
                password_hash TEXT NOT NULL,
                name TEXT NOT NULL,
                exam TEXT NOT NULL,
                exam_date TEXT,
                avatar TEXT DEFAULT '🧘',
                xp INTEGER DEFAULT 0,
                level INTEGER DEFAULT 1,
                level_title TEXT DEFAULT 'Mindful Rookie',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """)

            # 2. Journals table
            conn.execute("""
            CREATE TABLE IF NOT EXISTS journals (
                id TEXT PRIMARY KEY,
                username TEXT NOT NULL COLLATE NOCASE,
                date TEXT NOT NULL,
                text TEXT NOT NULL,
                stress_input INTEGER NOT NULL,
                analysis_json TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
            );
            """)

            # 3. Chat Messages table
            conn.execute("""
            CREATE TABLE IF NOT EXISTS chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL COLLATE NOCASE,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                guardrail_triggered BOOLEAN DEFAULT 0,
                guardrail_type TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """)

            # 4. Long-Term Chat Memories (for Aura Context Recall)
            conn.execute("""
            CREATE TABLE IF NOT EXISTS chat_memories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL COLLATE NOCASE,
                category TEXT NOT NULL,
                memory_text TEXT NOT NULL,
                confidence REAL DEFAULT 1.0,
                source TEXT DEFAULT 'chat',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """)

            # 5. Gamification / Activity Logs
            conn.execute("""
            CREATE TABLE IF NOT EXISTS gamification_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL COLLATE NOCASE,
                activity_type TEXT NOT NULL,
                xp_earned INTEGER NOT NULL,
                details TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """)

            # 6. Guardrail Audit Logs
            conn.execute("""
            CREATE TABLE IF NOT EXISTS guardrail_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL COLLATE NOCASE,
                guardrail_type TEXT NOT NULL,
                user_message TEXT NOT NULL,
                action_taken TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """)

            # Performance Indexes
            conn.execute("CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_journals_user ON journals(username);")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_chat_user ON chat_messages(username);")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_memories_user ON chat_memories(username);")

        logger.info(f"MindAlign Database initialized successfully at {DB_PATH}")
        return True
    except Exception as e:
        # Never let a database problem take down the whole API (including the Gemini endpoints)
        logger.error(f"Error initializing MindAlign database at {DB_PATH}: {str(e)}")
        return False
    finally:
        if conn is not None:
            conn.close()


# -------------------------------------------------------------
# User CRUD
# -------------------------------------------------------------

def register_user(username: str, password_hash: str, name: str, exam: str, exam_date: str = "", avatar: str = "🧘") -> Dict[str, Any]:
    conn = get_db_connection()
    clean_username = username.strip().lower()
    try:
        with conn:
            conn.execute("""
                INSERT INTO users (username, password_hash, name, exam, exam_date, avatar, xp, level, level_title)
                VALUES (?, ?, ?, ?, ?, ?, 0, 1, 'Mindful Rookie')
            """, (clean_username, password_hash, name.strip(), exam, exam_date, avatar))
        
        # Add initial starter memory for Aura
        add_memory(clean_username, "exam_goal", f"Preparing for {exam} targeting {exam_date or 'upcoming cycle'}")
        
        return {"success": True, "username": clean_username}
    except sqlite3.IntegrityError:
        return {"success": False, "message": "Username already exists"}
    except Exception as e:
        logger.error(f"Database error registering user: {str(e)}")
        return {"success": False, "message": str(e)}
    finally:
        conn.close()


def get_user(username: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM users WHERE username = ? COLLATE NOCASE", (username.strip().lower(),))
        row = cur.fetchone()
        if row:
            return dict(row)
        return None
    finally:
        conn.close()


def update_user_gamification(username: str, xp: int, level: int, level_title: str) -> bool:
    conn = get_db_connection()
    try:
        with conn:
            conn.execute("""
                UPDATE users 
                SET xp = ?, level = ?, level_title = ?, updated_at = CURRENT_TIMESTAMP
                WHERE username = ? COLLATE NOCASE
            """, (xp, level, level_title, username.strip().lower()))
        return True
    except Exception as e:
        logger.error(f"Error updating gamification: {str(e)}")
        return False
    finally:
        conn.close()


# -------------------------------------------------------------
# Journal CRUD
# -------------------------------------------------------------

def save_journal(journal_id: str, username: str, date: str, text: str, stress_input: int, analysis_json: Dict[str, Any]) -> bool:
    conn = get_db_connection()
    clean_username = username.strip().lower()
    try:
        analysis_str = json.dumps(analysis_json)
        with conn:
            # Auto-provision user record if not yet registered (e.g. demo mode)
            conn.execute("""
                INSERT OR IGNORE INTO users (username, password_hash, name, exam, avatar)
                VALUES (?, 'demo_vault_key', ?, 'Competitive Exam', '🧘')
            """, (clean_username, clean_username.title()))

            conn.execute("""
                INSERT OR REPLACE INTO journals (id, username, date, text, stress_input, analysis_json)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (journal_id, clean_username, date, text, stress_input, analysis_str))
            
        # Extract triggers into Aura memories
        triggers = analysis_json.get("triggers", [])
        if triggers:
            trigger_summary = ", ".join(triggers)
            add_memory(clean_username, "recent_triggers", f"Recent stress triggers: {trigger_summary}")

        return True
    except Exception as e:
        logger.error(f"Error saving journal: {str(e)}")
        return False
    finally:
        conn.close()


def get_journals(username: str, limit: int = 50) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT id, username, date, text, stress_input, analysis_json, created_at
            FROM journals 
            WHERE username = ? COLLATE NOCASE
            ORDER BY created_at DESC
            LIMIT ?
        """, (username.strip().lower(), limit))
        rows = cur.fetchall()
        
        results = []
        for r in rows:
            item = dict(r)
            try:
                item["analysis"] = json.loads(item["analysis_json"])
            except Exception:
                item["analysis"] = {}
            results.append(item)
        return results
    finally:
        conn.close()


def delete_journal(journal_id: str, username: str) -> bool:
    conn = get_db_connection()
    try:
        with conn:
            conn.execute("DELETE FROM journals WHERE id = ? AND username = ? COLLATE NOCASE", (journal_id, username.strip().lower()))
        return True
    except Exception as e:
        logger.error(f"Error deleting journal: {str(e)}")
        return False
    finally:
        conn.close()


# -------------------------------------------------------------
# Chat Messages & History
# -------------------------------------------------------------

def save_chat_message(username: str, role: str, content: str, timestamp: str, guardrail_triggered: bool = False, guardrail_type: Optional[str] = None) -> bool:
    conn = get_db_connection()
    try:
        with conn:
            conn.execute("""
                INSERT INTO chat_messages (username, role, content, timestamp, guardrail_triggered, guardrail_type)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (username.strip().lower(), role, content, timestamp, 1 if guardrail_triggered else 0, guardrail_type))
        return True
    except Exception as e:
        logger.error(f"Error saving chat message: {str(e)}")
        return False
    finally:
        conn.close()


def get_chat_history(username: str, limit: int = 60) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT role, content, timestamp, guardrail_triggered, guardrail_type
            FROM chat_messages
            WHERE username = ? COLLATE NOCASE
            ORDER BY id ASC
            LIMIT ?
        """, (username.strip().lower(), limit))
        rows = cur.fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def clear_chat_history(username: str) -> bool:
    conn = get_db_connection()
    try:
        with conn:
            conn.execute("DELETE FROM chat_messages WHERE username = ? COLLATE NOCASE", (username.strip().lower(),))
        return True
    except Exception as e:
        logger.error(f"Error clearing chat history: {str(e)}")
        return False
    finally:
        conn.close()


# -------------------------------------------------------------
# Aura Long-Term Memory System
# -------------------------------------------------------------

def add_memory(username: str, category: str, memory_text: str, confidence: float = 1.0) -> bool:
    conn = get_db_connection()
    clean_username = username.strip().lower()
    clean_text = memory_text.strip()
    try:
        cur = conn.cursor()
        # Avoid duplicate memories in same category
        cur.execute("""
            SELECT id FROM chat_memories 
            WHERE username = ? AND category = ? AND memory_text = ?
        """, (clean_username, category, clean_text))
        existing = cur.fetchone()
        
        with conn:
            if existing:
                conn.execute("""
                    UPDATE chat_memories 
                    SET confidence = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                """, (confidence, existing["id"]))
            else:
                conn.execute("""
                    INSERT INTO chat_memories (username, category, memory_text, confidence)
                    VALUES (?, ?, ?, ?)
                """, (clean_username, category, clean_text, confidence))
        return True
    except Exception as e:
        logger.error(f"Error adding chat memory: {str(e)}")
        return False
    finally:
        conn.close()


def get_memories(username: str) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT id, category, memory_text, confidence, created_at, updated_at
            FROM chat_memories
            WHERE username = ? COLLATE NOCASE
            ORDER BY updated_at DESC
        """, (username.strip().lower(),))
        rows = cur.fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def delete_memory(memory_id: int, username: str) -> bool:
    conn = get_db_connection()
    try:
        with conn:
            conn.execute("DELETE FROM chat_memories WHERE id = ? AND username = ? COLLATE NOCASE", (memory_id, username.strip().lower()))
        return True
    except Exception as e:
        logger.error(f"Error deleting memory: {str(e)}")
        return False
    finally:
        conn.close()


def clear_memories(username: str) -> bool:
    conn = get_db_connection()
    try:
        with conn:
            conn.execute("DELETE FROM chat_memories WHERE username = ? COLLATE NOCASE", (username.strip().lower(),))
        return True
    except Exception as e:
        logger.error(f"Error clearing memories: {str(e)}")
        return False
    finally:
        conn.close()


# -------------------------------------------------------------
# Guardrail Event Audit Log
# -------------------------------------------------------------

def log_guardrail_event(username: str, guardrail_type: str, user_message: str, action_taken: str):
    conn = get_db_connection()
    try:
        with conn:
            conn.execute("""
                INSERT INTO guardrail_logs (username, guardrail_type, user_message, action_taken)
                VALUES (?, ?, ?, ?)
            """, (username.strip().lower(), guardrail_type, user_message, action_taken))
    except Exception as e:
        logger.error(f"Error logging guardrail event: {str(e)}")
    finally:
        conn.close()


def get_db_stats() -> Dict[str, Any]:
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT count(*) as count FROM users")
        users_count = cur.fetchone()["count"]
        cur.execute("SELECT count(*) as count FROM journals")
        journals_count = cur.fetchone()["count"]
        cur.execute("SELECT count(*) as count FROM chat_messages")
        messages_count = cur.fetchone()["count"]
        cur.execute("SELECT count(*) as count FROM chat_memories")
        memories_count = cur.fetchone()["count"]
        
        return {
            "database_engine": "SQLite 3",
            "database_path": DB_PATH,
            "status": "connected",
            "users_count": users_count,
            "journals_count": journals_count,
            "chat_messages_count": messages_count,
            "memories_count": memories_count
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        conn.close()


# Auto-initialize DB on import
init_db()
