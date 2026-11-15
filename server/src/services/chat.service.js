
import { runYouTubeAgent } from "../agents/youtube.agent.js";

export async function processChat(videoId, question) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is missing");
  }

  const answer = await runYouTubeAgent(videoId, question);

  return {
    answer
  };
}
