const API_URL = "http://127.0.0.1:5000";

const STABLE_FRAMES = 12;
const MIN_CONFIDENCE = 0.90;
const COOLDOWN = 1.2;
const PREDICTION_INTERVAL = 150;

const VALID_SIGNS = [
    "hello",
    "yes",
    "no",
    "help",
    "thank_you"
];

const UNKNOWN_SIGN = "unknown";


/* =========================================================
   TEXT → SIGN DATA
========================================================= */

const TEXT_TO_SIGN_DATA = {

    hello: {
        title: "HELLO",
        description: "Sign used for greeting someone.",
        file: "hello.gif"
    },

    yes: {
        title: "YES",
        description: "Sign used to express agreement or confirmation.",
        file: "yes.gif"
    },

    no: {
        title: "NO",
        description: "Sign used to express disagreement or rejection.",
        file: "no.gif"
    },

    help: {
        title: "HELP",
        description: "Sign used when asking for assistance.",
        file: "help.gif"
    },

    thank_you: {
        title: "THANK YOU",
        description: "Sign used to express gratitude.",
        file: "thankyou.gif"
    }

};


/* =========================================================
   GLOBAL VARIABLES
========================================================= */

let video = null;
let canvas = null;
let ctx = null;

let cameraStream = null;
let hands = null;

let cameraRunning = false;
let processingFrame = false;
let lastPredictionTime = 0;

let currentSign = "";
let currentConfidence = 0;

let stableCount = 0;

let lastAddedSign = "";
let lastAddedTime = 0;

let recognizedSentence = [];


/* =========================================================
   TEXT → SIGN VARIABLES
========================================================= */

let textSignQueue = [];
let textSignIndex = 0;
let textSignPlaying = false;
let textSignTimer = null;


/* =========================================================
   SPEECH RECOGNITION
========================================================= */

let speechRecognition = null;


/* =========================================================
   HELPER
========================================================= */

function getElement(...ids) {

    for (const id of ids) {

        const element = document.getElementById(id);

        if (element) {
            return element;
        }

    }

    return null;
}


/* =========================================================
   NAVIGATION
========================================================= */

function setupNavigation() {

    document.querySelectorAll("[data-section]").forEach(button => {

        button.addEventListener("click", () => {

            const sectionId =
                button.getAttribute("data-section");

            showSection(sectionId);

        });

    });


    document.querySelectorAll("nav a[href^='#']").forEach(link => {

        link.addEventListener("click", event => {

            event.preventDefault();

            const target =
                link.getAttribute("href").replace("#", "");

            const section =
                document.getElementById(target);

            if (section) {

                section.scrollIntoView({
                    behavior: "smooth"
                });

            }

        });

    });

}


function showSection(sectionId) {

    const section =
        document.getElementById(sectionId);

    if (section) {

        section.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    }

}


/* =========================================================
   MEDIAPIPE INITIALIZATION
========================================================= */

async function initializeHands() {

    try {

        if (typeof Hands === "undefined") {

            console.error(
                "MediaPipe Hands was not loaded."
            );

            return;

        }


        hands = new Hands({

            locateFile: file => {

                return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;

            }

        });


        hands.setOptions({

            maxNumHands: 1,

            modelComplexity: 1,

            minDetectionConfidence: 0.5,

            minTrackingConfidence: 0.5

        });


        hands.onResults(onHandsResults);


        console.log(
            "MediaPipe Hands initialized successfully."
        );


    } catch (error) {

        console.error(
            "MediaPipe initialization error:",
            error
        );

    }

}


/* =========================================================
   GET CAMERA ELEMENTS
========================================================= */

function getCameraElements() {

    /*
        Supports both:

        Current HTML:
        cameraVideo
        cameraCanvas

        Older/newer version:
        webcam
        outputCanvas
    */

    video = getElement(
        "cameraVideo",
        "webcam"
    );

    canvas = getElement(
        "cameraCanvas",
        "outputCanvas"
    );

    if (canvas) {

        ctx =
            canvas.getContext("2d");

    }

}


/* =========================================================
   START CAMERA
========================================================= */

