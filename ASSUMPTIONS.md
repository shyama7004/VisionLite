# Assumptions and open items

This file lists every decision the slides did not make, everything that needs a human expert, and everything that could not be verified.

## Decisions from the build brief

1. Chart symbols: tumbling E drawn in code on a 5 by 5 grid, stroke one fifth of the height. It needs no font and works for every language. The optional letters switch was not built.
2. Odia speech: tap to answer is the main path in all languages. The Odia voice button is off unless `ODIA_ASR_MODEL` points to a converted model. Not tested with a real Odia model.
3. Question audio: browser speech synthesis. If no `hi-IN`, `en-IN` or `or-IN` style voice exists, the screen says "Staff: please read this aloud".
4. Live distance check runs in the browser (MediaPipe, files served locally). Photo analysis runs on the server.
5. Offline: tests, tap interview, distance check and rules only report work offline. Model range and voice need internet. Visits are kept in IndexedDB and synced later. The rules exist in Python and TypeScript and are tested against one fixture file.
6. PDF: WeasyPrint is the plan and is used when its system libraries exist (the Docker image). On this Windows machine the GTK libraries could not be installed, so PDFs were made with headless Chromium. The WeasyPrint path has not been run.
7. Colour check: own generated dot plates, seeded, with a control plate. No copied test plates.
8. Privacy: photos are analysed in memory. Name and phone are stored only when the consent box is ticked, and the server drops them otherwise.
9. All numbers in `shared/rules.json` are starting values.
10. Translations were written by the build, not by a native speaker.
11. Test distance is 1.0 m for the chart and 0.4 m for near, with plus or minus 15 percent allowed.

## New decisions made while building

- Screen calibration uses the short side of the card (53.98 mm), held upright. The long side (85.6 mm) does not fit across a phone in portrait. The tall box in step 2 shows the long side as a check.
- The astigmatism dial and the colour plates are guarded at the near distance (0.4 m).
- The interview has 13 questions (the brief says "eleven or fewer" in one place and lists 13 in another). The glasses age question is skipped when the customer does not wear glasses, so it is 12 or 13 screens.
- Power range order: "low" is the value nearer zero and "high" is further from zero, for example -1.00 and -1.75. Ranges are at least 1.0 D wide, so the rules only table gives for example -0.50 to -1.50.
- A model range that crosses zero is not used. The rules range is kept instead.
- The model range is only used when the lens type includes a distance correction and the eye's chart result is 0.2 or worse.
- If the camera or model is not ready in 10 seconds, staff can tick "I measured the distance". The app never gets stuck.
- Real world sizes used as rulers: iris 11.7 mm (face and distance), bank card 85.6 mm by 53.98 mm (screen and glasses photo).
- `av` is pinned below version 17 because faster-whisper 1.2.1 does not work with the newest release.
- The helper script `scripts/run.py` replaces `make` on Windows. A Makefile calls the same script.
- Test pages use `?debug=1` to expose the true chart directions and plate digits to the browser tests. Without it nothing is exposed.

## Known mismatch to review

The synthetic data uses the blur formula from the brief. That formula makes a short sighted eye of about -1 D read near logMAR 0.7, which the referral rules treat as "refer and block". The rules only table maps logMAR 0.6 to 0.7 to -1.75 to -2.75 D. These two do not agree. Real volunteer data will show which is right. This matters before any real use.

## Needs review by an optometrist

- Every value in `shared/rules.json`: referral limits, minimum age, reading add by age, the rules only power table, frame size bins, the 15 percent distance tolerance.
- Interview questions 8 to 13 (the warning questions). They are not in the slides.
- The rule that any yes to a warning question blocks lens advice.
- The wording of the astigmatism and colour hints.

## Needs review by a native speaker (Hindi and Odia)

Every key in `frontend/src/i18n/hi.json` and `or.json`. Pay most attention to:

- `disclaimer_default`, `consent_body`, `res_power_note`, `res_block`, `res_refer`, `res_advise`
- all `q_*` and `a_*` interview keys, `astig_note`, `color_note`, `blue_light_note`
- all `code_*` reason texts, `lens_*` names
- Odia words for medical terms (astigmatism, progressive lenses, pupil distance)

## Could not be verified

- Docker: not installed on the build machine. The Dockerfile has not been built or run.
- WeasyPrint: see decision 6. Fonts for Hindi and Odia were checked only in the Chromium output (samples in `docs/`).
- Real phone testing: not done. Camera distance accuracy, screen calibration with a real card, speech reading, and wake lock were not tried on a phone.
- Face photo analysis on a real face: no face photo was in the repo. Only the geometry was tested, with made up landmark arrays, and the "no face" path with a blank image.
- Glasses photo analysis: tested on a drawn image, not on real glasses.
- Live distance with a real face: the fake camera has no face, so only mounting, local file loading and the "no face" path were tested. The distance formula is unit tested.
- Voice in the browser: the real Whisper model hears a spoken "yes" from a WAV file. Recording in a real phone browser (webm or mp4) was not tried.
- Odia voice: not tested, no model.
- Clinical accuracy: the power model uses made up data. Nothing was compared with volunteers who have prescriptions.
- A trial in real stores.
