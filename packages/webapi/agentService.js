import { AIProjectClient } from "@azure/ai-projects";
import { DefaultAzureCredential } from "@azure/identity";
import dotenv from "dotenv";

dotenv.config();

const agentThreads = {};

export class AgentService {
  constructor() {
    // Validate required environment variables
    if (!process.env.AZURE_AI_CONNECTION_STRING) {
      throw new Error("AZURE_AI_CONNECTION_STRING is not defined in environment variables");
    }
    
    if (!process.env.AZURE_AI_AGENT_ID) {
      throw new Error("AZURE_AI_AGENT_ID is not defined in environment variables");
    }

    // Initialize client with credentials from environment
    this.client = AIProjectClient.fromConnectionString(
      process.env.AZURE_AI_CONNECTION_STRING,
      new DefaultAzureCredential()
    );
    
    this.agentId = process.env.AZURE_AI_AGENT_ID;
  }

  async getOrCreateThread(sessionId) {
    if (!agentThreads[sessionId]) {
      try {
        const thread = await this.client.agents.createThread();
        agentThreads[sessionId] = thread.id;
        return thread.id;
      } catch (error) {
        console.error("Error creating thread:", error);
        throw new Error("Failed to create conversation thread");
      }
    }
    return agentThreads[sessionId];
  }

  async processMessage(sessionId, message) {
    if (!sessionId || !message) {
      throw new Error("Session ID and message are required");
    }

    try {
      const threadId = await this.getOrCreateThread(sessionId);

      // Create user message
      const createdMessage = await this.client.agents.createMessage(threadId, {
        role: "user",
        content: message,
      });

      // Start the agent run
      let run = await this.client.agents.createRun(threadId, this.agentId);
      
      // Poll for run completion
      while (run.status === "queued" || run.status === "in_progress") {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        run = await this.client.agents.getRun(threadId, run.id);
      }
      
      // Handle run failure
      if (run.status !== "completed") {
        console.error(`Run failed with status: ${run.status}`);
        return {
          success: false,
          reply: `Sorry, I encountered an error (${run.status}). Please try again.`,
        };
      }
      
      // Get the assistant's response
      const messages = await this.client.agents.listMessages(threadId);
      
      const assistantMessages = messages.data
        .filter(msg => msg.role === "assistant")
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      if (assistantMessages.length === 0) {
        return { 
          success: false,
          reply: "I don't have a response at this time. Please try again.",
        };
      }

      // Extract text content from the response
      let responseText = "";
      for (const contentItem of assistantMessages[0].content) {
        if (contentItem.type === "text") {
          responseText += contentItem.text.value;
        }
      }
      
      return {
        success: true,
        reply: responseText,
      };
    } catch (error) {
      console.error("Agent processing error:", error);
      return {
        success: false,
        reply: "Sorry, I encountered an error processing your request. Please try again.",
      };
    }
  }
}