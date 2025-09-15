package com.albegger.opalmini

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable sealed interface WebToAndroidMessage {}

@Serializable @SerialName("ping") data class PingMessage(val greeter: String) : WebToAndroidMessage
