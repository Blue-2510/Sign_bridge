import cv2
import mediapipe as mp
import joblib
import os
import time
import pyttsx3


# ============================================================
# SIGNBRIDGE AI
# SIGN → TEXT → SPEECH
# ============================================================

print("\n======================================")
print("          SIGNBRIDGE AI")
print("       SIGN → TEXT → SPEECH")
print("======================================\n")


# ============================================================
# PATHS
# ============================================================

BASE_DIR = os.path.dirname(
    os.path.abspath(__file__)
)

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


# ============================================================
# SETTINGS
# ============================================================

STABLE_FRAMES = 12

MIN_CONFIDENCE = 0.70

COOLDOWN = 1.2


# ============================================================
# CHECK FILES
# ============================================================

if not os.path.exists(MODEL_PATH):

    print("❌ ML model not found:")
    print(MODEL_PATH)
    exit()


if not os.path.exists(HAND_MODEL_PATH):

    print("❌ MediaPipe hand model not found:")
    print(HAND_MODEL_PATH)
    exit()


# ============================================================
# LOAD ML MODEL
# ============================================================

print("Loading ML model...")

model = joblib.load(MODEL_PATH)

print("✅ Sign classification model loaded!")


# ============================================================
# TEXT TO SPEECH
# ============================================================

def speak_text(text):

    text = text.strip()

    if not text:

        print("⚠️ Nothing to speak.")

        return

    print("\n======================================")
    print("🔊 SPEAKING")
    print("======================================")
    print(text)
    print("======================================")

    try:

        # Create a NEW engine every time.
        # This avoids the Windows pyttsx3
        # engine getting stuck after the first use.

        engine = pyttsx3.init()

        engine.setProperty(
            "rate",
            150
        )

        engine.setProperty(
            "volume",
            1.0
        )

        # Get available voices
        voices = engine.getProperty(
            "voices"
        )

        # Use first available voice
        if voices:

            engine.setProperty(
                "voice",
                voices[0].id
            )

        engine.say(text)

        engine.runAndWait()

        # Stop the current engine
        engine.stop()

        print("✅ Speech completed.")

    except Exception as e:

        print(
            f"❌ Speech error: {e}"
        )


# ============================================================
# MEDIAPIPE SETUP
# ============================================================

print("Loading MediaPipe...")

BaseOptions = mp.tasks.BaseOptions

VisionRunningMode = (
    mp.tasks.vision.RunningMode
)

HandLandmarker = (
    mp.tasks.vision.HandLandmarker
)

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


print("✅ MediaPipe ready!")


# ============================================================
# LANDMARK NORMALIZATION
# ============================================================

def normalize_landmarks(
    hand_landmarks
):

    # Landmark 0 = wrist
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


# ============================================================
# DRAW HAND LANDMARKS
# ============================================================

def draw_landmarks(
    frame,
    hand_landmarks
):

    height, width, _ = frame.shape

    connections = [

        (0, 1),
        (1, 2),
        (2, 3),
        (3, 4),

        (0, 5),
        (5, 6),
        (6, 7),
        (7, 8),

        (0, 9),
        (9, 10),
        (10, 11),
        (11, 12),

        (0, 13),
        (13, 14),
        (14, 15),
        (15, 16),

        (0, 17),
        (17, 18),
        (18, 19),
        (19, 20),

        (5, 9),
        (9, 13),
        (13, 17)
    ]

    points = []

    # Draw landmark points
    for landmark in hand_landmarks:

        x = int(
            landmark.x * width
        )

        y = int(
            landmark.y * height
        )

        points.append(
            (x, y)
        )

        cv2.circle(

            frame,

            (x, y),

            5,

            (0, 255, 0),

            -1
        )

    # Draw connections
    for start, end in connections:

        cv2.line(

            frame,

            points[start],

            points[end],

            (0, 255, 0),

            2
        )


