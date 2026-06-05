'use client';

import { useState, useMemo, useEffect } from 'react';
import { ClipboardList, Search, Inbox, Users, Folder, Upload, RotateCcw, ChevronRight, LayoutGrid, Network, X, Check, Trash2, Edit2, Plus, Sparkles, AlertCircle } from 'lucide-react';
import { skpData as fallbackSkpData } from '@/data/skpData';
import styles from './page.module.css';
import { useSkps } from '@/hooks/useSkps';
import { useTeams } from '@/hooks/useTeams';
import { useProjects } from '@/hooks/useProjects';
import { useFirestore } from '@/hooks/useFirestore';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, writeBatch, query, where, getDocs, doc } from 'firebase/firestore';
import * as XLSX from 'xlsx';

const STATUS_CONFIG = {
  selesai: { label: 'Selesai', class: styles.statusSelesai },
  progress: { label: 'Dalam Proses', class: styles.statusProgress },
  belum: { label: 'Belum Dimulai', class: styles.statusBelum },
  terlambat: { label: 'Terlambat', class: styles.statusTerlambat },
};

function getProgressClass(value) {
  if (value >= 80) return styles.progressHigh;
  if (value <= 30) return styles.progressLow;
  return null;
}

const getTeamAndProjectMapping = (name, originalId, category, defaultSkpList) => {
  const lowerName = name.toLowerCase().trim();
  
  // 1. Try to find a direct match in default skpData to preserve original assignments
  const match = defaultSkpList.find(item => item.nama.toLowerCase().trim() === lowerName);
  if (match) {
    return { tim: match.tim, cluster: match.cluster };
  }

  // 2. Keyword check
  if (lowerName.includes('sakernas')) {
    return { tim: 'Tim Statistik Sosial', cluster: 'Survei Angkatan Kerja Nasional SAKERNAS Tahun 2026' };
  }
  if (
    lowerName.includes('susenas') || 
    lowerName.includes('seruti') || 
    lowerName.includes('sosial ekonomi nasional')
  ) {
    return { tim: 'Tim Statistik Sosial', cluster: 'Survei Sosial Ekonomi Nasional tahun 2026' };
  }
  if (lowerName.includes('pbi')) {
    return { tim: 'Tim Statistik Sosial', cluster: 'Ground Check Penerima Bantuan Iuran (PBI) Tahun 2026' };
  }
  if (lowerName.includes('desa cantik') || lowerName.includes('desa cinta statistik')) {
    return { tim: 'Tim Statistik Sosial', cluster: 'Pembinaan Desa Cinta Statistik Tahun 2026' };
  }
  if (lowerName.includes('sensus ekonomi') || lowerName.includes('se2026') || lowerName.includes('se 2026')) {
    return { tim: 'Tim Statistik Harga & Sensus Ekonomi', cluster: 'Sensus Ekonomi 2026' };
  }
  if (lowerName.includes('pdrb')) {
    return { tim: 'Tim IPJKD & DLS', cluster: 'Penyusunan PDRB Lapangan Usaha dan Pengeluaran' };
  }
  if (lowerName.includes('kda') || lowerName.includes('kecamatan dalam angka')) {
    return { tim: 'Tim IPJKD & DLS', cluster: 'Publikasi Kecamatan Dalam Angka (KDA)' };
  }
  if (lowerName.includes('sbr') || lowerName.includes('statistical business register')) {
    return { tim: 'Tim IPJKD & DLS', cluster: 'Statistical Business Register (SBR)' };
  }
  if (lowerName.includes('peta') || lowerName.includes('wilkerstat') || lowerName.includes('geospasial') || lowerName.includes('master file desa')) {
    return { tim: 'Tim IPJKD & DLS', cluster: 'Pengelolaan Peta, Muatan Wilkerstat, dan Master File Desa' };
  }
  if (lowerName.includes('sektoral') || lowerName.includes('rekomendasi statistik')) {
    return { tim: 'Tim IPJKD & DLS', cluster: 'Statistik Sektoral dan Rekomendasi Statistik' };
  }
  if (lowerName.includes('pst') || lowerName.includes('pelayanan')) {
    return { tim: 'Subbagian Umum', cluster: 'Pelayanan Statistik Terpadu (PST)' };
  }
  if (lowerName.includes('media sosial') || lowerName.includes('website') || lowerName.includes('kehumasan') || lowerName.includes('halo bps')) {
    return { tim: 'Subbagian Umum', cluster: 'Pengelolaan IT, Humas, dan Aplikasi' };
  }
  if (lowerName.includes('it') || lowerName.includes('aplikasi') || lowerName.includes('komputer')) {
    return { tim: 'Subbagian Umum', cluster: 'Pengelolaan IT, Humas, dan Aplikasi' };
  }
  if (lowerName.includes('bmn') || lowerName.includes('spt') || lowerName.includes('pajak') || lowerName.includes('zona integritas')) {
    return { tim: 'Subbagian Umum', cluster: 'Administrasi Kepegawaian, Keuangan, dan BMN' };
  }

  // 3. Fallbacks
  if (category === 'utama') {
    return { tim: 'Subbagian Umum', cluster: 'Administrasi Kepegawaian, Keuangan, dan BMN' };
  } else {
    return { tim: 'Subbagian Umum', cluster: 'Pengelolaan IT, Humas, dan Aplikasi' };
  }
};

const DEFAULT_TEAMS = [
  'Subbagian Umum',
  'Tim IPJKD & DLS',
  'Tim Statistik Sosial',
  'Tim Statistik Harga & Sensus Ekonomi'
];

