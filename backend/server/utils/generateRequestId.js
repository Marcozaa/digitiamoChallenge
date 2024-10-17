// utils/generateRequestId.js
const generateRequestId = (hostname) => {
  const randomNum = Math.floor(Math.random() * 1000000); // Numero casuale da 0 a 999999
  return `${hostname.replace(/\./g, "")}${randomNum}`; // Concatenare hostname senza punti e numero
};

module.exports = generateRequestId;
