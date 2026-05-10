import os
import sqlite3
from datetime import datetime
from typing import Any, Dict, List


DB_PATH = os.path.join(os.path.dirname(__file__), "curex.db")


def _get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with _get_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS patient_profiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                patient_name TEXT NOT NULL,
                patient_email TEXT NOT NULL UNIQUE,
                age INTEGER NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS scan_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                patient_name TEXT NOT NULL,
                patient_email TEXT,
                age INTEGER NOT NULL,
                previous_disease TEXT,
                symptoms TEXT,
                predicted_disease TEXT NOT NULL,
                confidence REAL NOT NULL,
                severity TEXT NOT NULL,
                risk_level TEXT,
                recommendation_summary TEXT
            )
            """
        )
        columns = [row["name"] for row in conn.execute("PRAGMA table_info(scan_history)").fetchall()]
        if "patient_email" not in columns:
            conn.execute("ALTER TABLE scan_history ADD COLUMN patient_email TEXT")
        if "symptoms" not in columns:
            conn.execute("ALTER TABLE scan_history ADD COLUMN symptoms TEXT")

        history_rows = conn.execute(
            """
            SELECT patient_name, patient_email, age, MAX(id) AS latest_id
            FROM scan_history
            WHERE patient_email IS NOT NULL AND TRIM(patient_email) != ''
            GROUP BY LOWER(patient_email)
            ORDER BY latest_id ASC
            """
        ).fetchall()
        for row in history_rows:
            conn.execute(
                """
                INSERT OR IGNORE INTO patient_profiles (created_at, patient_name, patient_email, age)
                VALUES (?, ?, ?, ?)
                """,
                (
                    datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
                    (row["patient_name"] or "").strip(),
                    (row["patient_email"] or "").strip().lower(),
                    int(row["age"]),
                ),
            )
        conn.commit()


def reserve_patient_profile(*, patient_name: str, patient_email: str, age: int) -> Dict[str, Any] | None:
    normalized_name = (patient_name or "").strip()
    normalized_email = (patient_email or "").strip().lower()

    if not normalized_name or not normalized_email:
        return None

    with _get_connection() as conn:
        row = conn.execute(
            """
            SELECT id, patient_name, patient_email, age
            FROM patient_profiles
            WHERE LOWER(patient_email) = LOWER(?)
            LIMIT 1
            """,
            (normalized_email,),
        ).fetchone()

        if row:
            stored_name = (row["patient_name"] or "").strip().lower()
            if stored_name != normalized_name.lower():
                return dict(row)
            return None

        conn.execute(
            """
            INSERT INTO patient_profiles (created_at, patient_name, patient_email, age)
            VALUES (?, ?, ?, ?)
            """,
            (
                datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
                normalized_name,
                normalized_email,
                int(age),
            ),
        )
        conn.commit()

    return None


def save_scan_record(
    *,
    patient_name: str,
    patient_email: str,
    age: int,
    previous_disease: str,
    symptoms: str,
    predicted_disease: str,
    confidence: float,
    severity: str,
    risk_level: str,
    recommendation_summary: str,
) -> None:
    with _get_connection() as conn:
        conn.execute(
            """
            INSERT INTO scan_history (
                created_at,
                patient_name,
                patient_email,
                age,
                previous_disease,
                symptoms,
                predicted_disease,
                confidence,
                severity,
                risk_level,
                recommendation_summary
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
                patient_name.strip(),
                (patient_email or "").strip().lower(),
                int(age),
                (previous_disease or "").strip(),
                (symptoms or "").strip(),
                predicted_disease,
                float(confidence),
                severity,
                risk_level,
                recommendation_summary,
            ),
        )
        conn.commit()


def get_patient_history(
    patient_name: str,
    patient_email: str,
    age: int,
    limit: int = 20
) -> List[Dict[str, Any]]:
    normalized_name = (patient_name or "").strip()
    normalized_email = (patient_email or "").strip().lower()
    if not normalized_name or not normalized_email:
        return []

    with _get_connection() as conn:
        rows = conn.execute(
            """
            SELECT
                id,
                created_at,
                patient_name,
                patient_email,
                age,
                previous_disease,
                symptoms,
                predicted_disease,
                confidence,
                severity,
                risk_level,
                recommendation_summary
            FROM scan_history
            WHERE LOWER(patient_name) = LOWER(?)
              AND LOWER(patient_email) = LOWER(?)
            ORDER BY datetime(created_at) DESC, id DESC
            LIMIT ?
            """,
            (normalized_name, normalized_email, int(limit)),
        ).fetchall()

    return [dict(row) for row in rows]


def find_patient_conflict(patient_name: str, patient_email: str, age: int) -> Dict[str, Any] | None:
    return reserve_patient_profile(
        patient_name=patient_name,
        patient_email=patient_email,
        age=age,
    )


