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
    mood_score: int = Field(..., description="Calculated wellness/mood score from 1 (very low) to 100 (excellent).")
    primary_emotions: List[str] = Field(..., description="List of primary emotions detected.")
    triggers: List[str] = Field(..., description="List of identified stress triggers (e.g. peer pressure, syllabus, exhaustion).")
    analysis_summary: str = Field(..., description="Empathetic, deep AI analysis of the student's entry.")
    coping_strategies: List[CopingStrategy] = Field(..., description="Personalized, actionable wellness strategies.")
    milestone_encouragement: str = Field(..., description="Tailored encouragement referencing their specific exam.")

class ChatMessage(BaseModel):
    role: str = Field(..., description="The speaker: 'user' or 'model'/'assistant'")
    content: str = Field(..., description="The message content.")

class StudentContext(BaseModel):
    exam: str
    current_stress: int
    recent_triggers: Optional[List[str]] = []

class ChatRequest(BaseModel):
    messages: List[ChatMessage] = Field(..., min_items=1)
    student_context: StudentContext

class MindfulnessRequest(BaseModel):
    triggers: List[str] = Field(..., min_items=1)
    duration_minutes: int = Field(5, ge=1, le=20)

# Local fallback data generator in case Gemini is offline/unconfigured
def get_fallback_journal_analysis(text: str, exam: str, current_stress: int) -> Dict[str, Any]:
    text_lower = text.lower()
    triggers = []
    
    # Identify basic triggers from text keyword matching
    if any(k in text_lower for k in ["mock", "test", "score", "marks", "fail"]):
        triggers.append("Mock Test Performance")
    if any(k in text_lower for k in ["syllabus", "backlog", "time", "finish", "revision", "chapters"]):
        triggers.append("Syllabus Load & Time Pressure")
    if any(k in text_lower for k in ["sleep", "tired", "wake", "night", "exhausted", "headache"]):
        triggers.append("Physical Fatigue / Sleep Deprivation")
    if any(k in text_lower for k in ["parent", "friend", "teacher", "peer", "compare", "expectation"]):
        triggers.append("Social/Family Expectations")
    if any(k in text_lower for k in ["forget", "remember", "blank", "mind"]):
        triggers.append("Exam Hall Anxiety & Memory Doubts")
        
    if not triggers:
        triggers.append("General Exam Anxiety")
        
    # Simple mood estimation based on input stress and content length
    mood_score = max(10, 100 - current_stress)
    if "sad" in text_lower or "cry" in text_lower or "hopeless" in text_lower:
        mood_score = min(mood_score, 30)
        emotions = ["Anxiety", "Sadness", "Overwhelm"]
    elif "angry" in text_lower or "frustrated" in text_lower:
        mood_score = min(mood_score, 40)
        emotions = ["Frustration", "Irritability", "Pressure"]
    else:
        emotions = ["Stress", "Apprehension", "Determination"]

    return {
        "mood_score": mood_score,
        "primary_emotions": emotions,
        "triggers": triggers,
        "analysis_summary": f"Based on your thoughts regarding {exam}, it seems like you are holding a lot of pressure. Writing it down is a courageous first step. We detected stress factors pointing to {', '.join(triggers)}. Remember, exam preparation is a marathon, and what you are feeling is a common reaction to high-stakes expectations.",
        "coping_strategies": [
            {
                "title": "5-Minute Grounding",
                "description": "Engage in box breathing to immediately slow down your racing heart. Inhale for 4 seconds, hold for 4, exhale for 4, and hold for 4."
            },
            {
                "title": "Break it Down",
                "description": "If syllabus load is overwhelming, stop looking at the entire subject list. Pick exactly ONE small topic, set a timer for 25 minutes, and focus only on that."
            }
        ],
        "milestone_encouragement": f"You are preparing for {exam}, one of the toughest tests. But remember, {exam} is a measure of your preparation on a specific day, not a definition of your worth or future potential. Take a deep breath—you are capable of taking this step-by-step."
    }

