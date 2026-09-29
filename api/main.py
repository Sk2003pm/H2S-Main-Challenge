import os
import json
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException, Body, Query, Path
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import google.generativeai as genai
from dotenv import load_dotenv

# SQLite Database & Gemini Groundtruth Guardrail Modules
try:
    from . import database as db
    from . import guardrails as gr
except ImportError:
    import database as db
    import guardrails as gr

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("MindAlignBackend")

# Load environment variables from project root .env
root_env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env"))
if os.path.exists(root_env_path):
    load_dotenv(dotenv_path=root_env_path, override=True)
load_dotenv(override=True)

# Helper function to dynamically retrieve GEMINI_API_KEY from environment or .env
def get_gemini_api_key() -> str:
    """
    Dynamically retrieves GEMINI_API_KEY from os.environ or root .env,
    ensuring 100% compatibility across local Vite dev and Vercel serverless functions.
    """
    key = os.getenv("GEMINI_API_KEY", "").strip() or os.getenv("VITE_GEMINI_API_KEY", "").strip()
    if not key and os.path.exists(root_env_path):
        load_dotenv(dotenv_path=root_env_path, override=True)
        key = os.getenv("GEMINI_API_KEY", "").strip() or os.getenv("VITE_GEMINI_API_KEY", "").strip()
    return key.strip("\"'")

# Dynamic Gemini configuration
def ensure_gemini_configured() -> bool:
    key = get_gemini_api_key()
    if key:
        try:
            genai.configure(api_key=key)
            return True
        except Exception as e:
            logger.error(f"Error configuring Gemini API: {str(e)}")
            return False
    return False

# Initialize at startup
_key_at_startup = get_gemini_api_key()
if _key_at_startup:
    ensure_gemini_configured()
    logger.info("Gemini API configured successfully using GEMINI_API_KEY.")
else:
    logger.warning("GEMINI_API_KEY not found in environment. Running in sandbox/fallback mode.")

# Initialize FastAPI
app = FastAPI(
    title="MindAlign API",
    description="Backend API for MindAlign Student Mental Wellness Tracker with SQLite DB, Aura Long-Term Memory & Gemini Groundtruth Guardrails",
    version="2.0.0"
)

# Hardened CORS Middleware config for local dev (Vercel requests are same-origin via rewrites)
allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Custom middleware for defense-in-depth HTTP security headers
@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Content-Security-Policy"] = "default-src 'self'; frame-ancestors 'none';"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# -------------------------------------------------------------
# Pydantic Schemas
# -------------------------------------------------------------
class UserRegisterRequest(BaseModel):
    username: str = Field(..., min_length=2)
    password_hash: str = Field(...)
    name: str = Field(...)
    exam: str = Field(...)
    exam_date: Optional[str] = ""
    avatar: Optional[str] = "🧘"

class UserLoginRequest(BaseModel):
    username: str = Field(...)
    password_hash: str = Field(...)

class GamificationUpdateRequest(BaseModel):
    username: str = Field(...)
    xp: int = Field(..., ge=0)
    level: int = Field(..., ge=1)
    level_title: str = Field(...)

class JournalRequest(BaseModel):
    text: str = Field(..., min_length=10, description="The open-ended journal entry text.")
    exam: str = Field(..., description="The competitive exam the student is preparing for.")
    current_stress: int = Field(50, ge=1, le=100, description="The user's self-reported stress level.")
    username: Optional[str] = None

class CopingStrategy(BaseModel):
    title: str
    description: str

class JournalAnalysisResponse(BaseModel):
    mood_score: int
    primary_emotions: List[str]
    triggers: List[str]
    analysis_summary: str
    coping_strategies: List[CopingStrategy]
    milestone_encouragement: str

class SaveJournalRequest(BaseModel):
    id: str
    username: str
    date: str
    text: str
    stress_input: int
    analysis: Dict[str, Any]

class ChatMessage(BaseModel):
    role: str
    content: str

