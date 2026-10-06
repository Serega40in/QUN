package com.qun.messenger

import android.os.Bundle
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

private val Navy = Color(0xFF082A45)
private val Emerald = Color(0xFF087A63)
private val Gold = Color(0xFFC6A15B)
private val Soft = Color(0xFFF6F8F7)

data class Chat(val name: String, val preview: String, val time: String, val online: Boolean)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { QunApp() }
    }
}

@Composable
fun QunApp() {
    var authenticated by remember { mutableStateOf(false) }
    var phone by remember { mutableStateOf("") }
    var code by remember { mutableStateOf("") }

    MaterialTheme(
        colorScheme = lightColorScheme(
            primary = Navy,
            secondary = Emerald,
            tertiary = Gold,
            background = Color.White,
            surface = Color.White
        )
    ) {
        Surface(Modifier.fillMaxSize(), color = Color.White) {
            if (!authenticated) {
                AuthScreen(
                    phone = phone,
                    code = code,
                    onPhoneChange = { phone = it },
                    onCodeChange = { code = it },
                    onContinue = { if (phone.length >= 6) authenticated = true }
                )
            } else {
                MessengerScreen()
            }
        }
    }
}

@Composable
private fun AuthScreen(
    phone: String,
    code: String,
    onPhoneChange: (String) -> Unit,
    onCodeChange: (String) -> Unit,
    onContinue: () -> Unit
) {
    var sent by remember { mutableStateOf(false) }

    Column(
        Modifier.fillMaxSize().padding(horizontal = 28.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(Modifier.weight(1f))
        Box(
            Modifier.size(78.dp).background(Navy, CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Text("К", color = Color.White, fontSize = 36.sp, fontWeight = FontWeight.Bold)
        }
        Spacer(Modifier.height(22.dp))
        Text("QUN", color = Navy, fontSize = 32.sp, fontWeight = FontWeight.Bold)
        Text("связь нового поколения", color = Emerald, fontSize = 15.sp)
        Spacer(Modifier.height(42.dp))

        OutlinedTextField(
            value = phone,
            onValueChange = onPhoneChange,
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Номер телефона") },
            placeholder = { Text("+7 900 000-00-00") },
            singleLine = true,
            shape = RoundedCornerShape(16.dp)
        )

        if (sent) {
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(
                value = code,
                onValueChange = onCodeChange,
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Код подтверждения") },
                placeholder = { Text("6 цифр") },
                singleLine = true,
                shape = RoundedCornerShape(16.dp)
            )
        }

        Spacer(Modifier.height(16.dp))
        Button(
            onClick = {
                if (!sent) sent = true else onContinue()
            },
            modifier = Modifier.fillMaxWidth().height(54.dp),
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Navy)
        ) {
            Text(if (sent) "Войти в QUN" else "Получить код", fontSize = 16.sp)
        }

        if (sent) {
            Spacer(Modifier.height(10.dp))
            Text(
                "MVP-режим: SMS-провайдер подключим следующим этапом.",
                color = Color.Gray,
                fontSize = 12.sp
            )
        }
        Spacer(Modifier.weight(1f))
        Text("QUN • messenger", color = Gold, fontSize = 12.sp)
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun MessengerScreen() {
    val chats = listOf(
        Chat("КЮН", "Добро пожаловать в QUN.", "сейчас", true),
        Chat("Георгий", "Давай обсудим проект.", "21:42", true),
        Chat("QUN Community", "Новые материалы уже здесь.", "20:18", false)
    )

    Scaffold(
        topBar = {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("QUN", color = Navy, fontSize = 28.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.weight(1f))
                Text("⌕", color = Emerald, fontSize = 28.sp)
            }
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = {},
                containerColor = Navy,
                contentColor = Color.White,
                shape = CircleShape
            ) { Text("+", fontSize = 28.sp) }
        }
    ) { padding ->
        LazyColumn(
            Modifier.fillMaxSize().padding(padding).background(Soft),
            contentPadding = PaddingValues(bottom = 90.dp)
        ) {
            items(chats) { chat ->
                ChatRow(chat)
            }
        }
    }
}

@Composable
private fun ChatRow(chat: Chat) {
    Row(
        Modifier.fillMaxWidth()
            .clickable {}
            .padding(horizontal = 18.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            Modifier.size(54.dp).background(
                if (chat.online) Navy else Emerald,
                CircleShape
            ),
            contentAlignment = Alignment.Center
        ) {
            Text(chat.name.take(1), color = Color.White, fontSize = 21.sp, fontWeight = FontWeight.Bold)
        }
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text(chat.name, color = Navy, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
            Text(chat.preview, color = Color.Gray, fontSize = 14.sp, maxLines = 1)
        }
        Text(chat.time, color = Color.Gray, fontSize = 11.sp)
    }
}
