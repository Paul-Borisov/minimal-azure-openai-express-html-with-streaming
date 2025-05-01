// Parameters for Azure OpenAI
const endpoint = process.env["AZURE_OPENAI_ENDPOINT"];
const apiVersion = process.env["AZURE_OPENAI_API_VERSION"];
const defaultDeployment = process.env["AZURE_OPENAI_API_DEPLOYMENT"];
const { modelDeploymentMap } = require("./azureOpenAIDeploymentMap");
const { validateSupportedAssets } = require("./shared");

// Determine authentication mode for Azure OpenAI:
// - Use AZURE_AUTH_MODE env variable if provided.
// - Otherwise, default to "key" if AZURE_OPENAI_API_KEY is set, else "keyless".
const azureAuthMode = process.env["AZURE_AUTH_MODE"] || (process.env["AZURE_OPENAI_API_KEY"] ? "key" : "keyless");

const isAzureOpenAiSupported = !!endpoint;

if (isAzureOpenAiSupported && azureAuthMode === "key" && !process.env["AZURE_OPENAI_API_KEY"]) {
  throw new Error("AZURE_OPENAI_API_KEY must be present for key authentication");
} else if (isAzureOpenAiSupported && azureAuthMode === "keyless" && process.env["AZURE_OPENAI_API_KEY"]) {
  throw new Error("AZURE_OPENAI_API_KEY must be commented out for keyless authentication");
}

// Unified helper function for creating AzureOpenAI instance
const createAzureOpenAI = async (req) => {
  if (!isAzureOpenAiSupported) {
    throw new Error("Azure OpenAI is not supported. AZURE_OPENAI_ENDPOINT is missing");
  }
  const model = req.body.model ?? defaultDeployment;
  await validateSupportedAssets(model, "azureopenai");

  const { AzureOpenAI } = require("openai");
  const deployment = modelDeploymentMap[req.body.model] ?? model;
  if (azureAuthMode === "key") {
    return new AzureOpenAI({
      endpoint,
      azureApiKey: process.env["AZURE_OPENAI_API_KEY"],
      apiVersion,
      deployment,
    });
  } else {
    // Keyless authentication using Entra ID.
    const { DefaultAzureCredential, ManagedIdentityCredential, getBearerTokenProvider } = require("@azure/identity");
    const getCredential = () => {
      const isAzureContainerContext = () => !!process.env['CONTAINER_APP_NAME'];
      if(!isAzureContainerContext()) return new DefaultAzureCredential();

      const managedIdentityClientId = process.env["MANAGED_IDENTITY_CLIENT_ID"];
      const isValidManagedIdentity = () => {
        return !!managedIdentityClientId && managedIdentityClientId !== "00000000-0000-0000-0000-000000000000";
      }
      if(isValidManagedIdentity()) {
        return new ManagedIdentityCredential(managedIdentityClientId);
      } else {
        return DefaultAzureCredential();
      }
    };
    const credential = getCredential();
    const scope = "https://cognitiveservices.azure.com/.default";
    const azureADTokenProvider = getBearerTokenProvider(credential, scope);
    return new AzureOpenAI({
      apiVersion,
      endpoint,
      deployment,
      azureADTokenProvider,
    });
  }
};

module.exports = {
  isAzureOpenAiSupported,
  createAzureOpenAI
}