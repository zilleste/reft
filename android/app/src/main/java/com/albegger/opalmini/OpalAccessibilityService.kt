package com.albegger.opalmini

import android.accessibilityservice.AccessibilityService
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.PixelFormat
import android.util.Log
import android.view.Gravity
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeContent
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.ComposeView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LifecycleRegistry
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.ViewModelStoreOwner
import androidx.lifecycle.setViewTreeLifecycleOwner
import androidx.lifecycle.setViewTreeViewModelStoreOwner
import androidx.savedstate.SavedStateRegistry
import androidx.savedstate.SavedStateRegistryController
import androidx.savedstate.SavedStateRegistryOwner
import androidx.savedstate.setViewTreeSavedStateRegistryOwner
import kotlinx.collections.immutable.persistentSetOf
import kotlinx.coroutines.CoroutineName
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.launch

enum class KeyguardOverlayState {
    SHOWN,
    HIDDEN
}

enum class EffectiveOverlayState {
    SHOWN,
    HIDDEN
}

enum class AppOverlayState {
    SHOWN,
    HIDDEN
}

object OverlayState {
    var effectiveOverlayState = MutableStateFlow(EffectiveOverlayState.HIDDEN)
    var keyguardOverlayState = MutableStateFlow(KeyguardOverlayState.SHOWN)
    var currentForegroundPackage = MutableStateFlow("")
    var appOverlayState = MutableStateFlow(AppOverlayState.SHOWN)

    var allowedPackageNames = MutableStateFlow(persistentSetOf<String>("bitpit.launcher"))

    val intentFlow = MutableSharedFlow<Intent>()
}

class OpalAccessibilityService : AccessibilityService() {
    private lateinit var windowManager: WindowManager
    private val onDisconnect: MutableSharedFlow<Unit> = MutableSharedFlow(replay = 0)
    private var overlayView: ComposeView? = null
    private var lifecycleOwner: ComposeLifecycleOwner? = null
    private val serviceJob = SupervisorJob()
    private val serviceScope = CoroutineScope(Dispatchers.Main + serviceJob)
    private var ephemeralScope: CoroutineScope? = null