async function startCamera() {

    try {

        if (cameraRunning) {
            return;
        }


        getCameraElements();


        if (!video || !canvas) {

            alert(
                "Camera elements were not found in index.html."
            );

            console.error(
                "Camera elements missing."
            );

            return;

        }


        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia
        ) {

            alert(
                "Your browser does not support webcam access."
            );

            return;

        }


        if (!hands) {

            await initializeHands();

        }


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


        video.srcObject =
            cameraStream;


        await video.play();


        cameraRunning = true;


        resizeCanvas();


        const startButton =
            getElement(
                "startCameraBtn",
                "startCamera"
            );


        if (startButton) {

            startButton.textContent =
                "Camera Running";

            startButton.disabled =
                true;

        }


        const stopButton =
            getElement(
                "stopCameraBtn",
                "stopCamera"
            );


        if (stopButton) {

            stopButton.disabled =
                false;

        }


        console.log(
            "Camera started successfully."
        );


        processCameraFrame();


    } catch (error) {

        console.error(
            "Camera error:",
            error
        );


        alert(
            "Unable to access the camera.\n\n" +
            "Please allow camera permission in your browser."
        );

    }

}


/* =========================================================
   STOP CAMERA
========================================================= */

function stopCamera() {

    cameraRunning = false;


    if (cameraStream) {

        cameraStream
            .getTracks()
            .forEach(track => track.stop());

        cameraStream = null;

    }


    if (video) {

        video.srcObject = null;

    }


    const startButton =
        getElement(
            "startCameraBtn",
            "startCamera"
        );


    if (startButton) {

        startButton.textContent =
            "Start Camera";

        startButton.disabled =
            false;

    }


    const stopButton =
        getElement(
            "stopCameraBtn",
            "stopCamera"
        );


    if (stopButton) {

        stopButton.disabled =
            true;

    }


    resetPredictionState();


    console.log(
        "Camera stopped."
    );

}


/* =========================================================
   CANVAS SIZE
========================================================= */

function resizeCanvas() {

    if (!video || !canvas) {
        return;
    }


    canvas.width =
        video.videoWidth || 640;


    canvas.height =
        video.videoHeight || 480;

}


/* =========================================================
   PROCESS CAMERA
========================================================= */

async function processCameraFrame() {

    if (
        !cameraRunning ||
        !video ||
        !hands
    ) {

        return;

    }


    if (
        video.readyState >= 2 &&
        !processingFrame
    ) {

        const now =
            Date.now();


        if (
            now - lastPredictionTime >=
            PREDICTION_INTERVAL
        ) {

            processingFrame = true;

            lastPredictionTime =
                now;


            try {

                await hands.send({
                    image: video
                });

            } catch (error) {

                console.error(
                    "MediaPipe frame error:",
                    error
                );

            }


            processingFrame = false;

        }

    }


    requestAnimationFrame(
        processCameraFrame
    );

}


/* =========================================================
   MEDIAPIPE RESULTS
========================================================= */

function onHandsResults(results) {

    drawResults(results);


    if (
        !results.multiHandLandmarks ||
        results.multiHandLandmarks.length === 0
    ) {

        updatePrediction(
            "No hand",
            0
        );

        stableCount = 0;

        return;

    }


    const landmarks =
        results.multiHandLandmarks[0];


    const features =
        normalizeLandmarks(
            landmarks
        );


    sendPrediction(
        features
    );

}


/* =========================================================
   DRAW HAND LANDMARKS
========================================================= */

function drawResults(results) {

    if (!canvas || !ctx || !video) {
        return;
    }


    if (
        !video.videoWidth ||
        !video.videoHeight
    ) {

        return;

    }


    if (
        canvas.width !== video.videoWidth ||
        canvas.height !== video.videoHeight
    ) {

        resizeCanvas();

    }


    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    if (
        results.multiHandLandmarks &&
        results.multiHandLandmarks.length > 0
    ) {

        for (
            const landmarks
            of results.multiHandLandmarks
        ) {

            drawConnections(
                landmarks
            );


            for (
                const landmark
                of landmarks
            ) {

                const x =
                    landmark.x *
                    canvas.width;


                const y =
                    landmark.y *
                    canvas.height;


                ctx.beginPath();


                ctx.arc(
                    x,
                    y,
                    4,
                    0,
                    2 * Math.PI
                );


                ctx.fill();

            }

        }

    }

}


/* =========================================================
   DRAW CONNECTIONS
========================================================= */

function drawConnections(landmarks) {

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


    connections.forEach(connection => {

        const start =
            landmarks[connection[0]];


        const end =
            landmarks[connection[1]];


        ctx.beginPath();


        ctx.moveTo(
            start.x * canvas.width,
            start.y * canvas.height
        );


        ctx.lineTo(
            end.x * canvas.width,
            end.y * canvas.height
        );


        ctx.stroke();

    });

}


