package com.qun.messenger

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.engine.android.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import androidx.core.content.FileProvider
import java.io.File
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

private const val SUPABASE_URL = "https://qdxjltqlnphvzafapncm.supabase.co"
private const val SUPABASE_KEY = "sb_publishable_aCUwbGYj_kUU8nVUu1kWmQ_-d-8fp8L"

private val Navy = Color(0xFF082A45)
private val Emerald = Color(0xFF087A63)
private val Gold = Color(0xFFC6A15B)
private val Soft = Color(0xFFF6F8F7)

private val json = Json { ignoreUnknownKeys = true; explicitNulls = false }
private val http = HttpClient(Android) {
    install(ContentNegotiation) { json(json) }
}

@Serializable data class AuthUser(val id: String, val phone: String? = null)
@Serializable data class AuthSession(val access_token: String, val user: AuthUser)
@Serializable data class Profile(val id: String, val username: String? = null, val display_name: String = "")
@Serializable data class MemberRow(val conversation_id: String, val user_id: String)
@Serializable data class Message(val id: String, val conversation_id: String, val sender_id: String, val body: String, val created_at: String)
@Serializable data class AdminMessage(val id: String, val sender: String, val body: String, val created_at: String)
@Serializable data class UpdateInfo(val versionCode: Int, val versionName: String, val apkUrl: String, val notes: String = "")

private class QunApi {
    suspend fun sendOtp(phone: String) {
        val r = http.post("$SUPABASE_URL/auth/v1/otp") {
            contentType(ContentType.Application.Json); header("apikey", SUPABASE_KEY)
            setBody(mapOf("phone" to phone))
        }
        check(r.status.isSuccess()) { r.bodyAsText() }
    }

    suspend fun verifyOtp(phone: String, code: String): AuthSession {
        val r = http.post("$SUPABASE_URL/auth/v1/verify") {
            contentType(ContentType.Application.Json); header("apikey", SUPABASE_KEY)
            setBody(mapOf("type" to "sms", "phone" to phone, "token" to code))
        }
        check(r.status.isSuccess()) { r.bodyAsText() }
        return r.body()
    }

    private fun auth(builder: HttpRequestBuilder, token: String) {
        builder.header("apikey", SUPABASE_KEY)
        builder.header("Authorization", "Bearer $token")
    }

    suspend fun profile(token: String, id: String): Profile? {
        val r = http.get("$SUPABASE_URL/rest/v1/profiles") {
            auth(this, token); parameter("id", "eq.$id"); parameter("select", "id,username,display_name"); parameter("limit", "1")
        }
        check(r.status.isSuccess()) { r.bodyAsText() }
        return r.body<List<Profile>>().firstOrNull()
    }

    suspend fun updateProfile(token: String, id: String, username: String, displayName: String) {
        val r = http.patch("$SUPABASE_URL/rest/v1/profiles") {
            auth(this, token); header("Prefer", "return=minimal"); parameter("id", "eq.$id")
            contentType(ContentType.Application.Json)
            setBody(mapOf("username" to username, "display_name" to displayName))
        }
        check(r.status.isSuccess()) { r.bodyAsText() }
    }

    suspend fun searchProfiles(token: String, query: String, me: String): List<Profile> {
        val q = query.replace("*", "")
        val r = http.get("$SUPABASE_URL/rest/v1/profiles") {
            auth(this, token); parameter("select", "id,username,display_name"); parameter("id", "neq.$me")
            parameter("or", "(username.ilike.*$q*,display_name.ilike.*$q*)"); parameter("limit", "20")
        }
        check(r.status.isSuccess()) { r.bodyAsText() }
        return r.body()
    }

    suspend fun createDirect(token: String, target: String): String {
        val r = http.post("$SUPABASE_URL/rest/v1/rpc/create_direct_conversation") {
            auth(this, token); contentType(ContentType.Application.Json)
            setBody(mapOf("target_user" to target))
        }
        check(r.status.isSuccess()) { r.bodyAsText() }
        return r.body<String>()
    }

