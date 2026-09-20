// ============================================================
// SIGNBRIDGE AI
// FRONTEND APPLICATION
// MEDIAPIPE + FLASK + RANDOM FOREST
// ============================================================

// ============================================================
// CONFIGURATION
// ============================================================

const API_URL = "http://127.0.0.1:5000";

const STABLE_FRAMES = 12;
const MIN_CONFIDENCE = 0.90;
const COOLDOWN = 1.2;

const PREDICTION_INTERVAL = 150;

// ============================================================
// GLOBAL VARIABLES
// ============================================================

let cameraStream = null;
let cameraRunning = false;
let predictionRunning = false;

let videoElement = null;
let canvasElement = null;
let canvasContext = null;

let hands = null;
let mediaPipeReady = false;

let lastSign = null;
let stableCount = 0;

let lastAddedSign = null;
let lastAddedTime = 0;

let lastPredictionTime = 0;
let predictionBusy = false;

let sentence = [];

// ============================================================
// NAVIGATION
// ============================================================

function openTranslator() {
    const translator = document.getElementById("translator");

    if (translator) {
        translator.scrollIntoView({
            behavior: "smooth"
        });
    }
}

function openLearning() {
    const learning = document.getElementById("learning");

    if (learning) {
        learning.scrollIntoView({
            behavior: "smooth"
        });
    }
}

// ============================================================
// LOAD MEDIAPIPE HANDS
// ============================================================

function loadMediaPipeScript() {

    return new Promise((resolve, reject) => {

        // Already loaded
        if (typeof Hands !== "undefined") {
            console.log("✅ MediaPipe Hands already loaded.");
            resolve();
            return;
        }

        console.log("Loading MediaPipe Hands...");

        const script = document.createElement("script");

        script.src =
            "https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js";

        script.crossOrigin = "anonymous";

        script.onload = function () {

            console.log("✅ MediaPipe Hands script loaded.");

            resolve();
        };

        script.onerror = function (error) {

            console.error(
                "❌ Failed to load MediaPipe Hands.",
                error
            );

            reject(error);
        };

        document.head.appendChild(script);
    });
}

// ============================================================
// INITIALIZE MEDIAPIPE
// ============================================================

async function initializeMediaPipe() {

    console.log("======================================");
    console.log("Initializing MediaPipe Hands...");
    console.log("======================================");

    try {

        await loadMediaPipeScript();

        if (typeof Hands === "undefined") {

            throw new Error(
                "MediaPipe Hands is still undefined."
            );
        }

        hands = new Hands({

            locateFile: function (file) {

                return (
                    "https://cdn.jsdelivr.net/npm/" +
                    "@mediapipe/hands/" +
                    file
                );
            }

        });

        hands.setOptions({

            maxNumHands: 1,

            modelComplexity: 1,

            minDetectionConfidence: 0.5,

            minTrackingConfidence: 0.5

        });

        hands.onResults(
            onMediaPipeResults
        );

        mediaPipeReady = true;

        updateAIStatus(true);

        console.log(
            "✅ MediaPipe Hands initialized successfully!"
        );

    }

    catch (error) {

        console.error(
            "❌ MediaPipe initialization error:",
            error
        );

        mediaPipeReady = false;

        updateAIStatus(false);

        alert(
            "MediaPipe could not be loaded.\n\n" +
            "Please check your internet connection and make sure " +
            "you are running the website using Live Server."
        );
    }
}

// ============================================================
// UPDATE AI STATUS
// ============================================================

function updateAIStatus(ready) {

    const aiLive =
        document.querySelector(".ai-live");

    if (!aiLive) {
        return;
    }

    if (ready) {

        aiLive.innerText = "● LIVE";

        aiLive.style.color = "#22c55e";

    }

    else {

        aiLive.innerText = "● OFFLINE";

        aiLive.style.color = "#ef4444";

    }
}

// ============================================================
// START CAMERA
// ============================================================

