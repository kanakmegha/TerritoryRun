# TerritoryRun 🏃

A cyberpunk-themed GPS territory control game, now available as both a web application and a React Native mobile application.

## 🚀 Getting Started (Mobile App)

The mobile application is built with Expo and React Native, utilizing `@rnmapbox/maps` for native mapping and H3 core indexing.

### Prerequisites for iOS (Mac only)
- Xcode installed from the Mac App Store
- CocoaPods (`sudo gem install cocoapods` if needed)
- An active backend server (`npm run server` in the root folder)

### 1. Configure the API
Ensure the mobile app connects to your local machine:
1. Find your machine's local IP (e.g., `192.168.0.x`).
2. Update `mobile/src/hooks/useGameStore.js` `API_URL` to match this IP. 
*(It is currently set to `http://192.168.0.106:5001` based on your last environment)*.

### 2. Build and Run the App
Because the app uses Mapbox (which includes custom native code), you **cannot** use the standard "Expo Go" app. You must build a custom development client:

```bash
cd mobile
npm install

# Build & Run on iOS Simulator (Requires Xcode)
npx expo run:ios

# Build & Run on Android Emulator (Requires Android Studio)
npx expo run:android
```

Once the app compiles and installs on your device/simulator, you can leave the Expo Metro bundler running (`npx expo start`) for fast refresh and UI updates.

---

## 💻 Web App (Legacy/Desktop)

1. Start the Node backend in one terminal: 
   ```bash
   npm run server
   ```
2. Start the Vite React app in another terminal:
   ```bash
   npm run dev
   ```
