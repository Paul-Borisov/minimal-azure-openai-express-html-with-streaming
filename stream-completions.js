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

  const isAudio = /audio/i.test(model);
  const additionalProperties = isAudio ? {
    modalities: ["text", "audio"],
    audio: {
      // https://platform.openai.com/playground/chat?models=gpt-4o-audio-preview
      voice: "verse",
      format: "pcm16",
    }
  } : null;

  res.setHeader("Content-Type", streaming && !isAudio ? "text/event-stream": "application/json");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const system = {
    role: model.startsWith("o1") ? "assistant" : "system",
    content: systemInstructions,
  };

  const parseOutput = (part) => {
    if(!part?.choices?.length) return "";
    if(part.choices[0]?.delta) {
      if(part.choices[0]?.delta.audio) {
        return part.choices[0].delta.audio.transcript 
          || (part.choices[0].delta.audio.data ? `<!--${part.choices[0].delta.audio.data}-->` : "");
      } else {
        return part.choices[0]?.delta?.content || "";
      }
    }

    if(part.choices[0]?.message?.audio) {
      return `${part.choices[0].message.audio.transcript}\rdata: ${part.choices[0].message.audio.data ? `<!--${part.choices[0].message.audio.data}-->` : ""}`;
    } else {
      return part.choices[0].message.content || "";
    }
  }

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
      parseOutput,
      model,
      system,
      messages,
      additionalProperties
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
      ...additionalProperties
    });
    //throw {code: "unsupported_value", param: "stream"}; // Uncomment this line to test the error condition on the unsupported streaming output.
    if (isIterable(completion)) {
      for await (const part of completion) {
        const content = parseOutput(part);
        res.write(`data: ${content}\r`);
      }
    } else {
      const content = parseOutput(completion);
      res.write(`data: ${content}\r`);
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
  parseOutput,
  model,
  system,
  messages,
  additionalProperties
}) {
  try {
    const completion = await openaiClient.chat.completions.create({
      model,
      messages: [system, ...messages],
      stream: false,
      ...additionalProperties
    });
    const content = parseOutput(completion);
    res.write(`data: ${content}\r`);
    onEnd();
  } catch (error) {
    onError(error);
  }
}

module.exports = {
  generateCompletionsStream,
};
