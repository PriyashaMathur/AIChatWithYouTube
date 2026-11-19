import express from "express";
import cors from "cors";
import videoRoutes from "./routes/video.routes.js";
import chatRoutes from "./routes/chat.routes.js";
import { errorHandler } from "./middleware/error.middleware.js";


const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "AIChatWithYouTube API is running",
  });
});

app.use("/api/v1/videos", videoRoutes);
app.use("/api/v1/chat", chatRoutes);


app.use(errorHandler);
export default app;
