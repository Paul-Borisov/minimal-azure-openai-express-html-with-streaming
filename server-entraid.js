// This is a modern version of the minimal Express.js server for Azure OpenAI and OpenAI endpoints.
// It uses keyless Entra ID authentication for Azure OpenAI, replacing the less secure apiKey method.
// For regular OpenAI, it uses a classic apiKey retrieved from the server-side .env variable OPENAI_API_KEY=... for authentication.
// - Comment out or remove the line AZURE_OPENAI_API_KEY=... in the .env file to avoid conflicts.
// https://learn.microsoft.com/en-us/azure/ai-services/openai/chatgpt-quickstart?tabs=command-line%2Cjavascript-key%2Ctypescript-keyless%2Cpython-new&pivots=programming-language-javascript
// https://techcommunity.microsoft.com/blog/azuredevcommunityblog/using-keyless-authentication-with-azure-openai/4111521
const express = require("express");
const cors = require("cors");
const { AzureOpenAI, OpenAI } = require("openai");
const { generateCompletionsStream } = require("./stream-completions");
const {
  DefaultAzureCredential,
  getBearerTokenProvider,
} = require("@azure/identity");
const path = require("path");
const os = require("os");
require("dotenv").config();

const systemInstructions = process.env["SYSTEM_INSTRUCTIONS"]; //|| "You are a helpful assistant.";

// Parameters for Azure OpenAI
const endpoint = process.env["AZURE_OPENAI_ENDPOINT"];
const azureApiKey = process.env["AZURE_OPENAI_API_KEY"];
const apiVersion = process.env["AZURE_OPENAI_API_VERSION"];
const defaultDeployment = process.env["AZURE_OPENAI_API_DEPLOYMENT"];
const streaming = !/true|1|yes/i.test(process.env["NO_STREAMING"]);

if (azureApiKey) {
  throw new Error("AZURE_OPENAI_API_KEY must be commented out in .env");
}

// Parameters for regular OpenAI
// https://github.com/openai/openai-node
const apiKey = process.env["OPENAI_API_KEY"];
const openai = new OpenAI({ apiKey });

const deepSeekApiKey = process.env["DEEPSEEK_API_KEY"];
const deepSeek = deepSeekApiKey ? new OpenAI({baseURL: 'https://api.deepseek.com', apiKey }) : undefined;

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

app.get("/", async (req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// The endpoint to get results from Azure OpenAI
app.post("/api/azureopenai/chat", async (req, res) => {
  // In order to test keyless authentication for Azure OpenAI locally, do the following:
  // 1. Open the Azure OpenAI resource (instance), select "Access Control (IAM)", add the role "Cognitive Services OpenAI User" to the test account
  // 2. Signin with az login using your test account
  // 3. Comment out the line AZURE_OPENAI_API_KEY=... in .env
  // 4. Start the server using the command node server-entraid.js. The keyless auth should work.
  const credential = new DefaultAzureCredential();
  const scope = "https://cognitiveservices.azure.com/.default";
  const azureADTokenProvider = getBearerTokenProvider(credential, scope);

  const azOpenai = new AzureOpenAI({
    apiVersion,
    endpoint,
    deployment: req.body.model ?? defaultDeployment,
    azureADTokenProvider,
  });

  generateCompletionsStream(req, res, azOpenai, systemInstructions, streaming);
});

// The endpoint to get results from regular OpenAI
app.post("/api/openai/chat", async (req, res) =>
  generateCompletionsStream(req, res, openai, systemInstructions, streaming)
);

if(deepSeek) {
  // The endpoint to get results from DeekSeek
  app.post("/api/deekseek/chat", async (req, res) =>
    generateCompletionsStream(req, res, deepSeek, systemInstructions, streaming)
  );
}

const port = process.env.PORT || 3000;

app.listen(port, () => {
  const hostname = process.env["HOSTNAME"] || os.hostname;
  console.log(`Server is running on port ${port}: http://${hostname}:${port}`);
});
