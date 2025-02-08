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

async function generateCompletionsStream(
  req,
  res,
  openaiClient,
  systemInstructions // = "You are a helpful assistant."
) {
  const messages = req.body.messages;
  const model = req.body.model;

  if (!messages) {
    res.status(400).json({ error: "No messages provided" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
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
    res.write("data: [ERROR]");
    res.end();
  };

  try {
    const completion = await openaiClient.chat.completions.create({
      model,
      messages: [system, ...messages],
      stream: true,
    });
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
          `data: <b>The model ${model} does not support streaming response yet.</b><br/><br/>\r`
        );
      }
      fallBackGenerateCompletionsWithNoStreaming({
        res,
        openaiClient,
        onEnd,
        onError,
        model,
        system,
        messages,
      });
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
