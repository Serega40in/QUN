package org.qun.node

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

data class QunUpdateInfo(val version: String, val url: String, val sha256: String)

object UpdateManager {
    private const val RELEASES_API = "https://api.github.com/repos/Serega40in/QUN/releases/latest"
    private const val APK_NAME = "QUN-Node-Android.apk"

    fun checkForUpdate(context: Context): QunUpdateInfo? {
        val connection = (URL(RELEASES_API).openConnection() as HttpURLConnection).apply {
            connectTimeout = 10000
            readTimeout = 10000
            setRequestProperty("Accept", "application/vnd.github+json")
            setRequestProperty("User-Agent", "QUN-Node-Android")
            setRequestProperty("X-GitHub-Api-Version", "2022-11-28")
        }
        try {
            if (connection.responseCode !in 200..299) throw IllegalStateException("GitHub HTTP ${connection.responseCode}")
            val release = JSONObject(connection.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() })
            val tag = release.optString("tag_name")
            val version = Regex("([0-9]+\\.[0-9]+\\.[0-9]+)").find(tag)?.value
                ?: throw IllegalStateException("Версия в теге релиза не распознана")
            val currentName = context.packageManager.getPackageInfo(context.packageName, 0).versionName ?: "0.0.0"
            if (compareVersions(version, currentName) <= 0) return null
            val assets = release.optJSONArray("assets") ?: return null
            for (i in 0 until assets.length()) {
                val asset = assets.getJSONObject(i)
                if (asset.optString("name") == APK_NAME) {
                    val digest = asset.optString("digest").removePrefix("sha256:")
                    if (!digest.matches(Regex("[a-fA-F0-9]{64}"))) throw IllegalStateException("У релиза нет SHA-256 для APK")
                    return QunUpdateInfo(version, asset.getString("browser_download_url"), digest.lowercase())
                }
            }
            return null
        } finally {
            connection.disconnect()
        }
    }

    fun downloadAndPromptInstall(context: Context, update: QunUpdateInfo) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !context.packageManager.canRequestPackageInstalls()) {
            val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${context.packageName}"))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
            throw IllegalStateException("Разреши установку обновлений для QUN Node в настройках Android, затем нажми «Установить обновление» ещё раз.")
        }
        val connection = (URL(update.url).openConnection() as HttpURLConnection).apply {
            connectTimeout = 15000
            readTimeout = 30000
            instanceFollowRedirects = true
            setRequestProperty("User-Agent", "QUN-Node-Android")
        }
        try {
            if (connection.responseCode !in 200..299) throw IllegalStateException("Не удалось скачать APK: HTTP ${connection.responseCode}")
            val dir = File(context.cacheDir, "updates").apply { mkdirs() }
            val apk = File(dir, APK_NAME)
            connection.inputStream.use { input -> apk.outputStream().use { output -> input.copyTo(output) } }
            val actual = MessageDigest.getInstance("SHA-256").digest(apk.readBytes()).joinToString("") { "%02x".format(it) }
            if (actual != update.sha256) {
                apk.delete()
                throw IllegalStateException("SHA-256 APK не совпал. Установка отменена.")
            }
            val uri = FileProvider.getUriForFile(context, context.packageName + ".fileprovider", apk)
            val intent = Intent(Intent.ACTION_VIEW)
                .setDataAndType(uri, "application/vnd.android.package-archive")
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION)
            context.startActivity(intent)
        } finally {
            connection.disconnect()
        }
    }

    private fun compareVersions(left: String, right: String): Int {
        val a = left.split(".").map { it.toIntOrNull() ?: 0 }
        val b = right.split(".").map { it.toIntOrNull() ?: 0 }
        for (i in 0 until maxOf(a.size, b.size)) {
            val av = a.getOrElse(i) { 0 }
            val bv = b.getOrElse(i) { 0 }
            if (av != bv) return av.compareTo(bv)
        }
        return 0
    }
}
