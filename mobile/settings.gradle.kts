pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "FurkanSogutma"

include(":app")
include(":core:common")
include(":core:network")
include(":core:database")
include(":core:designsystem")
include(":core:navigation")
include(":domain")
include(":data")
