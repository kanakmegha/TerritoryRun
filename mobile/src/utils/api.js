import axios from "axios";
import { NativeModules, Platform } from "react-native";
import Constants from "expo-constants";

// Robustly determine the development host IP for physical devices and emulators
const getLocalIP = () => {
  try {
    // 1. Primary: ScriptURL from which Metro bundle was downloaded
    // On physical Android devices in Expo Go, this always points to the host machine LAN IP
    const scriptURL = NativeModules.SourceCode?.scriptURL;
    if (scriptURL) {
      const match = scriptURL.match(/^https?:\/\/([^:/]+)/);
      if (match && match[1] && match[1] !== 'localhost' && match[1] !== '127.0.0.1') {
        return match[1];
      }
    }

    // 2. Constants.expoConfig.hostUri (SDK 54 development via @expo/cli)
    const hostUri = Constants.expoConfig?.hostUri;
    if (hostUri) {
      const ip = hostUri.split(":")[0];
      if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
        return ip;
      }
    }

    // 3. Constants.expoGoConfig.debuggerHost (Expo Go specific)
    const debuggerHost = Constants.expoGoConfig?.debuggerHost || Constants.manifest2?.extra?.expoGo?.debuggerHost;
    if (debuggerHost) {
      const ip = debuggerHost.split(":")[0];
      if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
        return ip;
      }
    }

    // 4. Constants.experienceUrl
    const experienceUrl = Constants.experienceUrl;
    if (experienceUrl) {
      const match = experienceUrl.match(/^[a-zA-Z]+:\/\/([^:/]+)/);
      if (match && match[1] && match[1] !== 'localhost' && match[1] !== '127.0.0.1') {
        return match[1];
      }
    }

    // 5. Android Emulator loopback
    if (Platform.OS === 'android') {
      return '10.0.2.2';
    }

    return "localhost";
  } catch (e) {
    console.warn("[API] Error determining host IP:", e?.message || e);
    return Platform.OS === 'android' ? '10.0.2.2' : "localhost";
  }
};

const LOCAL_IP = getLocalIP();
const PORT = 5001;

const getBaseURL = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  if (__DEV__) {
    console.log(`[API] Detected host IP: ${LOCAL_IP}, BaseURL: http://${LOCAL_IP}:${PORT}`);
    return `http://${LOCAL_IP}:${PORT}`;
  }
  return "https://your-production-url.com";
};

const api = axios.create({
  baseURL: getBaseURL(),
  timeout: 10000,
  headers: {
    "Accept": "application/json",
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const headers = config.headers;
  const hasAuth = headers && typeof headers.has === 'function'
    ? headers.has('authorization')
    : Boolean(headers?.authorization || headers?.Authorization);
  console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, {
    hasAuthorization: Boolean(hasAuth),
  });
  return config;
}, (error) => {
  return Promise.reject(error);
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.warn(`[API Error] ${error.config?.method?.toUpperCase()} ${error.config?.url}:`, {
      message: error.message,
      code: error.code,
      status: error.response?.status,
    });
    return Promise.reject(error);
  }
);

export default api;
