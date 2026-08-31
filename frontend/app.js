// ============================================================
// SIGNBRIDGE AI
// FRONTEND APPLICATION
// ============================================================

const API_URL = "http://127.0.0.1:5000";


// ============================================================
// GLOBAL VARIABLES
// ============================================================

let cameraStream = null;

let cameraRunning = false;

let predictionRunning = false;

let videoElement = null;

let canvasElement = null;

let canvasContext = null;

let lastSign = null;

let stableCount = 0;

let lastAddedSign = null;

let lastAddedTime = 0;

const STABLE_FRAMES = 12;

const MIN_CONFIDENCE = 0.70;

const COOLDOWN = 1.2;


// ============================================================
// SENTENCE
// ============================================================

let sentence = [];


// ============================================================
// NAVIGATION
// ============================================================

function openTranslator() {

    document
        .getElementById("translator")
        .scrollIntoView({
            behavior: "smooth"
        });

}


function openLearning() {

    document
        .getElementById("learning")
        .scrollIntoView({
            behavior: "smooth"
        });

}


// ============================================================
// START CAMERA
// ============================================================

async function startCamera() {

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
                "Camera element not found."
            );

            return;
        }


        cameraStream =
            await navigator.mediaDevices.getUserMedia({

                video: {
                    width: 640,
                    height: 480,
                    facingMode: "user"
                },

                audio: false

            });


        videoElement.srcObject =
            cameraStream;


        await videoElement.play();


        cameraRunning = true;


        updateCameraUI(
            true
        );


        console.log(
            "✅ Camera started"
        );


        // Start prediction loop
        startPredictionLoop();


    } catch (error) {

        console.error(
            "Camera error:",
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

    if (cameraStream) {

        cameraStream
            .getTracks()
            .forEach(
                track => track.stop()
            );

        cameraStream = null;
    }


    cameraRunning = false;


    if (videoElement) {

        videoElement.srcObject = null;

    }


    updateCameraUI(
        false
    );


    console.log(
        "Camera stopped."
    );

}


// ============================================================
// CAMERA UI
// ============================================================

function updateCameraUI(
    running
) {

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

    } else {

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

        }

    }

}


// ============================================================
// PREDICTION LOOP
// ============================================================

function startPredictionLoop() {

    if (predictionRunning) {

        return;

    }


    predictionRunning = true;


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


    try {

        // We will connect MediaPipe here
        // in the next part.

        // For now, keep the loop active.

    } catch (error) {

        console.error(
            "Prediction error:",
            error
        );

    }


    setTimeout(
        predictionFrame,
        100
    );

}


// ============================================================
// UPDATE SIGN
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


    if (signElement) {

        signElement.innerText =
            sign.toUpperCase();

    }


    const percentage =
        confidence * 100;


    if (confidenceElement) {

        confidenceElement.innerText =
            percentage.toFixed(1) + "%";

    }


    if (confidenceBar) {

        confidenceBar.style.width =
            percentage + "%";

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
        sign === lastSign
    ) {

        stableCount++;

    } else {

        lastSign = sign;

        stableCount = 1;

    }


    if (
        stableCount >=
        STABLE_FRAMES
    ) {

        const now =
            Date.now() / 1000;


        if (

            sign !==
            lastAddedSign

            ||

            (
                now -
                lastAddedTime
                >
                COOLDOWN
            )

        ) {

            sentence.push(
                sign
            );


            lastAddedSign =
                sign;


            lastAddedTime =
                now;


            updateSentence();


            console.log(
                "✅ Sign added:",
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

}


// ============================================================
// SPEAK TRANSLATION
// ============================================================

function speakTranslation() {

    const text =
        sentence.join(" ").trim();


    if (!text) {

        alert(
            "Please translate a sign first."
        );

        return;

    }


    if (
        !window.speechSynthesis
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
            "Backend response:",
            data
        );


        return true;

    } catch (error) {

        console.error(
            "Backend connection failed:",
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
    () => {

        console.log(
            "======================================"
        );

        console.log(
            "       SIGNBRIDGE AI FRONTEND"
        );

        console.log(
            "======================================"
        );


        testBackend();


        updateCameraUI(
            false
        );

    }
);