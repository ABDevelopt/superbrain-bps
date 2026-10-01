'use client';

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Clock, AlertTriangle, Edit3, X, Move, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import styles from './DailyTimeVisualizer.module.css';

const DEFAULT_START_HOUR = 6;
const DEFAULT_END_HOUR = 18;

export const getEntrySkpIds = (entry) => {
  if (!entry) return [];
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

const timeStrToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

const minutesToTimeStr = (mins) => {
  const clamped = Math.max(0, Math.min(24 * 60, mins));
  const h = Math.floor(clamped / 60);
  const m = Math.floor(clamped % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const formatDurationMins = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} mnt`;
  if (m === 0) return `${h} jam`;
  return `${h}j ${m}m`;
};

export default function DailyTimeVisualizer({
  entries = [],
  date,
  highlightStart,
  highlightEnd,
  onTimeChange,
  onUpdateEntry,
  onEdit,
  readOnly = false
}) {
  const barRef = useRef(null);
  const [dragState, setDragState] = useState(null);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  // Dynamically compute hour bounds if any activity is outside 06:00 - 18:00
  const { minHour, maxHour } = useMemo(() => {
    let min = DEFAULT_START_HOUR;
    let max = DEFAULT_END_HOUR;

    entries.forEach((e) => {
      if (e.waktuMulai) {
        const [h] = e.waktuMulai.split(':').map(Number);
        if (!isNaN(h) && h < min) min = Math.max(0, h);
      }
      if (e.waktuSelesai) {
        const [h, m] = e.waktuSelesai.split(':').map(Number);
        if (!isNaN(h)) {
          const ceilH = m > 0 ? h + 1 : h;
          if (ceilH > max) max = Math.min(24, ceilH);
        }
      }
    });

    if (highlightStart) {
      const [h] = highlightStart.split(':').map(Number);
      if (!isNaN(h) && h < min) min = Math.max(0, h);
    }
    if (highlightEnd) {
      const [h, m] = highlightEnd.split(':').map(Number);
      if (!isNaN(h)) {
        const ceilH = m > 0 ? h + 1 : h;
        if (ceilH > max) max = Math.min(24, ceilH);
      }
    }

    return { minHour: min, maxHour: max };
  }, [entries, highlightStart, highlightEnd]);

  const totalHours = maxHour - minHour;
  const totalMinutes = totalHours * 60;

  // Convert minutes into left percentage
  const getPercent = useCallback(
    (mins) => {
      const p = ((mins - minHour * 60) / totalMinutes) * 100;
      return Math.max(0, Math.min(100, p));
    },
    [minHour, totalMinutes]
  );

  // Convert clientX to snapped minutes (step = 5 mins)
  const clientXToMinutes = useCallback(
    (clientX, step = 5) => {
      if (!barRef.current) return minHour * 60;
      const rect = barRef.current.getBoundingClientRect();
      const relX = clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, relX / rect.width));
      const rawMins = minHour * 60 + ratio * totalMinutes;
      const snapped = Math.round(rawMins / step) * step;
      return Math.max(minHour * 60, Math.min(maxHour * 60, snapped));
    },
    [minHour, maxHour, totalMinutes]
  );

  // Core working hours calculation
  const targetDate = useMemo(() => (date ? new Date(date + 'T00:00:00') : new Date()), [date]);
  const dow = targetDate.getDay();
  let coreStart = null;
  let coreEnd = null;
  if (dow >= 1 && dow <= 4) {
    coreStart = 7 * 60 + 30; // 07:30
    coreEnd = 16 * 60; // 16:00
  } else if (dow === 5) {
    coreStart = 7 * 60 + 30; // 07:30
    coreEnd = 16 * 60 + 30; // 16:30
  }

  const coreLeft = coreStart !== null ? getPercent(coreStart) : null;
  const coreWidth = coreStart !== null && coreEnd !== null ? getPercent(coreEnd) - coreLeft : null;

  // Detect conflicts with other entries
  const checkConflict = useCallback(
    (startMins, endMins, ignoreId = null) => {
      for (const e of entries) {
        if (ignoreId && e.id === ignoreId) continue;
        const eStart = timeStrToMinutes(e.waktuMulai);
        const eEnd = timeStrToMinutes(e.waktuSelesai);
        // Overlap condition: max(start1, start2) < min(end1, end2)
        if (Math.max(startMins, eStart) < Math.min(endMins, eEnd)) {
          return e;
        }
      }
      return null;
    },
    [entries]
  );

  // Pointer Down Handler
  const handlePointerDown = (e, type, target) => {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();

    const pointerMins = clientXToMinutes(e.clientX);
    let startMins = 0;
    let endMins = 0;
    let targetId = null;
    let entryObj = null;

    if (target === 'highlight') {
      targetId = 'highlight';
      startMins = timeStrToMinutes(highlightStart || '08:00');
      endMins = timeStrToMinutes(highlightEnd || '09:00');
    } else if (target) {
      targetId = target.id;
      entryObj = target;
      startMins = timeStrToMinutes(target.waktuMulai);
      endMins = timeStrToMinutes(target.waktuSelesai);
    } else if (type === 'select-range') {
      if (!onTimeChange) return;
      targetId = 'highlight';
      startMins = pointerMins;
      endMins = Math.min(maxHour * 60, pointerMins + 30);
    }

    const state = {
      type,
      targetId,
      entry: entryObj,
      initialPointerMins: pointerMins,
      initialStartMins: startMins,
      initialEndMins: endMins,
      currentStartMins: startMins,
      currentEndMins: endMins,
      hasMoved: false,
      pointerId: e.pointerId,
      conflictWith: checkConflict(startMins, endMins, targetId === 'highlight' ? null : targetId)
    };

    setDragState(state);

    try {
      e.target.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  // Pointer Move Handler
  const handlePointerMove = (e) => {
    if (!dragState) return;
    const pointerMins = clientXToMinutes(e.clientX);
    const delta = pointerMins - dragState.initialPointerMins;

    let newStart = dragState.initialStartMins;
    let newEnd = dragState.initialEndMins;

    if (dragState.type === 'move') {
      const dur = dragState.initialEndMins - dragState.initialStartMins;
      newStart = dragState.initialStartMins + delta;
      if (newStart < minHour * 60) {
        newStart = minHour * 60;
      } else if (newStart + dur > maxHour * 60) {
        newStart = maxHour * 60 - dur;
      }
      newEnd = newStart + dur;
    } else if (dragState.type === 'resize-start') {
      newStart = Math.min(
        dragState.initialEndMins - 5,
        Math.max(minHour * 60, dragState.initialStartMins + delta)
      );
      newEnd = dragState.initialEndMins;
    } else if (dragState.type === 'resize-end') {
      newStart = dragState.initialStartMins;
      newEnd = Math.max(
        dragState.initialStartMins + 5,
        Math.min(maxHour * 60, dragState.initialEndMins + delta)
      );
    } else if (dragState.type === 'select-range') {
      newStart = Math.min(dragState.initialStartMins, pointerMins);
      newEnd = Math.max(dragState.initialStartMins, pointerMins);
      if (newEnd === newStart) {
        newEnd = Math.min(maxHour * 60, newStart + 15);
      }
    }

    const hasMoved = dragState.hasMoved || Math.abs(delta) >= 2;
    const conflict = checkConflict(newStart, newEnd, dragState.targetId === 'highlight' ? null : dragState.targetId);

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

    // If dragging highlight block in input form, update in real-time
    if (dragState.targetId === 'highlight' && onTimeChange) {
      onTimeChange(minutesToTimeStr(newStart), minutesToTimeStr(newEnd));
    }
  };

  // Pointer Up Handler
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
      // Tap or single click -> open details/nudge popover
      if (current.entry) {
        setSelectedEntry(current.entry);
      }
      return;
    }

    const finalStart = minutesToTimeStr(current.currentStartMins);
    const finalEnd = minutesToTimeStr(current.currentEndMins);
    const finalDur = current.currentEndMins - current.currentStartMins;

    if (current.targetId === 'highlight') {
      if (onTimeChange) {
        onTimeChange(finalStart, finalEnd);
      }
    } else if (current.entry && onUpdateEntry) {
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
          console.error('Failed to update entry time:', err);
        } finally {
          setIsSaving(false);
        }
      }
    }
  };

  // Quick Nudge Button Handler (+/- 15 mins, +/- 30 mins)
  const handleNudge = async (entry, shiftMins, changeDuration = false) => {
    if (!entry || !onUpdateEntry) return;
    const s = timeStrToMinutes(entry.waktuMulai);
    const e = timeStrToMinutes(entry.waktuSelesai);
    const dur = e - s;

    let newStart = s;
    let newEnd = e;

    if (changeDuration) {
      newEnd = Math.max(s + 5, Math.min(maxHour * 60, e + shiftMins));
    } else {
      newStart = Math.max(minHour * 60, Math.min(maxHour * 60 - dur, s + shiftMins));
      newEnd = newStart + dur;
    }

    const startStr = minutesToTimeStr(newStart);
    const endStr = minutesToTimeStr(newEnd);
    const newDur = newEnd - newStart;

    setIsSaving(true);
    try {
      await onUpdateEntry(entry.id, {
        waktuMulai: startStr,
        waktuSelesai: endStr,
        durasi: newDur
      });
      setSelectedEntry((prev) =>
        prev && prev.id === entry.id
          ? { ...prev, waktuMulai: startStr, waktuSelesai: endStr, durasi: newDur }
          : prev
      );
      setSaveSuccessMsg(`${startStr} - ${endStr}`);
      setTimeout(() => setSaveSuccessMsg(''), 3000);
    } catch (err) {
      console.error('Failed to nudge time:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Prepare existing blocks
  const blocks = useMemo(() => {
    return entries
      .map((entry) => {
        const isDraggingThis = dragState && dragState.targetId === entry.id;
        const startMins = isDraggingThis ? dragState.currentStartMins : timeStrToMinutes(entry.waktuMulai);
        const endMins = isDraggingThis ? dragState.currentEndMins : timeStrToMinutes(entry.waktuSelesai);

        if (startMins >= endMins) return null;

        const left = getPercent(startMins);
        const width = getPercent(endMins) - left;
        const isConflict =
          (isDraggingThis && dragState.conflictWith) ||
          checkConflict(startMins, endMins, entry.id);

        const itemSkpIds = getEntrySkpIds(entry);
        const bg = getBackgroundForSkps(itemSkpIds);

        return {
          entry,
          id: entry.id,
          skpIds: itemSkpIds,
          startMins,
          endMins,
          left: `${left}%`,
          width: `${Math.max(1.2, width)}%`,
          color: bg,
          isDragging: isDraggingThis,
          isConflict: !!isConflict,
          conflictWith: isConflict
        };
      })
      .filter(Boolean);
  }, [entries, dragState, getPercent, checkConflict]);

  // Prepare highlight block (for input form)
  const highlightInfo = useMemo(() => {
    if (!highlightStart || !highlightEnd) return null;
    const isDraggingHighlight = dragState && dragState.targetId === 'highlight';
    const sMins = isDraggingHighlight ? dragState.currentStartMins : timeStrToMinutes(highlightStart);
    const eMins = isDraggingHighlight ? dragState.currentEndMins : timeStrToMinutes(highlightEnd);

    if (sMins >= eMins) return null;

    const left = getPercent(sMins);
    const width = getPercent(eMins) - left;
    const isConflict = checkConflict(sMins, eMins, null);

    return {
      startMins: sMins,
      endMins: eMins,
      left: `${left}%`,
      width: `${Math.max(1.2, width)}%`,
      isDragging: isDraggingHighlight,
      isConflict: !!isConflict,
      conflictWith: isConflict
    };
  }, [highlightStart, highlightEnd, dragState, getPercent, checkConflict]);

  return (
    <div className={styles.timeVizContainer}>
      <div className={styles.headerRow}>
        <h4 className={styles.timeVizTitle}>
          <Clock size={16} style={{ color: '#818cf8' }} />
          Peta Jam Kerja ({String(minHour).padStart(2, '0')}:00 - {String(maxHour).padStart(2, '0')}:00)
        </h4>

        <div className={styles.headerBadges}>
          {isSaving && (
            <span className={styles.savingBadge}>
              <Move size={12} /> Menyimpan waktu...
            </span>
          )}
          {saveSuccessMsg && (
            <span className={styles.savingBadge} style={{ color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.4)' }}>
              <Check size={12} /> Berhasil disesuaikan ({saveSuccessMsg})
            </span>
          )}
        </div>
      </div>

      <div className={styles.tipsBanner}>
        <span>💡</span>
        <span>
          <strong>Sesuaikan visual:</strong> Geser balok kegiatan untuk memindahkan jam kerja, atau tarik pegangan di ujung kiri/kanan untuk mengubah jam mulai/selesai.
        </span>
      </div>

      <div className={styles.timelineWrapper}>
        <div
          ref={barRef}
          className={styles.timelineBar}
          onPointerDown={(e) => {
            if (onTimeChange && !dragState) {
              handlePointerDown(e, 'select-range', null);
            }
          }}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {/* Core Official Working Hours Zone */}
          {coreLeft !== null && coreWidth !== null && (
            <div
              className={styles.coreWorkArea}
              style={{ left: `${coreLeft}%`, width: `${coreWidth}%` }}
              title="Jam Wajib Kerja Pegawai BPS"
            >
              <div className={styles.coreWorkBadge}>Jam Wajib</div>
            </div>
          )}

          {/* Hour & Half-Hour Grid Markers */}
          {Array.from({ length: totalHours + 1 }).map((_, i) => {
            const h = minHour + i;
            const leftPct = (i / totalHours) * 100;
            return (
              <div key={`hour-${h}`}>
                <div
                  className={`${styles.hourMarker} ${h % 2 === 0 ? styles.hourMarkerMajor : ''}`}
                  style={{ left: `${leftPct}%` }}
                />
                <span className={styles.timeVizLabel} style={{ left: `${leftPct}%` }}>
                  {String(h).padStart(2, '0')}:00
                </span>

                {i < totalHours && (
                  <div
                    className={styles.halfHourMarker}
                    style={{ left: `${((i + 0.5) / totalHours) * 100}%` }}
                  />
                )}
              </div>
            );
          })}

          {/* Activity Blocks */}
          {blocks.map((b) => (
            <div
              key={b.id}
              className={`${styles.activityBlock} ${b.isDragging ? styles.activityBlockDragging : ''} ${
                selectedEntry?.id === b.id ? styles.activityBlockSelected : ''
              } ${b.isConflict ? styles.activityBlockConflict : ''}`}
              style={{
                left: b.left,
                width: b.width,
                backgroundColor: b.color
              }}
              onPointerDown={(e) => handlePointerDown(e, 'move', b.entry)}
            >
              {/* Left Resize Handle */}
              {!readOnly && (
                <div
                  className={`${styles.resizeHandle} ${styles.resizeHandleLeft}`}
                  title="Tarik untuk mengubah jam mulai"
                  onPointerDown={(e) => handlePointerDown(e, 'resize-start', b.entry)}
                >
                  <div className={styles.resizeGripLine} />
                </div>
              )}

              {/* Block Content */}
              <div className={styles.blockContent}>
                <div className={styles.blockTimeText}>
                  {minutesToTimeStr(b.startMins)} - {minutesToTimeStr(b.endMins)}
                </div>
                {b.entry.rincian && (
                  <div className={styles.blockRincianText}>
                    {b.entry.rincian}
                  </div>
                )}
              </div>

              {/* Right Resize Handle */}
              {!readOnly && (
                <div
                  className={`${styles.resizeHandle} ${styles.resizeHandleRight}`}
                  title="Tarik untuk mengubah jam selesai"
                  onPointerDown={(e) => handlePointerDown(e, 'resize-end', b.entry)}
                >
                  <div className={styles.resizeGripLine} />
                </div>
              )}
            </div>
          ))}

          {/* Highlight / Form Input Block */}
          {highlightInfo && (
            <div
              className={`${styles.highlightBlock} ${
                highlightInfo.isDragging ? styles.activityBlockDragging : ''
              } ${highlightInfo.isConflict ? styles.activityBlockConflict : ''}`}
              style={{
                left: highlightInfo.left,
                width: highlightInfo.width
              }}
              onPointerDown={(e) => handlePointerDown(e, 'move', 'highlight')}
            >
              {!readOnly && (
                <div
                  className={`${styles.resizeHandle} ${styles.resizeHandleLeft}`}
                  title="Tarik untuk mengatur jam mulai form"
                  onPointerDown={(e) => handlePointerDown(e, 'resize-start', 'highlight')}
                >
                  <div className={styles.resizeGripLine} />
                </div>
              )}

              <div className={styles.blockContent}>
                <div className={styles.blockTimeText}>
                  {minutesToTimeStr(highlightInfo.startMins)} - {minutesToTimeStr(highlightInfo.endMins)}
                </div>
                <div className={styles.blockRincianText}>
                  Form Input Kegiatan
                </div>
              </div>

              <div className={styles.highlightBadge}>Baru</div>

              {!readOnly && (
                <div
                  className={`${styles.resizeHandle} ${styles.resizeHandleRight}`}
                  title="Tarik untuk mengatur jam selesai form"
                  onPointerDown={(e) => handlePointerDown(e, 'resize-end', 'highlight')}
                >
                  <div className={styles.resizeGripLine} />
                </div>
              )}
            </div>
          )}

          {/* Active Live Dragging HUD / Tooltip & Guidelines */}
          {dragState && (
            <>
              {/* Guidelines at start and end */}
              <div
                className={styles.guideLine}
                style={{ left: `${getPercent(dragState.currentStartMins)}%` }}
              >
                <div className={styles.guideLabel}>
                  {minutesToTimeStr(dragState.currentStartMins)}
                </div>
              </div>
              <div
                className={styles.guideLine}
                style={{ left: `${getPercent(dragState.currentEndMins)}%` }}
              >
                <div className={styles.guideLabel}>
                  {minutesToTimeStr(dragState.currentEndMins)}
                </div>
              </div>

              {/* Floating Tooltip Pill */}
              <div
                className={styles.dragTooltip}
                style={{
                  left: `${(getPercent(dragState.currentStartMins) + getPercent(dragState.currentEndMins)) / 2}%`
                }}
              >
                <Move size={14} style={{ color: '#818cf8' }} />
                <span className={styles.tooltipTime}>
                  {minutesToTimeStr(dragState.currentStartMins)} — {minutesToTimeStr(dragState.currentEndMins)}
                </span>
                <span className={styles.tooltipDuration}>
                  ({formatDurationMins(dragState.currentEndMins - dragState.currentStartMins)})
                </span>
                {dragState.conflictWith && (
                  <span className={styles.tooltipConflict}>
                    <AlertTriangle size={12} /> Bentrok: {dragState.conflictWith.rincian?.substring(0, 15)}...
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className={styles.timeVizLegend}>
        <div className={styles.timeVizLegendItem}>
          <div className={styles.timeVizLegendColor} style={{ background: 'rgba(255,255,255,0.06)' }} />
          <span>Waktu Kosong (Klik & Tarik)</span>
        </div>
        <div className={styles.timeVizLegendItem}>
          <div className={styles.timeVizLegendColor} style={{ background: 'rgba(99, 102, 241, 0.8)' }} />
          <span>Kegiatan Terisi (Geser / Tarik Ujung)</span>
        </div>
        <div className={styles.timeVizLegendItem}>
          <div
            className={styles.timeVizLegendColor}
            style={{ border: '1.5px dashed rgba(16, 185, 129, 0.7)', background: 'rgba(16, 185, 129, 0.15)' }}
          />
          <span>Jam Wajib BPS (07:30 - 16:00/16:30)</span>
        </div>
        {highlightStart && highlightEnd && (
          <div className={styles.timeVizLegendItem}>
            <div
              className={styles.timeVizLegendColor}
              style={{ border: '1.5px dashed #a5b4fc', background: 'rgba(99, 102, 241, 0.4)' }}
            />
            <span>Pratinjau Form Input</span>
          </div>
        )}
      </div>

      {/* Quick Adjust Popover on Single Click/Tap */}
      {selectedEntry && (
        <div className={styles.popoverOverlay} onClick={() => setSelectedEntry(null)}>
          <div className={styles.popoverCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.popoverHeader}>
              <h4 className={styles.popoverTitle}>{selectedEntry.rincian || 'Rincian Kegiatan'}</h4>
              <button
                type="button"
                className={styles.popoverCloseBtn}
                onClick={() => setSelectedEntry(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles.popoverMeta}>
              <div className={styles.popoverTimeBadge}>
                <Clock size={14} />
                {selectedEntry.waktuMulai} — {selectedEntry.waktuSelesai}
              </div>
              <div className={styles.popoverDurBadge}>
                {formatDurationMins(
                  timeStrToMinutes(selectedEntry.waktuSelesai) - timeStrToMinutes(selectedEntry.waktuMulai)
                )}
              </div>
              {getEntrySkpIds(selectedEntry).length > 0 ? (
                getEntrySkpIds(selectedEntry).map((sid) => (
                  <span
                    key={sid}
                    style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: getColorForSkp(sid),
                      color: '#fff',
                      fontWeight: 600
                    }}
                  >
                    SKP #{sid}
                  </span>
                ))
              ) : selectedEntry.skpId ? (
                <span
                  style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: getColorForSkp(selectedEntry.skpId),
                    color: '#fff',
                    fontWeight: 600
                  }}
                >
                  SKP #{selectedEntry.skpId}
                </span>
              ) : null}
            </div>

            {onUpdateEntry && !readOnly && (
              <div className={styles.popoverSection}>
                <div className={styles.popoverSectionTitle}>Penyesuaian Cepat Jam Kegiatan</div>
                <div className={styles.nudgeGrid}>
                  <button
                    type="button"
                    className={styles.nudgeBtn}
                    onClick={() => handleNudge(selectedEntry, -15, false)}
                    title="Mundurkan 15 menit"
                  >
                    <span>-15 mnt</span>
                    <span className={styles.nudgeSub}>Geser Maju</span>
                  </button>
                  <button
                    type="button"
                    className={styles.nudgeBtn}
                    onClick={() => handleNudge(selectedEntry, 15, false)}
                    title="Majukan 15 menit"
                  >
                    <span>+15 mnt</span>
                    <span className={styles.nudgeSub}>Geser Mundur</span>
                  </button>
                  <button
                    type="button"
                    className={styles.nudgeBtn}
                    onClick={() => handleNudge(selectedEntry, -15, true)}
                    title="Kurangi durasi 15 menit"
                  >
                    <span>-15 mnt</span>
                    <span className={styles.nudgeSub}>Durasi</span>
                  </button>
                  <button
                    type="button"
                    className={styles.nudgeBtn}
                    onClick={() => handleNudge(selectedEntry, 15, true)}
                    title="Tambah durasi 15 menit"
                  >
                    <span>+15 mnt</span>
                    <span className={styles.nudgeSub}>Durasi</span>
                  </button>
                </div>
              </div>
            )}

            <div className={styles.popoverActions}>
              {onEdit && (
                <button
                  type="button"
                  className={styles.popoverBtnPrimary}
                  onClick={() => {
                    const e = selectedEntry;
                    setSelectedEntry(null);
                    onEdit(e);
                  }}
                >
                  <Edit3 size={14} /> Edit Lengkap di Form
                </button>
              )}
              <button
                type="button"
                className={styles.popoverCloseBtn}
                style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.06)' }}
                onClick={() => setSelectedEntry(null)}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
