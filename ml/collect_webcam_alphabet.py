import cv2
import mediapipe as mp
import numpy as np
import csv
import os
import time

# ============================================================
# SETTINGS
# ============================================================

SAMPLES_PER_LETTER = 100
OUTPUT_FOLDER = os.path.join(
    os.path.dirname(__file__),
    "webcam_alphabet_dataset"
)

os.makedirs(OUTPUT_FOLDER, exist_ok=True)

LETTERS = list("ABCDEFGHIJKLMNOPQRSTUVWXYZ")

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

        features.extend([x, y, z])

    return features


# ============================================================
# SAVE CSV
# ============================================================

def save_samples(letter, samples):

    file_path = os.path.join(
        OUTPUT_FOLDER,
        f"{letter}.csv"
    )

    with open(
        file_path,
        "w",
        newline=""
    ) as file:

        writer = csv.writer(file)

        writer.writerow(
            ["label"] + [f"f{i}" for i in range(63)]
        )

        for features in samples:
            writer.writerow(
                [letter] + features
            )

    print(f"Saved {len(samples)} samples for {letter}")


# ============================================================
# MAIN
# ============================================================

cap = cv2.VideoCapture(0)

if not cap.isOpened():
    print("ERROR: Could not open webcam.")
    exit()

current_letter_index = 0
current_letter = LETTERS[current_letter_index]

samples = []

print()
print("==============================================")
print("   SIGNBRIDGE AI - ALPHABET DATA COLLECTOR")
print("==============================================")
print()
print("Controls:")
print("A-Z  -> Select alphabet")
print("SPACE -> Start/stop collecting")
print("Q     -> Quit")
print()
print(f"Current letter: {current_letter}")
print()

collecting = False

while True:

    ret, frame = cap.read()

    if not ret:
        print("ERROR: Could not read webcam frame.")
        break

    frame = cv2.flip(frame, 1)

    rgb = cv2.cvtColor(
        frame,
        cv2.COLOR_BGR2RGB
    )

    results = hands.process(rgb)

    hand_detected = False

    if results.multi_hand_landmarks:

        hand_detected = True

        hand_landmarks = results.multi_hand_landmarks[0]

        mp_drawing.draw_landmarks(
            frame,
            hand_landmarks,
            mp_hands.HAND_CONNECTIONS
        )

        if collecting and len(samples) < SAMPLES_PER_LETTER:

            features = extract_features(
                hand_landmarks.landmark
            )

            if len(features) == 63:

                samples.append(features)

    # ========================================================
    # UI
    # ========================================================

    cv2.rectangle(
        frame,
        (0, 0),
        (640, 120),
        (0, 0, 0),
        -1
    )

    cv2.putText(
        frame,
        f"LETTER: {current_letter}",
        (20, 35),
        cv2.FONT_HERSHEY_SIMPLEX,
        1,
        (255, 255, 255),
        2
    )

    cv2.putText(
        frame,
        f"SAMPLES: {len(samples)}/{SAMPLES_PER_LETTER}",
        (20, 70),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.8,
        (255, 255, 255),
        2
    )

    status = "COLLECTING" if collecting else "PAUSED"

    cv2.putText(
        frame,
        status,
        (20, 105),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        (255, 255, 255),
        2
    )

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

    # ========================================================
    # LETTER COMPLETE
    # ========================================================

    if len(samples) >= SAMPLES_PER_LETTER:

        collecting = False

        save_samples(
            current_letter,
            samples
        )

        print()
        print(
            f"{current_letter} completed!"
        )

        if current_letter_index < len(LETTERS) - 1:

            current_letter_index += 1

            current_letter = LETTERS[
                current_letter_index
            ]

            samples = []

            print(
                f"Next letter: {current_letter}"
            )

        else:

            print()
            print("==============================================")
            print("ALL A-Z LETTERS COMPLETED!")
            print("==============================================")
            print()

            cv2.putText(
                frame,
                "ALL LETTERS COMPLETED!",
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
        "SignBridge AI - Alphabet Collector",
        frame
    )

    key = cv2.waitKey(1) & 0xFF

    # --------------------------------------------------------
    # QUIT
    # --------------------------------------------------------

    if key == ord("q"):

        print("Stopping collector...")
        break

    # --------------------------------------------------------
    # START / STOP COLLECTION
    # --------------------------------------------------------

    elif key == 32:

        collecting = not collecting

        if collecting:
            print(
                f"Collecting {current_letter}..."
            )
        else:
            print(
                f"Paused {current_letter}"
            )

    # --------------------------------------------------------
    # MANUAL LETTER SELECTION
    # --------------------------------------------------------

    elif chr(key).upper() in LETTERS:

        selected_letter = chr(key).upper()

        current_letter_index = LETTERS.index(
            selected_letter
        )

        current_letter = selected_letter

        samples = []

        collecting = False

        print()
        print(
            f"Selected letter: {current_letter}"
        )

cap.release()
cv2.destroyAllWindows()
hands.close()

print()
print("Collector closed.")
print(
    f"Dataset saved at: {OUTPUT_FOLDER}"
)