const isIterable = (obj) => typeof obj?.iterator === "function";

const isStreamUnsupported = (error) =>
  error?.code === "unsupported_value" && error?.param === "stream";
const isFirstResponse = (messages) => {
  let systemMessageCount = 0;
  for (const entry of messages) {
    if (entry?.role !== "user") systemMessageCount++;
    if (systemMessageCount > 0) return false;
  }
  return true;
};

const thinkingHeader = `<span class="gradient-text">Thinking...</span>`;

async function generateCompletionsStream(
  req,
  res,
  openaiClient,
  systemInstructions, // = "You are a helpful assistant."
  streaming
) {
  const messages = req.body.messages;
  const model = req.body.model;

  if (!messages) {
    res.status(400).json({ error: "No messages provided" });
    return;
  }

  res.setHeader("Content-Type", streaming ? "text/event-stream": "application/json");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const system = {
    role: model.startsWith("o1") ? "assistant" : "system",
    content: systemInstructions,
  };

  const onEnd = () => {
    res.write("data: [DONE]");
    res.end();
  };

  const onError = (error) => {
    console.error("Error:", error);
    res.write("data: [ERROR]\r");
    res.write(`data:  ${error.message || ""}`);
    res.end();
  };

  const fallback = () => {
    fallBackGenerateCompletionsWithNoStreaming({
      res,
      openaiClient,
      onEnd,
      onError,
      model,
      system,
      messages,
    });    
  };
  res.write(`data: ${thinkingHeader}\r`);
  if(!streaming) {
    fallback();
    return;
  }

  try {
    const completion = await openaiClient.chat.completions.create({
      model,
      messages: [system, ...messages],
      stream: true,
    });
    //throw {code: "unsupported_value", param: "stream"}; // Uncomment this line to test the error condition on the unsupported streaming output.
    if (isIterable(completion)) {
      for await (const part of completion) {
        const content = part.choices[0]?.delta?.content || "";
        if (content) {
          res.write(`data: ${content}\r`);
        }
      }
    } else {
      res.write(`data: ${completion.choices[0].message.content}\r`);
    }
    onEnd();
  } catch (error) {
    if (isStreamUnsupported(error)) {
      if (isFirstResponse(messages)) {
        res.write(
          `data: <b>The model ${model} does not support streaming response yet. ${thinkingHeader}</b><br/><br/>\r`
        );
      }
      fallback();
    } else {
      onError(error);
    }
  }
}

async function fallBackGenerateCompletionsWithNoStreaming({
  res,
  openaiClient,
  onEnd,
  onError,
  model,
  system,
  messages,
}) {
  try {
    const completion = await openaiClient.chat.completions.create({
      model,
      messages: [system, ...messages],
      stream: false,
    });
    res.write(`data: ${completion.choices[0].message.content}\r`);
    onEnd();
  } catch (error) {
    onError(error);
  }
}

module.exports = {
  generateCompletionsStream,
};
