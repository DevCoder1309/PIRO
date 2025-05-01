import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./Dashboard";
import Details from "./Details";
import Terminal from "./Terminal";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/details" element={<Details />} />
        <Route path="/terminal/:containerId" element={<Terminal />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
