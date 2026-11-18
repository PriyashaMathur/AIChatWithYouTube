
import { useState } from "react";
import "./App.css";

const API_URL = "http://localhost:5000/api/v1";

function App() {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [videoId, setVideoId] = useState("");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Process YouTube video
  async function handleProcessVideo(e) {
    e.preventDefault();

    setError("");

    if (!youtubeUrl.trim()) {
      setError("Please enter a YouTube URL");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${API_URL}/videos/process`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          youtubeUrl: youtubeUrl.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Video processing failed");
      }

      setVideoId(data.data.videoId);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Send chat question
  async function handleSendMessage(e) {
    e.preventDefault();

    if (!question.trim() || loading) return;

    const userQuestion = question.trim();

    setMessages((prev) => [
      ...prev,
      { role: "user", content: userQuestion },
    ]);

    setQuestion("");
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          videoId,
          question: userQuestion,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to get answer");
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer },
      ]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // First screen: YouTube URL
  if (!videoId) {
    return (
      <div className="app-container">
        <div className="url-card">
          <div className="logo">▶</div>

          <h1>YouTube AI Chat</h1>
          <p className="subtitle">
            Chat with any YouTube video using AI
          </p>

          <form onSubmit={handleProcessVideo}>
            <label>YouTube Video URL</label>

            <input
              type="url"
              placeholder="Paste your YouTube link here..."
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              required
            />

            <button type="submit" disabled={loading}>
              {loading ? "Processing Video..." : "Process Video"}
            </button>
          </form>

          {error && <p className="error">{error}</p>}

          {loading && (
            <p className="loading-text">
              Please wait while we process your video...
            </p>
          )}
        </div>
      </div>
    );
  }

  // Second screen: Chat interface
  return (
    <div className="chat-container">
      <header className="chat-header">
        <div>
          <h2>▶ YouTube AI Chat</h2>
          <p>Ask anything about your video</p>
        </div>
      </header>

      <main className="chat-messages">
        {messages.length === 0 && (
          <div className="welcome-message">
            <h2>Your video is ready!</h2>
            <p>Ask your first question to get started.</p>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            className={`message ${message.role}`}
          >
            {message.content}
          </div>
        ))}

        {loading && (
          <div className="message assistant">
            Thinking...
          </div>
        )}
      </main>

      {error && <p className="error chat-error">{error}</p>}

      <form className="chat-input" onSubmit={handleSendMessage}>
        <input
          type="text"
          placeholder="Ask something about the video..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />

        <button type="submit" disabled={loading || !question.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}

export default App;
