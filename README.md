# Overview

This is an educational OpenAI project that I developed for my colleagues to demonstrate the use of streaming outputs with Azure OpenAI and regular OpenAI clients.

This project highlights:

- The use of streaming outputs in OpenAI / Azure OpenAI.
- A clear, visually noticeable difference in the streaming performance between the older gpt-4o-mini / gpt-4o models and the newer o1-mini / o1-preview language models.
- How to test keyless Entra ID authentication in Azure OpenAI.
- The ability to cancel an ongoing streaming request using the **Stop** button.

Technical stack:

- Node.js, Express server, OpenAI module, @azure/identity for API key and keyless Entra ID authentication, plain JavaScript, and index.html.

# Getting started

Clone the project repository, open it in your preferred editor, such as Visual Studio Code.

Create your own **.env** file using env.example as a template, and adjust your values as needed.

```bash
AZURE_OPENAI_ENDPOINT=https://<your-azure-openai-instance>.openai.azure.com
# Comment out the next line if you are going to use Azure OpenAI keyless authentication. Start your express server using node server-entraid.js instead of node server.js.
AZURE_OPENAI_API_KEY=<your apiKey for Azure OpenAI> # Unless you use keyless
...
OPENAI_API_KEY=<your apiKey for regular OpenAI> # This key is used by o1-mini and o1-preview models unavailable at Azure OpenaI as of December 1, 2024
```

npm i

node server.js

http://localhost:3000

![Streaming output with cancel button in the dark system theme](docs/images/1_streaming-output-with-cancel-button.png "Streaming output with cancel button in the dark system theme")

![Complete output in the dark system theme](docs/images/2_complete-output.png "Complete output in the dark system theme")

# Minimal ChatGPT server powered by express.js with streaming outputs

By default, the server supports the following types of requests to OpenAI instances:

- Azure OpenAI with <api-key>
- Azure OpenAI with keyless authentication using the Entra ID provider
- OpenAI with Bearer <apiKey>

The following deployments should be established on your Azure OpenAI instance:

- gpt-4o
- gpt-4o-mini

Additionally, there should be two active models available at your OpenAI API (prepaid API service):

As of December 1, 2024, o1-models are not yet publicly available in Azure OpenAI. The server utilizes these models through the regular OpenAI API subscription.

- o1-mini
- o1-preview

You can adjust the specific models used in the file public/index.html.

```html
<select class="model">
  <option value="gpt-4o-mini" selected="true">gpt-4o-mini</option>
  <option value="gpt-4o">gpt-4o</option>
  <option value="o1-mini">o1-mini</option>
  <option value="o1-preview">o1-preview</option>
</select>
```

### User interface with streaming output, which consumes data from the server

Open http://localhost:3000 in your browser.

Alternatively, you can open public/index.html from the local folder and click the **Send** button.

### Browser console client with streaming output, which consumes data from the server

Execute browser-client.js in the browser's console.

# How to test keyless authentication for Azure OpenAI on this express server

To test keyless (Entra ID) authentication locally, follow these steps:

1. Install Azure Cli (az) on your machine: https://learn.microsoft.com/en-us/cli/azure/install-azure-cli

2. Open your OpenAI resource in the Azure portal, navigate to **Access Control (IAM)** and add the role **Cognitive Services OpenAI User** to your Entra ID account.

3. Open your **.env** file. Comment out or remove the line AZURE_OPENAI_API_KEY=...

4. Run the server using the following command: **node server-entraid.js**. Keyless authentication should start to work.

# Useful links

https://learn.microsoft.com/en-us/azure/ai-services/openai/chatgpt-quickstart?tabs=command-line%2Cjavascript-key%2Ctypescript-keyless%2Cpython-new&pivots=programming-language-javascript

https://techcommunity.microsoft.com/blog/azuredevcommunityblog/using-keyless-authentication-with-azure-openai/4111521
