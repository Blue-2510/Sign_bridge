import cv2
import mediapipe as mp
import joblib
import numpy as np
import os
import time

# ============================================================
# SETTINGS
# ============================================================

ML_FOLDER = os.path.dirname(os.path.abspath(__file__))

MODEL_PATH = os.path.join(
    ML_FOLDER,
    "models",
    "webcam_alphabet_model.pkl"
)

CONFIDENCE_DISPLAY = True

# ============================================================
# LOAD MODEL
# ============================================================

if not os.path.exists(MODEL_PATH):
    print("ERROR: Model not found!")
    print(MODEL_PATH)
    exit()

model = joblib.load(MODEL_PATH)

print()
print("==============================================")
print("   SIGNBRIDGE AI - ALPHABET WEBCAM TEST")
print("==============================================")
print()
print("Model loaded successfully.")
print()
print("Controls:")
print("Q = Quit")
print()
print("Show an ASL alphabet sign in front of the camera.")
print()

# ============================================================
# MEDIAPIPE
# ============================================================

mp_hands = mp.solutions.hands
mp_drawing = mp.solutions.drawing_utils

hands = mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=1,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)

# ============================================================
# FEATURE EXTRACTION
# ============================================================

def extract_features(landmarks):

    wrist = landmarks[0]

    features = []

    for landmark in landmarks:

        x = float(landmark.x) - float(wrist.x)
        y = float(landmark.y) - float(wrist.y)
        z = float(landmark.z) - float(wrist.z)

        features.extend([
            x,
            y,
            z
        ])

    return features


# ============================================================
# WEBCAM
# ============================================================

cap = cv2.VideoCapture(0)

if not cap.isOpened():

    print("ERROR: Could not open webcam.")
    exit()


last_prediction = "?"
last_confidence = 0.0

prediction_count = 0

start_time = time.time()


# ============================================================
# MAIN LOOP
# ============================================================

while True:

    ret, frame = cap.read()

    if not ret:
        print("ERROR: Could not read webcam.")
        break

    # Mirror webcam
    frame = cv2.flip(frame, 1)

    # Convert to RGB
    rgb = cv2.cvtColor(
        frame,
        cv2.COLOR_BGR2RGB
    )

    # MediaPipe
    results = hands.process(rgb)

    # ========================================================
    # HAND DETECTED
    # ========================================================

    if results.multi_hand_landmarks:

        hand_landmarks = results.multi_hand_landmarks[0]

        # Draw hand
        mp_drawing.draw_landmarks(
            frame,
            hand_landmarks,
            mp_hands.HAND_CONNECTIONS
        )

        # Extract 63 features
        features = extract_features(
            hand_landmarks.landmark
        )

        if len(features) == 63:

            features_array = np.array(
                features
            ).reshape(1, -1)

            # Prediction
            prediction = model.predict(
                features_array
            )[0]

            # Confidence
            probabilities = model.predict_proba(
                features_array
            )[0]

            confidence = float(
                np.max(probabilities)
            )

            last_prediction = str(
                prediction
            )

            last_confidence = confidence

            prediction_count += 1

    else:

        last_prediction = "NO HAND"
        last_confidence = 0.0

    # ========================================================
    # UI PANEL
    # ========================================================

    cv2.rectangle(
        frame,
        (0, 0),
        (700, 150),
        (0, 0, 0),
        -1
    )

    cv2.putText(
        frame,
        f"Prediction: {last_prediction}",
        (20, 45),
        cv2.FONT_HERSHEY_SIMPLEX,
        1.1,
        (255, 255, 255),
        3
    )

    cv2.putText(
        frame,
        f"Confidence: {last_confidence * 100:.1f}%",
        (20, 90),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.8,
        (255, 255, 255),
        2
    )

    cv2.putText(
        frame,
        "Press Q to quit",
        (20, 130),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.6,
        (255, 255, 255),
        2
    )

    # ========================================================
    # DISPLAY
    # ========================================================

    cv2.imshow(
        "SignBridge AI - Alphabet Test",
        frame
    )

    key = cv2.waitKey(1) & 0xFF

    if key == ord("q"):
        break


# ============================================================
# CLEANUP
# ============================================================

cap.release()

cv2.destroyAllWindows()

hands.close()

print()
print("Alphabet webcam test stopped.")
print(
    f"Predictions made: {prediction_count}"
)