/* =========================================================
   NORMALIZE LANDMARKS
========================================================= */

function normalizeLandmarks(landmarks) {

    const wrist =
        landmarks[0];


    const features = [];


    landmarks.forEach(landmark => {

        const x =
            landmark.x -
            wrist.x;


        const y =
            landmark.y -
            wrist.y;


        const z =
            landmark.z -
            wrist.z;


        features.push(
            x,
            y,
            z
        );

    });


    return features;

}


/* =========================================================
   SEND PREDICTION TO FLASK
========================================================= */

async function sendPrediction(features) {

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
                        features: features
                    })

                }
            );


        if (!response.ok) {

            console.error(
                "Prediction API error:",
                response.status
            );

            return;

        }


        const data =
            await response.json();


        if (
            data.status === "success"
        ) {

            updatePrediction(
                data.sign,
                data.confidence
            );

        } else {

            console.error(
                "Prediction failed:",
                data.message
            );

        }


    } catch (error) {

        console.error(
            "Could not connect to Flask backend:",
            error
        );

    }

}


/* =========================================================
   UPDATE PREDICTION UI
========================================================= */

function updatePrediction(
    sign,
    confidence
) {

    const predictionElement =
        getElement(
            "currentSign",
            "currentPrediction"
        );


    const confidenceElement =
        getElement(
            "confidence",
            "confidenceValue"
        );


    const translatedElement =
        getElement(
            "translatedText"
        );


    const confidenceBar =
        getElement(
            "confidenceBar"
        );


    if (!sign) {
        return;
    }


    currentSign =
        sign;


    currentConfidence =
        Number(confidence) || 0;


    const percentage =
        Math.round(
            currentConfidence * 100
        );


    /* CURRENT SIGN */

    if (predictionElement) {

        if (
            sign === UNKNOWN_SIGN
        ) {

            predictionElement.textContent =
                "UNKNOWN";

        } else if (
            sign === "No hand"
        ) {

            predictionElement.textContent =
                "---";

        } else {

            predictionElement.textContent =
                sign
                    .replace("_", " ")
                    .toUpperCase();

        }

    }


    /* CONFIDENCE */

    if (confidenceElement) {

        confidenceElement.textContent =
            `${percentage}%`;

    }


    /* CONFIDENCE BAR */

    if (confidenceBar) {

        confidenceBar.style.width =
            `${percentage}%`;

    }


    /* UNKNOWN */

    if (
        sign === UNKNOWN_SIGN
    ) {

        if (translatedElement) {

            translatedElement.textContent =
                "Unknown gesture";

        }


        stableCount = 0;

        return;

    }


    /* NO HAND */

    if (
        sign === "No hand"
    ) {

        if (translatedElement) {

            translatedElement.textContent =
                "Show your hand";

        }


        stableCount = 0;

        return;

    }


    /* TRANSLATED TEXT */

    if (translatedElement) {

        translatedElement.textContent =
            sign
                .replace("_", " ")
                .toUpperCase();

    }


    processStableSign(
        sign,
        currentConfidence
    );

}


/* =========================================================
   STABLE SIGN DETECTION
========================================================= */

function processStableSign(
    sign,
    confidence
) {

    if (
        !VALID_SIGNS.includes(sign)
    ) {

        stableCount = 0;

        return;

    }


    if (
        confidence < MIN_CONFIDENCE
    ) {

        stableCount = 0;

        return;

    }


    stableCount++;


    if (
        stableCount < STABLE_FRAMES
    ) {

        return;

    }


    const now =
        Date.now() / 1000;


    if (
        sign === lastAddedSign &&
        now - lastAddedTime < COOLDOWN
    ) {

        return;

    }


    addSignToSentence(
        sign
    );


    lastAddedSign =
        sign;


    lastAddedTime =
        now;


    stableCount = 0;

}


/* =========================================================
   ADD SIGN TO SENTENCE
========================================================= */

function addSignToSentence(sign) {

    if (
        !VALID_SIGNS.includes(sign)
    ) {

        return;

    }


    recognizedSentence.push(
        sign
    );


    updateSentenceUI();


    console.log(
        "Recognized sentence:",
        recognizedSentence
    );

}


