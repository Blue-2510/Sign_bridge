import cv2
import mediapipe as mp
import numpy as np
import csv
import os
import time

# ============================================================
# SETTINGS
# ============================================================

SAMPLES_PER_NUMBER = 200

OUTPUT_FOLDER = os.path.join(
    os.path.dirname(__file__),
    "webcam_number_dataset"
)

os.makedirs(
    OUTPUT_FOLDER,
    exist_ok=True
)

NUMBERS = list("0123456789")


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
# SAME AS ALPHABET DATASET
# ============================================================

def extract_features(landmarks):

    wrist = landmarks[0]

    features = []

    for landmark in landmarks:

        x = (
            float(landmark.x)
            - float(wrist.x)
        )

        y = (
            float(landmark.y)
            - float(wrist.y)
        )

        z = (
            float(landmark.z)
            - float(wrist.z)
        )

        features.extend([
            x,
            y,
            z
        ])

    return features


# ============================================================
# SAVE CSV
# ============================================================

def save_samples(number, samples):

    file_path = os.path.join(
        OUTPUT_FOLDER,
        f"{number}.csv"
    )

    with open(
        file_path,
        "w",
        newline=""
    ) as file:

        writer = csv.writer(file)

        writer.writerow(
            ["label"] +
            [f"f{i}" for i in range(63)]
        )

        for features in samples:

            writer.writerow(
                [number] + features
            )

    print(
        f"Saved {len(samples)} samples for {number}"
    )


# ============================================================
# MAIN
# ============================================================

cap = cv2.VideoCapture(0)

if not cap.isOpened():

    print(
        "ERROR: Could not open webcam."
    )

    exit()


current_number_index = 0

current_number = NUMBERS[
    current_number_index
]

samples = []


print()
print("==============================================")
print("   SIGNBRIDGE AI - NUMBER DATA COLLECTOR")
print("==============================================")
print()
print("Numbers: 0 - 9")
print()
print("Controls:")
print("0-9   -> Select number")
print("SPACE -> Start/stop collecting")
print("Q     -> Quit")
print()
print(
    f"Current number: {current_number}"
)
print(
    f"Samples required: {SAMPLES_PER_NUMBER}"
)
print()


collecting = False


# ============================================================
# MAIN LOOP
# ============================================================

while True:

    ret, frame = cap.read()

    if not ret:

        print(
            "ERROR: Could not read webcam frame."
        )

        break


    # Mirror webcam
    frame = cv2.flip(
        frame,
        1
    )


    # Convert BGR → RGB
    rgb = cv2.cvtColor(
        frame,
        cv2.COLOR_BGR2RGB
    )


    # MediaPipe processing
    results = hands.process(
        rgb
    )


    hand_detected = False


    # ========================================================
    # HAND DETECTION
    # ========================================================

    if results.multi_hand_landmarks:

        hand_detected = True

        hand_landmarks = (
            results.multi_hand_landmarks[0]
        )


        # Draw hand landmarks
        mp_drawing.draw_landmarks(
            frame,
            hand_landmarks,
            mp_hands.HAND_CONNECTIONS
        )


        # ====================================================
        # COLLECT FEATURES
        # ====================================================

        if (
            collecting
            and
            len(samples) < SAMPLES_PER_NUMBER
        ):

            features = extract_features(
                hand_landmarks.landmark
            )


            if len(features) == 63:

                samples.append(
                    features
                )


    # ========================================================
    # UI BACKGROUND
    # ========================================================

    cv2.rectangle(
        frame,
        (0, 0),
        (640, 140),
        (0, 0, 0),
        -1
    )


    # ========================================================
    # CURRENT NUMBER
    # ========================================================

    cv2.putText(
        frame,
        f"NUMBER: {current_number}",
        (20, 35),
        cv2.FONT_HERSHEY_SIMPLEX,
        1,
        (255, 255, 255),
        2
    )


    # ========================================================
    # SAMPLE COUNT
    # ========================================================

    cv2.putText(
        frame,
        f"SAMPLES: {len(samples)}/{SAMPLES_PER_NUMBER}",
        (20, 70),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.8,
        (255, 255, 255),
        2
    )


    # ========================================================
    # STATUS
    # ========================================================

    status = (
        "COLLECTING"
        if collecting
        else
        "PAUSED"
    )


    cv2.putText(
        frame,
        status,
        (20, 105),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        (255, 255, 255),
        2
    )


    # ========================================================
    # HAND STATUS
    # ========================================================

    if not hand_detected:

        cv2.putText(
            frame,
            "Show your hand",
            (380, 45),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (255, 255, 255),
            2
        )

    else:

        cv2.putText(
            frame,
            "Hand detected",
            (380, 45),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (0, 255, 0),
            2
        )


    # ========================================================
    # NUMBER COMPLETE
    # ========================================================

    if len(samples) >= SAMPLES_PER_NUMBER:

        collecting = False


        save_samples(
            current_number,
            samples
        )


        print()
        print(
            f"{current_number} completed!"
        )


        # ----------------------------------------------------
        # Move to next number
        # ----------------------------------------------------

        if (
            current_number_index
            <
            len(NUMBERS) - 1
        ):

            current_number_index += 1


            current_number = NUMBERS[
                current_number_index
            ]


            samples = []


            print(
                f"Next number: "
                f"{current_number}"
            )


        else:

            print()
            print("==============================================")
            print("ALL 0-9 NUMBERS COMPLETED!")
            print("==============================================")
            print()


            cv2.putText(
                frame,
                "ALL NUMBERS COMPLETED!",
                (120, 180),
                cv2.FONT_HERSHEY_SIMPLEX,
                1,
                (255, 255, 255),
                3
            )


    # ========================================================
    # DISPLAY
    # ========================================================

    cv2.imshow(
        "SignBridge AI - Number Collector",
        frame
    )


    key = cv2.waitKey(1) & 0xFF


    # ========================================================
    # QUIT
    # ========================================================

    if key == ord("q"):

        print(
            "Stopping collector..."
        )

        break


    # ========================================================
    # START / STOP COLLECTION
    # ========================================================

    elif key == 32:

        collecting = not collecting


        if collecting:

            print(
                f"Collecting "
                f"{current_number}..."
            )

        else:

            print(
                f"Paused "
                f"{current_number}"
            )


    # ========================================================
    # MANUAL NUMBER SELECTION
    # ========================================================

    elif chr(key) in NUMBERS:

        selected_number = chr(key)


        current_number_index = (
            NUMBERS.index(
                selected_number
            )
        )


        current_number = (
            selected_number
        )


        samples = []


        collecting = False


        print()

        print(
            f"Selected number: "
            f"{current_number}"
        )


# ============================================================
# CLEANUP
# ============================================================

cap.release()

cv2.destroyAllWindows()

hands.close()


print()
print(
    "Collector closed."
)

print(
    f"Dataset saved at: "
    f"{OUTPUT_FOLDER}"
)