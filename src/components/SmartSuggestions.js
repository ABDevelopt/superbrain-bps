'use client';
import { useState } from 'react';
import styles from './SmartSuggestions.module.css';
import { Sparkles, CheckCircle2, Clock, Check, X } from 'lucide-react';
import { useFirestore } from '@/hooks/useFirestore';
import { skpData } from '@/data/skpData';
import { getSmartSuggestionsAction } from '@/actions/suggestions';

export default function SmartSuggestions({ contextData }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const [error, setError] = useState(null);
  
  const { addDocument: addCkp } = useFirestore('ckp');
  const { addDocument: addTask, updateDocument: updateTask } = useFirestore('tasks');

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    try {
      const skpContext = skpData
        .map((item) => `ID: ${item.id}, Nama: "${item.nama}", Cluster: ${item.cluster}`)
        .join('\n');
      
      const contextString = JSON.stringify(contextData, null, 2);

      const systemPrompt = `Anda adalah asisten AI proaktif untuk pegawai Badan Pusat Statistik (BPS).
Tugas Anda adalah mengamati data Jadwal, Tugas, dan Catatan Kegiatan Pegawai (CKP) yang diberikan, menemukan kesenjangan (gap) atau hal yang terlupakan, dan memberikan rekomendasi tindakan konkret.

Data saat ini:
${contextString}

Referensi Daftar SKP:
${skpContext}

Aturan Pemberian Saran:
1. Jika ada Jadwal hari ini atau masa lalu yang belum memiliki entri CKP, sarankan untuk membuat CKP (CREATE_CKP).
2. Jika ada Jadwal mendatang yang belum memiliki persiapan tugas (Task), sarankan untuk membuat tugas (CREATE_TASK).
3. Jika ada Tugas yang sepertinya sudah selesai tetapi statusnya masih "belum" atau "dikerjakan", sarankan untuk memperbarui statusnya ke "done" (UPDATE_TASK).
4. Berikan MAKSIMAL 3 saran paling penting.
5. Jangan gunakan emoji atau emoticon apa pun dalam teks.

KEMBALIKAN HANYA SEBUAH OBJEK JSON DENGAN FORMAT BERIKUT (TANPA MARKDOWN BLOCKS):
{
  "suggestions": [
    {
      "id": "unik-id",
      "type": "CREATE_CKP | CREATE_TASK | UPDATE_TASK",
      "title": "Judul Saran",
      "description": "Alasan singkat tanpa emoji",
      "actionData": { }
    }
  ]
}
`;

      const result = await getSmartSuggestionsAction(systemPrompt);
      if (result && result.suggestions) {
        setSuggestions(result.suggestions);
      } else {
        throw new Error('Data saran tidak valid');
      }
      setAnalyzed(true);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Gagal menganalisis data');
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async (sugg) => {
    try {
      if (sugg.type === 'CREATE_CKP') {
        await addCkp({
          ...sugg.actionData,
          tanggal: sugg.actionData.tanggal || new Date().toISOString().split('T')[0],
        });
      } else if (sugg.type === 'CREATE_TASK') {
        await addTask({
          ...sugg.actionData,
          tanggalDibuat: new Date().toISOString().split('T')[0],
        });
      } else if (sugg.type === 'UPDATE_TASK') {
        if (!sugg.actionData.id) throw new Error('Task ID missing');
        await updateTask(sugg.actionData.id, {
          status: sugg.actionData.status
        });
      }
      
      // Remove executed suggestion
      setSuggestions(prev => prev.filter(s => s.id !== sugg.id));
    } catch (err) {
      alert('Gagal mengeksekusi saran: ' + err.message);
    }
  };

  const handleDismiss = (id) => {
    setSuggestions(prev => prev.filter(s => s.id !== id));
  };

  if (analyzed && suggestions.length === 0 && !loading) {
    return null; // hide if all clear
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <Sparkles size={18} className={styles.icon} />
          <h3 className={styles.title}>Rekomendasi Cerdas AI</h3>
        </div>
        {!analyzed && !loading && (
          <button onClick={handleAnalyze} className={styles.analyzeBtn}>
            Dapatkan Saran
          </button>
        )}
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {loading && (
        <div className={styles.loadingArea}>
          <div className={styles.shimmer}></div>
          <p>Menganalisis jadwal dan pekerjaan Anda...</p>
        </div>
      )}

      {analyzed && suggestions.length > 0 && (
        <div className={styles.suggestionList}>
          {suggestions.map((sugg) => (
            <div key={sugg.id} className={styles.suggestionCard}>
              <div className={styles.cardContent}>
                <h4 className={styles.cardTitle}>{sugg.title}</h4>
                <p className={styles.cardDesc}>{sugg.description}</p>
              </div>
              <div className={styles.cardActions}>
                <button onClick={() => handleExecute(sugg)} className={styles.actionBtn}>
                  <Check size={16} /> Lakukan
                </button>
                <button onClick={() => handleDismiss(sugg.id)} className={styles.dismissBtn}>
                  <X size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
