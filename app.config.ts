import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "DeezChatz",
  slug: "deezchatz",
  version: "0.5.0",
  orientation: "portrait",
  icon: "./src/assets/images/icon.icon",
  scheme: "deezchatz",
  userInterfaceStyle: "automatic",
  ios: {
    supportsTablet: true,
    bundleIdentifier: "in.deez.chatz",
    infoPlist: {
      UIBackgroundModes: ["remote-notification"],
    },
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./src/assets/images/android-icon-foreground.png",
      monochromeImage: "./src/assets/images/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: true,
    package: "in.deez.chatz",
    googleServicesFile: "./google-services.json",
  },
  web: {
    output: "static",
    favicon: "./src/assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    "expo-status-bar",
    [
      "expo-notifications",
      {
        icon: "./src/assets/images/icon.png",
        color: "#FFCC00",
        androidMode: "default",
      },
    ],
    [
      "expo-contacts",
      {
        contactsPermission: "Allow $(PRODUCT_NAME) to access your contacts.",
      },
    ],
    [
      "expo-secure-store",
      {
        configureAndroidBackup: true,
      },
    ],
    [
      "expo-splash-screen",
      {
        image: "./src/assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
        dark: {
          backgroundColor: "#000000",
        },
      },
    ],
    [
      "expo-sqlite",
      {
        useSQLCipher: true,
      },
    ],
    "expo-font",
    "expo-image",
    "expo-web-browser",
    [
      "expo-google-native-oauth",
      {
        androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? process.env.GOOGLE_ANDROID_CLIENT_ID ?? "",
        iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? process.env.GOOGLE_IOS_CLIENT_ID ?? "",
        webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? process.env.GOOGLE_WEB_CLIENT_ID ?? "",
      },
    ],
    "expo-native-mqtt",
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    router: {},
    eas: {
      projectId: "c7714ca8-54f2-4568-8335-6b88a9aaac52",
    },
  },
  owner: "deez-in",
};

export default config;
