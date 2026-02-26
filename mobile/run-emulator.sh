#!/bin/bash
# =============================================
# TerritoryRun — Run on Android EMULATOR
# =============================================
# This script targets the emulator (10.0.2.2 API URL)

echo "🖥️  Starting on Android Emulator..."
echo "    API: http://10.0.2.2:5001"
echo ""

# Set API target to emulator
export DEVICE_TARGET="emulator"

cd /Users/skanakmegha/Documents/MEGHA/Personal-Development/TerritoryRun/mobile
npx expo run:android --device emulator-5554