    suspend fun messages(token: String, conversationId: String): List<Message> {
        val r = http.get("$SUPABASE_URL/rest/v1/messages") {
            auth(this, token); parameter("select", "id,conversation_id,sender_id,body,created_at")
            parameter("conversation_id", "eq.$conversationId"); parameter("order", "created_at.asc"); parameter("limit", "200")
        }
        check(r.status.isSuccess()) { r.bodyAsText() }
        return r.body()
    }

    suspend fun adminRequest(action: String, code: String, name: String, body: String? = null): String {
        val payload = mutableMapOf<String, String>("action" to action, "code" to code, "name" to name)
        if (body != null) payload["body"] = body
        val r = http.post("$SUPABASE_URL/functions/v1/qun-admin-chat") {
            contentType(ContentType.Application.Json)
            setBody(payload)
        }
        check(r.status.isSuccess()) { r.bodyAsText() }
        return r.bodyAsText()
    }

    suspend fun adminMessages(code: String, name: String): List<AdminMessage> {
        val raw = adminRequest("messages", code, name)
        return json.decodeFromString<Map<String, List<AdminMessage>>>(raw)["messages"] ?: emptyList()
    }

    suspend fun adminSend(code: String, name: String, body: String) {
        adminRequest("send", code, name, body)
    }

    suspend fun checkUpdate(): UpdateInfo {
        val r = http.get("https://raw.githubusercontent.com/Serega40in/QUN/main/docs/update.json")
        check(r.status.isSuccess()) { r.bodyAsText() }
        return json.decodeFromString(r.bodyAsText())
    }

    suspend fun downloadApk(url: String, destination: File) {
        val r = http.get(url)
        check(r.status.isSuccess()) { r.bodyAsText() }
        destination.writeBytes(r.bodyAsBytes())
    }

    suspend fun sendMessage(token: String, conversationId: String, sender: String, body: String) {
        val r = http.post("$SUPABASE_URL/rest/v1/messages") {
            auth(this, token); header("Prefer", "return=minimal"); contentType(ContentType.Application.Json)
            setBody(mapOf("conversation_id" to conversationId, "sender_id" to sender, "body" to body))
        }
        check(r.status.isSuccess()) { r.bodyAsText() }
    }
}

private val api = QunApi()

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { QunApp() }
    }
}

