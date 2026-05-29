export const fetchGCalEvents = async (accessToken, timeMin, timeMax) => {
  if (!accessToken) return [];
  try {
    const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
    url.searchParams.append('timeMin', timeMin.toISOString());
    if (timeMax) {
      url.searchParams.append('timeMax', timeMax.toISOString());
    }
    url.searchParams.append('singleEvents', 'true');
    url.searchParams.append('orderBy', 'startTime');
    // Just fetch a reasonable amount
    url.searchParams.append('maxResults', '100');

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      if (res.status === 401) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('sb_google_access_token');
        }
        console.warn('Google Calendar access token is invalid or expired. Persisted token cleared.');
        return [];
      }
      const errText = await res.text();
      throw new Error(`Failed to fetch GCal events: ${res.status} ${errText}`);
    }
    const data = await res.json();
    
    // Map to our app format
    return (data.items || []).map(item => {
      let tanggal = '';
      let waktu = '00:00';
      
      if (item.start.dateTime) {
        const dt = new Date(item.start.dateTime);
        tanggal = dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0') + '-' + String(dt.getDate()).padStart(2,'0');
        waktu = String(dt.getHours()).padStart(2,'0') + ':' + String(dt.getMinutes()).padStart(2,'0');
      } else if (item.start.date) {
        tanggal = item.start.date; // YYYY-MM-DD
      }

      let waktuSelesai = '';
      if (item.end && item.end.dateTime) {
        const dte = new Date(item.end.dateTime);
        waktuSelesai = String(dte.getHours()).padStart(2,'0') + ':' + String(dte.getMinutes()).padStart(2,'0');
      }

      return {
        id: `gcal-${item.id}`,
        gcalEventId: item.id,
        judul: item.summary || '(Tanpa Judul)',
        deskripsi: item.description || '',
        tanggal,
        waktu,
        waktuSelesai,
        lokasi: item.location || '',
        meetLink: item.hangoutLink || '',
        creator: item.creator ? item.creator.email : '',
        attendees: item.attendees || [],
        htmlLink: item.htmlLink || '',
        kategori: 'Google Calendar', // We can tag it to show a special icon/color
        isGCal: true,
      };
    });
  } catch (err) {
    console.error("GCal fetch error:", err);
    return [];
  }
};

const mapToGCalEvent = (appEvent) => {
  // Assume appEvent.tanggal = '2026-05-28', appEvent.waktu = '09:00'
  const startStr = `${appEvent.tanggal}T${appEvent.waktu || '09:00'}:00`;
  const startDate = new Date(startStr);
  
  // End date default +1 hour
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

  return {
    summary: appEvent.judul,
    description: appEvent.deskripsi 
      ? `[${appEvent.kategori}]\n${appEvent.deskripsi}` 
      : `[${appEvent.kategori}]`,
    start: {
      dateTime: startDate.toISOString(),
    },
    end: {
      dateTime: endDate.toISOString(),
    }
  };
};

export const createGCalEvent = async (accessToken, appEvent) => {
  if (!accessToken) return null;
  try {
    const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mapToGCalEvent(appEvent)),
    });
    if (!res.ok) {
      if (res.status === 401) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('sb_google_access_token');
        }
        console.warn('Google Calendar access token is invalid or expired. Persisted token cleared.');
        return null;
      }
      throw new Error('Failed to create GCal event');
    }
    const data = await res.json();
    return data.id; // Return the created GCal event ID
  } catch (err) {
    console.error("GCal create error:", err);
    return null;
  }
};

export const updateGCalEvent = async (accessToken, gcalEventId, appEvent) => {
  if (!accessToken || !gcalEventId) return;
  try {
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${gcalEventId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mapToGCalEvent(appEvent)),
    });
    if (!res.ok) {
      if (res.status === 401) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('sb_google_access_token');
        }
        console.warn('Google Calendar access token is invalid or expired. Persisted token cleared.');
        return;
      }
      throw new Error('Failed to update GCal event');
    }
  } catch (err) {
    console.error("GCal update error:", err);
  }
};

export const deleteGCalEvent = async (accessToken, gcalEventId) => {
  if (!accessToken || !gcalEventId) return;
  try {
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${gcalEventId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!res.ok) {
      if (res.status === 401) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('sb_google_access_token');
        }
        console.warn('Google Calendar access token is invalid or expired. Persisted token cleared.');
        return;
      }
      throw new Error('Failed to delete GCal event');
    }
  } catch (err) {
    console.error("GCal delete error:", err);
  }
};
