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
const MIN_CONFIDENCE = 0.70;
const COOLDOWN = 1.2;


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


// ============================================================
// SENTENCE
// ============================================================

let sentence = [];


// ============================================================
// NAVIGATION
// ============================================================

function openTranslator() {

    const translator =
        document.getElementById("translator");

    if (translator) {

        translator.scrollIntoView({
            behavior: "smooth"
        });

    }

}


function openLearning() {

    const learning =
        document.getElementById("learning");

    if (learning) {

        learning.scrollIntoView({
            behavior: "smooth"
        });

    }

}


// ============================================================
// INITIALIZE MEDIAPIPE
// ============================================================

function initializeMediaPipe() {

    console.log("======================================");
    console.log("Initializing MediaPipe Hands...");
    console.log("======================================");


    if (typeof Hands === "undefined") {

        console.error(
            "❌ MediaPipe Hands library was NOT loaded."
        );

        mediaPipeReady = false;

        updateAIStatus(false);

        alert(
            "MediaPipe could not be loaded.\n\n" +
            "Please make sure you are running the website using Live Server " +
            "and that your internet connection is working."
        );

        return;

    }


    try {

        hands = new Hands({

            locateFile: function(file) {

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

    }

}


// ============================================================
// UPDATE AI STATUS
// ============================================================

function updateAIStatus(ready) {

    const aiLive =
        document.querySelector(".ai-live");

    if (aiLive) {

        if (ready) {

            aiLive.innerText = "● LIVE";

            aiLive.style.color = "#22c55e";

        }
        else {

            aiLive.innerText = "● OFFLINE";

            aiLive.style.color = "#ef4444";

        }

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
            "MediaPipe is not ready yet.\n\n" +
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


        canvasElement.width =
            videoElement.videoWidth || 640;

        canvasElement.height =
            videoElement.videoHeight || 480;


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


    if (cameraStream) {

        cameraStream
            .getTracks()
            .forEach(function(track) {

                track.stop();

            });

        cameraStream = null;

    }


    if (videoElement) {

        videoElement.srcObject = null;

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


    if (
        !mediaPipeReady ||
        !hands
    ) {

        console.warn(
            "MediaPipe not ready."
        );

        setTimeout(
            predictionFrame,
            200
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
    // NO HAND DETECTED
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

    drawHandLandmarks(
        results
    );


    // --------------------------------------------------------
    // CREATE 63 FEATURES
    // --------------------------------------------------------

    const features =
        extractFeatures(
            landmarks
        );


    if (!features) {

        return;

    }


    // --------------------------------------------------------
    // SEND TO FLASK
    // --------------------------------------------------------

    sendPrediction(
        features
    );

}


// ============================================================
// EXTRACT 63 FEATURES
// ============================================================

function extractFeatures(landmarks) {

    if (
        !landmarks ||
        landmarks.length !== 21
    ) {

        return null;

    }


    const features = [];


    for (
        let i = 0;
        i < landmarks.length;
        i++
    ) {

        features.push(
            Number(landmarks[i].x)
        );

        features.push(
            Number(landmarks[i].y)
        );

        features.push(
            Number(landmarks[i].z)
        );

    }


    if (features.length !== 63) {

        console.error(
            "Wrong feature count:",
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

    // Prevent multiple simultaneous requests

    if (predictionBusy) {

        return;

    }


    // Limit requests

    const now =
        Date.now();


    if (
        now -
        lastPredictionTime
        <
        150
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
                "Backend prediction error:",
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


    predictionBusy = false;

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


    for (
        const landmarks of
        results.multiHandLandmarks
    ) {

        // Draw connections

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


        canvasContext.beginPath();

        canvasContext.strokeStyle =
            "#38bdf8";

        canvasContext.lineWidth =
            2;


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


        // Draw points

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

                2 *
                Math.PI

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


    if (signElement) {

        signElement.innerText =
            String(sign).toUpperCase();

    }


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

    if (
        confidence <
        MIN_CONFIDENCE
    ) {

        stableCount = 0;

        lastSign = null;

        return;

    }


    if (
        sign ===
        lastSign
    ) {

        stableCount++;

    }
    else {

        lastSign =
            sign;

        stableCount =
            1;

    }


    console.log(
        "Stable:",
        sign,
        stableCount + "/" + STABLE_FRAMES
    );


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


        stableCount =
            0;

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
        function() {

            console.log(
                "🔊 Speech started."
            );

        };


    speech.onend =
        function() {

            console.log(
                "🔊 Speech finished."
            );

        };


    speech.onerror =
        function(error) {

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


    input.value =
        "";

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
// PAGE LOAD
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    async function() {

        console.log(
            "======================================"
        );

        console.log(
            "       SIGNBRIDGE AI FRONTEND"
        );

        console.log(
            "======================================"
        );


        // Test Flask

        await testBackend();


        // Test ML model

        await testModel();


        // Initialize MediaPipe

        initializeMediaPipe();


        // Initial camera UI

        updateCameraUI(
            false
        );


        console.log(
            "SignBridge AI ready."
        );

    }
);