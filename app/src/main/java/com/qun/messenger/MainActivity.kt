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
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.engine.android.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.io.File

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
@Serializable data class AuthTokenSession(val access_token: String, val refresh_token: String? = null)
@Serializable data class AuthResponse(val session: AuthTokenSession, val user: AuthUser)
@Serializable data class Profile(
    val id: String,
    val username: String? = null,
    val display_name: String = "",
    val phone: String? = null
)
@Serializable data class Message(
    val id: String,
    val conversation_id: String,
    val sender_id: String,
    val body: String,
    val created_at: String
)
@Serializable data class UpdateInfo(
    val versionCode: Int,
    val versionName: String,
    val apkUrl: String,
    val notes: String = ""
)

private class QunApi {
    private suspend fun authAction(action: String, fields: Map<String, String>): AuthSession {
        val r = http.post("$SUPABASE_URL/functions/v1/qun-auth") {
            contentType(ContentType.Application.Json)
            header("apikey", SUPABASE_KEY)
            header("Authorization", "Bearer $SUPABASE_KEY")
            setBody(mapOf("action" to action) + fields)
        }
        val raw = r.bodyAsText()
        check(r.status.isSuccess()) {
            runCatching { json.decodeFromString<Map<String, String>>(raw)["error"] }.getOrNull() ?: raw
        }
        val response = json.decodeFromString<AuthResponse>(raw)
        return AuthSession(response.session.access_token, response.user)
    }

    suspend fun login(login: String, password: String): AuthSession =
        authAction("login", mapOf("login" to login, "password" to password))

    suspend fun register(username: String, displayName: String, phone: String, password: String): AuthSession =
        authAction("register", mapOf(
            "username" to username,
            "display_name" to displayName,
            "phone" to phone,
            "password" to password
        ))

    private fun auth(builder: HttpRequestBuilder, token: String) {
        builder.header("apikey", SUPABASE_KEY)
        builder.header("Authorization", "Bearer $token")
    }

    suspend fun profile(token: String, id: String): Profile? {
        val r = http.get("$SUPABASE_URL/rest/v1/profiles") {
            auth(this, token)
            parameter("id", "eq.$id")
            parameter("select", "id,username,display_name,phone")
            parameter("limit", "1")
        }
        check(r.status.isSuccess()) { r.bodyAsText() }
        return r.body<List<Profile>>().firstOrNull()
    }

    suspend fun updateProfile(token: String, id: String, username: String, displayName: String) {
        val r = http.patch("$SUPABASE_URL/rest/v1/profiles") {
            auth(this, token)
            header("Prefer", "return=minimal")
            parameter("id", "eq.$id")
            contentType(ContentType.Application.Json)
            setBody(mapOf("username" to username, "display_name" to displayName))
        }
        check(r.status.isSuccess()) { r.bodyAsText() }
    }

    suspend fun searchProfiles(token: String, query: String, me: String): List<Profile> {
        val raw = query.trim().replace("*", "").replace(",", "")
        val text = raw.replace("(", "").replace(")", "")
        val digits = raw.filter(Char::isDigit)
        val clauses = mutableListOf(
            "username.ilike.*$text*",
            "display_name.ilike.*$text*"
        )
        if (digits.length >= 4) clauses += "phone.ilike.*$digits*"

        val r = http.get("$SUPABASE_URL/rest/v1/profiles") {
            auth(this, token)
            parameter("select", "id,username,display_name,phone")
            parameter("id", "neq.$me")
            parameter("or", "(" + clauses.joinToString(",") + ")")
            parameter("limit", "20")
        }
        check(r.status.isSuccess()) { r.bodyAsText() }
        return r.body()
    }

    suspend fun createDirect(token: String, target: String): String {
        val r = http.post("$SUPABASE_URL/rest/v1/rpc/create_direct_conversation") {
            auth(this, token)
            contentType(ContentType.Application.Json)
            setBody(mapOf("target_user" to target))
        }
        check(r.status.isSuccess()) { r.bodyAsText() }
        return r.body<String>()
    }

    suspend fun messages(token: String, conversationId: String): List<Message> {
        val r = http.get("$SUPABASE_URL/rest/v1/messages") {
            auth(this, token)
            parameter("select", "id,conversation_id,sender_id,body,created_at")
            parameter("conversation_id", "eq.$conversationId")
            parameter("order", "created_at.asc")
            parameter("limit", "200")
        }
        check(r.status.isSuccess()) { r.bodyAsText() }
        return r.body()
    }

