#!/usr/bin/env bash
set -euo pipefail

EMBEDDING_MODEL="${OLLAMA_EMBEDDING_MODEL:-nomic-embed-text}"
RETRIEVAL_MODEL="${OLLAMA_RETRIEVAL_MODEL:-llama3.1}"
VISION_MODEL="${OLLAMA_VISION_MODEL:-llava}"
OLLAMA_URL="${REPOSITORY_OLLAMA_BASE_URL:-${OLLAMA_BASE_URL:-http://localhost:11434}}"
OLLAMA_BIN="${OLLAMA_BIN:-ollama}"

if ! command -v "$OLLAMA_BIN" >/dev/null 2>&1; then
  if [ -x "/Applications/Ollama.app/Contents/Resources/ollama" ]; then
    OLLAMA_BIN="/Applications/Ollama.app/Contents/Resources/ollama"
  else
    echo "Ollama is not installed. Opening the download page..."
    if command -v open >/dev/null 2>&1; then
      open "https://ollama.com/download"
    elif command -v xdg-open >/dev/null 2>&1; then
      xdg-open "https://ollama.com/download"
    fi
    echo "Install Ollama, then run this setup again."
    exit 1
  fi
fi

wait_for_ollama() {
  for _ in $(seq 1 20); do
    if curl -fsS "${OLLAMA_URL%/}/api/tags" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

if ! wait_for_ollama; then
  echo "Starting Ollama..."
  nohup "$OLLAMA_BIN" serve >/tmp/local-ai-ollama.log 2>&1 &
  wait_for_ollama || {
    echo "Ollama did not start. Open Ollama manually, then run this setup again."
    exit 1
  }
fi

pull_model() {
  local model="$1"
  echo
  echo "Pulling ${model}..."
  "$OLLAMA_BIN" pull "$model"
}

pull_model "$EMBEDDING_MODEL"
pull_model "$RETRIEVAL_MODEL"
pull_model "$VISION_MODEL"

echo
echo "Preloading ${RETRIEVAL_MODEL}..."
curl -fsS "${OLLAMA_URL%/}/api/generate" \
  -H "Content-Type: application/json" \
  -d "{\"model\":\"${RETRIEVAL_MODEL}\",\"prompt\":\"ready\",\"stream\":false}" >/dev/null || true

echo
echo "Local AI is ready. Return to Research Workbench and click Check Local AI."
