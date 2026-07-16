(() => {
  const canvas = document.getElementById('snake-canvas');
  const startPauseButton = document.getElementById('game-start-pause');
  const restartButton = document.getElementById('game-restart');
  const statusText = document.getElementById('game-status');
  const scoreText = document.getElementById('game-score');
  const bestText = document.getElementById('game-best');
  const touchButtons = Array.from(document.querySelectorAll('.control-btn'));

  if (!canvas || !startPauseButton || !restartButton || !statusText || !scoreText || !bestText) {
    return;
  }

  const ctx = canvas.getContext('2d');
  const gridSize = 20;
  const boardSize = 20;
  const tickMs = 110;
  const storageKey = 'saemi-snake-best-score';

  let snake = [];
  let direction = { x: 1, y: 0 };
  let pendingDirection = { x: 1, y: 0 };
  let food = { x: 0, y: 0 };
  let score = 0;
  let bestScore = 0;
  let state = 'idle';
  let timer = null;
  let lastSwipePoint = null;

  function readBestScore() {
    try {
      const value = Number(window.localStorage.getItem(storageKey) || 0);
      return Number.isFinite(value) ? value : 0;
    } catch {
      return 0;
    }
  }

  function writeBestScore(value) {
    try {
      window.localStorage.setItem(storageKey, String(value));
    } catch {
      // Ignore storage failures in private modes.
    }
  }

  function setStatus(message) {
    statusText.textContent = message;
  }

  function setScore(value) {
    scoreText.textContent = String(value);
  }

  function setBestScore(value) {
    bestText.textContent = String(value);
  }

  function updateButtons() {
    if (state === 'running') {
      startPauseButton.textContent = '일시정지';
      startPauseButton.dataset.action = 'pause';
    } else if (state === 'paused') {
      startPauseButton.textContent = '재개';
      startPauseButton.dataset.action = 'resume';
    } else if (state === 'gameover') {
      startPauseButton.textContent = '다시 시작';
      startPauseButton.dataset.action = 'restart';
    } else {
      startPauseButton.textContent = '시작';
      startPauseButton.dataset.action = 'start';
    }
  }

  function resizeCanvas() {
    const size = Math.min(canvas.parentElement?.clientWidth || 400, 520);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(size * dpr);
    canvas.height = Math.floor(size * dpr);
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function randomCell(exclude = []) {
    let cell;
    do {
      cell = {
        x: Math.floor(Math.random() * boardSize),
        y: Math.floor(Math.random() * boardSize),
      };
    } while (exclude.some((part) => part.x === cell.x && part.y === cell.y));
    return cell;
  }

  function renderGrid(cellSize, boardPx) {
    ctx.strokeStyle = 'rgba(255,255,255,0.045)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= boardSize; i += 1) {
      const pos = i * cellSize;
      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(boardPx, pos);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, boardPx);
      ctx.stroke();
    }
  }

  function renderOverlay(boardPx, message) {
    ctx.fillStyle = 'rgba(8, 12, 18, 0.62)';
    ctx.fillRect(0, 0, boardPx, boardPx);
    ctx.fillStyle = '#e8edf5';
    ctx.font = '600 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(message, boardPx / 2, boardPx / 2);
  }

  function render() {
    const boardPx = canvas.clientWidth || 400;
    const cellSize = boardPx / boardSize;

    ctx.clearRect(0, 0, boardPx, boardPx);
    renderGrid(cellSize, boardPx);

    ctx.fillStyle = '#ffcc66';
    ctx.beginPath();
    ctx.arc(
      food.x * cellSize + cellSize / 2,
      food.y * cellSize + cellSize / 2,
      cellSize * 0.3,
      0,
      Math.PI * 2
    );
    ctx.fill();

    snake.forEach((part, index) => {
      ctx.fillStyle = index === 0 ? '#8fb7ff' : '#5fe3c2';
      const pad = cellSize * 0.12;
      const size = cellSize - pad * 2;
      ctx.fillRect(part.x * cellSize + pad, part.y * cellSize + pad, size, size);
    });

    if (state === 'idle') {
      renderOverlay(boardPx, '시작 버튼을 눌러 게임을 시작하세요');
    } else if (state === 'paused') {
      renderOverlay(boardPx, '일시정지 상태입니다');
    } else if (state === 'gameover') {
      renderOverlay(boardPx, '게임 오버: 다시 시작하세요');
    }
  }

  function resetGame() {
    snake = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ];
    direction = { x: 1, y: 0 };
    pendingDirection = { x: 1, y: 0 };
    food = randomCell(snake);
    score = 0;
    state = 'idle';
    clearTimer();
    setScore(score);
    setStatus('시작 전: 방향키, WASD, 터치 버튼, 스와이프를 사용하세요.');
    updateButtons();
    render();
  }

  function clearTimer() {
    if (timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
  }

  function startLoop() {
    clearTimer();
    timer = window.setInterval(step, tickMs);
  }

  function startGame() {
    if (state === 'running') {
      return;
    }
    state = 'running';
    setStatus('진행 중: 먹이를 먹으며 지렁이를 길게 키우세요.');
    updateButtons();
    render();
    startLoop();
  }

  function pauseGame() {
    if (state !== 'running') {
      return;
    }
    state = 'paused';
    setStatus('일시정지 상태입니다. 다시 재개할 수 있습니다.');
    updateButtons();
    clearTimer();
    render();
  }

  function resumeGame() {
    if (state !== 'paused') {
      return;
    }
    state = 'running';
    setStatus('진행 중: 먹이를 먹으며 지렁이를 길게 키우세요.');
    updateButtons();
    render();
    startLoop();
  }

  function finishGame() {
    state = 'gameover';
    clearTimer();
    if (score > bestScore) {
      bestScore = score;
      setBestScore(bestScore);
      writeBestScore(bestScore);
    }
    setStatus(`게임 오버: 점수 ${score}점, 최고 점수 ${bestScore}점`);
    updateButtons();
    render();
  }

  function restartGame() {
    resetGame();
    startGame();
  }

  function isOpposite(candidate, current) {
    return candidate.x === -current.x && candidate.y === -current.y;
  }

  function queueDirection(dx, dy) {
    const candidate = { x: dx, y: dy };
    const activeDirection = pendingDirection || direction;
    if (snake.length > 1 && isOpposite(candidate, activeDirection)) {
      return;
    }
    pendingDirection = candidate;
    if (state === 'idle') {
      startGame();
    } else if (state === 'paused') {
      resumeGame();
    }
  }

  function step() {
    direction = pendingDirection;

    const head = snake[0];
    const newHead = {
      x: head.x + direction.x,
      y: head.y + direction.y,
    };

    const hitWall = newHead.x < 0 || newHead.x >= boardSize || newHead.y < 0 || newHead.y >= boardSize;
    const willEatFood = newHead.x === food.x && newHead.y === food.y;
    const bodyToCheck = willEatFood ? snake : snake.slice(0, -1);
    const hitSelf = bodyToCheck.some((part) => part.x === newHead.x && part.y === newHead.y);

    if (hitWall || hitSelf) {
      finishGame();
      return;
    }

    snake.unshift(newHead);

    if (willEatFood) {
      score += 10;
      setScore(score);
      food = randomCell(snake);
      setStatus(`먹이를 먹었습니다. 현재 점수 ${score}점입니다.`);
    } else {
      snake.pop();
    }

    render();
  }

  function handleKeydown(event) {
    const key = event.key.toLowerCase();
    if (['arrowup', 'w'].includes(key)) {
      event.preventDefault();
      queueDirection(0, -1);
    } else if (['arrowdown', 's'].includes(key)) {
      event.preventDefault();
      queueDirection(0, 1);
    } else if (['arrowleft', 'a'].includes(key)) {
      event.preventDefault();
      queueDirection(-1, 0);
    } else if (['arrowright', 'd'].includes(key)) {
      event.preventDefault();
      queueDirection(1, 0);
    } else if (key === ' ') {
      event.preventDefault();
      if (state === 'running') {
        pauseGame();
      } else if (state === 'paused') {
        resumeGame();
      } else if (state === 'gameover') {
        restartGame();
      } else {
        startGame();
      }
    } else if (key === 'p') {
      event.preventDefault();
      if (state === 'running') {
        pauseGame();
      } else if (state === 'paused') {
        resumeGame();
      }
    } else if (key === 'r') {
      event.preventDefault();
      restartGame();
    }
  }

  function handleTouchButton(directionName) {
    const mapping = {
      up: [0, -1],
      down: [0, 1],
      left: [-1, 0],
      right: [1, 0],
    };
    const mapped = mapping[directionName];
    if (mapped) {
      queueDirection(mapped[0], mapped[1]);
    }
  }

  function handleSwipeStart(point) {
    lastSwipePoint = point;
  }

  function handleSwipeMove(point) {
    if (!lastSwipePoint) {
      return;
    }
    const dx = point.x - lastSwipePoint.x;
    const dy = point.y - lastSwipePoint.y;
    if (Math.hypot(dx, dy) < 18) {
      return;
    }
    lastSwipePoint = point;
    if (Math.abs(dx) > Math.abs(dy)) {
      queueDirection(dx > 0 ? 1 : -1, 0);
    } else {
      queueDirection(0, dy > 0 ? 1 : -1);
    }
  }

  function handleSwipeEnd() {
    lastSwipePoint = null;
  }

  function handleStartPause() {
    if (state === 'idle') {
      startGame();
    } else if (state === 'running') {
      pauseGame();
    } else if (state === 'paused') {
      resumeGame();
    } else if (state === 'gameover') {
      restartGame();
    }
  }

  function handleRestart() {
    restartGame();
  }

  bestScore = readBestScore();
  setBestScore(bestScore);

  startPauseButton.addEventListener('click', handleStartPause);
  restartButton.addEventListener('click', handleRestart);
  window.addEventListener('resize', () => {
    resizeCanvas();
    render();
  });
  window.addEventListener('keydown', handleKeydown);
  touchButtons.forEach((button) => {
    button.addEventListener('click', () => handleTouchButton(button.dataset.direction));
  });
  canvas.addEventListener('pointerdown', (event) => {
    canvas.setPointerCapture(event.pointerId);
    handleSwipeStart({ x: event.clientX, y: event.clientY });
  });
  canvas.addEventListener('pointermove', (event) => {
    if (event.buttons === 0 && event.pointerType !== 'touch') {
      return;
    }
    handleSwipeMove({ x: event.clientX, y: event.clientY });
  });
  canvas.addEventListener('pointerup', handleSwipeEnd);
  canvas.addEventListener('pointercancel', handleSwipeEnd);
  canvas.addEventListener('pointerleave', handleSwipeEnd);

  resizeCanvas();
  resetGame();
  render();
})();
