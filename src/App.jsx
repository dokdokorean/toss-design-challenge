import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import CreateMeeting from './pages/CreateMeeting';
import MeetingDetails from './pages/[key]';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<CreateMeeting />} />
        <Route path="/:key" element={<MeetingDetails />} />
      </Routes>
    </Router>
  );
}

export default App;
