import { Suspense, lazy } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { SnackbarProvider } from "notistack";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { blue, green } from "@mui/material/colors";
import Fade from "@mui/material/Fade";

import HomePage from "./pages/HomePage";
import { StateProvider } from "./store";

import "./App.scss";

const GameScreen = lazy(() => import("./pages/GameScreen"));
const RoomLobbyPage = lazy(() => import("./pages/RoomLobbyPage"));
const ReplayScreen = lazy(() => import("./pages/ReplayScreen"));

const RouteFallback = () => (
  <div className="route-loading-fallback" role="status" aria-live="polite">
    Carregando ilha...
  </div>
);

const theme = createTheme({
  palette: {
    primary: {
      main: blue[900],
    },
    secondary: {
      main: green[900],
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <StateProvider>
        <SnackbarProvider
          classes={{ containerRoot: "snackbar-container" }}
          maxSnack={1}
          autoHideDuration={1000}
          TransitionComponent={Fade}
          TransitionProps={{ timeout: 100 }}
        >
          <Router>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/rooms/:roomCode" element={<RoomLobbyPage />} />
                <Route
                  path="/games/:gameId/states/:stateIndex"
                  element={<GameScreen replayMode={true} />}
                />
                <Route path="/replays/:gameId" element={<ReplayScreen />} />
                <Route
                  path="/games/:gameId"
                  element={<GameScreen replayMode={false} />}
                />
                <Route path="/" element={<HomePage />} />
              </Routes>
            </Suspense>
          </Router>
        </SnackbarProvider>
      </StateProvider>
    </ThemeProvider>
  );
}

export default App;
