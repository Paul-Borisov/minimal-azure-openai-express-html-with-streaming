import { root, txtPrompt, btnAbort, selectedModel, openAiIcon } from "./domElements.js";
import { initScrollListener } from "./scrollManager.js";
import { setInitialText } from "./samples.js";
import { processRequest } from "./requestProcessor.js";
import { initEventHandlers, abortController } from "./eventHandlers.js";
import { thinkingHeader, handleErrorOutput } from "./ui.js";

// Local state and controllers.
const modelRef = { 
  value: selectedModel.selectedOptions[0].value,
  defaultParams: selectedModel.selectedOptions[0].dataset.params
};
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
  root.classList.add("inprogress");
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
  root.classList.remove("inprogress");  
}

function isAudioModel(model) {
  return /audio/i.test(model);
}

function isEmbeddingModel(model) {
  return /embedding/i.test(model);
}

function isImageModel(model) {
  return /image|dall-e/i.test(model);
}

function isRealtimeModel(model) {
  return /realtime/i.test(model);
}

function isVideoModel(model) {
  return /sora/i.test(model);
}

// Initialize event handlers and pass necessary dependencies.
initEventHandlers({
  processRequest: (content, model, defaultParams) => processRequest({
    content,
    model,
    defaultParams,
    chatHistory,
    root,
    abortController,
    openAiIcon,
    audioStreamingManager,
    isAudioModel,
    isEmbeddingModel,
    isImageModel,
    isRealtimeModel,
    isVideoModel,
    handleStop,
    handleErrorOutput,
    txtPrompt,
    thinkingHeader
  }),
  handleStart,
  handleStop,
  isImageModel,
  isVideoModel,
  chatHistory,
  modelRef
});
