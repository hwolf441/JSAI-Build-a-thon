import dotenv from 'dotenv';
import ModelClient from '@azure-rest/ai-inference';
import { AzureKeyCredential } from '@azure/core-auth';
dotenv.config();

const client = new ModelClient(
    process.env.AI_INFERENCE_SDK_ENDPOINT,
    new AzureKeyCredential(process.env.AI_INFERENCE_SDK_KEY)
    );

var messages = [
  { role: "system", content: "You are an helpful assistant" },
  { role: "user", content: "What are 3 things to see in Seattle?" },
];

var response = await client.path("chat/completions").post({
  body: {
    messages: messages,
    max_tokens: 2048,
      model: "DeepSeek-R1-0528",
  },
});

console.log(JSON.stringify(response));
