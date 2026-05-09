from typing import Any, Dict, List

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

from agents.monitoring_agent import MonitoringAgent
from agents.analyzing_agent import AnalyzingAgent
from agents.decision_agent import DecisionAgent
from agents.action_agent import ActionAgent
from agents.chat_agent import ChatAgent
from db.history_store import init_db, save_scan_record, get_patient_history, find_patient_conflict


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    patient_name: str
    patient_email: str
    age: int
    previous_disease: str = ""
    symptoms: List[str] = []
    current_result: Dict[str, Any] | None = None
    user_message: str
    messages: List[ChatMessage] = []


app = FastAPI(
    title="CureX - Lung Disease Detection System",
    description="Agent-based AI system for lung disease detection using Chest X-rays",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

try:
    analyzing_agent = AnalyzingAgent()
    monitoring_agent = MonitoringAgent(
        img_size=analyzing_agent.input_size,
        preprocessing_fn=analyzing_agent.preprocessing_fn,
    )
    decision_agent = DecisionAgent()
    action_agent = ActionAgent()
    chat_agent = ChatAgent()
    init_db()
except Exception as e:
    raise RuntimeError(f"Agent initialization failed: {str(e)}")


def _patient_conflict_detail(conflict: dict) -> str:
    stored_name = conflict.get("patient_name", "this patient")
    stored_age = conflict.get("age", "N/A")
    return (
        "This email is already registered to another patient profile "
        f"({stored_name}, age {stored_age}). Please use a unique email for each patient."
    )


@app.get("/")
def root():
    return {
        "status": "CureX backend running",
        "message": "Agent-based Lung Disease Detection API is live",
    }


@app.post("/detect")
async def detect_lung_disease(
    file: UploadFile = File(...),
    patient_name: str = Form(...),
    patient_email: str = Form(...),
    age: int = Form(...),
    previous_disease: str = Form(""),
    symptoms: str = Form(""),
):
    try:
        conflict = find_patient_conflict(patient_name=patient_name, patient_email=patient_email, age=age)
        if conflict:
            raise HTTPException(status_code=409, detail=_patient_conflict_detail(conflict))

        image = monitoring_agent.process(file)
        predictions = analyzing_agent.analyze(image)
        decision = decision_agent.decide(predictions)

        patient_context = {
            "age": age,
            "previous_disease": previous_disease,
            "symptoms": symptoms,
        }
        response = action_agent.act(decision, patient_context)
        risk_analysis = response.get("Risk Analysis", {}) or {}
        recommendations = risk_analysis.get("Recommendations", [])
        recommendation_summary = "; ".join(recommendations[:2]) if isinstance(recommendations, list) else ""

        save_scan_record(
            patient_name=patient_name,
            patient_email=patient_email,
            age=age,
            previous_disease=previous_disease,
            symptoms=symptoms,
            predicted_disease=response.get("Predicted Disease", "Unknown"),
            confidence=float(response.get("Confidence", 0.0)),
            severity=response.get("Severity (AI-estimated)", "Unknown"),
            risk_level=risk_analysis.get("Risk Level", "Unknown"),
            recommendation_summary=recommendation_summary,
        )

        response["History"] = get_patient_history(
            patient_name=patient_name,
            patient_email=patient_email,
            age=age,
            limit=20,
        )

        return response

    except HTTPException:
        raise
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except FileNotFoundError as fe:
        raise HTTPException(status_code=500, detail=str(fe))
    except RuntimeError as re:
        raise HTTPException(status_code=500, detail=str(re))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@app.post("/chat")
def chat(request: ChatRequest):
    try:
        conflict = find_patient_conflict(
            patient_name=request.patient_name,
            patient_email=request.patient_email,
            age=request.age,
        )
        if conflict:
            raise HTTPException(status_code=409, detail=_patient_conflict_detail(conflict))

        history = get_patient_history(
            patient_name=request.patient_name,
            patient_email=request.patient_email,
            age=request.age,
            limit=10,
        )
        patient = {
            "patient_name": request.patient_name,
            "patient_email": request.patient_email,
            "age": request.age,
            "previous_disease": request.previous_disease,
            "symptoms": request.symptoms,
        }
        result = chat_agent.respond(
            patient=patient,
            history=history,
            current_result=request.current_result or {},
            user_message=request.user_message,
            messages=[msg.model_dump() for msg in request.messages],
        )
        result["history_context"] = history[:5]
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@app.get("/history")
def history(patient_name: str, patient_email: str, age: int, limit: int = 20):
    try:
        conflict = find_patient_conflict(patient_name=patient_name, patient_email=patient_email, age=age)
        if conflict:
            raise HTTPException(status_code=409, detail=_patient_conflict_detail(conflict))

        return {
            "patient_name": patient_name,
            "history": get_patient_history(
                patient_name=patient_name,
                patient_email=patient_email,
                age=age,
                limit=limit,
            ),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