/* =========================================================
   UPDATE SENTENCE
========================================================= */

function updateSentenceUI() {

    const sentenceElement =
        getElement(
            "recognizedSentence"
        );


    if (!sentenceElement) {
        return;
    }


    if (
        recognizedSentence.length === 0
    ) {

        sentenceElement.textContent =
            "Your recognized sentence will appear here.";

        return;

    }


    sentenceElement.textContent =
        recognizedSentence
            .map(sign =>

                sign
                    .replace("_", " ")
                    .toUpperCase()

            )
            .join(" ");

}


/* =========================================================
   CLEAR SENTENCE
========================================================= */

function clearSentence() {

    recognizedSentence = [];


    lastAddedSign = "";


    lastAddedTime = 0;


    stableCount = 0;


    updateSentenceUI();


    const predictionElement =
        getElement(
            "currentSign",
            "currentPrediction"
        );


    const confidenceElement =
        getElement(
            "confidence",
            "confidenceValue"
        );


    const translatedElement =
        getElement(
            "translatedText"
        );


    const confidenceBar =
        getElement(
            "confidenceBar"
        );


    if (predictionElement) {

        predictionElement.textContent =
            "---";

    }


    if (confidenceElement) {

        confidenceElement.textContent =
            "0%";

    }


    if (translatedElement) {

        translatedElement.textContent =
            "---";

    }


    if (confidenceBar) {

        confidenceBar.style.width =
            "0%";

    }

}


/* =========================================================
   RESET PREDICTION
========================================================= */

function resetPredictionState() {

    currentSign = "";

    currentConfidence = 0;

    stableCount = 0;


    const predictionElement =
        getElement(
            "currentSign",
            "currentPrediction"
        );


    if (predictionElement) {

        predictionElement.textContent =
            "---";

    }

}


/* =========================================================
   SIGN → SPEECH
========================================================= */

function speakSentence() {

    if (
        recognizedSentence.length === 0
    ) {

        alert(
            "There is no recognized sign sentence to speak."
        );

        return;

    }


    const text =
        recognizedSentence
            .map(sign =>
                sign.replace("_", " ")
            )
            .join(" ");


    speakText(text);

}


function speakText(text) {

    if (
        !("speechSynthesis" in window)
    ) {

        alert(
            "Speech synthesis is not supported by this browser."
        );

        return;

    }


    window.speechSynthesis.cancel();


    const utterance =
        new SpeechSynthesisUtterance(
            text
        );


    utterance.lang =
        "en-IN";


    utterance.rate =
        0.9;


    utterance.pitch =
        1;


    window.speechSynthesis.speak(
        utterance
    );

}


/* =========================================================
   TEXT → SIGN
   PARSE TEXT
========================================================= */

function parseTextForSigns(text) {

    if (
        !text ||
        !text.trim()
    ) {

        return [];

    }


    const normalized =
        text
            .toLowerCase()
            .replace(
                /[.,!?;:]/g,
                " "
            )
            .replace(
                /\s+/g,
                " "
            )
            .trim();


    const words =
        normalized.split(" ");


    const queue = [];


    let i = 0;


    while (
        i < words.length
    ) {

        /*
            Detect "thank you"
            as one sign.
        */

        if (
            words[i] === "thank" &&
            words[i + 1] === "you"
        ) {

            queue.push(
                "thank_you"
            );


            i += 2;


            continue;

        }


        const word =
            words[i];


        if (
            Object.prototype.hasOwnProperty.call(
                TEXT_TO_SIGN_DATA,
                word
            )
        ) {

            queue.push(
                word
            );

        }


        i++;

    }


    return queue;

}


/* =========================================================
   TEXT → SIGN
   START
========================================================= */

function startTextToSign() {

    const input =
        getElement(
            "textToSignInput"
        );


    if (!input) {

        console.error(
            "Text-to-sign input not found."
        );

        return;

    }


    const text =
        input.value;


    const queue =
        parseTextForSigns(
            text
        );


    if (
        queue.length === 0
    ) {

        alert(
            "No supported signs were found.\n\n" +
            "Currently supported:\n" +
            "HELLO\n" +
            "YES\n" +
            "NO\n" +
            "HELP\n" +
            "THANK YOU"
        );

        return;

    }


    textSignQueue =
        queue;


    textSignIndex =
        0;


    textSignPlaying =
        true;


    displayTextSign(
        textSignIndex
    );


    startTextSignAutoPlay();

}


