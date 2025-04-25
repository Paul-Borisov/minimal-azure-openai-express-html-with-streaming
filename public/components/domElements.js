export const root = document.querySelector("#root");
export const txtPrompt = document.querySelector("#txtPrompt");
export const btnSend = document.querySelector("#btnSend");
export const btnAbort = document.querySelector("#btnAbort");
export const btnClear = document.querySelector("#btnClear");
export const btnCode = document.querySelector("#btnCode");
export const btnText = document.querySelector("#btnText");
export const btnReset = document.querySelector("#btnReset");
export const selectedModel = document.querySelector(".model");
export const openAiIcon = decodeURIComponent(
  document.querySelector("head #favicon").getAttribute("href").replace("data:image/svg+xml,","")
);