    suspend fun sendMessage(token: String, conversationId: String, sender: String, body: String) {
        val r = http.post("$SUPABASE_URL/rest/v1/messages") {
            auth(this, token)
            header("Prefer", "return=minimal")
            contentType(ContentType.Application.Json)
            setBody(mapOf(
                "conversation_id" to conversationId,
                "sender_id" to sender,
                "body" to body
            ))
        }
        check(r.status.isSuccess()) { r.bodyAsText() }
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
    var error by remember { mutableStateOf<String?>(null) }

    MaterialTheme(colorScheme = lightColorScheme(primary = Navy, secondary = Emerald, tertiary = Gold)) {
        Surface(Modifier.fillMaxSize(), color = Color.White) {
            if (session == null) {
                AuthScreen(
                    onSession = { error = null; session = it },
                    onError = { error = it },
                    error = error
                )
            } else {
                HomeScreen(
                    session = session!!,
                    onError = { error = it },
                    error = error,
                    onLogout = { session = null; error = null }
                )
            }
        }
    }
}

@Composable
private fun AuthScreen(
    onSession: (AuthSession) -> Unit,
    onError: (String) -> Unit,
    error: String?
) {
    var identifier by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var password2 by remember { mutableStateOf("") }
    var displayName by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var mode by remember { mutableStateOf("login") }
    var busy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val isRegister = mode == "register"

    Column(Modifier.fillMaxSize().padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text("КЮН", color = Navy, fontSize = 22.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.weight(1f))
            UpdateButton(onError, compact = true)
        }
        Spacer(Modifier.weight(1f))
        Box(Modifier.size(78.dp).background(Navy, CircleShape), contentAlignment = Alignment.Center) {
            Text("К", color = Color.White, fontSize = 36.sp, fontWeight = FontWeight.Bold)
        }
        Spacer(Modifier.height(20.dp))
        Text("КЮН", color = Navy, fontSize = 32.sp, fontWeight = FontWeight.Bold)
        Text("связь нового поколения", color = Emerald)
        Spacer(Modifier.height(20.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            TextButton(onClick = { mode = "login" }, enabled = !busy, modifier = Modifier.weight(1f)) {
                Text("Войти", color = if (!isRegister) Emerald else Navy)
            }
            TextButton(onClick = { mode = "register" }, enabled = !busy, modifier = Modifier.weight(1f)) {
                Text("Создать аккаунт", color = if (isRegister) Emerald else Navy)
            }
        }
        OutlinedTextField(
            value = identifier, onValueChange = { identifier = it }, modifier = Modifier.fillMaxWidth(),
            label = { Text(if (isRegister) "Логин" else "Логин или телефон") },
            placeholder = { Text(if (isRegister) "например, serega40in" else "serega40in или +79990000000") },
            singleLine = true, shape = RoundedCornerShape(16.dp)
        )
        if (isRegister) {
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                value = displayName, onValueChange = { displayName = it }, modifier = Modifier.fillMaxWidth(),
                label = { Text("Имя в профиле") }, singleLine = true, shape = RoundedCornerShape(16.dp)
            )
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                value = phone, onValueChange = { phone = it }, modifier = Modifier.fillMaxWidth(),
                label = { Text("Телефон для входа по номеру (необязательно)") },
                placeholder = { Text("+7 900 000-00-00") }, singleLine = true, shape = RoundedCornerShape(16.dp)
            )
        }
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(
            value = password, onValueChange = { password = it }, modifier = Modifier.fillMaxWidth(),
            label = { Text(if (isRegister) "Пароль (минимум 8 символов)" else "Пароль") },
            visualTransformation = PasswordVisualTransformation(), singleLine = true, shape = RoundedCornerShape(16.dp)
        )
        if (isRegister) {
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                value = password2, onValueChange = { password2 = it }, modifier = Modifier.fillMaxWidth(),
                label = { Text("Повторите пароль") },
                visualTransformation = PasswordVisualTransformation(), singleLine = true, shape = RoundedCornerShape(16.dp)
            )
        }
        Spacer(Modifier.height(14.dp))
        Button(
            onClick = {
                scope.launch {
                    busy = true
                    try {
                        val login = identifier.trim().removePrefix("@").lowercase()
                        val account = if (isRegister) {
                            require(password == password2) { "Пароли не совпадают." }
                            api.register(login, displayName.trim().ifBlank { login }, phone.trim(), password)
                        } else api.login(identifier.trim(), password)
                        onSession(account)
                    } catch (e: Exception) {
                        onError(e.message ?: "Не удалось выполнить вход")
                    } finally { busy = false }
                }
            },
            modifier = Modifier.fillMaxWidth().height(54.dp),
            enabled = !busy && identifier.trim().length >= 3 && password.length >= 8 && (!isRegister || password == password2),
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Navy)
        ) {
            Text(if (busy) "Подождите…" else if (isRegister) "Создать аккаунт" else "Войти в КЮН", fontSize = 16.sp)
        }
        error?.let {
            Spacer(Modifier.height(12.dp))
            Text(it.take(220), color = Color(0xFFB3261E), fontSize = 12.sp)
        }
        Spacer(Modifier.weight(1f))
        Text("Логин и пароль · SMS не требуется", color = Gold, fontSize = 12.sp)
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun UpdateButton(onError: (String) -> Unit, compact: Boolean = false) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val scope = rememberCoroutineScope()
    var busy by remember { mutableStateOf(false) }
    var status by remember { mutableStateOf<String?>(null) }
    var update by remember { mutableStateOf<UpdateInfo?>(null) }

    Button(
        onClick = {
            scope.launch {
                busy = true
                status = "Проверяем…"
                try {
                    val info = api.checkUpdate()
                    val current = context.packageManager
                        .getPackageInfo(context.packageName, 0).longVersionCode
                    if (info.versionCode.toLong() <= current) {
                        status = "Последняя версия"
                    } else {
                        update = info
                        status = "Доступна QUN " + info.versionName
                    }
                } catch (e: Exception) {
                    status = "Ошибка проверки"
                    onError(e.message ?: "Ошибка обновления")
                } finally {
                    busy = false
                }
            }
        },
        enabled = !busy,
        colors = ButtonDefaults.buttonColors(
            containerColor = if (compact) Navy else Emerald,
            contentColor = Color.White
        ),
        shape = RoundedCornerShape(14.dp),
        contentPadding = if (compact)
            PaddingValues(horizontal = 12.dp, vertical = 8.dp)
        else ButtonDefaults.ContentPadding
    ) {
        Text(
            if (busy) "…" else if (compact) "↻ Обновить" else "Проверить обновление",
            fontSize = if (compact) 12.sp else 14.sp
        )
    }

    update?.let { info ->
        AlertDialog(
            onDismissRequest = { update = null },
            title = { Text("Новая версия QUN " + info.versionName) },
            text = { Text(info.notes.ifBlank { "Доступно обновление QUN." }) },
            confirmButton = {
                TextButton(onClick = {
                    update = null
                    scope.launch {
                        busy = true
                        try {
                            val file = File(context.cacheDir, "QUN-" + info.versionName + ".apk")
                            api.downloadApk(info.apkUrl, file)
                            if (android.os.Build.VERSION.SDK_INT >= 26 &&
                                !context.packageManager.canRequestPackageInstalls()
                            ) {
                                context.startActivity(
                                    Intent(
                                        Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                                        Uri.parse("package:" + context.packageName)
                                    )
                                )
                                status = "Разрешите установку из QUN"
                            } else {
                                val uri = FileProvider.getUriForFile(
                                    context,
                                    context.packageName + ".fileprovider",
                                    file
                                )
                                context.startActivity(Intent(Intent.ACTION_VIEW).apply {
                                    setDataAndType(uri, "application/vnd.android.package-archive")
                                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                                })
                                status = "Открываем установщик…"
                            }
                        } catch (e: Exception) {
                            onError(e.message ?: "Не удалось установить обновление")
                        } finally {
                            busy = false
                        }
                    }
                }) { Text("Обновить") }
            },
            dismissButton = { TextButton(onClick = { update = null }) { Text("Позже") } }
        )
    }

    status?.let {
        Text(it, color = Color.Gray, fontSize = 11.sp, modifier = Modifier.padding(top = 4.dp))
    }
}

