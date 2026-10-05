plugins {
    id("com.android.application")
}

android {
    namespace = "com.mytrade.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.mytrade.app"
        minSdk = 29          // Android 10 and newer
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
    }

    // The owner's own app, installed from the GitHub release on the owner's phone: signed with the key in
    // ../keystore so each new build installs over the previous one. Not a store key; nothing secret is in the app.
    signingConfigs {
        create("personal") {
            storeFile = file("../keystore/my-trade.jks")
            storePassword = "mytrade-app"
            keyAlias = "mytrade"
            keyPassword = "mytrade-app"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("personal")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