@Composable
fun QunApp() {
    var session by remember { mutableStateOf<AuthSession?>(null) }
    var admin by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    MaterialTheme(colorScheme = lightColorScheme(primary = Navy, secondary = Emerald, tertiary = Gold)) {
        Surface(Modifier.fillMaxSize(), color = Color.White) {
            when {
                admin != null -> AdminHomeScreen(admin!!, { admin = null })
                session == null -> AuthScreen(
                    { session = it },
                    { admin = it },
                    { error = it },
                    error
                )
                else -> HomeScreen(session!!, { error = it }, error) { session = null }
            }
        }
    }
}
@Composable
private fun AuthScreen(onSession: (AuthSession) -> Unit, onAdmin: (String) -> Unit, onError: (String) -> Unit, error: String?) {
    var phone by remember { mutableStateOf("") }
    var code by remember { mutableStateOf("") }
    var sent by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var logoTaps by remember { mutableIntStateOf(0) }
    var lastTapAt by remember { mutableLongStateOf(0L) }
    var adminMode by remember { mutableStateOf(false) }
    var adminCode by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    Column(Modifier.fillMaxSize().padding(28.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Spacer(Modifier.weight(1f))
        Box(
            Modifier.size(78.dp).background(Navy, CircleShape).clickable {
                val now = System.currentTimeMillis()
                logoTaps = if (now - lastTapAt < 1500) logoTaps + 1 else 1
                lastTapAt = now
                if (logoTaps >= 5) { adminMode = true; logoTaps = 0 }
            },
            contentAlignment = Alignment.Center
        ) {
            Text("К", color = Color.White, fontSize = 36.sp, fontWeight = FontWeight.Bold)
        }
        Spacer(Modifier.height(20.dp))
        Text("QUN", color = Navy, fontSize = 32.sp, fontWeight = FontWeight.Bold)
        Text("связь нового поколения", color = Emerald)
        Spacer(Modifier.height(38.dp))
        if (adminMode) {
            Text("Админ-доступ", color = Navy, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(8.dp))
            Text("Секретный вход", color = Color.Gray, fontSize = 13.sp)
            Spacer(Modifier.height(14.dp))
            OutlinedTextField(
                adminCode,
                { adminCode = it.filter(Char::isDigit).take(6) },
                Modifier.fillMaxWidth(),
                label = { Text("Код доступа") },
                placeholder = { Text("6 цифр") },
                singleLine = true,
                shape = RoundedCornerShape(16.dp)
            )
            Spacer(Modifier.height(16.dp))
            Button(
                onClick = { onAdmin(adminCode) },
                modifier = Modifier.fillMaxWidth().height(54.dp),
                enabled = adminCode.length == 6,
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Navy)
            ) { Text("Войти как администратор", fontSize = 16.sp) }
            Spacer(Modifier.height(8.dp))
            TextButton(onClick = { adminMode = false; adminCode = "" }) { Text("Вернуться", color = Emerald) }
        } else {
        OutlinedTextField(phone, { phone = it }, Modifier.fillMaxWidth(), label = { Text("Номер телефона") },
            placeholder = { Text("+7 900 000-00-00") }, singleLine = true, shape = RoundedCornerShape(16.dp))
        if (sent) {
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(code, { code = it }, Modifier.fillMaxWidth(), label = { Text("Код из SMS") },
                placeholder = { Text("6 цифр") }, singleLine = true, shape = RoundedCornerShape(16.dp))
        }
        Spacer(Modifier.height(16.dp))
        Button(onClick = {
            scope.launch {
                busy = true
                try {
                    if (!sent) { api.sendOtp(phone.trim()); sent = true }
                    else onSession(api.verifyOtp(phone.trim(), code.trim()))
                } catch (e: Exception) { onError(e.message ?: "Не удалось выполнить запрос") }
                finally { busy = false }
            }
        }, modifier = Modifier.fillMaxWidth().height(54.dp), enabled = !busy, shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Navy)) {
            Text(if (busy) "Подождите…" else if (sent) "Войти в QUN" else "Получить код", fontSize = 16.sp)
        }
        }
        error?.let { Spacer(Modifier.height(12.dp)); Text(it.take(180), color = Color(0xFFB3261E), fontSize = 12.sp) }
        Spacer(Modifier.weight(1f))
        Text("QUN • real messenger", color = Gold, fontSize = 12.sp)
        Spacer(Modifier.height(24.dp))
    }
}


