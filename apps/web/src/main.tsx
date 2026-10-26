import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { initTheme } from "@reouvir/shared/theme";
import { App } from "./App";
import "./styles.css";

initTheme();
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
