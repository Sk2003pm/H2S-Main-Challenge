from fastapi.testclient import TestClient
import unittest
from api.main import app

class TestMindAlignAPI(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_health_check(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "healthy")
        self.assertIn("gemini_api_configured", data)

    def test_daily_tips_fallback(self):
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

    def test_generate_quiz_fallback(self):
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

    def test_analyze_journal_fallback(self):
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

    def test_chat_companion_fallback(self):
        payload = {
            "messages": [
                {"role": "user", "content": "Hello, I am feeling tired."}
            ],
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

    def test_analyze_journal_validation_error(self):
        # Text is less than 10 characters (should trigger pydantic min_length validation error)
        payload = {
            "text": "Short",
            "exam": "NEET UG",
            "current_stress": 50
        }
        response = self.client.post("/api/analyze-journal", json=payload)
        self.assertEqual(response.status_code, 422)

    def test_analyze_journal_stress_out_of_bounds(self):
        # Stress level is greater than 100 (should trigger pydantic validation error)
        payload = {
            "text": "I feel extremely worried about my upcoming mocks, syllabus is unfinished and I am stressed.",
            "exam": "NEET UG",
            "current_stress": 120
        }
        response = self.client.post("/api/analyze-journal", json=payload)
        self.assertEqual(response.status_code, 422)

        # Stress level is less than 1
        payload["current_stress"] = 0
        response = self.client.post("/api/analyze-journal", json=payload)
        self.assertEqual(response.status_code, 422)

    def test_generate_quiz_missing_fields(self):
        # Missing exam field (triggers validation error)
        payload = {
            "triggers": ["general pressure"]
        }
        response = self.client.post("/api/generate-quiz", json=payload)
        self.assertEqual(response.status_code, 422)

    def test_chat_companion_missing_fields(self):
        # Missing messages list (triggers validation error)
        payload = {
            "student_context": {
                "exam": "GATE",
                "current_stress": 50
            }
        }
        response = self.client.post("/api/chat-companion", json=payload)
        self.assertEqual(response.status_code, 422)

if __name__ == "__main__":
    unittest.main()

