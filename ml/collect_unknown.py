import cv2
import mediapipe as mp
import csv
import os
import time

SAMPLES = 300

dataset_folder = os.path.abspath(
    os.path.join(
        os.path.dirname(__file__),
        "..",
        "dataset"
    )
)

os.makedirs(dataset_folder, exist_ok=True)

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


def normalize_landmarks(hand_landmarks):

    wrist = hand_landmarks[0]

    features = []

    for landmark in hand_landmarks:

        x = landmark.x - wrist.x
        y = landmark.y - wrist.y
        z = landmark.z - wrist.z

        features.extend([x, y, z])

    return features


cap = cv2.VideoCapture(0)

if not cap.isOpened():

    print("Could not access webcam.")
    exit()


print("\n====================================")
print(" SIGNBRIDGE AI - UNKNOWN COLLECTION")
print("====================================")

print("\nYou will collect 300 UNKNOWN samples.")

print("\nIMPORTANT:")
print("Do NOT show:")
print("HELLO")
print("YES")
print("NO")
print("HELP")
print("THANK YOU")

print("\nInstead show different random gestures such as:")
print("Fist")
print("One finger")
print("Two fingers")
print("Three fingers")
print("Open palm")
print("Thumbs up")
print("Random finger positions")
print("Partially closed hand")
print("Sideways hand")

input("\nPress ENTER when you are ready...")

csv_path = os.path.join(
    dataset_folder,
    "unknown.csv"
)

sample_count = 0

with open(
    csv_path,
    mode="w",
    newline=""
) as file:

    writer = csv.writer(file)

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

    print("\nSTART!")
    print("Show different random gestures.")

    with HandLandmarker.create_from_options(options) as landmarker:

        while sample_count < SAMPLES:

            success, frame = cap.read()

            if not success:

                print("Camera frame error.")

                break

            frame = cv2.flip(frame, 1)

            rgb_frame = cv2.cvtColor(
                frame,
                cv2.COLOR_BGR2RGB
            )

            mp_image = mp.Image(
                image_format=mp.ImageFormat.SRGB,
                data=rgb_frame
            )

            result = landmarker.detect(mp_image)

            if result.hand_landmarks:

                hand = result.hand_landmarks[0]

                features = normalize_landmarks(hand)

                writer.writerow(
                    ["unknown"] + features
                )

                sample_count += 1

                cv2.putText(
                    frame,
                    "UNKNOWN DATA",
                    (20, 40),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.9,
                    (0, 255, 0),
                    2
                )

                cv2.putText(
                    frame,
                    f"Samples: {sample_count}/{SAMPLES}",
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
                "SignBridge AI - Unknown Data Collection",
                frame
            )

            key = cv2.waitKey(1) & 0xFF

            if key == ord("q"):

                print("\nCollection stopped.")

                cap.release()
                cv2.destroyAllWindows()

                exit()


cap.release()
cv2.destroyAllWindows()

print("\n====================================")
print(" UNKNOWN DATA COLLECTION COMPLETE")
print("====================================")

print(f"\nSamples collected: {sample_count}")
print(f"Dataset saved to:")
print(csv_path)