const fs = require("fs");
const path = require("path");
const withBackgroundAudio = require("./plugins/withBackgroundAudio");

const hasGoogleServices = fs.existsSync(
  path.join(__dirname, "google-services.json"),
);

/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  expo: {
    name: "meeting-note",
    slug: "meeting-note",
    owner: "trayanus",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "meetingnote",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
    },
    android: {
      package: "com.anonymous.meetingnote",
      ...(hasGoogleServices && { googleServicesFile: "./google-services.json" }),
      adaptiveIcon: {
        backgroundColor: "#E6F4FE",
        foregroundImage: "./assets/images/android-icon-foreground.png",
        backgroundImage: "./assets/images/android-icon-background.png",
        monochromeImage: "./assets/images/android-icon-monochrome.png",
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
    },
    web: { output: "static", favicon: "./assets/images/favicon.png" },
    plugins: [
      [
        "expo-build-properties",
        {
          android: {
            // Build x86_64 only to avoid react-native-reanimated linker errors on Windows (arm64-v8a fails).
            // Use ["x86_64", "arm64-v8a"] for production / real devices.
            buildArchs: ["x86_64"],
          },
        },
      ],
      "expo-router",
      [
        "expo-notifications",
        {
          icon: "./assets/images/icon.png",
          sounds: [],
          defaultChannel: "default",
        },
      ],
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff",
          dark: { backgroundColor: "#000000" },
        },
      ],
      [
        "expo-audio",
        {
          microphonePermission:
            "This app uses the microphone to record meetings. Recording continues when the app is in the background.",
          recordAudioAndroid: true,
        },
      ],
      [
        withBackgroundAudio,
        {
          microphonePermissionMessage:
            "This app uses the microphone to record meetings. Recording continues when the app is in the background.",
        },
      ],
    ],
    experiments: { typedRoutes: true, reactCompiler: true },
    extra: {
      eas: {
        projectId: "0f9e7f2c-ec09-4c29-9c40-54a0cc86ac05",
      },
    },
  },
};
