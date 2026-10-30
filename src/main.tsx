import { Component, StrictMode } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main className="fatal">
        <h1>这个实验遇到了问题</h1>
        <p>
          你的浏览器学习记录仍然保留。请回到默认课程，或在 GitHub
          报告输入与操作步骤。
        </p>
        <button
          onClick={() => {
            location.hash = "/lesson/quick";
            location.reload();
          }}
        >
          返回快速排序
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
