# Keep Moshi / Retrofit / Hilt
-keepattributes Signature
-keepattributes *Annotation*
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
-dontwarn okhttp3.**
-dontwarn retrofit2.**
-dontwarn com.google.firebase.**
-keep class com.squareup.moshi.** { *; }
-keep class com.furkansogutma.app.data.** { *; }
-keep class com.furkansogutma.app.feature.**.data.** { *; }
-keep class com.furkansogutma.app.core.network.** { *; }
-keepclassmembers class * {
    @com.squareup.moshi.Json <fields>;
}
# Firebase Messaging
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
