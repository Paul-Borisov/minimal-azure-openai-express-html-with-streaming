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
import cors from "cors";
import express from "express";
import { createAzureOpenAI, isAzureOpenAiSupported, isAzureOpenAiInstanceSupported } from "./openai/azureOpenAI.js";
import { generateAudioOutput } from "./openai/textToSpeech.js";
import { generateCompletionsStream } from "./openai/completions.js";
import { generateEmbedding } from "./openai/embeddings.js";
import { generateImage } from "./openai/images.js";
import { generateResponsesStream } from "./openai/responses.js";
import { generateVideoOutput, getGeneratedVideo } from "./openai/video.js";
import { generateVideoVeo3, getGeneratedVideoVeo3 } from "./google/videoVeo3.js";
import { OpenAI } from "openai";
import path from "path";
import os from "os";
import dotenv from "dotenv";
import { thinkingHeader, validateSupportedAssets } from "./openai/shared.js";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

dotenv.config();

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
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (_, res) => {
  res.setHeader("Content-Type", "text/html");
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/api/progresstext", (_, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(thinkingHeader);
});

// Endpoints for regular OpenAI
const openaiHandler = (generator, ...args) => {
  return async (req, res) => {
    try {
      await validateSupportedAssets(req.body.model, "openai");
      await generator(req, res, openai, ...args);
    } catch (e) {
      res.status(500).send({ message: e.message });
    }
  };
}

app.post(
  "/api/openai/chat",
  openaiHandler(generateCompletionsStream, systemInstructions, streaming)
);

app.post(
  "/api/openai/responses",
  openaiHandler(generateResponsesStream, systemInstructions, streaming)
);

app.post(
  "/api/openai/embeddings",
  openaiHandler(generateEmbedding)
);

app.post(
  "/api/openai/images",
  openaiHandler(generateImage)
);

app.post(
  "/api/openai/speech",
  openaiHandler(generateAudioOutput)
);

app.get("/api/openai/session", async (req, res) => {
  const model = req.query.model || "gpt-4o-mini-realtime-preview";
  try {
    await validateSupportedAssets(model, "openai");
    const r = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        modalities: ["audio", "text"],
        voice: "verse",
        input_audio_transcription: {
          model: "whisper-1",
        },
        // input_audio_noise_reduction: null // default, noise reduction disabled; this mode is the most sensitive to any sound input
        input_audio_noise_reduction: {
          //type: "near_field" // near_field is for close-talking microphones such as headphones
          type: "far_field"    // far_field is for far-field microphones such as laptop or conference room microphones
        }  
      }),
    });
    const data = await r.json();
    res.send(data);
  } catch (e) {
    res.status(500).send({ message: e.message });
  }
});

// Endpoints for Azure OpenAI
if (isAzureOpenAiSupported) {
  const azureOpenaiHandler = (generator, ...args) => {
    return async (req, res) => {
      try {
        const azOpenai = await createAzureOpenAI(req);
        await generator(req, res, azOpenai, ...args);
      } catch (e) {
        res.status(500).send({ message: e.message });
      }
    };
  };

  app.post(
    "/api/azureopenai/chat",
    azureOpenaiHandler(generateCompletionsStream, systemInstructions, streaming)
  );
  
  app.post(
    "/api/azureopenai/responses",
    azureOpenaiHandler(generateResponsesStream, systemInstructions, streaming)
  );
  
  app.post(
    "/api/azureopenai/embeddings",
    azureOpenaiHandler(generateEmbedding)
  );

  app.post(
    "/api/azureopenai/images",
    azureOpenaiHandler(generateImage)
  );

  app.post(
    "/api/azureopenai/speech",
    azureOpenaiHandler(generateAudioOutput)
  );
}

const azureOpenAiInstanceSuffixSora = "_SORA";
if (isAzureOpenAiInstanceSupported(azureOpenAiInstanceSuffixSora)) {
  const azureOpenaiHandler = (generator, ...args) => {
    return async (req, res) => {
      try {
        await generator(req, res, azureOpenAiInstanceSuffixSora, ...args);
      } catch (e) {
        res.status(500).send({ message: e.message });
      }
    };
  };
  app.post(
    "/api/azureopenai/video",
    azureOpenaiHandler(generateVideoOutput)
  );
  app.get(
    "/api/azureopenai/video/:jobId",
    azureOpenaiHandler(getGeneratedVideo)
  );
}

// Endpoint for DeepSeek (if configured)
if (deepSeek) {
  app.post("/api/deepseek/chat", async (req, res) => {
    try {
      await validateSupportedAssets(req.body.model, "deepseek");
      await generateCompletionsStream(req, res, deepSeek, systemInstructions, streaming);
    } catch (e) {
      res.status(500).send({ message: e.message });
    }    
  });
}

const isGoogleAiSupported = !!process.env["GEMINI_API_KEY"];
if (isGoogleAiSupported) {
  app.post("/api/google/video", async (req, res) => {
    try {
      await generateVideoVeo3(req, res);
    } catch (e) {
      res.statusMessage = e.message;
      res.status(500).send({ message: res.statusMessage });
    }      
  });
  app.get("/api/google/video/:jobId", async (req, res) => {
    try {
      await getGeneratedVideoVeo3(req, res);
    } catch (e) {
      res.statusMessage = e.message;
      res.status(500).send({ message: res.statusMessage });
    }
  });
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
  const hostname = process.env["HOSTNAME"] || os.hostname;
  console.log(`Server is running on port ${port}: http://${hostname}:${port}`);
});