export const speak = (text: string) => {
  if (!('speechSynthesis' in window)) return;

  // Cancel pending speech to avoid queue buildup
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'pt-BR';
  utterance.rate = 0.9; // Slightly slower for elderly
  utterance.pitch = 1;
  
  window.speechSynthesis.speak(utterance);
};