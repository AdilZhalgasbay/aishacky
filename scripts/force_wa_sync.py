#!/usr/bin/env python3
"""
Manually triggers the WhatsApp WhatsApp Web scraper to parse messages immediately.
Usage: python3 scripts/force_wa_sync.py
"""

import sys
import asyncio
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.scheduler import check_attendance, check_incidents

async def main():
    print("🚀 Forcing manual WhatsApp Sync...")
    print("1️⃣ Checking Attendance...")
    await check_attendance()
    print("2️⃣ Checking Incidents...")
    await check_incidents()
    print("✅ Sync complete!")

if __name__ == "__main__":
    asyncio.run(main())
