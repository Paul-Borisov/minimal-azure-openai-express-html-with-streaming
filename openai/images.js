const { onEnd, onError, thinkingHeader } = require("./shared");

async function generateImage(
  req,
  res,
  openaiClient
) {
  const background = req.body.background || "transparent";
  const output_format = req.body.output_format || "webp";
  const model = req.body.model;
  const moderation = req.body.moderation || "auto";
  const n = req.body.n || 1
  const output_compression = output_format === "png" ? null: req.body.output_compression || 50;
  const prompt = req.body.prompt;
  const size = req.body.size || "auto";
  const quality = req.body.quality || "auto";

  if (!model) {
    res.status(400).json({ error: "No model provided" });
    return;
  }

  if (!prompt) {
    res.status(400).json({ error: "No text prompt provided" });
    return;
  }

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  res.write(`data: ${thinkingHeader}\r`);
  try {
    // https://platform.openai.com/docs/guides/image-generation?image-generation-model=gpt-image-1
    const result = await openaiClient.images.generate({
      background,
      model,
      moderation,
      n,
      output_compression,
      prompt,
      output_format,
      size,
      quality
    });
  
    const image = result.data[0].b64_json;
    res.write(`data: ${image}\r`);
    onEnd(res);
  } catch (error) {
    onError(error, res);
  }
}

module.exports = {
  generateImage
};