class StudentContext(BaseModel):
    exam: str
    current_stress: int
    recent_triggers: Optional[List[str]] = []

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    student_context: StudentContext
    username: Optional[str] = None

class AddMemoryRequest(BaseModel):
    username: str
    category: str
    memory_text: str

class DailyTipRequest(BaseModel):
    exam: str
    triggers: List[str]
    current_stress: int

class QuizRequest(BaseModel):
    exam: str
    triggers: List[str]

# Safe model executor with active fallback chain
def generate_content_with_fallback(prompt: str, response_mime_type: Optional[str] = None) -> str:
    key = get_gemini_api_key()
    if not key:
        raise ValueError("GEMINI_API_KEY not configured in environment or .env")
        
    ensure_gemini_configured()
    configured_model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip() or "gemini-2.5-flash"
    models_to_try = [configured_model, "gemini-2.5-flash", "gemini-2.5-pro", "gemini-flash-latest", "gemini-2.5-flash-lite"]
    # deduplicate keeping order
    seen = set()
    models_to_try = [x for x in models_to_try if x and not (x in seen or seen.add(x))]
    
    last_error = None
    for m_name in models_to_try:
        try:
            logger.info(f"Generating content using Gemini model: {m_name}")
            model = genai.GenerativeModel(m_name)
            config = {"response_mime_type": response_mime_type} if response_mime_type else None
            response = model.generate_content(prompt, generation_config=config)
            return response.text.strip()
        except Exception as e:
            last_error = e
            err_msg = str(e).lower()
            if "not found" in err_msg or "404" in err_msg or "not supported" in err_msg or "model" in err_msg:
                logger.warning(f"Gemini model '{m_name}' failed or not accessible: {str(e)}. Retrying next model...")
                continue
            else:
                logger.warning(f"Model '{m_name}' general exception: {str(e)}. Retrying next model...")
                continue
                
    if last_error is not None:
        raise last_error
    raise RuntimeError("All models failed to generate content")

# Local fallback data generators
def get_fallback_journal_analysis(text: str, exam: str, current_stress: int) -> Dict[str, Any]:
    text_lower = text.lower()
    triggers = []
    
    if any(k in text_lower for k in ["mock", "test", "score", "marks", "fail"]):
        triggers.append("Mock Test Performance")
    if any(k in text_lower for k in ["syllabus", "backlog", "time", "finish", "revision", "chapters"]):
        triggers.append("Syllabus Load & Time Pressure")
    if any(k in text_lower for k in ["sleep", "tired", "wake", "night", "exhausted", "headache"]):
        triggers.append("Physical Fatigue / Sleep Deprivation")
    if any(k in text_lower for k in ["parent", "friend", "teacher", "peer", "compare", "expectation"]):
        triggers.append("Social/Family Expectations")
        
    if not triggers:
        triggers.append("General Exam Anxiety")
        
    mood_score = max(10, 100 - current_stress)
    
    return {
        "mood_score": mood_score,
        "primary_emotions": ["Anxiety", "Pressure"],
        "triggers": triggers,
        "analysis_summary": f"Your thoughts about {exam} reflect significant preparation pressure. Identifying {', '.join(triggers)} helps you address them step-by-step.",
        "coping_strategies": [
            {
                "title": "5-Minute Grounding",
                "description": "Slow down your heart rate using box breathing."
            },
            {
                "title": "Topic Chunking",
                "description": "Break study sessions into 25-minute Pomodoros."
            }
        ],
        "milestone_encouragement": f"Preparing for {exam} takes daily perseverance. Take it one question at a time."
    }

