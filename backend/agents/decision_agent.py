import numpy as np


class DecisionAgent:
    """
    Decision Agent:
    - Interprets CNN probabilities
    - Determines disease + severity
    """

    def __init__(self):
        self.high_confidence = 0.70
        self.medium_confidence = 0.40

    def decide(self, analysis_output):
        """
        Input:
            {
              probabilities: {},
              heatmap: base64
            }
        """

        predictions = analysis_output["probabilities"]
        heatmap = analysis_output.get("heatmap")

        # ----------------------------
        # BEST CLASS
        # ----------------------------
        disease = max(predictions, key=predictions.get)
        confidence = float(predictions[disease])

        # ----------------------------
        # SEVERITY
        # ----------------------------
        if confidence >= self.high_confidence:
            severity = "High"
            recommendation = "Immediate clinical attention recommended."
        elif confidence >= self.medium_confidence:
            severity = "Medium"
            recommendation = "Further diagnostic tests advised."
        else:
            severity = "Low"
            recommendation = "Monitoring suggested; low confidence diagnosis."

        reliable = confidence >= self.medium_confidence

        return {
            "Predicted Disease": disease,
            "Confidence (%)": round(confidence * 100, 2),
            "Severity Level": severity,
            "Reliable": reliable,
            "Recommendation": recommendation,
            "heatmap": heatmap   # 🔥 pass forward
        }