    private var receiver: OpalBroadcastReceiver = OpalBroadcastReceiver()

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return
        when (event.eventType) {
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED,
            AccessibilityEvent.TYPE_WINDOWS_CHANGED,
            AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED -> {
                val pkg = event.packageName?.toString() ?: ""
                if (pkg.isNotEmpty() && OverlayState.currentForegroundPackage.value != pkg) {
                    OverlayState.currentForegroundPackage.value = pkg
                }
            }
        }
    }

    override fun onInterrupt() {
        // does nothing for now
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager

        ephemeralScope =
                CoroutineScope(
                        serviceScope.coroutineContext + Job() + CoroutineName("EphemeralScope")
                )

        // Create overlay once; afterwards toggle blocking vs non-blocking
        createOverlay()
        setupOverlayStateListeners()
        Log.d("MyAccessibilityService", "Service Connected")

        val filter =
                IntentFilter().apply {
                    addAction(Intent.ACTION_SCREEN_OFF)
                    addAction(Intent.ACTION_SCREEN_ON)
                    addAction(Intent.ACTION_USER_PRESENT)
                }

        registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED)

        serviceScope.launch {
            onDisconnect.first()
            unregisterReceiver(receiver)
        }

        registerIntentHandler()
    }

    fun registerIntentHandler() {
        OverlayState.intentFlow
                .onEach { intent ->
                    Log.d("OGCKL", "got intent $intent")
                    when (intent.action) {
                        Intent.ACTION_SCREEN_OFF -> {
                            OverlayState.keyguardOverlayState.value = KeyguardOverlayState.HIDDEN
                            Log.d("OGCKL", "screen off")
                        }
                        Intent.ACTION_SCREEN_ON -> {
                            Log.d("OGCKL", "screen on")
                        }
                        Intent.ACTION_USER_PRESENT -> {
                            Log.d("OGCKL", "unlocked")
                            OverlayState.keyguardOverlayState.value = KeyguardOverlayState.SHOWN
                        }
                    }
                }
                .launchIn(ephemeralScope!!)
    }

    override fun onUnbind(intent: Intent): Boolean {
        serviceScope.launch { onDisconnect.emit(Unit) }
        ephemeralScope?.cancel()
        ephemeralScope = null
        destroyOverlay()
        return false
    }

    fun setupOverlayStateListeners() {
        ephemeralScope?.launch {
            combine(
                            OverlayState.keyguardOverlayState,
                            OverlayState.currentForegroundPackage,
                            OverlayState.appOverlayState
                    ) { keyguard, foregroundPkg, appState ->
                        calculateDesiredOverlayState(keyguard, foregroundPkg, appState)
                    }
                    .distinctUntilChanged()
                    .onEach { newState -> applyOverlayState(newState) }
                    .launchIn(this)
        }
    }

    private fun applyOverlayState(nextOverlayState: EffectiveOverlayState) {
        if (OverlayState.effectiveOverlayState.value == nextOverlayState) return
        Log.d("OGCKL", "Next overlay state: $nextOverlayState")
        when (nextOverlayState) {
            EffectiveOverlayState.SHOWN -> makeBlocking()
            EffectiveOverlayState.HIDDEN -> makeNonBlocking()
        }
        OverlayState.effectiveOverlayState.value = nextOverlayState
    }

    private fun blockingLayoutParams(): WindowManager.LayoutParams {
        return WindowManager.LayoutParams(
                        WindowManager.LayoutParams.MATCH_PARENT,
                        WindowManager.LayoutParams.MATCH_PARENT,
                        WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                        WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                        PixelFormat.TRANSLUCENT
                )
                .apply {
                    gravity = Gravity.TOP or Gravity.START
                    layoutInDisplayCutoutMode =
                            WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
                    softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE
                }
    }

    private fun nonBlockingLayoutParams(): WindowManager.LayoutParams {
        return WindowManager.LayoutParams(
                        WindowManager.LayoutParams.MATCH_PARENT,
                        WindowManager.LayoutParams.MATCH_PARENT,
                        WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                        WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                                WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
                        PixelFormat.TRANSLUCENT
                )
                .apply {
                    gravity = Gravity.TOP or Gravity.START
                    layoutInDisplayCutoutMode =
                            WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
                    softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE
                }
    }

    private fun makeBlocking() {
        overlayView?.let { view -> windowManager.updateViewLayout(view, blockingLayoutParams()) }
    }

    private fun makeNonBlocking() {
        overlayView?.let { view -> windowManager.updateViewLayout(view, nonBlockingLayoutParams()) }
    }

    private fun calculateDesiredOverlayState(
            keyguard: KeyguardOverlayState,
            foregroundPackage: String,
            appState: AppOverlayState
    ): EffectiveOverlayState {
        if (appState == AppOverlayState.HIDDEN) return EffectiveOverlayState.HIDDEN
        return when (keyguard) {
            KeyguardOverlayState.HIDDEN -> EffectiveOverlayState.HIDDEN
            KeyguardOverlayState.SHOWN ->
                    if (OverlayState.allowedPackageNames.value.contains(foregroundPackage))
                            EffectiveOverlayState.HIDDEN
                    else EffectiveOverlayState.SHOWN
        }
    }

    private fun createOverlay() {
        if (overlayView != null) {
            Log.e("MyAccessibilityService", "Overlay already shown")
            return
        }
        Log.d("MyAccessibilityService", "Showing Overlay")

        val currentContext = this

        overlayView =
                ComposeView(currentContext).apply {
                    lifecycleOwner = ComposeLifecycleOwner()
                    lifecycleOwner?.performRestore(null)
                    lifecycleOwner?.handleLifecycleEvent(Lifecycle.Event.ON_CREATE)
                    setViewTreeLifecycleOwner(lifecycleOwner)
                    setViewTreeViewModelStoreOwner(lifecycleOwner)
                    setViewTreeSavedStateRegistryOwner(lifecycleOwner)

                    setContent {
                        OverlayContent()

                        DisposableEffect(Unit) {
                            onDispose {
                                Log.d("MyAccessibilityService", "Overlay Composable Disposed")
                            }
                        }
                    }

                    lifecycleOwner?.handleLifecycleEvent(Lifecycle.Event.ON_START)
                    lifecycleOwner?.handleLifecycleEvent(Lifecycle.Event.ON_RESUME)
                }

        try {
            windowManager.addView(overlayView, blockingLayoutParams())
            Log.d("MyAccessibilityService", "Overlay view added")
        } catch (e: Exception) {
            Log.e("MyAccessibilityService", "Error adding overlay view", e)
            overlayView = null // Reset if adding failed
        }
    }

    private fun destroyOverlay() {
        if (overlayView == null) {
            return
        }
        Log.d("MyAccessibilityService", "Hiding Overlay")
        try {
            lifecycleOwner?.handleLifecycleEvent(Lifecycle.Event.ON_PAUSE)
            lifecycleOwner?.handleLifecycleEvent(Lifecycle.Event.ON_STOP)
            lifecycleOwner?.handleLifecycleEvent(Lifecycle.Event.ON_DESTROY)

            windowManager.removeView(overlayView)
            overlayView = null
            Log.d("MyAccessibilityService", "Overlay view removed")
        } catch (e: Exception) {
            Log.e("MyAccessibilityService", "Error removing overlay view", e)
        }
    }

    @Composable
    fun OverlayContent() {
        Box(
                modifier =
                        Modifier.fillMaxSize()
                                .padding(
                                        bottom =
                                                WindowInsets.safeContent
                                                        .asPaddingValues()
                                                        .calculateBottomPadding()
                                ),
                contentAlignment = Alignment.Center
        ) { EmptyOverlay(modifier = Modifier.fillMaxSize()) }
    }

    @SuppressLint("WrongThread")
    @Composable
    fun EmptyOverlay(modifier: Modifier = Modifier) {
        Box(modifier = modifier) {}
    }
}

internal class ComposeLifecycleOwner :
        LifecycleOwner, ViewModelStoreOwner, SavedStateRegistryOwner {
    private val lifecycleRegistry = LifecycleRegistry(this)
    private val store = ViewModelStore()
    private val savedStateRegistryController = SavedStateRegistryController.create(this)

    override val savedStateRegistry: SavedStateRegistry
        get() = savedStateRegistryController.savedStateRegistry

    override val lifecycle: Lifecycle
        get() = lifecycleRegistry

    override val viewModelStore: ViewModelStore
        get() = store

    fun handleLifecycleEvent(event: Lifecycle.Event) {
        lifecycleRegistry.handleLifecycleEvent(event)
    }

    fun performRestore(savedState: android.os.Bundle?) {
        savedStateRegistryController.performRestore(savedState)
    }

    fun performSave(outBundle: android.os.Bundle) {
        savedStateRegistryController.performSave(outBundle)
    }
}