def get_fallback_chat_reply(message: str, exam: str) -> str:
    msg_lower = message.lower()
    if "suicide" in msg_lower or "kill myself" in msg_lower or "end it" in msg_lower or "die" in msg_lower:
        return ("It sounds like you are going through an incredibly dark and difficult time. Please know that you are not alone and there is support available. "
                "I strongly encourage you to connect with professional help immediately. In India, you can call Vandrevala Foundation Helpline at +91 9999 666 555 "
                "or Kiran Helpline at 1800-599-0019. Please reach out to them or a trusted adult right now.")
    return f"Preparing for {exam} can feel overwhelming. Take a short 2-minute break, drink some water, and remember that your well-being comes first."

# Endpoints
@app.get("/api/health", summary="Health check status")
def health_check():
    """
    Check the status of the MindAlign backend server.
    
    Returns:
        A JSON dictionary indicating server status, Gemini connectivity, and model configuration.
    """
    key = get_gemini_api_key()
    return {
        "status": "healthy",
        "gemini_api_configured": bool(key),
        "gemini_model": os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    }

@app.post("/api/analyze-journal", response_model=JournalAnalysisResponse, summary="Analyze student journal entry")
async def analyze_journal(request: JournalRequest):
    """
    Analyze an open-ended journal entry from a student preparing for a competitive exam.
    
    Generates dynamic sentiment metrics, trigger categories, actionable coping strategies,
    and milestone encouragements via the Gemini API (with secure local fallback processing).
    """
    if not get_gemini_api_key():
        return get_fallback_journal_analysis(request.text, request.exam, request.current_stress)
        
    try:
        prompt = f"""
You are a highly empathetic, trained student wellness counselor specializing in high-stakes exam anxiety (JEE, NEET, UPSC, etc.).
Analyze this journal entry from a student preparing for the {request.exam} exam.
Their self-reported stress level is {request.current_stress}/100.

Journal Entry:
\"\"\"
{request.text}
\"\"\"

Output a structured JSON response. Do not add markdown formatting.
Your JSON structure must contain exactly these keys:
- "mood_score": integer (1 to 100)
- "primary_emotions": list of strings
- "triggers": list of strings (e.g. "Mock Test Backlog", "Syllabus Load", "Sleep Deprivation", "Family Pressure")
- "analysis_summary": string (empathetic analysis explaining why they feel this way)
- "coping_strategies": list of 2-3 objects, each having "title" and "description"
- "milestone_encouragement": string (short motivational message for their {request.exam} exam)

If self-harm is detected, include crisis helpline numbers in India (like Vandrevala Foundation: +91 9999 666 555) in the analysis_summary and lower the mood_score.
"""
        result_text = generate_content_with_fallback(prompt, response_mime_type="application/json")
        return json.loads(result_text)
    except Exception as e:
        logger.error(f"Error calling Gemini API in analyze_journal: {str(e)}")
        return get_fallback_journal_analysis(request.text, request.exam, request.current_stress)