async function startCamera() {

    console.log(
        "Starting camera..."
    );

    if (!mediaPipeReady) {

        alert(
            "MediaPipe is still loading.\n\n" +
            "Please wait a moment and try again."
        );

        return;
    }

    try {

        videoElement =
            document.getElementById(
                "cameraVideo"
            );

        canvasElement =
            document.getElementById(
                "cameraCanvas"
            );

        if (!videoElement) {

            alert(
                "Camera video element not found."
            );

            return;
        }

        if (!canvasElement) {

            console.error(
                "Canvas element not found."
            );

            return;
        }

        canvasContext =
            canvasElement.getContext("2d");

        cameraStream =
            await navigator.mediaDevices.getUserMedia({

                video: {

                    width: {
                        ideal: 640
                    },

                    height: {
                        ideal: 480
                    },

                    facingMode: "user"
                },

                audio: false

            });

        videoElement.srcObject =
            cameraStream;

        await videoElement.play();

        // Wait for actual video dimensions
        if (videoElement.videoWidth > 0) {

            canvasElement.width =
                videoElement.videoWidth;

            canvasElement.height =
                videoElement.videoHeight;

        }

        else {

            canvasElement.width = 640;
            canvasElement.height = 480;

        }

        cameraRunning = true;

        updateCameraUI(true);

        console.log(
            "✅ Camera started successfully."
        );

        startPredictionLoop();

    }

    catch (error) {

        console.error(
            "❌ Camera error:",
            error
        );

        alert(
            "Could not access your camera.\n\n" +
            "Please allow camera permission in your browser."
        );
    }
}

// ============================================================
// STOP CAMERA
// ============================================================

function stopCamera() {

    cameraRunning = false;

    predictionRunning = false;

    predictionBusy = false;

    if (cameraStream) {

        cameraStream
            .getTracks()
            .forEach(function (track) {

                track.stop();

            });

        cameraStream = null;
    }

    if (videoElement) {

        videoElement.srcObject = null;

    }

    if (canvasContext && canvasElement) {

        canvasContext.clearRect(
            0,
            0,
            canvasElement.width,
            canvasElement.height
        );

    }

    updateCameraUI(false);

    console.log(
        "Camera stopped."
    );
}

// ============================================================
// CAMERA UI
// ============================================================

function updateCameraUI(running) {

    const placeholder =
        document.getElementById(
            "cameraPlaceholder"
        );

    const video =
        document.getElementById(
            "cameraVideo"
        );

    const startButton =
        document.getElementById(
            "startCameraButton"
        );

    const status =
        document.getElementById(
            "cameraStatus"
        );

    if (running) {

        if (placeholder) {

            placeholder.style.display =
                "none";
        }

        if (video) {

            video.style.display =
                "block";
        }

        if (startButton) {

            startButton.innerText =
                "Stop Camera";

            startButton.onclick =
                stopCamera;
        }

        if (status) {

            status.innerText =
                "● Camera Active";

            status.style.color =
                "#22c55e";
        }

    }

    else {

        if (placeholder) {

            placeholder.style.display =
                "flex";
        }

        if (video) {

            video.style.display =
                "none";
        }

        if (startButton) {

            startButton.innerText =
                "Start Camera";

            startButton.onclick =
                startCamera;
        }

        if (status) {

            status.innerText =
                "● Ready";

            status.style.color =
                "";
        }
    }
}

// ============================================================
// START PREDICTION LOOP
// ============================================================

function startPredictionLoop() {

    if (predictionRunning) {
        return;
    }

    predictionRunning = true;

    console.log(
        "✅ Prediction loop started."
    );

    predictionFrame();
}

// ============================================================
// PROCESS CAMERA FRAME
// ============================================================

async function predictionFrame() {

    if (!cameraRunning) {

        predictionRunning = false;

        return;
    }

    if (!mediaPipeReady || !hands) {

        console.warn(
            "MediaPipe not ready."
        );

        setTimeout(
            predictionFrame,
            500
        );

        return;
    }

    try {

        if (
            videoElement &&
            videoElement.readyState >= 2
        ) {

            await hands.send({

                image: videoElement

            });
        }

    }

    catch (error) {

        console.error(
            "❌ MediaPipe frame error:",
            error
        );
    }

    setTimeout(
        predictionFrame,
        100
    );
}

// ============================================================
// MEDIAPIPE RESULTS
// ============================================================

function onMediaPipeResults(results) {

    if (!cameraRunning) {
        return;
    }

    // --------------------------------------------------------
    // NO HAND
    // --------------------------------------------------------

    if (
        !results.multiHandLandmarks ||
        results.multiHandLandmarks.length === 0
    ) {

        updateNoHand();

        return;
    }

    // --------------------------------------------------------
    // FIRST HAND
    // --------------------------------------------------------

    const landmarks =
        results.multiHandLandmarks[0];

    if (!landmarks) {
        return;
    }

    // --------------------------------------------------------
    // DRAW LANDMARKS
    // --------------------------------------------------------

    drawHandLandmarks(results);

    // --------------------------------------------------------
    // CREATE 63 NORMALIZED FEATURES
    // --------------------------------------------------------

    const features =
        extractFeatures(landmarks);

    if (!features) {
        return;
    }

    // --------------------------------------------------------
    // SEND TO FLASK
    // --------------------------------------------------------

    sendPrediction(features);
}