const DEFAULT_PROJECTS = [
  { nama: 'Pengelolaan IT, Humas, dan Aplikasi', timNama: 'Subbagian Umum' },
  { nama: 'Pelayanan Statistik Terpadu (PST)', timNama: 'Subbagian Umum' },
  { nama: 'Administrasi Kepegawaian, Keuangan, dan BMN', timNama: 'Subbagian Umum' },
  { nama: 'Statistical Business Register (SBR)', timNama: 'Tim IPJKD & DLS' },
  { nama: 'Pengelolaan Peta, Muatan Wilkerstat, dan Master File Desa', timNama: 'Tim IPJKD & DLS' },
  { nama: 'Publikasi Kecamatan Dalam Angka (KDA)', timNama: 'Tim IPJKD & DLS' },
  { nama: 'Statistik Sektoral dan Rekomendasi Statistik', timNama: 'Tim IPJKD & DLS' },
  { nama: 'Penyusunan PDRB Lapangan Usaha dan Pengeluaran', timNama: 'Tim IPJKD & DLS' },
  { nama: 'Survei Angkatan Kerja Nasional SAKERNAS Tahun 2026', timNama: 'Tim Statistik Sosial' },
  { nama: 'Survei Sosial Ekonomi Nasional tahun 2026', timNama: 'Tim Statistik Sosial' },
  { nama: 'Ground Check Penerima Bantuan Iuran (PBI) Tahun 2026', timNama: 'Tim Statistik Sosial' },
  { nama: 'Pembinaan Desa Cinta Statistik Tahun 2026', timNama: 'Tim Statistik Sosial' },
  { nama: 'Sensus Ekonomi 2026', timNama: 'Tim Statistik Harga & Sensus Ekonomi' }
];

