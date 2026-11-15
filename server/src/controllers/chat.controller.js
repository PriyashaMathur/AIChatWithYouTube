import { processChat } from "../services/chat.service.js";

export async function chat(req, res) {
  try {
    const { videoId, question } = req.body;

    if (!videoId || !question) {
      return res.status(400).json({
        success: false,
        message: "videoId and question are required"
      });
    }

    if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid YouTube video ID"
      });
    }

    if (typeof question !== "string" || !question.trim()) {
      return res.status(400).json({
        success: false,
        message: "Question must be a non-empty string"
      });
    }

    const result = await processChat(videoId, question.trim());

    return res.status(200).json({
      success: true,
      videoId,
      question,
      answer: result.answer
    });

  } catch (error) {
    console.error("Chat Controller Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to process chat request",
      error: error.message
    });
  }
}