@Composable
private fun UpdateButton(onError: (String) -> Unit) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val scope = rememberCoroutineScope()
    var busy by remember { mutableStateOf(false) }
    var status by remember { mutableStateOf<String?>(null) }
    var update by remember { mutableStateOf<UpdateInfo?>(null) }

    Button(
        onClick = {
            scope.launch {
                busy = true
                status = "Проверяем новую версию…"
                try {
                    val info = api.checkUpdate()
                    val current = context.packageManager.getPackageInfo(context.packageName, 0).longVersionCode
                    if (info.versionCode.toLong() <= current) status = "Установлена последняя версия"
                    else { update = info; status = "Доступна QUN " + info.versionName }
                } catch (e: Exception) {
                    status = "Не удалось проверить обновление"
                    onError(e.message ?: "Ошибка обновления")
                } finally { busy = false }
            }
        },
        enabled = !busy,
        colors = ButtonDefaults.buttonColors(containerColor = Emerald),
        shape = RoundedCornerShape(14.dp)
    ) { Text(if (busy) "Проверяем…" else "Проверить обновление") }

    update?.let { info ->
        AlertDialog(
            onDismissRequest = { update = null },
            title = { Text("Новая версия QUN " + info.versionName) },
            text = {
                Column {
                    Text(info.notes.ifBlank { "Доступно обновление QUN." })
                    Spacer(Modifier.height(10.dp))
                    Text("После скачивания Android попросит подтвердить установку.", color = Color.Gray, fontSize = 12.sp)
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    update = null
                    scope.launch {
                        busy = true
                        status = "Скачиваем QUN " + info.versionName + "…"
                        try {
                            val file = File(context.cacheDir, "QUN-" + info.versionName + ".apk")
                            api.downloadApk(info.apkUrl, file)
                            if (android.os.Build.VERSION.SDK_INT >= 26 && !context.packageManager.canRequestPackageInstalls()) {
                                val settings = Intent(
                                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                                    Uri.parse("package:" + context.packageName)
                                )
                                context.startActivity(settings)
                                status = "Разрешите установку из QUN и снова нажмите обновление"
                            } else {
                                val uri = FileProvider.getUriForFile(context, context.packageName + ".fileprovider", file)
                                val intent = Intent(Intent.ACTION_VIEW).apply {
                                    setDataAndType(uri, "application/vnd.android.package-archive")
                                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                                }
                                context.startActivity(intent)
                                status = "Открываем установщик…"
                            }
                        } catch (e: Exception) {
                            status = "Ошибка установки"
                            onError(e.message ?: "Не удалось установить обновление")
                        } finally { busy = false }
                    }
                }) { Text("Обновить") }
            },
            dismissButton = { TextButton(onClick = { update = null }) { Text("Позже") } }
        )
    }

    status?.let {
        Spacer(Modifier.height(6.dp))
        Text(it, color = Color.Gray, fontSize = 11.sp)
    }
}

