import "./App.css";
import WindowControls from "./components/WindowControls";

function App() {
  return (
    <main className="flex h-screen w-screen items-center justify-center overflow-hidden bg-surface-app-bg p-9">
      <div className="h-full w-full bg-surface-card ring-4 ring-inset ring-border-hard" />

      <WindowControls />
    </main>
  );
}

export default App;