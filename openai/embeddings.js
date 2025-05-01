import { onEnd, onError, thinkingHeader } from "./shared.js";

export async function generateEmbedding(
  req,
  res,
  openaiClient
) {
  const input = req.body.input;
  const model = req.body.model;
  const dimensions = req.body.dimensions;

  if (!input) {
    res.status(400).json({ error: "No text input provided" });
    return;
  }

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  res.write(`data: ${thinkingHeader}\r`);
  try {
    const embeddings = await openaiClient.embeddings.create({
      model,
      input,
      dimensions,
      encoding_format: "float",
    });
    res.write(`data: ${JSON.stringify(embeddings.data[0].embedding)}\r`);
    onEnd(res);
  } catch (error) {
    onError(error, res);
  }
}
