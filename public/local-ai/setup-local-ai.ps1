$ErrorActionPreference = "Stop"

$EmbeddingModel = if ($env:OLLAMA_EMBEDDING_MODEL) { $env:OLLAMA_EMBEDDING_MODEL } else { "nomic-embed-text" }
$RetrievalModel = if ($env:OLLAMA_RETRIEVAL_MODEL) { $env:OLLAMA_RETRIEVAL_MODEL } else { "llama3.1" }
$VisionModel = if ($env:OLLAMA_VISION_MODEL) { $env:OLLAMA_VISION_MODEL } else { "llava" }
$OllamaUrl = if ($env:REPOSITORY_OLLAMA_BASE_URL) { $env:REPOSITORY_OLLAMA_BASE_URL } elseif ($env:OLLAMA_BASE_URL) { $env:OLLAMA_BASE_URL } else { "http://localhost:11434" }

function Test-Ollama {
  try {
    Invoke-RestMethod -Uri "$($OllamaUrl.TrimEnd('/'))/api/tags" -TimeoutSec 2 | Out-Null
    return $true
  } catch {
    return $false
  }
}

if (-not (Get-Command ollama -ErrorAction SilentlyContinue)) {
  Write-Host "Ollama is not installed. Opening the download page..."
  Start-Process "https://ollama.com/download"
  Write-Host "Install Ollama, then run this setup again."
  Read-Host "Press Enter to close this window"
  exit 1
}

if (-not (Test-Ollama)) {
  Write-Host "Starting Ollama..."
  Start-Process -WindowStyle Hidden -FilePath "ollama" -ArgumentList "serve"
  for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Seconds 1
    if (Test-Ollama) { break }
  }
}

if (-not (Test-Ollama)) {
  Write-Host "Ollama did not start. Open Ollama manually, then run this setup again."
  Read-Host "Press Enter to close this window"
  exit 1
}

foreach ($Model in @($EmbeddingModel, $RetrievalModel, $VisionModel)) {
  Write-Host ""
  Write-Host "Pulling $Model..."
  ollama pull $Model
}

Write-Host ""
Write-Host "Preloading $RetrievalModel..."
$Body = @{ model = $RetrievalModel; prompt = "ready"; stream = $false } | ConvertTo-Json
try {
  Invoke-RestMethod -Method Post -Uri "$($OllamaUrl.TrimEnd('/'))/api/generate" -Body $Body -ContentType "application/json" -TimeoutSec 120 | Out-Null
} catch {
  Write-Host "Preload skipped; model is still installed."
}

Write-Host ""
Write-Host "Local AI is ready. Return to Research Workbench and click Check Local AI."
Read-Host "Press Enter to close this window"
