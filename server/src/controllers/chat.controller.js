import { processChat } from "../services/chat.service.js";

export async function chat(req, res, next) {
  try {
    const { videoId, question } = req.body;

    // Validate videoId
    if (
      typeof videoId !== "string" ||
      !/^[a-zA-Z0-9_-]{11}$/.test(videoId)
    ) {
      const error = new Error("Invalid YouTube video ID");
      error.statusCode = 400;
      throw error;
    }

    // Validate question
    if (
      typeof question !== "string" ||
      !question.trim()
    ) {
      const error = new Error("Question must be a non-empty string");
      error.statusCode = 400;
      throw error;
    }

    const result = await processChat(videoId, question.trim());

    return res.status(200).json({
      success: true,
      videoId,
      question: question.trim(),
      answer: result.answer
    });

  } catch (error) {
    next(error);
  }
}
