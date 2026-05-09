import json
import os
from typing import Any, Dict, List

from google import genai


class ChatAgent:
    """Healthcare-only chat assistant backed by Gemini with safe fallbacks."""

    def __init__(self):
        self.client = None
        self.model_name = "models/gemini-2.5-flash"

        api_key = os.getenv("GEMINI_API_KEY")
        if api_key:
            try:
                self.client = genai.Client(api_key=api_key)
            except Exception as e:
                print("Gemini chat client init failed:", e)

    def _history_summary(self, history: List[Dict[str, Any]]) -> str:
        if not history:
            return "No previous scan history available."
        recent = history[:5]
        parts = []
        for item in recent:
            disease = item.get("predicted_disease", "Unknown")
            confidence = item.get("confidence", 0)
            risk = item.get("risk_level", "Unknown")
            created_at = item.get("created_at", "Unknown date")
            parts.append(f"{created_at}: {disease} ({confidence}% confidence, risk {risk})")
        return " | ".join(parts)

    def _starter_questions(self, has_current_result: bool, disease: str = "") -> List[str]:
        if has_current_result:
            topic = disease or "this result"
            return [
                f"What does the {topic} result mean in simple words?",
                "Which symptoms should make me seek urgent medical care right now?",
                "What follow-up tests or doctor visits are usually needed next?",
            ]
        return [
            "What patterns do you notice in my previous lung scan history?",
            "Which symptoms should I track before uploading a new chest X-ray?",
            "How can I prepare useful information for the next doctor follow-up?",
        ]

    def _fallback_reply(
        self,
        *,
        user_message: str,
        has_current_result: bool,
        current_result: Dict[str, Any],
        history: List[Dict[str, Any]],
    ) -> str:
        lowered = (user_message or "").lower()
        if not any(word in lowered for word in [
            "health", "disease", "lung", "x-ray", "doctor", "symptom", "medicine", "risk", "breath", "cough", "fever", "oxygen", "tuberculosis", "pneumonia", "covid",
        ]):
            return (
                "I can only help with healthcare questions related to symptoms, lung disease, chest X-rays, follow-up care, and your CureX results. "
                "Please ask a health-related question."
            )

        if has_current_result:
            disease = current_result.get("Predicted Disease", "your current result")
            confidence = current_result.get("Confidence", "N/A")
            severity = current_result.get("Severity (AI-estimated)", "N/A")
            return (
                f"Your current CureX result suggests {disease} with confidence {confidence}% and severity {severity}. "
                "Use this as educational guidance only, monitor symptoms closely, and follow up with a qualified doctor for diagnosis and treatment decisions."
            )

        if history:
            latest = history[0]
            return (
                f"Your latest available scan history shows {latest.get('predicted_disease', 'Unknown')} with risk level {latest.get('risk_level', 'Unknown')}. "
                "Before your next scan, note symptoms such as fever, cough, breathlessness, chest pain, and oxygen issues, and share them with your clinician."
            )

        return (
            "I can help with healthcare questions about symptoms, chest X-rays, lung disease risk, and follow-up steps. "
            "Since there is no current result or history yet, tell me about symptoms or what you want to understand before the next scan."
        )

    def respond(
        self,
        *,
        patient: Dict[str, Any],
        history: List[Dict[str, Any]],
        current_result: Dict[str, Any] | None,
        user_message: str,
        messages: List[Dict[str, str]] | None = None,
    ) -> Dict[str, Any]:
        current_result = current_result or {}
        history = history or []
        messages = messages or []
        has_current_result = bool(current_result.get("Predicted Disease"))
        starter_questions = self._starter_questions(
            has_current_result=has_current_result,
            disease=current_result.get("Predicted Disease", ""),
        )

        if not self.client:
            return {
                "reply": self._fallback_reply(
                    user_message=user_message,
                    has_current_result=has_current_result,
                    current_result=current_result,
                    history=history,
                ),
                "suggested_questions": starter_questions,
            }

        chat_history = "\n".join(
            f"{msg.get('role', 'user')}: {msg.get('content', '')}" for msg in messages[-8:]
        ) or "No prior chat messages."

        patient_summary = json.dumps(
            {
                "name": patient.get("patient_name"),
                "email": patient.get("patient_email"),
                "age": patient.get("age"),
                "previous_disease": patient.get("previous_disease"),
                "symptoms": patient.get("symptoms") or [],
            }
        )
        current_summary = json.dumps(current_result or {})
        history_summary = self._history_summary(history)

        prompt = f"""
You are CureBot, a healthcare-only assistant inside the CureX lung disease detection app.
Rules:
- Answer only healthcare-related questions, especially symptoms, chest X-rays, lung disease, follow-up care, scan history, and doctor consultation prep.
- If the user asks about anything outside healthcare, politely refuse and redirect to healthcare topics.
- Do not claim to be a doctor.
- Do not give a final diagnosis, prescriptions, or definitive treatment instructions.
- Keep responses supportive, concise, and practical.
- Mention urgent in-person care when red-flag symptoms such as low oxygen, coughing blood, severe chest pain, or worsening breathlessness are relevant.
- End with a short disclaimer that this is educational support only.

Patient context: {patient_summary}
Current result available: {has_current_result}
Current result details: {current_summary}
Past scan history summary: {history_summary}
Recent chat history:
{chat_history}

User question: {user_message}

Also produce three short follow-up questions that fit this exact case.
If current result is available, tailor them to the current result.
If current result is not available, tailor them to the past history and next-step preparation.

Return STRICT JSON only:
{{
  "reply": "text",
  "suggested_questions": ["q1", "q2", "q3"]
}}
"""

        try:
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt,
            )
            text = (response.text or "").strip() if response else ""
            if text.startswith("```"):
                text = text.strip("`")
                if text.lower().startswith("json"):
                    text = text[4:].strip()
            parsed = json.loads(text)
            reply = parsed.get("reply") or self._fallback_reply(
                user_message=user_message,
                has_current_result=has_current_result,
                current_result=current_result,
                history=history,
            )
            questions = parsed.get("suggested_questions")
            if not isinstance(questions, list) or len(questions) != 3:
                questions = starter_questions
            return {
                "reply": reply,
                "suggested_questions": [str(item) for item in questions[:3]],
            }
        except Exception as e:
            print("Gemini chat unavailable:", e)
            return {
                "reply": self._fallback_reply(
                    user_message=user_message,
                    has_current_result=has_current_result,
                    current_result=current_result,
                    history=history,
                ),
                "suggested_questions": starter_questions,
            }

