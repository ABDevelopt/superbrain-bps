/**
 * ckpAggregation.js
 * Modul utilitas murni untuk agregasi CKP, penyelarasan SKP, dan validasi butir kegiatan
 * SuperBrain BPS Penajam Paser Utara
 */

export const isSpdtEntry = (entry) => {
  if (!entry) return false;
  const text = `${entry.rincian || ''} ${entry.rkNama || ''} ${entry.buktiDukung || ''} ${entry.buktiDukungKet || ''}`;
  return /SPDT[-_ ]?NTP|\bSPDT\b/i.test(text);
};

export const getEntrySkpIds = (entry) => {
  if (!entry) return [];
  // Aturan Mutlak: Seluruh kegiatan SPDT / SPDT NTP otomatis diarahkan ke SKP #30
  if (isSpdtEntry(entry)) {
    return [30];
  }
  if (Array.isArray(entry.skpIds) && entry.skpIds.length > 0) {
    return entry.skpIds.map(Number).filter((n) => !isNaN(n) && n > 0);
  }
  if (entry.skpId !== undefined && entry.skpId !== null && entry.skpId !== '' && entry.skpId !== 'none') {
    const num = Number(entry.skpId);
    if (!isNaN(num) && num > 0) return [num];
  }
  return [];
};

export const getColorForSkp = (skpId) => {
  if (!skpId || isNaN(Number(skpId)) || Number(skpId) === 0) return 'rgba(148, 163, 184, 0.85)';
  const hue = (Number(skpId) * 137.5) % 360;
  return `hsla(${hue}, 75%, 52%, 0.88)`;
};

export const getBackgroundForSkps = (skpIds) => {
  if (!skpIds || skpIds.length === 0) return 'rgba(148, 163, 184, 0.85)';
  if (skpIds.length === 1) return getColorForSkp(skpIds[0]);
  const c1 = getColorForSkp(skpIds[0]);
  const c2 = getColorForSkp(skpIds[1]);
  return `linear-gradient(135deg, ${c1}, ${c2})`;
};

export const timeStrToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

export const aggregateCkpBySkpAndSatuan = (monthEntries = [], skpData = []) => {
  const aggregated = {};
  const sortedData = [...monthEntries].sort((a, b) => {
    if (a.tanggal !== b.tanggal) return (a.tanggal || '').localeCompare(b.tanggal || '');
    return (a.waktuMulai || '').localeCompare(b.waktuMulai || '');
  });

  sortedData.forEach(e => {
    const isSpdt = isSpdtEntry(e);
    const entrySkps = isSpdt ? [30] : getEntrySkpIds(e);
    const keys = entrySkps.length > 0 ? entrySkps : [e.skpId || 'none'];
    const rawSatuan = isSpdt ? 'Kegiatan' : (e.satuan || 'Kegiatan').trim();
    const satuan = rawSatuan ? (rawSatuan.charAt(0).toUpperCase() + rawSatuan.slice(1)) : 'Kegiatan';

    keys.forEach(skpKey => {
      const groupKey = `${skpKey}:::${satuan.toLowerCase()}`;
      if (!aggregated[groupKey]) {
        const skpItem = (skpData || []).find(s => String(s.id) === String(skpKey) || String(s.skpId) === String(skpKey));
        const kategori = (Number(skpKey) === 30) ? 'utama' : (skpItem ? (skpItem.kategori || 'utama') : 'utama');
        const defaultName = (Number(skpKey) === 30)
          ? 'Terlaksananya Pelaksanaan Survei Penyusunan Diagram Timbang Nilai Tukar Petani (SPDT-NTP) Tahun 2026 sesuai SOP'
          : (skpKey === 'none' ? 'Kegiatan Tanpa SKP' : `SKP #${skpKey}`);
        aggregated[groupKey] = {
          skpKey,
          skpId: skpKey,
          nama: skpItem ? skpItem.nama : defaultName,
          satuan: satuan,
          kategori: kategori,
          kuantitas: 0
        };
      }
      const qty = (e.kuantitas !== undefined && e.kuantitas !== null && !isNaN(Number(e.kuantitas))) ? Number(e.kuantitas) : 1;
      aggregated[groupKey].kuantitas += qty;
    });
  });

  const sortKeys = (keys) => {
    return [...keys].sort((a, b) => {
      const itemA = aggregated[a];
      const itemB = aggregated[b];
      const idA = Number(itemA.skpKey) || 999999;
      const idB = Number(itemB.skpKey) || 999999;
      if (idA !== idB) return idA - idB;
      return (itemA.satuan || '').localeCompare(itemB.satuan || '');
    });
  };

  const utamaKeys = sortKeys(Object.keys(aggregated).filter(k => aggregated[k].kategori === 'utama'));
  const tambahanKeys = sortKeys(Object.keys(aggregated).filter(k => aggregated[k].kategori === 'tambahan'));
  const allSortedKeys = [...utamaKeys, ...tambahanKeys];

  return {
    aggregated,
    utamaKeys,
    tambahanKeys,
    allSortedKeys
  };
};
