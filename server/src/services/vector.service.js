import "dotenv/config";

import { PGVectorStore } from
    "@langchain/community/vectorstores/pgvector";

import {
    embedDocuments,
    embedQuery
} from "../../embeddings.js";

const embeddings = {
    embedDocuments,
    embedQuery
};

let vectorStore = null;

export async function getVectorStore() {
    if (vectorStore) {
        return vectorStore;
    }

    vectorStore = await PGVectorStore.initialize(
        embeddings,
        {
            postgresConnectionOptions: {
                connectionString: process.env.DB_URL,
                ssl: {
                    rejectUnauthorized: false
                }
            },

            tableName: "transcripts",

            columns: {
                idColumnName: "id",
                vectorColumnName: "vector",
                contentColumnName: "content",
                metadataColumnName: "metadata"
            },

            distanceStrategy: "cosine"
        }
    );

    console.log("Neon PGVectorStore initialized!");

    return vectorStore;
}