@Composable
private fun HomeScreen(session: AuthSession, onError: (String) -> Unit, error: String?, onLogout: () -> Unit) {
    var me by remember { mutableStateOf<Profile?>(null) }
    var username by remember { mutableStateOf("") }
    var displayName by remember { mutableStateOf("") }
    var search by remember { mutableStateOf("") }
    var people by remember { mutableStateOf<List<Profile>>(emptyList()) }
    var selected by remember { mutableStateOf<Pair<String, Profile>?>(null) }
    var saved by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(session) {
        try {
            me = api.profile(session.access_token, session.user.id)
            username = me?.username ?: ""
            displayName = me?.display_name ?: ""
        } catch (e: Exception) { onError(e.message ?: "Ошибка профиля") }
    }

    if (selected != null) {
        ChatScreen(session, me ?: Profile(session.user.id, username, displayName), selected!!.first, selected!!.second,
            { selected = null }, onError)
        return
    }

    Scaffold(topBar = {
        Row(Modifier.fillMaxWidth().padding(20.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("QUN", color = Navy, fontSize = 28.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.weight(1f))
            TextButton(onClick = onLogout) { Text("Выйти", color = Emerald) }
        }
    }) { padding ->
        LazyColumn(Modifier.fillMaxSize().padding(padding).background(Soft), contentPadding = PaddingValues(18.dp)) {
            item {
                Text("Твой профиль", color = Navy, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(8.dp))
                UpdateButton(onError)
                Spacer(Modifier.height(10.dp))
                OutlinedTextField(displayName, { displayName = it }, Modifier.fillMaxWidth(), label = { Text("Имя") }, singleLine = true)
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(username, { username = it.lowercase().replace(" ","") }, Modifier.fillMaxWidth(),
                    label = { Text("username") }, placeholder = { Text("например, serega40in") }, singleLine = true)
                Spacer(Modifier.height(10.dp))
                Button(onClick = {
                    scope.launch {
                        try { api.updateProfile(session.access_token, session.user.id, username, displayName); saved = true }
                        catch (e: Exception) { onError(e.message ?: "Не удалось сохранить профиль") }
                    }
                }, modifier = Modifier, enabled = username.length >= 3 && !saved, colors = ButtonDefaults.buttonColors(containerColor = Navy)) {
                    Text(if (saved) "Сохранено" else "Сохранить профиль")
                }
                Spacer(Modifier.height(26.dp))
                Text("Найти человека", color = Navy, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(search, { value ->
                    search = value
                    if (value.length >= 2) scope.launch {
                        try { people = api.searchProfiles(session.access_token, value, session.user.id) }
                        catch (e: Exception) { onError(e.message ?: "Поиск недоступен") }
                    } else people = emptyList()
                }, Modifier.fillMaxWidth(), label = { Text("Имя или username") }, singleLine = true)
                Spacer(Modifier.height(10.dp))
            }
            items(people, key = { it.id }) { person ->
                Card(Modifier.fillMaxWidth().padding(vertical = 4.dp).clickable {
                    scope.launch {
                        try { selected = api.createDirect(session.access_token, person.id) to person }
                        catch (e: Exception) { onError(e.message ?: "Не удалось открыть чат") }
                    }
                }, colors = CardDefaults.cardColors(containerColor = Color.White)) {
                    Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(46.dp).background(Navy, CircleShape), contentAlignment = Alignment.Center) {
                            Text(person.display_name.take(1).uppercase(), color = Color.White, fontWeight = FontWeight.Bold)
                        }
                        Spacer(Modifier.width(12.dp))
                        Column {
                            Text(person.display_name.ifBlank { "QUN user" }, color = Navy, fontWeight = FontWeight.SemiBold)
                            Text("@"+(person.username ?: "без username"), color = Emerald, fontSize = 13.sp)
                        }
                    }
                }
            }
            item {
                Spacer(Modifier.height(20.dp))
                Text("Найди второй телефон по username — чат создастся автоматически.", color = Color.Gray, fontSize = 12.sp)
                error?.let { Text(it.take(180), color = Color(0xFFB3261E), fontSize = 12.sp) }
            }
        }
    }
}

