/**
 * Catch Me If You Can — Memory Match Game
 * Drag tiles to find matching pairs. Features collision detection, scoring, timer, and multiple difficulty levels.
 */

// Game configuration
const CONFIG = {
  difficulties: {
    easy: { pairs: 6, timeBonus: 10 },
    medium: { pairs: 8, timeBonus: 15 },
    hard: { pairs: 12, timeBonus: 20 }
  },
  matchDistance: 60, // pixels - how close tiles need to be to match
  pointsPerMatch: 100,
  timeBonusMultiplier: 2
};

// Character images for the memory game
const CHARACTERS = [
  { id: 'leo1', name: 'DiCaprio 1', url: 'https://ianfarrington.wordpress.com/wp-content/uploads/2015/01/catch-me-if-you-can.jpg' },
  { id: 'leo2', name: 'DiCaprio 2', url: 'https://www.thomasmason.co.uk/wp-content/uploads/2021/03/TF09_Copertina_Hero.jpg' },
  { id: 'detective1', name: 'Detective 1', url: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ6Ib904My-AODlMZcFIxHxBAudDbgNOFbSRCmGDcEAtTQwusYuQLT3RdV3OhLV8MisvDg&usqp=CAU' },
  { id: 'detective2', name: 'Detective 2', url: 'https://www.slashfilm.com/img/gallery/tom-hanks-catch-me-if-you-can-casting-completely-changed-the-story/needing-a-cat-for-the-mouse-1650304879.jpg' }
];

// Fun match quotes that reference the movie and AI theme
const MATCH_QUOTES = [
  "Frankly, Horizon — we saw that prompt leak coming.",
  "The model may generalize, but it can't hide.",
  "Abagnale, but make it AI.",
  "Outrun the past? Not when it's trained on you.",
  "Detective GPT-5 doesn't bluff — it benchmarks.",
  "Nice try, but your patterns are showing.",
  "Catch me if you can? Already caught in the training data.",
  "Some connections can't be encrypted.",
  "Even neural networks leave digital fingerprints.",
  "Plot twist: the AI was the detective all along."
];

// DOM elements
const gameBoard = document.getElementById('gameBoard');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const difficultySelect = document.getElementById('difficultySelect');
const scoreEl = document.getElementById('score');
const matchesEl = document.getElementById('matches');
const timerEl = document.getElementById('timer');
const remainingEl = document.getElementById('remaining');
const toastEl = document.getElementById('toast');

// Game state
let gameState = {
  isPlaying: false,
  isPaused: false,
  tiles: [],
  matchedPairs: 0,
  totalPairs: 0,
  score: 0,
  startTime: null,
  timerInterval: null,
  draggedTile: null,
  difficulty: 'medium'
};

// Audio context for sound effects (will be initialized on first user interaction)
let audioContext = null;

// Initialize the game
function init() {
  startBtn.addEventListener('click', startGame);
  restartBtn.addEventListener('click', restartGame);
  difficultySelect.addEventListener('change', (e) => {
    gameState.difficulty = e.target.value;
  });
  
  // Initialize audio context on first user interaction
  document.addEventListener('click', initAudio, { once: true });
  document.addEventListener('touchstart', initAudio, { once: true });
  
  updateUI();
}

function initAudio() {
  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) {
    console.log('Audio not supported');
  }
}

function startGame() {
  gameState.isPlaying = true;
  gameState.isPaused = false;
  gameState.matchedPairs = 0;
  gameState.score = 0;
  gameState.startTime = Date.now();
  
  const difficulty = CONFIG.difficulties[gameState.difficulty];
  gameState.totalPairs = difficulty.pairs;
  
  createTiles();
  startTimer();
  updateUI();
  
  startBtn.disabled = true;
  restartBtn.disabled = false;
  
  showToast('Game started! Drag tiles to find matching pairs.', 'success');
}

function restartGame() {
  stopTimer();
  clearBoard();
  
  gameState.isPlaying = false;
  gameState.isPaused = false;
  gameState.matchedPairs = 0;
  gameState.score = 0;
  gameState.startTime = null;
  gameState.draggedTile = null;
  
  startBtn.disabled = false;
  restartBtn.disabled = true;
  
  updateUI();
  showToast('Game reset. Choose difficulty and start again!');
}

