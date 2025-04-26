import { btnSend, btnAbort, btnClear, btnCode, btnText, btnReset, selectedModel, txtPrompt, root } from "./domElements.js";
import { setInitialText, handleNextPrompt } from "./samples.js";

export let abortController = new AbortController();

export function initEventHandlers(deps) {
  const { 
    processRequest,
    handleStart,
    handleStop,
    isImageModel,
    chatHistory,
    modelRef
  } = deps;
  
  btnSend.addEventListener("click", () => {
    handleStart();
    processRequest(txtPrompt.value, modelRef.value);
    btnAbort.focus();
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

  selectedModel.addEventListener("change", () => {
    modelRef.value = selectedModel.selectedOptions[0].value;
    if (isImageModel(modelRef.value)) {
      handleNextPrompt(modelRef.value !== "dall-e-2" ? "image" : "image_dalle_2", txtPrompt);
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