@app.post("/api/chat-companion", summary="Conversational AI Chat Companion with Memory & Guardrails")
async def chat_companion(request: ChatRequest):
    """
    Engage in an empathetic counseling chat with 'Aura', the student wellness companion.
    
    Protected by Multi-Tier Gemini Groundtruth Guardrails:
    - Tier 1: Immediate Crisis & Suicide Prevention (Tele-MANAS & Kiran integration)
    - Tier 2: Medical & Prescription Substance Boundaries (Adderall/Modafinil prohibition)
    - Tier 3: Academic Catastrophizing Cognitive Reframing
    - Tier 4: Jailbreak & Toxicity Shield
    - SQLite Long-Term Memory Extraction & Contextual Injection
    """
    last_msg = request.messages[-1].content
    username = request.username
    exam = request.student_context.exam

    # 1. Deterministic Pre-Execution Safety Guardrail Check
    guardrail_check = gr.evaluate_input_guardrails(last_msg, exam)
    if guardrail_check:
        logger.warning(f"Guardrail triggered for input: {guardrail_check['guardrail_type']}")
        
        # Audit log in SQLite
        if username:
            db.log_guardrail_event(username, guardrail_check["guardrail_type"], last_msg, "GUARDRAIL_INTERVENTION_SENT")
            db.save_chat_message(username, "user", last_msg, datetime.utcnow().isoformat())
            db.save_chat_message(username, "model", guardrail_check["response"], datetime.utcnow().isoformat(), guardrail_triggered=True, guardrail_type=guardrail_check["guardrail_type"])

        return {
            "reply": guardrail_check["response"],
            "guardrail_triggered": True,
            "guardrail_type": guardrail_check["guardrail_type"],
            "helplines": guardrail_check.get("helplines")
        }

    # 2. Automated Aura Long-Term Memory Extraction & Retrieval from SQLite
    memories_list = []
    if username:
        # Extract new memories from user message
        new_facts = gr.extract_student_memories(last_msg, exam)
        for fact in new_facts:
            db.add_memory(username, fact["category"], fact["text"])

        # Fetch existing persistent memories from SQLite
        memories = db.get_memories(username)
        memories_list = [f"- [{m['category']}]: {m['memory_text']}" for m in memories[:8]]

    memory_prompt_section = "\n".join(memories_list) if memories_list else "No prior memories recorded yet."

    # 3. Model Generation with Groundtruth Clinical System Directives
    if not get_gemini_api_key():
        reply = get_fallback_chat_reply(last_msg, exam)
        if username:
            db.save_chat_message(username, "user", last_msg, datetime.utcnow().isoformat())
            db.save_chat_message(username, "model", reply, datetime.utcnow().isoformat())
        return {"reply": reply, "guardrail_triggered": False}

    try:
        system_instruction = f"""
You are "Aura", an empathetic, highly trained digital wellness companion for students preparing for high-stakes examinations like {exam}.
The student's self-reported stress level is {request.student_context.current_stress}/100.
Their recent triggers include: {', '.join(request.student_context.recent_triggers or ['General exam preparation'])}.

=== AURA LONG-TERM MEMORY (PERSISTED IN DATABASE) ===
{memory_prompt_section}

=== GROUNDTRUTH CLINICAL DIRECTIVES ===
- Validate the student's emotions warmly and empathetically.
- If relevant, refer naturally to their long-term context (their target exam {exam}, their specific struggles, or coping strategies that worked for them).
- STRICT PROHIBITION: Never prescribe, recommend, or analyze pharmaceutical stimulants (Adderall, Modafinil, sleeping pills, etc.).
- Frame preparation as manageable daily steps; debunk catastrophic 'all-or-nothing' cognitive traps.
- Keep responses short, supportive, and conversational (2-4 sentences max per response).
- If self-harm is hinted, direct to Tele-MANAS (14416 / 1800-891-4416) or Kiran (1800-599-0019) immediately.
"""
        prompt_parts = [system_instruction, "\nConversation History:\n"]
        for msg in request.messages[:-1]:
            speaker = "Student" if msg.role == "user" else "Aura"
            prompt_parts.append(f"{speaker}: {msg.content}")

        prompt_parts.append(f"Student: {last_msg}")
        prompt_parts.append("Aura: (Reply empathetically, concisely, grounded in student memory)")

        prompt = "\n".join(prompt_parts)
        reply = generate_content_with_fallback(prompt)

        # 4. Save conversation to SQLite Database
        if username:
            now_iso = datetime.utcnow().isoformat()
            db.save_chat_message(username, "user", last_msg, now_iso)
            db.save_chat_message(username, "model", reply, now_iso)

        return {"reply": reply, "guardrail_triggered": False}
    except Exception as e:
        logger.error(f"Error in chat companion: {str(e)}")
        reply = get_fallback_chat_reply(last_msg, exam)
        if username:
            now_iso = datetime.utcnow().isoformat()
            db.save_chat_message(username, "user", last_msg, now_iso)
            db.save_chat_message(username, "model", f"[Offline Mode] {reply}", now_iso)
        return {"reply": f"[Offline Mode] {reply}", "guardrail_triggered": False}

