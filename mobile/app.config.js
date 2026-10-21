module.exports = ({ config }) => {
  const googleMapsApiKey =
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  const androidConfig = {
    ...config.android,
  };

  // Only populate googleMaps.apiKey when a valid key is provided in the environment
  if (googleMapsApiKey) {
    androidConfig.config = {
      ...androidConfig.config,
      googleMaps: {
        apiKey: googleMapsApiKey,
      },
    };
  }

  return {
    ...config,
    android: androidConfig,
  };
};
