import { promises as fs } from "fs";
import path from "path";
import { targetEndpoints } from "../public/components/config.js";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const isEndpointSupported = async (model, endpointType) => {
  if(targetEndpoints.default === endpointType) return true;
  for (const key of Object.keys(targetEndpoints)) {
    if (model.includes(key)) return true;
  }
  return false;
};

export const isFirstResponse = (messages) => {
  let systemMessageCount = 0;
  for (const entry of messages) {
    if (entry?.role !== "user") systemMessageCount++;
    if (systemMessageCount > 0) return false;
  }
  return true;
};

export const isIterable = (obj) => typeof obj?.iterator === "function";

const isModelSupported = async (model) => {
  const filePath = path.join(__dirname,"..", "public", "index.html");
  const content = await fs.readFile(filePath, {encoding: "utf-8"});
  const searchText = `value="${model?.toLocaleLowerCase()}"`;
  return content.includes(searchText);
};

export const validateSupportedAssets = async (model, endpointType) => {
  if (!await isModelSupported(model)) {
    throw new Error(`The model '${model}' is not supported`);
  }
  if (!await isEndpointSupported(model, endpointType)) {
    throw new Error(`The endpoint '${endpointType}' is not supported for the model '${model}'`);
  }
};

export const isText = (content) => typeof content === "string";

export const isStreamUnsupported = (error) =>
  error?.code === "unsupported_value" && error?.param === "stream";

export const onEnd = (res) => {
  res.write("data: [DONE]");
  res.end();
};

export const onError = (error, res) => {
  console.error("Error:", error);
  res.write("data: [ERROR]\r");
  res.write(`data:  ${error.message || ""}`);
  res.end();
};

export const thinkingHeader = `<span class="gradient-text">Thinking...</span>`;
