const { handleStream } = require("./streaming");
const { isText, onEnd, onError } = require("./shared");

async function generateResponsesStream(req, res, openaiClient, systemInstructions, streaming) {
  const messages = req.body.messages;
  const model = req.body.model;

  if (!messages) {
    res.status(400).json({ error: "No messages provided" });
    return;
  }

  // If the model name contains "computer", set truncation to auto.
  const isTruncationModel = /computer/i.test(model);
  const additionalProperties = isTruncationModel ? { truncation: "auto" } : {};

  const system = {
    role: model.startsWith("o1") ? "assistant" : "system",
    content: systemInstructions,
  };

  const input = [system, ...messages];

  const parseOutput = (part) => {
    if (part?.output_text) return part.output_text;
    return part?.delta || part?.message?.content;
  };

  // API call using streaming.
  const apiCall = async ({ input, additionalProperties, stream }) => {
    return await openaiClient.responses.create({
      model,
      input,
      store: false,
      stream,
      ...additionalProperties,
    });
  };

  // Fallback API call for non-streaming responses.
  const apiFallback = async ({ input, additionalProperties, res, parseOutput }) => {
    try {
      const response = await openaiClient.responses.create({
        model,
        input,
        store: false,
        stream: false,
        ...additionalProperties,
      });
      const content = parseOutput(response);
      if(isText(content)) res.write(`data: ${content}\r`);
      onEnd(res);
    } catch (error) {
      onError(error, res);
    }
  };

  await handleStream({
    req,
    res,
    apiCall,
    apiFallback,
    input,
    additionalProperties,
    streaming,
    parseOutput,
    messages,
    model
  });
}

module.exports = {
  generateResponsesStream,
};
