import { optionalImageParameters, modelsThatSupportResponses, targetEndpoints } from "./config.js";
import { formatDataImageSource, formatEmbeddings, getFormattedDataImage, getFormattedOutput } from "./ui.js";
import { resetScroll, scrollDown } from "./scrollManager.js";
import { setDefaultContent } from "./samples.js";

export async function processRequest(params) {
  const {
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
  } = params;
  
  resetScroll();
  let endpoint;
  const modelSupportsResponses = modelsThatSupportResponses.some(e => e === model.toLocaleLowerCase());
  for (const key of Object.keys(targetEndpoints)) {
    if (model.includes(key)) {
      endpoint = targetEndpoints[key];
      break;
    }
  }
  if (!endpoint) endpoint = targetEndpoints.default;

  const isAudio = isAudioModel(model);
  const isAudioSegment = (line) =>
    isAudio &&
    line &&
    (/^data: <!--/i.test(line) || !/^data: /i.test(line));
  const getAudioSegment = (line) =>
    isAudioSegment(line)
      ? line.replace(/^data: <!--/i, "").replace(/-->$/, "")
      : null;

  if (isAudio) {
    // Assume AudioStreamingManager is imported or globally available.
    params.audioStreamingManager = new AudioStreamingManager(abortController, handleStop);
    await params.audioStreamingManager.initialize();
  } else {
    params.audioStreamingManager = null;
  }

  let endpointUri;
  const isEmbedding = isEmbeddingModel(model);
  const isImage = isImageModel(model);
  if (isEmbedding) {
    endpointUri = `${window.location.origin}/api/${endpoint}/embeddings`;
  } else if (isImage) {
    endpointUri = `${window.location.origin}/api/${endpoint}/images`;
  } else if (modelSupportsResponses) {
    endpointUri = `${window.location.origin}/api/${endpoint}/responses`;
  } else {
    endpointUri = `${window.location.origin}/api/${endpoint}/chat`;
  }
  
  const userContent = content ? content : setDefaultContent(txtPrompt);
  const messages = [
    ...chatHistory,
    { role: "user", content: userContent }
  ];

  // Build the formatted chat history for display.
  const getFormattedChatHistory = () => chatHistory
    .map(entry => getFormattedOutput(entry.content, entry.role !== "user", openAiIcon))
    .join("\n");

  const formattedChatHistory = getFormattedChatHistory();
  const formattedUserRequest = getFormattedOutput(userContent, false, openAiIcon);

  try {
    if(isRealtimeModel(model)) {
      const updateRealtimeRootInnerHtml = (formattedChatHistory, formattedUserRequest, rawOutput) => {
        const formattedAiOutput = getFormattedOutput(rawOutput.join(""), true, openAiIcon);
        root.innerHTML = `${formattedChatHistory}\n${formattedUserRequest}\n${formattedAiOutput}`;
        scrollDown(root);
      };
      startRealtimeSession({
        model,
        prompt: userContent,
        chatHistory,
        thinkingHeader,
        getFormattedChatHistory,
        getFormattedOutput,
        updateRealtimeRootInnerHtml
      });
      return;
    }

    let res;
    if (isEmbedding) {
      let dimensions = null;
      if (/-3/i.test(model)) dimensions = 1536;
      if (/-3-large/i.test(model)) dimensions = 3072;
      res = await fetch(endpointUri, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: userContent, model, dimensions }),
        signal: abortController.signal,
      });
    } else if (isImage) {
      res = await fetch(endpointUri, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt: userContent, ...optionalImageParameters }),
        signal: abortController.signal,
      });
    } else {
      res = await fetch(endpointUri, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, model }),
        signal: abortController.signal,
      });
    }

    if (!res.ok) {
      if (!root.innerHTML.length) root.innerHTML += " ";
      const errorMessage = `${res.status}, ${res.statusText || "Network response was not ok"}`;
      throw new Error(errorMessage);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");

    let rawOutput = [];
    let formattedAiOutput = "";
    let done = false;

    const updateRootInnerHtml = () => {
      const outputContent = rawOutput.join("");
      if (isImage) {
        if (done) {
          const imgTag = getFormattedDataImage(
            formatDataImageSource(outputContent, optionalImageParameters.output_format)
          );
          root.innerHTML = `${formattedChatHistory}\n${formattedUserRequest}\n${imgTag}`;
          setTimeout(() => scrollDown(root), 1000);
        } else {
          if (outputContent.includes(thinkingHeader)) {
            formattedAiOutput = getFormattedOutput(outputContent, true, openAiIcon);
            root.innerHTML = `${formattedChatHistory}\n${formattedUserRequest}\n${formattedAiOutput}`;
            scrollDown(root);
          } else {
            // Ignore this intermediate output for the partial base64 image content
          }
        }
        return
      }
      
      formattedAiOutput = isEmbedding
      ? getFormattedOutput(formatEmbeddings(outputContent), true, openAiIcon)
      : getFormattedOutput(outputContent, true, openAiIcon);
      
      root.innerHTML = `${formattedChatHistory}\n${formattedUserRequest}\n${formattedAiOutput}`;
      scrollDown(root);
    };

    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      const chunkValue = decoder.decode(value);
      const lines = chunkValue.split("\r");
      let residue = "";
      for (const line of lines) {
        if (isAudioSegment(line)) {
          const audioSegment = getAudioSegment(line);
          if (audioSegment) {
            window.audio = window.audio || [];
            window.audio.push(audioSegment);
            try {
              const encoded = params.audioStreamingManager.base64ToFloat32Array(residue + audioSegment);
              residue = "";
              await params.audioStreamingManager.addBuffer(encoded);
            } catch (e) {
              residue += audioSegment;
            }
          }
          continue;
        }
        const msg = line.replace("data: ", "");
        if (rawOutput.length === 2 && rawOutput[0] === thinkingHeader) {
          rawOutput.length = 0;
        }
        if (msg === "[DONE]") {
          done = true;
          if (!params.audioStreamingManager?.isProcessing) handleStop();
          rawOutput.forEach((entry, index) => {
            if (entry.includes(thinkingHeader)) {
              rawOutput[index] = entry.replace(thinkingHeader, "");
            }
          });
          chatHistory.push({ role: "user", content: userContent });
          let aiContent
          if (isEmbedding) {
            auContent = formatEmbeddings(rawOutput.join(""));
          } else if (isImage) {
            aiContent = formatDataImageSource(rawOutput.join(""), optionalImageParameters.output_format);
          } else {
            aiContent = rawOutput.join("");
          }
          chatHistory.push({
            role: "assistant",
            content: aiContent
          });
          updateRootInnerHtml();
          break;
        } else if (msg === "[ERROR]") {
          done = true;
          handleStop();
        }
        rawOutput.push(msg);
        updateRootInnerHtml();
      }
    }
  } catch (error) {
    console.error("Error:", error);
    if (root.innerHTML.length > 0 && root.innerHTML !== "[ERROR]") {
      if (error.toString().startsWith("AbortError")) {
        handleErrorOutput(root, thinkingHeader, "<b>Cancelled!</b>");
      } else {
        handleErrorOutput(root, thinkingHeader, `<span class="error"> ERROR: ${error.message ?? error}</span>`);
      }
    }
    handleStop();
    scrollDown(root);
  }
}
