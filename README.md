# VisionLite

Team Debuggers, NIT Rourkela. ZEISS India Hackathon: Beyond Code 2026.
Tagline: No Device Vision Intelligence and Accessible Clinical UX.

## What it is

VisionLite is a phone based eye screening for small optical stores that have no eye testing machine.
A store worker runs a short screening on a phone. The customer answers a few questions, takes simple tests on the screen, and the phone suggests a lens.

VisionLite is a screening and recommendation tool. It does not diagnose, and it does not replace an eye doctor.

## The problem

Many rural stores have only a counter and a phone. The customer either guesses a power and buys ready made glasses, or travels to a town for a proper test. Wrong glasses mean eye strain, headaches and wasted money. Staff and customers speak local languages, but most tools are in English only.

## What a visit looks like

1. Pick a language: English, Hindi or Odia.
2. Consent. The customer is told this is a screening and the photo is not stored.
3. Calibrate the screen once, with a bank card held against the glass.
4. Interview. Thirteen short questions, one per screen. Tap to answer. Voice is an extra.
5. Tests: distance chart for each eye, near reading, a line pattern for astigmatism, and a colour check.
6. The camera checks how far the customer stands and tells them to move closer or back.
7. A photo of the face or of the old glasses, for pupil distance and frame size.
8. Result: lens type, rough power range, coating advice, and a doctor flag if anything looks unusual. A one page PDF in the customer's language.

## How it works

- Phone browser: React and Vite, installable web app.
- Server: Python and FastAPI, with SQLite.
- Distance check: runs in the browser with MediaPipe, using the size of the iris as a ruler. Camera video never leaves the phone.
- Photo analysis: runs on the server with OpenCV and MediaPipe. The photo is deleted straight away. Only the numbers are kept.
- Voice: Whisper speech to text on the server, for Hindi and English.
- Recommendation: simple rules plus a small LightGBM model for the power range.
- Report: one page PDF.

The rules live in one file, `shared/rules.json`. The same rules run in Python and in TypeScript, and a shared test file checks that both give the same answers.

## Run it

You need Python 3.10 to 3.12, and Node 20 or newer. There is no need for `make`.

    python scripts/run.py setup     one time: installs everything, downloads the face model, trains the model
    python scripts/run.py dev       backend on port 8000, app on port 5173
    python scripts/run.py run       build and serve everything on port 8000

On Mac and Linux you can use `make setup`, `make dev` and so on. They call the same script.

Open http://localhost:5173 in the browser while `dev` is running.

## Try it on a real phone

The camera and microphone only work on HTTPS, or on localhost.

1. Put the phone and the computer on the same Wi-Fi.
2. Run `python scripts/run.py dev --https`.
3. Open the address shown for "Network" on the phone, for example https://192.168.1.20:5173.
4. The phone warns about the certificate. Accept it. It is a self made certificate.
5. Set the phone brightness to full.

## Test it

    python scripts/run.py test      unit tests, fixtures and safety checks
    python scripts/run.py e2e       builds the app and drives full visits in a phone sized browser

The tests cover the chart size maths, the pass rules, colour plates, translation keys, the shared rules fixtures, voice answer matching, photo geometry, the one page PDF in three languages, offline use, and a banned words scan.

## Retrain the model

The model gives the power range. Today it is trained on made up data. Those numbers show that the code works. They do not show that the power ranges are clinically correct.

To use real data from volunteers, make a CSV with one row per eye and these columns:

    age, better_logmar, this_eye_logmar, eye_diff, near_logmar, screen_hours_code,
    headache_code, night_trouble, wears_glasses, astig_hint, sphere

`sphere` is the optometrist's value in dioptres. The codes are explained at the top of `backend/app/ml/train.py`. Then run:

    backend/.venv/Scripts/python backend/app/ml/train.py --csv volunteers.csv

Checking the outputs against volunteers who have prescriptions has not been done yet.

## Voice and Odia

Tap to answer is the main way in all three languages. Voice is an extra.
Hindi and English voice work with the Whisper model. Odia voice is off by default, because the stock Whisper models are not usable for Odia.
To turn it on, set `ODIA_ASR_MODEL` to a CTranslate2 converted Whisper model. Community fine tuned Odia models exist on Hugging Face and can be converted with `ct2-transformers-converter`. Do not rely on Odia voice until a model is set up and tested.
If the phone has no Odia voice for reading questions aloud, the screen shows "Staff: please read this aloud".

## Offline

After the first load, the app works with no network. All tests, the tap interview, the distance check and a rules only report work offline. The model range and voice need internet. Visits are kept on the phone and sent to the server when the network returns. Offline, the Print button gives a printable page.

## Settings

Set these as environment variables.

    WHISPER_MODEL    base by default. Use tiny on very small servers. Accuracy drops.
    ODIA_ASR_MODEL   path to an Odia model. Empty means Odia voice is off.
    STORE_NAME       printed on the report.
    DATA_DIR         where the database lives. Default ./data
    RETENTION_DAYS   visits older than this are deleted. Default 90.

## Deploy

A Dockerfile is included. It was written but not built on the prototype machine, because Docker was not installed there.

    docker build -t visionlite .
    docker run -p 8000:8000 -v $(pwd)/data:/app/data visionlite

Free cloud tier: Render works with a Docker image. Create a web service from this repository, choose Docker, and set port 8000. Whisper base needs roughly 500 MB to 1 GB of RAM. On very small free tiers set `WHISPER_MODEL=tiny`. Put the app behind HTTPS, which most hosts do for you, because the camera needs it.

## Known limits

- Distance from the camera is an estimate, about plus or minus 15 percent.
- The power model uses made up data. No real store trial has been done.
- Every threshold in `shared/rules.json` needs review by an optometrist before real use.
- Hindi and Odia text was written without a native speaker review.
- Odia voice is off by default.
- Not yet tested on real phones, with real faces, or with real glasses.
- On Windows without GTK, PDFs are made with headless Chromium. The Docker image uses WeasyPrint, which has not been run yet.

See ASSUMPTIONS.md for every decision and PROGRESS.md for what was run.
