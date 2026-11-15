import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

import { getVectorStore } from "./vector.service.js";

const BRIGHTDATA_DATASET_ID = "gd_lk56epmy2i5g7lzu0k";


// Extract YouTube video ID
function extractVideoId(youtubeUrl) {
    let url;

    try {
        url = new URL(youtubeUrl);
    } catch {
        throw new Error("Invalid YouTube URL");
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
        throw new Error("Invalid YouTube video URL");
    }

    return videoId;
}


// Fetch transcript from Bright Data
async function fetchTranscriptFromBrightData(youtubeUrl) {

    const apiKey = process.env.BRIGHTDATA_API_KEY;

    if (!apiKey) {
        throw new Error("BRIGHTDATA_API_KEY is missing");
    }

    // Step 1: Trigger scraping job
    const triggerResponse = await fetch(
        `https://api.brightdata.com/datasets/v3/trigger?dataset_id=${BRIGHTDATA_DATASET_ID}&format=json`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify([
                {
                    url: youtubeUrl,
                    transcription_language: "",
                    country:""
                }
            ])
        }
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

        await new Promise(resolve => setTimeout(resolve, 3000));

        const progressResponse = await fetch(
            `https://api.brightdata.com/datasets/v3/progress/${snapshotId}`,
            {
                headers: {
                    Authorization: `Bearer ${apiKey}`
                }
            }
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
        throw new Error("Bright Data scraping timed out");
    }

    // Step 3: Download scraping result
    const resultResponse = await fetch(
        `https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}?format=json`,
        {
            headers: {
                Authorization: `Bearer ${apiKey}`
            }
        }
    );

    if (!resultResponse.ok) {
        throw new Error("Unable to download Bright Data results");
    }

    const results = await resultResponse.json();

    const videoData = Array.isArray(results) ? results[0] : results;

    if (!videoData || !videoData.transcript) {
        throw new Error("Transcript not found for this video");
    }

    return {
        videoId: videoData.video_id,
        title: videoData.title,
        transcript: videoData.transcript
    };
}


// Main video processing service
export async function processVideoService(youtubeUrl) {

    // 1. Extract video ID
    const videoId = extractVideoId(youtubeUrl);

    // 2. Fetch transcript
    const videoData = await fetchTranscriptFromBrightData(youtubeUrl);

    if (videoData.videoId && videoData.videoId !== videoId) {
        throw new Error("Returned video ID does not match submitted URL");
    }

    const transcript = videoData.transcript;

    if (typeof transcript !== "string" || !transcript.trim()) {
        throw new Error("Invalid or empty transcript");
    }

    // 3. Create LangChain document
    const docs = [
        new Document({
            pageContent: transcript,
            metadata: {
                video_id: videoId,
                title: videoData.title,
                source: youtubeUrl
            }
        })
    ];

    // 4. Split transcript
    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200
    });

    const chunks = await splitter.splitDocuments(docs);

    // 5. Add chunk index
    chunks.forEach((chunk, index) => {
        chunk.metadata.chunk_index = index;
    });

    // 6. Get vector store
    const vectorStore = await getVectorStore();

    // 7. Generate embeddings and save chunks
    await vectorStore.addDocuments(chunks);

    // 8. Return result
    return {
        videoId,
        title: videoData.title,
        totalChunks: chunks.length,
        status: "completed"
    };
}
