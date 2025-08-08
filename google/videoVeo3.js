import dotenv from "dotenv";
import { GoogleGenAI } from '@google/genai';
import { thinkingHeader } from "../openai/shared.js";

dotenv.config();

// https://github.com/google-gemini/cookbook/blob/main/quickstarts/Get_started_Veo.ipynb
export async function generateVideoVeo3( req, res ) {
  const model = req.body.model; //|| "veo-3.0-fast-generate-preview";  // or "veo-3.0-generate-preview"
  const prompt = req.body.prompt;
  const aspectRatio = req.body.aspectRatio || "16:9";
  const durationSeconds = req.body.durationSeconds || 8;
  const personGeneration = req.body.personGeneration || "allow_all"; // or "dont_allow"

  if (!model) {
    res.statusMessage = "No model provided";
    res.status(400).json({ error: res.statusMessage });
    return;
  }
  if (!prompt) {
    res.statusMessage = "No text input provided";
    res.status(400).json({ error: res.statusMessage });
    return;
  }

  // Use this for testing.
  // res.write(`jobId: ${"models|veo-3.0-fast-generate-preview|operations|mpy1bxr4h59x"}\r`);
  // res.end();
  // return;
  
  const apiKey = process.env["GEMINI_API_KEY"];
  const googleAi = new GoogleGenAI({ apiKey });
  
  // Step 1. Start a video-generation job
  const config = { aspectRatio, personGeneration };
  if (/veo-2/.test(model)) config.durationSeconds = durationSeconds; // Veo 3 does not allow this parameter; its video length is always 8s.
  const operation = await googleAi.models.generateVideos({
    model,
    prompt,
    config,
  });

  if (operation.error) {
    res.statusMessage = `Video generation failed.`;
    res.status(500).write(res.statusMessage);
    return;
  }

  res.write(`data: ${thinkingHeader}\r`);
  
  // An example of operation: {"name":"models/veo-3.0-fast-generate-preview/operations/mpy1bxr4h59x"}
  const jobId = operation.name.replace(/\//g, "|");
  res.write(`jobId: ${jobId}\r`);
  res.end(); 
}

export async function getGeneratedVideoVeo3( req, res ) {
  const jobId = req.params.jobId;
  if (!jobId) {
    res.statusMessage = "Invalid request parameters, .../:jobId expected";
    res.status(400).write(res.statusMessage);
    return;
  }

  const apiKey = process.env["GEMINI_API_KEY"];
  const googleAi = new GoogleGenAI({ apiKey });

  // Step 2. Check the status of video generation job started at Step 1.
  const payload = {"name": jobId.replace(/\|/g, "/")};
  console.log(`Operation status for video generation: ${JSON.stringify(payload)}`);
  await new Promise((resolve) => setTimeout(resolve, 10_000));
  const operation = await googleAi.operations.getVideosOperation({ operation: payload });
  
  if (operation.error) {
    res.statusMessage = `Video generation failed.`;
    res.status(500).write(res.statusMessage);
    return;
  }
  if (!operation.done) {
    res.end();
    return;
  }
  if (operation.response.raiMediaFilteredCount) {
    res.statusMessage = operation.response.raiMediaFilteredReasons?.join(' ') || "Given prompt is not allowed by the service policy";
    res.status(500).write(res.statusMessage);
    return;
  }
  // Step 3. Download video and send it to the client.
  //const videoFile = {url: "https://generativelanguage.googleapis.com/v1beta/files/k2gg0v2wuugk:download?alt=media"};
  const videoFile = operation.response.generatedVideos[0].video;
  const videoUrl = videoFile.uri;
  console.log(`Downloading video from the URL: ${videoUrl}`);
  const responseVideo = await fetch(videoUrl, { headers: { "x-goog-api-key": apiKey } });
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
  res.end();
}