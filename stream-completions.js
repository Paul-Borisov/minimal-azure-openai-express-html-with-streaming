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
    role: model.startsWith("o1-") ? "assistant" : "system",
    content: systemInstructions,
  };

  try {
    const completion = await openaiClient.chat.completions.create({
      model,
      messages: [system, ...messages],
      stream: true,
    });

    for await (const part of completion) {
      const content = part.choices[0]?.delta?.content || "";
      if (content) {
        res.write(`data: ${content}\n\n`);
      }
    }
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    console.error("Error:", error);
    res.write("data: [ERROR]\n\n");
    res.end();
  }
}

module.exports = {
  generateCompletionsStream,
};
