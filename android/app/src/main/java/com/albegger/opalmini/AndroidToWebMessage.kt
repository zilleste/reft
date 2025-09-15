package com.albegger.opalmini

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable sealed interface AndroidToWebMessage {}

@Serializable @SerialName("pong") data class PongMessage(val greeter: String) : AndroidToWebMessage
