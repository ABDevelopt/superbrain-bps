'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Monitor, Map as MapIcon, BarChart2, Book, Users, 
  ClipboardList, Folder, LayoutGrid, Network, X, 
  Plus, ArrowRight, Target, CheckSquare, ChevronRight, ChevronDown 
} from 'lucide-react';

import styles from './page.module.css';
import { skpData } from '@/data/skpData';
import { BPS_ROLES } from '@/data/taskData';

export default function Mapping() {
  const router = useRouter();

  // State
  const [tasks, setTasks] = useState([]);
  const [viewMode, setViewMode] = useState('tree'); // 'tree' | 'grid'
  const [groupBy, setGroupBy] = useState('cluster'); // 'cluster' | 'tim' | 'kategori'
  const [expandedGroups, setExpandedGroups] = useState({});
  const [selectedSkp, setSelectedSkp] = useState(null);

  // Load tasks from localStorage to count activities per SKP
  useEffect(() => {
    try {
      const savedTasks = localStorage.getItem('bps_superbrain_tasks');
      if (savedTasks) {
        setTasks(JSON.parse(savedTasks));
      }
    } catch (e) {
      console.error('Failed to load tasks in mapping:', e);
    }
  }, []);

  // Map tasks to SKP IDs
  const skpTasksMap = useMemo(() => {
    const map = {};
    tasks.forEach((task) => {
      if (!map[task.skpId]) {
        map[task.skpId] = [];
      }
      map[task.skpId].push(task);
    });
    return map;
  }, [tasks]);

  // Group SKP data dynamically based on the groupBy state
  const groupedData = useMemo(() => {
    const groupField = groupBy === 'kategori' ? 'kategori' : groupBy === 'tim' ? 'tim' : 'cluster';
    
    const groups = skpData.reduce((acc, item) => {
      const key = item[groupField] || 'Lainnya';
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(item);
      return acc;
    }, {});

    // Set initial expanded state for all groups
    const initialExpanded = {};
    Object.keys(groups).forEach(key => {
      initialExpanded[key] = true;
    });
    // Only set once when grouped data changes and expandedGroups is empty
    setExpandedGroups(prev => {
      if (Object.keys(prev).length === 0) {
        return initialExpanded;
      }
      return prev;
    });

    return groups;
  }, [groupBy]);

  const toggleGroup = (groupName) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

  const handleOpenSkpDetail = (skp) => {
    setSelectedSkp(skp);
  };

  // Helper icons for groups
  const getGroupIcon = (groupName) => {
    switch (groupName) {
      // Clusters
      case 'IT & Digital': return <Monitor size={16} />;
      case 'Geospasial': return <MapIcon size={16} />;
      case 'Survei & Sensus': return <BarChart2 size={16} />;
      case 'Publikasi & Data': return <Book size={16} />;
      case 'Pelayanan & Koordinasi': return <Users size={16} />;
      case 'Administrasi': return <ClipboardList size={16} />;
      // Categories
      case 'utama': return <Target size={16} color="#6366f1" />;
      case 'tambahan': return <Plus size={16} color="#f59e0b" />;
      // Teams
      case 'Subbagian Umum': return <Folder size={16} />;
      case 'Tim IPJKD & DLS': return <Network size={16} />;
      case 'Tim Statistik Sosial': return <Users size={16} />;
      case 'Tim Statistik Harga & Sensus Ekonomi': return <BarChart2 size={16} />;
      default: return <Folder size={16} />;
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'belum': return styles.status_belum;
      case 'progress': return styles.status_progress;
      case 'selesai': return styles.status_selesai;
      case 'terlambat': return styles.status_terlambat;
      default: return styles.status_belum;
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'belum': return 'Belum Mulai';
      case 'progress': return 'On Progress';
      case 'selesai': return 'Selesai';
      case 'terlambat': return 'Terlambat';
      default: return 'Belum Mulai';
    }
  };

  // Redirect actions from detail modal
  const handleAddNewTask = (skpId) => {
    try {
      sessionStorage.setItem('prefill_task_skpId', String(skpId));
      setSelectedSkp(null);
      router.push('/tasks');
    } catch (e) {
      console.error(e);
    }
  };

  const handleManageTasks = (skpId) => {
    setSelectedSkp(null);
    router.push(`/tasks?skpId=${skpId}`);
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Pemetaan Kerja (Work Mapping)</h1>
        <p className={styles.subtitle}>
          Visualisasikan hubungan antara target SKP organisasi dengan daftar tugas harian Anda secara real-time.
        </p>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toggleGroup}>
          <button 
            className={`${styles.toggleBtn} ${viewMode === 'tree' ? styles.toggleBtnActive : ''}`}
            onClick={() => setViewMode('tree')}
          >
            <Network size={16} /> Pohon Interaktif
          </button>
          <button 
            className={`${styles.toggleBtn} ${viewMode === 'grid' ? styles.toggleBtnActive : ''}`}
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid size={16} /> Tampilan Grid
          </button>
        </div>

        {/* Tree Grouping control */}
        {viewMode === 'tree' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>CABANG POHON:</span>
            <select 
              className={styles.filterSelect}
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
            >
              <option value="cluster">Kelompok Bidang (Klaster)</option>
              <option value="tim">Tim Kerja BPS</option>
              <option value="kategori">Kategori (Utama/Tambahan)</option>
            </select>
          </div>
        )}
      </div>

      {/* View Container */}
      <div className={styles.mapContainer}>
        {viewMode === 'tree' ? (
          /* TREE NODE VIEW */
          <div className={styles.treeWrapper}>
            <div className={styles.treeBranch}>
              {/* Root Card */}
              <div className={`${styles.nodeCard} ${styles.rootNodeCard}`}>
                <div className={styles.rootSubtitle}>SASARAN KINERJA</div>
                <h2 className={styles.rootTitle}>SuperBrain BPS</h2>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#818cf8', fontWeight: '600', marginTop: '8px' }}>
                  <CheckSquare size={13} /> {tasks.length} Tugas Terhubung
                </div>
              </div>

              {/* Branch Elements */}
              <div className={styles.branchChildren}>
                {Object.entries(groupedData).map(([groupName, items]) => {
                  const isExpanded = !!expandedGroups[groupName];
                  const totalGroupTasks = items.reduce((acc, item) => {
                    return acc + (skpTasksMap[item.id] || []).length;
                  }, 0);

                  return (
                    <div key={groupName} className={styles.childContainer}>
                      {/* Intermediate Node Card */}
                      <div 
                        className={`${styles.nodeCard} ${styles.groupNodeCard} ${!isExpanded ? styles.collapsedBranchCard : ''}`}
                        onClick={() => toggleGroup(groupName)}
                      >
                        <div className={styles.groupHeader}>
                          {getGroupIcon(groupName)}
                          <span style={{ textTransform: groupBy === 'kategori' ? 'capitalize' : 'none' }}>
                            {groupName}
                          </span>
                        </div>
                        <div className={styles.groupMeta}>
                          <span>{items.length} SKP</span>
                          {totalGroupTasks > 0 && (
                            <span className={styles.taskCountBadge} style={{ fontSize: '9px', padding: '1px 5px' }}>
                              {totalGroupTasks} Tugas
                            </span>
                          )}
                          <span className={styles.collapseIndicator}>
                            {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                          </span>
                        </div>
                      </div>

                      {/* Leaves Column */}
                      {isExpanded && (
                        <div className={styles.branchChildren} style={{ gap: '12px' }}>
                          {items.map((item) => {
                            const itemTasks = skpTasksMap[item.id] || [];
                            const activeTasks = itemTasks.filter(t => t.status !== 'done').length;
                            const doneTasks = itemTasks.filter(t => t.status === 'done').length;

                            return (
                              <div 
                                key={item.id} 
                                className={`${styles.nodeCard} ${styles.skpNodeCard}`}
                                onClick={() => handleOpenSkpDetail(item)}
                              >
                                <div className={styles.skpHeader}>
                                  <span className={styles.skpBadge} style={{ background: item.kategori === 'utama' ? 'rgba(99,102,241,0.15)' : 'rgba(245,158,11,0.15)', color: item.kategori === 'utama' ? '#818cf8' : '#f59e0b' }}>
                                    {item.kategori}
                                  </span>
                                  {itemTasks.length > 0 && (
                                    <span className={`${styles.taskCountBadge} ${activeTasks === 0 ? styles.taskCountBadgeCompleted : ''}`}>
                                      {activeTasks > 0 ? `📋 ${activeTasks} Aktif` : `✓ ${doneTasks} Selesai`}
                                    </span>
                                  )}
                                </div>
                                <h3 className={styles.skpTitle} title={item.nama}>{item.nama}</h3>
                                <div className={styles.skpMetaRow}>
                                  <span>SKP #{item.id}</span>
                                  <span style={{ opacity: 0.8 }} title={item.tim}>{item.tim.split(' ').slice(-2).join(' ')}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* CLASSIC GRID VIEW */
          <div className={styles.clusterGrid}>
            {Object.entries(groupedData).map(([groupName, items]) => (
              <div key={groupName} className={styles.cluster}>
                <div className={styles.clusterHeader}>
                  <span>{getGroupIcon(groupName)}</span>
                  <span style={{ textTransform: groupBy === 'kategori' ? 'capitalize' : 'none' }}>{groupName}</span>
                  <span style={{ fontSize: '11px', opacity: 0.8, marginLeft: '8px' }}>({items.length} kegiatan)</span>
                </div>
                
                <div className={styles.nodes}>
                  {items.map(item => {
                    const itemTasks = skpTasksMap[item.id] || [];
                    const activeTasks = itemTasks.filter(t => t.status !== 'done').length;

                    return (
                      <div 
                        key={item.id} 
                        className={styles.gridNode}
                        onClick={() => handleOpenSkpDetail(item)}
                      >
                        <div className={styles.skpHeader}>
                          <span className={`${styles.statusBadge} ${getStatusClass(item.status)}`}>
                            {getStatusLabel(item.status)}
                          </span>
                          {itemTasks.length > 0 && (
                            <span className={styles.taskCountBadge}>
                              📋 {itemTasks.length} Tugas
                            </span>
                          )}
                        </div>
                        <h3 className={styles.skpTitle} style={{ fontSize: '13.5px', margin: 0 }}>{item.nama}</h3>
                        <div className={styles.skpMetaRow}>
                          <span>SKP #{item.id} | {item.kategori}</span>
                          <span>{item.tim}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SKP Detail Modal with associated Tasks */}
      {selectedSkp && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitleArea}>
                <span className={styles.skpBadge} style={{ background: selectedSkp.kategori === 'utama' ? 'rgba(99,102,241,0.15)' : 'rgba(245,158,11,0.15)', color: selectedSkp.kategori === 'utama' ? '#818cf8' : '#f59e0b', alignSelf: 'flex-start' }}>
                  Sasaran {selectedSkp.kategori}
                </span>
                <h3 className={styles.modalTitle}>{selectedSkp.nama}</h3>
                <div className={styles.modalMetaRow}>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Nomor SKP: #{selectedSkp.id}</span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>•</span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Tim: {selectedSkp.tim}</span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>•</span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Klaster: {selectedSkp.cluster}</span>
                </div>
              </div>
              <button className={styles.modalCloseBtn} onClick={() => setSelectedSkp(null)}>
                <X size={18} />
              </button>
            </div>

            {/* Target & Realisasi Progress */}
            <div className={styles.modalContentSection}>
              <h4 className={styles.sectionTitle}>Indikator Sasaran Kinerja</h4>
              <div className={styles.indicatorCardList}>
                {selectedSkp.indikator && selectedSkp.indikator.map((ind, idx) => (
                  <div key={idx} className={styles.indicatorCard}>
                    <div className={styles.indicatorInfo}>
                      <span className={styles.indicatorLabel}>Target {ind.jenis}</span>
                      <span className={styles.indicatorVal}>Realisasi: {ind.realisasi}% / Target: {ind.target}%</span>
                    </div>
                    <div className={styles.barTrack}>
                      <div className={styles.barFill} style={{ width: `${ind.realisasi}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Associated Tasks from Papan Tugas */}
            <div className={styles.modalContentSection}>
              <h4 className={styles.sectionTitle}>Daftar Tugas Terkait di Papan Tugas</h4>
              <div className={styles.modalTasksList}>
                {(() => {
                  const itemTasks = skpTasksMap[selectedSkp.id] || [];
                  if (itemTasks.length === 0) {
                    return (
                      <p className={styles.emptyStateText}>
                        Belum ada tugas di papan tugas yang dihubungkan ke SKP ini.
                      </p>
                    );
                  }

                  return itemTasks.map((t) => {
                    const totalSub = t.checklist ? t.checklist.length : 0;
                    const doneSub = t.checklist ? t.checklist.filter(c => c.completed).length : 0;
                    const roleObj = BPS_ROLES.find(r => r.id === t.peran);

                    return (
                      <div key={t.id} className={styles.modalTaskItem}>
                        <div>
                          <div className={styles.modalTaskTitle}>{t.judul}</div>
                          <div className={styles.modalTaskSub}>
                            {roleObj && `${roleObj.icon} Peran: ${roleObj.name}`} 
                            {totalSub > 0 && ` • Checklist: ${doneSub}/${totalSub}`}
                          </div>
                        </div>
                        <span className={`${styles.modalTaskStatus} ${styles[`taskStatus_${t.status}`]}`}>
                          {t.status === 'in_progress' ? 'Focus' : t.status}
                        </span>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Action Buttons */}
            <div className={styles.modalActionsPanel}>
              <button 
                type="button" 
                className={styles.actionBtnSecondary}
                onClick={() => handleManageTasks(selectedSkp.id)}
              >
                <CheckSquare size={14} /> Kelola di Papan Tugas
              </button>
              <button 
                type="button" 
                className={styles.actionBtnPrimary}
                onClick={() => handleAddNewTask(selectedSkp.id)}
              >
                <Plus size={14} /> + Tugas Baru untuk SKP Ini
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
