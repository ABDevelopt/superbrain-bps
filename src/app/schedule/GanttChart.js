'use client';

import { useMemo } from 'react';
import styles from './page.module.css';

const PHASE_COLORS = [
  { bg: 'linear-gradient(135deg, var(--primary), var(--primary-dark))', border: 'var(--primary-light)', glow: 'var(--primary-glow)' }, // Indigo
  { bg: 'linear-gradient(135deg, var(--warning), #d97706)', border: '#fbbf24', glow: 'var(--warning-glow)' }, // Amber
  { bg: 'linear-gradient(135deg, var(--info), #0284c7)', border: '#38bdf8', glow: 'var(--info-glow)' }, // Sky/Info
  { bg: 'linear-gradient(135deg, var(--success), #059669)', border: '#34d399', glow: 'var(--success-glow)' }  // Emerald/Success
];

const BULAN_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

// Helper to parse dates in local timezone to avoid offsets
const parseLocalDate = (dateStr) => {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return new Date(dateStr);
  return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
};

// Helper to calculate raw days in between two dates
const getDaysBetween = (endDateStr, startDateStr) => {
  const end = parseLocalDate(endDateStr);
  const start = parseLocalDate(startDateStr);
  if (!end || !start) return 0;
  end.setHours(23, 59, 59, 999);
  start.setHours(0, 0, 0, 0);
  
  const diffMs = start.getTime() - end.getTime();
  if (diffMs <= 0) return 0;
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
};

// Helper to format adaptive text inside Gantt chart bars
const getBarText = (phase, startMs, endMs, widthPercent) => {
  const pStart = new Date(startMs);
  const pEnd = new Date(endMs);
  const startStr = `${pStart.getDate()} ${BULAN_SHORT[pStart.getMonth()]}`;
  const endStr = `${pEnd.getDate()} ${BULAN_SHORT[pEnd.getMonth()]}`;
  const cleanName = phase.name.split(' (')[0];
  
  if (widthPercent >= 22) {
    return `${cleanName} (${startStr} - ${endStr})`;
  } else if (widthPercent >= 12) {
    return `${cleanName} (${pStart.getDate()}/${pStart.getMonth() + 1} - ${pEnd.getDate()}/${pEnd.getMonth() + 1})`;
  } else if (widthPercent >= 6) {
    return cleanName;
  } else {
    return cleanName.substring(0, 3) + '...';
  }
};

