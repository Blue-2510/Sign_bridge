import pandas as pd
import glob
import os
import joblib

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report


print("===================================")
print("       SIGNBRIDGE AI TRAINING")
print("===================================")


# --------------------------------------------------
# FIND PROJECT FOLDER
# --------------------------------------------------

PROJECT_FOLDER = os.path.dirname(
    os.path.dirname(
        os.path.abspath(__file__)
    )
)

DATASET_FOLDER = os.path.join(
    PROJECT_FOLDER,
    "dataset"
)

MODEL_FOLDER = os.path.join(
    PROJECT_FOLDER,
    "ml",
    "models"
)

MODEL_PATH = os.path.join(
    MODEL_FOLDER,
    "sign_model.pkl"
)


print("\nProject folder:")
print(PROJECT_FOLDER)

print("\nDataset folder:")
print(DATASET_FOLDER)


# --------------------------------------------------
# CHECK DATASET FOLDER
# --------------------------------------------------

if not os.path.exists(DATASET_FOLDER):

    print("\n❌ ERROR: Dataset folder not found!")
    print(DATASET_FOLDER)
    exit()


# --------------------------------------------------
# FIND CSV FILES
# --------------------------------------------------

files = glob.glob(
    os.path.join(
        DATASET_FOLDER,
        "*.csv"
    )
)


print("\nCSV files found:", len(files))

for file in files:
    print(" -", os.path.basename(file))


if len(files) == 0:

    print("\n❌ ERROR: No CSV files found!")
    print("\nMake sure your CSV files are inside:")
    print(DATASET_FOLDER)

    exit()


# --------------------------------------------------
# LOAD DATA
# --------------------------------------------------

dataframes = []

for file in files:

    print("\nLoading:", os.path.basename(file))

    df = pd.read_csv(file)

    print("Samples:", len(df))

    dataframes.append(df)


# --------------------------------------------------
# COMBINE DATA
# --------------------------------------------------

data = pd.concat(
    dataframes,
    ignore_index=True
)


print("\n===================================")
print("DATASET INFORMATION")
print("===================================")

print("\nTotal samples:", len(data))

print("\nClasses:")

print(
    data["label"].value_counts()
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
# CREATE MODEL
# --------------------------------------------------

print("\n===================================")
print("TRAINING RANDOM FOREST")
print("===================================")

model = RandomForestClassifier(

    n_estimators=200,

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


accuracy = accuracy_score(
    y_test,
    predictions
)


# --------------------------------------------------
# RESULTS
# --------------------------------------------------

print("\n===================================")
print("MODEL RESULTS")
print("===================================")

print(
    f"\nAccuracy: {accuracy * 100:.2f}%"
)

print("\nClassification Report:")

print(
    classification_report(
        y_test,
        predictions
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
print("✅ MODEL SAVED SUCCESSFULLY")
print("===================================")

print("\nSaved at:")

print(MODEL_PATH)

print("\n🎉 SignBridge AI model training complete!")