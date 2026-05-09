import numpy as np
from PIL import Image
import io

class MonitoringAgent:

    def __init__(self, img_size=(256, 256), preprocessing_fn=None):
        self.img_size = img_size
        self.preprocessing_fn = preprocessing_fn
        self.allowed_types = ["image/jpeg", "image/jpg", "image/png"]

    def process(self, file):

        # ----------------------------
        # FILE TYPE VALIDATION
        # ----------------------------
        if file.content_type not in self.allowed_types and not file.filename.lower().endswith((".jpg", ".jpeg", ".png")):
            raise ValueError("Invalid file type. Only JPG and PNG images are supported.")

        # ----------------------------
        # READ IMAGE
        # ----------------------------
        image_bytes = file.file.read()

        if len(image_bytes) == 0:
            raise ValueError("Empty image file received.")

        # ----------------------------
        # DECODE IMAGE
        # ----------------------------
        try:
            image = Image.open(io.BytesIO(image_bytes))
            image = image.convert("RGB")
        except Exception:
            raise ValueError("Corrupted or unsupported image file.")

        # ----------------------------
        # RESOLUTION CHECK
        # ----------------------------
        width, height = image.size

        if width < 100 or height < 100:
            raise ValueError("Image resolution too low for medical analysis.")

        # ----------------------------
        # RESIZE
        # ----------------------------
        image = image.resize(self.img_size)

        image_array = np.array(image, dtype=np.float32)

        # ----------------------------
        # BATCH DIMENSION
        # ----------------------------
        image_array = np.expand_dims(image_array, axis=0)

        # ----------------------------
        # MODEL-SPECIFIC PREPROCESSING
        # ----------------------------
        if self.preprocessing_fn is not None:
            image_array = self.preprocessing_fn(image_array)

        return image_array