@Composable
private fun HomeScreen(
    session: AuthSession,
    onError: (String) -> Unit,
    error: String?,
    onLogout: () -> Unit
) {
    var me by remember { mutableStateOf<Profile?>(null) }
    var username by remember { mutableStateOf("") }
    var displayName by remember { mutableStateOf("") }
    var search by remember { mutableStateOf("") }
    var people by remember { mutableStateOf<List<Profile>>(emptyList()) }
    var selected by remember { mutableStateOf<Pair<String, Profile>?>(null) }
    var saved by remember { mutableStateOf(false) }
    var loadingProfile by remember { mutableStateOf(true) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(session.user.id) {
        loadingProfile = true
        try {
            me = api.profile(session.access_token, session.user.id)
            username = me?.username ?: ""
            displayName = me?.display_name ?: ""
        } catch (e: Exception) {
            onError(e.message ?: "Ошибка профиля")
        } finally {
            loadingProfile = false
        }
    }

    if (selected != null) {
        ChatScreen(
            session = session,
            me = me ?: Profile(session.user.id, username, displayName, session.user.phone),
            conversationId = selected!!.first,
            partner = selected!!.second,
            onBack = { selected = null },
            onError = onError
        )
        return
    }

    Scaffold(
        topBar = {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("QUN", color = Navy, fontSize = 28.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.weight(1f))
                UpdateButton(onError, compact = true)
                Spacer(Modifier.width(4.dp))
                TextButton(onClick = onLogout) { Text("Выйти", color = Emerald) }
            }
        }
    ) { padding ->
        LazyColumn(
            Modifier.fillMaxSize().padding(padding).background(Soft),
            contentPadding = PaddingValues(18.dp)
        ) {
            item {
                Text("Твой профиль", color = Navy, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(8.dp))

                OutlinedTextField(
                    displayName,
                    { displayName = it; saved = false },
                    Modifier.fillMaxWidth(),
                    label = { Text("Имя") },
                    singleLine = true
                )
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    username,
                    { username = it.lowercase().replace(" ", "").replace("@", ""); saved = false },
                    Modifier.fillMaxWidth(),
                    label = { Text("username") },
                    placeholder = { Text("например, serega40in") },
                    singleLine = true
                )
                Spacer(Modifier.height(6.dp))
                Text(
                    "Телефон: " + (me?.phone ?: session.user.phone ?: "—"),
                    color = Color.Gray,
                    fontSize = 12.sp
                )
                Spacer(Modifier.height(10.dp))

                Button(
                    onClick = {
                        scope.launch {
                            try {
                                api.updateProfile(
                                    session.access_token,
                                    session.user.id,
                                    username.trim(),
                                    displayName.trim()
                                )
                                saved = true
                                me = api.profile(session.access_token, session.user.id)
                            } catch (e: Exception) {
                                onError(e.message ?: "Не удалось сохранить профиль")
                            }
                        }
                    },
                    enabled = !loadingProfile && username.length >= 3 && !saved,
                    colors = ButtonDefaults.buttonColors(containerColor = Navy)
                ) {
                    Text(if (saved) "Сохранено" else "Сохранить профиль")
                }

                Spacer(Modifier.height(26.dp))
                Text("Личные сообщения", color = Navy, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(6.dp))
                Text(
                    "Найди человека по имени, username или номеру телефона.",
                    color = Color.Gray,
                    fontSize = 12.sp
                )
                Spacer(Modifier.height(8.dp))

                OutlinedTextField(
                    search,
                    { value ->
                        search = value
                        if (value.trim().length >= 2) {
                            scope.launch {
                                try {
                                    people = api.searchProfiles(
                                        session.access_token,
                                        value,
                                        session.user.id
                                    )
                                } catch (e: Exception) {
                                    onError(e.message ?: "Поиск недоступен")
                                }
                            }
                        } else {
                            people = emptyList()
                        }
                    },
                    Modifier.fillMaxWidth(),
                    label = { Text("Имя, @username или телефон") },
                    placeholder = { Text("+7 900…") },
                    singleLine = true
                )
                Spacer(Modifier.height(10.dp))
            }

            items(people, key = { it.id }) { person ->
                Card(
                    Modifier.fillMaxWidth().padding(vertical = 4.dp).clickable {
                        scope.launch {
                            try {
                                val conversation = api.createDirect(session.access_token, person.id)
                                selected = conversation to person
                            } catch (e: Exception) {
                                onError(e.message ?: "Не удалось открыть чат")
                            }
                        }
                    },
                    colors = CardDefaults.cardColors(containerColor = Color.White)
                ) {
                    Row(
                        Modifier.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            Modifier.size(46.dp).background(Navy, CircleShape),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                person.display_name.ifBlank { "Q" }.take(1).uppercase(),
                                color = Color.White,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text(
                                person.display_name.ifBlank { "QUN user" },
                                color = Navy,
                                fontWeight = FontWeight.SemiBold
                            )
                            Text(
                                "@" + (person.username ?: "без username"),
                                color = Emerald,
                                fontSize = 13.sp
                            )
                            if (!person.phone.isNullOrBlank()) {
                                Text(person.phone!!, color = Color.Gray, fontSize = 11.sp)
                            }
                        }
                        Text("›", color = Gold, fontSize = 28.sp)
                    }
                }
            }

            item {
                Spacer(Modifier.height(20.dp))
                Text(
                    "Сейчас это тестовая версия: несколько участников команды.",
                    color = Color.Gray,
                    fontSize = 12.sp
                )
                error?.let {
                    Spacer(Modifier.height(8.dp))
                    Text(it.take(220), color = Color(0xFFB3261E), fontSize = 12.sp)
                }
            }
        }
    }
}

