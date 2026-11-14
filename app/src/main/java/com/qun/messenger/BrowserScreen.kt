package com.qun.messenger

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Bitmap
import android.net.Uri
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import kotlinx.coroutines.suspendCancellableCoroutine
import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener
import java.net.HttpURLConnection
import java.net.URL
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import kotlin.coroutines.resume

private const val AGENT_ENDPOINT = "https://qdxjltqlnphvzafapncm.supabase.co/functions/v1/qun-agent-core"
private const val AGENT_API_KEY = "sb_publishable_aCUwbGYj_kUU8nVUu1kWmQ_-d8-8fpL8"
private const val MOBILE_DEVICE_ID = "qun-android-main"
private const val TOKEN_ALIAS = "qun_mobile_agent_aes"

private fun tokenKey(): SecretKey {
    val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    (store.getKey(TOKEN_ALIAS, null) as? SecretKey)?.let { return it }
    val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
    generator.init(
        KeyGenParameterSpec.Builder(
            TOKEN_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        ).setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setRandomizedEncryptionRequired(true)
            .build()
    )
    return generator.generateKey()
}

private fun saveAgentToken(context: Context, token: String) {
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.ENCRYPT_MODE, tokenKey())
    val encrypted = cipher.doFinal(token.toByteArray(Charsets.UTF_8))
    val packed = cipher.iv + encrypted
    context.getSharedPreferences("qun_agent_secure", Context.MODE_PRIVATE).edit()
        .putString("token", Base64.encodeToString(packed, Base64.NO_WRAP)).apply()
}

private fun loadAgentToken(context: Context): String? = runCatching {
    val packed = Base64.decode(
        context.getSharedPreferences("qun_agent_secure", Context.MODE_PRIVATE).getString("token", null),
        Base64.NO_WRAP
    )
    require(packed.size > 12)
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.DECRYPT_MODE, tokenKey(), GCMParameterSpec(128, packed.copyOfRange(0, 12)))
    String(cipher.doFinal(packed.copyOfRange(12, packed.size)), Charsets.UTF_8)
}.getOrNull()

private fun clearAgentToken(context: Context) {
    context.getSharedPreferences("qun_agent_secure", Context.MODE_PRIVATE).edit().remove("token").apply()
}

private suspend fun agentPost(path: String, body: JSONObject, bearer: String): JSONObject =
    withContext(Dispatchers.IO) {
        val connection = (URL(AGENT_ENDPOINT + path).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 10000
            readTimeout = 15000
            doOutput = true
            setRequestProperty("apikey", AGENT_API_KEY)
            setRequestProperty("Authorization", "Bearer $bearer")
            setRequestProperty("Content-Type", "application/json; charset=utf-8")
            setRequestProperty("Cache-Control", "no-store")
        }
        try {
            connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            val stream = if (connection.responseCode in 200..299) connection.inputStream else connection.errorStream
            val response = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
            val parsed = runCatching { JSONObject(response) }.getOrElse { JSONObject().put("error", response.ifBlank { "HTTP ${connection.responseCode}" }) }
            if (connection.responseCode !in 200..299) {
                throw IllegalStateException(parsed.optString("error").ifBlank { "HTTP ${connection.responseCode}" })
            }
            parsed
        } finally {
            connection.disconnect()
        }
    }

