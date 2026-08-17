import { Switch, Route, useLocation } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Navbar from "./components/Navbar";
import HoverSidebar from "./components/HoverSidebar";
import { LayoutPreferencesProvider, useLayoutPreferences } from "./context/LayoutPreferencesContext";
import Home from "./pages/Home";
import Collections from "./pages/Collections";
import CollectionDetails from "./pages/CollectionDetails";
import NftDetails from "./pages/NftDetails";
import Profile from "./pages/Profile";
import Create from "./pages/Create";
import NotFound from "./pages/NotFound";
import Settings from "./pages/Settings";
import Welcome from "./pages/welcome";
import Activity from "./pages/activity";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/collections" component={Collections} />
      <Route path="/collections/:slug" component={CollectionDetails} />
      <Route path="/nfts/:collectionId/:tokenId" component={NftDetails} />
      <Route path="/profile" component={Profile} />
      <Route path="/profile/:address" component={Profile} />
      <Route path="/create" component={Create} />
      <Route path="/settings" component={Settings} />
      <Route path="/welcome" component={Welcome}/>
      <Route path="/activity" component={Activity}/>
      <Route component={NotFound} />
    </Switch>
  );
}

function AppShell() {
  const [location] = useLocation();
  const { sidebarPosition } = useLayoutPreferences();
  const hideLayout = location === "/welcome";

  return (
    <div className={!hideLayout ? "min-h-screen bg-background text-foreground" : ""}>
      {!hideLayout && <Navbar />}
      {!hideLayout && <HoverSidebar />}
      <main
        className={!hideLayout ? "pt-16" : ""}
        style={!hideLayout ? { [sidebarPosition === "left" ? "paddingLeft" : "paddingRight"]: "4rem" } : undefined}
      >
        <Router />
      </main>
    </div>
  );
}

function App() {
  return (
    <LayoutPreferencesProvider>
      <TooltipProvider>
        <AppShell />
        <Toaster />
      </TooltipProvider>
    </LayoutPreferencesProvider>
  );
}

export default App;