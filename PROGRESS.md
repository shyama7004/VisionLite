# Progress log

What was actually run, and what it printed. Machine: Windows 11, Python 3.12 (virtual environment), Node 24. No Docker, no make.

## Phase 1: Core screening

    cd frontend && npx vitest run
    Test Files  3 passed (3)    Tests  51 passed (51)

Covers: optotype size maths, line layout fitting (5, 3 or 1 symbols), pass rule 3 of 5, first failure stops, results 1.1 and 0.0, calibration range, colour plates (dots inside the circle, no overlap, mask agreement, same seed same plate), translation key parity, banned words scan.

Sizes drawn at px_per_mm = 6.1 (from the test): logMAR 0.0 gives 8.87 px, logMAR 0.5 gives 28.05 px. This matches the expected 8.9 px and 28 px.

## Phase 2: Voice and camera

    cd backend && pytest tests/test_vocab.py
    64 passed

    pytest tests/test_asr_real.py
    1 passed    (real faster-whisper base model, spoken "yes" made with the Windows speech engine, matched "yes")

    pytest tests/test_vision_geometry.py tests/test_api.py
    glasses photo on a drawn image, manual caliper points, friendly "no face" message, upload folder stays empty: all passed

    distance formula: iris 29 px, focal 1000 px gives 403.4 mm (vitest)

    playwright camera project (fake camera flags): distance guard mounts, leaves "loading", loads the local model, makes no request outside localhost. Passed.
    playwright languages: Hindi and Odia tap interview, "Staff: please read this aloud" shown, Odia voice button off. Passed.

Not run: a real face photo (none in the repo), a real phone, Odia voice.

## Phase 3: Recommendation

    pytest tests/test_rules.py     19 passed   (17 shared fixture cases, Python engine)
    vitest tests/rules.test.ts     the same 17 cases, TypeScript engine, all passed

    python backend/app/ml/train.py
    Using SYNTHETIC data: 20000 rows (made up, not clinical)
    MAE of the middle estimate: 0.54 D
    Share of true values inside the 15-85 range: 68%
    GET /api/health  ->  "model": true

Bug found by looking at the sample PDF: a model range that crossed zero printed as "+0.50 ~ -0.75". Fixed: such a range is dropped and the rules range is kept.

Not done: checking the outputs against volunteers who have prescriptions.

## Phase 4: Report, offline, deploy

    pytest tests/test_report.py     9 passed
    one page PDF in English, Hindi and Odia, plus the longest case for each: 1 page every time

Sample PDFs and PNGs are in `docs/`. Hindi and Odia letters and joined letters look correct. The PDFs were made with headless Chromium, because WeasyPrint's GTK libraries could not be installed on this machine.

    playwright e2e   9 passed (26 s)
      full visit in English, session saved on the server, PDF downloads (starts with %PDF)
      red flag gives the referral banner and no lens card
      skipping every test is allowed and listed on the result
      refresh keeps the visit
      Hindi and Odia tap interviews, Odia voice off
      offline: load once, go offline, reload, full visit, rules only result, print enabled, PDF disabled,
        visit reaches the server after the network returns
      distance guard with a fake camera

Totals at the last run: 123 backend tests, 51 frontend tests, 9 browser tests, all passing.

Not run: `docker build` and `docker run` (Docker is not installed on this machine). The Dockerfile is untested.

## Problems met on the way

- Vitest's default runner failed to start on this machine. The `vmThreads` pool works and is set in `vitest.config.ts`.
- The face model download failed on a Windows certificate revocation check. Worked with `curl --ssl-no-revoke`. `scripts/run.py` uses Python's own downloader.
- GTK for WeasyPrint could not be installed (running the downloaded installer was blocked). Chromium fallback used for PDFs.
- `av` 19 broke faster-whisper. Pinned `av>=14,<17`.
- The distance guard could stay on "loading" forever when the camera permission was never answered. Added a 10 second limit that offers the tape option.