private suspend fun WebView.evalText(script: String): String =
    suspendCancellableCoroutine { continuation ->
        evaluateJavascript(script) { raw ->
            if (continuation.isActive) {
                val value = runCatching { JSONTokener(raw ?: "null").nextValue() }.getOrNull()
                continuation.resume(value?.toString() ?: "")
            }
        }
    }

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun BrowserScreen(sessionToken: String, onBack: () -> Unit) {
    val context = androidx.compose.ui.platform.LocalContext.current
    var address by remember { mutableStateOf("https://www.avito.ru/") }
    var pageTitle by remember { mutableStateOf("QUN Браузер") }
    var loading by remember { mutableStateOf(false) }
    var webView by remember { mutableStateOf<WebView?>(null) }
    var canGoBack by remember { mutableStateOf(false) }
    var agentToken by remember { mutableStateOf(loadAgentToken(context)) }
    var agentStatus by remember { mutableStateOf(if (agentToken != null) "Подключение…" else "ИИ-управление не подключено") }
    var agentBusy by remember { mutableStateOf(false) }
    var agentError by remember { mutableStateOf<String?>(null) }
    var tabs by remember { mutableStateOf(listOf("https://www.avito.ru/")) }
    var activeTab by remember { mutableIntStateOf(0) }
    val scope = rememberCoroutineScope()

    fun openUrl(raw: String) {
        val input = raw.trim()
        if (input.isBlank()) return
        val normalized = when {
            input.startsWith("https://") || input.startsWith("http://") -> input
            input.contains(" ") || !input.contains(".") -> "https://www.google.com/search?q=" + Uri.encode(input)
            else -> "https://$input"
        }
        address = normalized
        tabs = tabs.toMutableList().also { if (activeTab < it.size) it[activeTab] = normalized else it.add(normalized) }
        webView?.loadUrl(normalized)
    }

    suspend fun readPage(): String {
        val script = "(function(){return document.body ? document.body.innerText.slice(0,12000) : '';})()"
        return webView?.evalText(script) ?: "Браузер ещё не готов."
    }

    suspend fun executePlan(steps: JSONArray): JSONObject {
        val results = JSONArray()
        for (i in 0 until steps.length()) {
            val step = steps.getJSONObject(i)
            when (step.optString("action")) {
                "navigate" -> {
                    val url = step.getString("url")
                    withContext(Dispatchers.Main) { openUrl(url) }
                    delay(1200)
                    results.put(JSONObject().put("action", "navigate").put("url", url).put("ok", true))
                }
                "read_page" -> results.put(JSONObject().put("action", "read_page").put("text", readPage()))
                "wait" -> {
                    delay(step.optLong("ms", 0).coerceIn(0, 3000))
                    results.put(JSONObject().put("action", "wait").put("ok", true))
                }
                "scroll" -> {
                    val y = step.optInt("y", 0).coerceIn(-2000, 2000)
                    val outcome = webView?.evalText("window.scrollBy(0,$y); 'scrolled'") ?: "no_webview"
                    results.put(JSONObject().put("action", "scroll").put("result", outcome))
                }
                "click" -> {
                    val selector = JSONObject.quote(step.getString("selector"))
                    val script = "(function(){const e=document.querySelector($selector);if(!e)return 'not_found';if(e.matches('input[type=password],button[type=submit],input[type=submit]'))return 'blocked_sensitive';const t=(e.innerText||e.value||'').trim().toLowerCase();if(/publish|опубликовать|разместить|подтвердить заказ|оплатить/.test(t))return 'blocked_sensitive';e.click();return 'clicked';})()"
                    val outcome = webView?.evalText(script) ?: "no_webview"
                    results.put(JSONObject().put("action", "click").put("result", outcome))
                }
                "type" -> {
                    val selector = JSONObject.quote(step.getString("selector"))
                    val text = JSONObject.quote(step.getString("text"))
                    val script = "(function(){const e=document.querySelector($selector);if(!e)return 'not_found';if(e.matches('input[type=password]'))return 'blocked_password';e.focus();e.value=$text;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return 'typed';})()"
                    val outcome = webView?.evalText(script) ?: "no_webview"
                    results.put(JSONObject().put("action", "type").put("result", outcome))
                }
                else -> results.put(JSONObject().put("action", step.optString("action")).put("error", "Unsupported action"))
            }
        }
        return JSONObject().put("steps", results).put("pageText", readPage()).put("url", address)
    }

    suspend fun handleCommand(command: JSONObject): JSONObject {
        val action = command.optString("action")
        val args = command.optJSONObject("args") ?: JSONObject()
        return when (action) {
            "browser.list_tabs" -> JSONObject().put("tabs", JSONArray(tabs)).put("activeTab", activeTab).put("activeUrl", address).put("title", pageTitle)
            "browser.read_active_page" -> JSONObject().put("url", address).put("title", pageTitle).put("text", readPage())
            "browser.open_url" -> {
                val url = args.optString("url")
                withContext(Dispatchers.Main) { openUrl(url) }
                delay(1200)
                JSONObject().put("url", address).put("title", pageTitle).put("opened", true).put("text", readPage())
            }
            "browser.execute_plan" -> executePlan(args.optJSONArray("steps") ?: JSONArray())
            else -> throw IllegalArgumentException("Неизвестная команда браузера: $action")
        }
    }

    LaunchedEffect(agentToken) {
        val token = agentToken ?: return@LaunchedEffect
        var ticks = 0
        while (agentToken == token) {
            try {
                if (ticks % 10 == 0) {
                    agentPost("/pult/heartbeat", JSONObject().put("deviceId", MOBILE_DEVICE_ID), token)
                    agentStatus = "ИИ-управление подключено"
                }
                val peek = agentPost("/pult/peek", JSONObject().put("deviceId", MOBILE_DEVICE_ID), token)
                val queued = peek.optJSONObject("command")
                if (queued != null && queued.optString("status") == "queued") {
                    val commandId = queued.optString("command_id")
                    val claim = agentPost("/pult/claim", JSONObject().put("deviceId", MOBILE_DEVICE_ID).put("commandId", commandId), token)
                    val command = claim.optJSONObject("command")
                    if (command != null) {
                        try {
                            val result = handleCommand(command)
                            agentPost("/pult/result", JSONObject().put("deviceId", MOBILE_DEVICE_ID).put("commandId", commandId).put("status", "succeeded").put("result", result), token)
                        } catch (e: Exception) {
                            agentPost("/pult/result", JSONObject().put("deviceId", MOBILE_DEVICE_ID).put("commandId", commandId).put("status", "failed").put("error", e.message ?: "Browser action failed"), token)
                        }
                    }
                }
                ticks++
                delay(1500)
            } catch (e: Exception) {
                agentStatus = "Связь: ${e.message ?: "ошибка"}"
                delay(3000)
            }
        }
    }

    BackHandler(enabled = true) {
        if (canGoBack) webView?.goBack() else onBack()
    }

    Column(Modifier.fillMaxSize().background(Color(0xFFF6F8F7))) {
        Row(Modifier.fillMaxWidth().background(Color(0xFF082A45)).padding(horizontal = 6.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            TextButton(onClick = onBack) { Text("‹ QUN", color = Color.White) }
            Text("Браузер", color = Color.White, fontSize = 17.sp, modifier = Modifier.weight(1f))
            TextButton(onClick = {
                tabs = tabs + "https://www.google.com"
                activeTab = tabs.lastIndex
                address = tabs[activeTab]
                webView?.loadUrl(address)
            }) { Text("+ вкладка", color = Color.White, fontSize = 12.sp) }
        }
        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 8.dp)) {
            tabs.forEachIndexed { index, url ->
                TextButton(onClick = {
                    activeTab = index
                    address = url
                    webView?.loadUrl(url)
                }) { Text(if (index == activeTab) "● ${index + 1}" else "${index + 1}", color = if (index == activeTab) Emerald else Color.Gray) }
            }
        }
        Row(Modifier.fillMaxWidth().padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(value = address, onValueChange = { address = it }, modifier = Modifier.weight(1f), singleLine = true, shape = RoundedCornerShape(12.dp), placeholder = { Text("Адрес сайта или поиск") })
            Spacer(Modifier.width(5.dp))
            Button(onClick = { openUrl(address) }, colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF087A63)), contentPadding = PaddingValues(horizontal = 12.dp, vertical = 14.dp)) { Text("Открыть") }
        }
        Row(Modifier.fillMaxWidth().padding(horizontal = 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            OutlinedButton(onClick = { webView?.goBack() }, enabled = canGoBack) { Text("←") }
            OutlinedButton(onClick = { webView?.goForward() }) { Text("→") }
            OutlinedButton(onClick = { webView?.reload() }) { Text("↻") }
            Button(onClick = { openUrl("https://www.avito.ru/") }, colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF082A45))) { Text("Авито") }
        }
        Card(Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 4.dp), colors = CardDefaults.cardColors(containerColor = Color.White)) {
            Column(Modifier.fillMaxWidth().padding(10.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("QUN Agent", color = Color(0xFF082A45), fontSize = 14.sp)
                        Text(agentStatus, color = if (agentToken != null) Emerald else Color.Gray, fontSize = 11.sp)
                    }
                    if (agentBusy) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                    else TextButton(onClick = {
                        scope.launch {
                            agentBusy = true
                            agentError = null
                            try {
                                if (agentToken == null) {
                                    val pairing = agentPost("/pult/create-pairing", JSONObject(), sessionToken)
                                    val code = pairing.getString("pairingCode")
                                    val paired = agentPost("/pult/pair", JSONObject()
                                        .put("pairingCode", code)
                                        .put("deviceId", MOBILE_DEVICE_ID)
                                        .put("name", "QUN Android Browser")
                                        .put("platform", "android")
                                        .put("version", "0.18.0"), sessionToken)
                                    val newToken = paired.getString("deviceToken")
                                    saveAgentToken(context, newToken)
                                    agentToken = newToken
                                    agentStatus = "ИИ-управление подключено"
                                } else {
                                    runCatching { agentPost("/pult/disconnect", JSONObject().put("deviceId", MOBILE_DEVICE_ID), agentToken!!) }
                                    clearAgentToken(context)
                                    agentToken = null
                                    agentStatus = "ИИ-управление отключено"
                                }
                            } catch (e: Exception) {
                                agentError = e.message ?: "Не удалось подключить агента"
                            } finally {
                                agentBusy = false
                            }
                        }
                    }) { Text(if (agentToken == null) "Подключить" else "Отключить", color = Emerald) }
                }
                agentError?.let { Text(it, color = MaterialTheme.colorScheme.error, fontSize = 11.sp) }
                Text("Команды выполняются в открытом браузере. Пароли не читаются; кнопки публикации и отправки заблокированы.", color = Color.Gray, fontSize = 10.sp)
            }
        }
        if (loading) LinearProgressIndicator(Modifier.fillMaxWidth(), color = Color(0xFF087A63))
        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { ctx ->
                WebView(ctx).apply {
                    settings.javaScriptEnabled = true
                    settings.domStorageEnabled = true
                    settings.loadsImagesAutomatically = true
                    settings.setSupportMultipleWindows(false)
                    webViewClient = object : WebViewClient() {
                        override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                            loading = true
                            if (!url.isNullOrBlank()) address = url
                            canGoBack = view?.canGoBack() == true
                        }
                        override fun onPageFinished(view: WebView?, url: String?) {
                            loading = false
                            if (!url.isNullOrBlank()) address = url
                            canGoBack = view?.canGoBack() == true
                            if (url != null && activeTab < tabs.size && tabs[activeTab] != url) tabs = tabs.toMutableList().also { it[activeTab] = url }
                        }
                        override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean = false
                    }
                    webChromeClient = object : WebChromeClient() {
                        override fun onReceivedTitle(view: WebView?, title: String?) { pageTitle = title ?: "QUN Браузер" }
                    }
                    webView = this
                    loadUrl(tabs.getOrElse(activeTab) { "https://www.avito.ru/" })
                }
            },
            update = { webView = it }
        )
    }
}
