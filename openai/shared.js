const fs = require("fs").promises;
const path = require("path");
const requireEsm = require("esm")(module);
const { targetEndpoints } = requireEsm("../public/components/config.js");

const isEndpointSupported = async (model, endpointType) => {
  if(targetEndpoints.default === endpointType) return true;
  for (const key of Object.keys(targetEndpoints)) {
    if (model.includes(key)) return true;
  }
  return false;
};

const isFirstResponse = (messages) => {
  let systemMessageCount = 0;
  for (const entry of messages) {
    if (entry?.role !== "user") systemMessageCount++;
    if (systemMessageCount > 0) return false;
  }
  return true;
};

const isIterable = (obj) => typeof obj?.iterator === "function";

const isModelSupported = async (model) => {
  const filePath = path.join(__dirname,"..", "public", "index.html");
  const content = await fs.readFile(filePath, {encoding: "utf-8"});
  const searchText = `value="${model?.toLocaleLowerCase()}"`;
  return content.includes(searchText);
};

const validateSupportedAssets = async (model, endpointType) => {
  if (!await isModelSupported(model)) {
    throw new Error(`The model '${model}' is not supported`);
  }
  if (!await isEndpointSupported(model, endpointType)) {
    throw new Error(`The endpoint '${endpointType}' is not supported for the model '${model}'`);
  }
};

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
  validateSupportedAssets
}