// ============================================================
// EXTRACT 63 NORMALIZED FEATURES
// IMPORTANT:
// MUST MATCH collect_data.py
// ============================================================

function extractFeatures(landmarks) {

    if (
        !landmarks ||
        landmarks.length !== 21
    ) {

        console.error(
            "Expected 21 landmarks but received:",
            landmarks ? landmarks.length : 0
        );

        return null;
    }

    // --------------------------------------------------------
    // WRIST = LANDMARK 0
    // Same as collect_data.py
    // --------------------------------------------------------

    const wrist = landmarks[0];

    const features = [];

    // --------------------------------------------------------
    // NORMALIZATION
    //
    // Python:
    //
    // x = landmark.x - wrist.x
    // y = landmark.y - wrist.y
    // z = landmark.z - wrist.z
    //
    // --------------------------------------------------------

    for (let i = 0; i < landmarks.length; i++) {

        const landmark = landmarks[i];

        const x =
            Number(landmark.x) -
            Number(wrist.x);

        const y =
            Number(landmark.y) -
            Number(wrist.y);

        const z =
            Number(landmark.z) -
            Number(wrist.z);

        features.push(x);
        features.push(y);
        features.push(z);
    }

    // --------------------------------------------------------
    // VERIFY 63 FEATURES
    // --------------------------------------------------------

    if (features.length !== 63) {

        console.error(
            "❌ Wrong feature count:",
            features.length
        );

        return null;
    }

    return features;
}

// ============================================================
// SEND FEATURES TO FLASK
// ============================================================

async function sendPrediction(features) {

    // Prevent simultaneous requests

    if (predictionBusy) {
        return;
    }

    // Limit API requests

    const now =
        Date.now();

    if (
        now -
        lastPredictionTime
        <
        PREDICTION_INTERVAL
    ) {

        return;
    }

    lastPredictionTime =
        now;

    predictionBusy = true;

    try {

        const response =
            await fetch(
                `${API_URL}/predict`,
                {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body: JSON.stringify({

                        features:
                            features

                    })

                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            console.error(
                "❌ Backend prediction error:",
                data
            );

            predictionBusy = false;

            return;
        }

        if (
            data.status === "success"
        ) {

            console.log(
                "Prediction:",
                data.sign,
                "Confidence:",
                data.confidence
            );

            updatePrediction(
                data.sign,
                Number(data.confidence)
            );

        }

        else {

            console.error(
                "Prediction failed:",
                data
            );
        }

    }

    catch (error) {

        console.error(
            "❌ Cannot connect to Flask:",
            error
        );

    }

    finally {

        predictionBusy = false;

    }
}

// ============================================================
// DRAW HAND LANDMARKS
// ============================================================

function drawHandLandmarks(results) {

    if (
        !canvasElement ||
        !canvasContext ||
        !videoElement
    ) {

        return;
    }

    canvasContext.clearRect(
        0,
        0,
        canvasElement.width,
        canvasElement.height
    );

    if (
        !results.multiHandLandmarks
    ) {

        return;
    }

    // Hand connections

    const connections = [

        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],

        [0, 5],
        [5, 6],
        [6, 7],
        [7, 8],

        [0, 9],
        [9, 10],
        [10, 11],
        [11, 12],

        [0, 13],
        [13, 14],
        [14, 15],
        [15, 16],

        [0, 17],
        [17, 18],
        [18, 19],
        [19, 20],

        [5, 9],
        [9, 13],
        [13, 17]

    ];

    for (
        const landmarks of
        results.multiHandLandmarks
    ) {

        // ----------------------------------------------------
        // DRAW CONNECTIONS
        // ----------------------------------------------------

        canvasContext.beginPath();

        canvasContext.strokeStyle =
            "#38bdf8";

        canvasContext.lineWidth =
            3;

        connections.forEach(
            function(connection) {

                const start =
                    landmarks[
                        connection[0]
                    ];

                const end =
                    landmarks[
                        connection[1]
                    ];

                canvasContext.moveTo(

                    start.x *
                    canvasElement.width,

                    start.y *
                    canvasElement.height

                );

                canvasContext.lineTo(

                    end.x *
                    canvasElement.width,

                    end.y *
                    canvasElement.height

                );

            }
        );

        canvasContext.stroke();

        // ----------------------------------------------------
        // DRAW LANDMARK POINTS
        // ----------------------------------------------------

        for (
            const landmark of landmarks
        ) {

            canvasContext.beginPath();

            canvasContext.arc(

                landmark.x *
                canvasElement.width,

                landmark.y *
                canvasElement.height,

                5,

                0,

                2 * Math.PI

            );

            canvasContext.fillStyle =
                "#ffffff";

            canvasContext.fill();

        }
    }
}

