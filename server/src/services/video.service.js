import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

import { getVectorStore } from "./vector.service.js";
import {
  findVideoById,
  createVideo,
  updateVideoStatus,
  retryFailedVideo
} from "../repositories/video.repository.js";

const BRIGHTDATA_DATASET_ID = "gd_lk56epmy2i5g7lzu0k";

function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}
// Extract YouTube video ID
function extractVideoId(youtubeUrl) {
  let url;

  try {
    url = new URL(youtubeUrl);
  } catch {
    throw createError("Invalid YouTube URL", 400);
  }

  let videoId;

  if (url.hostname === "youtu.be") {
    videoId = url.pathname.split("/")[1];
  } else if (
    ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)
  ) {
    videoId = url.searchParams.get("v");
  }

  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    throw createError("Invalid YouTube video URL", 400);
  }

  return videoId;
}

// Fetch transcript from Bright Data
async function fetchTranscriptFromBrightData(youtubeUrl) {
  const apiKey = process.env.BRIGHTDATA_API_KEY;

  if (!apiKey) {
    throw createError("Server configuration error", 500);
  }

  // Step 1: Trigger scraping job
  const triggerResponse = await fetch(
    `https://api.brightdata.com/datasets/v3/trigger?dataset_id=${BRIGHTDATA_DATASET_ID}&format=json`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        {
          url: youtubeUrl,
          transcription_language: "",
          country: "",
        },
      ]),
    },
  );

  if (!triggerResponse.ok) {
    const errorText = await triggerResponse.text();
    throw new Error(`Bright Data error: ${errorText}`);
  }

  const triggerData = await triggerResponse.json();
  const snapshotId = triggerData.snapshot_id;

  if (!snapshotId) {
    throw new Error("Bright Data did not return a snapshot ID");
  }

  // Step 2: Wait until scraping is completed
  let status = "starting";
  let attempts = 0;
  const maxAttempts = 60;

  while (status !== "ready" && attempts < maxAttempts) {
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const progressResponse = await fetch(
      `https://api.brightdata.com/datasets/v3/progress/${snapshotId}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      },
    );

    if (!progressResponse.ok) {
      throw new Error("Unable to check Bright Data scraping status");
    }

    const progressData = await progressResponse.json();

    status = progressData.status;

    if (status === "failed") {
      throw new Error("Bright Data scraping failed");
    }

    attempts++;
  }

  if (status !== "ready") {
    throw createError("Video processing timed out", 504);
  }

  // Step 3: Download scraping result
  const resultResponse = await fetch(
    `https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}?format=json`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    },
  );

  if (!resultResponse.ok) {
    throw new Error("Unable to download Bright Data results");
  }

  const results = await resultResponse.json();

  const videoData = Array.isArray(results) ? results[0] : results;

  if (!videoData || !videoData.transcript) {
    throw createError("Transcript not found for this video", 422);
  }

  return {
    videoId: videoData.video_id,
    title: videoData.title,
    transcript: videoData.transcript,
  };
}

// Main video processing service
export async function processVideoService(youtubeUrl) {
  const videoId = extractVideoId(youtubeUrl);

  // 1. Try to create a new processing record
  let videoRecord = await createVideo(videoId);

  // 2. If record already exists, check its status
  if (!videoRecord) {
    const existingVideo = await findVideoById(videoId);

    if (!existingVideo) {
      throw createError("Unable to process video", 409);
    }

    // Already processed — don't process again
    if (existingVideo.status === "completed") {
      return {
        videoId,
        title: existingVideo.title,
        status: "completed",
        alreadyProcessed: true
      };
    }

    // Another request is processing this video
    if (existingVideo.status === "processing") {
      throw createError("Video is already being processed", 409);
    }

    // Allow retry if previous processing failed
    if (existingVideo.status === "failed") {
      videoRecord = await retryFailedVideo(videoId);

      if (!videoRecord) {
        throw createError("Video is already being processed", 409);
      }
    }
  }

  try {
    // 3. Fetch transcript
    const videoData = await fetchTranscriptFromBrightData(youtubeUrl);

    if (videoData.videoId && videoData.videoId !== videoId) {
      throw createError("Returned video ID does not match submitted URL", 422);
    }

    const transcript = videoData.transcript;

    if (typeof transcript !== "string" || !transcript.trim()) {
      throw createError("Invalid or empty transcript", 422);
    }

    // 4. Create document
    const docs = [
      new Document({
        pageContent: transcript,
        metadata: {
          video_id: videoId,
          title: videoData.title,
          source: youtubeUrl,
        },
      }),
    ];

    // 5. Split transcript
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const chunks = await splitter.splitDocuments(docs);

    chunks.forEach((chunk, index) => {
      chunk.metadata.chunk_index = index;
    });

    // 6. Save chunks in PGVector
    const vectorStore = await getVectorStore();
    await vectorStore.addDocuments(chunks);

    // 7. Mark video as completed
    await updateVideoStatus(videoId, "completed", videoData.title);

    return {
      videoId,
      title: videoData.title,
      totalChunks: chunks.length,
      status: "completed",
      alreadyProcessed: false
    };

  } catch (error) {
    // 8. Mark video as failed if processing fails
    try {
      await updateVideoStatus(videoId, "failed");
    } catch (dbError) {
      console.error("Failed to update video status:", dbError);
    }

    throw error;
  }
}