/* =========================================================
   DISPLAY SIGN GIF
========================================================= */

function displayTextSign(index) {

    if (
        !textSignQueue.length ||
        index < 0 ||
        index >= textSignQueue.length
    ) {

        return;

    }


    const sign =
        textSignQueue[index];


    const data =
        TEXT_TO_SIGN_DATA[sign];


    if (!data) {
        return;
    }


    const preview =
        getElement(
            "signPreview"
        );


    const title =
        getElement(
            "signPreviewTitle"
        );


    const description =
        getElement(
            "signPreviewDescription"
        );


    const currentWord =
        getElement(
            "currentSignWord"
        );


    const progress =
        getElement(
            "textSignProgress"
        );


    /* GIF */

    if (preview) {

        preview.innerHTML = "";


        const image =
            document.createElement(
                "img"
            );


        image.src =
            `assets/signs/${data.file}`;


        image.alt =
            `${data.title} sign`;


        image.className =
            "sign-gif";


        image.onerror = () => {

            preview.innerHTML =
                `<div class="sign-error">
                    Unable to load ${data.file}
                </div>`;

        };


        preview.appendChild(
            image
        );

    }


    /* TITLE */

    if (title) {

        title.textContent =
            data.title;

    }


    /* DESCRIPTION */

    if (description) {

        description.textContent =
            data.description;

    }


    /* CURRENT WORD */

    if (currentWord) {

        currentWord.textContent =
            `${data.title} (${index + 1}/${textSignQueue.length})`;

    }


    /* PROGRESS */

    if (progress) {

        const percentage =
            (
                (index + 1) /
                textSignQueue.length
            ) * 100;


        progress.style.width =
            `${percentage}%`;

    }


    updateTextSignButtons();

}


/* =========================================================
   TEXT → SIGN AUTOPLAY
========================================================= */

function startTextSignAutoPlay() {

    stopTextSignTimer();


    if (!textSignPlaying) {
        return;
    }


    /*
        Show each GIF for 3 seconds.
    */

    textSignTimer =
        setTimeout(() => {


            if (!textSignPlaying) {
                return;
            }


            if (
                textSignIndex <
                textSignQueue.length - 1
            ) {

                textSignIndex++;


                displayTextSign(
                    textSignIndex
                );


                startTextSignAutoPlay();


            } else {

                textSignPlaying =
                    false;


                updateTextSignButtons();

            }


        }, 3000);

}


/* =========================================================
   STOP TEXT → SIGN TIMER
========================================================= */

function stopTextSignTimer() {

    if (textSignTimer) {

        clearTimeout(
            textSignTimer
        );


        textSignTimer =
            null;

    }

}


/* =========================================================
   PLAY / PAUSE
========================================================= */

function toggleTextSignPlayback() {

    if (
        !textSignQueue.length
    ) {

        return;

    }


    if (textSignPlaying) {

        textSignPlaying =
            false;


        stopTextSignTimer();


    } else {

        textSignPlaying =
            true;


        startTextSignAutoPlay();

    }


    updateTextSignButtons();

}


/* =========================================================
   NEXT SIGN
========================================================= */

function nextTextSign() {

    if (
        !textSignQueue.length
    ) {

        return;

    }


    if (
        textSignIndex <
        textSignQueue.length - 1
    ) {

        textSignIndex++;


        displayTextSign(
            textSignIndex
        );


        if (textSignPlaying) {

            startTextSignAutoPlay();

        }

    }

}


/* =========================================================
   PREVIOUS SIGN
========================================================= */

function previousTextSign() {

    if (
        !textSignQueue.length
    ) {

        return;

    }


    if (
        textSignIndex > 0
    ) {

        textSignIndex--;


        displayTextSign(
            textSignIndex
        );


        if (textSignPlaying) {

            startTextSignAutoPlay();

        }

    }

}


/* =========================================================
   CLEAR TEXT → SIGN
========================================================= */

