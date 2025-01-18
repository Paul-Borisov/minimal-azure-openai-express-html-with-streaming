(async () => {
  const root = document.querySelector("#root");
  const txtPrompt = document.querySelector("#txtPrompt");
  const btnSend = document.querySelector("#btnSend");
  const btnAbort = document.querySelector("#btnAbort");
  const selectedModel = document.querySelector(".model");
  let model = selectedModel.selectedOptions[0].value;
  let abortController = new AbortController();

  const handleStart = () => {
    root.innerHTML = "";
    //btnSend.classList.add("hidden");
    btnSend.setAttribute("disabled", true);
    btnAbort.classList.remove("hidden");
  };

  const handleStop = () => {
    //btnSend.classList.remove("hidden");
    btnSend.removeAttribute("disabled");
    btnAbort.classList.add("hidden");
  };

  btnSend.addEventListener("click", () => {
    handleStart();
    processRequest(txtPrompt.value, model);
  });
  btnAbort.addEventListener("click", () => {
    abortController.abort();
    handleStop();
    abortController = new AbortController();
  });
  selectedModel.addEventListener("change", () => {
    model = selectedModel.selectedOptions[0].value;
  });

  async function processRequest(content, model) {
    const engine = model.startsWith("o1-") ? "openai" : "azureopenai";
    const endpointUri = `${window.location.origin}/api/${engine}/chat`;

    const messages = [
      {
        role: "user",
        content: content ? content : "Generate test response of 100 characters",
      },
    ];

    try {
      const res = await fetch(endpointUri, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages, model }),
        signal: abortController.signal,
      });

      if (!res.ok) {
        throw new Error("Network response was not ok");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");

      let output = "";
      let done = false;

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const chunkValue = decoder.decode(value);

        const lines = chunkValue
          .split("\r");

        for (const line of lines) {
          //if (line.includes("Roman")) throw "Custom error";
          const msg = line.replace("data: ", "");
          if (msg === "[DONE]") {
            done = true;
            handleStop();
            // https://www.npmjs.com/package/@wcj/markdown-to-html
            if(output.includes('```') || output.includes('##')) {
              output = markdown.default(output);
              root.innerHTML = output;
            }
            break;
          }
          output += msg;
          root.innerHTML = output.replace(
            /\*\*([^\*]+)\*\*/g,
            `<b>${"$1"}</b>`
          );
        }
      }
    } catch (error) {
      console.error("Error:", error);
      if (root.innerHTML.length > 0 && root.innerHTML !== "[ERROR]") {
        if (error.toString().startsWith("AbortError")) {
          root.innerHTML += `<b> Cancelled!</b>`;
        } else {
          root.innerHTML += `<span class="error"> ERROR: ${error}</span>`;
        }
      }
      handleStop();
    }
  }
})();
