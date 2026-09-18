# Keep Moshi / Retrofit / Hilt
-keepattributes Signature
-keepattributes *Annotation*
-dontwarn okhttp3.**
-dontwarn retrofit2.**
-keep class com.squareup.moshi.** { *; }
-keep class com.furkansogutma.app.data.** { *; }
-keep class com.furkansogutma.app.feature.**.data.** { *; }
-keep class com.furkansogutma.app.core.network.** { *; }
-keepclassmembers class * {
    @com.squareup.moshi.Json <fields>;
}
