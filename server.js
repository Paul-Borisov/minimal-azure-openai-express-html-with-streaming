// This is a classic version of a minimal Express.js server for Azure OpenAI and OpenAI endpoints.
// It uses apiKeys retrieved from the server-side .env variables AZURE_OPENAI_API_KEY=... and OPENAI_API_KEY=...
// https://learn.microsoft.com/en-us/azure/ai-services/openai/chatgpt-quickstart?tabs=command-line%2Cjavascript-key%2Ctypescript-keyless%2Cpython-new&pivots=programming-language-javascript
const express = require("express");
const cors = require("cors");
const { AzureOpenAI, OpenAI } = require("openai");
const { generateCompletionsStream } = require("./stream-completions");
const path = require("path");
const os = require("os");
require("dotenv").config();

const systemInstructions = process.env["SYSTEM_INSTRUCTIONS"]; //|| "You are a helpful assistant.";

// Parameters for Azure OpenAI
const endpoint = process.env["AZURE_OPENAI_ENDPOINT"];
const azureApiKey = process.env["AZURE_OPENAI_API_KEY"];
const apiVersion = process.env["AZURE_OPENAI_API_VERSION"];
const deployment = process.env["AZURE_OPENAI_API_DEPLOYMENT"];

if (!azureApiKey) {
  throw new Error("AZURE_OPENAI_API_KEY must be present (uncommented) in .env");
}

// Parameters for regular OpenAI
// https://github.com/openai/openai-node
const apiKey = process.env["OPENAI_API_KEY"];
const openai = new OpenAI({ apiKey });

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

const azOpenai = new AzureOpenAI({
  endpoint,
  azureApiKey,
  apiVersion,
  deployment,
});

app.get("/", async (req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// The endpoint to get results from Azure OpenAI
app.post("/api/azureopenai/chat", async (req, res) =>
  generateCompletionsStream(req, res, azOpenai, systemInstructions)
);

// The endpoint to get results from regular OpenAI
app.post("/api/openai/chat", async (req, res) =>
  generateCompletionsStream(req, res, openai, systemInstructions)
);

const port = process.env.PORT || 3000;

app.listen(port, () => {
  const hostname = process.env["HOSTNAME"] || os.hostname;
  console.log(`Server is running on port ${port}: http://${hostname}:${port}`);
});