def get_fallback_chat_reply(message: str, exam: str) -> str:
    msg_lower = message.lower()
    if "suicide" in msg_lower or "kill myself" in msg_lower or "end it" in msg_lower or "die" in msg_lower:
        return ("It sounds like you are going through an incredibly dark and difficult time. Please know that you are not alone and there is support available. "
                "I strongly encourage you to connect with professional help immediately. In India, you can call Vandrevala Foundation Helpline at +91 9999 666 555 "
                "or Kiran Helpline at 1800-599-0019. Please reach out to them or a trusted adult right now.")
    
    if "fail" in msg_lower or "score" in msg_lower:
        return f"It is completely natural to feel down after a mock test or while worrying about failing {exam}. A low score is simply diagnostic data—it tells you what to review, not who you are. Give yourself permission to have a bad test and focus on incremental growth."
    
    if "sleep" in msg_lower or "tired" in msg_lower:
        return "Sleep is not a reward for studying; it is a neurological requirement to consolidate your learning. If you don't sleep, your brain cannot retrieve the formulas or concepts you read today. Try aiming for at least 6.5-7 hours tonight."
        
    return f"I hear you. Preparing for {exam} can feel like carrying the weight of the world. What is one small thing we can do right now to make you feel slightly more comfortable? Maybe a stretch, or a cup of water?"

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
        # Fallback mode
        logger.info("Using local fallback generator for journal analysis")
        fallback_data = get_fallback_journal_analysis(request.text, request.exam, request.current_stress)
        return fallback_data
        
    try:
        # Initialize the model
        model = genai.GenerativeModel(MODEL_NAME)
        
        prompt = f"""
You are a highly empathetic, trained student wellness counselor specializing in high-stakes exam anxiety (JEE, NEET, UPSC, etc.).
Analyze this journal entry from a student preparing for the {request.exam} exam.
Their self-reported stress level is {request.current_stress}/100.

Journal Entry:
\"\"\"
{request.text}
\"\"\"

Perform a deep emotional analysis and output a structured JSON response. Do not add any markdown formatting (like ```json) in your final response - output raw JSON content only.

Your JSON structure must contain exactly these keys:
- "mood_score": integer (1 to 100, where 100 is excellent and 1 is severe crisis/distress)
- "primary_emotions": list of strings (e.g. "Anxiety", "Determination", "Guilt", "Burnout")
- "triggers": list of strings (uncover hidden stress triggers, e.g. "Peer Comparison", "Mock Test Backlog", "Sleep Deprivation", "Family Pressure", "Imposter Syndrome")
- "analysis_summary": string (an empathetic, non-judgmental, insightful analysis explaining why they feel this way)
- "coping_strategies": list of 2-3 objects, each having "title" and "description" (provide highly personalized, practical, immediate coping steps tailored to their triggers)
- "milestone_encouragement": string (a short, highly motivating, contextual quote or message that refers to their preparation for {request.exam})

Ensure that you treat safety as priority. If self-harm is detected, include crisis helpline numbers in India (like Vandrevala Foundation: +91 9999 666 555) in the analysis_summary and lower the mood_score.
"""

        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        
        result_text = response.text.strip()
        # Parse output safely
        data = json.loads(result_text)
        return data
        
    except Exception as e:
        logger.error(f"Error calling Gemini API: {str(e)}")
        # Fallback gracefully
        fallback_data = get_fallback_journal_analysis(request.text, request.exam, request.current_stress)
        fallback_data["analysis_summary"] = f"[AI service degraded, using offline analysis] {fallback_data['analysis_summary']}"
        return fallback_data

