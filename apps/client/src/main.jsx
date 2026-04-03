import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import App from "./App";
import "./index.css";
import { WagmiProvider, http } from "wagmi";
import { RainbowKitProvider, getDefaultConfig, darkTheme, lightTheme } from "@rainbow-me/rainbowkit";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { hemi } from "./lib/hemi"
import "@rainbow-me/rainbowkit/styles.css";
import { Web3Provider } from "./lib/web3";

const config = getDefaultConfig({
       appName: "Mintora",
       projectId: "656b7d9e9b85101192392ace313ecef8",
       chains: [hemi],
       transports: {
              [hemi.id]: http("https://rpc.hemi.network/rpc"),
       },
});
function RainbowWrapper({ children }) {
       const [theme, setTheme] = useState(
              localStorage.getItem("theme") || "dark"
       );

       useEffect(() => {
              const observer = new MutationObserver(() => {
                     const isDark = document.documentElement.classList.contains("dark");
                     setTheme(isDark ? "dark" : "light");
              });

              observer.observe(document.documentElement, {
                     attributes: true,
                     attributeFilter: ["class"],
              });

              return () => observer.disconnect();
       }, []);

       return (
              <RainbowKitProvider
                     theme={
                            theme === "dark"
                                   ? darkTheme({
                                          accentColor: "#0da14b",
                                          accentColorForeground: "white",
                                          borderRadius: "large",
                                          fontStack: "system",
                                   })
                                   : lightTheme({
                                          accentColor: "#0da14b",
                                          accentColorForeground: "white",
                                          borderRadius: "large",
                                          fontStack: "system",
                                   })
                     }
              >
                     {children}
              </RainbowKitProvider>
       );
}


createRoot(document.getElementById("root")).render(

       <WagmiProvider config={config}>
              <QueryClientProvider client={queryClient}>
                     <RainbowWrapper>
                            <Web3Provider>
                                   <App />
                            </Web3Provider>
                     </RainbowWrapper>
              </QueryClientProvider>
       </WagmiProvider>

);
