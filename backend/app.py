from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import os
import numpy as np


app = Flask(__name__)
CORS(app)


# ============================================================
# MODEL PATHS
# ============================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


# Existing 5-sign model
MODEL_PATH = os.path.abspath(
    os.path.join(
        BASE_DIR,
        "..",
        "ml",
        "models",
        "sign_model.pkl"
    )
)


# Webcam-trained A-Z alphabet model
ALPHABET_MODEL_PATH = os.path.abspath(
    os.path.join(
        BASE_DIR,
        "..",
        "ml",
        "models",
        "webcam_alphabet_model.pkl"
    )
)


# ============================================================
# LOAD EXISTING SIGN MODEL
# ============================================================

model = None

try:

    model = joblib.load(MODEL_PATH)

    print("===================================")
    print("     SIGNBRIDGE AI BACKEND")
    print("===================================")
    print("✅ Random Forest sign model loaded")
    print("Model path:")
    print(MODEL_PATH)

except Exception as e:

    print("❌ Failed to load sign model:")
    print(e)


# ============================================================
# LOAD ALPHABET MODEL
# ============================================================

alphabet_model = None

try:

    alphabet_model = joblib.load(
        ALPHABET_MODEL_PATH
    )

    print("✅ Webcam alphabet model loaded")
    print("Alphabet model path:")
    print(ALPHABET_MODEL_PATH)

except Exception as e:

    print("❌ Failed to load alphabet model:")
    print(e)


# ============================================================
# HEALTH CHECK
# ============================================================

@app.route("/health", methods=["GET"])
def health():

    return jsonify({
        "status": "success",
        "message": "SignBridge AI backend is running"
    })


# ============================================================
# EXISTING SIGN MODEL STATUS
# ============================================================

@app.route("/model-status", methods=["GET"])
def model_status():

    if model is not None:

        return jsonify({
            "status": "success",
            "message": "Sign recognition model is ready",
            "model_loaded": True
        })

    return jsonify({
        "status": "error",
        "message": "Sign recognition model is not loaded",
        "model_loaded": False
    })


# ============================================================
# ALPHABET MODEL STATUS
# ============================================================

@app.route("/alphabet-model-status", methods=["GET"])
def alphabet_model_status():

    if alphabet_model is not None:

        return jsonify({
            "status": "success",
            "message": "Webcam alphabet model is ready",
            "model_loaded": True
        })

    return jsonify({
        "status": "error",
        "message": "Webcam alphabet model is not loaded",
        "model_loaded": False
    })


# ============================================================
# EXISTING SIGN PREDICTION
# ============================================================

@app.route("/predict", methods=["POST"])
def predict():

    if model is None:

        return jsonify({
            "status": "error",
            "message": "Sign model is not loaded"
        }), 500

    try:

        data = request.get_json()

        if not data:

            return jsonify({
                "status": "error",
                "message": "No JSON data received"
            }), 400

        features = data.get("features")

        if features is None:

            return jsonify({
                "status": "error",
                "message": "Features are missing"
            }), 400

        if len(features) != 63:

            return jsonify({
                "status": "error",
                "message": (
                    f"Expected 63 features, "
                    f"received {len(features)}"
                )
            }), 400

        features_array = np.array(
            features,
            dtype=float
        ).reshape(1, -1)

        probabilities = model.predict_proba(
            features_array
        )[0]

        classes = model.classes_

        best_index = np.argmax(
            probabilities
        )

        predicted_sign = classes[best_index]

        confidence = float(
            probabilities[best_index]
        )

        print(
            f"Sign prediction: {predicted_sign} | "
            f"Confidence: {confidence:.3f}"
        )

        # ------------------------------------------------------
        # UNKNOWN GESTURE REJECTION
        # ------------------------------------------------------

        UNKNOWN_THRESHOLD = 0.90

        if predicted_sign == "unknown":

            return jsonify({
                "status": "success",
                "sign": "unknown",
                "confidence": confidence
            })

        if confidence < UNKNOWN_THRESHOLD:

            return jsonify({
                "status": "success",
                "sign": "unknown",
                "confidence": confidence
            })

        # ------------------------------------------------------
        # VALID SIGN
        # ------------------------------------------------------

        return jsonify({
            "status": "success",
            "sign": str(predicted_sign),
            "confidence": confidence
        })

    except Exception as e:

        print("❌ Sign prediction error:")
        print(e)

        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


# ============================================================
# ALPHABET PREDICTION
# ============================================================

@app.route("/predict-alphabet", methods=["POST"])
def predict_alphabet():

    if alphabet_model is None:

        return jsonify({
            "status": "error",
            "message": "Alphabet model is not loaded"
        }), 500

    try:

        data = request.get_json()

        if not data:

            return jsonify({
                "status": "error",
                "message": "No JSON data received"
            }), 400

        features = data.get("features")

        if features is None:

            return jsonify({
                "status": "error",
                "message": "Features are missing"
            }), 400

        if len(features) != 63:

            return jsonify({
                "status": "error",
                "message": (
                    f"Expected 63 features, "
                    f"received {len(features)}"
                )
            }), 400

        features_array = np.array(
            features,
            dtype=float
        ).reshape(1, -1)

        probabilities = alphabet_model.predict_proba(
            features_array
        )[0]

        classes = alphabet_model.classes_

        best_index = np.argmax(
            probabilities
        )

        predicted_letter = classes[best_index]

        confidence = float(
            probabilities[best_index]
        )

        print(
            f"Alphabet prediction: {predicted_letter} | "
            f"Confidence: {confidence:.3f}"
        )

        return jsonify({
            "status": "success",
            "letter": str(predicted_letter),
            "confidence": confidence
        })

    except Exception as e:

        print("❌ Alphabet prediction error:")
        print(e)

        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


# ============================================================
# START SERVER
# ============================================================

if __name__ == "__main__":

    print()
    print("===================================")
    print("Starting SignBridge AI Flask Server")
    print("===================================")

    print()
    print("Available endpoints:")
    print("GET  /health")
    print("GET  /model-status")
    print("GET  /alphabet-model-status")
    print("POST /predict")
    print("POST /predict-alphabet")
    print()

    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True
    )