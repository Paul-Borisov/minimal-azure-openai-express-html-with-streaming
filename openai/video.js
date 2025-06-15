import dotenv from "dotenv";
import { ensureAccessMeans } from "./azureOpenAI.js"
import { onEnd, onError, thinkingHeader } from "./shared.js";

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
  //console.log("Full response JSON:", data);
  const jobId = data.id;
  //console.log(`Job created: ${jobId}`);
  // 2. Poll until the job is complete
  const endpointUriJobStatus = `${endpoint}/openai/v1/video/generations/jobs/${jobId}?api-version=${apiVersion}`;
  let jobStatusData, jobStatus;
  do {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const responseJobStatus = await fetch(endpointUriJobStatus, { headers: { "api-key": apiKey } });
    if (!responseJobStatus.ok) {
      onError(
        new Error(`Status poll failed: ${responseJobStatus.status} ${responseJobStatus.statusText}`),
        res
      );
      return;
    }
    jobStatusData = await responseJobStatus.json();
    jobStatus = jobStatusData.status;
    console.log(`Job status: ${jobStatus}`);
  } while (!["succeeded", "failed", "cancelled"].includes(jobStatus));

  // Step 3. Download the generated video; if any.
  if (jobStatus === "succeeded") {
    const generations = jobStatusData.generations ?? [];
    if (!generations.length) {
      onError(
        new Error("No generations found in job result."),
        res
      );
      return;
    }

    const generationId = generations[0].id;
    const videoUrl = `${endpoint}/openai/v1/video/generations/${generationId}/content/video?api-version=${apiVersion}`;
    const responseVideo = await fetch(videoUrl, { headers: { "api-key": apiKey } });

    if (!responseVideo.ok) {
      onError(
        new Error(`Video download failed: ${responseVideo.status} ${responseVideo.statusText}`),
        res
      );
      return;
    }

    const arrayBuffer = await responseVideo.arrayBuffer();
    const videoBuffer = Buffer.from(arrayBuffer);
    const base64Video = videoBuffer.toString("base64");
    res.write(`data: ${base64Video}\r`);
    onEnd(res);
  } else {
    onError(
      new Error(`Video generation job failed. Status: ${jobStatus}`),
      res
    );
    return;
  }
}
