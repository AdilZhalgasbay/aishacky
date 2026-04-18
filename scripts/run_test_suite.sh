#!/usr/bin/env bash
set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p scratch

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
SUMMARY_FILE="scratch/test-summary-${TIMESTAMP}.txt"
STABLE_LOG="scratch/pytest-stable-${TIMESTAMP}.log"
LIVE_LOG="scratch/pytest-live-${TIMESTAMP}.log"
BUILD_LOG="scratch/build-${TIMESTAMP}.log"

if [[ -x ".venv/bin/python" ]]; then
  PYTHON_BIN="${PYTHON_BIN:-.venv/bin/python}"
else
  PYTHON_BIN="${PYTHON_BIN:-python3}"
fi

LIVE_MODE=0
if [[ "${1:-}" == "--live" ]]; then
  LIVE_MODE=1
fi

echo "AIS Hack 3.0 test suite" | tee "$SUMMARY_FILE"
echo "Root: $ROOT_DIR" | tee -a "$SUMMARY_FILE"
echo "Python: $PYTHON_BIN" | tee -a "$SUMMARY_FILE"
echo "Live mode: $LIVE_MODE" | tee -a "$SUMMARY_FILE"
echo "Timestamp: $TIMESTAMP" | tee -a "$SUMMARY_FILE"

if ! "$PYTHON_BIN" -m pytest --version >/dev/null 2>&1; then
  echo "pytest is missing for $PYTHON_BIN. Installing pytest into the selected environment..." | tee -a "$SUMMARY_FILE"
  if ! "$PYTHON_BIN" -m pip install pytest >/dev/null 2>&1; then
    echo "Failed to install pytest automatically." | tee -a "$SUMMARY_FILE"
    exit 1
  fi
fi

echo "" | tee -a "$SUMMARY_FILE"
echo "[1/4] python compile smoke" | tee -a "$SUMMARY_FILE"
if "$PYTHON_BIN" -m compileall app api | tee -a "$SUMMARY_FILE"; then
  echo "compileall: OK" | tee -a "$SUMMARY_FILE"
else
  echo "compileall: FAIL" | tee -a "$SUMMARY_FILE"
  exit 1
fi

echo "" | tee -a "$SUMMARY_FILE"
echo "[2/4] stable pytest suite" | tee -a "$SUMMARY_FILE"
set +e
"$PYTHON_BIN" -m pytest tests -m "not live" -q | tee "$STABLE_LOG"
STABLE_EXIT=${PIPESTATUS[0]}
set -e
echo "stable pytest exit code: $STABLE_EXIT" | tee -a "$SUMMARY_FILE"

echo "" | tee -a "$SUMMARY_FILE"
echo "[3/4] frontend build smoke" | tee -a "$SUMMARY_FILE"
if [[ -d "web" ]]; then
  set +e
  (cd web && npm run build) | tee "$BUILD_LOG"
  BUILD_EXIT=${PIPESTATUS[0]}
  set -e
else
  BUILD_EXIT=0
  echo "web directory not found, skipping build" | tee "$BUILD_LOG"
fi
echo "frontend build exit code: $BUILD_EXIT" | tee -a "$SUMMARY_FILE"

LIVE_EXIT=0
if [[ "$LIVE_MODE" -eq 1 ]]; then
  LIVE_BASE_URL="${LIVE_BASE_URL:-http://127.0.0.1:8000}"
  echo "" | tee -a "$SUMMARY_FILE"
  echo "[4/4] live smoke suite" | tee -a "$SUMMARY_FILE"
  echo "LIVE_BASE_URL=$LIVE_BASE_URL" | tee -a "$SUMMARY_FILE"

  if command -v curl >/dev/null 2>&1; then
    if ! curl -fsS "$LIVE_BASE_URL/health" >/dev/null 2>&1; then
      echo "Live API health check failed at $LIVE_BASE_URL/health" | tee -a "$SUMMARY_FILE"
      LIVE_EXIT=1
    else
      set +e
      LIVE_BASE_URL="$LIVE_BASE_URL" "$PYTHON_BIN" -m pytest tests -m live -q | tee "$LIVE_LOG"
      LIVE_EXIT=${PIPESTATUS[0]}
      set -e
    fi
  else
    echo "curl is not available, skipping explicit health check" | tee -a "$SUMMARY_FILE"
    set +e
    LIVE_BASE_URL="$LIVE_BASE_URL" "$PYTHON_BIN" -m pytest tests -m live -q | tee "$LIVE_LOG"
    LIVE_EXIT=${PIPESTATUS[0]}
    set -e
  fi
  echo "live pytest exit code: $LIVE_EXIT" | tee -a "$SUMMARY_FILE"
fi

FINAL_EXIT=0
if [[ "$STABLE_EXIT" -ne 0 || "$BUILD_EXIT" -ne 0 || "$LIVE_EXIT" -ne 0 ]]; then
  FINAL_EXIT=1
fi

echo "" | tee -a "$SUMMARY_FILE"
echo "Stable log: $STABLE_LOG" | tee -a "$SUMMARY_FILE"
echo "Build log: $BUILD_LOG" | tee -a "$SUMMARY_FILE"
if [[ "$LIVE_MODE" -eq 1 ]]; then
  echo "Live log: $LIVE_LOG" | tee -a "$SUMMARY_FILE"
fi
echo "Final exit code: $FINAL_EXIT" | tee -a "$SUMMARY_FILE"

exit "$FINAL_EXIT"
