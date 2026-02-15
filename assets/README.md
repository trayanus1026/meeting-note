Add app icon and splash assets here so the app builds:

- **icon.png** – 1024×1024 app icon
- **splash-icon.png** – splash screen image
- **adaptive-icon.png** – 1024×1024 Android adaptive icon foreground

Quick option: create a new Expo app and copy its assets:

```bash
npx create-expo-app@latest _tmp --template tabs
cp _tmp/assets/* ./assets/
rm -rf _tmp
```

Or use your own 1024×1024 PNGs for icon and adaptive-icon, and any image for splash-icon.