@app.post("/api/chat-companion")
async def chat_companion(request: ChatRequest):
    last_msg = request.messages[-1].content
    
    # Check for safety concerns in fallback or prompt
    if not API_KEY:
        reply = get_fallback_chat_reply(last_msg, request.student_context.exam)
        return {"reply": reply}
        
    try:
        model = genai.GenerativeModel(MODEL_NAME)
        
        # Format the chat history for Gemini API
        # Gemini API expects format: list of parts, we can translate roles to "user" and "model"
        formatted_history = []
        
        # System instructions
        system_instruction = f"""
You are "Aura", a warm, empathetic, and expert digital wellness companion for students preparing for high-stakes examinations like {request.student_context.exam}.
The student's self-reported stress level is {request.student_context.current_stress}/100.
Their recent triggers include: {', '.join(request.student_context.recent_triggers or [])}.

Your instructions:
- Provide empathetic, warm, validation first. Avoid sounding like a generic corporate AI. Use friendly, supporting words.
- Give short, readable responses (2-4 sentences max per response) to keep it conversational. Do not overwhelm them with walls of text.
- Recommend actionable, immediate steps: stretching, water, a 2-minute focus break, or quick breathing.
- CRITICAL SAFETY: If the student indicates intentions of self-harm, suicidal ideation, or extreme clinical depression, you MUST provide crisis helpline numbers immediately (e.g. Vandrevala Foundation Helpline: +91 9999 666 555 or Kiran Helpline: 1800-599-0019) and encourage them to speak to a professional or a parent.
"""

        # Construct the context prompt with history
        prompt_parts = [system_instruction, "\nConversation History:\n"]
        for msg in request.messages[:-1]:
            speaker = "Student" if msg.role == "user" else "Aura"
            prompt_parts.append(f"{speaker}: {msg.content}")
        
        prompt_parts.append(f"Student: {last_msg}")
        prompt_parts.append("Aura: (Reply empathetically and concisely)")
        
        prompt = "\n".join(prompt_parts)
        
        response = model.generate_content(prompt)
        reply = response.text.strip()
        
        return {"reply": reply}
        
    except Exception as e:
        logger.error(f"Error in chat companion: {str(e)}")
        reply = get_fallback_chat_reply(last_msg, request.student_context.exam)
        return {"reply": f"[Offline Mode] {reply}"}

@app.post("/api/mindfulness-session")
async def generate_mindfulness(request: MindfulnessRequest):
    if not API_KEY:
        return {
            "title": "Exam Mind Rest",
            "steps": [
                "Sit comfortably, close your eyes, and place your hands on your lap.",
                "Observe the physical sensation of sitting: the contact of your body with the chair.",
                f"Release tension in your shoulders that has accumulated from study stress ({', '.join(request.triggers)}).",
                "Focus on the natural inflow and outflow of your breath. Do not force it.",
                "Gently open your eyes when you feel centered and ready to return."
            ],
            "affirmation": "My exam preparation does not define my peace of mind."
        }
        
    try:
        model = genai.GenerativeModel(MODEL_NAME)
        
        prompt = f"""
Generate a custom mindfulness meditation session for a student preparing for competitive exams.
Their current stress triggers are: {', '.join(request.triggers)}.
The session should last around {request.duration_minutes} minutes.

Output a structured JSON response. Do not add markdown formatting.
JSON structure must have exactly these keys:
- "title": string (calming, attractive name, e.g. "Quieting the MCQ Storm")
- "steps": list of 4-5 strings (step-by-step guidance on how to practice this session)
- "affirmation": string (a short, powerful, positive affirmation that helps them release guilt about resting)
"""

        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        
        data = json.loads(response.text.strip())
        return data
        
    except Exception as e:
        logger.error(f"Error generating mindfulness: {str(e)}")
        return {
            "title": "Calming Exam Stress Session",
            "steps": [
                "Sit in a quiet space and roll your shoulders back to let go of physical fatigue.",
                f"Focus on the current stressors: {', '.join(request.triggers)}. Acknowledge them, and let them fade into the background.",
                "Take 5 deep breaths, counting slowly: inhale for 4 seconds, exhale for 4 seconds.",
                "Remind yourself that mock scores are just numbers; your learning is continuous."
            ],
            "affirmation": "I am doing my best, and that is more than enough."
        }
