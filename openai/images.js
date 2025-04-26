const { onEnd, onError, thinkingHeader } = require("./shared");

async function generateImage(
  req,
  res,
  openaiClient
) {
  const model = req.body.model;
  const prompt = req.body.prompt;
  
  if (!model) {
    res.status(400).json({ error: "No model provided" });
    return;
  }

  if (!prompt) {
    res.status(400).json({ error: "No text prompt provided" });
    return;
  }

  let imageGenerationParameters = {
    model,
    n: req.body.n || 1
  };
  if (model.includes("image")) { // Like gpt-image-1
    const output_format = req.body.output_format || "webp";
    const output_compression = output_format === "png" ? null: req.body.output_compression || 50;
    imageGenerationParameters = {
      ...imageGenerationParameters,
      background: req.body.background || "transparent",
      moderation: req.body.moderation || "auto",
      output_compression,
      output_format,
      prompt: req.body.prompt,
      size: req.body.size || "auto",
      quality: req.body.quality || "auto"
    };
  } else if(model.includes("dall-e-3")) {
    imageGenerationParameters = {
      ...imageGenerationParameters,
      prompt: prompt.replace(/\.$/,"")
        + ". I NEED to test how the tool works with extremely simple prompts. DO NOT add any detail, just use it AS-IS",
      response_format: "b64_json",
      size: req.body.size || "1024x1024",
      quality: req.body.quality === "high" ? "hd" : "standard"
    };
  } else if(model.includes("dall-e-2")) {
    imageGenerationParameters = {
      ...imageGenerationParameters,
      prompt: req.body.prompt,
      response_format: "b64_json",
      size: req.body.size || "1024x1024",
    };
  } else {
    res.status(400).json({ error: `Unsupported model: ${model}` });
    return;    
  }

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  res.write(`data: ${thinkingHeader}\r`);
  try {
    // https://platform.openai.com/docs/guides/image-generation?image-generation-model=gpt-image-1
    const result = await openaiClient.images.generate(imageGenerationParameters);
  
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
