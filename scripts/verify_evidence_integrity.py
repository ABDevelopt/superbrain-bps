import json, os

with open('data/superbrain-ckp-oktober-2026.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

dest_dir = r'D:\01_Kedinasan_BPS\Bukti_Dukung_CKP_Oktober_2026'

print('Checking all 44 activities against physical files on disk:\n')
missing = []
stubs = []
authentic = []

for i, e in enumerate(d['data']['ckp']):
    fname = e['buktiDukung']
    fpath = os.path.join(dest_dir, fname)
    if not os.path.exists(fpath):
        # Check alternative extension
        base = os.path.splitext(fname)[0]
        alt = None
        for ext in ['.xlsx', '.csv', '.json', '.md', '.docx', '.pdf', '.png', '.jpg', '.zip', '.py', '.bat']:
            cand = os.path.join(dest_dir, base + ext)
            if os.path.exists(cand):
                alt = base + ext
                break
        if alt:
            missing.append((i+1, e['id'], fname, f'Alternative exists: {alt} ({os.path.getsize(os.path.join(dest_dir, alt)):,} bytes)'))
        else:
            missing.append((i+1, e['id'], fname, 'NOT FOUND'))
    else:
        sz = os.path.getsize(fpath)
        if sz < 1000 and not fname.endswith(('.bat', '.py', '.md')):
            stubs.append((i+1, e['id'], fname, sz))
        else:
            authentic.append((i+1, e['id'], fname, sz))

print(f'Authentic / Large files: {len(authentic)}')
for item in authentic:
    print(f'  [OK] #{item[0]} {item[2]} ({item[3]:,} bytes)')

print(f'\nStubs (<1KB): {len(stubs)}')
for item in stubs:
    print(f'  [STUB] #{item[0]} {item[2]} ({item[3]:,} bytes)')

print(f'\nMissing / Extension mismatch: {len(missing)}')
for item in missing:
    print(f'  [MISMATCH] #{item[0]} {item[2]} -> {item[3]}')