# ============================================================
# OPEN WEBCAM
# ============================================================

print("Opening webcam...")

cap = cv2.VideoCapture(0)

if not cap.isOpened():

    print(
        "❌ Could not open webcam."
    )

    exit()


print(
    "✅ Webcam opened successfully!"
)


# ============================================================
# SUPPORTED SIGNS
# ============================================================

print("\nSupported signs:")

print("  HELLO")
print("  YES")
print("  NO")
print("  HELP")
print("  THANK YOU")


print("\nControls:")

print("  S → Speak translated sentence")
print("  C → Clear translated sentence")
print("  Q → Quit")


# ============================================================
# SENTENCE VARIABLES
# ============================================================

sentence = []

last_prediction = None

stable_count = 0

last_added_sign = None

last_added_time = 0


# ============================================================
# START MEDIAPIPE
# ============================================================

with HandLandmarker.create_from_options(
    options
) as landmarker:

    while True:

        # ====================================================
        # READ FRAME
        # ====================================================

        success, frame = cap.read()

        if not success:

            print(
                "❌ Could not read camera frame."
            )

            break


        # Mirror webcam
        frame = cv2.flip(
            frame,
            1
        )


        # ====================================================
        # BGR → RGB
        # ====================================================

        rgb_frame = cv2.cvtColor(
            frame,
            cv2.COLOR_BGR2RGB
        )


        mp_image = mp.Image(

            image_format=(
                mp.ImageFormat.SRGB
            ),

            data=rgb_frame
        )


        # ====================================================
        # DETECT HAND
        # ====================================================

        result = landmarker.detect(
            mp_image
        )


        current_sign = "No hand"

        confidence = 0.0


        # ====================================================
        # HAND FOUND
        # ====================================================

        if result.hand_landmarks:

            hand = result.hand_landmarks[0]


            # Draw landmarks
            draw_landmarks(
                frame,
                hand
            )


            # =================================================
            # CREATE 63 FEATURES
            # =================================================

            features = normalize_landmarks(
                hand
            )


            # =================================================
            # ML PREDICTION
            # =================================================

            prediction = model.predict(
                [features]
            )

            current_sign = prediction[0]


            # =================================================
            # CONFIDENCE
            # =================================================

            probabilities = (
                model.predict_proba(
                    [features]
                )
            )

            confidence = max(
                probabilities[0]
            )


            # =================================================
            # CONFIDENCE CHECK
            # =================================================

            if confidence >= MIN_CONFIDENCE:

                # Same prediction
                if (
                    current_sign
                    == last_prediction
                ):

                    stable_count += 1

                else:

                    last_prediction = (
                        current_sign
                    )

                    stable_count = 1


                # =================================================
                # SIGN STABLE
                # =================================================

                if (
                    stable_count
                    >= STABLE_FRAMES
                ):

                    current_time = time.time()


                    # Prevent accidental duplicates
                    if (

                        current_sign
                        != last_added_sign

                        or

                        (
                            current_time
                            - last_added_time
                            > COOLDOWN
                        )

                    ):

                        sentence.append(
                            current_sign
                        )

                        last_added_sign = (
                            current_sign
                        )

                        last_added_time = (
                            current_time
                        )

                        print(
                            f"✅ Added sign: "
                            f"{current_sign}"
                        )


                    stable_count = 0


        # ====================================================
        # NO HAND
        # ====================================================

        else:

            last_prediction = None

            stable_count = 0


        # ====================================================
        # CAMERA DIMENSIONS
        # ====================================================

        height, width, _ = frame.shape


        # ====================================================
        # TOP UI PANEL
        # ====================================================

        cv2.rectangle(

            frame,

            (0, 0),

            (width, 140),

            (25, 25, 25),

            -1
        )


        # ====================================================
        # TITLE
        # ====================================================

        cv2.putText(

            frame,

            "SIGNBRIDGE AI",

            (25, 35),

            cv2.FONT_HERSHEY_SIMPLEX,

            0.9,

            (255, 255, 255),

            2
        )


        # ====================================================
        # CURRENT SIGN
        # ====================================================

        cv2.putText(

            frame,

            f"Sign: {current_sign.upper()}",

            (25, 75),

            cv2.FONT_HERSHEY_SIMPLEX,

            0.9,

            (0, 255, 0),

            2
        )


        # ====================================================
        # CONFIDENCE
        # ====================================================

        cv2.putText(

            frame,

            f"Confidence: "
            f"{confidence * 100:.1f}%",

            (25, 110),

            cv2.FONT_HERSHEY_SIMPLEX,

            0.7,

            (0, 255, 255),

            2
        )


        # ====================================================
        # SENTENCE PANEL
        # ====================================================

        cv2.rectangle(

            frame,

            (0, height - 130),

            (width, height),

            (25, 25, 25),

            -1
        )


        # ====================================================
        # CREATE SENTENCE
        # ====================================================

        sentence_text = " ".join(
            sentence
        )


        if not sentence_text:

            sentence_text = (
                "Start signing..."
            )


        # ====================================================
        # TRANSLATED TEXT LABEL
        # ====================================================

        cv2.putText(

            frame,

            "TRANSLATED TEXT:",

            (20, height - 90),

            cv2.FONT_HERSHEY_SIMPLEX,

            0.6,

            (200, 200, 200),

            2
        )


        # ====================================================
        # TRANSLATED SENTENCE
        # ====================================================

        # Keep text within screen
        display_text = (
            sentence_text.upper()
        )

        if len(display_text) > 40:

            display_text = (
                "..." +
                display_text[-37:]
            )


        cv2.putText(

            frame,

            display_text,

            (20, height - 50),

            cv2.FONT_HERSHEY_SIMPLEX,

            0.8,

            (255, 255, 255),

            2
        )


        # ====================================================
        # CONTROLS
        # ====================================================

        cv2.putText(

            frame,

            "S: SPEAK",

            (width - 220, 35),

            cv2.FONT_HERSHEY_SIMPLEX,

            0.55,

            (0, 255, 0),

            2
        )


        cv2.putText(

            frame,

            "C: CLEAR",

            (width - 220, 65),

            cv2.FONT_HERSHEY_SIMPLEX,

            0.55,

            (0, 255, 255),

            2
        )


        cv2.putText(

            frame,

            "Q: QUIT",

            (width - 220, 95),

            cv2.FONT_HERSHEY_SIMPLEX,

            0.55,

            (0, 150, 255),

            2
        )


        # ====================================================
        # SHOW CAMERA
        # ====================================================

        cv2.imshow(

            "SignBridge AI - "
            "Sign to Text and Speech",

            frame
        )


        # ====================================================
        # KEYBOARD
        # ====================================================

        key = (
            cv2.waitKey(1)
            & 0xFF
        )


        # ====================================================
        # Q → QUIT
        # ====================================================

        if key == ord("q"):

            break


        # ====================================================
        # C → CLEAR
        # ====================================================

        if key == ord("c"):

            sentence.clear()

            last_added_sign = None

            last_prediction = None

            stable_count = 0

            print(
                "\n🗑 Translated text cleared."
            )


        # ====================================================
        # S → SPEAK
        # ====================================================

        if key == ord("s"):

            text_to_speak = " ".join(
                sentence
            ).strip()


            if text_to_speak:

                print(
                    "\n🔊 S key pressed."
                )

                speak_text(
                    text_to_speak
                )

            else:

                print(
                    "\n⚠️ No translated "
                    "text available."
                )


# ============================================================
# CLEANUP
# ============================================================

cap.release()

cv2.destroyAllWindows()


print(
    "\n======================================"
)

print(
    "       SIGNBRIDGE AI CLOSED"
)

print(
    "======================================"
)