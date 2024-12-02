// This is a modern version of the minimal express.js server, which uses keyless Entra ID authentication instead of less secure apiKey.
// - You must comment out or remove the line AZURE_OPENAI_API_KEY=... in .env to avoid conflicts
// https://learn.microsoft.com/en-us/azure/ai-services/openai/chatgpt-quickstart?tabs=command-line%2Cjavascript-key%2Ctypescript-keyless%2Cpython-new&pivots=programming-language-javascript
// https://expressjs.com/en/starter/hello-world.html
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

const endpoint = process.env["AZURE_OPENAI_ENDPOINT"];
const apiVersion = process.env["AZURE_OPENAI_API_VERSION"];
const deployment = process.env["AZURE_OPENAI_API_DEPLOYMENT"];

//https://github.com/openai/openai-node
const apiKey = process.env["OPENAI_API_KEY"];
const openai = new OpenAI({ apiKey });

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

// In order to test keyless authentication locally, do the following:
// 1. Open the OpenAI resource, select "Access Control (IAM)", add the role "Cognitive Services OpenAI User" to the test account
// 2. Signin with az login and the test account
// 3. Comment out the line AZURE_OPENAI_API_KEY=... in .env
// 4. Start the server using the command node server-entraid.js, the keyless auth should work
const credential = new DefaultAzureCredential();
const scope = "https://cognitiveservices.azure.com/.default";
const azureADTokenProvider = getBearerTokenProvider(credential, scope);

const azOpenai = new AzureOpenAI({
  apiVersion,
  endpoint,
  deployment,
  azureADTokenProvider,
});

app.get("/", async (req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.post("/api/azureopenai/chat", async (req, res) =>
  generateCompletionsStream(req, res, azOpenai)
);

app.post("/api/openai/chat", async (req, res) =>
  generateCompletionsStream(req, res, openai)
);

const port = process.env.PORT || 3000;

app.listen(port, () => {
  const hostname = process.env["HOSTNAME"] || os.hostname;
  console.log(`Server is running on port ${port}: http://${hostname}:${port}`);
});
