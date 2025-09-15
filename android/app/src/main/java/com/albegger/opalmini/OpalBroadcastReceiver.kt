package com.albegger.opalmini

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch

class OpalBroadcastReceiver : BroadcastReceiver() {
    private val coroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    override fun onReceive(context: Context, intent: Intent) {
        val pendingResult = goAsync()
        coroutineScope.launch {
            try {
                OverlayState.intentFlow.emit(intent)
            } finally {
                pendingResult.finish()
            }
        }
    }
}
