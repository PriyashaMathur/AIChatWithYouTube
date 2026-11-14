import { pipeline } from "@huggingface/transformers";

let extractor;

// Load model only once
async function loadModel() {
    if (!extractor) {
        console.log("Loading Hugging Face embedding model...");

        extractor = await pipeline(
            "feature-extraction",
            "onnx-community/all-MiniLM-L6-v2-ONNX"
        );

        console.log("Embedding model loaded!");
    }

    return extractor;
}

// Generate embeddings for multiple documents
export async function embedDocuments(texts) {
    const model = await loadModel();

    const output = await model(texts, {
        pooling: "mean",
        normalize: true
    });

    return output.tolist();
}

// Generate embedding for a single query
export async function embedQuery(text) {
    const model = await loadModel();

    const output = await model(text, {
        pooling: "mean",
        normalize: true
    });

    return output.tolist()[0];
}
