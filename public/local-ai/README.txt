Research Workbench Local AI Setup

This setup is only needed for Assisted Review.

Search, uploads, extraction, and reports work normally without Local AI.

macOS:

1. Download setup-local-ai.command.
2. Open it.
3. If macOS says “Apple could not verify” and shows Move to Trash / Done, click Done.
4. Control-click or right-click setup-local-ai.command, choose Open, then choose Open again.
5. Wait until it says “Local AI is ready.”
6. Return to Research Workbench and click “Check Local AI.”

If macOS still blocks it:

1. Open Terminal.
2. Type this command, then press Enter:
   chmod +x ~/Downloads/setup-local-ai.command
3. Type this command, then press Enter:
   xattr -d com.apple.quarantine ~/Downloads/setup-local-ai.command
4. Control-click or right-click setup-local-ai.command, choose Open, then choose Open again.

Windows:

1. Download setup-local-ai.bat.
2. Double-click it.
3. If Windows SmartScreen appears, click More info, then Run anyway.
4. If Windows asks for permission, allow it.
5. Wait until it says “Local AI is ready.”
6. Return to Research Workbench and click “Check Local AI.”

If the script says Ollama is not installed:

1. Install Ollama from the page that opens.
2. Run the setup script again.
3. Return to Research Workbench and click “Check Local AI.”

Important:
AI outputs are review aids only. Always check cited passages before using them in analysis or presentations.
