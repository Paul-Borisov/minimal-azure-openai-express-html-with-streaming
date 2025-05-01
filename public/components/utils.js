import { modelsThatSupportResponses, targetEndpoints } from "./config.js";

export const getTargetEntpointForModel = (model) => {
  let endpoint;
  const lcModel = model.toLocaleLowerCase();
  const modelSupportsResponses = modelsThatSupportResponses.some(e => e === lcModel);
  for (const key of Object.keys(targetEndpoints)) {
    if (model.includes(key)) {
      endpoint = targetEndpoints[key];
      break;
    }
  }
  if (!endpoint) {
    endpoint = targetEndpoints.default;
  }
  return { endpoint, modelSupportsResponses };
}