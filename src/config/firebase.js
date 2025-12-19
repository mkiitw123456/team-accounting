// src/config/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCwQjAtEjJGhVv2KuB0HwazdqQ4lhP2I_w",
  authDomain: "nmsl-accounting.firebaseapp.com",
  projectId: "nmsl-accounting",
  storageBucket: "nmsl-accounting.firebasestorage.app",
  messagingSenderId: "623278577938",
  appId: "1:623278577938:web:a7fa005c80168303437bcb",
  measurementId: "G-0B3WN5F2CP"
};

// 初始化 Firebase
let app;
let db;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
} catch (error) {
  console.error("Firebase 初始化失敗，請檢查設定檔", error);
}

export { db };