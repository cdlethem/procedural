# Field marks for Android

This is an editable Android example built from one retained field of 25,600 marks. It is a composition example, not a new library operation or a reproduction of the surveyed source sketch. Its field is motivated by `survey/out/2018/Generativos/pelines/notes.md`; the fixed choices here are part of this piece.

The controls are independent:

- **Length** switches mark extent between 16 and 32.
- **Palette** switches between the original and neon colour lists.
- **Marks** switches between lines and bars while retaining positions, headings, and colours.
- **Save PNG** writes the displayed 640×640 snapshot to `Pictures/Procedurals`.

The app requires Android API 29 or later. The pinned native validation environment uses API 33. Saving uses the Android MediaStore route and does not request storage permissions.

Prepare an installable Gradle project without launching an emulator:

```sh
python3 tools/prepare_android_field_marks.py
```

The generated project is `.work/examples/android-field-marks`. Open that directory in Android Studio, or build its debug APK with:

```sh
python3 tools/prepare_android_field_marks.py --build
```

The preparation helper uses the repository’s pinned Android SDK, Gradle, Processing Android core, and AndroidX AppCompat dependency declared by the bootstrap project. Generated projects and APKs are not source artifacts.
