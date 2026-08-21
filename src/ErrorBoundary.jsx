import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error("Render error caught by ErrorBoundary:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            padding: 24,
            background: "#0B0E0C",
            color: "#E9E6DD",
            fontFamily:
              "'IBM Plex Mono', ui-monospace, 'JetBrains Mono', Menlo, Consolas, monospace",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.2em", color: "#B8402F" }}>
            Something went wrong
          </div>
          <div style={{ fontSize: 11, color: "#8A9089", maxWidth: 320, wordBreak: "break-word" }}>
            {String(this.state.error?.message || this.state.error)}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 8,
              padding: "8px 16px",
              background: "#39D98A",
              color: "#0B0E0C",
              border: "none",
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.15em",
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
