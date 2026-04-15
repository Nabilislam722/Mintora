import { Switch, Route, useLocation } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Navbar from "./components/Navbar";
import HoverSidebar from "./components/HoverSidebar";
import Home from "./pages/Home";
import Collections from "./pages/Collections";
import CollectionDetails from "./pages/CollectionDetails";
import NftDetails from "./pages/NftDetails";
import Profile from "./pages/Profile";
import Create from "./pages/Create";
import NotFound from "./pages/NotFound";
import Settings from "./pages/Settings";
import Welcome from "./pages/welcome";

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
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [location] = useLocation();

  const hideLayout = location === "/welcome";

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background text-foreground">

        {!hideLayout && <Navbar />}
        {!hideLayout && <HoverSidebar />}
        <main className={!hideLayout ? "pt-16" : ""}>
          <Router />
        </main>
      </div>
      <Toaster />
    </TooltipProvider>
  );
}

export default App;
