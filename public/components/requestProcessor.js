import { 
  dataVideoSourcePrefix,
  formatDataImageSource,
  formatDataVideoSource,
  formatEmbeddings,
  getFormattedDataImage,
  getFormattedDataVideo,
  getFormattedOutput
} from "./ui.js";
import { getTargetEntpointForModel } from "./utils.js";
import { optionalImageParameters, optionalVideoParameters } from "./config.js";
import { resetScroll, scrollDown } from "./scrollManager.js";
import { setDefaultContent } from "./samples.js";

export async function processRequest(params) {
  const {
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
  } = params;
  
  resetScroll();

  const { endpoint, modelSupportsResponses } = getTargetEntpointForModel(model);

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
  const isVideo = isVideoModel(model);
  if (isEmbedding) {
    endpointUri = `${window.location.origin}/api/${endpoint}/embeddings`;
  } else if (isImage) {
    endpointUri = `${window.location.origin}/api/${endpoint}/images`;
  } else if (isVideo) {
    endpointUri = `${window.location.origin}/api/${endpoint}/video`;  
  } else if (modelSupportsResponses) {
    endpointUri = `${window.location.origin}/api/${endpoint}/responses`;
  } else {
    endpointUri = `${window.location.origin}/api/${endpoint}/chat`;
  }

  const userContent = content ? content : setDefaultContent(txtPrompt);
  const sanitizedChatHistory = chatHistory.map((entry) => {
    if (entry.content.startsWith(dataVideoSourcePrefix)) {
      return { role: entry.role, content: "removed video" };
    }
    return entry;
  });
  const messages = [
    ...sanitizedChatHistory,
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
    } else if (isVideo) {
      const additionalParams = {
        ...optionalVideoParameters,
        ...(defaultParams ? JSON.parse(defaultParams) : {})
      };
      res = await fetch(endpointUri, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({model, prompt: userContent, ...additionalParams}),
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
    let isError = false;

    const updateRootInnerHtml = () => {
      const outputContent = rawOutput.join("");
      const formatImageOutput = () => {
        const imgTag = getFormattedDataImage(
          formatDataImageSource(outputContent, model.includes("dall-e") ? "png" : optionalImageParameters.output_format)
        );
        root.innerHTML = `${formattedChatHistory}\n${formattedUserRequest}\n${imgTag}`;
        setTimeout(() => scrollDown(root), 1000);
      };
      const formatTextOutput = () => {
        formattedAiOutput = getFormattedOutput(outputContent, true, openAiIcon);
        root.innerHTML = `${formattedChatHistory}\n${formattedUserRequest}\n${formattedAiOutput}`;
        scrollDown(root);
      };
      const formatVideoOutput = () => {
        const videoTag = getFormattedDataVideo(
          formatDataVideoSource(outputContent, "mp4")
        );
        root.innerHTML = `${formattedChatHistory}\n${formattedUserRequest}\n${videoTag}`;
        setTimeout(() => scrollDown(root), 1000);
      };      
      if (isImage) {
        if (done) {
          if (isError) {
            formatTextOutput();
          } else {
            formatImageOutput();
          }
        } else {
          if (outputContent.includes(thinkingHeader)) {
            formatTextOutput();
          } else {
            // Ignore this intermediate output for the partial base64 image content
          }
        }
        return;
      }
      
      if (isVideo) {
        if (done) {
          if (isError) {
            formatTextOutput();
          } else {
            formatVideoOutput();
          }
        } else {
          if (outputContent.includes(thinkingHeader)) {
            formatTextOutput();
          } else {
            // Ignore this intermediate output for the partial base64 image content
          }
        }
        return;
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
          isError = false;
          if (!params.audioStreamingManager?.isProcessing) handleStop();
          rawOutput.forEach((entry, index) => {
            if (entry.includes(thinkingHeader)) {
              rawOutput[index] = entry.replace(thinkingHeader, "");
            }
          });
          chatHistory.push({ role: "user", content: userContent });
          let aiContent
          if (isEmbedding) {
            aiContent = formatEmbeddings(rawOutput.join(""));
          } else if (isImage) {
            aiContent = formatDataImageSource(rawOutput.join(""), optionalImageParameters.output_format);
          } else if (isVideo) {
            aiContent = formatDataVideoSource(rawOutput.join(""), "mp4");
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
          isError = true;
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