// ============================================================
// NO HAND UPDATE
// ============================================================

function updateNoHand() {

    const signElement =
        document.getElementById(
            "currentSign"
        );

    const confidenceElement =
        document.getElementById(
            "confidence"
        );

    const confidenceBar =
        document.getElementById(
            "confidenceBar"
        );

    if (signElement) {

        signElement.innerText =
            "—";
    }

    if (confidenceElement) {

        confidenceElement.innerText =
            "0%";
    }

    if (confidenceBar) {

        confidenceBar.style.width =
            "0%";
    }

    stableCount = 0;

    lastSign = null;
}

// ============================================================
// UPDATE PREDICTION
// ============================================================

function updatePrediction(
    sign,
    confidence
) {

    const signElement =
        document.getElementById(
            "currentSign"
        );

    const confidenceElement =
        document.getElementById(
            "confidence"
        );

    const confidenceBar =
        document.getElementById(
            "confidenceBar"
        );

    if (!sign) {
        return;
    }

    // Display sign

    if (signElement) {

        signElement.innerText =
            String(sign).toUpperCase();

    }

    // Convert confidence to percentage

    const percentage =
        Math.max(
            0,
            Math.min(
                100,
                confidence * 100
            )
        );

    if (confidenceElement) {

        confidenceElement.innerText =
            percentage.toFixed(1) +
            "%";

    }

    if (confidenceBar) {

        confidenceBar.style.width =
            percentage +
            "%";

    }

    // Stable sign processing

    processStableSign(
        sign,
        confidence
    );
}

// ============================================================
// STABLE SIGN PROCESSING
// ============================================================

function processStableSign(
    sign,
    confidence
) {

    // Ignore low confidence

    if (
        confidence <
        MIN_CONFIDENCE
    ) {

        stableCount = 0;

        lastSign = null;

        return;
    }

    // Same sign

    if (
        sign ===
        lastSign
    ) {

        stableCount++;

    }

    // New sign

    else {

        lastSign =
            sign;

        stableCount =
            1;
    }

    console.log(
        "Stable:",
        sign,
        stableCount +
        "/" +
        STABLE_FRAMES
    );

    // Sign stable enough

    if (
        stableCount >=
        STABLE_FRAMES
    ) {

        const now =
            Date.now() / 1000;

        const canAdd =
            (
                sign !==
                lastAddedSign
            )
            ||
            (
                now -
                lastAddedTime
                >
                COOLDOWN
            );

        if (canAdd) {

            sentence.push(
                sign
            );

            lastAddedSign =
                sign;

            lastAddedTime =
                now;

            updateSentence();

            console.log(
                "✅ SIGN ADDED:",
                sign
            );

        }

        stableCount = 0;
    }
}

// ============================================================
// UPDATE SENTENCE
// ============================================================

function updateSentence() {

    const element =
        document.getElementById(
            "translatedText"
        );

    if (!element) {
        return;
    }

    if (
        sentence.length === 0
    ) {

        element.innerText =
            "Start signing...";

        return;
    }

    element.innerText =
        sentence
            .join(" ")
            .toUpperCase();
}

// ============================================================
// CLEAR TRANSLATION
// ============================================================

function clearTranslation() {

    sentence = [];

    lastSign = null;

    stableCount = 0;

    lastAddedSign = null;

    lastAddedTime = 0;

    updateSentence();

    const sign =
        document.getElementById(
            "currentSign"
        );

    const confidence =
        document.getElementById(
            "confidence"
        );

    const bar =
        document.getElementById(
            "confidenceBar"
        );

    if (sign) {

        sign.innerText =
            "—";
    }

    if (confidence) {

        confidence.innerText =
            "0%";
    }

    if (bar) {

        bar.style.width =
            "0%";
    }

    console.log(
        "Translation cleared."
    );
}

// ============================================================
// SPEAK TRANSLATION
// ============================================================

function speakTranslation() {

    const text =
        sentence
            .join(" ")
            .trim();

    if (!text) {

        alert(
            "Please translate a sign first."
        );

        return;
    }

    if (
        !("speechSynthesis" in window)
    ) {

        alert(
            "Text-to-speech is not supported by your browser."
        );

        return;
    }

    // Stop previous speech

    window.speechSynthesis.cancel();

    const speech =
        new SpeechSynthesisUtterance(
            text
        );

    speech.lang =
        "en-US";

    speech.rate =
        0.9;

    speech.pitch =
        1;

    speech.volume =
        1;

    speech.onstart =
        function () {

            console.log(
                "🔊 Speech started."
            );
        };

    speech.onend =
        function () {

            console.log(
                "🔊 Speech finished."
            );
        };

    speech.onerror =
        function (error) {

            console.error(
                "Speech error:",
                error
            );
        };

    window.speechSynthesis.speak(
        speech
    );
}

