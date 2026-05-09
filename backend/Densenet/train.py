import tensorflow as tf
import numpy as np

from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras.applications import DenseNet121
from tensorflow.keras.applications.densenet import preprocess_input

from tensorflow.keras.layers import (
    Dense,
    GlobalAveragePooling2D,
    Dropout,
    BatchNormalization
)

from tensorflow.keras.models import Model
from tensorflow.keras.optimizers import Adam

from tensorflow.keras.callbacks import (
    EarlyStopping,
    ReduceLROnPlateau,
    ModelCheckpoint
)

from tensorflow.keras.metrics import Precision, Recall, AUC

from sklearn.utils.class_weight import compute_class_weight

# =========================================================
# PATHS
# =========================================================

TRAIN_DIR = "../../dataset/train"
VAL_DIR = "../../dataset/val"
TEST_DIR = "../../dataset/test"

# =========================================================
# CONFIG
# =========================================================

IMG_SIZE = (224, 224)
BATCH_SIZE = 32

EPOCHS_FROZEN = 6
EPOCHS_FINE = 15

# =========================================================
# DATA GENERATORS
# =========================================================

train_datagen = ImageDataGenerator(
    preprocessing_function=preprocess_input,
    rotation_range=10,
    zoom_range=0.1,
    width_shift_range=0.05,
    height_shift_range=0.05,
    horizontal_flip=False
)

val_test_datagen = ImageDataGenerator(
    preprocessing_function=preprocess_input
)

# =========================================================
# TRAIN GENERATOR
# =========================================================

train_generator = train_datagen.flow_from_directory(
    TRAIN_DIR,
    target_size=IMG_SIZE,
    batch_size=BATCH_SIZE,
    class_mode="categorical",
    shuffle=True
)

# =========================================================
# VALIDATION GENERATOR
# =========================================================

val_generator = val_test_datagen.flow_from_directory(
    VAL_DIR,
    target_size=IMG_SIZE,
    batch_size=BATCH_SIZE,
    class_mode="categorical",
    shuffle=False
)

# =========================================================
# TEST GENERATOR
# =========================================================

test_generator = val_test_datagen.flow_from_directory(
    TEST_DIR,
    target_size=IMG_SIZE,
    batch_size=BATCH_SIZE,
    class_mode="categorical",
    shuffle=False
)

# =========================================================
# CLASS INFORMATION
# =========================================================

NUM_CLASSES = train_generator.num_classes

print("\nClasses:")
print(train_generator.class_indices)

# =========================================================
# CLASS WEIGHTS
# =========================================================

labels = train_generator.classes

class_weights = compute_class_weight(
    class_weight="balanced",
    classes=np.unique(labels),
    y=labels
)

class_weights = dict(enumerate(class_weights))

print("\nClass Weights:")
print(class_weights)

# =========================================================
# BASE MODEL (DenseNet121)
# =========================================================

base_model = DenseNet121(
    input_shape=(224, 224, 3),
    include_top=False,
    weights="imagenet"
)

base_model.trainable = False

# =========================================================
# CUSTOM HEAD
# =========================================================

x = base_model.output

x = GlobalAveragePooling2D()(x)

x = BatchNormalization()(x)

x = Dense(256, activation="relu")(x)
x = Dropout(0.4)(x)

x = Dense(128, activation="relu")(x)
x = Dropout(0.3)(x)

output = Dense(NUM_CLASSES, activation="softmax")(x)

model = Model(
    inputs=base_model.input,
    outputs=output
)

# =========================================================
# CALLBACKS
# =========================================================

best_checkpoint = ModelCheckpoint(
    "best_densenet121.h5",
    monitor="val_auc",
    save_best_only=True,
    mode="max",
    verbose=1
)

latest_checkpoint = ModelCheckpoint(
    "latest_densenet121.h5",
    save_freq="epoch",
    verbose=1
)

early_stopping = EarlyStopping(
    monitor="val_loss",
    patience=5,
    restore_best_weights=True
)

reduce_lr = ReduceLROnPlateau(
    monitor="val_loss",
    factor=0.3,
    patience=2,
    min_lr=1e-7,
    verbose=1
)

callbacks = [
    best_checkpoint,
    latest_checkpoint,
    early_stopping,
    reduce_lr
]

# =========================================================
# TRAINING PARAMETERS
# =========================================================

steps_per_epoch = train_generator.samples // BATCH_SIZE
validation_steps = val_generator.samples // BATCH_SIZE

# =========================================================
# METRICS
# =========================================================

metrics = [
    "accuracy",
    Precision(name="precision"),
    Recall(name="recall"),
    AUC(name="auc"),
    tf.keras.metrics.TopKCategoricalAccuracy(
        k=2,
        name="top2_acc"
    )
]

# =========================================================
# PHASE 1 — TRAIN FROZEN BASE
# =========================================================

print("\n=================================================")
print("🚀 PHASE 1: TRAINING FROZEN BASE")
print("=================================================\n")

model.compile(
    optimizer=Adam(learning_rate=1e-4),
    loss=tf.keras.losses.CategoricalCrossentropy(
        label_smoothing=0.1
    ),
    metrics=metrics
)

history_frozen = model.fit(
    train_generator,
    validation_data=val_generator,
    epochs=EPOCHS_FROZEN,
    steps_per_epoch=steps_per_epoch,
    validation_steps=validation_steps,
    class_weight=class_weights,
    callbacks=callbacks
)

# =========================================================
# PHASE 2 — FINE TUNING
# =========================================================

print("\n=================================================")
print("🔥 PHASE 2: FINE TUNING")
print("=================================================\n")

base_model.trainable = True

# Freeze earlier layers
for layer in base_model.layers[:-80]:
    layer.trainable = False

model.compile(
    optimizer=Adam(learning_rate=1e-5),
    loss=tf.keras.losses.CategoricalCrossentropy(
        label_smoothing=0.1
    ),
    metrics=metrics
)

history_fine = model.fit(
    train_generator,
    validation_data=val_generator,
    epochs=EPOCHS_FINE,
    steps_per_epoch=steps_per_epoch,
    validation_steps=validation_steps,
    class_weight=class_weights,
    callbacks=callbacks
)

# =========================================================
# SAVE FINAL MODEL
# =========================================================

model.save("trained_densenet121.h5")

print("\n✅ Final model saved as trained_densenet121.h5")
print("🏆 Best model saved as best_densenet121.h5")

# =========================================================
# TEST EVALUATION
# =========================================================

print("\n=================================================")
print("🧪 FINAL TEST EVALUATION")
print("=================================================\n")

results = model.evaluate(test_generator)

test_loss = results[0]
test_accuracy = results[1]
test_precision = results[2]
test_recall = results[3]
test_auc = results[4]
test_top2 = results[5]

print(f"\n✅ Test Loss: {test_loss:.4f}")
print(f"✅ Test Accuracy: {test_accuracy:.4f}")
print(f"✅ Test Precision: {test_precision:.4f}")
print(f"✅ Test Recall: {test_recall:.4f}")
print(f"✅ Test AUC: {test_auc:.4f}")
print(f"✅ Test Top-2 Accuracy: {test_top2:.4f}")

print("\n🎉 Training and evaluation completed successfully!")