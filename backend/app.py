from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import os
import numpy as np

app = Flask(__name__)
CORS(app)

MODEL_PATH = os.path.join(
    os.path.dirname(__file__),
    "..",
    "ml",
    "models",
    "sign_model.pkl"
)

MODEL_PATH = os.path.abspath(MODEL_PATH)

model = None

try:
    model = joblib.load(MODEL_PATH)
    print("===================================")
    print("     SIGNBRIDGE AI BACKEND")
    print("===================================")
    print("✅ Random Forest model loaded")
    print("Model path:")
    print(MODEL_PATH)
except Exception as e:
    print("❌ Failed to load model:")
    print(e)


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "success",
        "message": "SignBridge AI backend is running"
    })


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


@app.route("/predict", methods=["POST"])
def predict():

    if model is None:
        return jsonify({
            "status": "error",
            "message": "Model is not loaded"
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
                "message": f"Expected 63 features, received {len(features)}"
            }), 400

        features_array = np.array(
            features,
            dtype=float
        ).reshape(1, -1)

        probabilities = model.predict_proba(
            features_array
        )[0]

        classes = model.classes_

        best_index = np.argmax(probabilities)

        predicted_sign = classes[best_index]

        confidence = float(
            probabilities[best_index]
        )

        print(
            f"Prediction: {predicted_sign} | "
            f"Confidence: {confidence:.3f}"
        )

        # --------------------------------------------------
        # UNKNOWN GESTURE REJECTION
        # --------------------------------------------------

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

        # --------------------------------------------------
        # VALID SIGN
        # --------------------------------------------------

        return jsonify({
            "status": "success",
            "sign": str(predicted_sign),
            "confidence": confidence
        })

    except Exception as e:

        print("❌ Prediction error:")
        print(e)

        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


if __name__ == "__main__":

    print("\n===================================")
    print("Starting Flask server...")
    print("===================================")

    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True
    )