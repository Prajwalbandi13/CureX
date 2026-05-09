import tensorflow as tf
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns

from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input

from sklearn.metrics import classification_report, confusion_matrix, roc_curve, auc
from sklearn.preprocessing import label_binarize

# ----------------------------
# PATHS
# ----------------------------

MODEL_PATH = "best_mobilenetv2.h5"
VAL_DIR = "../../dataset/test"

IMG_SIZE = (224, 224)
BATCH_SIZE = 32

# ----------------------------
# LOAD MODEL
# ----------------------------

model = tf.keras.models.load_model(MODEL_PATH)

print("✅ Model loaded successfully")

# ----------------------------
# DATA GENERATOR
# ----------------------------

val_datagen = ImageDataGenerator(
    preprocessing_function=preprocess_input
)

val_generator = val_datagen.flow_from_directory(
    VAL_DIR,
    target_size=IMG_SIZE,
    batch_size=BATCH_SIZE,
    class_mode="categorical",
    shuffle=False
)

class_labels = list(val_generator.class_indices.keys())
NUM_CLASSES = len(class_labels)

print("Classes:", class_labels)

# ----------------------------
# PREDICTIONS
# ----------------------------

print("\n🚀 Running predictions...")

predictions = model.predict(val_generator, verbose=1)

predicted_classes = np.argmax(predictions, axis=1)
true_classes = val_generator.classes

# ----------------------------
# CONFUSION MATRIX
# ----------------------------

cm = confusion_matrix(true_classes, predicted_classes)

print("\n📊 Confusion Matrix:\n")
print(cm)

# ----------------------------
# CLASSIFICATION REPORT
# ----------------------------

report = classification_report(
    true_classes,
    predicted_classes,
    target_names=class_labels,
    digits=4
)

print("\n📄 Classification Report:\n")
print(report)

with open("evaluation_rt.txt", "w") as f:
    f.write(report)

print("✅ evaluation_rt.txt saved")

# ----------------------------
# ROC CURVE + AUC
# ----------------------------

print("\n📈 Generating ROC Curve...")

y_true = label_binarize(true_classes, classes=range(NUM_CLASSES))

plt.figure(figsize=(8, 6))

for i in range(NUM_CLASSES):
    fpr, tpr, _ = roc_curve(y_true[:, i], predictions[:, i])
    roc_auc = auc(fpr, tpr)

    plt.plot(fpr, tpr, label=f"{class_labels[i]} (AUC={roc_auc:.3f})")

plt.plot([0, 1], [0, 1], 'k--')

plt.xlabel("False Positive Rate")
plt.ylabel("True Positive Rate")
plt.title("ROC Curve (Multi-Class)")
plt.legend(loc="lower right")

plt.tight_layout()
plt.savefig("roc_cur.png", dpi=300)

print("✅ roc_cur.png saved")

# ----------------------------
# CONFUSION MATRIX HEATMAP
# ----------------------------

plt.figure(figsize=(8, 6))

sns.heatmap(
    cm,
    annot=True,
    fmt="d",
    cmap="Blues",
    xticklabels=class_labels,
    yticklabels=class_labels
)

plt.title("Confusion Matrix")
plt.ylabel("Actual Class")
plt.xlabel("Predicted Class")

plt.tight_layout()
plt.savefig("confusion_matx.png", dpi=300)

print("✅ confusion_matx.png saved")

# ----------------------------
# OPTIONAL: PER-CLASS AUC PRINT
# ----------------------------

print("\n📊 Per-Class AUC Scores:")

for i in range(NUM_CLASSES):
    fpr, tpr, _ = roc_curve(y_true[:, i], predictions[:, i])
    roc_auc = auc(fpr, tpr)
    print(f"{class_labels[i]}: {roc_auc:.4f}")

print("\n🎉 Evaluation Completed Successfully!")