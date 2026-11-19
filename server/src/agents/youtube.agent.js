import { ChatGroq } from "@langchain/groq";
import { tool } from "@langchain/core/tools";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { z } from "zod";

import { getVectorStore } from "../services/vector.service.js";

const groqModel = new ChatGroq({
  model: "openai/gpt-oss-120b",
  apiKey: process.env.GROQ_API_KEY,
  temperature: 0,
});

export async function runYouTubeAgent(videoId, question) {
  let vectorStore;

  try {
    vectorStore = await getVectorStore();
  } catch (error) {
    console.error("Vector Store Error:", error);

    const newError = new Error("Unable to connect to vector database");
    newError.statusCode = 503;
    throw newError;
  }
  const retrievalTool = tool(
    async ({ query }) => {
      const retrievedDocs = await vectorStore.similaritySearch(query, 3, {
        video_id: videoId,
      });

      if (!retrievedDocs.length) {
        return "No relevant information found in this video's transcript.";
      }

      return retrievedDocs.map((doc) => doc.pageContent).join("\n\n");
    },
    {
      name: "retrieve_video_transcript",
      description:
        "Search the transcript of the currently selected YouTube video. Always use this tool to find information before answering questions about the video.",
      schema: z.object({
        query: z.string().describe("Search query for the transcript"),
      }),
    },
  );

  const agent = createReactAgent({
    llm: groqModel,
    tools: [retrievalTool],
  });
  let result;

  try {
    result = await agent.invoke({
      messages: [
        {
          role: "user",
          content: `Answer this question using only the transcript of the selected YouTube video.

Question: ${question}

If the transcript does not contain the answer, clearly say that the information is not available in the video.`,
        },
      ],
    });
  } catch (error) {
    console.error("Agent Execution Error:", error);

    const newError = new Error("Failed to execute YouTube agent");
    newError.statusCode = 503;
    throw newError;
  }
  const lastMessage = result.messages.at(-1);

  return lastMessage.content;
}
