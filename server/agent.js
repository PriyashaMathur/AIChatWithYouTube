import "dotenv/config";
import { embedDocuments, embedQuery } from "./embeddings.js";
import { ChatGoogle } from "@langchain/google";
import data from "./data.js";
import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { tool } from "@langchain/core/tools";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { z } from "zod";
import { MemorySaver } from "@langchain/langgraph";
import { ChatGroq } from "@langchain/groq";

const video1 = data[0];
const docs = [
  new Document({
    pageContent: video1.transcript,
    metadata: {
      video_id: video1.video_id,
    },
  }),
];
const checkPointSaver = new MemorySaver();
// ---------------------Splitting the transcript into chunks-----------------------
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
});
const chunks = await splitter.splitDocuments(docs);

// ----------------------Embed the Model-------------------------------------------
const embeddings = {
  embedDocuments,
  embedQuery,
};
// store in vector space-----------------
const vectorStore = new MemoryVectorStore(embeddings);
await vectorStore.addDocuments(chunks);

// ------------Retrieve the most relevant chunks--------------------

const retrievalTool = tool(
  async ({ query }) => {
    console.log("Retrieving docs for query:---------");
    console.log("Video ID:", video1.video_id);
    const retrievedDocs = await vectorStore.similaritySearch(
      query,
      3,
      (doc) => doc.metadata?.video_id === video1.video_id,
    );
    const serializedDocs = retrievedDocs
      .map((doc) => doc.pageContent)
      .join("\n");
    return serializedDocs;
  },
  {
    name: "retrieve",
    description:
      "Retrieve the most relevant chunks of text from the transcript of a youtube video",
    schema: z.object({
      query: z.string(),
    }),
  },
);

const geminiModel = new ChatGoogle({
  model: "gemini-2.5-flash",
  apiKey: process.env.GEMINI_API_KEY,
});
const groqModel = new ChatGroq({
  model: "openai/gpt-oss-120b",
  apiKey: process.env.GROQ_API_KEY,
  temperature: 0,
});
// const video_id:kEtGm75uBes;
const tools = [retrievalTool];
const config = {
  configurable: {
    thread_id: "chat-101",
    video_id: video1.video_id,
  },
};
const agent = createReactAgent({
  llm: groqModel,
  tools,
  checkpointer: checkPointSaver,
});
console.log(
  "Question 1: What is being used for web scraping, and what role does it play in this project?",
);
const result = await agent.invoke(
  {
    messages: [
      {
        role: "user",
        content:
          " What is being used for web scraping, and what role does it play in this project?",
      },
    ],
  },
  config,
);
console.log(result.messages.at(-1).content);