function createTiles() {
  clearBoard();
  gameState.tiles = [];
  
  const difficulty = CONFIG.difficulties[gameState.difficulty];
  const numPairs = difficulty.pairs;
  
  // Create pairs of tiles
  const tilePairs = [];
  for (let i = 0; i < numPairs; i++) {
    const character = CHARACTERS[i % CHARACTERS.length];
    
    // Create two tiles for each pair
    for (let j = 0; j < 2; j++) {
      tilePairs.push({
        id: `${character.id}_${i}_${j}`,
        characterId: character.id,
        name: character.name,
        url: character.url,
        matched: false,
        element: null
      });
    }
  }
  
  // Shuffle the tiles
  shuffleArray(tilePairs);
  
  // Create DOM elements and position tiles
  const boardRect = gameBoard.getBoundingClientRect();
  const tileSize = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--tile-size'));
  const gap = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--gap'));
  
  tilePairs.forEach((tile, index) => {
    const tileEl = createTileElement(tile);
    gameBoard.appendChild(tileEl);
    
    // Position tiles randomly within the board
    const maxX = boardRect.width - tileSize - 40;
    const maxY = boardRect.height - tileSize - 40;
    const x = Math.random() * Math.max(0, maxX) + 20;
    const y = Math.random() * Math.max(0, maxY) + 20;
    
    tileEl.style.left = `${x}px`;
    tileEl.style.top = `${y}px`;
    
    tile.element = tileEl;
    gameState.tiles.push(tile);
  });
}

function createTileElement(tile) {
  const tileEl = document.createElement('div');
  tileEl.className = 'tile';
  tileEl.dataset.tileId = tile.id;
  tileEl.dataset.characterId = tile.characterId;
  
  const img = document.createElement('img');
  img.src = tile.url;
  img.alt = tile.name;
  img.draggable = false;
  tileEl.appendChild(img);
  
  // Add drag functionality
  addDragFunctionality(tileEl, tile);
  
  return tileEl;
}

function addDragFunctionality(element, tile) {
  let isDragging = false;
  let startX, startY, initialX, initialY;
  
  // Mouse events
  element.addEventListener('mousedown', startDrag);
  document.addEventListener('mousemove', drag);
  document.addEventListener('mouseup', endDrag);
  
  // Touch events for mobile
  element.addEventListener('touchstart', startDrag, { passive: false });
  document.addEventListener('touchmove', drag, { passive: false });
  document.addEventListener('touchend', endDrag);
  
  function startDrag(e) {
    if (!gameState.isPlaying || tile.matched) return;
    
    e.preventDefault();
    isDragging = true;
    gameState.draggedTile = tile;
    
    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;
    
    startX = clientX;
    startY = clientY;
    initialX = element.offsetLeft;
    initialY = element.offsetTop;
    
    element.classList.add('dragging');
    
    // Bring to front
    element.style.zIndex = '1000';
  }
  
  function drag(e) {
    if (!isDragging) return;
    
    e.preventDefault();
    
    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;
    
    const deltaX = clientX - startX;
    const deltaY = clientY - startY;
    
    let newX = initialX + deltaX;
    let newY = initialY + deltaY;
    
    // Keep tile within board bounds
    const boardRect = gameBoard.getBoundingClientRect();
    const tileSize = element.offsetWidth;
    
    newX = Math.max(0, Math.min(newX, boardRect.width - tileSize));
    newY = Math.max(0, Math.min(newY, boardRect.height - tileSize));
    
    element.style.left = `${newX}px`;
    element.style.top = `${newY}px`;
    
    // Check for potential matches while dragging
    checkForNearbyMatches(tile, newX, newY);
  }
  
  function endDrag(e) {
    if (!isDragging) return;
    
    isDragging = false;
    gameState.draggedTile = null;
    
    element.classList.remove('dragging');
    element.style.zIndex = '1';
    
    // Check for matches at final position
    const finalX = element.offsetLeft;
    const finalY = element.offsetTop;
    
    checkForMatches(tile, finalX, finalY);
  }
}

