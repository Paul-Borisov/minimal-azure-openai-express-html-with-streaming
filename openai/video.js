import dotenv from "dotenv";
import { ensureAccessMeans } from "./azureOpenAI.js"
import { onError, thinkingHeader } from "./shared.js";

dotenv.config();

export async function generateVideoOutput(
  req,
  res,
  instanceSuffix
) {
  const prompt = req.body.prompt;
  const model = req.body.model || "sora";
  const height = req.body.height || 480;
  const width = req.body.width || 480;
  const n_seconds = req.body.n_seconds || 5;
  const n_variants = req.body.n_variants || 1;

  if (!prompt) {
    res.status(400).json({ error: "No text input provided" });
    return;
  }
  
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const { currentEndpoint: endpoint, envVarApiKey, azureAuthMode } = ensureAccessMeans(instanceSuffix);
  if( azureAuthMode !== "key" ) {
    onError(new Error(`Unsupported auth mode: ${azureAuthMode}`), res);
    return    
  }

  const apiKey = process.env[envVarApiKey];
  const apiVersion = "preview";

  res.write(`data: ${thinkingHeader}\r`);

  // Step 1. Start a video-generation job
  const endpointUri = `${endpoint}/openai/v1/video/generations/jobs?api-version=${apiVersion}`;
  const response = await fetch(endpointUri, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt,
      width,
      height,
      n_seconds,
      n_variants
    }),
  });

  if (!response.ok) {
    onError(
      new Error(`Create job failed: ${response.status} ${response.statusText}`),
      res
    );
    return;
  }
  const data = await response.json();
  
  const jobId = data.id;
  res.write(`jobId: ${jobId}\r`);
  res.end();
}

export async function getGeneratedVideo(
  req,
  res,
  instanceSuffix
) {
  const jobId = req.params.jobId;

  res.setHeader("Content-Type", "text/plain");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  if (!jobId) {
    res.statusMessage = "Invalid request parameters, .../:jobId expected";
    res.status(400).write(res.statusMessage);
    return;
  }

  const { currentEndpoint: endpoint, envVarApiKey, azureAuthMode } = ensureAccessMeans(instanceSuffix);
  if( azureAuthMode !== "key" ) {
    res.statusMessage = `Unsupported auth mode: ${azureAuthMode}`;
    res.status(500).write(res.statusMessage);
    return;
  }

  const apiKey = process.env[envVarApiKey];
  const apiVersion = "preview";

  const endpointUriJobStatus = `${endpoint}/openai/v1/video/generations/jobs/${jobId}?api-version=${apiVersion}`;
  const responseJobStatus = await fetch(endpointUriJobStatus, { headers: { "api-key": apiKey } });
  if (!responseJobStatus.ok) {
    res.statusMessage = `Status poll failed: ${responseJobStatus.status} ${responseJobStatus.statusText}`;
    res.status(500).write(res.statusMessage);
    return;
  }
  const jobStatusData = await responseJobStatus.json();
  const jobStatus = jobStatusData.status;
  console.log(`Job status for video generation ${jobId}: ${jobStatus}`);

  if (jobStatus === "succeeded") {
    const generations = jobStatusData.generations ?? [];
    if (!generations.length) {
      res.statusMessage = "No video generations found in job results.";
      res.status(500).write(res.statusMessage);      
      return;
    }

    const generationId = generations[0].id;
    const videoUrl = `${endpoint}/openai/v1/video/generations/${generationId}/content/video?api-version=${apiVersion}`;
    console.log(`Downloading video from the URL: ${videoUrl}`);
    const responseVideo = await fetch(videoUrl, { headers: { "api-key": apiKey } });

    if (!responseVideo.ok) {
      res.statusMessage = `Video download failed: ${responseVideo.status} ${responseVideo.statusText}`;
      res.status(500).write(res.statusMessage);
      return;
    }

    console.log("Sending downloaded video to client");
    const arrayBuffer = await responseVideo.arrayBuffer();
    const videoBuffer = Buffer.from(arrayBuffer);
    const base64Video = videoBuffer.toString("base64");
    res.write(base64Video);
    console.log("Video sent to client");
  }
  res.end();
}