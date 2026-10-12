plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "org.qun.node"
    compileSdk = 36
    defaultConfig {
        applicationId = "org.qun.node"
        minSdk = 26
        targetSdk = 35
        versionCode = 3
        versionName = "0.3.0"
    }
    val releaseStorePath = System.getenv("QUN_ANDROID_KEYSTORE_PATH")
    if (!releaseStorePath.isNullOrBlank()) {
        signingConfigs.create("release") {
            storeFile = file(releaseStorePath)
            storePassword = System.getenv("QUN_ANDROID_KEYSTORE_PASSWORD")
            keyAlias = System.getenv("QUN_ANDROID_KEY_ALIAS")
            keyPassword = System.getenv("QUN_ANDROID_KEY_PASSWORD")
        }
    }
    buildTypes {
        getByName("debug")
        getByName("release") {
            isMinifyEnabled = false
            if (!releaseStorePath.isNullOrBlank()) signingConfig = signingConfigs.getByName("release")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
kotlin { jvmToolchain(17) }
dependencies {
    implementation("androidx.core:core-ktx:1.17.0")
    implementation("androidx.activity:activity-compose:1.11.0")
    implementation("androidx.compose.ui:ui:1.9.2")
    implementation("androidx.compose.ui:ui-tooling-preview:1.9.2")
    implementation("androidx.compose.material3:material3:1.3.2")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.9.4")
}
