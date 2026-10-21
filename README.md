# SignBridge AI 🤟
### AI-Powered Bidirectional Sign Language Communication and Learning System

**SignBridge AI** is an AI-powered sign language communication and learning platform designed to help bridge the communication gap between sign language users and people who do not understand sign language.

It combines machine learning, computer vision, speech recognition, and an interactive web interface to support accessible communication.

## ✨ Features

- **Sign-to-Text:** Recognizes supported hand gestures and converts them into text.
- **Text-to-Sign:** Converts typed text into sign animations where implemented.
- **Speech-to-Sign:** Uses speech input to support sign translation.
- **Number Recognition:** Recognizes trained number gestures from 0 to 10.
- **Alphabet Practice:** Supports alphabet gesture practice and recognition.
- **Sign-to-Speech:** Converts recognized signs into spoken output where implemented.
- **Learning Module:** Provides an interface for practicing supported signs.

## 🛠️ Technologies Used

- Python
- Flask
- HTML, CSS, and JavaScript
- OpenCV
- MediaPipe
- NumPy
- scikit-learn
- Joblib
- pyttsx3 for text-to-speech, where used
- Browser Speech Recognition API, where supported

## 📋 Prerequisites

Install the following before running the project:

- Git
- Python 3.12, subject to compatibility with the project's dependencies
- Google Chrome or another compatible browser
- Webcam
- Microphone for speech features
- Node.js and npm, if the frontend uses a Node.js build system
- Internet connection for downloading dependencies and online speech recognition, where required

## 📦 Python Dependencies

The backend uses the following Python packages. These can be installed directly without creating a `requirements.txt` file.

| Package | Purpose |
|---|---|
| Flask | Backend web server and API endpoints |
| Flask-CORS | Cross-origin requests, if used by the backend |
| MediaPipe | Hand landmark detection |
| OpenCV | Webcam and image processing |
| NumPy | Numerical operations and feature arrays |
| scikit-learn | Machine-learning classification |
| Joblib | Loading trained machine-learning models |
| pyttsx3 | Text-to-speech functionality, where used |

### Install all Python dependencies

Open PowerShell in the project folder and run:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install Flask Flask-Cors mediapipe opencv-python numpy scikit-learn joblib pyttsx3 pandas
```

**Important:** This is a proposed dependency list based on the project's described features. Confirm that every package is compatible with your Python version and that the list covers all imports in your current code. Flask-CORS and pyttsx3 are only needed if the project uses them.

If the virtual environment already exists, activate it instead of creating another one.

## 🚀 Installation and Setup

### Step 1: Clone the repository

```powershell
git clone https://github.com/Blue-2510/Sign_bridge.git
cd Sign_bridge
```

### Step 2: Create and activate the virtual environment

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### Step 3: Install Python dependencies

```powershell
python -m pip install --upgrade pip
python -m pip install Flask Flask-Cors mediapipe opencv-python numpy scikit-learn joblib pyttsx3
python -m pip install pandas
```

### Step 4: Install frontend dependencies

If the frontend contains a `package.json`, navigate to the directory containing that file and run:

```powershell
npm install
```

If a `package-lock.json` is included, use `npm ci` for a reproducible installation.

Skip this step if your frontend does not require Node.js.

## ▶️ Running the Project

### Start the Flask backend

Navigate to the directory containing the backend's `app.py` file.

For example, if it is inside `backend`:

```powershell
cd backend
python app.py
```

If `app.py` is in the project root, run `python app.py` from the root instead.

Keep the terminal running while using the application.

### Start the frontend

Use the method appropriate for your frontend setup. If it has a Node.js development script named `dev`, run:

```powershell
npm run dev
```

Open the local URL displayed in the terminal.

## 🧠 Machine-Learning Models and Assets

The project may require trained models and MediaPipe task assets to be present before recognition works.

Check that:

- The required trained `.pkl` model files exist at the paths expected by the backend.
- Any required MediaPipe `.task` files are available.
- Model paths in the code match the actual folder structure.
- Required assets excluded from Git are downloaded or generated using the project's setup instructions.

Installing Python dependencies does not automatically download custom trained models or project-specific assets.

## 🔧 Troubleshooting

**Python installation errors**
- Verify the Python version.
- Activate the correct virtual environment.
- Check the error output for incompatible package versions.

**Webcam not working**
- Allow camera access in your browser.
- Close other applications using the webcam.
- Check the selected camera.

**Microphone or speech recognition errors**
- Allow microphone access in Windows and the browser.
- Check the internet connection if online speech recognition is used.

**Signs not recognized**
- Use adequate lighting.
- Keep your hand visible within the camera frame.
- Check that the trained model loaded successfully.
- Use gestures supported by the model.

**SignBridge AI — Breaking Barriers. Building Bridges.** 🤟
