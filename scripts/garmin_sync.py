#!/usr/bin/env python3
"""
Sincroniza los datos diarios de Garmin Connect de Nacho con el backend
de la app de triatlón (Google Apps Script + Sheets).

Se ejecuta automáticamente cada día vía GitHub Actions
(ver .github/workflows/garmin-sync.yml) — no requiere que ningún
ordenador esté encendido.

Variables de entorno requeridas (se pasan como GitHub Secrets, NUNCA
en texto plano en este archivo):
  GARMIN_EMAIL     - email de la cuenta de Garmin Connect de Nacho
  GARMIN_PASSWORD  - contraseña de esa cuenta
"""
import os
import sys
import json
from datetime import date, timedelta

import requests
import garminconnect

APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz5e_jS99e3xB-DJMbIEm3L_HXoS2rkED_o3n0_U6S2Ihnc9vJ2E0gUIcYukv4ZyVXI/exec"
# El atleta también se controla por Secret (GARMIN_ATHLETE), así puedes probar
# con tu propia cuenta ("CGR") antes de apuntar esto a la cuenta de Nacho.
ATHLETE = os.environ.get("GARMIN_ATHLETE", "CGR")


def safe(fn, label):
    """Ejecuta fn() y no rompe todo el script si Garmin no tiene ese dato hoy."""
    try:
        return fn()
    except Exception as e:
        print(f"⚠️  Aviso: no se pudo leer '{label}' ({e})", file=sys.stderr)
        return None


def fmt_local_ts(ms):
    """Convierte un timestamp 'Local' de Garmin (ms) a 'HH:MM'."""
    if not ms:
        return None
    from datetime import datetime, timezone
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).strftime("%H:%M")


def main():
    email = os.environ.get("GARMIN_EMAIL")
    password = os.environ.get("GARMIN_PASSWORD")
    if not email or not password:
        print("❌ Faltan GARMIN_EMAIL / GARMIN_PASSWORD en el entorno", file=sys.stderr)
        sys.exit(1)

    client = garminconnect.Garmin(email, password)
    client.login()

    # Los datos de sueño/HRV/Body Battery de la noche corresponden al día "de ayer"
    d = (date.today() - timedelta(days=1)).isoformat()
    today = date.today().isoformat()

    payload = {"fecha": d}

    sleep = safe(lambda: client.get_sleep_data(d), "sueño")
    if sleep:
        dto = sleep.get("dailySleepDTO") or {}
        payload["sleep_score"] = (dto.get("sleepScores") or {}).get("overall", {}).get("value")
        payload["sleep_total_min"] = (dto.get("sleepTimeSeconds") or 0) // 60
        payload["sleep_deep_min"]  = (dto.get("deepSleepSeconds") or 0) // 60
        payload["sleep_light_min"] = (dto.get("lightSleepSeconds") or 0) // 60
        payload["sleep_rem_min"]   = (dto.get("remSleepSeconds") or 0) // 60
        payload["sleep_awake_min"] = (dto.get("awakeSleepSeconds") or 0) // 60
        payload["sleep_start"] = fmt_local_ts(dto.get("sleepStartTimestampLocal") or dto.get("sleepStartTimestampGMT"))
        payload["sleep_end"]   = fmt_local_ts(dto.get("sleepEndTimestampLocal") or dto.get("sleepEndTimestampGMT"))

    hrv = safe(lambda: client.get_hrv_data(d), "HRV")
    if hrv:
        payload["hrv_last_night_avg"] = (hrv.get("hrvSummary") or {}).get("lastNightAvg")

    rhr = safe(lambda: client.get_rhr_day(d), "FC reposo")
    if rhr:
        try:
            metrics = rhr["allMetrics"]["metricsMap"]["WELLNESS_RESTING_HEART_RATE"]
            payload["rhr"] = metrics[0]["value"] if metrics else None
        except Exception:
            pass

    bb = safe(lambda: client.get_body_battery(d, d), "Body Battery")
    if bb:
        try:
            vals = [p[1] for p in bb[0].get("bodyBatteryValuesArray", []) if p[1] is not None]
            if vals:
                payload["body_battery_min"] = min(vals)
                payload["body_battery_max"] = max(vals)
        except Exception:
            pass

    activities = safe(lambda: client.get_activities_by_date(d, today), "actividades")
    if activities:
        acts = []
        for a in activities:
            acts.append({
                "tipo":    (a.get("activityType") or {}).get("typeKey"),
                "dur_seg": a.get("duration"),
                "dist_m":  a.get("distance"),
                "fc_avg":  a.get("averageHR"),
                "fc_max":  a.get("maxHR"),
                "pw_avg":  a.get("avgPower"),
                "pw_max":  a.get("maxPower"),
            })
        payload["actividades"] = acts

    body = {"type": "garmin", "athlete": ATHLETE, "data": payload}
    resp = requests.post(APPS_SCRIPT_URL, json=body, timeout=30)
    print("Respuesta backend:", resp.status_code, resp.text[:300])
    resp.raise_for_status()


if __name__ == "__main__":
    main()
