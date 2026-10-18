
import os
import glob
import pandas as pd
import joblib

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

PROJECT_DIR = os.path.dirname(BASE_DIR)

DATASET_DIR = os.path.join(
    PROJECT_DIR,
    "dataset",
    "webcam_number_dataset"
)
MODEL_DIR = os.path.join(PROJECT_DIR, "models")
MODEL_PATH = os.path.join(MODEL_DIR, "number_model.pkl")

os.makedirs(MODEL_DIR, exist_ok=True)

# Load all number CSV files
csv_files = glob.glob(os.path.join(DATASET_DIR, "*.csv"))

if not csv_files:
    raise FileNotFoundError(
        f"No CSV files found in {DATASET_DIR}"
    )

dataframes = []

for file_path in csv_files:
    df = pd.read_csv(file_path)

    if "label" not in df.columns:
        raise ValueError(f"Missing label column in {file_path}")

    # Keep only the label and 63 landmark features
    if len(df.columns) != 64:
        raise ValueError(
            f"{os.path.basename(file_path)} has "
            f"{len(df.columns) - 1} features; expected 63."
        )

    dataframes.append(df)

data = pd.concat(dataframes, ignore_index=True)

# Validate labels and feature values
data["label"] = pd.to_numeric(data["label"], errors="raise").astype(int)

expected_labels = set(range(11))
actual_labels = set(data["label"].unique())

if actual_labels != expected_labels:
    raise ValueError(
        f"Expected labels 0–10, found: {sorted(actual_labels)}"
    )

X = data.drop(columns=["label"])
y = data["label"]

if X.isnull().any().any():
    raise ValueError("Dataset contains missing feature values.")

print("Dataset loaded successfully.")
print(f"Total samples: {len(data)}")
print("\nSamples per number:")
print(y.value_counts().sort_index())

# Split data into training and testing sets
X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.20,
    random_state=42,
    stratify=y
)

# Train a dedicated number model
model = RandomForestClassifier(
    n_estimators=200,
    random_state=42,
    class_weight="balanced",
    n_jobs=-1
)

print("\nTraining number recognition model...")
model.fit(X_train, y_train)

# Evaluate
predictions = model.predict(X_test)
accuracy = accuracy_score(y_test, predictions)

print(f"\nTest accuracy: {accuracy:.2%}")
print("\nClassification report:")
print(
    classification_report(
        y_test,
        predictions,
        labels=list(range(11)),
        zero_division=0
    )
)

# Save model and feature column order
joblib.dump(
    {
        "model": model,
        "feature_columns": list(X.columns),
        "labels": list(range(11))
    },
    MODEL_PATH
)

print(f"\nNumber model saved to: {MODEL_PATH}")
