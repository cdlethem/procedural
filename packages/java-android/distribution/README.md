# Android distribution templates

`tools/build_android_artifacts.py` stages these templates into ignored build directories. It compiles the Android adapter separately from the portable core, then compiles the Field Marks sample using only those JARs, the current example sources, and an externally supplied Processing Android core. It does not install or run an APK.

The generated sample ZIP includes the core and adapter JARs, its editable Java files, Gradle templates, project notices, and a README. It deliberately excludes SDKs, Gradle caches, Processing runtime core, signing keys, and generated build output.

The pinned validation inputs are Android Gradle Plugin 7.1.0, Gradle 7.4.2, SDK platform 33, build-tools 30.0.3, and AndroidX AppCompat 1.6.0. The build script accepts explicit paths for the JDK, SDK, Gradle executable, Processing Android core, portable core JAR, and Gradle cache; local `.work` locations are conveniences only.
