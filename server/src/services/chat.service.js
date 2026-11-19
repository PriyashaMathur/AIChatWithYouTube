import { runYouTubeAgent } from "../agents/youtube.agent.js";

export async function processChat(videoId, question) {

  // 1. Check Groq API key
  if (!process.env.GROQ_API_KEY) {
    const error = new Error("Server configuration error");
    error.statusCode = 500;
    throw error;
  }

  // 2. Execute YouTube agent
  let answer;

  try {
    answer = await runYouTubeAgent(videoId, question);
  } catch (error) {
    console.error("YouTube Agent Error:", error);

    const newError = new Error("Failed to generate answer");
    newError.statusCode = 503;
    throw newError;
  }

  // 3. Validate generated answer
  if (
    !answer ||
    typeof answer !== "string" ||
    !answer.trim()
  ) {
    const error = new Error("Could not generate a valid answer");
    error.statusCode = 502;
    throw error;
  }

  // 4. Return response
  return {
    answer: answer.trim()
  };
}
