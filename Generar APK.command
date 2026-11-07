#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
export JAVA_HOME=/opt/homebrew/opt/openjdk@21
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
npm run build:apk
npx cap sync android
cd android
./gradlew assembleDebug bundleRelease
mkdir -p "../Para Play"
cp -f app/build/outputs/apk/debug/app-debug.apk "../Para Play/Medicalabs-ver.apk"
cp -f app/build/outputs/bundle/release/app-release.aab "../Para Play/Medicalabs-play.aab"
open "../Para Play"
