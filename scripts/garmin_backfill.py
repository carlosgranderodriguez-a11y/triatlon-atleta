#!/usr/bin/env python3
"""
Backfill histórico de actividades de Garmin.

A diferencia de garmin_sync.py (que corre cada día y trae sueño/HRV/RHR/
Body Battery + actividades de "ayer"), este script se lanza a mano UNA VEZ
para traer las actividades de los últimos N meses (por defecto 6) y
guardarlas en el backend, agrupadas por día.

No trae sueño/HRV/RHR históricos (Garmin no los expone de forma masiva sin
hacer una llamada por día, lo que dispararía el rate-limit/429). Solo trae
el listado de actividades (una llamada eficiente, paginada).

Variables de entorno:
  GARMIN_EMAIL, GARMIN_PASSWORD  - credenciales de Garmin Connect
  GARMIN_ATHLETE                 - ID del atleta en el backend (por defecto CGR)
  BACKFILL_MONTHS                - cuántos meses hacia atrás (por defecto 6)
"""
import os
import sys
from datetime import date, timedelta
from collections import defaultdict

import requests
import garminconnect

APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz5e_jS99e3xB-DJMbIEm3L_HXoS2rkED_o3n0_U6S2Ihnc9vJ2E0gUIcYukv4ZyVXI/exec"
ATHLETE = os.environ.get("GARMIN_ATHLETE", "CGR")
MONTHS_BACK = int(os.environ.get("BACKFILL_MONTHS", "6"))


def main():
    email = os.environ.get("GARMIN_EMAIL")
    password = os.environ.get("GARMIN_PASSWORD")
    if not email or not password:
        print("❌ Faltan GARMIN_EMAIL / GARMIN_PASSWORD en el entorno", file=sys.stderr)
        sys.exit(1)

    client = garminconnect.Garmin(email, password)
    client.login()

    cutoff = date.today() - timedelta(days=MONTHS_BACK * 30)
    print(f"Trayendo actividades desde {cutoff.isoformat()}...")

    activities = []
    start, batch = 0, 100
    while True:
        chunk = client.get_activities(start, batch)
        if not chunk:
            break
        activities.extend(chunk)
        last_date_str = (chunk[-1].get("startTimeLocal") or "")[:10]
        if last_date_str and last_date_str < cutoff.isoformat():
            break
        start += batch
        if start > 3000:  # límite de seguridad, no debería llegar aquí
            break

    by_day = defaultdict(list)
    for a in activities:
        day = (a.get("startTimeLocal") or "")[:10]
        if not day or day < cutoff.isoformat():
            continue
        by_day[day].append({
            "tipo":    (a.get("activityType") or {}).get("typeKey"),
            "dur_seg": a.get("duration"),
            "dist_m":  a.get("distance"),
            "fc_avg":  a.get("averageHR"),
            "fc_max":  a.get("maxHR"),
            "pw_avg":  a.get("avgPower"),
            "pw_max":  a.get("maxPower"),
        })

    print(f"Encontradas {len(activities)} actividades en {len(by_day)} días distintos.")

    for day, acts in sorted(by_day.items()):
        body = {"type": "garmin", "athlete": ATHLETE, "data": {"fecha": day, "actividades": acts}}
        resp = requests.post(APPS_SCRIPT_URL, json=body, timeout=30)
        print(f"{day} — {len(acts)} actividad(es) → {resp.status_code}")

    print("Backfill terminado.")


if __name__ == "__main__":
    main()
