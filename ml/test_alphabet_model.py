import cv2
import mediapipe as mp
import joblib
import os


# ============================================================
# PATHS
# ============================================================

PROJECT_FOLDER = os.path.dirname(
    os.path.dirname(
        os.path.abspath(__file__)
    )
)

MODEL_PATH = os.path.join(
    PROJECT_FOLDER,
    "ml",
    "models",
    "alphabet_model.pkl"
)


# ============================================================
# LOAD MODEL
# ============================================================

print("Loading alphabet model...")

model = joblib.load(MODEL_PATH)

print("✅ Alphabet model loaded")


# ============================================================
# MEDIAPIPE
# ============================================================

mp_hands = mp.solutions.hands
mp_draw = mp.solutions.drawing_utils

hands = mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=1,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)


# ============================================================
# CAMERA
# ============================================================

cap = cv2.VideoCapture(0)

if not cap.isOpened():

    print("❌ Could not open webcam")

    exit()


print("\n===================================")
print("   ALPHABET MODEL TEST")
print("===================================")
print("Show an alphabet sign to the camera.")
print("Press Q to quit.")


# ============================================================
# MAIN LOOP
# ============================================================

frame_count = 0
prediction_interval = 5
last_prediction = "-"
last_confidence = 0.0
while True:

    success, frame = cap.read()

    if not success:
        continue


    # Flip camera for natural view
    frame = cv2.flip(
        frame,
        1
    )


    # Convert BGR → RGB
    rgb = cv2.cvtColor(
        frame,
        cv2.COLOR_BGR2RGB
    )


    results = hands.process(
        rgb
    )


    predicted_letter = "-"
    confidence = 0.0


    # ========================================================
    # HAND DETECTED
    # ========================================================

    if results.multi_hand_landmarks:

        hand_landmarks = results.multi_hand_landmarks[0]


        # Draw landmarks
        mp_draw.draw_landmarks(
            frame,
            hand_landmarks,
            mp_hands.HAND_CONNECTIONS
        )


        landmarks = hand_landmarks.landmark


        # ====================================================
        # EXTRACT 63 NORMALIZED FEATURES
        # ====================================================

        wrist = landmarks[0]

        features = []


        for landmark in landmarks:

            x = float(landmark.x) - float(wrist.x)

            y = float(landmark.y) - float(wrist.y)

            z = float(landmark.z) - float(wrist.z)

            features.append(x)
            features.append(y)
            features.append(z)


        # ====================================================
        # PREDICTION
        # ====================================================

        frame_count += 1

        if frame_count % prediction_interval == 0:

           prediction = model.predict(
                [features]
            )[0]

           probabilities = model.predict_proba(
                [features]
           )[0]

           last_confidence = max(
               probabilities
            )

           last_prediction = str(
                 prediction
           )


    confidence = last_confidence
    predicted_letter = last_prediction


    # ========================================================
    # DISPLAY
    # ========================================================

    cv2.rectangle(
        frame,
        (20, 20),
        (360, 140),
        (0, 0, 0),
        -1
    )


    cv2.putText(
        frame,
        "Alphabet:",
        (40, 60),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.8,
        (255, 255, 255),
        2
    )


    cv2.putText(
        frame,
        predicted_letter,
        (200, 75),
        cv2.FONT_HERSHEY_SIMPLEX,
        1.5,
        (0, 255, 0),
        3
    )


    cv2.putText(
        frame,
        f"Confidence: {confidence * 100:.1f}%",
        (40, 115),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.65,
        (255, 255, 255),
        2
    )


    cv2.imshow(
        "SignBridge AI - Alphabet Test",
        frame
    )


    # ========================================================
    # QUIT
    # ========================================================

    key = cv2.waitKey(1) & 0xFF

    if key == ord("q"):

        break


# ============================================================
# CLEANUP
# ============================================================

cap.release()

cv2.destroyAllWindows()

hands.close()

print("\n✅ Alphabet test finished.")