import React, { useMemo, useState } from "react";

function PatientForm({ onSubmit }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [age, setAge] = useState("");
  const [city, setCity] = useState("");
  const [previousDisease, setPreviousDisease] = useState("");
  const [symptoms, setSymptoms] = useState([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const ageGroup = useMemo(() => {
    const n = Number(age);
    if (!n || Number.isNaN(n)) return "";
    if (n < 18) return "Pediatric";
    if (n < 60) return "Adult";
    return "Senior";
  }, [age]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const trimmedName = name.trim();
    const numericAge = Number(age);

    if (!trimmedName || !email.trim() || !age || !city.trim()) {
      setError("Please enter patient name, email, age, and city.");
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (Number.isNaN(numericAge) || numericAge < 1 || numericAge > 120) {
      setError("Please enter a valid age between 1 and 120.");
      return;
    }

    try {
      setSubmitting(true);
      await onSubmit({
        name: trimmedName,
        email: normalizedEmail,
        age: numericAge,
        city: city.trim(),
        previousDisease: previousDisease.trim(),
        symptoms,
      });
    } catch (submitError) {
      setError(submitError.message || "Could not continue with this patient profile.");
    } finally {
      setSubmitting(false);
    }
  };

  const symptomOptions = [
    "Fever",
    "Dry Cough",
    "Chest Pain",
    "Breathlessness",
    "Fatigue",
    "Cough with Blood",
    "Low Oxygen",
  ];

  const toggleSymptom = (symptom) => {
    setSymptoms((prev) =>
      prev.includes(symptom) ? prev.filter((s) => s !== symptom) : [...prev, symptom]
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-cyan-50 to-blue-100 p-4 md:p-8 flex items-center justify-center">
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-[1.05fr_1fr] rounded-2xl overflow-hidden shadow-2xl border border-white/60 bg-white/80 backdrop-blur">
        <div className="p-8 md:p-10 bg-gradient-to-br from-emerald-700 to-teal-800 text-white">
          <p className="text-xs uppercase tracking-[0.18em] text-emerald-100/90 mb-3">CureX Intake</p>
          <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-4">Start With Patient Details</h1>
          <p className="text-emerald-100/95 text-sm leading-relaxed mb-6">
            Enter accurate patient information before chest X-ray analysis. This helps personalize risk reasoning and
            track progress in history.
          </p>

          <div className="space-y-3 text-sm">
            <div className="rounded-xl bg-white/15 p-3 border border-white/20">1. Enter patient details carefully.</div>
            <div className="rounded-xl bg-white/15 p-3 border border-white/20">2. Upload chest X-ray and run AI detection.</div>
            <div className="rounded-xl bg-white/15 p-3 border border-white/20">3. Review risk analysis and history timeline.</div>
          </div>
        </div>

        <div className="p-8 md:p-10 bg-white">
          <h2 className="text-2xl font-bold text-slate-800 mb-1">Patient Information</h2>
          <p className="text-sm text-slate-500 mb-6">These details are used for personalized AI risk insights.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Patient Name</label>
              <input
                type="text"
                placeholder="e.g., Rahul Sharma"
                disabled={submitting}
                className="w-full p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                placeholder="e.g., rahul@email.com"
                disabled={submitting}
                className="w-full p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Age</label>
              <input
                type="number"
                min="1"
                max="120"
                placeholder="e.g., 45"
                disabled={submitting}
                className="w-full p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={age}
                onChange={(e) => setAge(e.target.value)}
              />
              {ageGroup && <p className="text-xs text-emerald-700 mt-1">Detected age group: {ageGroup}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
              <input
                type="text"
                placeholder="e.g., Bengaluru"
                disabled={submitting}
                className="w-full p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Previous Disease (optional)</label>
              <input
                type="text"
                placeholder="e.g., Asthma, Diabetes"
                disabled={submitting}
                className="w-full p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={previousDisease}
                onChange={(e) => setPreviousDisease(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Symptom Checker (optional)</label>
              <div className="grid grid-cols-2 gap-2">
                {symptomOptions.map((symptom) => (
                  <button
                    key={symptom}
                    type="button"
                    onClick={() => toggleSymptom(symptom)}
                    disabled={submitting}
                    className={`text-xs px-3 py-2 rounded-lg border transition-colors ${
                      symptoms.includes(symptom)
                        ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {symptom}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-emerald-600 text-white p-3 rounded-lg font-semibold hover:bg-emerald-700 transition-colors disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? "Checking Patient..." : "Continue to Diagnosis"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default PatientForm;
