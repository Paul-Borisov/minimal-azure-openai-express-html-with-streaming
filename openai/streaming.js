import { isFirstResponse, isIterable, isStreamUnsupported, isText, onEnd, onError, thinkingHeader } from "./shared.js";

/**
 * A generic function to handle streaming responses.
 * @param {Object} options.res - The HTTP response object.
 * @param {Function} options.apiCall - Function that performs the API call; accepts a payload object.
 * @param {Function} options.apiFallback - Fallback function when streaming is not supported.
 * @param {Array} options.input - The constructed input array (e.g., [system, ...messages]).
 * @param {Object} [options.additionalProperties={}] - Extra options to pass to the API.
 * @param {boolean} options.streaming - Whether streaming is enabled.
 * @param {Function} options.parseOutput - Function to parse a response part.
 */
export async function handleStream({
  res,
  apiCall,
  apiFallback,
  input,
  additionalProperties = {},
  streaming,
  parseOutput,
  messages,
  model
}) {
  // Set common headers
  res.setHeader("Content-Type", streaming ? "text/event-stream" : "application/json");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // Write the thinking header to start
  res.write(`data: ${thinkingHeader}\r`);

  // If streaming is not enabled, immediately call the fallback
  if (!streaming) {
    await apiFallback({ input, additionalProperties, res, parseOutput });
    return;
  }

  try {
    const streamResponse = await apiCall({ input, additionalProperties, stream: true });
    //throw {code: "unsupported_value", param: "stream"}; // Uncomment this line to test the error condition on the unsupported streaming output.
    if (isIterable(streamResponse)) {
      for await (const part of streamResponse) {
        const content = parseOutput(part);
        if(isText(content)) res.write(`data: ${content}\r`);
      }
    } else {
      const content = parseOutput(streamResponse);
      if(isText(content)) res.write(`data: ${content}\r`);
    }
    onEnd(res);
  } catch (error) {
    if (isStreamUnsupported(error)) {
      if (isFirstResponse(messages)) {
        res.write(
          `data: <b>The model ${model} does not support streaming response yet. ${thinkingHeader}</b><br/><br/>\r`
        );
      }      
      apiFallback({ input, additionalProperties, res, parseOutput });
    } else {
      onError(error, res);
    }
  }
}
