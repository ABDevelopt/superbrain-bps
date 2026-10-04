#!/usr/bin/env python3
"""
verify_skp.py
Skrip audit kelayakan pengiriman SKP KIPAPP BPS (Checklist 5 Pilar).

Penggunaan:
  python verify_skp.py --skpid <SKP_ID> --token <JWT_TOKEN>
"""

import argparse
import sys
import requests

# Ensure UTF-8 output on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE_URL = "https://kipapp.bps.go.id"

def main():
    parser = argparse.ArgumentParser(description="Audit kesiapan pengiriman SKP KIPAPP BPS")
    parser.add_argument("--skpid", required=True, help="ID SKP (misal: 1439745)")
    parser.add_argument("--token", required=True, help="JWT Token SSO KIPAPP")
    args = parser.parse_args()

    headers = {
        "Authorization": f"Bearer {args.token}",
        "Accept": "application/json, text/plain, */*"
    }

    print(f"=== AUDIT KESIAPAN PENGIRIMAN SKP (ID: {args.skpid}) ===")

    # 1. Audit RK & IKI
    res_rks = requests.get(f"{BASE_URL}/api/v1/skp/rk?skpid={args.skpid}&direct=1", headers=headers)
    if res_rks.status_code != 200:
        print(f"Gagal mengambil RK: {res_rks.status_code}")
        sys.exit(1)
    
    rks = res_rks.json()
    total_rk = len(rks)
    rk_tanpa_iki = [r for r in rks if (r.get("jmliki") or 0) < 1]
    rk_tanpa_selesai = [r for r in rks if not r.get("tglselesai")]

    print(f"1. Total Rencana Kinerja (RK) : {total_rk}")
    print(f"   - RK memiliki IKI         : {total_rk - len(rk_tanpa_iki)}/{total_rk} " + ("[OK]" if not rk_tanpa_iki else f"[FAIL] {len(rk_tanpa_iki)} RK TANPA IKI"))
    print(f"   - RK status Selesai       : {total_rk - len(rk_tanpa_selesai)}/{total_rk} " + ("[OK]" if not rk_tanpa_selesai else f"[FAIL] {len(rk_tanpa_selesai)} BELUM SELESAI"))

    if rk_tanpa_iki:
        for r in rk_tanpa_iki:
            print(f"     -> RK Tanpa IKI: {r.get('rkid')} - {r.get('rencanakinerja')[:40]}")
    
    # 2. Audit Kegiatan
    res_keg = requests.get(f"{BASE_URL}/api/v1/kegiatan?skpid={args.skpid}", headers=headers)
    keg_data = res_keg.json()
    list_keg = keg_data if isinstance(keg_data, list) else keg_data.get("data", [])
    total_keg = len(list_keg)

    keg_tanpa_dok = [k for k in list_keg if not k.get("datadukung")]
    keg_belum_kirim = [k for k in list_keg if not k.get("tanggalkirim")]

    print(f"2. Total Realisasi Kegiatan   : {total_keg}")
    print(f"   - Kelengkapan Bukti Dukung: {total_keg - len(keg_tanpa_dok)}/{total_keg} " + ("[OK 100%]" if not keg_tanpa_dok else f"[FAIL] {len(keg_tanpa_dok)} TANPA BUKTI"))
    print(f"   - Status Kirim ke Atasan  : {total_keg - len(keg_belum_kirim)}/{total_keg} " + ("[OK 100%]" if not keg_belum_kirim else f"[FAIL] {len(keg_belum_kirim)} BELUM DIKIRIM"))

    print("\n=== KESIMPULAN AUDIT ===")
    siap_kirim = (len(rk_tanpa_iki) == 0 and len(rk_tanpa_selesai) == 0 and len(keg_tanpa_dok) == 0 and len(keg_belum_kirim) == 0)
    if siap_kirim:
        print("[SUKSES] SKP 100% MEMENUHI SYARAT! Siap diklik 'Kirim SKP untuk dinilai' pada menu SKP Periodik.")
    else:
        print("[PERHATIAN] SKP BELUM LENGKAP. Silakan selesaikan catatan di atas sebelum mengirim SKP.")

if __name__ == "__main__":
    main()
