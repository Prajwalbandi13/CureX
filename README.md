🫁 CureX – AI-Powered Lung Disease Detection System

CureX is an AI-based Lung Disease Detection System that uses Deep Learning and an Agent-Based Architecture to analyze chest X-ray images and detect multiple lung diseases with confidence and severity levels.

This project is developed as a Final Year Engineering Project and demonstrates the complete pipeline from dataset training → backend AI inference → frontend visualization.

🚀 Features

🧠 CNN-based lung disease classification (Transfer Learning)

🤖 Agent-Based Architecture:

Monitoring Agent

Analyzing Agent

Decision Agent

Action Agent

🩺 Detects 5 lung conditions:

Normal

Corona Virus Disease (COVID-19)

Bacterial Pneumonia

Viral Pneumonia

Tuberculosis

📊 Confidence & severity prediction

🌐 REST API using FastAPI

🖥️ Simple and clean frontend UI

📂 Modular, scalable project structure

🧠 System Architecture
User (X-ray Upload)
        ↓
Monitoring Agent
(Input Validation & Preprocessing)
        ↓
Analyzing Agent
(CNN Model Inference)
        ↓
Decision Agent
(Disease + Confidence + Severity)
        ↓
Action Agent
(Response Generation)
        ↓
Frontend Display

🛠️ Technology Stack
🔹 Machine Learning

TensorFlow / Keras

MobileNetV2 (Transfer Learning)

CNN-based image classification

🔹 Backend

Python

FastAPI

Uvicorn

Agent-based modular design

🔹 Frontend

HTML

CSS

JavaScript (Fetch API)

🔹 Dataset

Kaggle Lung Disease Dataset

Chest X-ray images (Train / Validation / Test)

📂 Project Folder Structure
CureX/
│
├── backend/
│   ├── api/
│   │   └── main.py
│   │
│   ├── agents/
│   │   ├── monitoring_agent.py
│   │   ├── analyzing_agent.py
│   │   ├── decision_agent.py
│   │   └── action_agent.py
│   │
│   ├── model/
│   │   ├── train_model.py
│   │   └── trained_model.h5
│   │
│   └── requirements.txt
│
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── script.js
│
├── dataset/        # Used only during training
│
└── README.md

⚙️ Setup & Installation
1️⃣ Clone / Download Project
git clone <project-repo-url>
cd CureX

2️⃣ Install Backend Dependencies
cd backend
pip install -r requirements.txt

3️⃣ Run Backend Server
uvicorn api.main:app --reload


Backend will run at:

http://127.0.0.1:8000


Swagger API Docs:

http://127.0.0.1:8000/docs

4️⃣ Run Frontend

Open frontend/index.html in a browser
OR

Serve via any static server

Upload a chest X-ray image and click Detect Disease.

🧪 Model Training (Optional)

If you want to retrain the model:

cd backend/model
python train_model.py


The trained model will be saved as:

trained_model.h5

📊 Output Example

Disease: Viral Pneumonia

Confidence: 76.09%

Severity: High