export default function SKPPage() {
  const { user } = useAuth();
  const { skpData, loading: skpLoading, isCustom, addDocument: addSkp, deleteDocument: deleteSkp } = useSkps();
  const { teams, loading: teamsLoading, addTeam, deleteTeam, updateTeam } = useTeams();
  const { projects, loading: projectsLoading, addProject, deleteProject, updateProject } = useProjects();
  const { docs: ckpDocs } = useFirestore('ckp');

  // UI States
  const [search, setSearch] = useState('');
  const [filterKategori, setFilterKategori] = useState('semua');
  const [filterTim, setFilterTim] = useState('semua');
  const [filterCluster, setFilterCluster] = useState('semua');
  const [filterStatus, setFilterStatus] = useState('semua');
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'hierarki'
  const [expandedTims, setExpandedTims] = useState({});
  const [toastMsg, setToastMsg] = useState(null);

  // Active step tab (0: Tim Kerja, 1: Proyek Tim, 2: Rencana Kerja SKP)
  const [activeStepTab, setActiveStepTab] = useState(2);

  // Automatic onboarding step redirection if empty
  useEffect(() => {
    if (skpData.length === 0 && !skpLoading) {
      setActiveStepTab(0);
    }
  }, [skpData.length, skpLoading]);

  // Form states for manual additions
  const [newTeamName, setNewTeamName] = useState('');
  const [editingTeamId, setEditingTeamId] = useState(null);
  const [editingTeamName, setEditingTeamName] = useState('');

  const [newProjName, setNewProjName] = useState('');
  const [newProjTimName, setNewProjTimName] = useState('');
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [editingProjectName, setEditingProjectName] = useState('');
  const [editingProjectTim, setEditingProjectTim] = useState('');

  const [newSkpName, setNewSkpName] = useState('');
  const [newSkpTim, setNewSkpTim] = useState('');
  const [newSkpProj, setNewSkpProj] = useState('');
  const [newSkpKategori, setNewSkpKategori] = useState('utama');
  const [newSkpTargetQty, setNewSkpTargetQty] = useState(100);
  const [newSkpTargetQly, setNewSkpTargetQly] = useState(100);

  // Parsing & modal states
  const [parsedSkps, setParsedSkps] = useState([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Auto disappear toast
  useEffect(() => {
    if (toastMsg) {
      const timer = setTimeout(() => setToastMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMsg]);

  // Auto-seed default teams and projects if Firestore is completely empty for this user
  useEffect(() => {
    if (!user || skpLoading || teamsLoading || projectsLoading) return;
    
    // If the user has 0 teams and 0 projects, and 0 SKPs, seed BPS defaults
    if (teams.length === 0 && projects.length === 0 && skpData.length === 0) {
      const seedDefaults = async () => {
        setIsSaving(true);
        try {
          const batch = writeBatch(db);
          
          DEFAULT_TEAMS.forEach(name => {
            const docRef = doc(collection(db, 'teams'));
            batch.set(docRef, {
              nama: name,
              userId: user.uid,
              createdAt: new Date().toISOString()
            });
          });
          
          DEFAULT_PROJECTS.forEach(proj => {
            const docRef = doc(collection(db, 'projects'));
            batch.set(docRef, {
              nama: proj.nama,
              timNama: proj.timNama,
              userId: user.uid,
              createdAt: new Date().toISOString()
            });
          });
          
          await batch.commit();
          setToastMsg('Daftar Tim Kerja & Proyek default telah dimuat sebagai awal.');
        } catch (err) {
          console.error('Error seeding default structure:', err);
        } finally {
          setIsSaving(false);
        }
      };
      
      seedDefaults();
    }
  }, [user, skpLoading, teamsLoading, projectsLoading, teams.length, projects.length, skpData.length]);

  // Derive unique tim and cluster lists for filtering
  const timList = useMemo(() => {
    return teams.map(t => t.nama);
  }, [teams]);

  const clusterList = useMemo(() => {
    return projects.map(p => p.nama);
  }, [projects]);

  // Compute realization from CKP
  const realisasiMap = useMemo(() => {
    const map = {};
    ckpDocs.forEach(doc => {
      if (doc.skpId) {
        if (!map[doc.skpId]) map[doc.skpId] = 0;
        map[doc.skpId] += Number(doc.kuantitas) || 0;
      }
    });
    return map;
  }, [ckpDocs]);

  // Transform skpData to inject dynamic realisasi and status
  const dynamicSkpData = useMemo(() => {
    return skpData.map(item => {
      const realisasiKuantitas = realisasiMap[item.id] || 0;
      const kuantitasInd = item.indikator.find(i => i.jenis === 'kuantitas') || { target: 100 };
      const targetVal = kuantitasInd.target || 100;
      
      // Determine status based on realisasi
      let status = 'belum';
      if (realisasiKuantitas >= targetVal) {
        status = 'selesai';
      } else if (realisasiKuantitas > 0) {
        status = 'progress';
      }

      return {
        ...item,
        status,
        indikator: item.indikator.map(i => {
          if (i.jenis === 'kuantitas') {
            return { ...i, realisasi: realisasiKuantitas };
          }
          return i;
        })
      };
    });
  }, [skpData, realisasiMap]);

  // Filtered data for SKP List Tab
  const filtered = useMemo(() => {
    return dynamicSkpData.filter((item) => {
      if (filterKategori !== 'semua' && item.kategori !== filterKategori) return false;
      if (filterTim !== 'semua' && item.tim !== filterTim) return false;
      if (filterCluster !== 'semua' && item.cluster !== filterCluster) return false;
      if (filterStatus !== 'semua' && item.status !== filterStatus) return false;
      if (search.trim() && !item.nama.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [search, filterKategori, filterTim, filterCluster, filterStatus, dynamicSkpData]);

  // Summary stats (computed from dynamic dataset)
  const stats = useMemo(() => {
    const counts = { total: dynamicSkpData.length, selesai: 0, progress: 0, belum: 0, terlambat: 0 };
    dynamicSkpData.forEach((item) => {
      if (counts[item.status] !== undefined) counts[item.status]++;
    });
    return counts;
  }, [dynamicSkpData]);

  // Grouped for Tampilan Hierarki Accordion
  const groupedHierarchicalData = useMemo(() => {
    const groups = {};
    filtered.forEach(item => {
      const timName = item.tim || 'Tanpa Tim Kerja';
      const proyekName = item.cluster || 'Tanpa Proyek Tim';
      
      if (!groups[timName]) {
        groups[timName] = {};
      }
      if (!groups[timName][proyekName]) {
        groups[timName][proyekName] = [];
      }
      groups[timName][proyekName].push(item);
    });
    return groups;
  }, [filtered]);

  const toggleTimGroup = (timName) => {
    setExpandedTims(prev => ({
      ...prev,
      [timName]: prev[timName] === false ? true : false
    }));
  };

  // --- MANUAL CRUD ACTIONS ---
  
  // 1. Tim Kerja (Tab 0)
  const handleAddTeamSubmit = async (e) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    try {
      await addTeam(newTeamName.trim());
      setNewTeamName('');
      setToastMsg(`Tim Kerja "${newTeamName.trim()}" berhasil ditambahkan.`);
    } catch (err) {
      alert('Gagal menambah Tim Kerja: ' + err.message);
    }
  };

  const handleStartTeamEdit = (t) => {
    setEditingTeamId(t.id);
    setEditingTeamName(t.nama);
  };

  const handleSaveTeamEdit = async (id) => {
    if (!editingTeamName.trim()) return;
    try {
      await updateTeam(id, editingTeamName.trim());
      setEditingTeamId(null);
      setToastMsg('Nama Tim Kerja berhasil diperbarui.');
    } catch (err) {
      alert('Gagal mengubah nama Tim Kerja: ' + err.message);
    }
  };

  const handleDeleteTeamClick = async (t) => {
    const hasProjects = projects.some(p => p.timNama === t.nama);
    const hasSkps = skpData.some(s => s.tim === t.nama);

    if (hasProjects || hasSkps) {
      alert(`Gagal menghapus: Tim Kerja "${t.nama}" masih memiliki Proyek Kerja atau Rencana SKP aktif yang terkait. Hapus proyek/SKP terlebih dahulu.`);
      return;
    }

    if (!confirm(`Apakah Anda yakin ingin menghapus Tim Kerja "${t.nama}"?`)) return;

    try {
      await deleteTeam(t.id);
      setToastMsg('Tim Kerja berhasil dihapus.');
    } catch (err) {
      alert('Gagal menghapus Tim Kerja: ' + err.message);
    }
  };

  // 2. Proyek Kerja (Tab 1)
  const handleAddProjectSubmit = async (e) => {
    e.preventDefault();
    if (!newProjName.trim() || !newProjTimName) return;
    try {
      await addProject(newProjName.trim(), newProjTimName);
      setNewProjName('');
      setToastMsg(`Proyek "${newProjName.trim()}" berhasil ditambahkan.`);
    } catch (err) {
      alert('Gagal menambah Proyek: ' + err.message);
    }
  };

  const handleStartProjectEdit = (p) => {
    setEditingProjectId(p.id);
    setEditingProjectName(p.nama);
    setEditingProjectTim(p.timNama);
  };

  const handleSaveProjectEdit = async (id) => {
    if (!editingProjectName.trim() || !editingProjectTim) return;
    try {
      await updateProject(id, editingProjectName.trim(), editingProjectTim);
      setEditingProjectId(null);
      setToastMsg('Proyek Kerja berhasil diperbarui.');
    } catch (err) {
      alert('Gagal mengubah Proyek Kerja: ' + err.message);
    }
  };

  const handleDeleteProjectClick = async (pId) => {
    const proj = projects.find(x => x.id === pId);
    if (!proj) return;

    const hasSkps = skpData.some(s => s.cluster === proj.nama && s.tim === proj.timNama);
    if (hasSkps) {
      alert(`Gagal menghapus: Proyek "${proj.nama}" masih memiliki butir SKP aktif di bawahnya.`);
      return;
    }

    if (!confirm(`Apakah Anda yakin ingin menghapus Proyek "${proj.nama}"?`)) return;

    try {
      await deleteProject(pId);
      setToastMsg('Proyek Kerja berhasil dihapus.');
    } catch (err) {
      alert('Gagal menghapus Proyek Kerja: ' + err.message);
    }
  };

  // 3. Rencana Kerja SKP (Tab 2)
  const handleAddSkpSubmit = async (e) => {
    e.preventDefault();
    if (!newSkpName.trim() || !newSkpTim || !newSkpProj) return;

    setIsSaving(true);
    try {
      // Find maximum sequential ID to assign next
      const maxId = skpData.reduce((max, s) => s.id > max ? s.id : max, 0);
      const nextId = maxId + 1;

      await addSkp({
        id: nextId,
        nama: newSkpName.trim(),
        kategori: newSkpKategori,
        tim: newSkpTim,
        cluster: newSkpProj,
        indikator: [
          { jenis: 'kuantitas', target: newSkpTargetQty, realisasi: 0 },
          { jenis: 'kualitas', target: newSkpTargetQly, realisasi: 0 }
        ],
        status: 'belum'
      });

      setNewSkpName('');
      setNewSkpTargetQty(100);
      setNewSkpTargetQly(100);
      setToastMsg(`Rencana SKP #${nextId} berhasil ditambahkan.`);
    } catch (err) {
      alert('Gagal menambah Rencana SKP: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSkpClick = async (skpId) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus Rencana Kerja SKP #${skpId}?`)) return;

    const docToDel = skpData.find(s => s.id === skpId);
    if (!docToDel) return;

    setIsSaving(true);
    try {
      await deleteSkp(docToDel.id);
      setToastMsg('Rencana Kerja SKP berhasil dihapus.');
    } catch (err) {
      alert('Gagal menghapus SKP: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };


  // --- BATCH TRANSACTION & FILE ACTIONS ---

  // Excel Upload Parser
  const handleImportExcel = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const sheetName = workbook.SheetNames.find(name => name.trim() === 'Penetapan') || workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        if (!sheet) {
          alert('Sheet "Penetapan" tidak ditemukan di file Excel.');
          return;
        }

        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        let currentCategory = null;
        const parsedItems = [];

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;

          const firstCell = String(row[0] || '').trim();
          const secondCell = String(row[1] || '').trim();

          if (firstCell === 'A. Utama') {
            currentCategory = 'utama';
            continue;
          }
          if (firstCell === 'B. Tambahan') {
            currentCategory = 'tambahan';
            continue;
          }
          if (firstCell === 'Perilaku Kerja' || secondCell === 'Perilaku Kerja') {
            break; 
          }

          const idNum = parseInt(firstCell, 10);
          if (!isNaN(idNum) && secondCell.length > 0 && currentCategory) {
            const name = secondCell;
            let kuantitasTarget = 100;
            let kualitasTarget = 100;

            if (i + 1 < rows.length) {
              const nextRow = rows[i + 1];
              const targetText = String(nextRow[1] || nextRow[0] || '');
              
              const qtyMatch = targetText.match(/kuantitas[\s\S]*?(\d+)\s*(?:persen|%)/i);
              const qlyMatch = targetText.match(/kualitas[\s\S]*?(\d+)\s*(?:persen|%)/i);
              
              if (qtyMatch) kuantitasTarget = parseInt(qtyMatch[1], 10);
              if (qlyMatch) kualitasTarget = parseInt(qlyMatch[1], 10);
            }

            const mapping = getTeamAndProjectMapping(name, idNum, currentCategory, fallbackSkpData);

            parsedItems.push({
              id: parsedItems.length + 1,
              excelId: idNum,
              kategori: currentCategory,
              nama: name,
              indikator: [
                { jenis: 'kuantitas', target: kuantitasTarget, realisasi: 0 },
                { jenis: 'kualitas', target: kualitasTarget, realisasi: 0 }
              ],
              status: 'belum',
              tim: mapping.tim,
              cluster: mapping.cluster
            });
          }
        }

        if (parsedItems.length === 0) {
          alert('Tidak ada item SKP yang berhasil diekstraksi dari sheet "Penetapan". Pastikan format file sesuai template.');
          return;
        }

        setParsedSkps(parsedItems);
        setShowConfirmModal(true);
      } catch (err) {
        console.error(evt, err);
        alert('Gagal membaca file Excel: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // Overwrite database batch (saves Teams, Projects, and SKPs)
  const handleConfirmImport = async () => {
    if (parsedSkps.length === 0) return;
    setIsSaving(true);
    try {
      const batch = writeBatch(db);
      
      // 1. Delete all existing user documents in skps, teams, and projects
      const qSkps = query(collection(db, 'skps'), where('userId', '==', user?.uid || null));
      const snapSkps = await getDocs(qSkps);
      snapSkps.forEach(d => batch.delete(d.ref));

      const qTeams = query(collection(db, 'teams'), where('userId', '==', user?.uid || null));
      const snapTeams = await getDocs(qTeams);
      snapTeams.forEach(d => batch.delete(d.ref));

      const qProj = query(collection(db, 'projects'), where('userId', '==', user?.uid || null));
      const snapProj = await getDocs(qProj);
      snapProj.forEach(d => batch.delete(d.ref));

      // 2. Extract and write unique Teams from parsed SKPs
      const uniqueTeams = [...new Set(parsedSkps.map(s => s.tim))];
      uniqueTeams.forEach(tName => {
        const docRef = doc(collection(db, 'teams'));
        batch.set(docRef, {
          nama: tName,
          userId: user?.uid || null,
          createdAt: new Date().toISOString()
        });
      });

      // 3. Extract and write unique Projects from parsed SKPs
      const uniqueProjKeys = new Set();
      parsedSkps.forEach(s => {
        const key = `${s.cluster}_${s.tim}`;
        if (!uniqueProjKeys.has(key)) {
          uniqueProjKeys.add(key);
          const docRef = doc(collection(db, 'projects'));
          batch.set(docRef, {
            nama: s.cluster,
            timNama: s.tim,
            userId: user?.uid || null,
            createdAt: new Date().toISOString()
          });
        }
      });

      // 4. Save all new parsed SKP documents
      parsedSkps.forEach((skp) => {
        const docRef = doc(collection(db, 'skps'));
        batch.set(docRef, {
          ...skp,
          userId: user?.uid || null,
          createdAt: new Date().toISOString()
        });
      });

      await batch.commit();
      setToastMsg(`Berhasil mengimpor ${parsedSkps.length} Rencana SKP beserta data Tim Kerja & Proyek terkait!`);
      setShowConfirmModal(false);
      setParsedSkps([]);
      setActiveStepTab(2); // Jump directly to SKP list
    } catch (err) {
      console.error('Error importing SKPs:', err);
      alert('Gagal mengimpor SKP: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Seed default 29 items into Firestore
  const handleLoadDefaults = async () => {
    if (!confirm('Apakah Anda yakin ingin me-reset data dan memuat 29 SKP bawaan BPS beserta struktur tim kerjanya ke database?')) {
      return;
    }
    setIsSaving(true);
    try {
      const batch = writeBatch(db);

      // 1. Clear existing
      const qSkps = query(collection(db, 'skps'), where('userId', '==', user?.uid || null));
      const snapSkps = await getDocs(qSkps);
      snapSkps.forEach(d => batch.delete(d.ref));

      const qTeams = query(collection(db, 'teams'), where('userId', '==', user?.uid || null));
      const snapTeams = await getDocs(qTeams);
      snapTeams.forEach(d => batch.delete(d.ref));

      const qProj = query(collection(db, 'projects'), where('userId', '==', user?.uid || null));
      const snapProj = await getDocs(qProj);
      snapProj.forEach(d => batch.delete(d.ref));

      // 2. Add default teams
      const defaultTeams = [...new Set(fallbackSkpData.map(item => item.tim))].sort();
      defaultTeams.forEach(tName => {
        const docRef = doc(collection(db, 'teams'));
        batch.set(docRef, {
          nama: tName,
          userId: user?.uid || null,
          createdAt: new Date().toISOString()
        });
      });

      // 3. Add default projects
      const uniqueProjKeys = new Set();
      fallbackSkpData.forEach(s => {
        const key = `${s.cluster}_${s.tim}`;
        if (!uniqueProjKeys.has(key)) {
          uniqueProjKeys.add(key);
          const docRef = doc(collection(db, 'projects'));
          batch.set(docRef, {
            nama: s.cluster,
            timNama: s.tim,
            userId: user?.uid || null,
            createdAt: new Date().toISOString()
          });
        }
      });

      // 4. Add default SKPs
      fallbackSkpData.forEach((skp) => {
        const docRef = doc(collection(db, 'skps'));
        batch.set(docRef, {
          ...skp,
          userId: user?.uid || null,
          createdAt: new Date().toISOString()
        });
      });

      await batch.commit();
      setToastMsg('Berhasil memuat 29 SKP bawaan BPS.');
      setActiveStepTab(2); // Jump to list
    } catch (err) {
      console.error('Error seeding defaults:', err);
      alert('Gagal memuat data bawaan: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Clear all data (starts empty wizard)
  const handleClearAll = async () => {
    if (!confirm('Apakah Anda yakin ingin mengosongkan seluruh data Tim Kerja, Proyek Kerja, dan Rencana SKP? Tindakan ini akan mengembalikan Anda ke wizard kosong.')) {
      return;
    }
    setIsSaving(true);
    try {
      const batch = writeBatch(db);

      const qSkps = query(collection(db, 'skps'), where('userId', '==', user?.uid || null));
      const snapSkps = await getDocs(qSkps);
      snapSkps.forEach(d => batch.delete(d.ref));

      const qTeams = query(collection(db, 'teams'), where('userId', '==', user?.uid || null));
      const snapTeams = await getDocs(qTeams);
      snapTeams.forEach(d => batch.delete(d.ref));

      const qProj = query(collection(db, 'projects'), where('userId', '==', user?.uid || null));
      const snapProj = await getDocs(qProj);
      snapProj.forEach(d => batch.delete(d.ref));

      await batch.commit();
      setToastMsg('Seluruh data berhasil dikosongkan.');
      setActiveStepTab(0); // Return to Step 1
    } catch (err) {
      console.error('Error clearing data:', err);
      alert('Gagal mengosongkan data: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };


  // Sub-component rendering for a single SKP Card
  const renderCard = (item) => {
    const kuantitas = item.indikator.find((i) => i.jenis === 'kuantitas');
    const kualitas = item.indikator.find((i) => i.jenis === 'kualitas');
    
    const kuantitasPct = kuantitas
      ? Math.round((kuantitas.realisasi / kuantitas.target) * 100)
      : 0;
    const kualitasPct = kualitas
      ? Math.round((kualitas.realisasi / kualitas.target) * 100)
      : 0;
    const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.belum;

    return (
      <div key={item.id} className={styles.card}>
        {/* Top row: info + status */}
        <div className={styles.cardTop}>
          <div className={styles.cardLeft}>
            <div className={styles.numberBadge}>{item.id}</div>
            <div className={styles.cardInfo}>
              <p className={styles.cardName}>{item.nama}</p>
              <div className={styles.cardTags}>
                <span
                  className={`${styles.categoryBadge} ${
                    item.kategori === 'utama'
                      ? styles.categoryUtama
                      : styles.categoryTambahan
                  }`}
                >
                  {item.kategori}
                </span>
                <span className={styles.timTag}>
                  <span className={styles.tagIcon}><Users size={14} /></span>
                  {item.tim}
                </span>
                <span className={styles.clusterTag}>
                  <span className={styles.tagIcon}><Folder size={14} /></span>
                  {item.cluster}
                </span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className={`${styles.statusBadge} ${statusCfg.class}`}>
              {statusCfg.label}
            </span>
            <button 
              onClick={() => handleDeleteSkpClick(item.id)} 
              className={styles.cardDeleteBtn}
              title="Hapus Rencana SKP"
              disabled={isSaving}
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Progress bars */}
        <div className={styles.progressSection}>
          {/* Kuantitas */}
          <div className={styles.progressItem}>
            <div className={styles.progressHeader}>
              <span className={styles.progressLabel}>Kuantitas</span>
              <span className={styles.progressValue}>
                {kuantitas ? kuantitas.realisasi : 0} / {kuantitas ? kuantitas.target : 100}
                <span style={{ marginLeft: 6, opacity: 0.6, fontSize: '0.72rem' }}>
                  ({kuantitasPct}%)
                </span>
              </span>
            </div>
            <div className={styles.progressTrack}>
              <div
                className={`${styles.progressFill} ${styles.progressKuantitas}`}
                style={{ width: `${Math.min(100, kuantitasPct)}%` }}
              />
            </div>
          </div>

          {/* Kualitas */}
          <div className={styles.progressItem}>
            <div className={styles.progressHeader}>
              <span className={styles.progressLabel}>Kualitas</span>
              <span className={styles.progressValue}>
                {kualitas ? kualitas.realisasi : 0} / {kualitas ? kualitas.target : 100}
                <span style={{ marginLeft: 6, opacity: 0.6, fontSize: '0.72rem' }}>
                  ({kualitasPct}%)
                </span>
              </span>
            </div>
            <div className={styles.progressTrack}>
              <div
                className={`${styles.progressFill} ${
                  getProgressClass(kualitasPct) || styles.progressKualitas
                }`}
                style={{ width: `${Math.min(100, kualitasPct)}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerTitleRow}>
          <div>
            <h1 className={styles.title} style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
              <ClipboardList size={28} /> Sasaran Kinerja Pegawai
            </h1>
            <p className={styles.subtitle}>
              Pengaturan Tim Kerja, Proyek Strategis, dan Sasaran Kinerja Individu
            </p>
          </div>
          <div className={styles.actionButtons}>
            <button 
              className={styles.importBtn}
              onClick={() => document.getElementById('excel-file-input').click()}
              disabled={isSaving}
              title="Import SKP, Tim, dan Proyek sekaligus dari file Excel BPS"
            >
              <Upload size={16} /> Import Excel
            </button>
            <input 
              type="file"
              id="excel-file-input"
              accept=".xlsx, .xls"
              style={{ display: 'none' }}
              onChange={handleImportExcel}
            />
            <button 
              className={styles.resetBtn}
              onClick={handleLoadDefaults}
              disabled={isSaving}
              title="Muat 29 SKP bawaan BPS ke database Anda"
            >
              <RotateCcw size={16} /> Gunakan 29 SKP Bawaan
            </button>
            {isCustom && (
              <button 
                className={styles.clearBtn}
                onClick={handleClearAll}
                disabled={isSaving}
                title="Kosongkan seluruh data custom untuk membuat baru dari nol"
              >
                <Trash2 size={16} /> Kosongkan Semua
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Onboarding Banner if Empty */}
      {skpData.length === 0 && !skpLoading && (
        <div className={styles.onboardingBanner}>
          <div className={styles.onboardingIcon}><Sparkles size={24} /></div>
          <div className={styles.onboardingContent}>
            <h3>Mulai Siapkan Sasaran Kinerja Pegawai (SKP)</h3>
            <p>Database SKP Anda saat ini masih kosong. Silakan ikuti tahapan pengaturan 3 langkah di bawah secara berurutan, memuat template bawaan BPS, atau mengimpor file Excel.</p>
          </div>
        </div>
      )}

      {/* 3-Step Wizard Navigation */}
      <div className={styles.stepTabs}>
        <button 
          className={`${styles.stepTab} ${activeStepTab === 0 ? styles.stepTabActive : ''}`}
          onClick={() => setActiveStepTab(0)}
        >
          <span className={styles.stepNumber}>1</span>
          <Users size={16} />
          <span>Tim Kerja ({teams.length})</span>
          {teams.length > 0 && <span className={styles.stepCheck}><Check size={12} /></span>}
        </button>
        <button 
          className={`${styles.stepTab} ${activeStepTab === 1 ? styles.stepTabActive : ''}`}
          onClick={() => setActiveStepTab(1)}
        >
          <span className={styles.stepNumber}>2</span>
          <Folder size={16} />
          <span>Proyek Tim ({projects.length})</span>
          {projects.length > 0 && <span className={styles.stepCheck}><Check size={12} /></span>}
        </button>
        <button 
          className={`${styles.stepTab} ${activeStepTab === 2 ? styles.stepTabActive : ''}`}
          onClick={() => setActiveStepTab(2)}
        >
          <span className={styles.stepNumber}>3</span>
          <ClipboardList size={16} />
          <span>Rencana SKP ({skpData.length})</span>
          {skpData.length > 0 && <span className={styles.stepCheck}><Check size={12} /></span>}
        </button>
      </div>

      {/* STEP 1: SETTING TIM KERJA */}
      {activeStepTab === 0 && (
        <div className={styles.stepContainer}>
          <div className={styles.setupCard}>
            <h3>👥 Tambah Tim Kerja Baru</h3>
            <p className={styles.setupCardDesc}>Tim Kerja adalah divisi utama di lingkungan BPS (misal: Subbagian Umum, Tim Statistik Sosial).</p>
            <form onSubmit={handleAddTeamSubmit} className={styles.inlineForm}>
              <input 
                type="text" 
                placeholder="Contoh: Subbagian Umum, Tim Statistik Sosial..." 
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                className={styles.setupInput}
                required
              />
              <button type="submit" className={styles.setupAddBtn}>
                <Plus size={16} /> Tambah Tim
              </button>
            </form>
          </div>

          <div className={styles.setupListCard}>
            <h3>Daftar Tim Kerja</h3>
            {teamsLoading ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#94a3b8' }}>Memuat data tim...</div>
            ) : teams.length === 0 ? (
              <div className={styles.setupEmptyState}>Belum ada Tim Kerja. Silakan tambah di atas atau klik "Gunakan 29 SKP Bawaan".</div>
            ) : (
              <table className={styles.setupTable}>
                <thead>
                  <tr>
                    <th style={{ width: '60px' }}>No</th>
                    <th>Nama Tim Kerja</th>
                    <th style={{ width: '120px', textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((t, idx) => (
                    <tr key={t.id}>
                      <td>{idx + 1}</td>
                      <td>
                        {editingTeamId === t.id ? (
                          <input 
                            type="text" 
                            value={editingTeamName} 
                            onChange={(e) => setEditingTeamName(e.target.value)} 
                            className={styles.tableInput}
                          />
                        ) : (
                          t.nama
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div className={styles.tableActions}>
                          {editingTeamId === t.id ? (
                            <>
                              <button onClick={() => handleSaveTeamEdit(t.id)} className={styles.btnSave} title="Simpan"><Check size={14} /></button>
                              <button onClick={() => setEditingTeamId(null)} className={styles.btnCancel} title="Batal"><X size={14} /></button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => handleStartTeamEdit(t)} className={styles.btnEdit} title="Ubah"><Edit2 size={14} /></button>
                              <button onClick={() => handleDeleteTeamClick(t)} className={styles.btnDelete} title="Hapus"><Trash2 size={14} /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* STEP 2: SETTING PROYEK TIM */}
      {activeStepTab === 1 && (
        <div className={styles.stepContainer}>
          <div className={styles.setupCard}>
            <h3>📂 Tambah Proyek Tim Baru</h3>
            <p className={styles.setupCardDesc}>Proyek Tim (Klaster) adalah program kerja strategis yang berada di bawah naungan Tim Kerja induk.</p>
            <form onSubmit={handleAddProjectSubmit} className={styles.projectForm}>
              <div className={styles.formRow}>
                <div className={styles.formCol}>
                  <label>Pilih Tim Kerja Induk</label>
                  <select 
                    value={newProjTimName} 
                    onChange={(e) => setNewProjTimName(e.target.value)}
                    className={styles.setupSelect}
                    required
                  >
                    <option value="">— Pilih Tim Kerja —</option>
                    {teams.map(t => (
                      <option key={t.id} value={t.nama}>{t.nama}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.formCol}>
                  <label>Nama Proyek Kerja</label>
                  <input 
                    type="text" 
                    placeholder="Contoh: SBR, SAKERNAS 2026, Pengelolaan Peta..." 
                    value={newProjName}
                    onChange={(e) => setNewProjName(e.target.value)}
                    className={styles.setupInput}
                    required
                  />
                </div>
              </div>
              <button type="submit" className={styles.setupAddBtn} style={{ marginTop: '12px' }}>
                <Plus size={16} /> Tambah Proyek
              </button>
            </form>
          </div>

          <div className={styles.setupListCard}>
            <h3>Daftar Proyek Tim</h3>
            {projectsLoading ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#94a3b8' }}>Memuat data proyek...</div>
            ) : projects.length === 0 ? (
              <div className={styles.setupEmptyState}>Belum ada Proyek Tim. Pastikan Anda telah membuat Tim Kerja di Langkah 1.</div>
            ) : (
              <table className={styles.setupTable}>
                <thead>
                  <tr>
                    <th style={{ width: '60px' }}>No</th>
                    <th>Nama Proyek Kerja</th>
                    <th>Tim Kerja Induk</th>
                    <th style={{ width: '120px', textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p, idx) => (
                    <tr key={p.id}>
                      <td>{idx + 1}</td>
                      <td>
                        {editingProjectId === p.id ? (
                          <input 
                            type="text" 
                            value={editingProjectName} 
                            onChange={(e) => setEditingProjectName(e.target.value)} 
                            className={styles.tableInput}
                          />
                        ) : (
                          p.nama
                        )}
                      </td>
                      <td>
                        {editingProjectId === p.id ? (
                          <select 
                            value={editingProjectTim} 
                            onChange={(e) => setEditingProjectTim(e.target.value)}
                            className={styles.tableSelect}
                          >
                            {teams.map(t => (
                              <option key={t.id} value={t.nama}>{t.nama}</option>
                            ))}
                          </select>
                        ) : (
                          p.timNama
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div className={styles.tableActions}>
                          {editingProjectId === p.id ? (
                            <>
                              <button onClick={() => handleSaveProjectEdit(p.id)} className={styles.btnSave} title="Simpan"><Check size={14} /></button>
                              <button onClick={() => setEditingProjectId(null)} className={styles.btnCancel} title="Batal"><X size={14} /></button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => handleStartProjectEdit(p)} className={styles.btnEdit} title="Ubah"><Edit2 size={14} /></button>
                              <button onClick={() => handleDeleteProjectClick(p.id)} className={styles.btnDelete} title="Hapus"><Trash2 size={14} /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* STEP 3: SETTING RENCANA SKP */}
      {activeStepTab === 2 && (
        <div className={styles.stepContainer}>
          <div className={styles.setupCard}>
            <h3>📋 Tambah Rencana Kerja SKP Baru</h3>
            <p className={styles.setupCardDesc}>Sasaran Kinerja Pegawai individu pegawai yang berinduk pada Proyek Tim tertentu.</p>
            <form onSubmit={handleAddSkpSubmit} className={styles.skpForm}>
              <div className={styles.formRow}>
                <div className={styles.formCol}>
                  <label>Pilih Tim Kerja</label>
                  <select 
                    value={newSkpTim} 
                    onChange={(e) => {
                      setNewSkpTim(e.target.value);
                      setNewSkpProj('');
                    }}
                    className={styles.setupSelect}
                    required
                  >
                    <option value="">— Pilih Tim Kerja —</option>
                    {teams.map(t => (
                      <option key={t.id} value={t.nama}>{t.nama}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.formCol}>
                  <label>Pilih Proyek Tim</label>
                  <select 
                    value={newSkpProj} 
                    onChange={(e) => setNewSkpProj(e.target.value)}
                    className={styles.setupSelect}
                    required
                    disabled={!newSkpTim}
                  >
                    <option value="">— Pilih Proyek Kerja —</option>
                    {projects.filter(p => p.timNama === newSkpTim).map(p => (
                      <option key={p.id} value={p.nama}>{p.nama}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.formCol}>
                  <label>Kategori SKP</label>
                  <select 
                    value={newSkpKategori} 
                    onChange={(e) => setNewSkpKategori(e.target.value)}
                    className={styles.setupSelect}
                    required
                  >
                    <option value="utama">Utama</option>
                    <option value="tambahan">Tambahan</option>
                  </select>
                </div>
              </div>
              
              <div className={styles.formGroup} style={{ marginTop: '12px' }}>
                <label>Rencana Hasil Kerja SKP</label>
                <textarea 
                  placeholder="Contoh: Terkelolanya perangkat IT dan Aplikasi BPS secara berkala..." 
                  value={newSkpName}
                  onChange={(e) => setNewSkpName(e.target.value)}
                  className={styles.setupTextarea}
                  rows={2}
                  required
                />
              </div>

              <div className={styles.formRow} style={{ marginTop: '12px' }}>
                <div className={styles.formCol}>
                  <label>Target Kuantitas (%)</label>
                  <input 
                    type="number" 
                    value={newSkpTargetQty}
                    onChange={(e) => setNewSkpTargetQty(Number(e.target.value))}
                    className={styles.setupInput}
                    min={1}
                    max={100}
                    required
                  />
                </div>
                <div className={styles.formCol}>
                  <label>Target Kualitas (%)</label>
                  <input 
                    type="number" 
                    value={newSkpTargetQly}
                    onChange={(e) => setNewSkpTargetQly(Number(e.target.value))}
                    className={styles.setupInput}
                    min={1}
                    max={100}
                    required
                  />
                </div>
              </div>

              <button type="submit" className={styles.setupAddBtn} style={{ marginTop: '14px' }}>
                <Plus size={16} /> Tambah Rencana SKP
              </button>
            </form>
          </div>

          {/* Filtering & View Switcher */}
          {skpData.length > 0 && (
            <div className={styles.filterBar}>
              <div className={styles.searchWrapper}>
                <span className={styles.searchIcon}><Search size={18} /></span>
                <input
                  type="text"
                  className={styles.searchInput}
                  placeholder="Cari SKP berdasarkan nama..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <select
                className={styles.filterSelect}
                value={filterKategori}
                onChange={(e) => setFilterKategori(e.target.value)}
                aria-label="Filter Kategori"
              >
                <option value="semua">Semua Kategori</option>
                <option value="utama">Utama</option>
                <option value="tambahan">Tambahan</option>
              </select>

              <select
                className={styles.filterSelect}
                value={filterTim}
                onChange={(e) => setFilterTim(e.target.value)}
                aria-label="Filter Tim Kerja"
              >
                <option value="semua">Semua Tim Kerja</option>
                {timList.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              <select
                className={styles.filterSelect}
                value={filterCluster}
                onChange={(e) => setFilterCluster(e.target.value)}
                aria-label="Filter Proyek Tim"
              >
                <option value="semua">Semua Proyek Tim</option>
                {clusterList.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <select
                className={styles.filterSelect}
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                aria-label="Filter Status"
              >
                <option value="semua">Semua Status</option>
                <option value="selesai">Selesai</option>
                <option value="progress">Dalam Proses</option>
                <option value="belum">Belum Dimulai</option>
                <option value="terlambat">Terlambat</option>
              </select>

              <div className={styles.viewModeToggle}>
                <button 
                  className={`${styles.viewBtn} ${viewMode === 'list' ? styles.viewBtnActive : ''}`}
                  onClick={() => setViewMode('list')}
                  title="Tampilan List"
                >
                  <LayoutGrid size={16} />
                </button>
                <button 
                  className={`${styles.viewBtn} ${viewMode === 'hierarki' ? styles.viewBtnActive : ''}`}
                  onClick={() => setViewMode('hierarki')}
                  title="Tampilan Hierarki"
                >
                  <Network size={16} />
                </button>
              </div>

              <span className={styles.resultCount}>
                {filtered.length} dari {skpData.length} item
              </span>
            </div>
          )}

          {/* Cards Area */}
          {skpLoading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
              Memuat data SKP...
            </div>
          ) : skpData.length === 0 ? (
            <div className={styles.setupEmptyState} style={{ padding: '40px 0' }}>
              Belum ada Rencana Kerja SKP. Pastikan Anda telah mengisi Langkah 1 dan Langkah 2 sebelum menambahkan SKP.
            </div>
          ) : filtered.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}><Inbox size={48} /></div>
              <p className={styles.emptyText}>Tidak ada SKP ditemukan</p>
              <p className={styles.emptySubtext}>Coba ubah filter atau kata kunci pencarian</p>
            </div>
          ) : viewMode === 'hierarki' ? (
            /* HIERARCHICAL VIEW */
            <div className={styles.hierarkiContainer}>
              {Object.entries(groupedHierarchicalData).map(([timName, proyekMap]) => {
                const isTimExpanded = expandedTims[timName] !== false;
                const timCount = Object.values(proyekMap).reduce((sum, list) => sum + list.length, 0);

                return (
                  <div key={timName} className={styles.timGroup}>
                    <button 
                      className={styles.timGroupHeader}
                      onClick={() => toggleTimGroup(timName)}
                    >
                      <div className={styles.timTitleBlock}>
                        <ChevronRight 
                          size={18} 
                          className={`${styles.chevronIcon} ${isTimExpanded ? styles.chevronRotated : ''}`} 
                        />
                        <Users size={18} className={styles.timIcon} />
                        <span className={styles.timNameText}>{timName}</span>
                      </div>
                      <span className={styles.timCountBadge}>{timCount} SKP</span>
                    </button>
                    
                    {isTimExpanded && (
                      <div className={styles.timGroupContent}>
                        {Object.entries(proyekMap).map(([proyekName, items]) => (
                          <div key={proyekName} className={styles.proyekSubgroup}>
                            <div className={styles.proyekHeader}>
                              <Folder size={15} className={styles.proyekIcon} />
                              <span className={styles.proyekNameText}>{proyekName}</span>
                              <span className={styles.proyekCount}>({items.length} Rencana SKP)</span>
                            </div>
                            <div className={styles.proyekContent}>
                              {items.map(item => renderCard(item))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* FLAT CARD LIST */
            <div className={styles.cardList}>
              {filtered.map((item) => renderCard(item))}
            </div>
          )}
        </div>
      )}

      {/* CONFIRM IMPORT MODAL */}
      {showConfirmModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContainer}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Konfirmasi Impor SKP</h2>
              <button 
                className={styles.modalCloseBtn}
                onClick={() => { setShowConfirmModal(false); setParsedSkps([]); }}
              >
                <X size={20} />
              </button>
            </div>
            <div className={styles.modalContent}>
              <p>Berhasil membaca file Excel! Ditemukan <strong>{parsedSkps.length} item SKP</strong>:</p>
              <div className={styles.statsSummary}>
                <div className={styles.statsItem}>
                  <span>Utama:</span>
                  <strong>{parsedSkps.filter(s => s.kategori === 'utama').length}</strong>
                </div>
                <div className={styles.statsItem}>
                  <span>Tambahan:</span>
                  <strong>{parsedSkps.filter(s => s.kategori === 'tambahan').length}</strong>
                </div>
              </div>
              <p style={{ marginTop: '12px', color: '#f87171', fontSize: '0.82rem', fontWeight: 500 }}>
                Peringatan: Melanjutkan proses ini akan menghapus semua Tim Kerja, Proyek Kerja, dan Rencana Kerja SKP Anda saat ini di sistem dan menimpanya dengan daftar baru dari Excel!
              </p>
            </div>
            <div className={styles.modalActions}>
              <button 
                className={styles.btnSecondary}
                onClick={() => { setShowConfirmModal(false); setParsedSkps([]); }}
                disabled={isSaving}
              >
                Batal
              </button>
              <button 
                className={styles.btnConfirm}
                onClick={handleConfirmImport}
                disabled={isSaving}
              >
                {isSaving ? 'Menyimpan...' : 'Ya, Impor & Timpa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUCCESS TOAST NOTIFICATION */}
      {toastMsg && (
        <div className={styles.toast}>
          <Check size={18} />
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
}
