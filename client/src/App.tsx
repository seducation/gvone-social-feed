import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Chat from "./pages/Chat";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import StoryPulse from "./pages/StoryPulse";
import ProviderCommunity from "./pages/ProviderCommunity";
import CommunityDirectory from "./pages/CommunityDirectory";
import UserPage from "./pages/UserPage";
import Topics from "./pages/Topics";
import TopicCommunity from "./pages/TopicCommunity";
import { StoryPulseFeedActions } from "./components/StoryPulseFeedActions";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/chat"} component={Chat} />
      <Route path={"/profile"} component={Profile} />
      <Route path={"/pulse/:id"} component={StoryPulse} />
      <Route path={"/community/:providerHostname"} component={ProviderCommunity} />
      <Route path={"/communities"} component={CommunityDirectory} />
      <Route path={"/topics"} component={Topics} />
      <Route path={"/topics/:slug"} component={TopicCommunity} />
      <Route path={"/u/:username"} component={UserPage} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <StoryPulseFeedActions />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
