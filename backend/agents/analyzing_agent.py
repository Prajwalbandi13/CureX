import tensorflow as tf
import numpy as np
import os
import cv2
import base64

from tensorflow.keras.applications.efficientnet import preprocess_input as efficientnet_preprocess_input

from model.gradcam import make_gradcam_heatmap, overlay_heatmap


class AnalyzingAgent:
    """
    Analyzing Agent:
    - Loads trained CNN model
    - Performs inference on preprocessed images
    - Generates Grad-CAM heatmap
    """

    def __init__(self):
        model_path = os.path.join(
            os.path.dirname(__file__),
            "../EfficientNet/trained_model.h5"
        )

        if not os.path.exists(model_path):
            raise FileNotFoundError("trained_model.h5 not found")

        self.model = tf.keras.models.load_model(model_path)
        self.input_size = tuple(self.model.input_shape[1:3])
        self.preprocessing_fn = efficientnet_preprocess_input

        # MUST match training order
        self.class_labels = [
            "Bacterial Pneumonia",
            "Corona Virus Disease",
            "Normal",
            "Tuberculosis",
            "Viral Pneumonia"
        ]

        # 🔥 IMPORTANT: Update after printing model layers
        self.last_conv_layer = "Conv_1"

    # ---------------------------------------------------
    # MAIN ANALYSIS
    # ---------------------------------------------------
    def analyze(self, image):
        predictions = self.model.predict(image)[0]

        probabilities = {}
        for i, label in enumerate(self.class_labels):
            probabilities[label] = float(predictions[i])

        heatmap = self.generate_heatmap(image)

        return {
            "probabilities": probabilities,
            "heatmap": heatmap
        }

    # ---------------------------------------------------
    # GRAD-CAM HEATMAP
    # ---------------------------------------------------
    def generate_heatmap(self, image):
        try:
            heatmap = make_gradcam_heatmap(
                image,
                self.model,
                last_conv_layer_name=self.last_conv_layer
            )

            overlay = overlay_heatmap(image, heatmap)

            _, buffer = cv2.imencode(".jpg", overlay)
            return base64.b64encode(buffer).decode("utf-8")

        except Exception as e:
            print("Heatmap generation failed:", e)
            return None