@Composable
private fun ChatScreen(session: AuthSession, me: Profile, conversationId: String, partner: Profile,
    onBack: () -> Unit, onError: (String) -> Unit) {
    var messages by remember { mutableStateOf<List<Message>>(emptyList()) }
    var draft by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    suspend fun refresh() {
        try { messages = api.messages(session.access_token, conversationId) }
        catch (e: Exception) { onError(e.message ?: "Не удалось загрузить сообщения") }
    }

    LaunchedEffect(conversationId) {
        while (true) { refresh(); delay(2000) }
    }

    Scaffold(topBar = {
        Row(Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
            TextButton(onClick = onBack) { Text("‹", color = Navy, fontSize = 30.sp) }
            Column {
                Text(partner.display_name.ifBlank { "QUN user" }, color = Navy, fontWeight = FontWeight.Bold)
                Text("@"+(partner.username ?: ""), color = Emerald, fontSize = 12.sp)
            }
        }
    }, bottomBar = {
        Row(Modifier.fillMaxWidth().padding(10.dp), verticalAlignment = Alignment.Bottom) {
            OutlinedTextField(draft, { draft = it }, Modifier.weight(1f), placeholder = { Text("Сообщение") },
                maxLines = 4, shape = RoundedCornerShape(18.dp))
            Spacer(Modifier.width(8.dp))
            Button(onClick = {
                val text = draft.trim(); draft = ""
                scope.launch {
                    try { api.sendMessage(session.access_token, conversationId, me.id, text); refresh() }
                    catch (e: Exception) { onError(e.message ?: "Сообщение не отправлено") }
                }
            }, modifier = Modifier, enabled = draft.isNotBlank(), colors = ButtonDefaults.buttonColors(containerColor = Navy), shape = CircleShape,
                contentPadding = PaddingValues(14.dp)) { Text("↑", fontSize = 20.sp) }
        }
    }) { padding ->
        LazyColumn(Modifier.fillMaxSize().padding(padding).background(Soft), contentPadding = PaddingValues(14.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(messages, key = { it.id }) { message ->
                Row(Modifier.fillMaxWidth(),
                    horizontalArrangement = if (message.sender_id == me.id) Arrangement.End else Arrangement.Start) {
                    Surface(color = if (message.sender_id == me.id) Navy else Color.White, shape = RoundedCornerShape(18.dp)) {
                        Text(message.body, Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                            color = if (message.sender_id == me.id) Color.White else Navy, fontSize = 15.sp)
                    }
                }
            }
        }
    }
}

@Composable
private fun AdminHomeScreen(name: String, onLogout: () -> Unit) {
    val codes = mapOf("Сергей" to "740281", "Георгий" to "531947", "Павел" to "826314", "Наталья" to "419625", "Олег" to "683752")
    val code = codes[name] ?: ""
    var messages by remember { mutableStateOf<List<AdminMessage>>(emptyList()) }
    var draft by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(name) {
        while (true) {
            try { messages = api.adminMessages(code, name); error = null }
            catch (e: Exception) { error = e.message ?: "Не удалось загрузить сообщения" }
            delay(2000)
        }
    }

    Scaffold(
        topBar = {
            Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("QUN", color = Navy, fontSize = 28.sp, fontWeight = FontWeight.Bold)
                    Text("Командный чат · $name", color = Emerald, fontSize = 13.sp)
                }
                TextButton(onClick = onLogout) { Text("Выйти", color = Emerald) }
            }
        },
        bottomBar = {
            Row(Modifier.fillMaxWidth().padding(10.dp), verticalAlignment = Alignment.Bottom) {
                OutlinedTextField(draft, { draft = it }, Modifier.weight(1f), placeholder = { Text("Сообщение команде") },
                    maxLines = 4, shape = RoundedCornerShape(18.dp))
                Spacer(Modifier.width(8.dp))
                Button(
                    onClick = {
                        val text = draft.trim()
                        draft = ""
                        scope.launch {
                            try { api.adminSend(code, name, text); messages = api.adminMessages(code, name); error = null }
                            catch (e: Exception) { error = e.message ?: "Сообщение не отправлено" }
                        }
                    },
                    enabled = draft.isNotBlank(),
                    colors = ButtonDefaults.buttonColors(containerColor = Navy),
                    shape = CircleShape,
                    contentPadding = PaddingValues(14.dp)
                ) { Text("↑", fontSize = 20.sp) }
            }
        }
    ) { padding ->
        LazyColumn(Modifier.fillMaxSize().padding(padding).background(Soft),
            contentPadding = PaddingValues(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            item {
                Text("Командный чат", color = Navy, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                Text("Общий тестовый чат QUN • сообщения видят все администраторы", color = Color.Gray, fontSize = 12.sp)
                Spacer(Modifier.height(8.dp))
            }
            items(messages, key = { it.id }) { message ->
                val mine = message.sender == name
                Row(Modifier.fillMaxWidth(), horizontalArrangement = if (mine) Arrangement.End else Arrangement.Start) {
                    Surface(color = if (mine) Navy else Color.White, shape = RoundedCornerShape(18.dp), shadowElevation = 1.dp) {
                        Column(Modifier.widthIn(max = 310.dp).padding(horizontal = 14.dp, vertical = 9.dp)) {
                            if (!mine) Text(message.sender, color = Emerald, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                            Text(message.body, color = if (mine) Color.White else Navy, fontSize = 15.sp)
                        }
                    }
                }
            }
            error?.let { err -> item { Text(err.take(180), color = Color(0xFFB3261E), fontSize = 12.sp) } }
        }
    }
}
