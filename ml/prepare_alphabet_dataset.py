import os
import csv
import cv2
import mediapipe as mp

# ============================================================
# SETTINGS
# ============================================================

DATASET_PATH = os.path.join(
    os.path.dirname(__file__),
    "asl_alphabet_train"
)

OUTPUT_FOLDER = os.path.join(
    os.path.dirname(__file__),
    "alphabet_dataset"
)

COMBINED_CSV = os.path.join(
    OUTPUT_FOLDER,
    "alphabet_features.csv"
)

LETTERS = list("ABCDEFGHIJKLMNOPQRSTUVWXYZ")

# ============================================================
# CREATE OUTPUT FOLDER
# ============================================================

os.makedirs(OUTPUT_FOLDER, exist_ok=True)

# ============================================================
# MEDIAPIPE
# ============================================================

mp_hands = mp.solutions.hands

hands = mp_hands.Hands(
    static_image_mode=True,
    max_num_hands=1,
    min_detection_confidence=0.5
)

# ============================================================
# CSV HEADER
# ============================================================

header = ["label"]

for i in range(63):
    header.append(f"f{i}")

# ============================================================
# STATISTICS
# ============================================================

total_images = 0
successful_images = 0
failed_images = 0

letter_success = {}
letter_failed = {}

# ============================================================
# OPEN COMBINED CSV
# ============================================================

with open(
    COMBINED_CSV,
    "w",
    newline="",
    encoding="utf-8"
) as combined_file:

    combined_writer = csv.writer(combined_file)
    combined_writer.writerow(header)

    # ========================================================
    # PROCESS A-Z
    # ========================================================

    for letter in LETTERS:

        letter_folder = os.path.join(
            DATASET_PATH,
            letter
        )

        if not os.path.isdir(letter_folder):

            print(
                f"\nWARNING: Folder not found: {letter_folder}"
            )

            continue

        image_files = [
            file
            for file in os.listdir(letter_folder)
            if file.lower().endswith(
                (".jpg", ".jpeg", ".png")
            )
        ]

        print("\n========================================")
        print(f"Processing {letter}")
        print(f"Images found: {len(image_files)}")
        print("========================================")

        letter_success[letter] = 0
        letter_failed[letter] = 0

        # ----------------------------------------------------
        # LETTER CSV
        # ----------------------------------------------------

        letter_csv = os.path.join(
            OUTPUT_FOLDER,
            f"{letter}.csv"
        )

        with open(
            letter_csv,
            "w",
            newline="",
            encoding="utf-8"
        ) as letter_file:

            letter_writer = csv.writer(letter_file)
            letter_writer.writerow(header)

            # ------------------------------------------------
            # PROCESS IMAGES
            # ------------------------------------------------

            for index, image_file in enumerate(
                image_files,
                start=1
            ):

                total_images += 1

                image_path = os.path.join(
                    letter_folder,
                    image_file
                )

                image = cv2.imread(image_path)

                if image is None:

                    failed_images += 1
                    letter_failed[letter] += 1

                    print(
                        f"FAILED: {image_file}"
                    )

                    continue

                # --------------------------------------------
                # BGR -> RGB
                # --------------------------------------------

                image_rgb = cv2.cvtColor(
                    image,
                    cv2.COLOR_BGR2RGB
                )

                # --------------------------------------------
                # MEDIAPIPE
                # --------------------------------------------

                results = hands.process(
                    image_rgb
                )

                # --------------------------------------------
                # NO HAND
                # --------------------------------------------

                if (
                    not results.multi_hand_landmarks
                    or
                    len(results.multi_hand_landmarks) == 0
                ):

                    failed_images += 1
                    letter_failed[letter] += 1

                    continue

                # --------------------------------------------
                # FIRST HAND
                # --------------------------------------------

                landmarks = (
                    results.multi_hand_landmarks[0]
                )

                if len(landmarks.landmark) != 21:

                    failed_images += 1
                    letter_failed[letter] += 1

                    continue

                # --------------------------------------------
                # WRIST = LANDMARK 0
                # --------------------------------------------

                wrist = landmarks.landmark[0]

                features = []

                # --------------------------------------------
                # CREATE 63 NORMALIZED FEATURES
                # SAME FORMAT AS SIGNBRIDGE
                # --------------------------------------------

                for landmark in landmarks.landmark:

                    x = (
                        landmark.x
                        -
                        wrist.x
                    )

                    y = (
                        landmark.y
                        -
                        wrist.y
                    )

                    z = (
                        landmark.z
                        -
                        wrist.z
                    )

                    features.append(x)
                    features.append(y)
                    features.append(z)

                # --------------------------------------------
                # VERIFY 63 FEATURES
                # --------------------------------------------

                if len(features) != 63:

                    failed_images += 1
                    letter_failed[letter] += 1

                    continue

                # --------------------------------------------
                # SAVE ROW
                # --------------------------------------------

                row = [letter] + features

                letter_writer.writerow(row)
                combined_writer.writerow(row)

                successful_images += 1
                letter_success[letter] += 1

                # --------------------------------------------
                # PROGRESS
                # --------------------------------------------

                if index % 25 == 0:

                    print(
                        f"{letter}: "
                        f"{index}/{len(image_files)} processed"
                    )

# ============================================================
# CLOSE MEDIAPIPE
# ============================================================

hands.close()

# ============================================================
# FINAL REPORT
# ============================================================

print("\n\n========================================")
print("ALPHABET DATASET PROCESSING COMPLETE")
print("========================================")

print(
    f"Total images processed: {total_images}"
)

print(
    f"Successful images: {successful_images}"
)

print(
    f"Failed images: {failed_images}"
)

print("\nLetter-wise results:")

for letter in LETTERS:

    success = letter_success.get(
        letter,
        0
    )

    failed = letter_failed.get(
        letter,
        0
    )

    print(
        f"{letter}: "
        f"{success} successful, "
        f"{failed} failed"
    )

print("\nOutput folder:")
print(OUTPUT_FOLDER)

print("\nCombined dataset:")
print(COMBINED_CSV)

print("\n========================================")
print("DO NOT TRAIN THE MODEL YET.")
print("First check the results above.")
print("========================================")