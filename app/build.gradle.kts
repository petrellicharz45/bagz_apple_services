import java.io.File
import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.parcelize")
    id("androidx.navigation.safeargs.kotlin")
    id("com.google.dagger.hilt.android")
    id("com.google.devtools.ksp")
}

val googleServicesFile = File(projectDir, "google-services.json")
val firebaseConfigured = googleServicesFile.exists()

if (firebaseConfigured) {
    apply(plugin = "com.google.gms.google-services")
    apply(plugin = "com.google.firebase.crashlytics")
} else {
    logger.warn("⚠️  Firebase is not configured. Add app/google-services.json after creating the Firebase project.")
}

android {
    namespace = "com.carthigan.luxiva"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.fancydeals.ug"
        minSdk = 24
        targetSdk = 36
        versionCode = 54
        versionName = "1.53"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        buildConfigField("boolean", "FIREBASE_CONFIGURED", firebaseConfigured.toString())
        buildConfigField("String", "NOTIFICATION_CHANNEL_NEW_PRODUCTS", "\"new_products\"")
        buildConfigField("String", "NOTIFICATION_CHANNEL_ORDERS", "\"orders\"")
    }

    val keystorePropertiesFile = rootProject.file("keystore.properties")
    val keystoreProperties = Properties()
    if (keystorePropertiesFile.exists()) {
        keystoreProperties.load(keystorePropertiesFile.inputStream())
    }

    signingConfigs {
        create("release") {
            if (keystorePropertiesFile.exists()) {
                storeFile = file(keystoreProperties.getProperty("storeFile"))
                storePassword = keystoreProperties.getProperty("storePassword")
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    kotlinOptions {
        jvmTarget = "11"
    }
    buildFeatures {
        viewBinding = true
        buildConfig = true
    }
}

dependencies {

    // Google Play Services Code Scanner (Barcode/QR)
    implementation("com.google.android.gms:play-services-code-scanner:16.1.0")
    implementation("com.google.android.gms:play-services-auth:21.2.0")
    implementation("com.google.android.gms:play-services-location:21.3.0")

    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("com.google.android.material:material:1.11.0")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")
    implementation("androidx.swiperefreshlayout:swiperefreshlayout:1.1.0")
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.5")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.1")

    // Loading button
    implementation("com.github.leandroBorgesFerreira:LoadingButtonAndroid:1.12.1")

    // Glide
    implementation("com.github.bumptech.glide:glide:4.13.0")

    // Circular image
    implementation("de.hdodenhof:circleimageview:3.1.0")

    // Viewpager2 indicator
    implementation("me.relex:circleindicator:2.1.6")

    // StepView
    implementation("com.github.shuhart:StepView:v1.4.0")

    // Navigation component
    implementation("androidx.navigation:navigation-fragment-ktx:2.7.7")
    implementation("androidx.navigation:navigation-ui-ktx:2.7.7")

    // Dagger hilt
    implementation("com.google.dagger:hilt-android:2.51.1")
    ksp("com.google.dagger:hilt-compiler:2.51.1")

    // Firebase
    implementation(platform("com.google.firebase:firebase-bom:33.7.0"))
    implementation("com.google.firebase:firebase-auth")
    implementation("com.google.firebase:firebase-storage")
    implementation("com.google.firebase:firebase-messaging")
    implementation("com.google.firebase:firebase-analytics")
    implementation("com.google.firebase:firebase-crashlytics")
    implementation("com.google.firebase:firebase-appcheck-playintegrity")
    debugImplementation("com.google.firebase:firebase-appcheck-debug")

    // Coroutines for firebase
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.9.0")

    // Firestore
    implementation("com.google.firebase:firebase-firestore")

    // Color picker
    implementation("com.github.skydoves:colorpickerview:2.2.4")

    // Shimmer effect
    implementation("com.facebook.shimmer:shimmer:0.5.0")

    // Splash Screen
    implementation("androidx.core:core-splashscreen:1.0.1")

    // Firebase Functions & Chrome Custom Tabs
    implementation("com.google.firebase:firebase-functions")
    implementation("androidx.browser:browser:1.8.0")
}
