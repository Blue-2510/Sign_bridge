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

// ============================================================
// BOTPRESS AI ASSISTANT
// ============================================================

let botpressReady = false;


// ------------------------------------------------------------
// INITIALIZE BOTPRESS
// ------------------------------------------------------------

function initializeBotpressAssistant() {

    if (!window.botpress) {

        console.log("⏳ Waiting for Botpress...");

        setTimeout(
            initializeBotpressAssistant,
            500
        );

        return;
    }


    console.log("🤖 Botpress detected.");


    // --------------------------------------------------------
    // WEBCHAT INITIALIZED
    // --------------------------------------------------------

    window.botpress.on(
        "webchat:initialized",
        function () {

            console.log(
                "✅ Botpress Webchat initialized."
            );


            /*
             * Botpress requires Webchat to become ready
             * before sendMessage() can be used.
             *
             * We open it programmatically.
             * The Botpress UI will be hidden separately,
             * so your SignBridge UI remains unchanged.
             */

            if (
                window.botpress &&
                typeof window.botpress.open === "function"
            ) {

                window.botpress.open();

            }

        }
    );


    // --------------------------------------------------------
    // WEBCHAT READY
    // --------------------------------------------------------

    window.botpress.on(
        "webchat:ready",
        function () {

            botpressReady = true;

            console.log(
                "✅ Botpress is ready for messages."
            );

        }
    );


    // --------------------------------------------------------
    // RECEIVE BOTPRESS MESSAGES
    // --------------------------------------------------------

    window.botpress.on(
        "message",
        function (message) {

            console.log(
                "📩 Botpress message:",
                message
            );


            /*
             * Botpress message direction:
             *
             * incoming = user
             * outgoing = bot
             */

            if (
                message &&
                message.direction === "outgoing"
            ) {

                let reply = "";


                // Normal text response
                if (
                    message.payload &&
                    typeof message.payload.text === "string"
                ) {

                    reply =
                        message.payload.text;

                }


                // Ignore messages that don't contain text
                if (!reply) {

                    console.log(
                        "ℹ️ Botpress message has no text:",
                        message
                    );

                    return;

                }


                console.log(
                    "🤖 Botpress AI:",
                    reply
                );


                // Put Botpress response
                // inside YOUR existing chat UI
                addAssistantMessage(reply);

            }

        }
    );


    // --------------------------------------------------------
    // BOTPRESS ERROR
    // --------------------------------------------------------

    window.botpress.on(
        "error",
        function (error) {

            console.error(
                "❌ Botpress error:",
                error
            );

        }
    );

}


// ------------------------------------------------------------
// SEND MESSAGE FROM YOUR EXISTING UI
// ------------------------------------------------------------

async function sendMessage() {

    const input =
        document.getElementById(
            "chatInput"
        );


    if (!input) {

        console.error(
            "❌ chatInput not found."
        );

        return;

    }


    const message =
        input.value.trim();


    if (!message) {
        return;
    }


    // --------------------------------------------------------
    // SHOW USER MESSAGE IN YOUR EXISTING CHAT
    // --------------------------------------------------------

    addUserMessage(message);


    // Clear input
    input.value = "";


    // --------------------------------------------------------
    // CHECK BOTPRESS
    // --------------------------------------------------------

    if (
        !window.botpress
    ) {

        addAssistantMessage(
            "Sorry, the AI Assistant is currently unavailable."
        );

        console.error(
            "❌ Botpress is not loaded."
        );

        return;

    }


    // --------------------------------------------------------
    // WAIT UNTIL BOTPRESS IS READY
    // --------------------------------------------------------

    if (!botpressReady) {

        addAssistantMessage(
            "⏳ AI Assistant is connecting..."
        );


        console.log(
            "⏳ Botpress is not ready yet."
        );


        return;

    }


    // --------------------------------------------------------
    // SEND TO BOTPRESS
    // --------------------------------------------------------

    try {

        console.log(
            "📤 Sending to Botpress:",
            message
        );


        await window.botpress.sendMessage(
            message
        );


        console.log(
            "✅ Message sent to Botpress."
        );


    }

    catch (error) {

        console.error(
            "❌ Failed to send message to Botpress:",
            error
        );


        addAssistantMessage(
            "Sorry, I couldn't connect to the AI Assistant."
        );

    }

}


// ------------------------------------------------------------
// ADD USER MESSAGE TO YOUR EXISTING CHAT
// ------------------------------------------------------------

function addUserMessage(message) {

    const chatMessages =
        document.querySelector(
            ".chat-messages"
        );


    if (!chatMessages) {

        console.error(
            "❌ .chat-messages not found."
        );

        return;

    }


    const messageElement =
        document.createElement("div");


    messageElement.className =
        "user-message";


    messageElement.textContent =
        message;


    chatMessages.appendChild(
        messageElement
    );


    chatMessages.scrollTop =
        chatMessages.scrollHeight;

}


// ------------------------------------------------------------
// ADD BOTPRESS RESPONSE TO YOUR EXISTING CHAT
// ------------------------------------------------------------

function addAssistantMessage(message) {

    const chatMessages =
        document.querySelector(
            ".chat-messages"
        );


    if (!chatMessages) {

        console.error(
            "❌ .chat-messages not found."
        );

        return;

    }


    const messageElement =
        document.createElement("div");


    messageElement.className =
        "bot-message";


    /*
     * textContent is intentionally used here.
     * It prevents HTML/code returned by the AI
     * from being inserted directly into the page.
     */

    messageElement.textContent =
        message;


    chatMessages.appendChild(
        messageElement
    );


    chatMessages.scrollTop =
        chatMessages.scrollHeight;

}


