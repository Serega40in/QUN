package org.qun.node

import android.content.Context
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

object NodeRegistry {
    private const val ENDPOINT = "https://qdxjltqlnphvzafapncm.supabase.co/functions/v1/qun-node-registry"
    private const val API_KEY = "sb_publishable_aCUwbGYj_kUU8nVUu1kWmQ_-d-8fp8L"
    private const val PREFS = "qun_node_registry"

    fun registeredId(context: Context): String =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("node_id", null).orEmpty()

    fun register(context: Context, code: String, name: String): String {
        val response = post(JSONObject()
            .put("action", "register")
            .put("enrollmentCode", code.trim())
            .put("name", name.trim().take(80))
            .put("platform", "android"))
        val id = response.optString("nodeId")
        val token = response.optString("nodeToken")
        if (id.isBlank() || token.length != 64) throw IllegalStateException(response.optString("error", "Регистрация отклонена"))
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString("node_id", id)
            .putString("node_token", token)
            .putString("registered_at", response.optString("registeredAt"))
            .putString("node_name", name.trim().take(80))
            .apply()
        return id
    }

    fun heartbeat(context: Context): Boolean {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val id = prefs.getString("node_id", null) ?: return false
        val token = prefs.getString("node_token", null) ?: return false
        val response = post(JSONObject().put("action", "heartbeat").put("nodeId", id).put("nodeToken", token))
        return response.optBoolean("ok", false)
    }

    private fun post(body: JSONObject): JSONObject {
        val connection = (URL(ENDPOINT).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 10000
            readTimeout = 10000
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("apikey", API_KEY)
        }
        try {
            connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            val code = connection.responseCode
            val stream = if (code in 200..299) connection.inputStream else connection.errorStream
            val text = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            val json = if (text.isBlank()) JSONObject() else JSONObject(text)
            if (code !in 200..299) throw IllegalStateException(json.optString("error", "HTTP $code"))
            return json
        } finally {
            connection.disconnect()
        }
    }
}
