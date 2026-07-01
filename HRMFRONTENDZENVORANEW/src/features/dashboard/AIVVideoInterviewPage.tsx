import React from "react";

const AIVVideoInterviewPage: React.FC = () => {
  return (
    <div className="aiv-video-interview-page" style={{ padding: "2rem" }}>
      <h1 style={{ fontFamily: "'Inter', sans-serif", color: "#2c3e50" }}>
        AI Video Interview
      </h1>
      <p>This page will host AI-powered video interview functionality.</p>
      <video
        controls
        width="600"
        style={{ borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
      >
        <source src="/assets/sample-interview.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>
    </div>
  );
};

export default AIVVideoInterviewPage;
