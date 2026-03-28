import "./App.css";
import { BrowserRouter as Router, Route, Routes, Navigate } from "react-router-dom";
import Main from "./components/main/Main";
import SplitPage from './components/splitpage/SplitPage';
import AuthPage from './components/auth/Auth';
import RequireAuth from './components/auth/RequireAuth';
import HistoryPage from './components/historypage/HistoryPage';

function App() {
  return (
    <>
      <Router>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/" element={
            <RequireAuth><Main /></RequireAuth>
          } />
          <Route path="/split" element={
            <RequireAuth><SplitPage /></RequireAuth>
          } />
          <Route path="/history" element={
            <RequireAuth><HistoryPage /></RequireAuth>
          } />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </>
  );
}

export default App;