function checkForNearbyMatches(draggedTile, x, y) {
  // Clear previous highlights
  gameState.tiles.forEach(tile => {
    if (tile.element) {
      tile.element.classList.remove('highlight');
    }
  });
  
  // Find nearby matching tiles
  gameState.tiles.forEach(tile => {
    if (tile === draggedTile || tile.matched) return;
    
    if (tile.characterId === draggedTile.characterId) {
      const distance = getDistance(x, y, tile.element.offsetLeft, tile.element.offsetTop);
      
      if (distance <= CONFIG.matchDistance) {
        tile.element.classList.add('highlight');
      }
    }
  });
}

function checkForMatches(draggedTile, x, y) {
  // Clear highlights
  gameState.tiles.forEach(tile => {
    if (tile.element) {
      tile.element.classList.remove('highlight');
    }
  });
  
  // Find matching tiles within range
  const matchingTiles = gameState.tiles.filter(tile => {
    if (tile === draggedTile || tile.matched) return false;
    
    if (tile.characterId === draggedTile.characterId) {
      const distance = getDistance(x, y, tile.element.offsetLeft, tile.element.offsetTop);
      return distance <= CONFIG.matchDistance;
    }
    
    return false;
  });
  
  if (matchingTiles.length > 0) {
    // Match found!
    const matchedTile = matchingTiles[0]; // Take the closest one
    handleMatch(draggedTile, matchedTile);
  }
}

function handleMatch(tile1, tile2) {
  // Mark tiles as matched
  tile1.matched = true;
  tile2.matched = true;
  
  // Add match animation
  tile1.element.classList.add('match-animation');
  tile2.element.classList.add('match-animation');
  
  // Update game state
  gameState.matchedPairs++;
  
  // Calculate score with time bonus
  const timeElapsed = (Date.now() - gameState.startTime) / 1000;
  const timeBonus = Math.max(0, CONFIG.difficulties[gameState.difficulty].timeBonus - Math.floor(timeElapsed / 10));
  const points = CONFIG.pointsPerMatch + (timeBonus * CONFIG.timeBonusMultiplier);
  
  gameState.score += points;
  
  // Play success sound
  playSound('match');
  
  // Show animated popup with random quote
  const randomQuote = MATCH_QUOTES[Math.floor(Math.random() * MATCH_QUOTES.length)];
  showAnimatedQuote(randomQuote, points);
  
  // Remove tiles after animation
  setTimeout(() => {
    tile1.element.classList.add('matched');
    tile2.element.classList.add('matched');
    
    // Check for game completion
    if (gameState.matchedPairs >= gameState.totalPairs) {
      setTimeout(() => {
        handleGameComplete();
      }, 500);
    }
  }, 300);
  
  updateUI();
}

function handleGameComplete() {
  gameState.isPlaying = false;
  stopTimer();
  
  const timeElapsed = (Date.now() - gameState.startTime) / 1000;
  const finalTimeBonus = Math.floor(Math.max(0, 300 - timeElapsed) * 5); // Bonus for completing quickly
  gameState.score += finalTimeBonus;
  
  gameBoard.classList.add('game-over');
  
  playSound('complete');
  showToast(`🎉 Congratulations! Final Score: ${gameState.score} (+${finalTimeBonus} time bonus)`, 'success');
  
  startBtn.disabled = false;
  restartBtn.disabled = false;
  
  updateUI();
}

