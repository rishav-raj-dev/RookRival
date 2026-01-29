// Test script to identify undefined imports
console.log('Testing imports...\n');

// Test lucide-react icons
try {
  const lucide = require('lucide-react');
  console.log('✓ lucide-react loaded');
  console.log('  Clock:', typeof lucide.Clock);
  console.log('  Flag:', typeof lucide.Flag);
  console.log('  Handshake:', typeof lucide.Handshake);
  console.log('  ArrowLeft:', typeof lucide.ArrowLeft);
  console.log('  Trophy:', typeof lucide.Trophy);
} catch (e) {
  console.log('✗ lucide-react error:', e.message);
}

console.log('\n');

// Test react-chessboard
try {
  const chessboard = require('react-chessboard');
  console.log('✓ react-chessboard loaded');
  console.log('  Chessboard:', typeof chessboard.Chessboard);
} catch (e) {
  console.log('✗ react-chessboard error:', e.message);
}
