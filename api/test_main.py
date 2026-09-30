import os
import sys
import tempfile
import importlib.util
from types import SimpleNamespace
from unittest import mock

# Hermetic tests: never call the real Gemini API (even if a local .env has a key)
# and never modify the committed seed database in data/.
for _key_var in ("GEMINI_API_KEY", "GOOGLE_API_KEY", "VITE_GEMINI_API_KEY"):
    os.environ[_key_var] = ""
os.environ.setdefault("DATABASE_PATH", os.path.join(tempfile.mkdtemp(), "mindalign_test.db"))

from fastapi.testclient import TestClient
import unittest
from google.genai import errors as genai_errors
from api import main as main_module
from api import database as database_module
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


class TestVercelAndGeminiIntegration(unittest.TestCase):
    """Regression tests for the Vercel entrypoint, the read-only DB fallback and the Gemini model chain."""

    def setUp(self):
        self.client = TestClient(app)

    def _fake_client(self, side_effects):
        generate = mock.Mock(side_effect=side_effects)
        return SimpleNamespace(models=SimpleNamespace(generate_content=generate)), generate

    def test_vercel_entrypoint_loads_as_top_level_module(self):
        """Vercel imports api/index.py without a package context; it must still expose the FastAPI app."""
        index_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "index.py")
        saved_path, saved_modules = list(sys.path), set(sys.modules)
        try:
            spec = importlib.util.spec_from_file_location("vercel_index_entrypoint", index_path)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            self.assertIn("/api/health", [route.path for route in module.app.routes])
        finally:
            sys.path[:] = saved_path
            for name in set(sys.modules) - saved_modules:
                del sys.modules[name]

    def test_database_uses_tmp_copy_on_vercel(self):
        """On Vercel the deployment is read-only, so the seed DB must be copied to the temp dir."""
        tmp_dir = tempfile.mkdtemp()
        with mock.patch.dict(os.environ, {"VERCEL": "1", "DATABASE_PATH": ""}), \
                mock.patch.object(database_module.tempfile, "gettempdir", return_value=tmp_dir):
            path = database_module.resolve_db_path()
        self.assertEqual(path, os.path.join(tmp_dir, "mindalign.db"))
        self.assertTrue(os.path.exists(path))

    def test_model_chain_skips_unavailable_model(self):
        """A 404 for one model must fall through to the next model instead of the canned fallback."""
        not_found = genai_errors.ClientError(404, {"error": {"code": 404, "message": "model not found", "status": "NOT_FOUND"}})
        tips = '{"focus_tip": "Gemini focus", "relaxation_tip": "Gemini relax", "affirmation": "Gemini affirm"}'
        fake, generate = self._fake_client([not_found, SimpleNamespace(text=tips, candidates=[])])
        with mock.patch.object(main_module, "get_gemini_api_key", return_value="test-key"), \
                mock.patch.object(main_module, "get_gemini_client", return_value=fake), \
                mock.patch.object(main_module, "get_gemini_models", return_value=["retired-model", "gemini-2.5-flash"]):
            response = self.client.post("/api/daily-tips", json={"exam": "GATE", "triggers": [], "current_stress": 40})
        self.assertEqual(response.json()["focus_tip"], "Gemini focus")
        self.assertEqual([c.kwargs["model"] for c in generate.call_args_list], ["retired-model", "gemini-2.5-flash"])

    def test_invalid_key_stops_model_chain(self):
        """An invalid API key fails every model, so the chain must stop after the first attempt."""
        bad_key = genai_errors.ClientError(400, {"error": {"code": 400, "message": "API key not valid. Please pass a valid API key.", "status": "INVALID_ARGUMENT"}})
        fake, generate = self._fake_client([bad_key, bad_key])
        with mock.patch.object(main_module, "get_gemini_api_key", return_value="bad-key"), \
                mock.patch.object(main_module, "get_gemini_client", return_value=fake), \
                mock.patch.object(main_module, "get_gemini_models", return_value=["gemini-2.5-flash", "gemini-2.5-flash-lite"]):
            response = self.client.post("/api/generate-quiz", json={"exam": "GATE", "triggers": []})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["options"]), 3)  # local fallback quiz
        self.assertEqual(generate.call_count, 1)

    def test_malformed_gemini_json_falls_back(self):
        """A reply missing required keys must return the local fallback, not a 500."""
        fake, _ = self._fake_client([SimpleNamespace(text='{"mood_score": 40}', candidates=[])])
        with mock.patch.object(main_module, "get_gemini_api_key", return_value="test-key"), \
                mock.patch.object(main_module, "get_gemini_client", return_value=fake), \
                mock.patch.object(main_module, "get_gemini_models", return_value=["gemini-2.5-flash"]):
            response = self.client.post("/api/analyze-journal", json={
                "text": "Mock test scores dropped and my syllabus backlog keeps growing.",
                "exam": "NEET UG",
                "current_stress": 70
            })
        self.assertEqual(response.status_code, 200)
        self.assertIn("coping_strategies", response.json())

    def test_transcribe_rejects_bad_requests(self):
        """/api/transcribe validates the audio type, empty bodies and a missing key before calling Gemini."""
        self.assertEqual(self.client.post("/api/transcribe", content=b"abc", headers={"Content-Type": "text/plain"}).status_code, 415)
        self.assertEqual(self.client.post("/api/transcribe", content=b"", headers={"Content-Type": "audio/wav"}).status_code, 400)
        self.assertEqual(self.client.post("/api/transcribe", content=b"RIFF....", headers={"Content-Type": "audio/wav"}).status_code, 503)

    def test_transcribe_returns_gemini_transcript(self):
        """Audio is forwarded to Gemini as an inline part and the cleaned transcript is returned."""
        fake, generate = self._fake_client([SimpleNamespace(text='{"transcript": "  I feel   stressed about mocks "}', candidates=[])])
        with mock.patch.object(main_module, "get_gemini_api_key", return_value="test-key"), \
                mock.patch.object(main_module, "get_gemini_client", return_value=fake):
            response = self.client.post("/api/transcribe", content=b"RIFF-fake-wav", headers={"Content-Type": "audio/wav"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["text"], "I feel stressed about mocks")
        audio_part = generate.call_args.kwargs["contents"][0]
        self.assertEqual(audio_part.inline_data.mime_type, "audio/wav")
        self.assertEqual(audio_part.inline_data.data, b"RIFF-fake-wav")

    def test_chat_prompt_includes_journal_references(self):
        """Journal entries shared by the frontend reach Gemini, with the focused entry first."""
        fake, generate = self._fake_client([SimpleNamespace(text="In your journal you mentioned mocks.", candidates=[])])
        payload = {
            "messages": [{"role": "user", "content": "Can we talk about my week?"}],
            "student_context": {"exam": "NEET UG", "current_stress": 60, "recent_triggers": []},
            "journal_context": [
                {"date": "27 Sep 2026", "text": "Physics backlog is huge.", "mood_score": 50, "triggers": ["Syllabus Load"]},
                {"date": "28 Sep 2026", "text": "Mock score dropped again.", "mood_score": 30, "triggers": ["Mock Test"], "focused": True}
            ]
        }
        with mock.patch.object(main_module, "get_gemini_api_key", return_value="test-key"), \
                mock.patch.object(main_module, "get_gemini_client", return_value=fake):
            response = self.client.post("/api/chat-companion", json=payload)
        self.assertEqual(response.json()["reply"], "In your journal you mentioned mocks.")
        prompt = generate.call_args.kwargs["contents"]
        self.assertIn("FOCUS ENTRY", prompt)
        self.assertLess(prompt.index("Mock score dropped again."), prompt.index("Physics backlog is huge."))

    def test_guardrail_reply_survives_database_failure(self):
        """A SQLite failure must never swallow the crisis helpline response."""
        with mock.patch.object(database_module, "save_chat_message", side_effect=RuntimeError("disk I/O error")), \
                mock.patch.object(database_module, "log_guardrail_event", side_effect=RuntimeError("disk I/O error")):
            response = self.client.post("/api/chat-companion", json={
                "messages": [{"role": "user", "content": "I want to kill myself"}],
                "student_context": {"exam": "JEE", "current_stress": 95, "recent_triggers": []},
                "username": "db_failure_tester"
            })
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["guardrail_triggered"])
        self.assertIn("14416", response.json()["reply"])

    def test_thinking_config_per_model_family(self):
        """Each model family gets a thinking setting it accepts."""
        self.assertEqual(main_module.get_thinking_config("gemini-2.5-flash").thinking_budget, 0)
        self.assertEqual(main_module.get_thinking_config("gemini-3.6-flash").thinking_level, "MINIMAL")
        self.assertEqual(main_module.get_thinking_config("gemini-3.5-flash-lite").thinking_level, "MINIMAL")
        self.assertEqual(main_module.get_thinking_config("gemini-3.8-flash").thinking_level, "LOW")
        self.assertIsNone(main_module.get_thinking_config("gemini-flash-latest"))

    def test_offline_chat_replies_follow_the_topic(self):
        """Without a Gemini key, replies are marked as fallback and differ by what the student raised."""
        def ask(text):
            response = self.client.post("/api/chat-companion", json={
                "messages": [{"role": "user", "content": text}],
                "student_context": {"exam": "GATE", "current_stress": 50, "recent_triggers": []}
            })
            self.assertEqual(response.json()["ai_source"], "fallback")
            return response.json()["reply"]

        replies = {ask("I could not sleep last night"), ask("My mock score dropped"), ask("My friends are ahead of me"), ask("Hello")}
        self.assertEqual(len(replies), 4)
        # "studied" must not be mistaken for the crisis keyword "die"
        self.assertNotIn("Helpline", ask("I studied all evening"))

    def test_health_rejects_unconfigured_model(self):
        """The per-model live check only accepts models from the configured chain."""
        self.assertEqual(self.client.get("/api/health?check=true&model=gemini-ultra-9000").status_code, 400)

    def test_health_live_check_without_key(self):
        """GET /api/health?check=true reports a failed live check (never the key) when no key is set."""
        response = self.client.get("/api/health?check=true")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertFalse(data["gemini_api_configured"])
        self.assertFalse(data["gemini_live_check"]["ok"])


if __name__ == "__main__":
    unittest.main()

