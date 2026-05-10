# CureX - AI-Powered Lung Disease Detection System

CureX is an AI-assisted lung disease detection project that analyzes chest X-ray images and returns a predicted lung condition, confidence score, estimated severity, risk analysis, Grad-CAM heatmap, patient history, and educational medical guidance.

The project combines a FastAPI backend, trained deep-learning models, an agent-based inference pipeline, a React frontend, and an optional Gemini-powered healthcare chat assistant.

> Disclaimer: CureX is an educational final-year engineering project. It is not a replacement for professional medical diagnosis, treatment, or emergency care.

## Features

- Chest X-ray disease classification using CNN transfer-learning models.
- Agent-based backend pipeline:
  - Monitoring Agent for upload validation and preprocessing.
  - Analyzing Agent for model inference and Grad-CAM heatmap generation.
  - Decision Agent for prediction, confidence, reliability, and severity.
  - Action Agent for user-facing output, risk analysis, and guidance.
  - Chat Agent for healthcare-only follow-up support.
- Detects five classes:
  - Bacterial Pneumonia
  - Corona Virus Disease
  - Normal
  - Tuberculosis
  - Viral Pneumonia
- Patient intake with name, email, age, city, previous disease, and symptoms.
- Patient scan history and timeline.
- Live insights with confidence trends, risk trends, and disease distribution.
- PDF report generation from the frontend.
- Optional Gemini integration for richer explanations and chat responses.
- FastAPI Swagger documentation.
- Vite + React frontend styled with Tailwind CSS.

## Tech Stack

### Machine Learning

- TensorFlow / Keras
- EfficientNet, MobileNetV2, and NASNetMobile training folders
- OpenCV
- NumPy
- Pillow
- Scikit-learn

### Backend

- Python
- FastAPI
- Uvicorn
- python-multipart
- python-dotenv
- google-genai

### Frontend

- React 18
- Vite
- Tailwind CSS
- jsPDF

## Project Structure

```text
CureX/
|-- backend/
|   |-- api/
|   |   `-- main.py
|   |-- agents/
|   |   |-- monitoring_agent.py
|   |   |-- analyzing_agent.py
|   |   |-- decision_agent.py
|   |   |-- action_agent.py
|   |   `-- chat_agent.py
|   |-- EfficientNet/
|   |   |-- train.py
|   |   |-- e_v.py
|   |   |-- trained_model.h5
|   |   |-- best_model.h5
|   |   |-- latest_model.h5
|   |   |-- confusion_matrix.png
|   |   |-- roc_curve.png
|   |   `-- evaluation_rt.txt
|   |-- MobileNet/
|   |   |-- train.py
|   |   |-- e_v.py
|   |   |-- trained_mobilenetv2.h5
|   |   |-- best_mobilenetv2.h5
|   |   |-- latest_mobilenetv2.h5
|   |   |-- confusion_matx.png
|   |   |-- roc_cur.png
|   |   `-- evaluation_rt.txt
|   |-- NASNetMobile/
|   |   |-- train.py
|   |   |-- e_v.py
|   |   |-- trained_nasnetmobile.h5
|   |   |-- best_nasnetmobile.h5
|   |   |-- latest_nasnetmobile.h5
|   |   |-- confusion_matrix_nasnetmobile.png
|   |   |-- roc_curve_nasnetmobile.png
|   |   `-- evaluation_nasnetmobile.txt
|   `-- requirements.txt
|-- frontend/
|   |-- src/
|   |   |-- App.jsx
|   |   |-- PatientForm.jsx
|   |   |-- ChatAssistant.jsx
|   |   |-- main.jsx
|   |   `-- index.css
|   |-- index.html
|   |-- package.json
|   |-- tailwind.config.js
|   `-- postcss.config.js
|-- dataset/
`-- README.md
```

## Dataset

The dataset is intentionally not committed because it is large.

Download it from Kaggle:

```text
https://www.kaggle.com/datasets/omkarmanohardalvi/lungs-disease-dataset-4-types
```

After extraction, place it inside the project `dataset/` folder. The expected dataset layout is:

```text
dataset/
|-- train/
|-- test/
`-- val/
```

