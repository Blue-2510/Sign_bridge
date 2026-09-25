import cv2
import mediapipe as mp
import csv
import os
import time

# --------------------------------------------------
# SETTINGS
# --------------------------------------------------

SAMPLES_PER_SIGN = 200

SIGNS = [
    "hello",
    "yes",
    "no",
    "help",
    "thank_you",
    "unknown"
]

# --------------------------------------------------
# MEDIA PIPE SETUP
# --------------------------------------------------

MODEL_PATH = os.path.join(
    os.path.dirname(__file__),
    "models",
    "hand_landmarker.task"
)

BaseOptions = mp.tasks.BaseOptions
VisionRunningMode = mp.tasks.vision.RunningMode
HandLandmarker = mp.tasks.vision.HandLandmarker
HandLandmarkerOptions = mp.tasks.vision.HandLandmarkerOptions

options = HandLandmarkerOptions(
    base_options=BaseOptions(
        model_asset_path=MODEL_PATH
    ),
    running_mode=VisionRunningMode.IMAGE,
    num_hands=1
)

# --------------------------------------------------
# CREATE DATASET FOLDER
# --------------------------------------------------

dataset_folder = os.path.join(
    os.path.dirname(__file__),
    "..",
    "dataset"
)

dataset_folder = os.path.abspath(dataset_folder)

os.makedirs(dataset_folder, exist_ok=True)

# --------------------------------------------------
# LANDMARK NORMALIZATION
# --------------------------------------------------

def normalize_landmarks(hand_landmarks):

    # Use wrist as the reference point
    wrist = hand_landmarks[0]

    normalized = []

    for landmark in hand_landmarks:

        x = landmark.x - wrist.x
        y = landmark.y - wrist.y
        z = landmark.z - wrist.z

        normalized.extend([x, y, z])

    return normalized


# --------------------------------------------------
# START CAMERA
# --------------------------------------------------

cap = cv2.VideoCapture(0)

if not cap.isOpened():
    print("❌ Could not access webcam.")
    exit()

print("\n====================================")
print("      SIGNBRIDGE AI DATA COLLECTOR")
print("====================================")

print("\nSigns to collect:")

for i, sign in enumerate(SIGNS, start=1):
    print(f"{i}. {sign}")

print("\nPress Q anytime to quit.")

# --------------------------------------------------
# MEDIA PIPE
# --------------------------------------------------

with HandLandmarker.create_from_options(options) as landmarker:

    for sign in SIGNS:

        print("\n------------------------------------")
        print(f"Current sign: {sign.upper()}")
        print("------------------------------------")

    if sign == "unknown":

           input(
                "\nUNKNOWN gesture collection.\n"
                "Show random hand gestures that are NOT "
                "HELLO, YES, NO, HELP, or THANK YOU.\n"
                "You can change your hand position/shape during collection.\n"
                "Press ENTER when ready..."
            )

    else:

            input(
                 f"\nGet ready to show the sign '{sign.upper()}'. "
                 "Press ENTER when ready..."
            )
        # CSV file for this sign
            csv_path = os.path.join(
            dataset_folder,
            f"{sign}.csv"
           )

            sample_count = 0

        # Open CSV
            with open(
            csv_path,
            mode="w",
            newline=""
           ) as file:

             writer = csv.writer(file)

            # Header
            header = ["label"]

            for i in range(1, 22):
                header.extend([
                    f"x{i}",
                    f"y{i}",
                    f"z{i}"
                ])

            writer.writerow(header)

            print("\nStarting in:")

            for countdown in [3, 2, 1]:
                print(countdown)
                time.sleep(1)

            print("START!")

            while sample_count < SAMPLES_PER_SIGN:

                success, frame = cap.read()

                if not success:
                    print("❌ Camera frame error.")
                    break

                # Mirror camera
                frame = cv2.flip(frame, 1)

                # Convert BGR → RGB
                rgb_frame = cv2.cvtColor(
                    frame,
                    cv2.COLOR_BGR2RGB
                )

                # MediaPipe image
                mp_image = mp.Image(
                    image_format=mp.ImageFormat.SRGB,
                    data=rgb_frame
                )

                # Detect hand
                result = landmarker.detect(mp_image)

                if result.hand_landmarks:

                    hand = result.hand_landmarks[0]

                    # Normalize landmarks
                    features = normalize_landmarks(hand)

                    # Save data
                    writer.writerow(
                        [sign] + features
                    )

                    sample_count += 1

                    # Display status
                    cv2.putText(
                        frame,
                        f"Collecting: {sign.upper()}",
                        (20, 40),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.9,
                        (0, 255, 0),
                        2
                    )

                    cv2.putText(
                        frame,
                        f"Samples: {sample_count}/{SAMPLES_PER_SIGN}",
                        (20, 80),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.8,
                        (0, 255, 255),
                        2
                    )

                else:

                    cv2.putText(
                        frame,
                        "Show your hand",
                        (20, 40),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.9,
                        (0, 0, 255),
                        2
                    )

                cv2.imshow(
                    "SignBridge AI - Dataset Collection",
                    frame
                )

                # Q = quit
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    cap.release()
                    cv2.destroyAllWindows()

                    print("\nCollection stopped.")
                    exit()

            print(
            f"\n✅ {sign.upper()} completed: "
            f"{sample_count} samples"
        )

cap.release()
cv2.destroyAllWindows()

print("\n====================================")
print("      DATA COLLECTION COMPLETE")
print("====================================")

print(f"\nDataset saved in:")
print(dataset_folder)