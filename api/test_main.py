from fastapi.testclient import TestClient
import unittest
from api.main import app


class TestMindAlignAPI(unittest.TestCase):
    """
    Comprehensive unit test suite for the MindAlign FastAPI backend.

    Tests cover happy-path success cases, Pydantic validation edge cases,
    HTTP status codes, and response schema correctness for every endpoint.
    """

    def setUp(self):
        """Initialise a reusable TestClient before every test method."""
        self.client = TestClient(app)

    # ------------------------------------------------------------------ #
    #  Health check                                                        #
    # ------------------------------------------------------------------ #

    def test_health_check(self):
        """GET /api/health should return 200 with expected JSON keys."""
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "healthy")
        self.assertIn("gemini_api_configured", data)
        self.assertIn("gemini_model", data)

    # ------------------------------------------------------------------ #
    #  Daily tips                                                          #
    # ------------------------------------------------------------------ #

    def test_daily_tips_fallback(self):
        """POST /api/daily-tips should return all three tip fields."""
        payload = {
            "exam": "JEE Main & Advanced",
            "triggers": ["Mock Test Backlog"],
            "current_stress": 75
        }
        response = self.client.post("/api/daily-tips", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("focus_tip", data)
        self.assertIn("relaxation_tip", data)
        self.assertIn("affirmation", data)

    def test_daily_tips_low_stress(self):
        """POST /api/daily-tips works with low stress level (1)."""
        payload = {
            "exam": "GATE",
            "triggers": [],
            "current_stress": 1
        }
        response = self.client.post("/api/daily-tips", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("focus_tip", data)

    def test_daily_tips_high_stress(self):
        """POST /api/daily-tips works with maximum stress level (100)."""
        payload = {
            "exam": "UPSC CSE",
            "triggers": ["Family Expectations", "Sleep Deprivation"],
            "current_stress": 100
        }
        response = self.client.post("/api/daily-tips", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("affirmation", data)

    # ------------------------------------------------------------------ #
    #  Quiz generation                                                     #
    # ------------------------------------------------------------------ #

    def test_generate_quiz_fallback(self):
        """POST /api/generate-quiz should return a valid 3-option MCQ."""
        payload = {
            "exam": "NEET UG",
            "triggers": ["General pressure"]
        }
        response = self.client.post("/api/generate-quiz", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("question", data)
        self.assertIn("options", data)
        self.assertEqual(len(data["options"]), 3)
        self.assertIn("correct_idx", data)
        self.assertIn("explanation", data)

    def test_generate_quiz_jee_fallback(self):
        """Fallback quiz for JEE should return a Chemistry question."""
        payload = {"exam": "JEE Main & Advanced", "triggers": []}
        response = self.client.post("/api/generate-quiz", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIsInstance(data["correct_idx"], int)
        self.assertIn(data["correct_idx"], [0, 1, 2])

    def test_generate_quiz_missing_fields(self):
        """POST /api/generate-quiz without exam field should return 422."""
        payload = {"triggers": ["general pressure"]}
        response = self.client.post("/api/generate-quiz", json=payload)
        self.assertEqual(response.status_code, 422)

    # ------------------------------------------------------------------ #
    #  Journal analysis                                                    #
    # ------------------------------------------------------------------ #

    def test_analyze_journal_fallback(self):
        """POST /api/analyze-journal should return full analysis schema."""
        payload = {
            "text": "I feel extremely worried about my upcoming mocks, syllabus is unfinished and I am stressed.",
            "exam": "UPSC CSE",
            "current_stress": 80
        }
        response = self.client.post("/api/analyze-journal", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("mood_score", data)
        self.assertIn("primary_emotions", data)
        self.assertIn("triggers", data)
        self.assertIn("analysis_summary", data)
        self.assertIn("coping_strategies", data)

    def test_analyze_journal_mood_score_range(self):
        """Returned mood_score should be an integer in range 1–100."""
        payload = {
            "text": "I cannot focus today. My revision backlog is massive and I am not sleeping well.",
            "exam": "NEET UG",
            "current_stress": 70
        }
        response = self.client.post("/api/analyze-journal", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        mood = data["mood_score"]
        self.assertIsInstance(mood, int)
        self.assertGreaterEqual(mood, 1)
        self.assertLessEqual(mood, 100)

    def test_analyze_journal_validation_error(self):
        """Journal text shorter than 10 chars should return 422."""
        payload = {"text": "Short", "exam": "NEET UG", "current_stress": 50}
        response = self.client.post("/api/analyze-journal", json=payload)
        self.assertEqual(response.status_code, 422)

    def test_analyze_journal_stress_too_high(self):
        """Stress level above 100 should return 422."""
        payload = {
            "text": "I feel extremely worried about my upcoming mocks and syllabus backlog.",
            "exam": "NEET UG",
            "current_stress": 120
        }
        response = self.client.post("/api/analyze-journal", json=payload)
        self.assertEqual(response.status_code, 422)

    def test_analyze_journal_stress_zero(self):
        """Stress level of 0 (below minimum of 1) should return 422."""
        payload = {
            "text": "I feel extremely worried about my upcoming mocks and syllabus backlog.",
            "exam": "NEET UG",
            "current_stress": 0
        }
        response = self.client.post("/api/analyze-journal", json=payload)
        self.assertEqual(response.status_code, 422)

    # ------------------------------------------------------------------ #
    #  Chat companion                                                      #
    # ------------------------------------------------------------------ #

    def test_chat_companion_fallback(self):
        """POST /api/chat-companion should return a reply string."""
        payload = {
            "messages": [{"role": "user", "content": "Hello, I am feeling tired."}],
            "student_context": {
                "exam": "GATE",
                "current_stress": 40,
                "recent_triggers": []
            }
        }
        response = self.client.post("/api/chat-companion", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("reply", data)
        self.assertIsInstance(data["reply"], str)
        self.assertGreater(len(data["reply"]), 0)

    def test_chat_companion_crisis_keywords(self):
        """Chat with crisis keywords should return a reply containing helpline info."""
        payload = {
            "messages": [{"role": "user", "content": "I want to kill myself, I cannot take exam pressure anymore."}],
            "student_context": {
                "exam": "JEE Main & Advanced",
                "current_stress": 95,
                "recent_triggers": ["Family pressure"]
            }
        }
        response = self.client.post("/api/chat-companion", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("reply", data)
        # Fallback must include crisis helpline numbers
        self.assertIn("9999 666 555", data["reply"])

    def test_chat_companion_missing_fields(self):
        """POST /api/chat-companion without messages field should return 422."""
        payload = {
            "student_context": {"exam": "GATE", "current_stress": 50}
        }
        response = self.client.post("/api/chat-companion", json=payload)
        self.assertEqual(response.status_code, 422)


    # ------------------------------------------------------------------ #
    #  SQLite Database & Guardrails Status Tests                         #
    # ------------------------------------------------------------------ #

    def test_database_status(self):
        """GET /api/db/status should return valid SQLite stats."""
        response = self.client.get("/api/db/status")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "connected")
        self.assertIn("users_count", data)
        self.assertIn("journals_count", data)

    def test_guardrails_status(self):
        """GET /api/guardrails/status should return active safety tiers and helplines."""
        response = self.client.get("/api/guardrails/status")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "active")
        self.assertIn("verified_helplines", data)
        self.assertIn("tele_manas", data["verified_helplines"])
        self.assertIn("kiran", data["verified_helplines"])

    def test_sqlite_user_registration_and_login(self):
        """User registration and login flow via SQLite."""
        username = f"test_student_{int(__import__('time').time())}"
        reg_payload = {
            "username": username,
            "password_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            "name": "Test Student",
            "exam": "NEET UG",
            "exam_date": "2026-05-03",
            "avatar": "🧘"
        }
        reg_res = self.client.post("/api/auth/register", json=reg_payload)
        self.assertEqual(reg_res.status_code, 200)

        # Login
        login_res = self.client.post("/api/auth/login", json={
            "username": username,
            "password_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        })
        self.assertEqual(login_res.status_code, 200)
        self.assertTrue(login_res.json()["success"])

    def test_sqlite_journal_crud(self):
        """Save and fetch journal entry from SQLite."""
        username = "journal_tester"
        journal_id = f"j_{int(__import__('time').time())}"
        payload = {
            "id": journal_id,
            "username": username,
            "date": "2026-09-29T22:00:00.000Z",
            "text": "Struggling with organic reaction mechanisms today.",
            "stress_input": 65,
            "analysis": {"mood_score": 35, "triggers": ["Organic Chemistry"]}
        }
        save_res = self.client.post("/api/journals", json=payload)
        self.assertEqual(save_res.status_code, 200)

        # Fetch
        get_res = self.client.get(f"/api/journals?username={username}")
        self.assertEqual(get_res.status_code, 200)
        journals = get_res.json()
        self.assertIsInstance(journals, list)
        self.assertTrue(any(j["id"] == journal_id for j in journals))

    def test_aura_memory_crud(self):
        """Save and fetch long-term memories in SQLite."""
        username = "memory_tester"
        add_res = self.client.post("/api/chat/memories", json={
            "username": username,
            "category": "coping_preference",
            "memory_text": "Prefers 4-7-8 breathing over meditation"
        })
        self.assertEqual(add_res.status_code, 200)

        get_res = self.client.get(f"/api/chat/memories?username={username}")
        self.assertEqual(get_res.status_code, 200)
        memories = get_res.json()
        self.assertTrue(any(m["category"] == "coping_preference" for m in memories))


if __name__ == "__main__":
    unittest.main()