// ============================================================
// CHATBOT
// ============================================================

function sendMessage() {

    const input =
        document.getElementById(
            "chatInput"
        );

    if (!input) {
        return;
    }

    const message =
        input.value.trim();

    if (!message) {
        return;
    }

    alert(
        "AI chatbot will be connected to the backend later."
    );

    input.value = "";
}

// ============================================================
// TEST BACKEND CONNECTION
// ============================================================

async function testBackend() {

    try {

        const response =
            await fetch(
                `${API_URL}/health`
            );

        const data =
            await response.json();

        console.log(
            "✅ Backend response:",
            data
        );

        return true;

    }

    catch (error) {

        console.error(
            "❌ Backend connection failed:",
            error
        );

        return false;
    }
}

// ============================================================
// TEST MODEL
// ============================================================

async function testModel() {

    try {

        const response =
            await fetch(
                `${API_URL}/model-status`
            );

        const data =
            await response.json();

        console.log(
            "✅ Model status:",
            data
        );

        return data.model_loaded === true;

    }

    catch (error) {

        console.error(
            "❌ Model status check failed:",
            error
        );

        return false;
    }
}


// ============================================================
// ALPHABET LESSON + WEBCAM PRACTICE
// ============================================================

const alphabetLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

let learnedAlphabetLetters = new Set();
let selectedAlphabetLetter = "A";

let alphabetPracticeStream = null;
let alphabetPracticeRunning = false;
let alphabetPracticeHands = null;
let alphabetPredictionBusy = false;
let alphabetLastPredictionTime = 0;

let alphabetStableLetter = null;
let alphabetStableCount = 0;

const ALPHABET_PREDICTION_INTERVAL = 180;
const ALPHABET_STABLE_REQUIRED = 4;


// ============================================================
// OPEN ALPHABET LESSON
// ============================================================

function openAlphabetLesson() {

    const modal =
        document.getElementById(
            "alphabetLessonModal"
        );

    if (!modal) {
        console.error(
            "Alphabet lesson modal not found."
        );
        return;
    }

    modal.classList.add("active");

    createAlphabetGrid();

    selectAlphabetLetter("A");

    stopAlphabetPractice();
    function goToNextAlphabetLetter() {

    const currentIndex =
        alphabetLetters.indexOf(
            selectedAlphabetLetter
        );

    if (currentIndex === -1) {
        return;
    }

    const nextIndex =
        currentIndex + 1;

    // All letters completed
    if (nextIndex >= alphabetLetters.length) {

        stopAlphabetPractice();

        updateAlphabetPracticeDisplay(
            selectedAlphabetLetter,
            100,
            "🎉 Amazing! You completed all 26 letters!"
        );

        return;
    }

    const nextLetter =
        alphabetLetters[nextIndex];

    stopAlphabetPractice();

    selectAlphabetLetter(
        nextLetter
    );

    const nextButton =
        document.getElementById(
            "nextAlphabetBtn"
        );

    if (nextButton) {
        nextButton.style.display =
            "none";
    }

    const message =
        document.getElementById(
            "alphabetPracticeMessage"
        );

    if (message) {

        message.textContent =
            "Show the selected letter to the camera.";

    }

    console.log(
        "➡️ Next alphabet letter:",
        nextLetter
    );
}
}


// ============================================================
// CLOSE ALPHABET LESSON
// ============================================================

function closeAlphabetLesson() {

    stopAlphabetPractice();

    const modal =
        document.getElementById(
            "alphabetLessonModal"
        );

    if (modal) {
        modal.classList.remove("active");
    }
}


// ============================================================
// CREATE A-Z GRID
// ============================================================

function createAlphabetGrid() {

    const grid =
        document.getElementById(
            "alphabetGrid"
        );

    if (!grid) {
        return;
    }

    grid.innerHTML = "";

    alphabetLetters.forEach(
        function (letter) {

            const button =
                document.createElement(
                    "button"
                );

            button.type = "button";

            button.className =
                "alphabet-letter";

            button.innerText =
                letter;

            button.onclick =
                function () {

                    selectAlphabetLetter(
                        letter
                    );

                };

            grid.appendChild(button);

        }
    );

}


// ============================================================
// SELECT LETTER
// ============================================================

