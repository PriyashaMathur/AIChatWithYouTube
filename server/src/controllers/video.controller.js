import { processVideoService } from "../services/video.service.js";

export const processVideo = async (req, res, next) => {
  try {
    const { youtubeUrl } = req.body;

    // Validate input
    if (!youtubeUrl || typeof youtubeUrl !== "string") {
      const error = new Error("YouTube URL is required");
      error.statusCode = 400;
      throw error;
    }

    // Validate URL format
    let url;

    try {
      url = new URL(youtubeUrl);
    } catch {
      const error = new Error("Invalid YouTube URL");
      error.statusCode = 400;
      throw error;
    }

    const hostname = url.hostname.replace(/^www\./, "");

    let videoId;

    if (hostname === "youtu.be") {
      videoId = url.pathname.split("/")[1];
    } else if (
      ["youtube.com", "m.youtube.com"].includes(hostname)
    ) {
      videoId = url.searchParams.get("v");
    }

    if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      const error = new Error("Invalid YouTube video URL");
      error.statusCode = 400;
      throw error;
    }

    const result = await processVideoService(youtubeUrl);

    return res.status(200).json({
      success: true,
      message: "Video processed successfully",
      data: result
    });

  } catch (error) {
    next(error);
  }
};
