(async () => {
  const root = document.querySelector("#root");
  const txtPrompt = document.querySelector("#txtPrompt");
  const btnSend = document.querySelector("#btnSend");
  const btnAbort = document.querySelector("#btnAbort");
  const btnClear = document.querySelector("#btnClear");
  const btnCode = document.querySelector("#btnCode");
  const btnText = document.querySelector("#btnText");
  const btnReset = document.querySelector("#btnReset");
  const selectedModel = document.querySelector(".model");
  const openAiIcon = decodeURIComponent(document.querySelector("head #favicon").getAttribute("href").replace("data:image/svg+xml,",""));
  let model = selectedModel.selectedOptions[0].value;
  let abortController = new AbortController();
  let audioStreamingManager = null;

  const thinkingHeader = `<span class="gradient-text">Thinking...</span>`;
  
  // Last scroll position for the root element
  let lastScrollTop = 0;
  // If the user scrolled up, the auto-scrolldown should be disabled. 
  // If the use scrolled down and reached the bottom the auto-scrolldown should be enabled again.
  let freezeAutoScroll = false;
  root.addEventListener("scroll", () => {
    let currentScrollTop = root.scrollTop;
    if (currentScrollTop >= lastScrollTop) {
      // Scrolled down
      lastScrollTop = currentScrollTop;
      if(freezeAutoScroll) freezeAutoScroll = false;
    } else {
      // Scrolled up
      freezeAutoScroll = true;
    }
  });
  const scrollDown = () => {
    if(!freezeAutoScroll) root.scrollTo({ top: root.scrollHeight });
  };

  /* 
  By default, all models are handled by regular OpenAI.
  You can configure models to be handled by Azure OpenAI and/or regular OpenAI.
  - Uncomment corresponding lines below.
  */
  const targetEndpoints = {
    //"4o": "azureopenai",
    //"o1": "openai",
    //"o1-mini": "azureopenai",
    "o3-mini": "azureopenai",
    //"embedding": "azureopenai",
    //"gpt-4o-audio-preview": "azureopenai",
    "deepseek": "deepseek",
    "default": "openai",
  };

  const modelsThatSupportResponses = [ // As of March 22, 2025
    "computer-use-preview", // computer-use-preview only supported responses APi; it did not support chat API
    "gpt-4.5-preview",      // supports both, responses and chat API
    "gpt-4o",               // supports both, responses and chat API
    //"gpt-4o-mini",        // supports both, responses and chat API
    //"gpt-4-32k-0314",     // supports both, responses and chat API
    //"gpt-3.5-turbo",      // supports both, responses and chat API
    //"o1",                 // o1 was working much slower on responses API
    "o1-pro",               // o1-pro only supported responses APi; it did not support chat API
    "o3-mini",            // o3-mini was working much slower; o1-mini and o1-preview did not support responses API
  ];

  const samples = [
    {code: "Generate javascript regex to replace empty values with '-' in the 3rd field of comma separated rows"},
    {code: "Add handling of tab-separators to the code"},
    {code: "Generate bash script to reset user password in Azure using az cli"},
    {code: "Generate PowerShell script to connect to MongoDB"},

    {text: "Generate text of 5000 characters on the ancient Rome history"},
    {text: "Generate text of 500 characters on your choice"},
    {text: "Alice has 3 sisters and 5 brothers. How many sisters and brothers Alice's brother has?"},
    {text: "There are 3 killers in a room. A regular person enters the room and kills one of the killers. How many killers are in the room?"},
    {text: "Generate CSV-table for all weeks of 2025. Columns: WeekNumber, StartDate;, EndDate. Use semicolon as column delimiter and ISO-date format. Start day is Monday. End day is Friday. Wrap into ```"},

    {default: "Generate test response of 100 characters"},
  ];

  const chatHistory = [];

  const setInitialText = () => {
    txtPrompt.value = samples.find(s => !!s.text).text;
  };
  setInitialText();

  const setDefaultContent = () => {
    txtPrompt.value = samples.find(s => !!s.default).default;
    return txtPrompt.value;
  };

  const handleStart = () => {
    document.querySelectorAll(".text button").forEach(btn => btn.setAttribute("disabled", true));
    btnAbort.classList.remove("invisible");
    btnAbort.removeAttribute("disabled");
  };

  const handleStop = () => {
    document.querySelectorAll(".text button").forEach(btn => btn.removeAttribute("disabled"));
    btnAbort.classList.add("invisible");
    if(audioStreamingManager?.isProcessing) audioStreamingManager.stopPlayback();
  };

  const handleNextPrompt = (type) => { // type = "text", type = "code"
    const index = samples.findIndex(s => s[type] === txtPrompt.value);
    if(index === -1) {
      txtPrompt.value = samples.find(s => !!s[type])?.[type] || "";
      return;
    }
    let nextPromptValue;
    if(samples[index][type]) {
      nextPromptValue = samples.find((s,i) => i > index && !!s[type]);
    }
    txtPrompt.value = nextPromptValue ? nextPromptValue[type] : samples.find(s => !!s[type])?.[type] || "";
  };

  const handleClear = () => {
    txtPrompt.value = "";
  }

  const handleReset = () => {
    root.innerHTML = "";
    setInitialText();
    chatHistory.length = 0;
  }

  const isInProgress = () => btnSend.hasAttribute("disabled");
  
  btnSend.addEventListener("click", () => {
    handleStart();
    processRequest(txtPrompt.value, model);
    btnAbort.focus();
  });
  btnAbort.addEventListener("click", () => {
    if(!isInProgress()) return;
    abortController.abort();
    handleStop();
    abortController = new AbortController();
  });
  btnCode.addEventListener("click", () => handleNextPrompt("code"));
  btnText.addEventListener("click", () => handleNextPrompt("text"));
  btnClear.addEventListener("click", handleClear);
  btnReset.addEventListener("click", handleReset);
  selectedModel.addEventListener("change", () => {
    model = selectedModel.selectedOptions[0].value;
  });
  // If user pressed Enter but helds Shift, Alt, or Ctrl key, add the new line otherwise process the request
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
  
  const isAudioModel = (model) => /audio/i.test(model);
  const isEmbeddingModel = (model) => /embedding/i.test(model);
  const handleErrorOutput = (trailingHtml) => {
    if(root.innerHTML.includes(thinkingHeader)) {
      root.innerHTML = root.innerHTML.replace(thinkingHeader, trailingHtml);
    } else {
      const response = root.querySelector(".response:last-child div:last-child");
      if(response) {
        response.innerHTML += trailingHtml;
      } else {
        root.innerHTML += trailingHtml;
      }
    }
  }

  async function processRequest(content, model) {
    lastScrollTop = 0;
    freezeAutoScroll = false;
    let endpoint;
    let modelSupportsResponses = modelsThatSupportResponses.some(e => e === model.toLocaleLowerCase());
    for (const key of Object.keys(targetEndpoints)) {
      if (model.includes(key)) {
        endpoint = targetEndpoints[key];
        break;
      }
    }
    if (!endpoint) endpoint = targetEndpoints["default"];

    const isAudio = isAudioModel(model);
    const isAudioSegment = (line) => isAudio && line && (/^data: <!--/i.test(line) || !/^data: /i.test(line));
    const getAudioSegment = (line) => isAudioSegment(line) ? line.replace(/^data: <!--/i,"").replace(/-->$/,"") : null;
    if(isAudio) {
      audioStreamingManager = new AudioStreamingManager(abortController, handleStop);
      await audioStreamingManager.initialize();
    } else {
      audioStreamingManager = null;
    }

    let endpointUri;
    const isEmbedding = isEmbeddingModel(model);
    if(isEmbedding) {
      endpointUri = `${window.location.origin}/api/${endpoint}/embeddings`;
    } else if (modelSupportsResponses) {
      endpointUri = `${window.location.origin}/api/${endpoint}/responses`;
    } else {
      endpointUri = `${window.location.origin}/api/${endpoint}/chat`;
    }
    const userContent = content ? content : setDefaultContent();
    const messages = [
      ...chatHistory,
      {
        role: "user",
        content: userContent,
      },
    ];
  
    try {
      let res;
      if(isEmbedding) {
        let dimensions = null;
        if(/-3/i.test(model)) dimensions = 1536;
        if(/-3-large/i.test(model)) dimensions = 3072;
        res = await fetch(endpointUri, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ input: userContent, model, dimensions }),
          signal: abortController.signal,
        });
      } else {
        res = await fetch(endpointUri, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ messages, model }),
          signal: abortController.signal,
        });
      }

      if (!res.ok) {
        if(!root.innerHTML.length) root.innerHTML += " ";
        const errorMessage = `${res.status}, ${res.statusText ? res.statusText : "Network response was not ok"} `;
        throw new Error(errorMessage);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");

      let rawOutput = [];
      let formattedAiOutput = "";
      let done = false;

      const chatHistoryOutput = [];
      for (const chatEntry of chatHistory) {
        chatHistoryOutput.push(
          getFormattedOutput(chatEntry.content, chatEntry.role !== "user")
        );
      }
      const formattedChatHistory = chatHistoryOutput.join("\n");

      const formattedUserRequest = getFormattedOutput(userContent, false);
      const updateRootInnerHtml = () => {
        if(isEmbedding) {
          formattedAiOutput = getFormattedOutput(formatEmbeddings(rawOutput.join("")), true);
        } else {
          formattedAiOutput = getFormattedOutput(rawOutput.join(""), true);
        }
        root.innerHTML = `${formattedChatHistory}\n${formattedUserRequest}\n${formattedAiOutput}`;
        scrollDown();
      }
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const chunkValue = decoder.decode(value);

        const lines = chunkValue.split("\r");

        let residue = "";
        for (const line of lines) {
          //if (line.includes("Roman")) throw "Custom error";
          if(isAudioSegment(line)) {
            const audioSegment = getAudioSegment(line);
            if(audioSegment) {
              window.audio = window.audio || [];
              window.audio.push(audioSegment);
              try {
                const encoded = audioStreamingManager.base64ToFloat32Array(residue + audioSegment);
                residue = "";
                await audioStreamingManager.addBuffer(encoded);
              } catch(e) {
                if(residue) {
                  console.log(e.message, audioSegment.substring(audioSegment.length-10));
                }
                residue += audioSegment;
              }
            }
            continue;
          }         
          const msg = line.replace("data: ", "");
          if(rawOutput.length === 2 && rawOutput[0] === thinkingHeader) {
            // Removes the leading thinkingHeader when the streaming output or fallback has been started.
            rawOutput.length = 0;
          }
          if (msg === "[DONE]") {
            //throw new Error("Custom error!"); // Uncomment this line, click Clear followed by Send
            done = true;
            if(!audioStreamingManager?.isProcessing) handleStop();
            // Clean up thinkingHeaders from the content before saving to chatHistory
            // Removes the trailing thinkingHeader when the fallback has been completed.
            let thinkingHeaderRemoved = rawOutput.length === 0;
            rawOutput.forEach((entry,index) => {
              if(entry.includes(thinkingHeader)) {
                rawOutput[index] = entry.replace(thinkingHeader,"");
                thinkingHeaderRemoved = true;
              }
            });
            // Bug fix: history duplicates after the second output
            // chatHistory.push(...messages)
            chatHistory.push(messages[messages.length - 1]);
            if(isEmbedding) {
              chatHistory.push({
                role: "assistant",
                content: formatEmbeddings(rawOutput.join(""))
              });  
            } else {
              chatHistory.push({
                role: "assistant",
                content: rawOutput.join("")
              });  
            }                
            if(thinkingHeaderRemoved) updateRootInnerHtml();
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
          handleErrorOutput("<b>Cancelled!</b>")
        } else {
          handleErrorOutput(`<span class="error"> ERROR: ${error.message ?? error}</span>`)
        }
      }
      handleStop();
      scrollDown();
    }
  }

  function getFormattedOutput(rawOutput, isAi) {
    const formatted = isAi
      ? `<div class="response">
          <div class="icon-container">${openAiIcon}</div>
          <div>${marked.marked(rawOutput)}</div>
        </div>`
      : `<div class="request">
          <div></div>
          <div class="user-content">${marked.marked(rawOutput)}</div>
        </div>`;
    return formatted;
  }

  function formatEmbeddings(embeddings) {
    return "```embeddings\n" + embeddings + "\n```";
  }
})();
