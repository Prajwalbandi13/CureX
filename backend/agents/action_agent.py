import json
import os
from datetime import datetime

from google import genai


class ActionAgent:
    """
    Action Agent:
    - Generates user-friendly response
    - Adds Gemini explanation
    - Adds Gemini-based risk analysis with patient context
    """

    def __init__(self):
        self.client = None
        self.model_name = "models/gemini-2.5-flash"

        api_key = os.getenv("GEMINI_API_KEY")
        if api_key:
            try:
                self.client = genai.Client(api_key=api_key)
            except Exception as e:
                print("Gemini client init failed:", e)

    def _normalize_symptoms(self, symptoms):
        if isinstance(symptoms, str):
            items = [item.strip() for item in symptoms.split(",")]
            return [item for item in items if item]
        if isinstance(symptoms, (list, tuple, set)):
            return [str(item).strip() for item in symptoms if str(item).strip()]
        return []

    def _default_risk_analysis(self, age, previous_disease, symptoms, disease, confidence):
        normalized_symptoms = self._normalize_symptoms(symptoms)
        symptom_set = {item.lower() for item in normalized_symptoms}

        risk_level = "Medium" if confidence >= 40 else "Low"
        if age >= 60 or previous_disease.strip():
            risk_level = "High" if confidence >= 60 else "Medium"
        if "low oxygen" in symptom_set or "cough with blood" in symptom_set:
            risk_level = "High"
        elif {"chest pain", "breathlessness"}.issubset(symptom_set):
            risk_level = "High" if confidence >= 40 else "Medium"
        elif normalized_symptoms and risk_level == "Low":
            risk_level = "Medium"

        age_impact = (
            "Age may increase vulnerability to respiratory complications."
            if age >= 60
            else "Age alone is not a major risk amplifier in this assessment."
        )

        previous_impact = (
            "Existing medical history may increase severity and recovery time."
            if previous_disease.strip()
            else "No previous disease history provided."
        )

        possible_contribution = (
            f"Previous condition ({previous_disease}) could contribute to the current lung condition."
            if previous_disease.strip()
            else "No direct previous-disease contribution identified from provided context."
        )

        symptom_impact = (
            f"Reported symptoms ({', '.join(normalized_symptoms)}) increase the need for clinical correlation."
            if normalized_symptoms
            else "No symptom history was provided for additional risk adjustment."
        )
        if "low oxygen" in symptom_set:
            symptom_impact = "Reported low oxygen is a high-risk symptom that can indicate significant respiratory compromise."
        elif "cough with blood" in symptom_set:
            symptom_impact = "Reported cough with blood is a red-flag symptom requiring urgent medical review."
        elif {"chest pain", "breathlessness"}.issubset(symptom_set):
            symptom_impact = "The combination of chest pain and breathlessness raises concern for more serious respiratory involvement."

        recommendations = [
            "Consult a pulmonologist for clinical correlation.",
            "Repeat imaging or blood tests if symptoms worsen.",
            "Follow physician advice and avoid self-medication.",
        ]
        if normalized_symptoms:
            recommendations.insert(1, "Discuss the reported symptoms in detail during the clinical review.")
        if "low oxygen" in symptom_set or "cough with blood" in symptom_set:
            recommendations[0] = "Seek urgent in-person medical evaluation, especially if symptoms are active now."

        return {
            "Risk Level": risk_level,
            "Age Impact": age_impact,
            "Previous Disease Impact": previous_impact,
            "Symptom Impact": symptom_impact,
            "Possible Contribution": possible_contribution,
            "Recommendations": recommendations,
        }

    def _generate_risk_analysis(self, age, previous_disease, symptoms, disease, confidence):
        fallback = self._default_risk_analysis(
            age=age,
            previous_disease=previous_disease,
            symptoms=symptoms,
            disease=disease,
            confidence=confidence,
        )

        if not self.client:
            return fallback

        try:
            prompt = f"""
You are a medical AI reasoning assistant for educational risk stratification.
Input:
- Age: {age}
- Previous disease: {previous_disease or "None"}
- Reported symptoms: {", ".join(self._normalize_symptoms(symptoms)) or "None"}
- Predicted lung disease: {disease}
- Model confidence percent: {confidence}

Return STRICT JSON only with this schema:
{{
  "Risk Level": "Low|Medium|High",
  "Age Impact": "text",
  "Previous Disease Impact": "text",
  "Symptom Impact": "text",
  "Possible Contribution": "text",
  "Recommendations": ["point1", "point2", "point3"]
}}
Keep language concise and clinically cautious. No markdown.
"""
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
            if not isinstance(parsed, dict):
                return fallback

            if not isinstance(parsed.get("Recommendations"), list):
                parsed["Recommendations"] = fallback["Recommendations"]

            for key in [
                "Risk Level",
                "Age Impact",
                "Previous Disease Impact",
                "Symptom Impact",
                "Possible Contribution",
            ]:
                if key not in parsed or not parsed[key]:
                    parsed[key] = fallback[key]

            if parsed["Risk Level"] not in {"Low", "Medium", "High"}:
                parsed["Risk Level"] = fallback["Risk Level"]

            return parsed

        except Exception as e:
            print("Gemini risk analysis unavailable:", e)
            return fallback

    def act(self, decision, patient_context=None):
        disease = decision.get("Predicted Disease", "Unknown")
        confidence = decision.get("Confidence (%)", "N/A")
        severity = decision.get("Severity Level", "N/A")
        heatmap = decision.get("heatmap")

        patient_context = patient_context or {}
        age = int(patient_context.get("age", 0))
        previous_disease = str(patient_context.get("previous_disease", "")).strip()
        symptoms = self._normalize_symptoms(patient_context.get("symptoms", ""))

        explanation = (
            f"Possible Symptoms: Symptoms vary depending on severity of {disease}.\n"
            "Precautions: Avoid smoking, maintain hygiene, stay hydrated.\n"
            "Recommended Next Diagnostic Step: Consult a healthcare professional."
        )

        if self.client:
            try:
                prompt = f"""
Provide GENERAL EDUCATIONAL information about {disease}.
No diagnosis or treatment.
Simple language.

Format:
Possible Symptoms:
Precautions:
Recommended Next Diagnostic Step:
"""
                response = self.client.models.generate_content(
                    model=self.model_name,
                    contents=prompt,
                )

                if response and response.text:
                    explanation = response.text.strip()

            except Exception as e:
                print("Gemini guidance unavailable:", e)

        risk_analysis = self._generate_risk_analysis(
            age=age,
            previous_disease=previous_disease,
            symptoms=symptoms,
            disease=disease,
            confidence=float(confidence) if confidence != "N/A" else 0.0,
        )

        return {
            "Timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "Predicted Disease": disease,
            "Confidence": confidence,
            "Severity (AI-estimated)": severity,
            "Medical Guidance": explanation,
            "Risk Analysis": risk_analysis,
            "heatmap": heatmap,
            "Disclaimer": (
                "This is an AI-assisted educational tool. "
                "It does not replace professional medical advice."
            ),
        }