function selectAlphabetLetter(letter) {

    selectedAlphabetLetter =
        String(letter).toUpperCase();

    const selectedLetter =
        document.getElementById(
            "selectedAlphabet"
        );

    const title =
        document.getElementById(
            "selectedAlphabetTitle"
        );

    const description =
        document.getElementById(
            "selectedAlphabetDescription"
        );

    if (selectedLetter) {

        selectedLetter.innerText =
            selectedAlphabetLetter;

    }

    if (title) {

        title.innerText =
            "Letter " +
            selectedAlphabetLetter;

    }

    if (description) {

        description.innerText =
            "Learn the hand sign for the letter " +
            selectedAlphabetLetter +
            " and practice it using your camera.";

    }

    document
        .querySelectorAll(
            ".alphabet-letter"
        )
        .forEach(
            function (button) {

                button.classList.remove(
                    "selected"
                );

                if (
                    button.innerText ===
                    selectedAlphabetLetter
                ) {

                    button.classList.add(
                        "selected"
                    );

                }

            }
        );

    stopAlphabetPractice();

}


// ============================================================
// START ALPHABET PRACTICE
// ============================================================

async function startAlphabetPractice() {

    const area =
        document.getElementById(
            "alphabetPracticeArea"
        );

    const video =
        document.getElementById(
            "alphabetPracticeVideo"
        );

    const message =
        document.getElementById(
            "alphabetPracticeMessage"
        );

    if (!area || !video) {

        console.error(
            "Alphabet practice elements not found."
        );

        return;
    }

    area.classList.add("active");

    alphabetStableLetter = null;
    alphabetStableCount = 0;

    if (message) {

        message.innerText =
            "Starting camera... Show the sign for " +
            selectedAlphabetLetter +
            ".";

    }

    try {

        if (
            typeof Hands === "undefined"
        ) {

            await loadMediaPipeScript();

        }

        if (!alphabetPracticeHands) {

            alphabetPracticeHands =
                new Hands({

                    locateFile:
                        function (file) {

                            return (
                                "https://cdn.jsdelivr.net/npm/" +
                                "@mediapipe/hands/" +
                                file
                            );

                        }

                });

            alphabetPracticeHands.setOptions({

                maxNumHands: 1,

                modelComplexity: 1,

                minDetectionConfidence: 0.5,

                minTrackingConfidence: 0.5

            });

            alphabetPracticeHands.onResults(
                onAlphabetPracticeResults
            );

        }

        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia
        ) {

            throw new Error(
                "Camera access is not available."
            );

        }

        alphabetPracticeStream =
            await navigator.mediaDevices.getUserMedia({

                video: {

                    width: {
                        ideal: 640
                    },

                    height: {
                        ideal: 480
                    },

                    facingMode: "user"

                },

                audio: false

            });

        video.srcObject =
            alphabetPracticeStream;

        await video.play();

        alphabetPracticeRunning = true;

        if (message) {

            message.innerText =
                "Camera active. Show the sign for " +
                selectedAlphabetLetter +
                ".";

        }

        processAlphabetPracticeFrame();

        console.log(
            "Alphabet practice started:",
            selectedAlphabetLetter
        );

    }

    catch (error) {

        console.error(
            "Alphabet practice camera error:",
            error
        );

        if (message) {

            message.innerText =
                "Could not access the camera. " +
                "Please allow camera permission.";

        }

    }

}


// ============================================================
// STOP ALPHABET PRACTICE
// ============================================================

function stopAlphabetPractice() {

    alphabetPracticeRunning = false;

    alphabetPredictionBusy = false;

    alphabetStableLetter = null;
    alphabetStableCount = 0;

    if (alphabetPracticeStream) {

        alphabetPracticeStream
            .getTracks()
            .forEach(
                function (track) {

                    track.stop();

                }
            );

        alphabetPracticeStream = null;

    }

    const video =
        document.getElementById(
            "alphabetPracticeVideo"
        );

    if (video) {

        video.srcObject = null;

    }

    const area =
        document.getElementById(
            "alphabetPracticeArea"
        );

    if (area) {

        area.classList.remove(
            "active"
        );

    }

    resetAlphabetPracticeUI();

}


// ============================================================
// PROCESS ALPHABET CAMERA FRAME
// ============================================================

async function processAlphabetPracticeFrame() {

    if (!alphabetPracticeRunning) {
        return;
    }

    const video =
        document.getElementById(
            "alphabetPracticeVideo"
        );

    if (
        !video ||
        !alphabetPracticeHands
    ) {

        return;
    }

    try {

        if (
            video.readyState >= 2
        ) {

            await alphabetPracticeHands.send({
                image: video
            });

        }

    }

    catch (error) {

        console.error(
            "Alphabet MediaPipe error:",
            error
        );

    }

    if (alphabetPracticeRunning) {

        requestAnimationFrame(
            processAlphabetPracticeFrame
        );

    }

}


