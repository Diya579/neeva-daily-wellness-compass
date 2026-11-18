# Neeva Daily Wellness Compass

Design inspo - https://www.behance.net/gallery/257764651/InMind-Mental-Health-Branding-App-Web-Design?tracking_source=search_projects|mental+health+app&l=0

You are a master React, Tailwind CSS, and Lucide Icon developer. Build a state-of-the-art, high-fidelity mental wellness web application named **Neeva** ("Mental Wellness Reimagined for Everyone"). 

### 🎨 DESIGN SYSTEM & AESTHETIC (Inspired by "InMind" Mental Health Design)
Apply an ultra-modern, professional, and emotionally soothing visual language that reduces anxiety and feels premium yet accessible:
1. **Color Palette:**
   - **Background:** Warm cream/soft sand (`#FAF7F0` or `#F5F2EB`) as the canvas instead of sterile white.
   - **Primary/Text:** Deep, grounded forest green (`#1A3020` or `#132E27`) for high contrast, readability, and structural elements.
   - **Accents (Soothing Pastels):** 
     - Sage green (`#D4E2D4` / `#A3B899`) for calm and success indicators.
     - Dusty rose/terracotta (`#E8D3C4` / `#D4A373`) for warmth.
     - Soft lilac/periwinkle (`#E2D4F0` / `#CCD2E3`) for mental space and highlights.
2. **Typography:** Use a soft, modern sans-serif font stack (e.g., Plus Jakarta Sans, Instrument Sans, or Inter) with generous line heights and tracking. Headers should be elegant, bold, and welcoming.
3. **UI Elements:** Rounded organic corners (`rounded-2xl` to `rounded-3xl`), spacious margins, subtle card shadows, and frosted-glass blurs (`backdrop-blur`).
4. **Imagery & Icons:** Use Lucide icons styled with dual-tone pastel circular backgrounds. Avoid generic icons; use soft, comforting, and organic visual indicators.

---

### 📱 WEB APP LAYOUT & NAVIGATION
Create a responsive, dual-mode interface (Mobile-first view frame with a toggle to view full-page Desktop Dashboard):
- **User Dashboard (Main Portal):** Simple, uncluttered daily workspace.
- **Sidebar/Bottom Navigation:** 
  1. **Home / Today:** Daily mood check-in, quick exercises, and personalized daily recommendations.
  2. **AI Therapist (Chat):** Live, real-time empathetic conversation portal.
  3. **Journal:** Guided reflective writing with AI insights.
  4. **Behavioral Hub:** Meditations, CBT games, CBT worksheets, and ADHD focus tools.
  5. **Community & Support:** Peer support groups and a clear "Crisis Help" safety button.
  6. **B2B / Employer Portal:** A switchable tab/view demonstrating how corporate HR or universities monitor organizational wellness (aggregate analytics, no individual data leaked to protect privacy).

---

### ⚙️ CORE CORE FUNCTIONAL FEATURES TO BUILD

#### 1. Daily Mood Tracker & Analytics
- Create an interactive "How are you feeling today?" mood slider or grid featuring beautiful, custom-illustrated mood emojis/cards (e.g., Peaceful, Anxious, Joyful, Tired, Overwhelmed).
- After selection, save this to an interactive **Mood History Chart** (weekly/monthly view using Recharts or simple interactive CSS graphs) showing simulated emotional trends and triggers.
- Provide a personalized "AI Wellness Tip" based on the logged mood.

#### 2. Real-Time AI Therapist Chat (Interactive)
- An elegant, messaging interface designed to feel like a premium therapy session.
- Pre-load it with an empathetic, supportive welcome message from "Neeva AI".
- Implement functional interactive chat:
  - Users can type messages (e.g., "I'm feeling burnt out").
  - The AI responds with genuine, multi-paragraph, evidence-based responses simulating CBT (Cognitive Behavioral Therapy) and ACT techniques.
  - Show typing indicators, timestamps, and quick-reply suggestion chips (e.g., "Guide me through a breathing exercise", "Help me reframe this thought").
  - **Language Selector:** Toggle between English and 5 major Indian languages (Hindi, Gujarati, Tamil, Marathi, Bengali) to show localization capability.

#### 3. AI Reflective Journal
- A minimalist, clean writing interface with a choice of daily prompts (e.g., "What went well today?", "Describe a challenge you faced").
- Include a simulated **AI Journal Analysis** engine: when the user finishes writing and clicks "Analyze Entry", show a beautifully styled modal breaking down the entry's emotional tone, key themes, and offering cognitive reframing suggestions.

#### 4. Behavioral Interventions & Focus Hub
Create interactive mini-tools for the user to try:
- **Guided Meditation Player:** A beautiful audio card interface with play/pause controls, a progress bar, and a pulsing, expanding "Breathing Circle" animation to guide 4-7-8 breathing.
- **CBT Thought Record Game/Exercise:** An interactive step-by-step form to help users reframe negative thoughts (Situation -> Automatic Thought -> Challenge -> Realistic Thought).
- **ADHD Focus Tool:** A clean, functional **Pomodoro Timer** themed beautifully with atmospheric sounds toggles (Rain, Forest, Cozy Cafe) and a gamified productivity points tracker.

#### 5. Community & Security (Support Layer)
- **Peer Groups:** Mock feed of anonymous community forums/support groups (e.g., "Anxiety Support", "Campus Wellness", "Corporate Burnout") with search and mock joining capabilities.
- **Crisis Support Action Button:** A highly visible, red/warm-pastel flagged button that immediately triggers a direct-dial overlay showing local helpline numbers (e.g., Vandrevala Foundation, Kiran Helpline) and immediate grounding exercises.
- **Security Indicator:** A small, elegant footer banner highlighting "End-to-End Encrypted | GDPR & HIPAA Compliant Data Privacy".

#### 6. B2B Corporate & University Dashboard Toggle
- Provide an toggle switch in the profile menu: "Switch to Enterprise HR View".
- Present a beautiful executive dashboard showcasing aggregate metrics for an organization (e.g., "Karnavati University" or "Tech Corp").
- Visual graphs showing "Anonymized Engagement Rate", "Average Organization Stress Level Trend", and "Top Accessed Programs (e.g., Sleep Coaching)".

---

### 🚀 INTERACTIVE FLOW & POLISH
- **Welcome / Onboarding flow:** Provide a brief 3-step modern onboarding carousel when the user first loads the app, asking for their primary goal (e.g., Manage Stress, Improve Focus, Find Community) and personalize the dashboard immediately.
- Use smooth CSS transitions (`transition-all duration-300`) on hover, button presses, and tab switches.
- Fill all UI cards with realistic, compassionate copy instead of raw lorem ipsum. Refer specifically to "Neeva" as the modern, ₹99/month, democratized Indian wellness solution.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://neeva-daily-wellness-compass.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/9af96d77-d8fa-461e-9a8f-9c60c9a9f9c0).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
