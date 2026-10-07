import java.util.Base64

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
}

android {
    namespace = "com.qun.messenger"
    compileSdk = 36
    defaultConfig {
        applicationId = "com.qun.messenger"
        minSdk = 26
        targetSdk = 36
        versionCode = 8
        versionName = "0.8.0"
    }

    signingConfigs {
        create("release") {
            val storeFilePath = System.getenv("QUN_KEYSTORE_PATH")
            if (!storeFilePath.isNullOrBlank()) {
                storeFile = file(storeFilePath)
                storePassword = System.getenv("QUN_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("QUN_KEY_ALIAS")
                keyPassword = System.getenv("QUN_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("release")
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
    implementation("io.ktor:ktor-client-android:3.3.1")
    implementation("io.ktor:ktor-client-content-negotiation:3.3.1")
    implementation("io.ktor:ktor-serialization-kotlinx-json:3.3.1")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.9.0")
    debugImplementation("androidx.compose.ui:ui-tooling:1.9.2")
}

tasks.register("normalizeQunSource") {
    doLast {
        val p = file("src/main/java/com/qun/messenger/MainActivity.kt")
        var s = p.readText()
        val obsolete = String(Base64.getDecoder().decode("CiAgICBzdXNwZW5kIGZ1biBhZG1pbk1lc3NhZ2VzKGNvZGU6IFN0cmluZywgbmFtZTogU3RyaW5nKTogTGlzdDxBZG1pbk1lc3NhZ2U+IHsKICAgICAgICB2YWwgcmF3ID0gYWRtaW5SZXF1ZXN0KCJtZXNzYWdlcyIsIGNvZGUsIG5hbWUpCiAgICAgICAgcmV0dXJuIGpzb24uZGVjb2RlRnJvbVN0cmluZzxNYXA8U3RyaW5nLCBMaXN0PEFkbWluTWVzc2FnZT4+PihyYXcpWyJtZXNzYWdlcyJdID86IGVtcHR5TGlzdCgpCiAgICB9CgogICAgc3VzcGVuZCBmdW4gYWRtaW5TZW5kKGNvZGU6IFN0cmluZywgbmFtZTogU3RyaW5nLCBib2R5OiBTdHJpbmcpIHsKICAgICAgICBhZG1pblJlcXVlc3QoInNlbmQiLCBjb2RlLCBuYW1lLCBib2R5KQogICAgfQo="), Charsets.UTF_8)
        s = s.replace(obsolete, "")
        if (!s.contains("import kotlinx.serialization.json.jsonObject")) {
            s = s.replace(
                "import kotlinx.serialization.json.Json\n",
                "import kotlinx.serialization.json.Json\nimport kotlinx.serialization.json.jsonObject\n"
            )
        }
        p.writeText(s)
    }
}

tasks.configureEach {
    if (name == "assembleRelease") dependsOn("normalizeQunSource")
}