function clearTextToSign() {

    stopTextSignTimer();


    textSignQueue = [];


    textSignIndex = 0;


    textSignPlaying = false;


    const input =
        getElement(
            "textToSignInput"
        );


    if (input) {

        input.value =
            "";

    }


    const preview =
        getElement(
            "signPreview"
        );


    if (preview) {

        preview.innerHTML =
            `
            <div class="sign-placeholder">

                <span>🤟</span>

                <p>
                    Enter text to see the sign
                </p>

            </div>
            `;

    }


    const title =
        getElement(
            "signPreviewTitle"
        );


    if (title) {

        title.textContent =
            "Sign Preview";

    }


    const description =
        getElement(
            "signPreviewDescription"
        );


    if (description) {

        description.textContent =
            "Your sign animation will appear here.";

    }


    const currentWord =
        getElement(
            "currentSignWord"
        );


    if (currentWord) {

        currentWord.textContent =
            "No sign selected";

    }


    const progress =
        getElement(
            "textSignProgress"
        );


    if (progress) {

        progress.style.width =
            "0%";

    }


    updateTextSignButtons();

}


/* =========================================================
   UPDATE TEXT → SIGN BUTTONS
========================================================= */

function updateTextSignButtons() {

    const playButton =
        getElement(
            "playTextSignBtn"
        );


    const previousButton =
        getElement(
            "previousTextSignBtn"
        );


    const nextButton =
        getElement(
            "nextTextSignBtn"
        );


    if (playButton) {

        playButton.textContent =
            textSignPlaying
                ? "⏸ Pause"
                : "▶ Play";

    }


    if (previousButton) {

        previousButton.disabled =
            !textSignQueue.length ||
            textSignIndex <= 0;

    }


    if (nextButton) {

        nextButton.disabled =
            !textSignQueue.length ||
            textSignIndex >=
                textSignQueue.length - 1;

    }

}


/* =========================================================
   QUICK SIGN BUTTONS
========================================================= */

function setQuickSign(sign) {

    const input =
        getElement(
            "textToSignInput"
        );


    if (!input) {
        return;
    }


    if (
        sign === "thank_you"
    ) {

        input.value =
            "thank you";

    } else {

        input.value =
            sign;

    }


    startTextToSign();

}


/* =========================================================
   LEARNING → TEXT SIGN
========================================================= */

function openLearningSign(sign) {

    if (
        !TEXT_TO_SIGN_DATA[sign]
    ) {

        return;

    }


    const input =
        getElement(
            "textToSignInput"
        );


    if (input) {

        input.value =
            sign === "thank_you"
                ? "thank you"
                : sign;

    }


    const section =
        document.getElementById(
            "text-sign"
        );


    if (section) {

        section.scrollIntoView({
            behavior: "smooth"
        });

    }


    startTextToSign();

}


/* =========================================================
   SPEECH RECOGNITION INITIALIZATION
========================================================= */

function initializeSpeechRecognition() {

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;


    if (!SpeechRecognition) {

        console.log(
            "Speech recognition is not supported."
        );

        return;

    }


    speechRecognition =
        new SpeechRecognition();


    speechRecognition.continuous =
        false;


    speechRecognition.interimResults =
        false;


    speechRecognition.lang =
        "en-IN";


    speechRecognition.onresult =
        event => {

            const transcript =
                event
                    .results[0][0]
                    .transcript;


            const input =
                getElement(
                    "textToSignInput"
                );


            if (input) {

                input.value =
                    transcript;

            }


            startTextToSign();

        };


    speechRecognition.onerror =
        event => {

            console.error(
                "Speech recognition error:",
                event.error
            );

        };

}


/* =========================================================
   SPEECH → SIGN
========================================================= */

function startSpeechToSign() {

    if (!speechRecognition) {

        alert(
            "Speech recognition is not supported by this browser."
        );

        return;

    }


    try {

        speechRecognition.start();

    } catch (error) {

        console.log(
            "Speech recognition already running."
        );

    }

}


/* =========================================================
   BACKEND HEALTH
========================================================= */

