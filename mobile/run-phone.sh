#!/bin/bash
# =============================================
# TerritoryRun — Run on Physical Android Device
# =============================================
# Instructions:
#   1. On phone: Settings → Developer Options → Wireless debugging → Pair with code
#   2. Run: adb pair <IP>:<PAIRING_PORT>  (enter 6-digit code)
#   3. Run this script

ADB=/Users/skanakmegha/Library/Android/sdk/platform-tools/adb

echo "📱 Checking connected devices..."
$ADB devices

echo ""
echo "If your phone is NOT listed above:"
echo "  1. Get your phone's Wireless Debugging pairing IP:PORT"
echo "  2. Run: $ADB pair <IP>:<PORT>"
echo "  3. Then run this script again"
echo ""

DEVICE_COUNT=$($ADB devices | grep -v "emulator" | grep "device$" | wc -l | tr -d ' ')

if [ "$DEVICE_COUNT" -eq "0" ]; then
    echo "❌ No physical device found. Please connect your phone first."
    exit 1
fi

echo "✅ Phone detected! Starting TerritoryRun..."
echo "   API: http://192.168.0.106:5001"
echo ""

cd /Users/skanakmegha/Documents/MEGHA/Personal-Development/TerritoryRun/mobile
DEVICE_TARGET="phone" npx expo run:android
