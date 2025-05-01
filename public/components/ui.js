import { voiceOut } from "./icons.js";

export const thinkingHeader = await fetch("/api/progresstext").then(r => r.text()).catch(() => "Thinking...");

const dataImageSourcePrefix = "data:image/";

export function getFormattedDataImage(src) {
  const img = document.createElement("img");
  img.src = src;
  img.className = "image-full";
  return img.outerHTML;
}

export function getFormattedOutput(rawOutput, isAi, openAiIcon) {
  if (rawOutput?.startsWith(dataImageSourcePrefix)) return getFormattedDataImage(rawOutput);
  
  return isAi
    ? `<div class="response">
         <div class="icon-container">${openAiIcon}</div>
         <div class="ai-output">${marked.marked(rawOutput)}</div>
         <div class="ai-actions">
          <div class="ai-voice-out" title="Voice out">${voiceOut}</div>
         </div>
       </div>`
    : `<div class="request">
         <div></div>
         <div class="user-content">${marked.marked(rawOutput)}</div>
       </div>`;
}

export function formatDataImageSource(src, mimeType) {
  return `${dataImageSourcePrefix}${mimeType};base64,${src}`;
}

export function formatEmbeddings(embeddings) {
  return "```embeddings\n" + embeddings + "\n```";
}

export function handleErrorOutput(root, thinkingHeader, trailingHtml, aiOutputElement) {
  if (root.innerHTML.includes(thinkingHeader)) {
    root.innerHTML = root.innerHTML.replace(thinkingHeader, trailingHtml);
  } else if( aiOutputElement ) {
    aiOutputElement.innerHTML += trailingHtml;
  } else {
    const response = root.querySelector(".response:last-child div:last-child");
    if (response) {
      response.innerHTML += trailingHtml;
    } else {
      root.innerHTML += trailingHtml;
    }
  }
}
