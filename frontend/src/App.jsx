import React, { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import PatientForm from "./PatientForm";
import ChatAssistant from "./ChatAssistant";

function App() {
  const [patient, setPatient] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState("diagnosis");
  const [showHistoryPage, setShowHistoryPage] = useState(false);
  const [showInsightsPage, setShowInsightsPage] = useState(false);
  const [liveNow, setLiveNow] = useState(new Date());

  const [preview, setPreview] = useState(null);
  const [disease, setDisease] = useState("");
  const [confidence, setConfidence] = useState("");
  const [severity, setSeverity] = useState("");
  const [guidance, setGuidance] = useState("");
  const [riskAnalysis, setRiskAnalysis] = useState(null);
  const [heatmap, setHeatmap] = useState(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");

  const getPatientQuery = (patientRecord, limit = 30) =>
    new URLSearchParams({
      patient_name: patientRecord.name,
      patient_email: patientRecord.email,
      age: String(patientRecord.age),
      limit: String(limit),
    }).toString();

  const numericConfidence = useMemo(() => {
    const val = Number(confidence);
    if (Number.isNaN(val)) return 0;
    return Math.max(0, Math.min(100, val));
  }, [confidence]);

  const historyStats = useMemo(() => {
    if (!history.length) {
      return {
        totalScans: 0,
        avgConfidence: 0,
        highRiskCount: 0,
        topDisease: "N/A",
      };
    }

    const avgConfidence =
      history.reduce((sum, item) => sum + Number(item.confidence || 0), 0) / history.length;
    const highRiskCount = history.filter((item) => (item.risk_level || "").toLowerCase() === "high").length;

    const diseaseCount = history.reduce((acc, item) => {
      const key = item.predicted_disease || "Unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const topDisease = Object.entries(diseaseCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

    return {
      totalScans: history.length,
      avgConfidence,
      highRiskCount,
      topDisease,
    };
  }, [history]);

  const chartSeries = useMemo(() => {
    const sorted = [...history].sort((a, b) => {
      const aTime = new Date(String(a.created_at || "").replace(" ", "T")).getTime();
      const bTime = new Date(String(b.created_at || "").replace(" ", "T")).getTime();
      return aTime - bTime;
    });

    const confidencePoints = sorted.slice(-10).map((entry, idx) => ({
      x: idx,
      y: Number(entry.confidence || 0),
      label: entry.created_at,
    }));

    const riskMap = { Low: 1, Medium: 2, High: 3 };
    const riskPoints = sorted.slice(-10).map((entry, idx) => ({
      x: idx,
      y: riskMap[entry.risk_level] || 0,
      label: entry.created_at,
    }));

    return { confidencePoints, riskPoints };
  }, [history]);

  const diseaseDistribution = useMemo(() => {
    const map = history.reduce((acc, item) => {
      const key = item.predicted_disease || "Unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(map)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [history]);

  const fetchHistory = async (patientRecord) => {
    if (!patientRecord?.name || !patientRecord?.email || !patientRecord?.age) return;

    setHistoryLoading(true);
    setHistoryError("");

    try {
      const response = await fetch(`http://127.0.0.1:8000/history?${getPatientQuery(patientRecord)}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || `History API failed with ${response.status}`);
      }

      const data = await response.json();
      setHistory(data.history || []);
    } catch (err) {
      console.error(err);
      setHistoryError(err.message || "Could not load timeline history.");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (!patient?.name || !patient?.email || !patient?.age) return;
    fetchHistory(patient);
  }, [patient]);

  useEffect(() => {
    const timer = setInterval(() => {
      setLiveNow(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handlePatientSubmit = async (patientRecord) => {
    const response = await fetch(`http://127.0.0.1:8000/history?${getPatientQuery(patientRecord)}`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.detail || "Could not validate patient details.");
    }

    setPatient(patientRecord);
  };

  if (!patient) {
    return <PatientForm onSubmit={handlePatientSubmit} />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();

    const file = e.target.image.files[0];
    if (!file) {
      alert("Please select an image");
      return;
    }

    setPreview(URL.createObjectURL(file));
    setHeatmap(null);
    setShowHeatmap(false);
    setRiskAnalysis(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("patient_name", patient.name);
    formData.append("patient_email", patient.email);
    formData.append("age", String(patient.age));
    formData.append("previous_disease", patient.previousDisease || "");
    formData.append("symptoms", (patient.symptoms || []).join(", "));

    try {
      const response = await fetch("http://127.0.0.1:8000/detect", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || `Backend responded with ${response.status}`);
      }

      const data = await response.json();

      setDisease(data["Predicted Disease"] || "");
      setConfidence(data["Confidence"] || "");
      setSeverity(data["Severity (AI-estimated)"] || "");
      setGuidance(data["Medical Guidance"] || "");
      setRiskAnalysis(data["Risk Analysis"] || null);
      setHistory(data["History"] || []);

      if (data.heatmap) {
        setHeatmap(`data:image/jpeg;base64,${data.heatmap}`);
      }
    } catch (err) {
      console.error(err);
      alert(err.message || "Backend error");
    }
  };

  const generatePDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("CureX AI Medical Report", 20, 20);

    doc.setFontSize(12);
    doc.text(`Patient: ${patient.name}`, 20, 35);
    doc.text(`Email: ${patient.email}`, 20, 45);
    doc.text(`Age: ${patient.age}`, 20, 55);
    doc.text(`City: ${patient.city || "N/A"}`, 20, 65);
    doc.text(`Previous Disease: ${patient.previousDisease || "None"}`, 20, 75);

    doc.text(`Disease: ${disease}`, 20, 90);
    doc.text(`Confidence: ${confidence}%`, 20, 100);
    doc.text(`Severity: ${severity}`, 20, 110);

    if (riskAnalysis) {
      doc.text(`Risk Level: ${riskAnalysis["Risk Level"] || "N/A"}`, 20, 125);
    }

    doc.save("CureX_Report.pdf");
  };

  function formatGuidance(text) {
    if (!text) return "";

    return text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n\s*\*\s+/g, "<li>")
      .replace(/(<li>.*)/g, "<ul>$1</ul>")
      .replace(/\n/g, "<br>");
  }

  function getRiskWarning() {
    let warning = "";

    if (Number(patient.age) > 60) {
      warning += "Patients above 60 have higher lung disease risk. ";
    }

    if (
      patient.previousDisease &&
      (patient.previousDisease.toLowerCase().includes("diabetes") ||
        patient.previousDisease.toLowerCase().includes("asthma") ||
        patient.previousDisease.toLowerCase().includes("heart"))
    ) {
      warning += "Existing medical conditions may worsen lung disease severity. ";
    }

    if ((patient.symptoms || []).includes("Breathlessness")) {
      warning += "Breathlessness reported; monitor oxygen and seek care if worsening.";
    }

    return warning.trim();
  }

  function hasEmergencySymptoms() {
    const symptoms = patient.symptoms || [];
    return (
      symptoms.includes("Low Oxygen") ||
      symptoms.includes("Cough with Blood") ||
      (symptoms.includes("Chest Pain") && symptoms.includes("Breathlessness"))
    );
  }

  function riskBadgeClass(level) {
    if (level === "High") {
      return "bg-red-100 text-red-700 border-red-200";
    }
    if (level === "Medium") {
      return "bg-amber-100 text-amber-700 border-amber-200";
    }
    return "bg-emerald-100 text-emerald-700 border-emerald-200";
  }

  function getCareLinks() {
    const city = patient.city || "";
    const location = encodeURIComponent(city);

    return [
      {
        title: "Pulmonologist Near You",
        url: `https://www.google.com/maps/search/?api=1&query=${location}+pulmonologist`,
      },
      {
        title: "Chest X-ray Centers",
        url: `https://www.google.com/maps/search/?api=1&query=${location}+chest+xray+center`,
      },
      {
        title: "24x7 Emergency Hospitals",
        url: `https://www.google.com/maps/search/?api=1&query=${location}+24x7+hospital`,
      },
    ];
  }

  const chartContainerClass = darkMode ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200";

  const currentResult = {
    "Predicted Disease": disease,
    Confidence: confidence,
    "Severity (AI-estimated)": severity,
    "Risk Analysis": riskAnalysis,
  };

  const chatAssistant = (
    <ChatAssistant
      patient={patient}
      history={history}
      currentResult={currentResult}
      darkMode={darkMode}
    />
  );

  const historyPage = (
    <div
      className={`min-h-screen p-6 md:p-10 ${
        darkMode
          ? "bg-gradient-to-br from-slate-900 to-slate-800 text-slate-100"
          : "bg-gradient-to-br from-slate-100 to-blue-50 text-slate-800"
      }`}
    >
      <div
        className={`max-w-6xl mx-auto rounded-xl shadow-lg p-8 ${
          darkMode ? "bg-slate-900 border border-slate-700" : "bg-white"
        }`}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-3xl font-bold">Patient History</h1>
            <p className={`${darkMode ? "text-slate-300" : "text-gray-500"} text-sm`}>
              Timeline for {patient.name}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchHistory(patient)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                darkMode ? "bg-slate-700 text-white" : "bg-slate-200 text-slate-800"
              }`}
            >
              Refresh
            </button>
            <button
              onClick={() => setShowHistoryPage(false)}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-600 text-white"
            >
              Back to Dashboard
            </button>
          </div>
        </div>

        {historyLoading ? (
          <p className="text-sm text-gray-400">Loading timeline...</p>
        ) : historyError ? (
          <p className="text-sm text-red-400">{historyError}</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-gray-400">No previous scans found for this patient.</p>
        ) : (
          <div className="max-h-[70vh] overflow-y-auto pr-2">
            <div className="border-l-2 border-emerald-400/70 ml-2 pl-4 space-y-4">
              {history.map((entry) => (
                <div key={entry.id} className="relative">
                  <span className="absolute -left-[1.05rem] top-2 h-3 w-3 rounded-full bg-emerald-500" />
                  <div
                    className={`p-4 rounded-lg border ${
                      darkMode ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-sm">{entry.predicted_disease}</p>
                      <span
                        className={`text-xs px-2 py-1 rounded-full border ${riskBadgeClass(entry.risk_level)}`}
                      >
                        {entry.risk_level || "N/A"}
                      </span>
                    </div>
                    <p className="text-xs mt-1 opacity-80">
                      {entry.created_at} | Confidence: {Number(entry.confidence || 0).toFixed(2)}% | Severity: {entry.severity}
                    </p>
                    <p className="text-xs mt-1 opacity-80">Previous Disease: {entry.previous_disease || "None"}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const insightsPage = (
    <div
      className={`min-h-screen p-6 md:p-10 ${
        darkMode
          ? "bg-gradient-to-br from-slate-900 to-slate-800 text-slate-100"
          : "bg-gradient-to-br from-slate-100 to-blue-50 text-slate-800"
      }`}
    >
      <div
        className={`max-w-6xl mx-auto rounded-xl shadow-lg p-8 ${
          darkMode ? "bg-slate-900 border border-slate-700" : "bg-white"
        }`}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-3xl font-bold">Live Insights</h1>
            <p className={`${darkMode ? "text-slate-300" : "text-gray-500"} text-sm`}>
              Important analytics for {patient.name}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-3 py-1 rounded-full border ${darkMode ? "border-slate-600" : "border-slate-300"}`}>
              Live: {liveNow.toLocaleTimeString()}
            </span>
            <button
              onClick={() => fetchHistory(patient)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                darkMode ? "bg-slate-700 text-white" : "bg-slate-200 text-slate-800"
              }`}
            >
              Refresh Data
            </button>
            <button
              onClick={() => setShowInsightsPage(false)}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-600 text-white"
            >
              Back to Dashboard
            </button>
          </div>
        </div>

        {history.length === 0 ? (
          <p className="text-sm text-gray-400">No data yet. Run a few scans to unlock charts.</p>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className={`rounded-lg border p-3 ${chartContainerClass}`}>
                <p className="text-xs opacity-70">Total Scans</p>
                <p className="text-xl font-bold">{historyStats.totalScans}</p>
              </div>
              <div className={`rounded-lg border p-3 ${chartContainerClass}`}>
                <p className="text-xs opacity-70">Average Confidence</p>
                <p className="text-xl font-bold">{historyStats.avgConfidence.toFixed(2)}%</p>
              </div>
              <div className={`rounded-lg border p-3 ${chartContainerClass}`}>
                <p className="text-xs opacity-70">High-Risk Reports</p>
                <p className="text-xl font-bold">{historyStats.highRiskCount}</p>
              </div>
              <div className={`rounded-lg border p-3 ${chartContainerClass}`}>
                <p className="text-xs opacity-70">Frequent Finding</p>
                <p className="text-sm font-bold">{historyStats.topDisease}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={`rounded-lg border p-4 ${chartContainerClass}`}>
                <h3 className="font-semibold mb-2 text-sm">Confidence Trend (Last 10 Scans)</h3>
                <LineChart points={chartSeries.confidencePoints} maxY={100} stroke="#10b981" />
              </div>
              <div className={`rounded-lg border p-4 ${chartContainerClass}`}>
                <h3 className="font-semibold mb-2 text-sm">Risk Score Trend (Low=1, High=3)</h3>
                <LineChart points={chartSeries.riskPoints} maxY={3} stroke="#f59e0b" />
              </div>
            </div>

            <div className={`rounded-lg border p-4 ${chartContainerClass}`}>
              <h3 className="font-semibold mb-3 text-sm">Top Detected Diseases</h3>
              <BarChart data={diseaseDistribution} />
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (showHistoryPage) {
    return (
      <>
        {historyPage}
        {chatAssistant}
      </>
    );
  }

  if (showInsightsPage) {
    return (
      <>
        {insightsPage}
        {chatAssistant}
      </>
    );
  }

  return (
    <>
      <div
        className={`min-h-screen p-6 md:p-10 ${
          darkMode
            ? "bg-gradient-to-br from-slate-900 to-slate-800 text-slate-100"
            : "bg-gradient-to-br from-slate-100 to-blue-50 text-slate-800"
        }`}
      >
        <div
          className={`max-w-6xl mx-auto rounded-xl shadow-lg p-8 ${
            darkMode ? "bg-slate-900 border border-slate-700" : "bg-white"
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold">CureX</h1>
              <p className={`${darkMode ? "text-slate-300" : "text-gray-500"} text-sm`}>
                AI-Powered Lung Disease Detection System
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowHistoryPage(true)}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white"
              >
                View History
              </button>
              <button
                onClick={() => setShowInsightsPage(true)}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-violet-600 text-white"
              >
                View Insights
              </button>
              <button
                onClick={() => setDarkMode((prev) => !prev)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                  darkMode ? "bg-slate-700 text-white" : "bg-slate-200 text-slate-800"
                }`}
              >
                {darkMode ? "Light Mode" : "Dark Mode"}
              </button>
            </div>
          </div>

          <div
            className={`p-3 rounded-lg mb-4 text-sm ${
              darkMode
                ? "bg-yellow-950 border border-yellow-700"
                : "bg-yellow-50 border border-yellow-200"
            }`}
          >
            <strong>Patient:</strong> {patient.name} | Email: {patient.email} | Age: {patient.age} | City: {patient.city || "N/A"} | Previous Disease: {patient.previousDisease || "None"}
          </div>

          {!!(patient.symptoms || []).length && (
            <div
              className={`p-3 rounded-lg mb-4 text-sm ${
                darkMode ? "bg-cyan-950 border border-cyan-700" : "bg-cyan-50 border border-cyan-200"
              }`}
            >
              <strong>Reported Symptoms:</strong> {(patient.symptoms || []).join(", ")}
            </div>
          )}

          {hasEmergencySymptoms() && (
            <div className={`p-3 rounded-lg mb-4 text-sm ${darkMode ? "bg-red-950 border border-red-700 text-red-200" : "bg-red-50 border border-red-200 text-red-700"}`}>
              <strong>Urgent Symptom Alert:</strong> Low oxygen / chest danger symptoms are selected. Please seek emergency medical care immediately.
            </div>
          )}

          {getRiskWarning() && (
            <div
              className={`p-3 rounded-lg mb-6 ${
                darkMode
                  ? "bg-red-950 border border-red-700 text-red-200"
                  : "bg-red-50 border border-red-200 text-red-700"
              }`}
            >
              <strong>Risk Alert:</strong> {getRiskWarning()}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div
              className={`p-6 rounded-xl shadow ${
                darkMode
                  ? "bg-emerald-950 border border-emerald-800"
                  : "bg-emerald-50 border border-emerald-200"
              }`}
            >
              <form onSubmit={handleSubmit}>
                <input
                  type="file"
                  name="image"
                  accept="image/png,image/jpeg"
                  className={`w-full p-3 border-2 border-dashed rounded-lg bg-gray-50 mb-4 ${
                    darkMode ? "bg-slate-900 border-slate-600" : ""
                  }`}
                />

                <button className="w-full bg-emerald-500 text-white p-3 rounded-lg font-semibold">
                  Detect Disease
                </button>
              </form>

              {preview && (
                <div className="mt-5 text-center">
                  <img src={preview} className="max-h-64 mx-auto rounded-lg shadow-lg" alt="X-ray preview" />
                </div>
              )}

              {disease && (
                <div className={`mt-6 p-5 bg-white rounded-xl border ${darkMode ? "bg-slate-900 border-slate-700" : ""}`}>
                  <h2 className="text-lg font-semibold text-center mb-4">Diagnosis Result</h2>

                  <div className="flex justify-around text-center">
                    <div>
                      <p className="text-xs text-gray-500">Disease</p>
                      <p className="font-bold">{disease}</p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500">Confidence</p>
                      <p className="font-bold">{numericConfidence}%</p>

                      <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                        <div
                          className="bg-emerald-500 h-2 rounded-full"
                          style={{ width: `${numericConfidence}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500">Severity</p>
                      <p className="font-bold text-red-500">{severity}</p>
                    </div>
                  </div>
                </div>
              )}

              {heatmap && (
                <div className="mt-4">
                  <button
                    onClick={() => setShowHeatmap((prev) => !prev)}
                    className="w-full bg-violet-600 text-white p-3 rounded-lg font-semibold"
                  >
                    {showHeatmap ? "Hide Heatmap" : "Show Heatmap"}
                  </button>

                  {showHeatmap && (
                    <div className="mt-4 text-center">
                      <img src={heatmap} className="max-h-64 mx-auto rounded-lg shadow-lg" alt="Grad-CAM heatmap" />
                    </div>
                  )}
                </div>
              )}

              {disease && (
                <button
                  onClick={generatePDF}
                  className="mt-5 w-full bg-blue-600 text-white p-3 rounded-lg font-semibold"
                >
                  Download Medical Report
                </button>
              )}
            </div>

            <div
              className={`p-6 rounded-xl shadow ${
                darkMode
                  ? "bg-slate-800 border border-slate-700"
                  : "bg-pink-50 border border-pink-200"
              }`}
            >
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setActiveTab("diagnosis")}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                    activeTab === "diagnosis"
                      ? "bg-emerald-600 text-white"
                      : darkMode
                      ? "bg-slate-700 text-slate-200"
                      : "bg-white text-slate-700 border border-slate-200"
                  }`}
                >
                  Diagnosis Insights
                </button>
                <button
                  onClick={() => setActiveTab("forYou")}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                    activeTab === "forYou"
                      ? "bg-emerald-600 text-white"
                      : darkMode
                      ? "bg-slate-700 text-slate-200"
                      : "bg-white text-slate-700 border border-slate-200"
                  }`}
                >
                  For You
                </button>
              </div>

              {activeTab === "diagnosis" ? (
                <>
                  <h2 className="text-xl font-semibold text-center mb-4">Diagnosis Insights</h2>
                  {!guidance ? (
                    <p className="text-center text-gray-400 mt-10">No results available yet.</p>
                  ) : (
                    <div
                      className="text-sm leading-relaxed"
                      dangerouslySetInnerHTML={{
                        __html: formatGuidance(guidance),
                      }}
                    />
                  )}
                </>
              ) : (
                <div
                  className={`rounded-xl p-4 border ${
                    darkMode ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"
                  }`}
                >
                  <h3 className="text-lg font-semibold mb-3">Risk Analysis</h3>

                  {!riskAnalysis ? (
                    <p className="text-sm text-gray-400">Risk analysis will appear after diagnosis.</p>
                  ) : (
                    <div className="space-y-3 text-sm">
                      <span
                        className={`inline-block px-3 py-1 rounded-full border font-semibold ${riskBadgeClass(
                          riskAnalysis["Risk Level"]
                        )}`}
                      >
                        Risk Level: {riskAnalysis["Risk Level"] || "N/A"}
                      </span>

                      <p>
                        <strong>Age Impact:</strong> {riskAnalysis["Age Impact"] || "N/A"}
                      </p>
                      <p>
                        <strong>Previous Disease Impact:</strong>{" "}
                        {riskAnalysis["Previous Disease Impact"] || "N/A"}
                      </p>
                      <p>
                        <strong>Symptom Impact:</strong> {riskAnalysis["Symptom Impact"] || "N/A"}
                      </p>
                      <p>
                        <strong>Possible Contribution:</strong>{" "}
                        {riskAnalysis["Possible Contribution"] || "N/A"}
                      </p>

                      <div>
                        <strong>Recommendations:</strong>
                        <ul className="list-disc ml-5 mt-2">
                          {(riskAnalysis.Recommendations || []).map((item, idx) => (
                            <li key={`${item}-${idx}`}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className={`rounded-xl p-4 border mt-4 ${darkMode ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"}`}>
                <h3 className="text-lg font-semibold mb-3">Nearby Care Options</h3>
                <div className="space-y-2">
                  {getCareLinks().map((link) => (
                    <a
                      key={link.title}
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className={`block p-3 rounded-lg border text-sm ${
                        darkMode ? "border-slate-700 hover:bg-slate-800" : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {link.title} ({patient.city || "your city"})
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {chatAssistant}
    </>
  );
}

function LineChart({ points, maxY, stroke }) {
  if (!points.length) {
    return <p className="text-xs text-gray-400">Not enough data for chart.</p>;
  }

  const width = 320;
  const height = 160;
  const padding = 20;

  const path = points
    .map((pt, idx) => {
      const x = padding + (idx * (width - padding * 2)) / Math.max(points.length - 1, 1);
      const y = height - padding - (Math.max(0, pt.y) / maxY) * (height - padding * 2);
      return `${idx === 0 ? "M" : "L"}${x} ${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-40">
      <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#94a3b8" strokeWidth="1" />
      <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#94a3b8" strokeWidth="1" />
      <path d={path} fill="none" stroke={stroke} strokeWidth="2.5" />
      {points.map((pt, idx) => {
        const x = padding + (idx * (width - padding * 2)) / Math.max(points.length - 1, 1);
        const y = height - padding - (Math.max(0, pt.y) / maxY) * (height - padding * 2);
        return <circle key={`${idx}-${pt.y}`} cx={x} cy={y} r="3" fill={stroke} />;
      })}
    </svg>
  );
}

function BarChart({ data }) {
  if (!data.length) {
    return <p className="text-xs text-gray-400">No disease distribution available yet.</p>;
  }

  const maxCount = Math.max(...data.map((item) => item.count), 1);

  return (
    <div className="space-y-2">
      {data.map((item) => (
        <div key={item.label}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span>{item.label}</span>
            <span>{item.count}</span>
          </div>
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500"
              style={{ width: `${(item.count / maxCount) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default App;
