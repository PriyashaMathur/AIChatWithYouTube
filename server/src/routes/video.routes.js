import { Router } from "express";
import { processVideo } from "../controllers/video.controller.js";

const router = Router();

router.post("/process", processVideo);

export default router;
