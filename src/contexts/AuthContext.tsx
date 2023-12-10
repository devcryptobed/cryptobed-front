"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useAccount, useDisconnect, useSignMessage } from "wagmi";
import { authenticate, getChallenge } from "@/services/auth";
import Cookies from "js-cookie";
import { getUserData } from "@/services/users";
import { useRouter } from "next/navigation";

interface AuthContextType {
  isAuth: boolean;
  isAuthenticating: boolean;
  error: any;
  logOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const router = useRouter();
  const [isAuth, setIsAuth] = useState<boolean>(false);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [error, setError] = useState<any>(null);

  const { address, isConnected, isConnecting } = useAccount();
  const { disconnectAsync } = useDisconnect();
  const { signMessageAsync } = useSignMessage();

  const auth = useCallback(async () => {
    try {
      const jwtToken = Cookies.get("jwt");

      if (jwtToken) {
        setIsAuthenticating(true);

        const res = await getUserData();
        const { username } = res.data;

        if (username !== address) {
          await logOut();
        }

        setIsAuth(true);
        router.refresh();
        return;
      }

      const { token } = await getChallenge(address);
      const signature = await signMessageAsync({
        message: "Your authentication token : " + token,
      });
      const { jwt } = await authenticate({
        signature,
        address,
      });

      Cookies.set("jwt", jwt);
      setIsAuth(true);
    } catch (error) {
      console.log(error);
      setError(error);
      await logOut();
    } finally {
      setIsAuthenticating(false);
      router.refresh();
    }
  }, [authenticate, getChallenge, signMessageAsync, address]);

  const logOut = async () => {
    disconnectAsync();
    Cookies.remove("jwt");
    setIsAuth(false);
    router.refresh();
  };

  useEffect(() => {
    if (!isConnected || !address || isConnecting) {
      return;
    }

    auth();
  }, [isConnected, address]);

  useEffect(() => {
    const jwt = Cookies.get("jwt");

    if (jwt && address) {
      auth();
      return;
    }

    logOut();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isAuth,
        isAuthenticating,
        error,
        logOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