// ============================================================
// ALPHABET MEDIAPIPE RESULTS
// ============================================================

function onAlphabetPracticeResults(
    results
) {

    if (!alphabetPracticeRunning) {
        return;
    }

    if (
        !results.multiHandLandmarks ||
        results.multiHandLandmarks.length === 0
    ) {

        updateAlphabetPracticeDisplay(
            "—",
            0,
            "Show your hand clearly to the camera."
        );

        return;
    }

    const landmarks =
        results.multiHandLandmarks[0];

    const features =
        extractAlphabetFeatures(
            landmarks
        );

    if (!features) {
        return;
    }

    const now = Date.now();

    if (
        alphabetPredictionBusy ||
        now -
        alphabetLastPredictionTime <
        ALPHABET_PREDICTION_INTERVAL
    ) {

        return;
    }

    alphabetLastPredictionTime =
        now;

    predictAlphabetLetter(
        features
    );

}


// ============================================================
// EXTRACT 63 ALPHABET FEATURES
// SAME FORMAT AS WEBCAM DATASET
// ============================================================

function extractAlphabetFeatures(
    landmarks
) {

    if (
        !landmarks ||
        landmarks.length !== 21
    ) {

        return null;

    }

    const wrist =
        landmarks[0];

    const features = [];

    for (
        let i = 0;
        i < landmarks.length;
        i++
    ) {

        const landmark =
            landmarks[i];

        const x =
            Number(landmark.x) -
            Number(wrist.x);

        const y =
            Number(landmark.y) -
            Number(wrist.y);

        const z =
            Number(landmark.z) -
            Number(wrist.z);

        features.push(x);
        features.push(y);
        features.push(z);

    }

    if (
        features.length !== 63
    ) {

        return null;

    }

    return features;

}


// ============================================================
// SEND ALPHABET FEATURES TO FLASK
// ============================================================

async function predictAlphabetLetter(
    features
) {

    alphabetPredictionBusy = true;

    try {

        const response =
            await fetch(
                `${API_URL}/predict-alphabet`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        features: features
                    })
                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            throw new Error(
                data.message ||
                "Alphabet prediction failed."
            );

        }

        if (
            data.status !==
            "success"
        ) {

            throw new Error(
                data.message ||
                "Alphabet prediction failed."
            );

        }

        const letter =
            String(
                data.letter || "?"
            ).toUpperCase();

        const confidence =
            Number(
                data.confidence || 0
            );

        const percentage =
            confidence <= 1
                ? confidence * 100
                : confidence;


        // ==========================================
        // UPDATE LIVE PREDICTION
        // ==========================================

        updateAlphabetPracticeDisplay(
            letter,
            percentage,
            "AI is analyzing your hand..."
        );


        // ==========================================
        // STABLE LETTER CHECK
        // ==========================================

        if (
            letter ===
            alphabetStableLetter
        ) {

            alphabetStableCount++;

        }

        else {

            alphabetStableLetter =
                letter;

            alphabetStableCount = 1;

        }


        console.log(
            "Alphabet stable:",
            letter,
            alphabetStableCount +
            "/" +
            ALPHABET_STABLE_REQUIRED
        );


        // ==========================================
        // WRONG LETTER
        // ==========================================

        if (
            letter !==
            selectedAlphabetLetter
        ) {

            updateAlphabetPracticeDisplay(
                letter,
                percentage,
                "AI sees " +
                letter +
                ". Try the sign for " +
                selectedAlphabetLetter +
                "."
            );

            return;
        }


        // ==========================================
        // CORRECT LETTER BUT NOT STABLE YET
        // ==========================================

        if (
            alphabetStableCount <
            ALPHABET_STABLE_REQUIRED
        ) {

            updateAlphabetPracticeDisplay(
                letter,
                percentage,
                "Hold the " +
                selectedAlphabetLetter +
                " sign..."
            );

            return;
        }


        // ==========================================
        // LETTER CONFIRMED
        // ==========================================

        learnedAlphabetLetters.add(
            selectedAlphabetLetter
        );

        updateAlphabetProgress();


        updateAlphabetPracticeDisplay(
            letter,
            percentage,
            "✓ Correct! You are showing " +
            selectedAlphabetLetter +
            ". Letter learned! 🎉"
        );


        // ==========================================
        // CHECK COMPLETE
        // ==========================================

        if (
            learnedAlphabetLetters.size === 26
        ) {

            updateAlphabetPracticeDisplay(
                letter,
                percentage,
                "🎉 Amazing! You completed all 26 letters!"
            );

        }

    }

    catch (error) {

        console.error(
            "Alphabet prediction error:",
            error
        );

        updateAlphabetPracticeDisplay(
            "—",
            0,
            "Alphabet model is not connected yet."
        );

    }

    finally {

        alphabetPredictionBusy =
            false;

    }

}

