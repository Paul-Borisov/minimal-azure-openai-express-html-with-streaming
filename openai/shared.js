const isFirstResponse = (messages) => {
  let systemMessageCount = 0;
  for (const entry of messages) {
    if (entry?.role !== "user") systemMessageCount++;
    if (systemMessageCount > 0) return false;
  }
  return true;
};

const isIterable = (obj) => typeof obj?.iterator === "function";

const isText = (content) => typeof content === "string";

const isStreamUnsupported = (error) =>
  error?.code === "unsupported_value" && error?.param === "stream";

const onEnd = (res) => {
  res.write("data: [DONE]");
  res.end();
};

const onError = (error, res) => {
  console.error("Error:", error);
  res.write("data: [ERROR]\r");
  res.write(`data:  ${error.message || ""}`);
  res.end();
};

const thinkingHeader = `<span class="gradient-text">Thinking...</span>`;

module.exports = {
  isFirstResponse,
  isIterable,
  isText,
  isStreamUnsupported,
  onEnd,
  onError,
  thinkingHeader,
}