import { btnSend, btnAbort, btnClear, btnCode, btnText, btnReset, selectedModel, txtPrompt, root } from "./domElements.js";
import { setInitialText, handleNextPrompt } from "./samples.js";
import { handleVoiceOut, stopAllVoiceOuts } from "./voiceOut.js";

export let abortController = new AbortController();

export function initEventHandlers(deps) {
  const { 
    processRequest,
    handleStart,
    handleStop,
    isImageModel,
    isVideoModel,
    chatHistory,
    modelRef
  } = deps;
  
  btnSend.addEventListener("click", () => {
    handleStart();
    processRequest(txtPrompt.value, modelRef.value, modelRef.defaultParams);
    btnAbort.focus();
    stopAllVoiceOuts();
  });

  btnAbort.addEventListener("click", () => {
    if (!btnSend.hasAttribute("disabled")) return;
    abortController.abort();
    handleStop();
    abortController = new AbortController();
  });

  btnCode.addEventListener("click", () => {
    handleNextPrompt("code", txtPrompt);
  });

  btnText.addEventListener("click", () => {
    handleNextPrompt("text", txtPrompt);
  });

  btnClear.addEventListener("click", () => {
    txtPrompt.value = "";
  });

  btnReset.addEventListener("click", () => {
    root.innerHTML = "";
    setInitialText(txtPrompt);
    chatHistory.length = 0;
  });

  root.addEventListener("click", async (e) => {
    const targetElement = e.target.closest(".voice-out");
    if (targetElement) {
      handleVoiceOut(targetElement);
    }
  });

  selectedModel.addEventListener("change", () => {
    modelRef.value = selectedModel.selectedOptions[0].value;
    modelRef.defaultParams = selectedModel.selectedOptions[0].dataset.params;
    if (isImageModel(modelRef.value)) {
      handleNextPrompt(modelRef.value !== "dall-e-2" ? "image" : "image_dalle_2", txtPrompt);
    } else if (isVideoModel(modelRef.value)) {
      if (/veo-3/.test(modelRef.value)) {
        handleNextPrompt("video_with_sound", txtPrompt);
      } else {
        handleNextPrompt("video", txtPrompt);
      }
    }
  });

  txtPrompt.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    if (event.altKey || event.ctrlKey) {
      txtPrompt.value += "\n";
      return;
    }
    event.preventDefault();
    txtPrompt.blur();
    btnSend.click();
  });
}
