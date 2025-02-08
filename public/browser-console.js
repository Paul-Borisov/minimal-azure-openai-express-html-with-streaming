(async () => {
  const model = "gpt-4o-mini"; // Use this model in the console logic

  /* 
  By default, all models are handled by regular OpenAI.
  You can configure models to be handled by Azure OpenAI and/or regular OpenAI.
  - Uncomment corresponding lines below.
  */
  const targetEndpoints = {
    //"4o": "azureopenai",
    //"o1": "openai",
    default: "openai",
  };

  const messages = [
    {
      role: "user",
      content: "Generate the text of 5000 characters on the ancient Rome history",
    },
  ];

  try {
    let endpoint;
    for (const key of Object.keys(targetEndpoints)) {
      if (model.includes(key)) {
        endpoint = targetEndpoints[key];
        break;
      }
    }
    if (!endpoint) endpoint = targetEndpoints["default"];
    const endpointUri = `${window.location.origin}/api/${endpoint}/chat`;

    const res = await fetch(endpointUri, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages, model }),
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

      const lines = chunkValue.split("\r");

      for (const line of lines) {
        //if (line.includes("Roman")) throw "Custom error";
        const msg = line.replace("data: ", "");
        if (msg === "[DONE]") {
          done = true;
          break;
        }
        output += msg;
        console.clear();
        console.log(output);
      }
    }
  } catch (error) {
    console.error("Error:", error);
  }
})();
