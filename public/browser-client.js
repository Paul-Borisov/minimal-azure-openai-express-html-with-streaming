(async () => {
  const model = "gpt-4o-mini";
  //const model = "o1-mini";

  const messages = [
    {
      role: "user",
      content: "Generate the text of 5000 characters on the ancient Rome history",
    },
  ];

  try {
    const engine = model.startsWith("o1-") ? "openai" : "azureopenai";
    const endpointUri = `${window.location.origin}/api/${engine}/chat`;

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

      const lines = chunkValue
        .split("\r");

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
