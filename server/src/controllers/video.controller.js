
import { processVideoService } from "../services/video.service.js";

export const processVideo = async (req, res, next) => {
    try {
        const { youtubeUrl } = req.body;

        if (!youtubeUrl || typeof youtubeUrl !== "string") {
            return res.status(400).json({
                success: false,
                message: "YouTube URL is required"
            });
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
