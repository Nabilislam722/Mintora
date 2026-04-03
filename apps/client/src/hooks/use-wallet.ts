import { useState, useEffect, useCallback } from 'react';
import { BrowserProvider, formatEther } from 'ethers';

interface WalletState {
  address: string | null;
  balance: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
}

export function useWallet() {
  const [wallet, setWallet] = useState<WalletState>({
    address: null,
    balance: null,
    isConnected: false,
    isConnecting: true, // Start true to check localStorage
    error: null,
  });

  const updateWalletState = useCallback(async (provider: BrowserProvider, address: string) => {
    try {
      const balance = await provider.getBalance(address);
      setWallet({
        address,
        balance: formatEther(balance),
        isConnected: true,
        isConnecting: false,
        error: null,
      });
      localStorage.setItem('walletConnected', 'true');
    } catch (err) {
      console.error("Error fetching balance:", err);
      setWallet(prev => ({ ...prev, isConnecting: false, error: "Failed to fetch balance" }));
    }
  }, []);

  const connect = async () => {
    if (!window.ethereum) {
      setWallet(prev => ({ ...prev, error: "MetaMask not installed" }));
      return;
    }

    setWallet(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      const provider = new BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      
      if (accounts.length > 0) {
        await updateWalletState(provider, accounts[0]);
      } else {
        setWallet(prev => ({ ...prev, isConnecting: false, error: "No accounts found" }));
      }
    } catch (err: any) {
      setWallet(prev => ({ ...prev, isConnecting: false, error: err.message || "Failed to connect" }));
    }
  };

  const disconnect = () => {
    setWallet({
      address: null,
      balance: null,
      isConnected: false,
      isConnecting: false,
      error: null,
    });
    localStorage.removeItem('walletConnected');
  };

  // Auto-connect if previously connected
  useEffect(() => {
    const checkConnection = async () => {
      const shouldConnect = localStorage.getItem('walletConnected') === 'true';
      if (shouldConnect && window.ethereum) {
        try {
          const provider = new BrowserProvider(window.ethereum);
          const accounts = await provider.send("eth_accounts", []);
          if (accounts.length > 0) {
            await updateWalletState(provider, accounts[0]);
            return;
          }
        } catch (err) {
          console.error("Auto-connect failed:", err);
        }
      }
      setWallet(prev => ({ ...prev, isConnecting: false }));
    };

    checkConnection();

    // Listen for account changes
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts: string[]) => {
        if (accounts.length > 0) {
          const provider = new BrowserProvider(window.ethereum);
          updateWalletState(provider, accounts[0]);
        } else {
          disconnect();
        }
      });
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeAllListeners('accountsChanged');
      }
    };
  }, [updateWalletState]);

  return { ...wallet, connect, disconnect };
}
