import { handleStream } from "./streaming.js";
import { isText, onEnd, onError } from "./shared.js";

export async function generateCompletionsStream(req, res, openaiClient, systemInstructions, streaming) {
  const messages = req.body.messages;
  const model = req.body.model;

  if (!messages) {
    res.status(400).json({ error: "No messages provided" });
    return;
  }

  // If the model name contains "audio", add required properties.
  const isAudio = /audio/i.test(model);
  const additionalProperties = isAudio
    ? {
        modalities: ["text", "audio"],
        audio: {
          // https://platform.openai.com/playground/chat?models=gpt-4o-audio-preview
          voice: "verse",
          format: "pcm16",
        },
      }
    : {};

  const system = {
    role: model.startsWith("o1") ? "assistant" : "system",
    content: systemInstructions,
  };

  const input = [system, ...messages];

  const parseOutput = (part) => {
    if (!part?.choices?.length) return undefined;

    if (part.choices[0]?.delta) {
      if (part.choices[0]?.delta.audio) {
        return (
          part.choices[0].delta.audio.transcript ||
          (part.choices[0].delta.audio.data ? `<!--${part.choices[0].delta.audio.data}-->` : "")
        );
      } else {
        return part.choices[0]?.delta?.content;
      }
    }
    if (part.choices[0]?.message?.audio) {
      return `${part.choices[0].message.audio.transcript}\rdata: ${
        part.choices[0].message.audio.data ? `<!--${part.choices[0].message.audio.data}-->` : undefined
      }`;
    } else {
      return part.choices[0].message.content;
    }
  };

  // API call using streaming.
  const apiCall = async ({ input, additionalProperties, stream }) => {
    return await openaiClient.chat.completions.create({
      model,
      messages: input,
      store: false,
      stream,
      ...additionalProperties,
    });
  };

  // Fallback API call for non-streaming responses.
  const apiFallback = async ({ input, additionalProperties, res, parseOutput }) => {
    try {
      const completion = await openaiClient.chat.completions.create({
        model,
        messages: input,
        store: false,
        stream: false,
        ...additionalProperties,
      });
      const content = parseOutput(completion);
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
