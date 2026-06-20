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

# CORS Middleware config
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure Gemini
API_KEY = os.getenv("GEMINI_API_KEY", "")
MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-1.5-pro")

if API_KEY:
    try:
        genai.configure(api_key=API_KEY)
        logger.info(f"Gemini API configured successfully with model: {MODEL_NAME}")
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
@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "gemini_api_configured": bool(API_KEY),
        "gemini_model": MODEL_NAME
    }

@app.post("/api/analyze-journal")
async def analyze_journal(request: JournalRequest):
    if not API_KEY:
        return get_fallback_journal_analysis(request.text, request.exam, request.current_stress)
        
    try:
        model = genai.GenerativeModel(MODEL_NAME)
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
        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        return json.loads(response.text.strip())
    except Exception as e:
        logger.error(f"Error calling Gemini API: {str(e)}")
        return get_fallback_journal_analysis(request.text, request.exam, request.current_stress)

@app.post("/api/chat-companion")
async def chat_companion(request: ChatRequest):
    last_msg = request.messages[-1].content
    
    if not API_KEY:
        reply = get_fallback_chat_reply(last_msg, request.student_context.exam)
        return {"reply": reply}
        
    try:
        model = genai.GenerativeModel(MODEL_NAME)
        
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
        response = model.generate_content(prompt)
        return {"reply": response.text.strip()}
    except Exception as e:
        logger.error(f"Error in chat companion: {str(e)}")
        reply = get_fallback_chat_reply(last_msg, request.student_context.exam)
        return {"reply": f"[Offline Mode] {reply}"}

# NEW ENDPOINT: Dynamic AI study & relaxation tips generator
@app.post("/api/daily-tips")
async def generate_daily_tips(request: DailyTipRequest):
    if not API_KEY:
        return {
            "focus_tip": f"Divide your {request.exam} chapters into active revision segments. Tackle high-yield concepts first.",
            "relaxation_tip": "Roll your shoulders back and close your eyes for 2 minutes to reset cognitive load.",
            "affirmation": "My preparation progress is gradual and valuable."
        }
        
    try:
        model = genai.GenerativeModel(MODEL_NAME)
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
        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        return json.loads(response.text.strip())
    except Exception as e:
        logger.error(f"Error generating daily tips: {str(e)}")
        return {
            "focus_tip": f"Divide your {request.exam} chapters into active revision segments. Tackle high-yield concepts first.",
            "relaxation_tip": "Roll your shoulders back and close your eyes for 2 minutes to reset cognitive load.",
            "affirmation": "My preparation progress is gradual and valuable."
        }

# NEW ENDPOINT: Dynamic AI Zen Brain Quiz generator (MCQ quiz)
@app.post("/api/generate-quiz")
async def generate_quiz(request: QuizRequest):
    if not API_KEY:
        # Fallback to local quiz questions list
        return {
            "question": "Why is taking a active 5-minute break every 25 minutes of study (Pomodoro) highly effective for retrieval?",
            "options": [
                "It resets your neural paths and allows focus memory consolidation.",
                "It allows you to study faster and cram more details.",
                "It has no physiological impact; it just wastes study time."
            ],
            "correct_idx": 0,
            "explanation": "Consolidation happens when the brain rests. High intensity study without short pauses causes interference, leading to faster forgetting of equations and concepts."
        }
        
    try:
        model = genai.GenerativeModel(MODEL_NAME)
        prompt = f"""
Generate an engaging, single multiple-choice question (MCQ) for a student preparing for {request.exam}.
The question should focus on study science, memory retrieval psychology, sleep hygiene, or stress biology.
Their stress triggers include: {', '.join(request.triggers or ['general exam pressure'])}.

Output a structured JSON response. Do not add markdown formatting.
JSON structure must contain exactly these keys:
- "question": string (the question text, e.g. relating to active recall, spaced repetition, or cognitive fatigue)
- "options": list of exactly 3 strings (representing choices)
- "correct_idx": integer (0, 1, or 2 representing the index of correct choice in options list)
- "explanation": string (a short explanation why the correct answer is scientific and helpful)
"""
        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        return json.loads(response.text.strip())
    except Exception as e:
        logger.error(f"Error generating daily quiz: {str(e)}")
        return {
            "question": "Why is taking a active 5-minute break every 25 minutes of study (Pomodoro) highly effective for retrieval?",
            "options": [
                "It resets your neural paths and allows focus memory consolidation.",
                "It allows you to study faster and cram more details.",
                "It has no physiological impact; it just wastes study time."
            ],
            "correct_idx": 0,
            "explanation": "Consolidation happens when the brain rests. High intensity study without short pauses causes interference, leading to faster forgetting of equations and concepts."
        }