// ------------------------------------------------------------
// START BOTPRESS WHEN PAGE LOADS
// ------------------------------------------------------------

document.addEventListener(
    "DOMContentLoaded",
    function () {

        initializeBotpressAssistant();

    }
);

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
}

function goToNextAlphabetLetter() {
    const currentIndex = alphabetLetters.indexOf(selectedAlphabetLetter);

    if (currentIndex === -1) {
        return;
    }

    if (currentIndex >= alphabetLetters.length - 1) {
        stopAlphabetPractice();

        updateAlphabetPracticeDisplay(
            selectedAlphabetLetter,
            100,
            "🎉 Amazing! You completed all 26 letters!"
        );

        return;
    }

    const nextLetter = alphabetLetters[currentIndex + 1];

    stopAlphabetPractice();
    selectAlphabetLetter(nextLetter);

    const nextButton = document.getElementById("nextAlphabetBtn");

    if (nextButton) {
        nextButton.style.display = "none";
    }

    const message = document.getElementById("alphabetPracticeMessage");

    if (message) {
        message.textContent =
            "Show the selected letter to the camera.";
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
        updateAlphabetReference(letter);

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
        document.getElementById("alphabetPracticeArea");

    const video =
        document.getElementById("alphabetPracticeVideo");

    const message =
        document.getElementById("alphabetPracticeMessage");

    const cameraStatus =
        document.getElementById("alphabetCameraStatus");

    if (!area || !video) {

        console.error(
            "Alphabet practice elements not found."
        );

        return;
    }


    console.log(
        `🎥 Starting practice for letter: ${selectedAlphabetLetter}`
    );


    // Show practice area
    area.classList.add("active");


    // Reset prediction
    alphabetStableLetter = null;
    alphabetStableCount = 0;
    alphabetPredictionBusy = false;


    const predicted =
        document.getElementById("alphabetPredictedLetter");

    const confidence =
        document.getElementById("alphabetPracticeConfidence");

    if (predicted) {
        predicted.textContent = "—";
    }

    if (confidence) {
        confidence.textContent = "0%";
    }


    if (message) {

        message.textContent =
            `Show the sign for ${selectedAlphabetLetter} to the camera.`;

    }


    if (cameraStatus) {

        cameraStatus.textContent =
            "Starting camera...";

    }


    try {

        // Stop old stream if any
        if (alphabetPracticeStream) {

            alphabetPracticeStream
                .getTracks()
                .forEach(track => track.stop());

        }


        // Get webcam
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


        if (cameraStatus) {

            cameraStatus.textContent =
                "🟢 Camera active";

        }


        if (message) {

            message.textContent =
                `Make the ${selectedAlphabetLetter} sign`;

        }


        // Initialize MediaPipe if required
        if (!alphabetPracticeHands) {

            alphabetPracticeHands =
                new Hands({
                    locateFile: function (file) {

                        return (
                            "https://cdn.jsdelivr.net/npm/@mediapipe/hands/" +
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


        // Start processing
        processAlphabetPracticeFrame();


    } catch (error) {

        console.error(
            "❌ Alphabet practice camera error:",
            error
        );


        alphabetPracticeRunning = false;


        if (cameraStatus) {

            cameraStatus.textContent =
                "❌ Camera could not be started";

        }


        if (message) {

            message.textContent =
                "Please allow camera access and try again.";

        }

    }

}


// ============================================================
// STOP ALPHABET PRACTICE
// ============================================================

function stopAlphabetPractice() {

    alphabetPracticeRunning = false;


    if (alphabetPracticeStream) {

        alphabetPracticeStream
            .getTracks()
            .forEach(track => track.stop());

        alphabetPracticeStream = null;

    }


    const video =
        document.getElementById("alphabetPracticeVideo");

    if (video) {

        video.pause();
        video.srcObject = null;

    }


    const area =
        document.getElementById("alphabetPracticeArea");

    if (area) {

        area.classList.remove("active");

    }


    const cameraStatus =
        document.getElementById("alphabetCameraStatus");

    if (cameraStatus) {

        cameraStatus.textContent =
            "Camera not started";

    }


    console.log(
        "⏹ Alphabet practice stopped"
    );

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

            const confidenceRaw =
            Number(data.confidence || 0);
        
        const percentage =
            Math.max(
                0,
                Math.min(
                    100,
                    confidenceRaw <= 1
                        ? confidenceRaw * 100
                        : confidenceRaw
                )
            );


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
    confidence
) {

    const predicted =
        document.getElementById(
            "alphabetPredictedLetter"
        );

    const confidenceElement =
        document.getElementById(
            "alphabetPracticeConfidence"
        );

    const message =
        document.getElementById(
            "alphabetPracticeMessage"
        );


    if (predicted) {

        predicted.textContent =
            letter || "—";

    }


    if (confidenceElement) {

        confidenceElement.textContent =
            `${Math.round(confidence * 100)}%`;

    }


    if (message && letter) {

        if (
            letter.toUpperCase() ===
            selectedAlphabetLetter.toUpperCase()
        ) {

            message.textContent =
                `✅ Correct! You made the ${selectedAlphabetLetter} sign.`;

        } else {

            message.textContent =
                `🔄 AI detected ${letter}. Try the ${selectedAlphabetLetter} sign again.`;

        }

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
// NUMBERS LESSON
// ============================================================

const lessonNumbers = [
    {
        value: "1",
        title: "Number 1",
        tip: "Practice the sign for number 1."
    },
    {
        value: "2",
        title: "Number 2",
        tip: "Practice the sign for number 2."
    },
    {
        value: "3",
        title: "Number 3",
        tip: "Practice the sign for number 3."
    },
    {
        value: "4",
        title: "Number 4",
        tip: "Practice the sign for number 4."
    },
    {
        value: "5",
        title: "Number 5",
        tip: "Practice the sign for number 5."
    },
    {
        value: "6",
        title: "Number 6",
        tip: "Practice the sign for number 6."
    },
    {
        value: "7",
        title: "Number 7",
        tip: "Practice the sign for number 7."
    },
    {
        value: "8",
        title: "Number 8",
        tip: "Practice the sign for number 8."
    },
    {
        value: "9",
        title: "Number 9",
        tip: "Practice the sign for number 9."
    },
    {
        value: "10",
        title: "Number 10",
        tip: "Practice the sign for number 10."
    }
];

let selectedNumberIndex = 0;

let learnedNumbers = new Set();

let numberPracticeStream = null;

let numberPracticeRunning = false;

let numberPracticeHands = null;

let numberPredictionBusy = false;

let numberStablePrediction = null;

let numberStableCount = 0;

const NUMBER_STABLE_REQUIRED = 4;


// ============================================================
// OPEN NUMBERS LESSON
// ============================================================

function openNumbersLesson() {

    const modal =
        document.getElementById(
            "numbersLessonModal"
        );

    if (!modal) {

        console.error(
            "Numbers lesson modal not found."
        );

        return;
    }

    modal.classList.add("active");

    modal.setAttribute(
        "aria-hidden",
        "false"
    );

    createNumbersGrid();

    selectNumberLesson(
        selectedNumberIndex
    );

    updateNumbersProgress();

    stopNumberPractice();
}


// ============================================================
// CLOSE NUMBERS LESSON
// ============================================================

function closeNumbersLesson() {

    stopNumberPractice();

    const modal =
        document.getElementById(
            "numbersLessonModal"
        );

    if (modal) {

        modal.classList.remove(
            "active"
        );

        modal.setAttribute(
            "aria-hidden",
            "true"
        );
    }
}


// ============================================================
// CREATE NUMBERS GRID
// ============================================================

function createNumbersGrid() {

    const grid =
        document.getElementById(
            "numbersGrid"
        );

    if (!grid) {
        return;
    }

    grid.innerHTML = "";

    lessonNumbers.forEach(
        function (number, index) {

            const button =
                document.createElement(
                    "button"
                );

            button.type = "button";

            button.className =
                "number-item";

            button.innerHTML = `
                <span class="number-item-value">
                    ${number.value}
                </span>

                <span class="number-item-label">
                    Number ${number.value}
                </span>
            `;

            button.onclick =
                function () {

                    selectNumberLesson(
                        index
                    );
                };

            grid.appendChild(
                button
            );
        }
    );

    updateNumbersGrid();
}


// ============================================================
// SELECT NUMBER
// ============================================================

function selectNumberLesson(index) {

    if (
        index < 0 ||
        index >= lessonNumbers.length
    ) {
        return;
    }

    stopNumberPractice();

    selectedNumberIndex =
        index;

    const number =
        lessonNumbers[index];

        const referenceImage =
        document.getElementById("numberReferenceImage");
    
    const referenceNumber =
        document.getElementById("numberReferenceNumber");
    
    if (referenceImage) {
        const numberValue = number.value;
    
        const imagePath =
            `./assets/numbers/${numberValue}.jpg`;
    
        referenceImage.src = imagePath;
    
        referenceImage.alt =
            `Sign language demonstration for number ${numberValue}`;
    
        referenceImage.onerror = function () {
            console.error(
                `❌ Could not load number sign image: ${imagePath}`
            );
        };
    }
    
    if (referenceNumber) {
        referenceNumber.textContent = number.value;
    }    

    const selected =
        document.getElementById(
            "selectedNumber"
        );

    const title =
        document.getElementById(
            "selectedNumberTitle"
        );

    const description =
        document.getElementById(
            "selectedNumberDescription"
        );

    const tip =
        document.getElementById(
            "numberLessonTip"
        );

    if (selected) {

        selected.innerText =
            number.value;
    }

    if (title) {

        title.innerText =
            number.title;
    }

    if (description) {

        description.innerText =
            `Learn the sign for number ${number.value}.`;
    }

    if (tip) {

        tip.innerText =
            number.tip;
    }

    const counter =
        document.getElementById(
            "numberLessonCounter"
        );

    if (counter) {

        counter.innerText =
            `${index + 1} / ${lessonNumbers.length}`;
    }

    const previous =
        document.getElementById(
            "previousNumberBtn"
        );

    const next =
        document.getElementById(
            "nextNumberBtn"
        );

    if (previous) {

        previous.disabled =
            index === 0;
    }

    if (next) {

        next.innerText =
            index === lessonNumbers.length - 1
                ? "Finish →"
                : "Next →";
    }

    updateNumbersGrid();
}


// ============================================================
// UPDATE NUMBERS GRID
// ============================================================

function updateNumbersGrid() {

    document
        .querySelectorAll(
            ".number-item"
        )
        .forEach(
            function (button, index) {

                button.classList.toggle(
                    "selected",
                    index === selectedNumberIndex
                );

                button.classList.toggle(
                    "learned",
                    learnedNumbers.has(
                        lessonNumbers[index].value
                    )
                );
            }
        );
}


// ============================================================
// PREVIOUS NUMBER
// ============================================================

function previousNumberLesson() {

    if (
        selectedNumberIndex > 0
    ) {

        selectNumberLesson(
            selectedNumberIndex - 1
        );
    }
}


// ============================================================
// NEXT NUMBER
// ============================================================

function nextNumberLesson() {

    if (
        selectedNumberIndex <
        lessonNumbers.length - 1
    ) {

        selectNumberLesson(
            selectedNumberIndex + 1
        );

        return;
    }

    const complete =
        document.getElementById(
            "numbersCompleteBox"
        );

    if (complete) {

        complete.classList.add(
            "show"
        );
    }
}


// ============================================================
// NUMBERS PROGRESS
// ============================================================

function updateNumbersProgress() {

    const text =
        document.getElementById(
            "numbersProgressText"
        );

    const bar =
        document.getElementById(
            "numbersProgressBar"
        );

    const percentage =
        (
            learnedNumbers.size /
            lessonNumbers.length
        ) * 100;

    if (text) {

        text.innerText =
            `${learnedNumbers.size} / ${lessonNumbers.length}`;
    }

    if (bar) {

        bar.style.width =
            `${percentage}%`;
    }

    updateNumbersGrid();
}


// ============================================================
// COMMON WORDS
// ============================================================

const lessonWords = [

    {
        key: "HELLO",
        icon: "👋",
        description:
            "A friendly greeting.",
        file: "hello.gif"
    },

    {
        key: "YES",
        icon: "👍",
        description:
            "Used to agree or confirm.",
        file: "yes.gif"
    },

    {
        key: "NO",
        icon: "👎",
        description:
            "Used to disagree or refuse.",
        file: "no.gif"
    },

    {
        key: "HELP",
        icon: "🆘",
        description:
            "Used when asking for assistance.",
        file: "help.gif"
    },

    {
        key: "THANK YOU",
        icon: "🙏",
        description:
            "Used to express gratitude.",
        file: "thankyou.gif"
    }
];

let selectedWordIndex = 0;

let learnedWords = new Set();

let wordPracticeStream = null;

let wordPracticeRunning = false;

let wordPracticeHands = null;

let wordPredictionBusy = false;

let wordStablePrediction = null;

let wordStableCount = 0;

const WORD_STABLE_REQUIRED = 4;


// ============================================================
// OPEN WORDS LESSON
// ============================================================

function openWordsLesson() {

    const modal =
        document.getElementById(
            "wordsLessonModal"
        );

    if (!modal) {

        console.error(
            "Words lesson modal not found."
        );

        return;
    }

    modal.classList.add("active");

    modal.setAttribute(
        "aria-hidden",
        "false"
    );

    createWordsGrid();

    selectWordLesson(
        selectedWordIndex
    );

    updateWordsProgress();

    stopWordPractice();
}


// ============================================================
// CLOSE WORDS LESSON
// ============================================================

function closeWordsLesson() {

    stopWordPractice();

    const modal =
        document.getElementById(
            "wordsLessonModal"
        );

    if (modal) {

        modal.classList.remove(
            "active"
        );

        modal.setAttribute(
            "aria-hidden",
            "true"
        );
    }
}


// ============================================================
// CREATE WORD GRID
// ============================================================

function createWordsGrid() {

    const grid =
        document.getElementById(
            "wordsGrid"
        );

    if (!grid) {
        return;
    }

    grid.innerHTML = "";

    lessonWords.forEach(
        function (word, index) {

            const button =
                document.createElement(
                    "button"
                );

            button.type = "button";

            button.className =
                "word-item";

            button.innerHTML = `
                <span class="word-item-icon">
                    ${word.icon}
                </span>

                <span class="word-item-label">
                    ${word.key}
                </span>
            `;

            button.onclick =
                function () {

                    selectWordLesson(
                        index
                    );
                };

            grid.appendChild(
                button
            );
        }
    );

    updateWordsGrid();
}


// ============================================================
// SELECT WORD
// ============================================================

function selectWordLesson(index) {

    if (
        index < 0 ||
        index >= lessonWords.length
    ) {
        return;
    }

    stopWordPractice();

    selectedWordIndex =
        index;

    const word =
        lessonWords[index];

    const icon =
        document.getElementById(
            "selectedWordIcon"
        );

    const title =
        document.getElementById(
            "selectedWordTitle"
        );

    const description =
        document.getElementById(
            "selectedWordDescription"
        );

    const preview =
        document.getElementById(
            "wordLessonPreview"
        );

    if (icon) {

        icon.innerText =
            word.icon;
    }

    if (title) {

        title.innerText =
            word.key;
    }

    if (description) {

        description.innerText =
            word.description;
    }

    if (preview) {

        preview.innerHTML = "";

        const image =
            document.createElement(
                "img"
            );

        image.src =
            `assets/signs/${word.file}`;

        image.alt =
            `${word.key} sign`;

        image.className =
            "word-sign-image";

        image.onerror =
            function () {

                preview.innerHTML = `
                    <div class="word-placeholder">

                        <span>
                            ${word.icon}
                        </span>

                        <p>
                            ${word.key}
                        </p>

                        <small>
                            Sign preview unavailable.
                        </small>

                    </div>
                `;
            };

        preview.appendChild(
            image
        );
    }

    const counter =
        document.getElementById(
            "wordLessonCounter"
        );

    if (counter) {

        counter.innerText =
            `${index + 1} / ${lessonWords.length}`;
    }

    updateWordsGrid();
}


// ============================================================
// UPDATE WORD GRID
// ============================================================

function updateWordsGrid() {

    document
        .querySelectorAll(
            ".word-item"
        )
        .forEach(
            function (button, index) {

                button.classList.toggle(
                    "selected",
                    index === selectedWordIndex
                );

                button.classList.toggle(
                    "learned",
                    learnedWords.has(
                        lessonWords[index].key
                    )
                );
            }
        );
}


// ============================================================
// PREVIOUS WORD
// ============================================================

function previousWordLesson() {

    if (
        selectedWordIndex > 0
    ) {

        selectWordLesson(
            selectedWordIndex - 1
        );
    }
}


// ============================================================
// NEXT WORD
// ============================================================

function nextWordLesson() {

    if (
        selectedWordIndex <
        lessonWords.length - 1
    ) {

        selectWordLesson(
            selectedWordIndex + 1
        );

        return;
    }

    updateWordsProgress();
}


// ============================================================
// WORD PROGRESS
// ============================================================

function updateWordsProgress() {

    const text =
        document.getElementById(
            "wordsProgressText"
        );

    const bar =
        document.getElementById(
            "wordsProgressBar"
        );

    const percentage =
        (
            learnedWords.size /
            lessonWords.length
        ) * 100;

    if (text) {

        text.innerText =
            `${learnedWords.size} / ${lessonWords.length}`;
    }

    if (bar) {

        bar.style.width =
            `${percentage}%`;
    }

    updateWordsGrid();
}


// ============================================================
// NUMBER AI PRACTICE
// ============================================================

async function startNumberPractice() {

    const area =
        document.getElementById(
            "numberPracticeArea"
        );

    const video =
        document.getElementById(
            "numberPracticeVideo"
        );

    const message =
        document.getElementById(
            "numberPracticeMessage"
        );

    if (!area || !video) {

        console.error(
            "Number practice elements not found."
        );

        return;
    }

    area.classList.add(
        "active"
    );

    numberStablePrediction = null;
    numberStableCount = 0;

    if (message) {

        message.innerText =
            `Starting camera... Show number ${lessonNumbers[selectedNumberIndex].value}.`;
    }

    try {

        if (
            typeof Hands ===
            "undefined"
        ) {

            await loadMediaPipeScript();
        }

        if (!numberPracticeHands) {

            numberPracticeHands =
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

            numberPracticeHands.setOptions({

                maxNumHands: 1,

                modelComplexity: 1,

                minDetectionConfidence: 0.5,

                minTrackingConfidence: 0.5

            });

            numberPracticeHands.onResults(
                onNumberPracticeResults
            );
        }

        numberPracticeStream =
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
            numberPracticeStream;

        await video.play();

        numberPracticeRunning =
            true;

        if (message) {

            message.innerText =
                `Camera active. Show number ${lessonNumbers[selectedNumberIndex].value}.`;
        }

        processNumberPracticeFrame();

    }
    catch (error) {

        console.error(
            "Number practice error:",
            error
        );

        if (message) {

            message.innerText =
                "Could not access the camera. Please allow camera permission.";
        }
    }
}


// ============================================================
// NUMBER PRACTICE FRAME
// ============================================================

async function processNumberPracticeFrame() {

    if (!numberPracticeRunning) {
        return;
    }

    const video =
        document.getElementById(
            "numberPracticeVideo"
        );

    if (
        !video ||
        !numberPracticeHands
    ) {
        return;
    }

    try {

        if (
            video.readyState >= 2
        ) {

            await numberPracticeHands.send({

                image: video

            });
        }

    }
    catch (error) {

        console.error(
            "Number MediaPipe error:",
            error
        );
    }

    if (numberPracticeRunning) {

        requestAnimationFrame(
            processNumberPracticeFrame
        );
    }
}


// ============================================================
// NUMBER PRACTICE RESULTS
// ============================================================

function onNumberPracticeResults(
    results
) {

    if (!numberPracticeRunning) {
        return;
    }

    if (
        !results.multiHandLandmarks ||
        results.multiHandLandmarks.length === 0
    ) {

        updateNumberPracticeDisplay(
            "—",
            0,
            "Show your hand clearly to the camera."
        );

        return;
    }

    const landmarks =
        results.multiHandLandmarks[0];

    const features =
        extractFeatures(
            landmarks
        );

    if (!features) {
        return;
    }

    predictNumberSign(
        features
    );
}


// ============================================================
// PREDICT NUMBER
// ============================================================

function normalizeNumberPrediction(prediction) {

    const value =
        String(prediction || "")
            .trim()
            .toUpperCase();

    const numberMap = {

        "ZERO": "0",
        "ONE": "1",
        "TWO": "2",
        "THREE": "3",
        "FOUR": "4",
        "FIVE": "5",
        "SIX": "6",
        "SEVEN": "7",
        "EIGHT": "8",
        "NINE": "9",
        "TEN": "10"

    };

    return numberMap[value] || value;
}

async function predictNumberSign(
    features
) {

    const rawPrediction =
        String(
            data.sign || "—"
        ).trim();

    const prediction =
        normalizeNumberPrediction(
            rawPrediction
        );

    if (numberPredictionBusy) {
        return;
    }

    numberPredictionBusy =
        true;

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

            throw new Error(
                data.message ||
                "Prediction failed."
            );
        }

        if (
            data.status !==
            "success"
        ) {

            updateNumberPracticeDisplay(
                "—",
                0,
                "The current model could not recognize this sign."
            );

            return;
        }

        const prediction =
            String(
                data.sign || "—"
            ).trim().toUpperCase();

        const confidence =
            Number(
                data.confidence || 0
            );

        const percentage =
            confidence <= 1
                ? confidence * 100
                : confidence;

        updateNumberPracticeDisplay(
            prediction,
            percentage,
            "AI is analyzing your sign..."
        );

        if (
            prediction ===
            String(
                lessonNumbers[
                    selectedNumberIndex
                ].value
            )
        ) {

            if (
                numberStablePrediction ===
                prediction
            ) {

                numberStableCount++;

            }
            else {

                numberStablePrediction =
                    prediction;

                numberStableCount = 1;
            }

            if (
                numberStableCount >=
                NUMBER_STABLE_REQUIRED
            ) {

                learnedNumbers.add(
                    lessonNumbers[
                        selectedNumberIndex
                    ].value
                );

                updateNumbersProgress();

                updateNumberPracticeDisplay(
                    prediction,
                    percentage,
                    "✓ Correct! Number learned! 🎉"
                );

                numberStableCount = 0;
            }

        }
        else {

            numberStablePrediction =
                prediction;

            numberStableCount = 0;

            updateNumberPracticeDisplay(
                prediction,
                percentage,
                `AI sees ${prediction}. Try number ${lessonNumbers[selectedNumberIndex].value}.`
            );
        }

    }
    catch (error) {

        console.error(
            "Number prediction error:",
            error
        );

        updateNumberPracticeDisplay(
            "—",
            0,
            "Unable to connect to the AI model."
        );

    }
    finally {

        numberPredictionBusy =
            false;
    }
}


// ============================================================
// NUMBER PRACTICE DISPLAY
// ============================================================

function updateNumberPracticeDisplay(
    prediction,
    confidence,
    message
) {

    const predictionElement =
        document.getElementById(
            "numberPrediction"
        );

    const confidenceElement =
        document.getElementById(
            "numberConfidence"
        );

    const messageElement =
        document.getElementById(
            "numberPracticeMessage"
        );


    if (predictionElement) {

        predictionElement.innerText =
            prediction || "—";

    }


    if (confidenceElement) {

        const safeConfidence =
            Math.max(
                0,
                Math.min(
                    100,
                    Number(confidence) || 0
                )
            );

        confidenceElement.innerText =
            `${safeConfidence.toFixed(1)}%`;

    }


    if (messageElement) {

        messageElement.innerText =
            message || "";

    }

}

    const predictionElement =
        document.getElementById(
            "numberPrediction"
        );

    const confidenceElement =
        document.getElementById(
            "numberConfidence"
        );

    const messageElement =
        document.getElementById(
            "numberPracticeMessage"
        );

    if (predictionElement) {

        predictionElement.innerText =
            prediction;
    }

    if (confidenceElement) {

        confidenceElement.innerText =
            `${Number(confidence).toFixed(1)}%`;
    }

    if (messageElement) {

        messageElement.innerText =
            message;
    }
}


// ============================================================
// STOP NUMBER PRACTICE
// ============================================================

function stopNumberPractice() {

    numberPracticeRunning =
        false;

    numberPredictionBusy =
        false;

    numberStablePrediction =
        null;

    numberStableCount =
        0;

    if (numberPracticeStream) {

        numberPracticeStream
            .getTracks()
            .forEach(
                function (track) {

                    track.stop();
                }
            );

        numberPracticeStream =
            null;
    }

    const video =
        document.getElementById(
            "numberPracticeVideo"
        );

    if (video) {

        video.srcObject =
            null;
    }

    const area =
        document.getElementById(
            "numberPracticeArea"
        );

    if (area) {

        area.classList.remove(
            "active"
        );
    }
}


// ============================================================
// WORD AI PRACTICE
// ============================================================

async function startWordPractice() {

    const area =
        document.getElementById(
            "wordPracticeArea"
        );

    const video =
        document.getElementById(
            "wordPracticeVideo"
        );

    const message =
        document.getElementById(
            "wordPracticeMessage"
        );

    if (!area || !video) {

        console.error(
            "Word practice elements not found."
        );

        return;
    }

    area.classList.add(
        "active"
    );

    wordStablePrediction =
        null;

    wordStableCount =
        0;

    if (message) {

        message.innerText =
            `Starting camera... Show the sign for ${lessonWords[selectedWordIndex].key}.`;
    }

    try {

        if (
            typeof Hands ===
            "undefined"
        ) {

            await loadMediaPipeScript();
        }

        if (!wordPracticeHands) {

            wordPracticeHands =
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

            wordPracticeHands.setOptions({

                maxNumHands: 1,

                modelComplexity: 1,

                minDetectionConfidence: 0.5,

                minTrackingConfidence: 0.5

            });

            wordPracticeHands.onResults(
                onWordPracticeResults
            );
        }

        wordPracticeStream =
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
            wordPracticeStream;

        await video.play();

        wordPracticeRunning =
            true;

        if (message) {

            message.innerText =
                `Camera active. Show the sign for ${lessonWords[selectedWordIndex].key}.`;
        }

        processWordPracticeFrame();

    }
    catch (error) {

        console.error(
            "Word practice error:",
            error
        );

        if (message) {

            message.innerText =
                "Could not access the camera. Please allow camera permission.";
        }
    }
}


// ============================================================
// WORD PRACTICE FRAME
// ============================================================

async function processWordPracticeFrame() {

    if (!wordPracticeRunning) {
        return;
    }

    const video =
        document.getElementById(
            "wordPracticeVideo"
        );

    if (
        !video ||
        !wordPracticeHands
    ) {
        return;
    }

    try {

        if (
            video.readyState >= 2
        ) {

            await wordPracticeHands.send({

                image: video

            });
        }

    }
    catch (error) {

        console.error(
            "Word MediaPipe error:",
            error
        );
    }

    if (wordPracticeRunning) {

        requestAnimationFrame(
            processWordPracticeFrame
        );
    }
}


// ============================================================
// WORD PRACTICE RESULTS
// ============================================================

function onWordPracticeResults(
    results
) {

    if (!wordPracticeRunning) {
        return;
    }

    if (
        !results.multiHandLandmarks ||
        results.multiHandLandmarks.length === 0
    ) {

        updateWordPracticeDisplay(
            "—",
            0,
            "Show your hand clearly to the camera."
        );

        return;
    }

    const landmarks =
        results.multiHandLandmarks[0];

    const features =
        extractFeatures(
            landmarks
        );

    if (!features) {
        return;
    }

    predictWordSign(
        features
    );
}


// ============================================================
// PREDICT WORD
// ============================================================

async function predictWordSign(
    features
) {

    if (wordPredictionBusy) {
        return;
    }

    wordPredictionBusy =
        true;

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

            throw new Error(
                data.message ||
                "Prediction failed."
            );
        }

        if (
            data.status !==
            "success"
        ) {

            updateWordPracticeDisplay(
                "—",
                0,
                "The current model could not recognize this sign."
            );

            return;
        }

        const prediction =
            String(
                data.sign
            ).toUpperCase();

        const confidence =
            Number(
                data.confidence || 0
            );

        const percentage =
            confidence <= 1
                ? confidence * 100
                : confidence;

        updateWordPracticeDisplay(
            prediction,
            percentage,
            "AI is analyzing your sign..."
        );

        const target =
            lessonWords[
                selectedWordIndex
            ].key;

        if (
            prediction ===
            target
        ) {

            if (
                wordStablePrediction ===
                prediction
            ) {

                wordStableCount++;

            }
            else {

                wordStablePrediction =
                    prediction;

                wordStableCount =
                    1;
            }

            if (
                wordStableCount >=
                WORD_STABLE_REQUIRED
            ) {

                learnedWords.add(
                    target
                );

                updateWordsProgress();

                updateWordPracticeDisplay(
                    prediction,
                    percentage,
                    "✓ Correct! Word learned! 🎉"
                );

                wordStableCount =
                    0;
            }

        }
        else {

            wordStablePrediction =
                prediction;

            wordStableCount =
                0;

            updateWordPracticeDisplay(
                prediction,
                percentage,
                `AI sees ${prediction}. Try the sign for ${target}.`
            );
        }

    }
    catch (error) {

        console.error(
            "Word prediction error:",
            error
        );

        updateWordPracticeDisplay(
            "—",
            0,
            "Unable to connect to the AI model."
        );

    }
    finally {

        wordPredictionBusy =
            false;
    }
}


// ============================================================
// WORD PRACTICE DISPLAY
// ============================================================

function updateWordPracticeDisplay(
    prediction,
    confidence,
    message
) {

    const predictionElement =
        document.getElementById(
            "wordPrediction"
        );

    const confidenceElement =
        document.getElementById(
            "wordConfidence"
        );

    const messageElement =
        document.getElementById(
            "wordPracticeMessage"
        );

    if (predictionElement) {

        predictionElement.innerText =
            prediction;
    }

    if (confidenceElement) {

        confidenceElement.innerText =
            `${Number(confidence).toFixed(1)}%`;
    }

    if (messageElement) {

        messageElement.innerText =
            message;
    }
}


// ============================================================
// STOP WORD PRACTICE
// ============================================================

function stopWordPractice() {

    wordPracticeRunning =
        false;

    wordPredictionBusy =
        false;

    wordStablePrediction =
        null;

    wordStableCount =
        0;

    if (wordPracticeStream) {

        wordPracticeStream
            .getTracks()
            .forEach(
                function (track) {

                    track.stop();
                }
            );

        wordPracticeStream =
            null;
    }

    const video =
        document.getElementById(
            "wordPracticeVideo"
        );

    if (video) {

        video.srcObject =
            null;
    }

    const area =
        document.getElementById(
            "wordPracticeArea"
        );

    if (area) {

        area.classList.remove(
            "active"
        );
    }
}


// ============================================================
// AI PRACTICE LESSON
// ============================================================

function openAIPractice() {

    const modal =
        document.getElementById(
            "aiPracticeModal"
        );

    if (!modal) {

        console.error(
            "AI Practice modal not found."
        );

        return;
    }

    modal.classList.add(
        "active"
    );

    modal.setAttribute(
        "aria-hidden",
        "false"
    );

    const info =
        document.getElementById(
            "aiPracticeInfo"
        );

    if (info) {

        info.innerText =
            "Choose a category below to begin AI practice.";
    }
}


// ============================================================
// CLOSE AI PRACTICE
// ============================================================

function closeAIPractice() {

    const modal =
        document.getElementById(
            "aiPracticeModal"
        );

    if (modal) {

        modal.classList.remove(
            "active"
        );

        modal.setAttribute(
            "aria-hidden",
            "true"
        );
    }

    stopAlphabetPractice();

    stopNumberPractice();

    stopWordPractice();
}


// ============================================================
// START AI ALPHABET PRACTICE
// ============================================================

function startAIAlphabetPractice() {

    closeAIPractice();

    openAlphabetLesson();

    setTimeout(
        function () {

            startAlphabetPractice();

        },
        300
    );
}


// ============================================================
// START AI WORD PRACTICE
// ============================================================

function startAIWordPractice() {

    closeAIPractice();

    openWordsLesson();

    setTimeout(
        function () {

            startWordPractice();

        },
        300
    );
}


// ============================================================
// START AI NUMBER PRACTICE
// ============================================================

function startAINumberPractice() {

    closeAIPractice();

    openNumbersLesson();

    setTimeout(
        function () {

            startNumberPractice();

        },
        300
    );
}


// ============================================================
// NUMBER AI MESSAGE
// ============================================================

function showNumberAIMessage() {

    const info =
        document.getElementById(
            "aiPracticeInfo"
        );

    if (info) {

        info.innerText =
            "🔢 Number AI Practice is available. Select Numbers to start practicing.";
    }

    startAINumberPractice();
}


// ============================================================
// BUTTON CONNECTIONS
// ============================================================

function connectButtons() {


        // ============================================================
        // ALPHABET PRACTICE BUTTONS
        // ============================================================

        const practiceAlphabetButton =
        document.getElementById("practiceAlphabetBtn");

        if (practiceAlphabetButton) {

        // Remove old inline onclick if it exists
        practiceAlphabetButton.removeAttribute("onclick");

        practiceAlphabetButton.onclick =
        async function (event) {

        event.preventDefault();

        console.log(
            "🎥 Practice This Letter clicked"
        );

        await startAlphabetPractice();

        };
        }


        const startAlphabetCameraBtn =
        document.getElementById("startAlphabetCameraBtn");

        if (startAlphabetCameraBtn) {

        startAlphabetCameraBtn.onclick =
        async function () {

        await startAlphabetPractice();

        };

        }


        const stopAlphabetCameraBtn =
        document.getElementById("stopAlphabetCameraBtn");

        if (stopAlphabetCameraBtn) {

        stopAlphabetCameraBtn.onclick =
        function () {

        stopAlphabetPractice();

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
    // ========================================================
    // NUMBERS LESSON
    // ========================================================

    const numbersButton =
        document.querySelector(
            '[onclick="openNumbersLesson()"]'
        );

    if (numbersButton) {

        numbersButton.onclick =
            openNumbersLesson;
    }


    // ========================================================
    // WORDS LESSON
    // ========================================================

    const wordsButton =
        document.querySelector(
            '[onclick="openWordsLesson()"]'
        );

    if (wordsButton) {

        wordsButton.onclick =
            openWordsLesson;
    }


    // ========================================================
    // AI PRACTICE LESSON
    // ========================================================

    const aiPracticeButton =
        document.querySelector(
            '[onclick="openAIPractice()"]'
        );

    if (aiPracticeButton) {

        aiPracticeButton.onclick =
            openAIPractice;
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

        // ========================================================
// PREPARE LEARNING LESSONS
// ========================================================

if (
    document.getElementById(
        "alphabetLessonModal"
    )
) {

    createAlphabetGrid();

    updateAlphabetProgress();
}


if (
    document.getElementById(
        "numbersLessonModal"
    )
) {

    createNumbersGrid();

    updateNumbersProgress();
}


if (
    document.getElementById(
        "wordsLessonModal"
    )
) {

    createWordsGrid();

    updateWordsProgress();
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

// ============================================================
// ALPHABET REFERENCE IMAGE
// ============================================================

// ============================================================
// ALPHABET REFERENCE IMAGE
// ============================================================

function updateAlphabetReference(letter) {

    const referenceImage =
        document.getElementById("alphabetReferenceImage");

    const referenceLetter =
        document.getElementById("referenceLetter");

    const practiceLetterTitle =
        document.getElementById("practiceLetterTitle");

    if (!referenceImage) {
        console.error(
            "❌ alphabetReferenceImage element not found"
        );
        return;
    }

    const upperLetter = String(letter).toUpperCase().trim();

    // Build image path
    const imagePath =
        `./assets/alphabets/${upperLetter}.jpg`;

    console.log(
        "🖼️ Loading alphabet sign image:",
        imagePath
    );

    // Set image
    referenceImage.src = imagePath;

    referenceImage.alt =
        `Sign language demonstration for letter ${upperLetter}`;

    // Update letter text
    if (referenceLetter) {
        referenceLetter.textContent = upperLetter;
    }

    if (practiceLetterTitle) {
        practiceLetterTitle.textContent = upperLetter;
    }

    // Detect image loading
    referenceImage.onload = function () {

        console.log(
            `✅ ${upperLetter}.jpg loaded successfully`
        );

    };

    // Detect image loading failure
    referenceImage.onerror = function () {

        console.error(
            `❌ Could not load: ${imagePath}`
        );

        console.error(
            "Make sure the file exists inside:",
            "frontend/assets/alphabet/"
        );

    };
}