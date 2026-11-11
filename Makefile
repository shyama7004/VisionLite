# Thin wrapper. The real work is in scripts/run.py, which also works on Windows without make.
PY ?= python3

setup:
	$(PY) scripts/run.py setup
dev:
	$(PY) scripts/run.py dev
test:
	$(PY) scripts/run.py test
e2e:
	$(PY) scripts/run.py e2e
build:
	$(PY) scripts/run.py build
run:
	$(PY) scripts/run.py run

.PHONY: setup dev test e2e build run