// ============================================================
// UPDATE ALPHABET PRACTICE DISPLAY
// ============================================================

function updateAlphabetPracticeDisplay(
    letter,
    confidence,
    message
) {

    const prediction =
        document.getElementById(
            "alphabetPrediction"
        );

    const confidenceElement =
        document.getElementById(
            "alphabetConfidence"
        );

    const messageElement =
        document.getElementById(
            "alphabetPracticeMessage"
        );

    if (prediction) {

        prediction.innerText =
            letter;

    }

    if (confidenceElement) {

        confidenceElement.innerText =
            Number(confidence).toFixed(1) +
            "%";

    }

    if (messageElement) {

        messageElement.innerText =
            message;

    }

}


// ============================================================
// RESET ALPHABET PRACTICE UI
// ============================================================

function resetAlphabetPracticeUI() {

    const prediction =
        document.getElementById(
            "alphabetPrediction"
        );

    const confidence =
        document.getElementById(
            "alphabetConfidence"
        );

    const message =
        document.getElementById(
            "alphabetPracticeMessage"
        );

    if (prediction) {

        prediction.innerText =
            "—";

    }

    if (confidence) {

        confidence.innerText =
            "0%";

    }

    if (message) {

        message.innerText =
            "Show the selected letter to the camera.";

    }

}


// ============================================================
// UPDATE ALPHABET PROGRESS
// ============================================================

function updateAlphabetProgress() {

    const progressText =
        document.getElementById(
            "alphabetProgressText"
        );

    const progressBar =
        document.getElementById(
            "alphabetProgressBar"
        );

    const completed =
        learnedAlphabetLetters.size;

    const percentage =
        (completed / 26) * 100;

    if (progressText) {

        progressText.innerText =
            completed +
            " / 26";

    }

    if (progressBar) {

        progressBar.style.width =
            percentage +
            "%";

    }

    document
        .querySelectorAll(
            ".alphabet-letter"
        )
        .forEach(
            function (button) {

                if (
                    learnedAlphabetLetters.has(
                        button.innerText
                    )
                ) {

                    button.classList.add(
                        "learned"
                    );

                }

            }
        );

}


// ============================================================
// BUTTON CONNECTIONS
// ============================================================

function connectButtons() {


        // Alphabet Practice
    const practiceAlphabetButton =
        document.getElementById(
            "practiceAlphabetBtn"
        );

    if (practiceAlphabetButton) {

        practiceAlphabetButton.onclick =
            function () {

                console.log(
                    "🎥 Practice This Letter clicked"
                );

                startAlphabetPractice();

            };

    }
    // Start camera

    const startButton =
        document.getElementById(
            "startCameraButton"
        );

    if (startButton) {

        startButton.onclick =
            startCamera;
    }

    // Speak

    const speakButton =
        document.getElementById(
            "speakButton"
        );

    if (speakButton) {

        speakButton.onclick =
            speakTranslation;
    }

    // Clear

    const clearButton =
        document.getElementById(
            "clearButton"
        );

    if (clearButton) {

        clearButton.onclick =
            clearTranslation;
    }

    // Chat

    const chatButton =
        document.getElementById(
            "sendMessageButton"
        );

    if (chatButton) {

        chatButton.onclick =
            sendMessage;
    }
}

// ============================================================
// PAGE LOAD
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    async function () {

        console.log(
            "======================================"
        );

        console.log(
            "       SIGNBRIDGE AI FRONTEND"
        );

        console.log(
            "======================================"
        );

        // Initial UI

        updateCameraUI(false);

        // Prepare alphabet lesson
        if (
            document.getElementById(
                "alphabetLessonModal"
            )
        ) {
            createAlphabetGrid();
        }

        connectButtons();

        updateSentence();

        // Test Flask

        const backendOK =
            await testBackend();

        if (backendOK) {

            console.log(
                "✅ Flask backend connected."
            );

        }

        else {

            console.warn(
                "⚠️ Flask backend is not reachable."
            );
        }

        // Test ML model

        const modelOK =
            await testModel();

        if (modelOK) {

            console.log(
                "✅ Random Forest model loaded."
            );

        }

        else {

            console.warn(
                "⚠️ ML model is not available."
            );
        }

        // Initialize MediaPipe

        await initializeMediaPipe();

        console.log(
            "======================================"
        );

        console.log(
            "SignBridge AI ready."
        );

        console.log(
            "======================================"
        );

    }
);