## Backend Setup

From the project root:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Optional Gemini support:

Create `backend/.env` and add your API key:

```env
GEMINI_API_KEY=your_api_key_here
```

If `GEMINI_API_KEY` is not configured, CureX still runs with built-in fallback responses for guidance, risk analysis, and chat.

## Model Setup

The current backend inference code loads this model path:

```text
backend/Best/trained_model.h5
```

If your preferred trained model is in `backend/EfficientNet/trained_model.h5`, create a `backend/Best/` folder and place or copy the selected model there as `trained_model.h5`.

The inference class labels must match the training order:

```text
Bacterial Pneumonia
Corona Virus Disease
Normal
Tuberculosis
Viral Pneumonia
```

## Run the Backend

From the `backend/` directory:

```bash
uvicorn api.main:app --reload
```

Backend URL:

```text
http://127.0.0.1:8000
```

Swagger API docs:

```text
http://127.0.0.1:8000/docs
```

## Frontend Setup

Open a new terminal from the project root:

```bash
cd frontend
npm install
npm run dev
```

The Vite app usually runs at:

```text
http://127.0.0.1:5173
```

Keep the FastAPI backend running at `http://127.0.0.1:8000` while using the frontend.

## API Endpoints

### Health Check

```http
GET /
```

Returns backend status.

### Disease Detection

```http
POST /detect
```

Multipart form fields:

- `file`: chest X-ray image file
- `patient_name`: patient name
- `patient_email`: patient email
- `age`: patient age
- `previous_disease`: optional previous disease details
- `symptoms`: optional comma-separated symptom list

Returns:

- predicted disease
- confidence
- AI-estimated severity
- educational medical guidance
- risk analysis
- Grad-CAM heatmap
- patient scan history

### Patient History

```http
GET /history?patient_name=...&patient_email=...&age=...&limit=20
```

Returns saved scan history for the patient profile.

### CureBot Chat

```http
POST /chat
```

Accepts patient context, current result, previous messages, and a user message. Returns a healthcare-only assistant response and suggested follow-up questions.

## Model Training

Each model folder contains its own training and evaluation scripts.

Example:

```bash
cd backend/EfficientNet
python train.py
python e_v.py
```

Available model folders:

- `backend/EfficientNet/`
- `backend/MobileNet/`
- `backend/NASNetMobile/`

After training, make sure the backend inference path points to the model you want to serve.

## Example Output

```text
Predicted Disease: Viral Pneumonia
Confidence: 76.09%
Severity: High
Risk Level: High
Medical Guidance: Educational guidance and recommended next diagnostic step
```

## Troubleshooting

### `trained_model.h5 not found`

The backend currently expects:

```text
backend/Best/trained_model.h5
```

Create that folder and place the selected `.h5` model file there, or update `backend/agents/analyzing_agent.py` to load your preferred model path.

### `ModuleNotFoundError: No module named 'db'`

`backend/api/main.py` imports patient history helpers from `db.history_store`. Make sure the `backend/db/history_store.py` module exists before running the backend.

### `ModuleNotFoundError: No module named 'model'`

`backend/agents/analyzing_agent.py` imports Grad-CAM helpers from `model.gradcam`. Make sure the `backend/model/gradcam.py` module exists before running heatmap generation.

### Frontend cannot connect to backend

Confirm FastAPI is running at:

```text
http://127.0.0.1:8000
```

The frontend currently calls this backend URL directly.

## Notes

- Use clear chest X-ray images in PNG or JPEG format.
- Do not use CureX as a clinical decision system.
- Always consult a qualified healthcare professional for diagnosis and treatment.
