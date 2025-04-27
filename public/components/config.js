export const targetEndpoints = {
  //"4o": "azureopenai",
  //"4.1": "azureopenai",
  //"o1": "azureopenai",
  //"o1-mini": "azureopenai",
  //"o3-mini": "azureopenai",
  //"o4-mini": "azureopenai",
  //"embedding": "azureopenai",
  //"gpt-4o-audio-preview": "azureopenai",
  //"dall-e": "azureopenai",
  deepseek: "deepseek",
  default: "openai"
};

export const modelsThatSupportResponses = [
  "computer-use-preview",
  "gpt-4.1",
  "gpt-4.1-mini",
  //"gpt-4.1-nano", // Commented out to speed up the output
  "gpt-4.5-preview",
  "gpt-4o",
  //"gpt-4o-mini",
  //"gpt-4-32k-0314",
  //"gpt-3.5-turbo",
  //"o1",
  "o1-pro",
  //"o3-mini",
  "o4-mini"
];

// https://platform.openai.com/docs/guides/image-generation?image-generation-model=gpt-image-1
export const optionalImageParameters = {
  // transparent, opaque
  background: "transparent",
  // auto (default), low (less restrictive filtering)
  moderation: "low",
  // 1 - 10
  n: 1,
  // 0 - 100 (for webp and jpeg only)
  output_compression: 50,
  // png, jpeg, webp. dall-e-2 and dall-e-3 only support png.
  output_format: "webp",
  // Available sizes: 1024x1024 (square), 1536x1024 (portrait), 1024x1536 (landscape), auto (default)
  size: "1024x1024",
  // vivid, natural for dall-e-3 (not in used by gpt-image-1)
  style: "natural",
  // low, medium, high, auto (default). dall-e-3 only supports "hd" and "standard" (high => hd is chosen automatically in images.js)
  quality: "high"
};
