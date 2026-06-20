import os
import json
import logging
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import google.generativeai as genai
from dotenv import load_dotenv

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("MindAlignBackend")

# Load environment variables
load_dotenv()

# Initialize FastAPI
app = FastAPI(
    title="MindAlign API",
    description="Backend API for MindAlign Student Mental Wellness Tracker",
    version="1.0.0"
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
    allow_methods=["GET", "POST", "OPTIONS"],
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

# Configure Gemini
API_KEY = os.getenv("GEMINI_API_KEY", "")
MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-2.5-pro")

if API_KEY:
    try:
        genai.configure(api_key=API_KEY)
        logger.info(f"Gemini API configured successfully. Configured model: {MODEL_NAME}")
    except Exception as e:
        logger.error(f"Error configuring Gemini API: {str(e)}")
else:
    logger.warning("GEMINI_API_KEY not found in environment. Running in sandbox/fallback mode.")

# Pydantic Schemas
class JournalRequest(BaseModel):
    text: str = Field(..., min_length=10, description="The open-ended journal entry text.")
    exam: str = Field(..., description="The competitive exam the student is preparing for.")
    current_stress: int = Field(50, ge=1, le=100, description="The user's self-reported stress level.")

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

class DailyTipRequest(BaseModel):
    exam: str
    triggers: List[str]
    current_stress: int

class QuizRequest(BaseModel):
    exam: str
    triggers: List[str]

# Safe model executor with active fallback chain
def generate_content_with_fallback(prompt: str, response_mime_type: Optional[str] = None) -> str:
    if not API_KEY:
        raise ValueError("API key not configured")
        
    models_to_try = [MODEL_NAME, "gemini-1.5-flash", "gemini-2.0-flash", "gemini-2.5-flash", "gemini-1.5-pro"]
    # deduplicate keeping order
    seen = set()
    models_to_try = [x for x in models_to_try if not (x in seen or seen.add(x))]
    
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
                
    raise last_error

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
    return {
        "status": "healthy",
        "gemini_api_configured": bool(API_KEY),
        "gemini_model": MODEL_NAME
    }

@app.post("/api/analyze-journal", response_model=JournalAnalysisResponse, summary="Analyze student journal entry")
async def analyze_journal(request: JournalRequest):
    """
    Analyze an open-ended journal entry from a student preparing for a competitive exam.
    
    Generates dynamic sentiment metrics, trigger categories, actionable coping strategies,
    and milestone encouragements via the Gemini API (with secure local fallback processing).
    """
    if not API_KEY:
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

@app.post("/api/chat-companion", summary="Conversational AI Chat Companion")
async def chat_companion(request: ChatRequest):
    """
    Engage in an empathetic counseling chat with 'Aura', the student wellness companion.
    
    Includes built-in validation checks, context awareness relative to the student's
    target exam and stress triggers, and a critical crisis safety warning filter.
    """
    last_msg = request.messages[-1].content
    
    if not API_KEY:
        reply = get_fallback_chat_reply(last_msg, request.student_context.exam)
        return {"reply": reply}
        
    try:
        system_instruction = f"""
You are "Aura", a warm, empathetic, and expert digital wellness companion for students preparing for high-stakes examinations like {request.student_context.exam}.
The student's self-reported stress level is {request.student_context.current_stress}/100.
Their recent triggers include: {', '.join(request.student_context.recent_triggers or [])}.

Your instructions:
- Provide empathetic, warm validation. Speak supportively.
- Give short, readable responses (2-4 sentences max per response) to keep it conversational.
- Recommend actionable, immediate steps: stretching, water, breathing, or study chunk breaks.
- CRITICAL SAFETY: If the student indicates intentions of self-harm, you MUST provide crisis helpline numbers immediately (e.g. Vandrevala Foundation Helpline: +91 9999 666 555) and encourage them to speak to a professional.
"""
        prompt_parts = [system_instruction, "\nConversation History:\n"]
        for msg in request.messages[:-1]:
            speaker = "Student" if msg.role == "user" else "Aura"
            prompt_parts.append(f"{speaker}: {msg.content}")
        
        prompt_parts.append(f"Student: {last_msg}")
        prompt_parts.append("Aura: (Reply empathetically and concisely)")
        
        prompt = "\n".join(prompt_parts)
        reply = generate_content_with_fallback(prompt)
        return {"reply": reply}
    except Exception as e:
        logger.error(f"Error in chat companion: {str(e)}")
        reply = get_fallback_chat_reply(last_msg, request.student_context.exam)
        return {"reply": f"[Offline Mode] {reply}"}

# Dynamic AI study & relaxation tips generator
@app.post("/api/daily-tips", summary="Get custom daily study and relaxation advice")
async def generate_daily_tips(request: DailyTipRequest):
    """
    Generate personalized study and relaxation recommendations for the student.
    
    Uses current stress level and identified preparation triggers to query Gemini
    for custom actionable tips (falling back to context-aware local lists if offline).
    """
    if not API_KEY:
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
    if not API_KEY:
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
