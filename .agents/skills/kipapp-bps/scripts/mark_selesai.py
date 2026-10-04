#!/usr/bin/env python3
"""
mark_selesai.py
Skrip otomatisasi untuk menandai seluruh Rencana Kinerja (RK) pada suatu SKP KIPAPP BPS
menjadi status 'Selesai' (isselesai: 1) via endpoint form-urlencoded PUT /api/v1/skp/rk.

Penggunaan:
  python mark_selesai.py --skpid <SKP_ID> --token <JWT_TOKEN>
"""

import argparse
import sys
import time
import requests

# Ensure UTF-8 output on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE_URL = "https://kipapp.bps.go.id"

def main():
    parser = argparse.ArgumentParser(description="Tandai Selesai seluruh RK pada SKP KIPAPP BPS")
    parser.add_argument("--skpid", required=True, help="ID SKP (misal: 1439745)")
    parser.add_argument("--token", required=True, help="JWT Token SSO KIPAPP")
    args = parser.parse_args()

    headers_json = {
        "Authorization": f"Bearer {args.token}",
        "Accept": "application/json, text/plain, */*"
    }
    headers_form = {
        "Authorization": f"Bearer {args.token}",
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json, text/plain, */*"
    }

    # 1. Fetch current RK list
    url_get = f"{BASE_URL}/api/v1/skp/rk?skpid={args.skpid}&direct=1"
    res_get = requests.get(url_get, headers=headers_json)
    if res_get.status_code != 200:
        print(f"Error mengambil daftar RK: {res_get.status_code} - {res_get.text}")
        sys.exit(1)

    rks = res_get.json()
    print(f"Total RK ditemukan pada SKP {args.skpid}: {len(rks)}")

    success_count = 0
    fail_count = 0

    for idx, rk in enumerate(rks):
        rkid = str(rk.get("rkid"))
        rk_text = rk.get("rencanakinerja", "")
        ketjenis = rk.get("ketjenis", "Utama")
        jenis = 2 if ketjenis == "Tambahan" or rk.get("jeniskinerja") == 2 else 1
        lingkupid = rk.get("lingkupid")
        if lingkupid is None:
            lingkupid = ""

        current_tgl = rk.get("tglselesai")
        if current_tgl:
            print(f"[{idx+1}/{len(rks)}] RK {rkid} sudah bertanggal selesai: {current_tgl}")
            success_count += 1
            continue

        payload = {
            "id": rkid,
            "skpid": args.skpid,
            "jenis": jenis,
            "rencanakinerja": rk_text,
            "lingkupid": lingkupid,
            "isselesai": 1
        }

        res_put = requests.put(f"{BASE_URL}/api/v1/skp/rk", headers=headers_form, data=payload)
        if res_put.status_code == 200 and res_put.json().get("status"):
            print(f"[{idx+1}/{len(rks)}] OK RK {rkid} ({ketjenis}): {rk_text[:40]}")
            success_count += 1
        else:
            print(f"[{idx+1}/{len(rks)}] GAGAL RK {rkid}: {res_put.status_code} - {res_put.text}")
            fail_count += 1

        time.sleep(0.1)

    print(f"\nSelesai: {success_count} berhasil, {fail_count} gagal.")

if __name__ == "__main__":
    main()
