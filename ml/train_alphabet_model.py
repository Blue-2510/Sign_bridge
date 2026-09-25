import pandas as pd
import os
import joblib

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report


print("===================================")
print("   SIGNBRIDGE AI ALPHABET TRAINING")
print("===================================")


# --------------------------------------------------
# FIND PROJECT FOLDER
# --------------------------------------------------

PROJECT_FOLDER = os.path.dirname(
    os.path.dirname(
        os.path.abspath(__file__)
    )
)


DATASET_PATH = os.path.join(
    PROJECT_FOLDER,
    "ml",
    "alphabet_dataset",
    "alphabet_features.csv"
)


MODEL_FOLDER = os.path.join(
    PROJECT_FOLDER,
    "ml",
    "models"
)


MODEL_PATH = os.path.join(
    MODEL_FOLDER,
    "alphabet_model.pkl"
)


print("\nProject folder:")
print(PROJECT_FOLDER)

print("\nAlphabet dataset:")
print(DATASET_PATH)


# --------------------------------------------------
# CHECK DATASET
# --------------------------------------------------

if not os.path.exists(DATASET_PATH):

    print("\n❌ ERROR: Alphabet dataset not found!")
    print(DATASET_PATH)
    exit()


# --------------------------------------------------
# LOAD DATA
# --------------------------------------------------

print("\nLoading alphabet dataset...")

data = pd.read_csv(
    DATASET_PATH
)


print("\n===================================")
print("DATASET INFORMATION")
print("===================================")

print("\nTotal samples:", len(data))

print("\nClasses:")
print(
    data["label"].value_counts().sort_index()
)


# --------------------------------------------------
# FEATURES AND LABEL
# --------------------------------------------------

X = data.drop(
    "label",
    axis=1
)

y = data["label"]


print("\nNumber of features:", X.shape[1])

print(
    "Number of classes:",
    y.nunique()
)


# --------------------------------------------------
# TRAIN / TEST SPLIT
# --------------------------------------------------

X_train, X_test, y_train, y_test = train_test_split(

    X,
    y,

    test_size=0.2,

    random_state=42,

    stratify=y
)


print("\nTraining samples:", len(X_train))

print(
    "Testing samples:",
    len(X_test)
)


# --------------------------------------------------
# CREATE ALPHABET MODEL
# --------------------------------------------------

print("\n===================================")
print("TRAINING ALPHABET RANDOM FOREST")
print("===================================")


model = RandomForestClassifier(

    n_estimators=300,

    class_weight="balanced",

    random_state=42,

    n_jobs=-1
)


# --------------------------------------------------
# TRAIN
# --------------------------------------------------

print("\nTraining model...")

model.fit(
    X_train,
    y_train
)

print("✅ Training completed!")


# --------------------------------------------------
# TEST MODEL
# --------------------------------------------------

print("\nTesting model...")

predictions = model.predict(
    X_test
)


# --------------------------------------------------
# ACCURACY
# --------------------------------------------------

accuracy = accuracy_score(
    y_test,
    predictions
)


# --------------------------------------------------
# RESULTS
# --------------------------------------------------

print("\n===================================")
print("ALPHABET MODEL RESULTS")
print("===================================")

print(
    f"\nAccuracy: {accuracy * 100:.2f}%"
)


print("\nClassification Report:")

print(
    classification_report(
        y_test,
        predictions,
        zero_division=0
    )
)


# --------------------------------------------------
# SAVE MODEL
# --------------------------------------------------

os.makedirs(
    MODEL_FOLDER,
    exist_ok=True
)


joblib.dump(
    model,
    MODEL_PATH
)


print("\n===================================")
print("✅ ALPHABET MODEL SAVED")
print("===================================")

print("\nSaved at:")

print(MODEL_PATH)

print("\n🎉 Alphabet model training complete!")