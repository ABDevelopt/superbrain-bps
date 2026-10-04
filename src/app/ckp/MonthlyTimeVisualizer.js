'use client';

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { 
  Edit3, 
  Trash2, 
  Clock, 
  Sparkles, 
  Check, 
  X, 
  Move, 
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import styles from './MonthlyTimeVisualizer.module.css';
import { 
  getEntrySkpIds, 
  getColorForSkp, 
  getBackgroundForSkps,
  timeStrToMinutes,
  minutesToTimeStr,
  formatDurationMins
} from './DailyTimeVisualizer';

const START_HOUR = 6;
const END_HOUR = 18;
const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60; // 720 mins

export default function MonthlyTimeVisualizer({
  entries = [],
  year,
  month,
  checkHoliday,
  checkDl,
  onStretchClick,
  onEdit,
  onDelete,
  onUpdateEntry,
  skpData = []
}) {
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [dragState, setDragState] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  const daysInMonth = new Date(year, month, 0).getDate();

  // Helper to convert minutes to percentage inside the day bar
  const getPercent = useCallback((mins) => {
    const p = ((mins - START_HOUR * 60) / TOTAL_MINUTES) * 100;
    return Math.max(0, Math.min(100, p));
  }, []);

  // Helper to check time conflicts with other entries on that date
  const checkConflict = useCallback((startMins, endMins, ignoreId, dayEntries) => {
    for (const e of dayEntries) {
      if (ignoreId && e.id === ignoreId) continue;
      const eStart = timeStrToMinutes(e.waktuMulai);
      const eEnd = timeStrToMinutes(e.waktuSelesai);
      if (Math.max(startMins, eStart) < Math.min(endMins, eEnd)) {
        return e;
      }
    }
    return null;
  }, []);

  // Handle fine-grained 15-minute nudge
  const handleNudge = async (entry, shiftMins) => {
    if (!entry || !onUpdateEntry) return;
    const s = timeStrToMinutes(entry.waktuMulai);
    const e = timeStrToMinutes(entry.waktuSelesai);
    const dur = e - s;
    const newStart = Math.max(START_HOUR * 60, Math.min(END_HOUR * 60 - dur, s + shiftMins));
    const newEnd = newStart + dur;
    const startStr = minutesToTimeStr(newStart);
    const endStr = minutesToTimeStr(newEnd);
    
    setIsSaving(true);
    try {
      await onUpdateEntry(entry.id, {
        waktuMulai: startStr,
        waktuSelesai: endStr,
        durasi: dur
      });
      setSaveSuccessMsg(`${startStr} - ${endStr}`);
      setTimeout(() => setSaveSuccessMsg(''), 2500);
      setSelectedEntry(prev => prev && prev.id === entry.id ? { ...prev, waktuMulai: startStr, waktuSelesai: endStr, durasi: dur } : prev);
    } catch (err) {
      console.error('Failed to nudge entry:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Convert clientX inside a row bar to snapped minutes
  const clientXToMinutes = (clientX, barRect) => {
    if (!barRect) return START_HOUR * 60;
    const relX = clientX - barRect.left;
    const ratio = Math.max(0, Math.min(1, relX / barRect.width));
    const rawMins = START_HOUR * 60 + ratio * TOTAL_MINUTES;
    const snapped = Math.round(rawMins / 5) * 5; // Snap to 5 mins
    return Math.max(START_HOUR * 60, Math.min(END_HOUR * 60, snapped));
  };

  // Pointer Down: Start Drag or Resize
  const handlePointerDown = (e, type, entry, dateStr, dayEntries) => {
    if (!onUpdateEntry) return;
    e.preventDefault();
    e.stopPropagation();

    const barEl = e.currentTarget.closest(`.${styles.dayBar}`);
    if (!barEl) return;
    const barRect = barEl.getBoundingClientRect();

    const pointerMins = clientXToMinutes(e.clientX, barRect);
    const startMins = timeStrToMinutes(entry.waktuMulai);
    const endMins = timeStrToMinutes(entry.waktuSelesai);

    const state = {
      type,
      entry,
      dateStr,
      dayEntries,
      barRect,
      pointerId: e.pointerId,
      initialPointerMins: pointerMins,
      initialStartMins: startMins,
      initialEndMins: endMins,
      currentStartMins: startMins,
      currentEndMins: endMins,
      hasMoved: false,
      conflictWith: checkConflict(startMins, endMins, entry.id, dayEntries)
    };

    setDragState(state);

    try {
      e.target.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  // Pointer Move
  const handlePointerMove = (e) => {
    if (!dragState) return;
    const pointerMins = clientXToMinutes(e.clientX, dragState.barRect);
    const delta = pointerMins - dragState.initialPointerMins;

    let newStart = dragState.initialStartMins;
    let newEnd = dragState.initialEndMins;

    if (dragState.type === 'move') {
      const dur = dragState.initialEndMins - dragState.initialStartMins;
      newStart = dragState.initialStartMins + delta;
      if (newStart < START_HOUR * 60) {
        newStart = START_HOUR * 60;
      } else if (newStart + dur > END_HOUR * 60) {
        newStart = END_HOUR * 60 - dur;
      }
      newEnd = newStart + dur;
    } else if (dragState.type === 'resize-start') {
      newStart = Math.min(
        dragState.initialEndMins - 15, // Min 15 mins
        Math.max(START_HOUR * 60, dragState.initialStartMins + delta)
      );
      newEnd = dragState.initialEndMins;
    } else if (dragState.type === 'resize-end') {
      newStart = dragState.initialStartMins;
      newEnd = Math.max(
        dragState.initialStartMins + 15, // Min 15 mins
        Math.min(END_HOUR * 60, dragState.initialEndMins + delta)
      );
    }

    const hasMoved = dragState.hasMoved || Math.abs(delta) >= 2;
    const conflict = checkConflict(newStart, newEnd, dragState.entry.id, dragState.dayEntries);

    setDragState((prev) =>
      prev
        ? {
            ...prev,
            currentStartMins: newStart,
            currentEndMins: newEnd,
            hasMoved,
            conflictWith: conflict
          }
        : null
    );
  };

  // Pointer Up: Commit Changes
  const handlePointerUp = async (e) => {
    if (!dragState) return;
    const current = dragState;
    setDragState(null);

    try {
      e.target.releasePointerCapture(current.pointerId);
    } catch {
      // ignore
    }

    if (!current.hasMoved) {
      // Tap or single click -> toggle / select entry details
      setSelectedEntry(prev => (prev && prev.id === current.entry.id ? null : current.entry));
      return;
    }

    const finalStart = minutesToTimeStr(current.currentStartMins);
    const finalEnd = minutesToTimeStr(current.currentEndMins);
    const finalDur = current.currentEndMins - current.currentStartMins;

    if (finalStart !== current.entry.waktuMulai || finalEnd !== current.entry.waktuSelesai) {
      setIsSaving(true);
      try {
        await onUpdateEntry(current.entry.id, {
          waktuMulai: finalStart,
          waktuSelesai: finalEnd,
          durasi: finalDur
        });
        setSaveSuccessMsg(`${finalStart} - ${finalEnd}`);
        setTimeout(() => setSaveSuccessMsg(''), 3000);
      } catch (err) {
        console.error('Failed to update entry time in monthly visualizer:', err);
      } finally {
        setIsSaving(false);
      }
    }
  };

  // Compute days list
  const days = useMemo(() => {
    const list = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dateObj = new Date(dateStr + 'T00:00:00');
      const dow = dateObj.getDay();
      if (dow === 0 || dow === 6) continue; // Skip weekend

      let coreStart = 7 * 60 + 30; // 07:30
      let coreEnd = dow === 5 ? 16 * 60 + 30 : 16 * 60; // 16:30 on Fri, 16:00 Mon-Thu

      const dayEntries = entries.filter((e) => e.tanggal === dateStr);
      const isHolidayDate = checkHoliday ? checkHoliday(dateStr) : false;
      const isDlDate = checkDl ? checkDl(dateStr) : false;

      const totalMins = dayEntries.reduce((sum, e) => {
        const s = timeStrToMinutes(e.waktuMulai);
        const eTime = timeStrToMinutes(e.waktuSelesai);
        return sum + Math.max(0, eTime - s);
      }, 0);

      // Check for gaps
      let hasGaps = false;
      if (!isHolidayDate && !isDlDate && dayEntries.length > 0) {
        const dayCoreTotal = coreEnd - coreStart;
        hasGaps = totalMins < dayCoreTotal;
      }

      list.push({
        dateStr,
        day,
        dayName: ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'][dow],
        dayEntries,
        coreLeft: `${getPercent(coreStart)}%`,
        coreWidth: `${getPercent(coreEnd) - getPercent(coreStart)}%`,
        totalJamStr: formatDurationMins(totalMins),
        isHoliday: isHolidayDate,
        isDl: isDlDate,
        hasGaps
      });
    }
    return list;
  }, [entries, year, month, daysInMonth, checkHoliday, checkDl, getPercent]);

  // Unique SKPs for the month legend
  const monthEntries = useMemo(() => {
    return entries.filter((e) => {
      if (!e.tanggal) return false;
      const [y, m] = e.tanggal.split('-').map(Number);
      return y === year && m === month;
    });
  }, [entries, year, month]);

  const uniqueSkps = useMemo(() => {
    return Array.from(
      new Set(
        monthEntries.flatMap((e) => {
          const sids = getEntrySkpIds(e);
          return sids.length > 0 ? sids : ['non-skp'];
        })
      )
    );
  }, [monthEntries]);

  // Hour markers for ruler
  const rulerHours = [6, 8, 10, 12, 14, 16, 18];

  return (
    <div 
      className={styles.container}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div className={styles.header}>
        <h4 className={styles.title}>
          <Clock size={16} /> Peta Kekosongan CKP Bulan Ini
        </h4>
        <div className={styles.headerRight}>
          {isSaving && (
            <div className={styles.savingBadge}>
              <Sparkles size={12} /> Menyimpan perubahan...
            </div>
          )}
          {saveSuccessMsg && (
            <div className={styles.saveSuccessBadge}>
              <Check size={12} /> Disimpan: {saveSuccessMsg}
            </div>
          )}
        </div>
      </div>

      <div className={styles.tipsBanner}>
        <Move size={14} style={{ color: '#818cf8', flexShrink: 0 }} />
        <span>
          <strong>Fitur Interaktif:</strong> Geser balok kegiatan ke kiri/kanan untuk menyesuaikan jam, atau tarik tepi kiri/kanan balok untuk mengatur durasi waktu secara visual.
        </span>
      </div>

      {uniqueSkps.length > 0 && (
        <div className={styles.legendRow}>
          {uniqueSkps.map((skpId) => {
            const skpItem = skpData.find(s => s.id === Number(skpId));
            return (
              <span
                key={skpId}
                className={styles.skpBadge}
                style={{
                  backgroundColor: getColorForSkp(skpId === 'non-skp' ? null : skpId)
                }}
                title={skpItem ? skpItem.nama : ''}
              >
                {skpId === 'non-skp' ? 'Non-SKP' : `SKP #${skpId}`}
                {skpItem?.nama && <span style={{ opacity: 0.85, fontWeight: 400 }}>— {skpItem.nama.substring(0, 20)}...</span>}
              </span>
            );
          })}
        </div>
      )}

      {/* Scrollable Container for Ruler & Days on Mobile */}
      <div className={styles.scrollWrapper}>
        {/* Top Ruler / Hour Labels */}
        <div className={styles.rulerRow}>
        <div className={styles.rulerLabelPlaceholder} />
        <div className={styles.rulerTrack}>
          {rulerHours.map((h) => {
            const leftPct = getPercent(h * 60);
            return (
              <div key={h} className={styles.rulerTick} style={{ left: `${leftPct}%` }}>
                <span>{String(h).padStart(2, '0')}:00</span>
                <div className={styles.rulerTickLine} />
              </div>
            );
          })}
        </div>
        <div className={styles.rulerDurasiPlaceholder} />
      </div>

      {/* Workdays List */}
      <div className={styles.daysList}>
        {days.map((d) => (
          <div
            key={d.dateStr}
            className={styles.dayRow}
            style={
              d.isHoliday
                ? { backgroundColor: 'rgba(239, 68, 68, 0.04)' }
                : d.isDl
                ? { backgroundColor: 'rgba(56, 189, 248, 0.05)' }
                : {}
            }
          >
            {/* Day Label */}
            <div className={styles.dayLabel}>
              <span>{d.dayName}, {d.day}</span>
              {d.isHoliday && <span className={styles.holidayDot} title="Hari Libur">●</span>}
              {d.isDl && <span className={styles.dlDot} title="Dinas Lapangan">● DL</span>}
            </div>

            {/* Day Timeline Track Bar */}
            <div className={styles.dayBar}>
              {/* Hour Grid Lines */}
              {rulerHours.map((h) => (
                <div
                  key={h}
                  className={styles.barHourLine}
                  style={{ left: `${getPercent(h * 60)}%` }}
                />
              ))}

              {/* Core Working Hours Boundary */}
              <div
                className={styles.coreWorkArea}
                style={{ left: d.coreLeft, width: d.coreWidth }}
                title="Jam Kerja Wajib (07:30 - Selesai)"
              />

              {/* Activity Blocks */}
              {d.dayEntries.map((entry) => {
                const isDraggingThis = dragState && dragState.entry.id === entry.id;
                const isSelected = selectedEntry && selectedEntry.id === entry.id;

                const startMins = isDraggingThis
                  ? dragState.currentStartMins
                  : timeStrToMinutes(entry.waktuMulai);
                const endMins = isDraggingThis
                  ? dragState.currentEndMins
                  : timeStrToMinutes(entry.waktuSelesai);

                const clampedStart = Math.max(START_HOUR * 60, startMins);
                const clampedEnd = Math.min(END_HOUR * 60, endMins);
                if (clampedStart >= clampedEnd) return null;

                const leftPct = getPercent(clampedStart);
                const widthPct = Math.max(1.2, getPercent(clampedEnd) - leftPct);

                const itemSkpIds = getEntrySkpIds(entry);
                const bg = getBackgroundForSkps(itemSkpIds);

                const isConflict = isDraggingThis
                  ? !!dragState.conflictWith
                  : !!checkConflict(startMins, endMins, entry.id, d.dayEntries);

                return (
                  <div
                    key={entry.id}
                    className={`
                      ${styles.activityBlock}
                      ${isDraggingThis ? styles.activityBlockDragging : ''}
                      ${isSelected ? styles.activityBlockSelected : ''}
                      ${isConflict ? styles.activityBlockConflict : ''}
                    `}
                    style={{
                      left: `${leftPct}%`,
                      width: `${widthPct}%`,
                      background: bg
                    }}
                    onPointerDown={(e) => handlePointerDown(e, 'move', entry, d.dateStr, d.dayEntries)}
                  >
                    {/* Left Resize Handle */}
                    {onUpdateEntry && (
                      <div
                        className={`${styles.resizeHandle} ${styles.resizeHandleLeft}`}
                        onPointerDown={(e) => handlePointerDown(e, 'resize-start', entry, d.dateStr, d.dayEntries)}
                        title="Tarik untuk ubah waktu mulai"
                      >
                        <div className={styles.resizeGripLine} />
                      </div>
                    )}

                    {/* Block Text Content */}
                    <div className={styles.blockContent}>
                      <span className={styles.blockTimeText}>
                        {isDraggingThis ? minutesToTimeStr(dragState.currentStartMins) : entry.waktuMulai}
                      </span>
                    </div>

                    {/* Right Resize Handle */}
                    {onUpdateEntry && (
                      <div
                        className={`${styles.resizeHandle} ${styles.resizeHandleRight}`}
                        onPointerDown={(e) => handlePointerDown(e, 'resize-end', entry, d.dateStr, d.dayEntries)}
                        title="Tarik untuk ubah waktu selesai"
                      >
                        <div className={styles.resizeGripLine} />
                      </div>
                    )}

                    {/* Live Drag Floating Badge */}
                    {isDraggingThis && (
                      <div
                        className={`
                          ${styles.dragFloatingBadge}
                          ${isConflict ? styles.dragFloatingBadgeConflict : ''}
                        `}
                      >
                        {isConflict ? (
                          <>
                            <AlertCircle size={13} style={{ color: '#f87171' }} />
                            <span>
                              Bentrok ({minutesToTimeStr(dragState.currentStartMins)} - {minutesToTimeStr(dragState.currentEndMins)})
                            </span>
                          </>
                        ) : (
                          <>
                            <Clock size={13} style={{ color: '#818cf8' }} />
                            <span>
                              {minutesToTimeStr(dragState.currentStartMins)} — {minutesToTimeStr(dragState.currentEndMins)} ({formatDurationMins(dragState.currentEndMins - dragState.currentStartMins)})
                            </span>
                          </>
                        )}
                      </div>
                    )}

                    {/* Standard Tooltip on Hover (When Not Dragging) */}
                    {!isDraggingThis && (
                      <div className={styles.tooltip}>
                        <div className={styles.tooltipTitle}>
                          <span>{entry.waktuMulai} — {entry.waktuSelesai}</span>
                          <span style={{ fontSize: '10px', color: '#94a3b8' }}>{formatDurationMins(timeStrToMinutes(entry.waktuSelesai) - timeStrToMinutes(entry.waktuMulai))}</span>
                        </div>
                        <p className={styles.tooltipRincian}>{entry.rincian}</p>
                        {isConflict && (
                          <div style={{ color: '#f87171', fontSize: '10px', marginTop: '4px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <AlertCircle size={11} />
                            <span>Terdeteksi bentrok dengan kegiatan lain</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Total Duration & Actions */}
            <div className={styles.durasiArea}>
              <span className={styles.durasiText}>{d.totalJamStr}</span>

              {/* Action buttons if row has selected entry */}
              {selectedEntry && d.dayEntries.some((e) => e.id === selectedEntry.id) ? (
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  {onUpdateEntry && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleNudge(selectedEntry, -15)}
                        className={styles.nudgeBtn}
                        title="Mundurkan 15 menit"
                      >
                        -15m
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNudge(selectedEntry, 15)}
                        className={styles.nudgeBtn}
                        title="Majukan 15 menit"
                      >
                        +15m
                      </button>
                    </>
                  )}
                  {onEdit && (
                    <button
                      type="button"
                      onClick={() => onEdit(selectedEntry)}
                      className={styles.actionIconBtn}
                      style={{ color: '#38bdf8' }}
                      title="Edit Kegiatan"
                    >
                      <Edit3 size={13} />
                    </button>
                  )}
                  {onDelete && (
                    <button
                      type="button"
                      onClick={() => onDelete(selectedEntry.id)}
                      className={styles.actionIconBtn}
                      style={{ color: '#ef4444' }}
                      title="Hapus Kegiatan"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ) : (
                !d.isHoliday && d.hasGaps && onStretchClick && (
                  <button
                    type="button"
                    onClick={() => onStretchClick(d.dateStr)}
                    className={styles.stretchBtn}
                    title="Regangkan jam kerja hari ini agar penuh"
                  >
                    <Sparkles size={11} /> Regangkan
                  </button>
                )
              )}
            </div>
          </div>
        ))}
      </div>
      </div>

      {/* Selected Entry Detail Popover */}
      {selectedEntry && (
        <div className={styles.popover}>
          <div className={styles.popoverHeader}>
            <span className={styles.popoverTitle}>Detail Kegiatan CKP</span>
            <button
              type="button"
              className={styles.popoverClose}
              onClick={() => setSelectedEntry(null)}
              title="Tutup"
            >
              <X size={16} />
            </button>
          </div>

          <div className={styles.popoverTime}>
            <Clock size={14} />
            <span>
              {selectedEntry.waktuMulai} — {selectedEntry.waktuSelesai} ({formatDurationMins(timeStrToMinutes(selectedEntry.waktuSelesai) - timeStrToMinutes(selectedEntry.waktuMulai))})
            </span>
          </div>

          <p style={{ fontSize: '12px', color: '#e2e8f0', margin: '0 0 10px 0', lineHeight: 1.4 }}>
            {selectedEntry.rincian}
          </p>

          <div className={styles.popoverMeta}>
            {getEntrySkpIds(selectedEntry).length > 0 ? (
              getEntrySkpIds(selectedEntry).map((sid) => {
                const skp = skpData.find(s => s.id === sid);
                return (
                  <span
                    key={sid}
                    className={styles.skpBadge}
                    style={{ backgroundColor: getColorForSkp(sid) }}
                    title={skp ? skp.nama : ''}
                  >
                    SKP #{sid}
                  </span>
                );
              })
            ) : selectedEntry.skpId ? (
              <span
                className={styles.skpBadge}
                style={{ backgroundColor: getColorForSkp(selectedEntry.skpId) }}
              >
                SKP #{selectedEntry.skpId}
              </span>
            ) : null}

            {selectedEntry.satuan && (
              <span style={{ fontSize: '11px', color: '#94a3b8', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '4px' }}>
                {selectedEntry.kuantitas || 1} {selectedEntry.satuan}
              </span>
            )}
            {selectedEntry.timKerja && (
              <span style={{ fontSize: '11px', color: '#a5b4fc', background: 'rgba(99,102,241,0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                {selectedEntry.timKerja}
              </span>
            )}
          </div>

          <div className={styles.popoverActions}>
            {onUpdateEntry && (
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  type="button"
                  onClick={() => handleNudge(selectedEntry, -15)}
                  className={styles.nudgeBtn}
                >
                  -15m
                </button>
                <button
                  type="button"
                  onClick={() => handleNudge(selectedEntry, 15)}
                  className={styles.nudgeBtn}
                >
                  +15m
                </button>
              </div>
            )}
            <div style={{ display: 'flex', gap: '6px' }}>
              {onEdit && (
                <button
                  type="button"
                  onClick={() => {
                    onEdit(selectedEntry);
                    setSelectedEntry(null);
                  }}
                  className={styles.actionIconBtn}
                  style={{ color: '#38bdf8' }}
                  title="Edit Lengkap"
                >
                  <Edit3 size={15} />
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={() => {
                    onDelete(selectedEntry.id);
                    setSelectedEntry(null);
                  }}
                  className={styles.actionIconBtn}
                  style={{ color: '#ef4444' }}
                  title="Hapus"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
