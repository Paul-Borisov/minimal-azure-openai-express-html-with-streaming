import { onEnd, onError } from "./shared.js";

const maxCharactersLimitForOlderTtsModels = 4096;

export async function generateAudioOutput(
  req,
  res,
  openaiClient
) {
  const input = req.body.input;
  const model = req.body.model || "gpt-4o-mini-tts";
  const voice = req.body.voice || "coral";
  const response_format = req.body.response_format || "pcm";
  const instructions = req.body.voice;

  if (!input) {
    res.status(400).json({ error: "No text input provided" });
    return;
  }
  
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const generate = async (input) => {
    const response = await openaiClient.audio.speech.create({
      model,
      voice,
      input,
      instructions,
      response_format,
    });
    const arrayBuffer = await response.arrayBuffer();
    const wavBuffer = Buffer.from(arrayBuffer);
    const base64Wav = wavBuffer.toString("base64");
    res.write(`data: <!--${base64Wav}-->`);
  };

  try {
    await generate(input);
    onEnd(res);
  } catch (error) {
    if (!error.message.includes(`${maxCharactersLimitForOlderTtsModels}`)) {
      onError(error, res);
      return
    }
    try {
      const limitedInput = input.substring(0, maxCharactersLimitForOlderTtsModels);
      await generate(limitedInput);
      onEnd(res);
    } catch (error) {
      onError(error, res);
    }
  }
}
