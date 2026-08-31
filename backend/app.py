from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import os

app = Flask(__name__)
CORS(app)


# ============================================================
# LOAD SIGNBRIDGE AI MODEL
# ============================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

MODEL_PATH = os.path.join(
    BASE_DIR,
    "..",
    "ml",
    "models",
    "sign_model.pkl"
)

MODEL_PATH = os.path.abspath(MODEL_PATH)

print("======================================")
print("       SIGNBRIDGE AI BACKEND")
print("======================================")

print("Loading model...")
print("Model path:", MODEL_PATH)

try:
    model = joblib.load(MODEL_PATH)
    print("✅ Model loaded successfully!")

except Exception as e:
    model = None
    print("❌ Model loading failed!")
    print("Error:", e)


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
# MODEL STATUS
# ============================================================

@app.route("/model-status", methods=["GET"])
def model_status():

    if model is not None:

        return jsonify({
            "status": "success",
            "model_loaded": True,
            "message": "Sign recognition model is ready"
        })

    return jsonify({
        "status": "error",
        "model_loaded": False,
        "message": "Model could not be loaded"
    }), 500


# ============================================================
# SIGN PREDICTION
# ============================================================

@app.route("/predict", methods=["POST"])
def predict():

    try:

        if model is None:

            return jsonify({
                "status": "error",
                "message": "ML model is not loaded"
            }), 500


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


        # Check number of features
        if len(features) != 63:

            return jsonify({
                "status": "error",
                "message": f"Expected 63 features, received {len(features)}"
            }), 400


        # Prediction
        prediction = model.predict(
            [features]
        )[0]


        # Confidence
        confidence = 0.0

        if hasattr(model, "predict_proba"):

            probabilities = model.predict_proba(
                [features]
            )[0]

            confidence = float(
                max(probabilities)
            )


        return jsonify({

            "status": "success",

            "sign": str(prediction),

            "confidence": round(
                confidence,
                4
            )

        })


    except Exception as e:

        print("Prediction error:", e)

        return jsonify({

            "status": "error",

            "message": str(e)

        }), 500


# ============================================================
# RUN SERVER
# ============================================================

if __name__ == "__main__":

    print("\n======================================")
    print("SignBridge AI API")
    print("Server: http://127.0.0.1:5000")
    print("======================================\n")

    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True
    )