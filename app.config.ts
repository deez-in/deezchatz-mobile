import type { ExpoConfig } from "expo/config";
import type { ConfigPlugin } from "expo/config-plugins";
import { withAndroidManifest } from "expo/config-plugins";

const withOptionalHardwareFeatures: ConfigPlugin = (config) => {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    if (!manifest["uses-feature"]) {
      manifest["uses-feature"] = [];
    }

    const optionalFeatures = [
      "android.hardware.camera",
      "android.hardware.camera.autofocus",
      "android.hardware.camera.front",
      "android.hardware.microphone",
    ];

    for (const featureName of optionalFeatures) {
      const existing = manifest["uses-feature"].find(
        (f: any) => f.$["android:name"] === featureName
      );

      if (existing) {
        existing.$["android:required"] = "false";
      } else {
        manifest["uses-feature"].push({
          $: {
            "android:name": featureName,
            "android:required": "false",
          },
        });
      }
    }

    return config;
  });
};


const config: ExpoConfig = {
  name: "DeezChatz",
  slug: "deezchatz",
  version: "0.8.3",
  orientation: "portrait",
  icon: "./src/assets/images/android-icon-foreground.png",
  scheme: "deezchatz",
  userInterfaceStyle: "automatic",
  ios: {
    icon: "./src/assets/images/icon.icon",
    supportsTablet: true,
    bundleIdentifier: "in.deez.chatz",
    infoPlist: {
      UIBackgroundModes: ["remote-notification"],
      UIFileSharingEnabled: true,
      LSSupportsOpeningDocumentsInPlace: true,
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
    versionCode: 11,
    googleServicesFile: "./google-services.json",
    blockedPermissions: [
      "android.permission.SYSTEM_ALERT_WINDOW",
      "android.permission.WRITE_CONTACTS",
    ],
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
        icon: "./src/assets/images/android-icon-foreground.png",
        color: "#FFCC00",
        androidMode: "default",
      },
    ],
    [
      "expo-contacts",
      {
        contactsPermission:
          "DeezChatz accesses your contacts on-device to help you find and start conversations with friends. Your contacts are never uploaded in bulk or stored on our servers.",
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
    [
      "expo-audio-opus",
      {
        microphonePermission:
          "DeezChatz needs access to your microphone to record voice messages.",
      },
    ],
    withOptionalHardwareFeatures,
    [
      "expo-build-properties",
      {
        android: {
          enableProguardInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
          extraProguardRules: `
            # Keep your app classes
            -keep class in.deez.chatz.** { *; }
            
            # React Native essentials
            -keep class com.facebook.react.** { *; }
            -keep class com.facebook.hermes.** { *; }
            
            # Preserve debugging info
            -keepattributes SourceFile,LineNumberTable
            -keepattributes *Annotation*
            
            # 3rd party libs
            -dontwarn io.netty.**
            -dontwarn com.hivemq.client.**
            -dontwarn org.jctools.**
            -dontwarn org.slf4j.**
            -dontwarn org.eclipse.jetty.**
            -dontwarn reactor.blockhound.**
            
            # HiveMQ and Netty requirements
            -keep class io.netty.** { *; }
            -keep class org.jctools.** { *; }
            -keep class com.hivemq.client.** { *; }
            
            # Keep Native MQTT module classes
            -keep class expo.modules.nativemqtt.** { *; }
            
            # Keep Notifications and TaskManager for Background Tasks
            -keep class expo.modules.notifications.** { *; }
            -keep class expo.modules.taskManager.** { *; }
          `,
        },
      },
    ],
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
