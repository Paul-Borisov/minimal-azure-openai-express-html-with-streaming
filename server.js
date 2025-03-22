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
const { AzureOpenAI, OpenAI } = require("openai");
const { generateCompletionsStream } = require("./openai/completions");
const { generateResponsesStream } = require("./openai/responses");
const { generateEmbedding } = require("./openai/embeddings");
const path = require("path");
const os = require("os");
require("dotenv").config();

const systemInstructions = process.env["SYSTEM_INSTRUCTIONS"];

// Parameters for Azure OpenAI
const endpoint = process.env["AZURE_OPENAI_ENDPOINT"];
const apiVersion = process.env["AZURE_OPENAI_API_VERSION"];
const defaultDeployment = process.env["AZURE_OPENAI_API_DEPLOYMENT"];
const streaming = !/true|1|yes/i.test(process.env["NO_STREAMING"]);

// Determine authentication mode for Azure OpenAI:
// - Use AZURE_AUTH_MODE env variable if provided.
// - Otherwise, default to "key" if AZURE_OPENAI_API_KEY is set, else "keyless".
const azureAuthMode =
  process.env["AZURE_AUTH_MODE"] ||
  (process.env["AZURE_OPENAI_API_KEY"] ? "key" : "keyless");

if (azureAuthMode === "key" && !process.env["AZURE_OPENAI_API_KEY"]) {
  throw new Error("AZURE_OPENAI_API_KEY must be present for key authentication");
} else if (azureAuthMode === "keyless" && process.env["AZURE_OPENAI_API_KEY"]) {
  throw new Error("AZURE_OPENAI_API_KEY must be commented out for keyless authentication");
}

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

// Unified helper function for creating AzureOpenAI instance
const createAzureOpenAI = (req) => {
  if (azureAuthMode === "key") {
    return new AzureOpenAI({
      endpoint,
      azureApiKey: process.env["AZURE_OPENAI_API_KEY"],
      apiVersion,
      deployment: req.body.model ?? defaultDeployment,
    });
  } else {
    // Keyless authentication using Entra ID.
    const { DefaultAzureCredential, getBearerTokenProvider } = require("@azure/identity");
    const credential = new DefaultAzureCredential();
    const scope = "https://cognitiveservices.azure.com/.default";
    const azureADTokenProvider = getBearerTokenProvider(credential, scope);
    return new AzureOpenAI({
      apiVersion,
      endpoint,
      deployment: req.body.model ?? defaultDeployment,
      azureADTokenProvider,
    });
  }
};

// Endpoints for Azure OpenAI
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