import dotenv from "dotenv";
dotenv.config();

// Parameters for Azure OpenAI
const endpoint = process.env["AZURE_OPENAI_ENDPOINT"];
const apiVersion = process.env["AZURE_OPENAI_API_VERSION"];
const defaultDeployment = process.env["AZURE_OPENAI_API_DEPLOYMENT"];
import { AzureOpenAI } from "openai";
// Keyless authentication using Entra ID.
import { DefaultAzureCredential, ManagedIdentityCredential, getBearerTokenProvider } from "@azure/identity";
import { modelDeploymentMap } from "./azureOpenAIDeploymentMap.js";
import { validateSupportedAssets } from "./shared.js";

// Determine authentication mode for Azure OpenAI:
// - Use AZURE_AUTH_MODE env variable if provided.
// - Otherwise, default to "key" if AZURE_OPENAI_API_KEY is set, else "keyless".

export const isAzureOpenAiSupported = !!endpoint;

export const isAzureOpenAiInstanceSupported = (instanceSuffix) => {
  const currentEndpoint = process.env[`AZURE_OPENAI_ENDPOINT${instanceSuffix}`];
  return !!currentEndpoint;
};

export const ensureAccessMeans = (instanceSuffix) => {
  const currentEndpoint = process.env[`AZURE_OPENAI_ENDPOINT${instanceSuffix}`];
  const isAoiSupported = instanceSuffix ? isAzureOpenAiSupported : isAzureOpenAiInstanceSupported(instanceSuffix);
  if (!isAoiSupported) {
    throw new Error(`Azure OpenAI is not supported. AZURE_OPENAI_ENDPOINT${instanceSuffix} is missing`);
  }
  const envVarApiKey = `AZURE_OPENAI_API_KEY${instanceSuffix}`;
  const azureAuthMode = process.env["AZURE_AUTH_MODE"] || (process.env[envVarApiKey] ? "key" : "keyless");
  if (isAoiSupported && azureAuthMode === "key" && !process.env[envVarApiKey]) {
    throw new Error(`${envVarApiKey} must be present for key authentication`);
  } else if (isAoiSupported && azureAuthMode === "keyless" && process.env[envVarApiKey]) {
    throw new Error(`${envVarApiKey} must be commented out for keyless authentication`);
  }

  return { currentEndpoint, envVarApiKey, azureAuthMode };
}

// Unified helper function for creating AzureOpenAI instance
export const createAzureOpenAI = async (req, instanceSuffix = "") => {
  const { currentEndpoint, envVarApiKey, azureAuthMode } = ensureAccessMeans(instanceSuffix);
  const model = req.body.model ?? defaultDeployment;
  await validateSupportedAssets(model, "azureopenai");

  const deployment = modelDeploymentMap[req.body.model] ?? model;
  if (azureAuthMode === "key") {
    return new AzureOpenAI({
      currentEndpoint,
      azureApiKey: process.env[envVarApiKey],
      apiVersion,
      deployment,
    });
  } else {
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
