import React from "react";
import { Provider } from "./components/ui/provider";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles.css";
import "./unified-polish.css";
import "./design-system.css";
ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><Provider><BrowserRouter><App /></BrowserRouter></Provider></React.StrictMode>);
