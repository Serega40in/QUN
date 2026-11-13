package com.qun.messenger

import android.annotation.SuppressLint
import android.graphics.Bitmap
import android.net.Uri
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun BrowserScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    var address by remember { mutableStateOf("https://www.avito.ru/") }
    var pageTitle by remember { mutableStateOf("QUN Браузер") }
    var loading by remember { mutableStateOf(false) }
    var webView by remember { mutableStateOf<WebView?>(null) }
    var canGoBack by remember { mutableStateOf(false) }
    var tab by remember { mutableIntStateOf(0) }
    val tabs = remember { mutableStateListOf("https://www.avito.ru/") }

    fun openUrl(raw: String) {
        val input = raw.trim()
        if (input.isBlank()) return
        val normalized = when {
            input.startsWith("https://") || input.startsWith("http://") -> input
            input.contains(" ") || !input.contains(".") -> "https://www.google.com/search?q=" + Uri.encode(input)
            else -> "https://$input"
        }
        address = normalized
        if (tab < tabs.size) tabs[tab] = normalized else tabs.add(normalized)
        webView?.loadUrl(normalized)
    }

    BackHandler(enabled = canGoBack || true) {
        if (canGoBack) webView?.goBack() else onBack()
    }

    Column(Modifier.fillMaxSize().background(Color(0xFFF6F8F7))) {
        Row(Modifier.fillMaxWidth().background(Color(0xFF082A45)).padding(horizontal = 6.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            TextButton(onClick = onBack) { Text("‹ QUN", color = Color.White) }
            Text("Браузер", color = Color.White, fontSize = 17.sp, modifier = Modifier.weight(1f))
            TextButton(onClick = {
                tabs.add("https://www.google.com")
                tab = tabs.lastIndex
                address = tabs[tab]
                webView?.loadUrl(address)
            }) { Text("+ вкладка", color = Color.White, fontSize = 12.sp) }
        }
        Row(Modifier.fillMaxWidth().padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(
                value = address,
                onValueChange = { address = it },
                modifier = Modifier.weight(1f),
                singleLine = true,
                shape = RoundedCornerShape(12.dp),
                placeholder = { Text("Адрес сайта или поиск") }
            )
            Spacer(Modifier.width(5.dp))
            Button(onClick = { openUrl(address) }, colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF087A63)), contentPadding = PaddingValues(horizontal = 12.dp, vertical = 14.dp)) { Text("Открыть") }
        }
        Row(Modifier.fillMaxWidth().padding(horizontal = 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            OutlinedButton(onClick = { webView?.goBack() }, enabled = canGoBack) { Text("←") }
            OutlinedButton(onClick = { webView?.goForward() }) { Text("→") }
            OutlinedButton(onClick = { webView?.reload() }) { Text("↻") }
            Button(onClick = { openUrl("https://www.avito.ru/") }, colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF082A45))) { Text("Авито") }
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
                        }
                        override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean = false
                    }
                    webChromeClient = object : WebChromeClient() {
                        override fun onReceivedTitle(view: WebView?, title: String?) {
                            pageTitle = title ?: "QUN Браузер"
                        }
                    }
                    webView = this
                    loadUrl(tabs.getOrElse(tab) { "https://www.avito.ru/" })
                }
            },
            update = { webView = it }
        )
    }
}
