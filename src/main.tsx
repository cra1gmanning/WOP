import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { AppProvider } from "./ui/context";
import { Shell } from "./ui/shell";
import "./ui/styles.css";

if (import.meta.env.PROD) registerSW({ immediate: true });

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");
createRoot(root).render(
  <StrictMode>
    <AppProvider>
      <Shell />
    </AppProvider>
  </StrictMode>,
);
