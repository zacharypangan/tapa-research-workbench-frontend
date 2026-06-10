#!/usr/bin/env bash
set -euo pipefail

EMBEDDING_MODEL="${OLLAMA_EMBEDDING_MODEL:-nomic-embed-text}"
RETRIEVAL_MODEL="${OLLAMA_RETRIEVAL_MODEL:-llama3.1}"
VISION_MODEL="${OLLAMA_VISION_MODEL:-llava}"
OLLAMA_URL="${REPOSITORY_OLLAMA_BASE_URL:-${OLLAMA_BASE_URL:-http://localhost:11434}}"

echo "Local Ollama model setup"
echo "Ollama URL: ${OLLAMA_URL}"
echo "Embedding model: ${EMBEDDING_MODEL}"
echo "Retrieval model: ${RETRIEVAL_MODEL}"
echo "Vision model: ${VISION_MODEL}"
echo

if ! command -v ollama >/dev/null 2>&1; then
  cat <<'MSG'
Ollama is not installed or is not on PATH.

Install Ollama from:
  https://ollama.com/download

After installation, start Ollama and rerun:
  ./setup_ollama_models.sh
MSG
  exit 1
fi

if ! curl -fsS "${OLLAMA_URL%/}/api/tags" >/dev/null 2>&1; then
  echo "Ollama is not responding yet. Trying to start 'ollama serve' in the background..."
  nohup ollama serve >/tmp/local-ollama-setup.log 2>&1 &
  sleep 3
fi

if ! curl -fsS "${OLLAMA_URL%/}/api/tags" >/dev/null 2>&1; then
  cat <<MSG
Ollama is installed, but ${OLLAMA_URL} is still not reachable.

Start Ollama manually, then rerun this script:
  ollama serve

If your backend uses a different URL, set:
  REPOSITORY_OLLAMA_BASE_URL=<your-ollama-url>
MSG
  exit 1
fi

pull_model() {
  local model="$1"
  if [ -z "$model" ]; then
    return
  fi
  echo
  echo "Pulling ${model}..."
  ollama pull "$model"
}

pull_model "$EMBEDDING_MODEL"
pull_model "$RETRIEVAL_MODEL"
pull_model "$VISION_MODEL"

echo
echo "Ollama models are ready."
