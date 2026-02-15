const { withInfoPlist, withAndroidManifest } = require("expo/config-plugins");

/**
 * Custom Expo config plugin for background audio recording.
 * Configures native projects so recording continues when app is backgrounded or screen is locked.
 *
 * iOS:
 * - UIBackgroundModes → 'audio' in Info.plist
 * - NSMicrophoneUsageDescription for microphone permission
 * - AVAudioSession category is set at runtime via expo-audio setAudioModeAsync
 *
 * Android:
 * - RECORD_AUDIO and FOREGROUND_SERVICE permissions
 * - Foreground service type for microphone (Android 14+)
 * - Notification channel for foreground service (id: recording)
 */
function withBackgroundAudio(config, props = {}) {
  const {
    microphonePermissionMessage = "This app uses the microphone to record meetings.",
  } = props;

  // --- iOS ---
  // config = withInfoPlist(config, (c) => {
  //   const plist = c.modResults;

  //   // Required for background audio recording on iOS
  //   if (!plist.UIBackgroundModes) {
  //     plist.UIBackgroundModes = [];
  //   }
  //   if (!plist.UIBackgroundModes.includes("audio")) {
  //     plist.UIBackgroundModes.push("audio");
  //   }

  //   // Required for microphone access (App Store requirement)
  //   plist.NSMicrophoneUsageDescription =
  //     plist.NSMicrophoneUsageDescription || microphonePermissionMessage;

  //   return c;
  // });

  // --- Android ---
  config = withAndroidManifest(config, (c) => {
    const manifestRoot = c.modResults.manifest;
    if (!manifestRoot) return c;

    // <uses-permission> must be direct children of <manifest>, not <application>
    const permissions = manifestRoot["uses-permission"] || [];
    const permissionKeys = permissions.map((p) => p.$?.["android:name"]);

    const requiredPermissions = [
      "android.permission.RECORD_AUDIO",
      "android.permission.FOREGROUND_SERVICE",
      "android.permission.FOREGROUND_SERVICE_MICROPHONE",
      "android.permission.POST_NOTIFICATIONS",
    ];

    for (const perm of requiredPermissions) {
      if (!permissionKeys.includes(perm)) {
        permissions.push({ $: { "android:name": perm } });
      }
    }
    manifestRoot["uses-permission"] = permissions;

    return c;
  });

  return config;
}

module.exports = withBackgroundAudio;