function getDistance(x1, y1, x2, y2) {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return Math.sqrt(dx * dx + dy * dy);
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function clearBoard() {
  gameBoard.innerHTML = '';
  gameBoard.classList.remove('game-over');
  gameState.tiles = [];
}

function startTimer() {
  gameState.timerInterval = setInterval(() => {
    if (!gameState.isPlaying || gameState.isPaused) return;
    
    const elapsed = Math.floor((Date.now() - gameState.startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    
    timerEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, 1000);
}

function stopTimer() {
  if (gameState.timerInterval) {
    clearInterval(gameState.timerInterval);
    gameState.timerInterval = null;
  }
}

function updateUI() {
  scoreEl.textContent = gameState.score.toLocaleString();
  matchesEl.textContent = gameState.matchedPairs;
  remainingEl.textContent = gameState.totalPairs - gameState.matchedPairs;
  
  if (!gameState.isPlaying) {
    timerEl.textContent = '0:00';
  }
}

function showToast(message, type = '') {
  toastEl.textContent = message;
  toastEl.className = `toast show ${type}`;
  
  setTimeout(() => {
    toastEl.classList.remove('show');
  }, 3000);
}

function playSound(type) {
  if (!audioContext) return;
  
  try {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    if (type === 'match') {
      // Success sound - ascending notes
      oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
      oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
      oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2); // G5
    } else if (type === 'complete') {
      // Victory sound - major chord
      oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
      oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.2); // E5
      oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.4); // G5
      oscillator.frequency.setValueAtTime(1046.50, audioContext.currentTime + 0.6); // C6
    } else if (type === 'noir') {
      // Film noir detective sound - mysterious low tone with slight vibrato
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(220, audioContext.currentTime); // A3
      oscillator.frequency.setValueAtTime(246.94, audioContext.currentTime + 0.3); // B3
      oscillator.frequency.setValueAtTime(196, audioContext.currentTime + 0.6); // G3
      
      // Add some mystery with a slight tremolo effect
      const tremolo = audioContext.createOscillator();
      const tremoloGain = audioContext.createGain();
      tremolo.frequency.setValueAtTime(4, audioContext.currentTime); // 4Hz tremolo
      tremolo.connect(tremoloGain);
      tremoloGain.connect(gainNode.gain);
      tremoloGain.gain.setValueAtTime(0.02, audioContext.currentTime);
      
      tremolo.start(audioContext.currentTime);
      tremolo.stop(audioContext.currentTime + 1.2);
    }
    
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.8);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.8);
  } catch (e) {
    console.log('Sound playback failed:', e);
  }
}

// Create animated quote popup
function showAnimatedQuote(quote, points) {
  // Create popup element
  const popup = document.createElement('div');
  popup.className = 'quote-popup';
  popup.innerHTML = `
    <div class="quote-text" data-text="${quote}"></div>
    <div class="quote-points">+${points} points</div>
  `;
  
  // Position popup in center of game board
  const boardRect = gameBoard.getBoundingClientRect();
  popup.style.left = '50%';
  popup.style.top = '50%';
  popup.style.transform = 'translate(-50%, -50%)';
  
  gameBoard.appendChild(popup);
  
  // Trigger typewriter effect
  const textEl = popup.querySelector('.quote-text');
  typewriterEffect(textEl, quote);
  
  // Play noir-style sound effect
  playSound('noir');
  
  // Remove popup after animation
  setTimeout(() => {
    popup.classList.add('fade-out');
    setTimeout(() => {
      if (popup.parentNode) {
        popup.parentNode.removeChild(popup);
      }
    }, 500);
  }, 2500);
}

// Typewriter effect for quote text
function typewriterEffect(element, text) {
  element.textContent = '';
  let i = 0;
  
  const typeInterval = setInterval(() => {
    if (i < text.length) {
      element.textContent += text.charAt(i);
      i++;
    } else {
      clearInterval(typeInterval);
      // Add glow effect when typing is complete
      element.classList.add('glow-complete');
    }
  }, 50); // 50ms per character for smooth typing
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === 'r' || e.key === 'R') {
    if (gameState.isPlaying) {
      restartGame();
    } else {
      startGame();
    }
  }
  
  if (e.key === 'p' || e.key === 'P') {
    if (gameState.isPlaying) {
      gameState.isPaused = !gameState.isPaused;
      showToast(gameState.isPaused ? 'Game paused' : 'Game resumed');
    }
  }
});

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', init);

// Handle window resize to keep tiles within bounds
window.addEventListener('resize', () => {
  if (!gameState.isPlaying) return;
  
  const boardRect = gameBoard.getBoundingClientRect();
  const tileSize = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--tile-size'));
  
  gameState.tiles.forEach(tile => {
    if (!tile.element || tile.matched) return;
    
    const currentX = tile.element.offsetLeft;
    const currentY = tile.element.offsetTop;
    
    const maxX = boardRect.width - tileSize;
    const maxY = boardRect.height - tileSize;
    
    const newX = Math.max(0, Math.min(currentX, maxX));
    const newY = Math.max(0, Math.min(currentY, maxY));
    
    tile.element.style.left = `${newX}px`;
    tile.element.style.top = `${newY}px`;
  });
});
