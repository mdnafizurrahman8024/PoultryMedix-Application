# PoultryMedix Audio Classification Model Directory

This directory is scaffolded for browser-based edge acoustic classification of poultry flock respiratory sounds (e.g., rales, coughing, sneezing, snicking, stridor vs. healthy ambient flock noise).

## Expected Model Files
When exporting an audio model from Google Teachable Machine (or TensorFlow.js speech-commands):
1. `model.json` - Model topology and weight manifest
2. `metadata.json` - Word/sound labels and spectrogram parameters
3. `weights.bin` (or multiple chunked bin files) - Model weights

## Edge Loader Integration
Once placed here, the application can load the audio model directly from `/models/audio/model.json` via `poultry-medix/src/lib/edgeModelLoader.js` without sending raw audio files over low-bandwidth rural cellular connections.