@Composable
private fun ChatScreen(
    session: AuthSession,
    me: Profile,
    conversationId: String,
    partner: Profile,
    onBack: () -> Unit,
    onError: (String) -> Unit
) {
    var messages by remember { mutableStateOf<List<Message>>(emptyList()) }
    var draft by remember { mutableStateOf("") }
    var sending by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    suspend fun refresh() {
        try {
            messages = api.messages(session.access_token, conversationId)
        } catch (e: Exception) {
            onError(e.message ?: "Не удалось загрузить сообщения")
        }
    }

    LaunchedEffect(conversationId) {
        while (true) {
            refresh()
            delay(1500)
        }
    }

    Scaffold(
        topBar = {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                TextButton(onClick = onBack) {
                    Text("‹", color = Navy, fontSize = 30.sp)
                }
                Column {
                    Text(
                        partner.display_name.ifBlank { "QUN user" },
                        color = Navy,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        "@" + (partner.username ?: ""),
                        color = Emerald,
                        fontSize = 12.sp
                    )
                }
            }
        },
        bottomBar = {
            Row(
                Modifier.fillMaxWidth().padding(10.dp),
                verticalAlignment = Alignment.Bottom
            ) {
                OutlinedTextField(
                    draft,
                    { draft = it },
                    Modifier.weight(1f),
                    placeholder = { Text("Сообщение") },
                    maxLines = 4,
                    shape = RoundedCornerShape(18.dp)
                )
                Spacer(Modifier.width(8.dp))
                Button(
                    onClick = {
                        val text = draft.trim()
                        if (text.isBlank()) return@Button
                        scope.launch {
                            sending = true
                            try {
                                api.sendMessage(
                                    session.access_token,
                                    conversationId,
                                    me.id,
                                    text
                                )
                                draft = ""
                                refresh()
                            } catch (e: Exception) {
                                onError(e.message ?: "Сообщение не отправлено")
                            } finally {
                                sending = false
                            }
                        }
                    },
                    enabled = draft.trim().isNotBlank() && !sending,
                    colors = ButtonDefaults.buttonColors(containerColor = Navy),
                    shape = CircleShape,
                    contentPadding = PaddingValues(14.dp)
                ) {
                    Text(if (sending) "…" else "↑", fontSize = 20.sp)
                }
            }
        }
    ) { padding ->
        LazyColumn(
            Modifier.fillMaxSize().padding(padding).background(Soft),
            contentPadding = PaddingValues(14.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(messages, key = { it.id }) { message ->
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement =
                        if (message.sender_id == me.id) Arrangement.End else Arrangement.Start
                ) {
                    Surface(
                        color = if (message.sender_id == me.id) Navy else Color.White,
                        shape = RoundedCornerShape(18.dp)
                    ) {
                        Text(
                            message.body,
                            Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                            color = if (message.sender_id == me.id) Color.White else Navy,
                            fontSize = 15.sp
                        )
                    }
                }
            }
        }
    }
}
