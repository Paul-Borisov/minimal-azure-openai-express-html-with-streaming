export const thinkingHeader = await fetch("/api/progresstext").then(r => r.text()).catch(() => "Thinking...");

export function getFormattedOutput(rawOutput, isAi, openAiIcon) {
  return isAi
    ? `<div class="response">
         <div class="icon-container">${openAiIcon}</div>
         <div>${marked.marked(rawOutput)}</div>
       </div>`
    : `<div class="request">
         <div></div>
         <div class="user-content">${marked.marked(rawOutput)}</div>
       </div>`;
}

export function formatEmbeddings(embeddings) {
  return "```embeddings\n" + embeddings + "\n```";
}

export function handleErrorOutput(root, thinkingHeader, trailingHtml) {
  console.log(trailingHtml)
  if (root.innerHTML.includes(thinkingHeader)) {
    root.innerHTML = root.innerHTML.replace(thinkingHeader, trailingHtml);
  } else {
    const response = root.querySelector(".response:last-child div:last-child");
    if (response) {
      response.innerHTML += trailingHtml;
    } else {
      root.innerHTML += trailingHtml;
    }
  }
}
