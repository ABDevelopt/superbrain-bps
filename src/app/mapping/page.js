'use client';
import { useState, useEffect } from 'react';
import { Monitor, Map as MapIcon, BarChart2, Book, Users, ClipboardList, Folder } from 'lucide-react';
import styles from './page.module.css';
import { skpData } from '@/data/skpData';

export default function Mapping() {
  const [clusters, setClusters] = useState({});

  useEffect(() => {
    // Group SKP data by cluster
    const grouped = skpData.reduce((acc, item) => {
      if (!acc[item.cluster]) {
        acc[item.cluster] = [];
      }
      acc[item.cluster].push(item);
      return acc;
    }, {});
    setClusters(grouped);
  }, []);

  const getStatusClass = (status) => {
    switch (status) {
      case 'belum': return styles.statusBelum;
      case 'progress': return styles.statusProgress;
      case 'selesai': return styles.statusSelesai;
      case 'terlambat': return styles.statusTerlambat;
      default: return styles.statusBelum;
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

  const getClusterIcon = (cluster) => {
    switch (cluster) {
      case 'IT & Digital': return <Monitor size={18} />;
      case 'Geospasial': return <MapIcon size={18} />;
      case 'Survei & Sensus': return <BarChart2 size={18} />;
      case 'Publikasi & Data': return <Book size={18} />;
      case 'Pelayanan & Koordinasi': return <Users size={18} />;
      case 'Administrasi': return <ClipboardList size={18} />;
      default: return <Folder size={18} />;
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Work Mapping</h1>
        <p className={styles.subtitle}>Peta keseluruhan program dan kegiatan (SKP)</p>
      </div>

      <div className={styles.mapContainer}>
        {Object.entries(clusters).map(([clusterName, items]) => (
          <div key={clusterName} className={styles.cluster}>
            <div className={styles.clusterHeader}>
              <span>{getClusterIcon(clusterName)}</span>
              <span>{clusterName}</span>
              <span style={{ fontSize: '12px', opacity: 0.8, marginLeft: '8px' }}>({items.length} kegiatan)</span>
            </div>
            
            <div className={styles.nodes}>
              {items.map(item => (
                <div key={item.id} className={styles.node}>
                  <h3 className={styles.nodeTitle}>{item.nama}</h3>
                  <div className={styles.nodeMeta}>
                    <span className={styles.team}><Users size={14} /> {item.tim}</span>
                    <span className={`${styles.status} ${getStatusClass(item.status)}`}>
                      {getStatusLabel(item.status)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
