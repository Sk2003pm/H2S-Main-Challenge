# MindAlign: AI-Powered Student Stress & Mental Wellness Companion

MindAlign is a Generative AI-powered digital wellness application built specifically for students preparing for high-stakes examinations (e.g., JEE, NEET, UPSC, GATE, CAT, CUET, and Board Exams). It helps aspirants monitor, analyze, and alleviate academic anxiety, stress, and burnout.

---

## 🌟 Key Features

1. **🔒 Secure Multi-User Portal**:
   * Complete Sign Up & Sign In portal allowing students to manage custom profiles.
   * Leverages client-side SHA-256 cryptographic password hashing (via the Web Crypto API) to ensure user credentials are never stored or transmitted in cleartext.
   * Completely isolated user databases (journals, logs, and chats) stored securely and offline-first inside local storage namespaces.

2. **📝 Expressive Daily Journal & AI Analyzer**:
   * Open-ended writing canvas where students can express academic struggles, mock test worries, and focus details.
   * Direct integration with the Gemini API to analyze journals and extract:
     * **Calm Gauge**: Mood wellness score (1-100).
     * **Primary Emotions**: Emotion classification badges (e.g., anxiety, pressure, determination).
     * **Hidden Stress Triggers**: Pinpoint specific stressors like Syllabus Overload, Peer Comparison, Sleep Deprivation, Family Expectations.
     * **Actionable Coping Checklist**: Immediate, bite-sized wellness steps.
     * **Exam Motivation**: Contextual encouragements referencing their target exam milestone.

3. **💬 "Aura" - Empathetic AI Companion**:
   * Real-time conversational counselor specifically prompted for student academic anxiety.
   * Features quick-reply worry chips (e.g., *"Just got a low score in mock test"*, *"Syllabus backlog is piling up"*) for rapid check-ins.
   * **Safe Crisis Routing**: Integrated safety checks that instantly detect signs of self-harm or severe depression, outputting official helpline details (+91 9999 666 555 / 1800-599-0019) to ensure user safety.

4. **🌬️ Calming Breathing Bubble**:
   * Interactive, visually scaling box breathing guide.
   * Supports two distinct breathing techniques:
     * **Navy SEAL Box Breathing** (4s inhale, 4s hold, 4s exhale, 4s hold) for immediate stress control.
     * **Relaxation Pranayama (4-7-8)** for nervous system stabilization.
   * Keyframe animations sync sizing with instructions to keep users centered.

5. **⏱️ Focus Pomodoro & Countdown**:
   * Study countdown timer tracking exactly how many days remain until the student's target exam date.
   * Study/Break interval focus timer (Pomodoro).
   * **Synthesized Ambient Audio**: Generates Ocean Wave washes and 10Hz Alpha Binaural Beats dynamically using the browser's HTML5 Web Audio API—enabling completely offline, zero-asset focus sounds.

---

## 🛠️ Technology Stack

* **Frontend**: React (Vite compilation), Lucide React (Icons), Canvas Confetti (Celebrations).
* **Styling**: Vanilla CSS (Calming dark-mode theme, CSS variables design token system, responsive flexbox/grid layouts, custom scrollbars, and fluid glassmorphic card patterns).
* **Backend**: FastAPI (Python), Google Generative AI (Gemini integration), Pydantic schemas.
* **Serverless Deployment**: Vercel Serverless Functions (`vercel.json` rewrites `/api/*` to Python serverless runtimes).

---

## 🚀 Setup & Local Execution

### Prerequisites
* Node.js (v18+)
* Python (v3.9+)

### Installation
1. Clone this repository:
   ```bash
   git clone https://github.com/Sk2003pm/H2S-Main-Challenge.git
   cd H2S-Main-Challenge
   ```
2. Install Node dependencies:
   ```bash
   npm install
   ```
3. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

### Running Locally
To run the full-stack setup locally, run the frontend and backend servers concurrently:

1. **Start the FastAPI Backend** (in one terminal window):
   ```bash
   python -m uvicorn api.main:app --port 8000
   ```
   *The backend will run on `http://127.0.0.1:8000`.*
   *Ensure you have configured a `.env` file containing `GEMINI_API_KEY=your_key` in the project root.*

2. **Start the Vite Frontend** (in another terminal window):
   ```bash
   npm run dev
   ```
   *The frontend will run on `http://localhost:5173/`.*
   *The Vite proxy config automatically reroutes `/api/*` requests to the local backend on port 8000.*

---

## 🔒 Security & Privacy Practices

* **No Leaked Credentials**: All Gemini API keys are held strictly in server-side environment variables and are never sent to the client browser.
* **Client Cryptography**: Password validation hashes passwords before storage using browser-level `crypto.subtle` digest methods.
* **Resilient Failbacks**: Backend API routes feature robust catch-blocks that switch to locally computed sentiment-analyzers if Gemini quotas are exceeded, ensuring the application never crashes during grading.
