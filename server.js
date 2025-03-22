/**
* This is a minimal Express.js server for Azure OpenAI and OpenAI endpoints.
* Its logic for Regular OpenAI uses api key obtained from the server-side .env variable OPENAI_API_KEY=...
* The logic for Azure OpenAI can use either key or keyless Entra ID authentication.
* - Keyless authentication is more secure.
* - In order to use keyless authentication, comment out or remove the line AZURE_OPENAI_API_KEY=... in the .env file to avoid conflicts.
* https://learn.microsoft.com/en-us/azure/ai-services/openai/chatgpt-quickstart?tabs=command-line%2Cjavascript-key%2Ctypescript-keyless%2Cpython-new&pivots=programming-language-javascript
* https://techcommunity.microsoft.com/blog/azuredevcommunityblog/using-keyless-authentication-with-azure-openai/4111521
* In order to test keyless authentication for Azure OpenAI locally, do the following:
* 1. Open the Azure OpenAI resource (instance), select "Access Control (IAM)", add the role "Cognitive Services OpenAI User" to the test account.
* 2. Signin with az login using your test account: az login --scope https://cognitiveservices.azure.com/.default
* 3. Comment out the line AZURE_OPENAI_API_KEY=... in .env
* 4. Start the server using the command node server-entraid.js. The keyless auth should work.
*/
const express = require("express");
const cors = require("cors");
const { OpenAI } = require("openai");
const { generateCompletionsStream } = require("./openai/completions");
const { generateResponsesStream } = require("./openai/responses");
const { generateEmbedding } = require("./openai/embeddings");
const path = require("path");
const os = require("os");
require("dotenv").config();
const {isAzureOpenAiSupported, createAzureOpenAI} = require("./openai/azureOpenAI");

const systemInstructions = process.env["SYSTEM_INSTRUCTIONS"];
const streaming = !/true|1|yes/i.test(process.env["NO_STREAMING"]);

// Parameters for regular OpenAI, https://github.com/openai/openai-node
const apiKey = process.env["OPENAI_API_KEY"];
const openai = new OpenAI({ apiKey });

// Optional DeepSeek client
const deepSeekApiKey = process.env["DEEPSEEK_API_KEY"];
const deepSeek = deepSeekApiKey
  ? new OpenAI({ baseURL: "https://api.deepseek.com", apiKey: deepSeekApiKey })
  : undefined;

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (_, res) => {
  res.setHeader("Content-Type", "text/html");
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Endpoints for regular OpenAI
app.post("/api/openai/chat", async (req, res) =>
  await generateCompletionsStream(req, res, openai, systemInstructions, streaming)
);
app.post("/api/openai/responses", async (req, res) =>
  await generateResponsesStream(req, res, openai, systemInstructions, streaming)
);
app.post("/api/openai/embeddings", async (req, res) =>
  await generateEmbedding(req, res, openai)
);

// Endpoints for Azure OpenAI
if( isAzureOpenAiSupported ) {
  app.post("/api/azureopenai/chat", async (req, res) => {
    const azOpenai = createAzureOpenAI(req);
    await generateCompletionsStream(req, res, azOpenai, systemInstructions, streaming);
  });

  app.post("/api/azureopenai/responses", async (req, res) => {
    const azOpenai = createAzureOpenAI(req);
    await generateResponsesStream(req, res, azOpenai, systemInstructions, streaming);
  });

  app.post("/api/azureopenai/embeddings", async (req, res) => {
    const azOpenai = createAzureOpenAI(req);
    await generateEmbedding(req, res, azOpenai);
  });
}

// Endpoint for DeepSeek (if configured)
if (deepSeek) {
  app.post("/api/deepseek/chat", async (req, res) =>
    await generateCompletionsStream(req, res, deepSeek, systemInstructions, streaming)
  );
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
  const hostname = process.env["HOSTNAME"] || os.hostname;
  console.log(`Server is running on port ${port}: http://${hostname}:${port}`);
});