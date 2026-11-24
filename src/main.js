import "./global.css";
import { mountApp } from "./app.js";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Failed to find root element with id 'root'");
}

mountApp(rootElement);
