# Keep Moshi / Retrofit / Hilt
-keepattributes Signature
-keepattributes *Annotation*
-dontwarn okhttp3.**
-dontwarn retrofit2.**
-keep class com.squareup.moshi.** { *; }
-keep class com.furkansogutma.data.** { *; }
-keep class com.furkansogutma.core.network.** { *; }
-keepclassmembers class * {
    @com.squareup.moshi.Json <fields>;
}