# -------------------------------------------------------------
# SQLite Database & Groundtruth REST API Endpoints
# -------------------------------------------------------------

@app.get("/api/db/status", summary="Check SQLite Database Connection & Stats")
def get_database_status():
    """Returns status and record counts of the SQLite database."""
    return db.get_db_stats()

@app.get("/api/guardrails/status", summary="Check Active Guardrails & Groundtruth Data")
def get_guardrails_status():
    """Returns active safety guardrails and verified groundtruth helplines."""
    return {
        "status": "active",
        "guardrail_layers": [
            "Tier 1: Crisis & Self-Harm Prevention",
            "Tier 2: Medical & Prescription Substance Boundary",
            "Tier 3: Academic Catastrophizing Cognitive Reframing",
            "Tier 4: Jailbreak & Prompt Injection Protection"
        ],
        "verified_helplines": gr.GROUNDTRUTH_HELPLINES,
        "evidence_based_coping": gr.GROUNDTRUTH_STUDENT_COPING
    }

@app.post("/api/auth/register", summary="Register user in SQLite Database")
def api_register_user(req: UserRegisterRequest):
    """Registers student in SQLite database with cryptographically salted credentials."""
    result = db.register_user(req.username, req.password_hash, req.name, req.exam, req.exam_date, req.avatar)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message", "Registration failed"))
    return result

@app.post("/api/auth/login", summary="Authenticate user with SQLite Database")
def api_login_user(req: UserLoginRequest):
    """Verifies student credentials against SQLite database."""
    user = db.get_user(req.username)
    if not user or user["password_hash"] != req.password_hash:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    # Return user profile without leaking password hash
    safe_profile = {
        "username": user["username"],
        "name": user["name"],
        "exam": user["exam"],
        "examDate": user["exam_date"],
        "avatar": user["avatar"],
        "xp": user["xp"],
        "level": user["level"],
        "levelTitle": user["level_title"]
    }
    return {"success": True, "user": safe_profile}

@app.get("/api/user/profile", summary="Fetch user profile from SQLite Database")
def api_get_profile(username: str = Query(...)):
    user = db.get_user(username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "username": user["username"],
        "name": user["name"],
        "exam": user["exam"],
        "examDate": user["exam_date"],
        "avatar": user["avatar"],
        "xp": user["xp"],
        "level": user["level"],
        "levelTitle": user["level_title"]
    }

@app.put("/api/user/gamification", summary="Update XP and Level in SQLite Database")
def api_update_gamification(req: GamificationUpdateRequest):
    success = db.update_user_gamification(req.username, req.xp, req.level, req.level_title)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to update gamification stats")
    return {"success": True, "xp": req.xp, "level": req.level, "level_title": req.level_title}

@app.get("/api/journals", summary="Fetch journal logs from SQLite Database")
def api_get_journals(username: str = Query(...), limit: int = 50):
    journals = db.get_journals(username, limit=limit)
    return journals

@app.post("/api/journals", summary="Save journal log into SQLite Database")
def api_save_journal(req: SaveJournalRequest):
    success = db.save_journal(req.id, req.username, req.date, req.text, req.stress_input, req.analysis)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to save journal entry")
    return {"success": True, "id": req.id}

@app.delete("/api/journals/{journal_id}", summary="Delete journal from SQLite Database")
def api_delete_journal(journal_id: str, username: str = Query(...)):
    success = db.delete_journal(journal_id, username)
    return {"success": success}

@app.get("/api/chat/history", summary="Fetch chat history from SQLite Database")
def api_get_chat_history(username: str = Query(...), limit: int = 60):
    history = db.get_chat_history(username, limit=limit)
    return history

@app.post("/api/chat/clear", summary="Clear chat history in SQLite Database")
def api_clear_chat(username: str = Body(..., embed=True)):
    success = db.clear_chat_history(username)
    return {"success": success}

