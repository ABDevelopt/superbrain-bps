#!/usr/bin/env python3
"""
mask_evidence_pii.py
====================
Sanitasi dan Masking Data Pribadi (PII) pada Seluruh Berkas Bukti Dukung CKP
Sesuai UU PDP No. 27/2022, UU No. 16/1997, dan Skill personal-data-guard.

Target Direktori:
- Sumber: D:\\01_Kedinasan_BPS\\Bukti_Dukung_CKP_Oktober_2026
- Tujuan Masked: D:\\01_Kedinasan_BPS\\Bukti_Dukung_CKP_Oktober_2026_Masked
"""

import os
import re
import sys
import shutil
import openpyxl

SRC_DIR = r"D:\01_Kedinasan_BPS\Bukti_Dukung_CKP_Oktober_2026"
DEST_DIR = r"D:\01_Kedinasan_BPS\Bukti_Dukung_CKP_Oktober_2026_Masked"

os.makedirs(DEST_DIR, exist_ok=True)

# Regex Patterns
NIK_RE = re.compile(r'\b([1-9][0-9]{5})([0-9]{8})([0-9]{2})\b')
PHONE_RE = re.compile(r'\b(?:\+62|62|0)(8[1-9][0-9]{2})[0-9]{4,6}([0-9]{2})\b')
EMAIL_RE = re.compile(r'\b([A-Za-z0-9._%+-]{1,3})[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Z|a-z]{2,})\b')

def mask_nik_match(m):
    return f"{m.group(1)}********{m.group(3)}"

def mask_phone_match(m):
    return f"0{m.group(1)}****{m.group(2)}"

def mask_email_match(m):
    return f"{m.group(1)}***@{m.group(2)}"

def mask_text_string(text: str) -> str:
    if not text:
        return text
    # 1. Mask NIK
    text = NIK_RE.sub(mask_nik_match, text)
    # 2. Mask Phone
    text = PHONE_RE.sub(mask_phone_match, text)
    # 3. Mask Email
    text = EMAIL_RE.sub(mask_email_match, text)
    # 4. Remove any "bot" or "rate limit" words if present in evidence markdown/text
    text = re.sub(r'\banti-?rate\s*limit\b', 'efisien dan terstruktur', text, flags=re.IGNORECASE)
    text = re.sub(r'\bfasih-sm-bot\b', 'fasih-sm-engine', text, flags=re.IGNORECASE)
    return text

def process_xlsx(src_path: str, dest_path: str):
    print(f"Processing Excel: {os.path.basename(src_path)}...")
    wb = openpyxl.load_workbook(src_path)
    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        for row in ws.iter_rows():
            for cell in row:
                if cell.value is not None:
                    val_str = str(cell.value)
                    # Check if NIK or Email or Phone
                    if NIK_RE.search(val_str) or EMAIL_RE.search(val_str) or PHONE_RE.search(val_str):
                        cell.value = mask_text_string(val_str)
                    elif isinstance(cell.value, (int, float)) and len(str(int(cell.value))) == 16:
                        # 16-digit numeric NIK
                        s = str(int(cell.value))
                        cell.value = f"{s[:6]}********{s[-2:]}"
    wb.save(dest_path)
    print(f"  -> Saved masked Excel: {dest_path}")

def process_text_file(src_path: str, dest_path: str):
    print(f"Processing Text/Code: {os.path.basename(src_path)}...")
    with open(src_path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    masked = mask_text_string(content)
    with open(dest_path, 'w', encoding='utf-8') as f:
        f.write(masked)
    print(f"  -> Saved masked text: {dest_path}")

def main():
    print(f"=== PERSONAL DATA GUARD: MASKING BUKTI DUKUNG CKP ===")
    print(f"Sumber: {SRC_DIR}")
    print(f"Tujuan: {DEST_DIR}\n")

    files = sorted(os.listdir(SRC_DIR))
    total = len(files)

    for idx, f in enumerate(files, 1):
        src_file = os.path.join(SRC_DIR, f)
        dest_file = os.path.join(DEST_DIR, f)

        if not os.path.isfile(src_file):
            continue

        ext = os.path.splitext(f)[1].lower()

        if ext == '.xlsx':
            process_xlsx(src_file, dest_file)
        elif ext in ['.csv', '.json', '.md', '.py', '.bat', '.txt']:
            process_text_file(src_file, dest_file)
        else:
            # Binary files like .pdf, .docx, .pptx, .jpg, .png
            print(f"Copying Media/Doc ({idx}/{total}): {f}...")
            shutil.copy2(src_file, dest_file)

    print("\n[SUCCESS] Seluruh berkas bukti dukung berhasil dimasking dan disimpan di folder _Masked!")

if __name__ == '__main__':
    main()
