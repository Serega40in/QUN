package org.qun.node

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.BatteryManager
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.StatFs
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

private val Navy = Color(0xFF08121F)
private val Panel = Color(0xFF102438)
private val Mint = Color(0xFF65E4C1)
private val Muted = Color(0xFF9BB1C3)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { QunNodeScreen() }
    }

    @Composable
    private fun QunNodeScreen() {
        var running by remember { mutableStateOf(NodeAgentService.running) }
        var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
        var battery by remember { mutableIntStateOf(readBattery()) }
        var enrollmentCode by remember { mutableStateOf("") }
        var nodeName by remember { mutableStateOf("QUN Phone") }
        var registryId by remember { mutableStateOf(NodeRegistry.registeredId(this)) }
        var registryMessage by remember { mutableStateOf(if (registryId.isBlank()) "Не зарегистрирован" else "ID: $registryId") }
        var registering by remember { mutableStateOf(false) }
        val scope = rememberCoroutineScope()
        val notificationPermission = rememberLauncherForActivityResult(
            ActivityResultContracts.RequestPermission()
        ) { }
        LaunchedEffect(Unit) {
            while (true) {
                running = NodeAgentService.running
                now = System.currentTimeMillis()
                battery = readBattery()
                delay(1000)
            }
        }
        val stat = StatFs(filesDir.absolutePath)
        val freeBytes = stat.availableBytes
        val totalBytes = stat.totalBytes
        val uptime = if (running) ((now - NodeAgentService.startedAtMs).coerceAtLeast(0) / 1000) else 0
        MaterialTheme(colorScheme = darkColorScheme(
            primary = Mint, background = Navy, surface = Panel,
            onPrimary = Navy, onBackground = Color(0xFFEDF7FF), onSurface = Color(0xFFEDF7FF)
        )) {
            Surface(Modifier.fillMaxSize(), color = Navy) {
                Column(
                    Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(22.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(46.dp).background(Mint, RoundedCornerShape(15.dp)), contentAlignment = Alignment.Center) {
                            Text("Q", color = Navy, fontSize = 25.sp, fontWeight = FontWeight.Black)
                        }
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text("QUN Node", fontSize = 25.sp, fontWeight = FontWeight.Bold)
                            Text("Мобильный агент · 0.1.0", color = Muted, fontSize = 12.sp)
                        }
                        Text(if (running) "РАБОТАЕТ" else "ОСТАНОВЛЕН", color = if (running) Mint else Color(0xFFFCA5A5), fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    }
                    Text("Узел под вашим контролем", fontSize = 29.sp, fontWeight = FontWeight.Bold, lineHeight = 34.sp)
                    Text("Следите за состоянием телефона и управляйте тестовым агентом. Запуск не означает присоединение к публичной сети.", color = Muted, lineHeight = 22.sp)
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        MetricCard("Состояние", if (running) "Активен" else "Остановлен", Modifier.weight(1f))
                        MetricCard("Батарея", "$battery%", Modifier.weight(1f))
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        MetricCard("Время работы", formatDuration(uptime), Modifier.weight(1f))
                        MetricCard("Свободное место", formatBytes(freeBytes), Modifier.weight(1f))
                    }
                    Card(colors = CardDefaults.cardColors(containerColor = Panel), shape = RoundedCornerShape(18.dp)) {
                        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Text("Безопасность и статус", fontWeight = FontWeight.Bold)
                            InfoRow("Режим", "Только локальный тест")
                            InfoRow("Регистрация", if (registryId.isBlank()) "Не зарегистрирован" else "В тестовой сети")
                            InfoRow("Уникальный ID", if (registryId.isBlank()) "—" else registryId)
                            InfoRow("Вознаграждения QUN", "Не реализованы")
                            InfoRow("Данные приложения", formatBytes(totalBytes - freeBytes) + " занято")
                        }
                    }
                    Card(colors = CardDefaults.cardColors(containerColor = Panel), shape = RoundedCornerShape(18.dp)) {
                        Column(Modifier.fillMaxWidth().padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Text("Регистрация в тестовой сети", fontWeight = FontWeight.Bold)
                            Text("Нужен одноразовый код администратора. После регистрации ID будет закреплён за этим устройством.", color = Muted, fontSize = 12.sp, lineHeight = 18.sp)
                            OutlinedTextField(value = nodeName, onValueChange = { nodeName = it.take(80) }, label = { Text("Название узла") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(value = enrollmentCode, onValueChange = { enrollmentCode = it.take(120) }, label = { Text("Одноразовый код") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                            Button(
                                enabled = !registering && registryId.isBlank() && enrollmentCode.isNotBlank() && nodeName.isNotBlank(),
                                onClick = {
                                    registering = true
                                    registryMessage = "Регистрируем узел…"
                                    scope.launch {
                                        try {
                                            val id = withContext(Dispatchers.IO) { NodeRegistry.register(this@MainActivity, enrollmentCode, nodeName) }
                                            registryId = id
                                            enrollmentCode = ""
                                            registryMessage = "Зарегистрирован. Запустите агент для heartbeat."
                                            if (running) withContext(Dispatchers.IO) { NodeRegistry.heartbeat(this@MainActivity) }
                                        } catch (e: Exception) {
                                            registryMessage = e.message ?: "Регистрация не удалась"
                                        } finally { registering = false }
                                    }
                                },
                                modifier = Modifier.fillMaxWidth(),
                                colors = ButtonDefaults.buttonColors(containerColor = Mint, contentColor = Navy)
                            ) { Text(if (registering) "Регистрируем…" else if (registryId.isBlank()) "Зарегистрировать узел" else "Узел зарегистрирован", fontWeight = FontWeight.Bold) }
                            Text(registryMessage, color = if (registryId.isBlank()) Muted else Mint, fontSize = 11.sp, lineHeight = 16.sp)
                        }
                    }
                    Button(
                        onClick = {
                            if (running) stopService(Intent(this@MainActivity, NodeAgentService::class.java))
                            else {
                                if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                                    notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
                                }
                                ContextCompat.startForegroundService(this@MainActivity, Intent(this@MainActivity, NodeAgentService::class.java))
                            }
                            running = !running
                        },
                        modifier = Modifier.fillMaxWidth().height(52.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = if (running) Color(0xFF263B4C) else Mint, contentColor = if (running) Color.White else Navy)
                    ) { Text(if (running) "Остановить агент" else "Запустить агент", fontWeight = FontWeight.Bold) }
                    Text("Ранний доступ. Пока это мобильный агент мониторинга, а не полноценный распределённый storage-узел. Не храните важные данные.", color = Muted, fontSize = 11.sp, lineHeight = 16.sp)
                }
            }
        }
    }

    private fun readBattery(): Int {
        val manager = getSystemService(BATTERY_SERVICE) as BatteryManager
        return manager.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY).coerceIn(0, 100)
    }
}

@Composable
private fun MetricCard(label: String, value: String, modifier: Modifier = Modifier) {
    Card(modifier, colors = CardDefaults.cardColors(containerColor = Panel), shape = RoundedCornerShape(18.dp)) {
        Column(Modifier.padding(16.dp)) {
            Text(label, color = Muted, fontSize = 12.sp)
            Spacer(Modifier.height(8.dp))
            Text(value, fontSize = 22.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun InfoRow(label: String, value: String) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
        Text(label, color = Muted, fontSize = 12.sp, modifier = Modifier.weight(1f))
        Spacer(Modifier.width(10.dp))
        Text(value, fontSize = 12.sp, fontWeight = FontWeight.Medium)
    }
}

private fun formatDuration(seconds: Long): String {
    val hours = seconds / 3600
    val minutes = (seconds % 3600) / 60
    val secs = seconds % 60
    return if (hours > 0) "${hours}ч ${minutes}м" else "${minutes}м ${secs}с"
}
private fun formatBytes(bytes: Long): String {
    val gb = bytes / (1024.0 * 1024.0 * 1024.0)
    val mb = bytes / (1024.0 * 1024.0)
    return if (gb >= 1) String.format("%.1f ГБ", gb) else String.format("%.0f МБ", mb)
}
