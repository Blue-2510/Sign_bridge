import os
import glob
import pandas as pd

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report
import joblib


# ============================================================
# PATHS
# ============================================================

ML_FOLDER = os.path.dirname(os.path.abspath(__file__))

DATASET_FOLDER = os.path.join(
    ML_FOLDER,
    "webcam_alphabet_dataset"
)

MODEL_FOLDER = os.path.join(
    ML_FOLDER,
    "models"
)

MODEL_PATH = os.path.join(
    MODEL_FOLDER,
    "webcam_alphabet_model.pkl"
)

os.makedirs(MODEL_FOLDER, exist_ok=True)


# ============================================================
# LOAD DATASET
# ============================================================

csv_files = sorted(
    glob.glob(
        os.path.join(DATASET_FOLDER, "*.csv")
    )
)

if len(csv_files) == 0:
    print("ERROR: No CSV files found.")
    print(f"Expected folder: {DATASET_FOLDER}")
    exit()

print()
print("==============================================")
print("   WEBCAM ALPHABET MODEL TRAINING")
print("==============================================")
print()

print(f"CSV files found: {len(csv_files)}")

dataframes = []

for file in csv_files:

    df = pd.read_csv(file)

    if "label" not in df.columns:
        print(f"Skipping invalid file: {file}")
        continue

    dataframes.append(df)

    print(
        f"{os.path.basename(file):8} -> {len(df)} samples"
    )


# ============================================================
# COMBINE DATA
# ============================================================

data = pd.concat(
    dataframes,
    ignore_index=True
)

print()
print("----------------------------------------------")
print(f"Total samples: {len(data)}")
print(f"Total columns: {len(data.columns)}")
print("----------------------------------------------")


# ============================================================
# FEATURES AND LABEL
# ============================================================

X = data.drop(
    columns=["label"]
)

y = data["label"]


# ============================================================
# VERIFY FEATURES
# ============================================================

if X.shape[1] != 63:

    print()
    print(
        f"ERROR: Expected 63 features, found {X.shape[1]}"
    )

    exit()


# ============================================================
# CLASS DISTRIBUTION
# ============================================================

print()
print("Class distribution:")

print(
    y.value_counts().sort_index()
)


# ============================================================
# TRAIN / TEST SPLIT
# ============================================================

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.20,
    random_state=42,
    stratify=y
)

print()
print("----------------------------------------------")
print(f"Training samples: {len(X_train)}")
print(f"Testing samples : {len(X_test)}")
print("----------------------------------------------")


# ============================================================
# RANDOM FOREST
# ============================================================

print()
print("Training Random Forest...")

model = RandomForestClassifier(
    n_estimators=300,
    random_state=42,
    n_jobs=-1
)

model.fit(
    X_train,
    y_train
)


# ============================================================
# PREDICTION
# ============================================================

y_pred = model.predict(
    X_test
)


# ============================================================
# ACCURACY
# ============================================================

accuracy = accuracy_score(
    y_test,
    y_pred
)

print()
print("==============================================")
print("MODEL RESULTS")
print("==============================================")

print(
    f"Accuracy: {accuracy * 100:.2f}%"
)


# ============================================================
# CLASSIFICATION REPORT
# ============================================================

print()
print("Classification Report:")
print()

print(
    classification_report(
        y_test,
        y_pred
    )
)


# ============================================================
# SAVE MODEL
# ============================================================

joblib.dump(
    model,
    MODEL_PATH
)

print()
print("==============================================")
print("MODEL SAVED SUCCESSFULLY")
print("==============================================")

print(
    f"Model path:\n{MODEL_PATH}"
)

print()