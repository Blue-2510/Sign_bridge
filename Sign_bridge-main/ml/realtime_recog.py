import cv2
import mediapipe as mp
import joblib
import os


# ==================================================
# PATHS
# ==================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

MODEL_PATH = os.path.join(
    BASE_DIR,
    "models",
    "sign_model.pkl"
)

HAND_MODEL_PATH = os.path.join(
    BASE_DIR,
    "models",
    "hand_landmarker.task"
)


# ==================================================
# LOAD ML MODEL
# ==================================================

print("Loading SignBridge AI model...")

model = joblib.load(MODEL_PATH)

print("✅ Sign classification model loaded!")


# ==================================================
# MEDIAPIPE SETUP
# ==================================================

BaseOptions = mp.tasks.BaseOptions

VisionRunningMode = mp.tasks.vision.RunningMode

HandLandmarker = mp.tasks.vision.HandLandmarker

HandLandmarkerOptions = (
    mp.tasks.vision.HandLandmarkerOptions
)


options = HandLandmarkerOptions(
    base_options=BaseOptions(
        model_asset_path=HAND_MODEL_PATH
    ),

    running_mode=VisionRunningMode.IMAGE,

    num_hands=1
)


# ==================================================
# LANDMARK NORMALIZATION
# IMPORTANT:
# This must be the SAME normalization used
# during dataset collection.
# ==================================================

def normalize_landmarks(hand_landmarks):

    wrist = hand_landmarks[0]

    features = []

    for landmark in hand_landmarks:

        x = landmark.x - wrist.x
        y = landmark.y - wrist.y
        z = landmark.z - wrist.z

        features.extend([
            x,
            y,
            z
        ])

    return features


# ==================================================
# DRAW LANDMARKS
# ==================================================

def draw_landmarks(frame, hand_landmarks):

    height, width, _ = frame.shape

    connections = [
        (0, 1), (1, 2), (2, 3), (3, 4),
        (0, 5), (5, 6), (6, 7), (7, 8),
        (0, 9), (9, 10), (10, 11), (11, 12),
        (0, 13), (13, 14), (14, 15), (15, 16),
        (0, 17), (17, 18), (18, 19), (19, 20),
        (5, 9),
        (9, 13),
        (13, 17)
    ]

    points = []

    for landmark in hand_landmarks:

        x = int(landmark.x * width)

        y = int(landmark.y * height)

        points.append((x, y))

        cv2.circle(
            frame,
            (x, y),
            5,
            (0, 255, 0),
            -1
        )

    for start, end in connections:

        cv2.line(
            frame,
            points[start],
            points[end],
            (0, 255, 0),
            2
        )


# ==================================================
# START CAMERA
# ==================================================

cap = cv2.VideoCapture(0)

if not cap.isOpened():

    print("❌ Could not open webcam.")

    exit()


print("✅ Webcam opened successfully!")

print("Show one of your trained signs.")

print("Press Q to quit.")


# ==================================================
# MEDIAPIPE
# ==================================================

with HandLandmarker.create_from_options(
    options
) as landmarker:

    while True:

        success, frame = cap.read()

        if not success:

            print("❌ Could not read camera frame.")

            break


        # Mirror camera
        frame = cv2.flip(
            frame,
            1
        )


        # --------------------------------------------------
        # CONVERT IMAGE
        # --------------------------------------------------

        rgb_frame = cv2.cvtColor(
            frame,
            cv2.COLOR_BGR2RGB
        )


        mp_image = mp.Image(
            image_format=mp.ImageFormat.SRGB,
            data=rgb_frame
        )


        # --------------------------------------------------
        # DETECT HAND
        # --------------------------------------------------

        result = landmarker.detect(
            mp_image
        )


        # --------------------------------------------------
        # DEFAULT TEXT
        # --------------------------------------------------

        predicted_sign = "Show your hand"

        confidence_text = ""


        # --------------------------------------------------
        # IF HAND FOUND
        # --------------------------------------------------

        if result.hand_landmarks:

            hand = result.hand_landmarks[0]


            # Draw landmarks
            draw_landmarks(
                frame,
                hand
            )


            # Normalize landmarks
            features = normalize_landmarks(
                hand
            )


            # Convert to model input
            X = [features]


            # --------------------------------------------------
            # PREDICTION
            # --------------------------------------------------

            prediction = model.predict(X)

            predicted_sign = prediction[0]


            # --------------------------------------------------
            # CONFIDENCE
            # --------------------------------------------------

            probabilities = model.predict_proba(X)

            confidence = max(
                probabilities[0]
            )

            confidence_percent = confidence * 100


            confidence_text = (
                f"Confidence: "
                f"{confidence_percent:.1f}%"
            )


            # --------------------------------------------------
            # LOW CONFIDENCE
            # --------------------------------------------------

            if confidence < 0.60:

                predicted_sign = "Uncertain"


        # ==================================================
        # DISPLAY RESULT
        # ==================================================

        cv2.rectangle(
            frame,
            (0, 0),
            (frame.shape[1], 125),
            (20, 20, 20),
            -1
        )


        cv2.putText(
            frame,
            "SIGNBRIDGE AI",
            (25, 35),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.9,
            (255, 255, 255),
            2
        )


        cv2.putText(
            frame,
            f"Sign: {predicted_sign.upper()}",
            (25, 75),
            cv2.FONT_HERSHEY_SIMPLEX,
            1.0,
            (0, 255, 0),
            2
        )


        cv2.putText(
            frame,
            confidence_text,
            (25, 108),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (0, 255, 255),
            2
        )


        cv2.imshow(
            "SignBridge AI - Real-Time Sign Recognition",
            frame
        )


        # ==================================================
        # QUIT
        # ==================================================

        if cv2.waitKey(1) & 0xFF == ord("q"):

            break


# ==================================================
# CLEANUP
# ==================================================

cap.release()

cv2.destroyAllWindows()

print("\nCamera closed.")