import { getTargetEntpointForModel } from "./utils.js";
import { handleErrorOutput, thinkingHeader } from "./ui.js";
import { optionalTextToSpeechParameters } from "./config.js";
import { root } from "./domElements.js";

const abortControllers = new Map();

const model = "gpt-4o-mini-tts";

const voiceOut = async (aiOutput, abortController, handleStop) => {
  try {
    const { endpoint } = getTargetEntpointForModel(model);
    const endpointUri = `${window.location.origin}/api/${endpoint}/speech`;
    const input = aiOutput.innerText;
    const body = JSON.stringify({
      input,
      model,
      ...optionalTextToSpeechParameters
    });  
    const options = { 
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body
    };  
    let isError = false;
    const data = await fetch(endpointUri, options).then(r => {
      isError = !r.ok;
      return r.text();
    }).then(text => {
      if (isError) throw new Error(text);
      return text;
    });
    const src = data.replace(/^[.\s\S]+<!--/,"").replace(/-->[.\s\S]+$/, "");
    if (src.startsWith("data: [ERROR]")) {
      throw new Error("Speech generation failed");
    }
    const audioStreamingManager = new AudioStreamingManager(abortController, handleStop);
    await audioStreamingManager.initialize()
    const encoded = audioStreamingManager.base64ToFloat32Array(src);
    await audioStreamingManager.addBuffer(encoded);
  } catch(e) {
    console.error(e);
    handleStop();
    const trailingHtml = document.createElement("div");
    trailingHtml.className = "error";
    trailingHtml.innerHTML = `${e.message}`;
    handleErrorOutput(root, thinkingHeader, trailingHtml.outerHTML, aiOutput);
  }
};

// voiceOutIconElement is an svg icon added in ui.js:getFormattedOutput
export const handleVoiceOut = async (voiceOutIconElement) => {
  const targetElement = voiceOutIconElement;
  const aiOutput = targetElement?.closest(".response")?.querySelector(".ai-output");
  if (!aiOutput) return;
  
  let abortController = abortControllers.get(targetElement);
  if (abortController) {
    abortController.abort();
    abortControllers.delete(targetElement);
    return;
  }
  abortController = new AbortController();
  abortControllers.set(targetElement, abortController);
  const handleStop = () => {
    targetElement.classList.remove("icon-progress");
    abortControllers.delete(targetElement);
  }
  targetElement.classList.add("icon-progress");
  await voiceOut(aiOutput, abortController, handleStop);
};

export const stopAllVoiceOuts = () => {
  abortControllers.values().forEach((v) => v.abort());
  abortControllers.clear();
}