export default function GanttChart({ startDate, endDate, phases = [], activePhaseId, onSelectPhase }) {
  const chartData = useMemo(() => {
    if (phases.length === 0) return null;

    // Parse base limits
    const limitStart = startDate ? parseLocalDate(startDate) : null;
    const limitEnd = endDate ? parseLocalDate(endDate) : null;

    const pStarts = phases.map(p => parseLocalDate(p.startDate)).filter(d => d && !isNaN(d.getTime()));
    const pEnds = phases.map(p => parseLocalDate(p.endDate)).filter(d => d && !isNaN(d.getTime()));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let actualStart = limitStart;
    let actualEnd = limitEnd;

    // Find dynamic start: earliest of first phase start date or today
    if (pStarts.length > 0) {
      const minPhaseStart = new Date(Math.min(...pStarts.map(d => d.getTime())));
      actualStart = minPhaseStart < today ? minPhaseStart : today;
    } else if (limitStart) {
      actualStart = limitStart < today ? limitStart : today;
    } else {
      actualStart = today;
    }

    // Find dynamic end: latest of phases or limitEnd
    if (pEnds.length > 0) {
      actualEnd = new Date(Math.max(...pEnds.map(d => d.getTime())));
    } else if (!actualEnd) {
      actualEnd = new Date(actualStart.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days default fallback
    }

    // Normalize boundaries to absolute local days
    actualStart.setHours(0, 0, 0, 0);
    actualEnd.setHours(23, 59, 59, 999);

    const totalDays = Math.round((actualEnd.getTime() - actualStart.getTime()) / (1000 * 60 * 60 * 24));

    // Generate list of months and calculate their proportional widths based on actual days in chart range
    const monthsData = [];
    let curr = new Date(actualStart.getFullYear(), actualStart.getMonth(), 1);
    const endMonth = new Date(actualEnd.getFullYear(), actualEnd.getMonth(), 1);

    while (curr <= endMonth) {
      const year = curr.getFullYear();
      const month = curr.getMonth();
      
      const mStart = new Date(year, month, 1);
      const activeMonthStart = mStart < actualStart ? actualStart : mStart;
      
      const mEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);
      const activeMonthEnd = mEnd > actualEnd ? actualEnd : mEnd;
      
      const diffMs = activeMonthEnd.getTime() - activeMonthStart.getTime();
      const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
      
      if (days > 0) {
        monthsData.push({
          date: new Date(curr),
          days: days,
          width: (days / totalDays) * 100
        });
      }

      curr.setMonth(curr.getMonth() + 1);
    }

    // Today indicator position relative to total days
    let todayPercent = null;
    if (today >= actualStart && today <= actualEnd) {
      const todayDays = Math.round((today.getTime() - actualStart.getTime()) / (1000 * 60 * 60 * 24));
      todayPercent = (todayDays / totalDays) * 100;
    }

    return {
      start: actualStart,
      end: actualEnd,
      today,
      totalDays,
      monthsData,
      todayPercent
    };
  }, [startDate, endDate, phases]);

  if (!chartData) {
    return (
      <div 
        className="glass-card animate-fade-in" 
        style={{ 
          padding: '24px', 
          textAlign: 'center', 
          color: 'var(--text-muted)', 
          fontSize: 'var(--font-size-sm)',
          borderStyle: 'dashed'
        }}
      >
        Belum ada tahapan kegiatan yang ditentukan untuk pelatihan ini.
      </div>
    );
  }

  const { start, end, today, totalDays, monthsData, todayPercent } = chartData;

  const formatDateLabel = (date) => {
    return date.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
  };

  const formatFullDate = (dateStr) => {
    const d = parseLocalDate(dateStr);
    if (!d) return '';
    return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <div 
      className="glass-card animate-fade-in" 
      style={{ 
        padding: '20px', 
        marginBottom: '24px',
        boxShadow: 'var(--shadow-md)',
        background: 'rgba(255, 255, 255, 0.02)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-bold)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>📊 Timeline Gantt Chart</span>
          <span 
            style={{ 
              fontSize: 'var(--font-size-xs)', 
              fontWeight: 'var(--font-weight-normal)', 
              padding: '3px 10px', 
              background: 'var(--primary-glow)', 
              border: '1px solid rgba(99,102,241,0.25)', 
              borderRadius: 'var(--radius-full)', 
              color: 'var(--primary-light)' 
            }}
          >
            {formatFullDate(start.toISOString().split('T')[0])} - {formatFullDate(end.toISOString().split('T')[0])}
          </span>
        </h4>
      </div>

      {/* Timeline Grid Container */}
      <div style={{ position: 'relative', width: '100%', overflowX: 'auto', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
        <div style={{ minWidth: '600px', position: 'relative' }}>
          
          {/* Header: Months (Proportional widths) */}
          <div style={{ display: 'flex', paddingBottom: '6px' }}>
            {monthsData.map((m, i) => (
              <div 
                key={i} 
                style={{ 
                  width: `${m.width}%`, 
                  textAlign: 'center', 
                  fontSize: 'var(--font-size-xs)', 
                  fontWeight: 'var(--font-weight-bold)', 
                  color: 'var(--text-secondary)', 
                  borderLeft: i > 0 ? '1px dashed rgba(255,255,255,0.06)' : 'none',
                  boxSizing: 'border-box'
                }}
              >
                {formatDateLabel(m.date)}
              </div>
            ))}
          </div>

          {/* Date Ruler Row (Dedicated Baseblock for Dates) */}
          <div 
            style={{ 
              display: 'flex', 
              background: 'rgba(255, 255, 255, 0.03)', 
              borderTop: '1px solid rgba(255, 255, 255, 0.05)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              padding: '4px 0', 
              marginBottom: '14px',
              borderRadius: '4px'
            }}
          >
            {monthsData.map((m, i) => {
              const year = m.date.getFullYear();
              const month = m.date.getMonth();
              
              const mStart = new Date(year, month, 1);
              const activeMonthStart = mStart < start ? start : mStart;
              
              const mEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);
              const activeMonthEnd = mEnd > end ? end : mEnd;

              const startDay = activeMonthStart.getDate();
              const endDay = activeMonthEnd.getDate();

              // Generate ruler ticks (Start date, Day 10, Day 20, End date)
              const ticks = [];
              ticks.push(startDay);
              
              if (startDay < 10 && endDay >= 10) ticks.push(10);
              if (startDay < 20 && endDay >= 20) ticks.push(20);
              
              if (!ticks.includes(endDay) && endDay > startDay) {
                ticks.push(endDay);
              }

              const mActiveDays = m.days;

              return (
                <div 
                  key={i} 
                  style={{ 
                    width: `${m.width}%`, 
                    position: 'relative', 
                    height: '14px',
                    borderLeft: i > 0 ? '1px dashed rgba(255,255,255,0.06)' : 'none',
                    boxSizing: 'border-box'
                  }}
                >
                  {ticks.map((tDay, tIdx) => {
                    const tickDate = new Date(year, month, tDay);
                    const diffMs = tickDate.getTime() - activeMonthStart.getTime();
                    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
                    
                    const tickLeft = mActiveDays > 0 ? (diffDays / mActiveDays) * 100 : 0;

                    return (
                      <span 
                        key={tIdx} 
                        style={{ 
                          position: 'absolute', 
                          left: `${tickLeft}%`, 
                          transform: 'translateX(-50%)',
                          fontSize: '9px', 
                          color: '#64748b',
                          fontWeight: '600',
                          fontFamily: 'monospace'
                        }}
                      >
                        {tDay}
                      </span>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Today vertical line */}
          {todayPercent !== null && (
            <div 
              style={{
                position: 'absolute',
                top: '0',
                bottom: '0',
                left: `${todayPercent}%`,
                width: '2px',
                background: 'var(--danger)',
                boxShadow: '0 0 10px var(--danger)',
                zIndex: 10,
                pointerEvents: 'none'
              }}
            >
              <div 
                style={{ 
                  position: 'absolute', 
                  top: '-16px', 
                  left: '-22px', 
                  background: 'var(--danger)', 
                  color: 'white', 
                  fontSize: '9px', 
                  fontWeight: 'var(--font-weight-bold)', 
                  padding: '1px 6px', 
                  borderRadius: '4px', 
                  whiteSpace: 'nowrap',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                Hari Ini ({today.getDate()} {BULAN_SHORT[today.getMonth()]})
              </div>
            </div>
          )}

          {/* Phase Rows & Gap Indicators */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '6px 0' }}>
            {phases.map((phase, idx) => {
              const pStartObj = parseLocalDate(phase.startDate);
              const pEndObj = parseLocalDate(phase.endDate);
              if (pStartObj) pStartObj.setHours(0, 0, 0, 0);
              if (pEndObj) pEndObj.setHours(23, 59, 59, 999);
              
              const pStart = pStartObj?.getTime() || 0;
              const pEnd = pEndObj?.getTime() || 0;
              
              // Calculate width & offset based on absolute days
              const startDays = Math.round((pStart - start.getTime()) / (1000 * 60 * 60 * 24));
              const durationDays = Math.round((pEnd - pStart) / (1000 * 60 * 60 * 24));

              const left = (startDays / totalDays) * 100;
              const width = (durationDays / totalDays) * 100;
              
              const isSelected = activePhaseId === phase.id;
              const color = PHASE_COLORS[idx % PHASE_COLORS.length];

              // Calculate gap between this phase and the next one
              const nextPhase = phases[idx + 1];
              let gapRow = null;
              if (nextPhase) {
                const gapDays = getDaysBetween(phase.endDate, nextPhase.startDate);
                if (gapDays > 0) {
                  const nextStartObj = parseLocalDate(nextPhase.startDate);
                  const currentEndObj = parseLocalDate(phase.endDate);
                  if (nextStartObj && currentEndObj) {
                    nextStartObj.setHours(0, 0, 0, 0);
                    currentEndObj.setHours(23, 59, 59, 999);

                    const gapStart = currentEndObj.getTime();
                    const gapStartDays = Math.round((gapStart - start.getTime()) / (1000 * 60 * 60 * 24));
                    const gapDurationDays = Math.round((nextStartObj.getTime() - gapStart) / (1000 * 60 * 60 * 24));

                    const gapLeft = (gapStartDays / totalDays) * 100;
                    const gapWidth = (gapDurationDays / totalDays) * 100;

                    gapRow = (
                      <div 
                        style={{ 
                          position: 'relative', 
                          height: '22px', 
                          display: 'flex', 
                          alignItems: 'center' 
                        }}
                      >
                        {/* Grid Columns Guideline */}
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', pointerEvents: 'none' }}>
                          {monthsData.map((m, mIdx) => (
                            <div 
                              key={mIdx} 
                              style={{ 
                                width: `${m.width}%`, 
                                borderLeft: mIdx > 0 ? '1px dashed rgba(255,255,255,0.03)' : 'none',
                                boxSizing: 'border-box'
                              }} 
                            />
                          ))}
                        </div>

                        <div
                          style={{
                            position: 'absolute',
                            left: `${gapLeft}%`,
                            width: `${gapWidth}%`,
                            height: '1px',
                            borderTop: '1px dashed rgba(255, 255, 255, 0.22)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 2
                          }}
                        >
                          <span 
                            style={{ 
                              background: '#111827',
                              padding: '2px 8px', 
                              borderRadius: 'var(--radius-full)', 
                              fontSize: '9px', 
                              color: 'var(--text-muted)',
                              border: '1px solid rgba(255,255,255,0.08)',
                              whiteSpace: 'nowrap',
                              boxShadow: 'var(--shadow-sm)',
                              position: 'absolute',
                              left: '50%',
                              transform: 'translate(-50%, -50%)'
                            }}
                          >
                            Jeda: {gapDays} hari
                          </span>
                        </div>
                      </div>
                    );
                  }
                }
              }

              return (
                <div key={phase.id}>
                  {/* Phase Bar Row */}
                  <div 
                    style={{ 
                      position: 'relative', 
                      height: '38px', 
                      background: 'rgba(255,255,255,0.01)', 
                      borderRadius: 'var(--radius-md)', 
                      display: 'flex', 
                      alignItems: 'center' 
                    }}
                  >
                    {/* Grid Month Columns Guideline */}
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', pointerEvents: 'none' }}>
                      {monthsData.map((m, mIdx) => (
                        <div 
                          key={mIdx} 
                          style={{ 
                            width: `${m.width}%`, 
                            borderLeft: mIdx > 0 ? '1px dashed rgba(255,255,255,0.03)' : 'none',
                            boxSizing: 'border-box'
                          }} 
                        />
                      ))}
                    </div>

                    {/* Horizontal Bar */}
                    <div
                      onClick={() => onSelectPhase(phase.id)}
                      style={{
                        position: 'absolute',
                        left: `${left}%`,
                        width: `${width}%`,
                        height: '26px',
                        background: color.bg,
                        border: isSelected ? '2px solid white' : `1px solid rgba(255,255,255,0.15)`,
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0 10px',
                        fontSize: '11px',
                        fontWeight: 'var(--font-weight-bold)',
                        color: 'white',
                        boxShadow: isSelected ? `0 0 15px ${color.glow}` : 'none',
                        transition: 'all var(--transition-base)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        zIndex: 5
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.transform = 'scaleY(1.08)';
                          e.currentTarget.style.boxShadow = `0 4px 10px ${color.glow}`;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.transform = 'none';
                          e.currentTarget.style.boxShadow = 'none';
                        }
                      }}
                      title={`${phase.name}: ${formatFullDate(phase.startDate)} - ${formatFullDate(phase.endDate)}`}
                    >
                      {getBarText(phase, pStart, pEnd, width)}
                    </div>
                  </div>

                  {/* Render Gap Row if there is any interval */}
                  {gapRow}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
