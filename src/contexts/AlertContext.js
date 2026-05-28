'use client';

import React, { createContext, useContext, useState } from 'react';
import styles from './AlertContext.module.css';

const AlertContext = createContext();

export function AlertProvider({ children }) {
  const [alert, setAlert] = useState(null);

  const showAlert = (message, title = 'Informasi') => {
    setAlert({ message, title });
  };

  const closeAlert = () => {
    setAlert(null);
  };

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
      {alert && (
        <div className={styles.overlay}>
          <div className={styles.dialog}>
            <div className={styles.header}>
              <h3 className={styles.title}>{alert.title}</h3>
            </div>
            <div className={styles.body}>
              <p className={styles.message}>{alert.message}</p>
            </div>
            <div className={styles.footer}>
              <button className={styles.btnOk} onClick={closeAlert}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </AlertContext.Provider>
  );
}

export function useAlert() {
  return useContext(AlertContext);
}