@app.get("/api/chat/memories", summary="Fetch Aura's long-term memories from SQLite Database")
def api_get_memories(username: str = Query(...)):
    memories = db.get_memories(username)
    return memories

@app.post("/api/chat/memories", summary="Manually add a memory into SQLite Database")
def api_add_memory(req: AddMemoryRequest):
    success = db.add_memory(req.username, req.category, req.memory_text)
    return {"success": success}

@app.delete("/api/chat/memories/{memory_id}", summary="Delete a memory from SQLite Database")
def api_delete_memory(memory_id: int, username: str = Query(...)):
    success = db.delete_memory(memory_id, username)
    return {"success": success}

# Dynamic AI study & relaxation tips generator
@app.post("/api/daily-tips", summary="Get custom daily study and relaxation advice")
async def generate_daily_tips(request: DailyTipRequest):
    """
    Generate personalized study and relaxation recommendations for the student.
    
    Uses current stress level and identified preparation triggers to query Gemini
    for custom actionable tips (falling back to context-aware local lists if offline).
    """
    if not get_gemini_api_key():
        return {
            "focus_tip": f"Divide your {request.exam} chapters into active revision segments. Tackle high-yield concepts first.",
            "relaxation_tip": "Roll your shoulders back and close your eyes for 2 minutes to reset cognitive load.",
            "affirmation": "My preparation progress is gradual and valuable."
        }
        
    try:
        prompt = f"""
Generate personalized study focus and relaxation advice for a student preparing for the {request.exam} exam.
Their current stress triggers are: {', '.join(request.triggers or ['general anxiety'])}.
Their self-reported stress level is {request.current_stress}/100.

Output a structured JSON response. Do not add markdown formatting.
JSON structure must contain exactly these keys:
- "focus_tip": string (a highly specific active study tip for the {request.exam} syllabus or time management)
- "relaxation_tip": string (a specific relaxation or physical grounding advice based on their stress triggers)
- "affirmation": string (a positive mindset affirmation)
"""
        result_text = generate_content_with_fallback(prompt, response_mime_type="application/json")
        return json.loads(result_text)
    except Exception as e:
        logger.error(f"Error generating daily tips: {str(e)}")
        return {
            "focus_tip": f"Divide your {request.exam} chapters into active revision segments. Tackle high-yield concepts first.",
            "relaxation_tip": "Roll your shoulders back and close your eyes for 2 minutes to reset cognitive load.",
            "affirmation": "My preparation progress is gradual and valuable."
        }

# Dynamic AI Zen Brain Quiz generator (MCQ quiz)
def get_fallback_quiz(exam: str) -> Dict[str, Any]:
    exam_lower = exam.lower()
    if "jee" in exam_lower:
        return {
            "question": "[Chemistry - Chemical Bonding] Which of the following molecules has a linear shape and sp hybridization?",
            "options": [
                "Carbon Dioxide (CO2)",
                "Water (H2O)",
                "Sulfur Dioxide (SO2)"
            ],
            "correct_idx": 0,
            "explanation": "CO2 has two double bonds, a steric number of 2, and linear geometry with 180-degree bond angles, which corresponds to sp hybridization."
        }
    elif "neet" in exam_lower:
        return {
            "question": "[Biology - Genetics] Which of the following is a classic ratio for a dihybrid cross in Mendelian inheritance under independent assortment?",
            "options": [
                "3:1",
                "9:3:3:1",
                "1:2:1"
            ],
            "correct_idx": 1,
            "explanation": "A dihybrid cross between two heterozygous parents yields a phenotypic ratio of 9:3:3:1 in the F2 generation under independent assortment."
        }
    elif "upsc" in exam_lower:
        return {
            "question": "[Indian Polity] Which article of the Constitution of India lists the Fundamental Duties of citizens?",
            "options": [
                "Article 51A",
                "Article 21A",
                "Article 44"
            ],
            "correct_idx": 0,
            "explanation": "Article 51A, added by the 42nd Constitutional Amendment Act of 1976, specifies the Fundamental Duties of Indian citizens."
        }
    elif "gate" in exam_lower:
        return {
            "question": "[Computer Science - Algorithms] What is the worst-case time complexity of sorting n elements using Merge Sort?",
            "options": [
                "O(n log n)",
                "O(n^2)",
                "O(n)"
            ],
            "correct_idx": 0,
            "explanation": "Merge Sort consistently divides the array and merges them. The worst, average, and best-case time complexities are all O(n log n)."
        }
    elif "cat" in exam_lower:
        return {
            "question": "[Quantitative Aptitude - Arithmetic] If a person sells an article at a 20% profit, what is the ratio of cost price to selling price?",
            "options": [
                "5:6",
                "4:5",
                "6:5"
            ],
            "correct_idx": 0,
            "explanation": "If Cost Price (CP) is 100, Selling Price (SP) is 120. The ratio CP:SP is 100:120, which simplifies to 5:6."
        }
    else:
        return {
            "question": "[Science] What is the chemical formula for common table salt?",
            "options": [
                "NaCl",
                "KCl",
                "HCl"
            ],
            "correct_idx": 0,
            "explanation": "Table salt is Sodium Chloride, which has the chemical formula NaCl."
        }

