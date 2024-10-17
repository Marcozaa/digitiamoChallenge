// Import the functions you need from the SDKs you need
const { initializeApp } = require("firebase/app");
const { getFirestore } = require("firebase/firestore");

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCM6yz1kxXSrmZnEndm0VyzhI-JeXkF-bs",
  authDomain: "httprequestapp-97753.firebaseapp.com",
  projectId: "httprequestapp-97753",
  storageBucket: "httprequestapp-97753.appspot.com",
  messagingSenderId: "368052827198",
  appId: "1:368052827198:web:5510831a3ddc6f97040d6f",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

const db = getFirestore(app);

module.exports = { db };
