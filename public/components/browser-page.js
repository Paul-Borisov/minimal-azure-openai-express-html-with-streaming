import { root, txtPrompt, btnAbort, selectedModel, openAiIcon } from "./domElements.js";
import { initScrollListener } from "./scrollManager.js";
import { setInitialText } from "./samples.js";
import { processRequest } from "./requestProcessor.js";
import { initEventHandlers, abortController } from "./eventHandlers.js";
import { thinkingHeader, handleErrorOutput } from "./ui.js";

// Local state and controllers.
const modelRef = { value: selectedModel.selectedOptions[0].value };
let audioStreamingManager = null;
const chatHistory = [];

// Initialize scrolling behavior and set the initial prompt.
initScrollListener(root);
setInitialText(txtPrompt);

// UI helper functions.
function handleStart() {
  document.querySelectorAll(".text button").forEach(btn => btn.setAttribute("disabled", true));
  btnAbort.classList.remove("invisible");
  btnAbort.removeAttribute("disabled");
}

function handleStop() {
  document.querySelectorAll(".text button").forEach(btn => btn.removeAttribute("disabled"));
  btnAbort.classList.add("invisible");
  if (audioStreamingManager?.isProcessing) {
    audioStreamingManager.stopPlayback();
  }
  if(isRealtimeModel(modelRef.value) && typeof stopRealtimeSession === "function") {
    stopRealtimeSession();
  }
}

function isAudioModel(model) {
  return /audio/i.test(model);
}

function isEmbeddingModel(model) {
  return /embedding/i.test(model);
}

function isImageModel(model) {
  return /image/i.test(model);
}

function isRealtimeModel(model) {
  return /realtime/i.test(model);
}

// Initialize event handlers and pass necessary dependencies.
initEventHandlers({
  processRequest: (content, model) => processRequest({
    content,
    model,
    chatHistory,
    root,
    abortController,
    openAiIcon,
    audioStreamingManager,
    isAudioModel,
    isEmbeddingModel,
    isImageModel,
    isRealtimeModel,
    handleStop,
    handleErrorOutput,
    txtPrompt,
    thinkingHeader
  }),
  handleStart,
  handleStop,
  isImageModel,
  chatHistory,
  modelRef
});