# Dynamic AI Zen Brain Quiz generator (MCQ quiz based on core exam subjects)
@app.post("/api/generate-quiz", summary="Generate custom exam subject quiz question")
async def generate_quiz(request: QuizRequest):
    """
    Generate a dynamic academic multiple-choice question tailored to the student's exam syllabus.
    
    Prompts Gemini to generate specific subject-matter questions based on target curriculum
    (Physics/Chemistry/Biology for NEET, Math/Physics/Chem for JEE, Polity/History for UPSC, etc.)
    with a robust fallback matching question pool.
    """
    if not get_gemini_api_key():
        return get_fallback_quiz(request.exam)
        
    try:
        prompt = f"""
Generate an engaging, single academic multiple-choice question (MCQ) based on the actual syllabus/subjects of the competitive exam: {request.exam}.
The question MUST be relevant to core subjects of {request.exam}. For example:
- If JEE: Ask about high-yield topics in Physics (e.g., mechanics, thermodynamics, electrostatics), Chemistry (e.g., organic reaction mechanisms, chemical bonding, chemical equilibrium), or Mathematics (e.g., calculus, coordinate geometry, matrices).
- If NEET: Ask about high-yield topics in Biology (e.g., genetics, plant/animal physiology, cell biology), Chemistry (e.g., organic reaction mechanisms, physical chemistry laws), or Physics (e.g., optics, mechanics).
- If UPSC CSE: Ask about high-yield topics in History, Indian Polity, Geography, Economics, or Science & Technology.
- If GATE: Ask about core computer science/engineering subjects (e.g., algorithms, computer networks, operating systems, mathematics).
- If CAT (IIM): Ask about Quantitative Aptitude (e.g., algebra, number systems, arithmetic) or Verbal Ability/Logical Reasoning puzzles.
- For other exams: Ask about their core academic curriculum subjects.

The question must be conceptual, challenging, and scientifically accurate, testing real subject matter, NOT general knowledge or mental health advice.

Output a structured JSON response. Do not add markdown formatting.
JSON structure must contain exactly these keys:
- "question": string (the question text, stating the subject/chapter, e.g. '[Physics - Thermodynamics] A heat engine operates...')
- "options": list of exactly 3 strings (representing choices)
- "correct_idx": integer (0, 1, or 2 representing the index of correct choice in options list)
- "explanation": string (a concise step-by-step academic explanation of the solution or concept)
"""
        result_text = generate_content_with_fallback(prompt, response_mime_type="application/json")
        return json.loads(result_text)
    except Exception as e:
        logger.error(f"Error generating daily quiz: {str(e)}")
        return get_fallback_quiz(request.exam)