async function testBackend() {

    try {

        const response =
            await fetch(
                `${API_URL}/health`
            );


        const data =
            await response.json();


        console.log(
            "Backend health:",
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


/* =========================================================
   MODEL STATUS
========================================================= */

async function testModelStatus() {

    try {

        const response =
            await fetch(
                `${API_URL}/model-status`
            );


        const data =
            await response.json();


        console.log(
            "Model status:",
            data
        );


        return (
            data.model_loaded === true
        );


    } catch (error) {

        console.error(
            "Model status error:",
            error
        );


        return false;

    }

}


/* =========================================================
   AI ASSISTANT
========================================================= */

function sendAssistantMessage() {

    const input =
        getElement(
            "assistantInput"
        );


    const messages =
        getElement(
            "assistantMessages"
        );


    if (!input || !messages) {
        return;
    }


    const text =
        input.value.trim();


    if (!text) {
        return;
    }


    const userMessage =
        document.createElement(
            "div"
        );


    userMessage.className =
        "chat-message user-message";


    userMessage.textContent =
        text;


    messages.appendChild(
        userMessage
    );


    input.value =
        "";


    setTimeout(() => {

        const botMessage =
            document.createElement(
                "div"
            );


        botMessage.className =
            "chat-message bot-message";


        botMessage.textContent =
            "I'm currently a basic SignBridge AI assistant. More AI capabilities can be connected later.";


        messages.appendChild(
            botMessage
        );


        messages.scrollTop =
            messages.scrollHeight;


    }, 500);

}


/* =========================================================
   EVENT LISTENERS
========================================================= */

function setupEventListeners() {

    /* CAMERA */

    const startCameraButton =
        getElement(
            "startCameraBtn",
            "startCamera"
        );


    if (startCameraButton) {

        startCameraButton.addEventListener(
            "click",
            startCamera
        );

    }


    const stopCameraButton =
        getElement(
            "stopCameraBtn",
            "stopCamera"
        );


    if (stopCameraButton) {

        stopCameraButton.addEventListener(
            "click",
            stopCamera
        );


        stopCameraButton.disabled =
            true;

    }


    /* CLEAR SENTENCE */

    const clearButton =
        getElement(
            "clearSentenceBtn",
            "clearSentence"
        );


    if (clearButton) {

        clearButton.addEventListener(
            "click",
            clearSentence
        );

    }


    /* SPEAK */

    const speakButton =
        getElement(
            "speakSentenceBtn",
            "speakSentence"
        );


    if (speakButton) {

        speakButton.addEventListener(
            "click",
            speakSentence
        );

    }


    /* TEXT → SIGN */

    const textToSignButton =
        getElement(
            "textToSignBtn"
        );


    if (textToSignButton) {

        textToSignButton.addEventListener(
            "click",
            startTextToSign
        );

    }


    /* CLEAR TEXT → SIGN */

    const clearTextButton =
        getElement(
            "clearTextSignBtn"
        );


    if (clearTextButton) {

        clearTextButton.addEventListener(
            "click",
            clearTextToSign
        );

    }


    /* PLAY / PAUSE */

    const playButton =
        getElement(
            "playTextSignBtn"
        );


    if (playButton) {

        playButton.addEventListener(
            "click",
            toggleTextSignPlayback
        );

    }


    /* PREVIOUS */

    const previousButton =
        getElement(
            "previousTextSignBtn"
        );


    if (previousButton) {

        previousButton.addEventListener(
            "click",
            previousTextSign
        );

    }


    /* NEXT */

    const nextButton =
        getElement(
            "nextTextSignBtn"
        );


    if (nextButton) {

        nextButton.addEventListener(
            "click",
            nextTextSign
        );

    }


    /* SPEECH → SIGN */

    const speechButton =
        getElement(
            "speechToSignBtn"
        );


    if (speechButton) {

        speechButton.addEventListener(
            "click",
            startSpeechToSign
        );

    }


    /* AI ASSISTANT */

    const assistantButton =
        getElement(
            "assistantSendBtn"
        );


    if (assistantButton) {

        assistantButton.addEventListener(
            "click",
            sendAssistantMessage
        );

    }


    const assistantInput =
        getElement(
            "assistantInput"
        );


    if (assistantInput) {

        assistantInput.addEventListener(
            "keydown",
            event => {

                if (
                    event.key === "Enter"
                ) {

                    sendAssistantMessage();

                }

            }
        );

    }


    /* QUICK SIGN BUTTONS */

    document
        .querySelectorAll(
            "[data-sign]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const sign =
                        button.getAttribute(
                            "data-sign"
                        );


                    setQuickSign(
                        sign
                    );

                }
            );

        });

}


/* =========================================================
   INITIALIZATION
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        console.log(
            "================================"
        );

        console.log(
            "SignBridge AI Starting..."
        );

        console.log(
            "================================"
        );


        setupNavigation();


        setupEventListeners();


        initializeSpeechRecognition();


        updateSentenceUI();


        updateTextSignButtons();


        await initializeHands();


        await testBackend();


        await testModelStatus();


        console.log(
            "SignBridge AI initialized successfully."
        );

    }
);