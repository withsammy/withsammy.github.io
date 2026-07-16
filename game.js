(() => {
  const canvas = document.getElementById('snake-canvas');
  const startPauseButton = document.getElementById('game-start-pause');
  const restartButton = document.getElementById('game-restart');
  const statusText = document.getElementById('game-status');
  const scoreText = document.getElementById('game-score');
  const bestText = document.getElementById('game-best');
  const leaderboardList = document.getElementById('leaderboard-list');
  const touchButtons = Array.from(document.querySelectorAll('.control-btn'));

  if (!canvas || !startPauseButton || !restartButton || !statusText || !scoreText || !bestText || !leaderboardList) {
    return;
  }

  const ctx = canvas.getContext('2d');
  const boardSize = 20;
  const tickMs = 110;
  const leaderboardStorageKey = 'saemi-snake-leaderboard';
  const legacyBestScoreKey = 'saemi-snake-best-score';

  let snake = [];
  let direction = { x: 1, y: 0 };
  let pendingDirection = { x: 1, y: 0 };
  let food = { x: 0, y: 0 };
  let score = 0;
  let bestScore = 0;
  let state = 'idle';
  let timer = null;
  let lastSwipePoint = null;
  let leaderboard = [];
  let editingIndex = null;

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }

  function readNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function randomNickname() {
    const left = ['Blue', 'Mint', 'Nova', 'Pixel', 'Sunny', 'Velvet', 'Lucky', 'Echo', 'Ruby', 'Moon'];
    const right = ['Fox', 'Leaf', 'Spark', 'Wave', 'Star', 'Cloud', 'Stone', 'Bird', 'Comet', 'Rose'];
    const leftPick = left[Math.floor(Math.random() * left.length)];
    const rightPick = right[Math.floor(Math.random() * right.length)];
    const suffix = String(Math.floor(Math.random() * 900) + 100);
    return `${leftPick}${rightPick}-${suffix}`;
  }

  function normalizeLeaderboard(entries) {
    return entries
      .filter((entry) => entry && typeof entry.name === 'string')
      .map((entry) => ({
        name: entry.name.trim() || randomNickname(),
        score: readNumber(entry.score),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }

  function loadLeaderboard() {
    try {
      const raw = window.localStorage.getItem(leaderboardStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      const normalized = Array.isArray(parsed) ? normalizeLeaderboard(parsed) : [];
      if (normalized.length > 0) {
        return normalized;
      }
      const legacyBest = readNumber(window.localStorage.getItem(legacyBestScoreKey));
      return legacyBest > 0 ? [{ name: randomNickname(), score: legacyBest }] : [];
    } catch {
      return [];
    }
  }

  function saveLeaderboard() {
    try {
      window.localStorage.setItem(leaderboardStorageKey, JSON.stringify(leaderboard));
      window.localStorage.setItem(legacyBestScoreKey, String(leaderboard[0]?.score || 0));
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

  function renderLeaderboard() {
    const items = leaderboard.slice(0, 3);
    bestScore = items[0]?.score || 0;
    setBestScore(bestScore);
    leaderboardList.innerHTML = [0, 1, 2]
      .map((index) => {
        const entry = items[index];
        if (!entry) {
          return `
            <li class="leaderboard-item">
              <div class="leaderboard-row">
                <span class="leaderboard-rank">${index + 1}</span>
                <span class="leaderboard-empty">비어 있음</span>
              </div>
            </li>
          `;
        }

        const isEditing = editingIndex === index;
        return `
          <li class="leaderboard-item${isEditing ? ' is-editing' : ''}" data-index="${index}">
            <div class="leaderboard-view">
              <div class="leaderboard-row">
                <span class="leaderboard-rank">${index + 1}</span>
                <button type="button" class="leaderboard-name" data-action="edit-name" data-index="${index}">${escapeHtml(entry.name)}</button>
                <span class="leaderboard-score">${entry.score}점</span>
              </div>
            </div>
            <form class="leaderboard-edit" data-index="${index}">
              <input type="text" aria-label="순위 이름 수정" maxlength="18" value="${escapeAttr(entry.name)}">
              <div class="leaderboard-edit-actions">
                <button type="submit">저장</button>
                <button type="button" data-action="cancel-name" data-index="${index}">취소</button>
              </div>
            </form>
          </li>
        `;
      })
      .join('');
  }

  function seedLeaderboard(scoreValue) {
    const candidate = {
      name: randomNickname(),
      score: scoreValue,
    };
    const boundary = leaderboard[2]?.score ?? -Infinity;
    if (leaderboard.length >= 3 && scoreValue < boundary) {
      return false;
    }
    leaderboard = normalizeLeaderboard([...leaderboard, candidate]);
    saveLeaderboard();
    renderLeaderboard();
    return true;
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
    if (seedLeaderboard(score)) {
      setStatus(`게임 오버: 점수 ${score}점, 상위 3위에 진입했습니다.`);
    } else {
      setStatus(`게임 오버: 점수 ${score}점, 상위 3위에는 들지 못했습니다.`);
    }
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

  function handleLeaderboardClick(event) {
    const editButton = event.target.closest('[data-action="edit-name"]');
    if (editButton) {
      editingIndex = Number(editButton.dataset.index);
      renderLeaderboard();
      const currentRow = leaderboardList.querySelector(`.leaderboard-item[data-index="${editingIndex}"]`);
      const input = currentRow?.querySelector('input');
      input?.focus();
      input?.select();
      return;
    }

    const cancelButton = event.target.closest('[data-action="cancel-name"]');
    if (cancelButton) {
      editingIndex = null;
      renderLeaderboard();
    }
  }

  function handleLeaderboardSubmit(event) {
    const form = event.target.closest('.leaderboard-edit');
    if (!form) {
      return;
    }
    event.preventDefault();
    const row = form.closest('.leaderboard-item');
    const index = Number(row?.dataset.index);
    const input = form.querySelector('input');
    const value = input?.value.trim();
    if (!Number.isInteger(index) || !leaderboard[index]) {
      return;
    }
    leaderboard[index].name = value || leaderboard[index].name || randomNickname();
    leaderboard = normalizeLeaderboard(leaderboard);
    saveLeaderboard();
    editingIndex = null;
    renderLeaderboard();
  }

  leaderboard = loadLeaderboard();
  renderLeaderboard();
  setBestScore(leaderboard[0]?.score || 0);

  startPauseButton.addEventListener('click', handleStartPause);
  restartButton.addEventListener('click', handleRestart);
  leaderboardList.addEventListener('click', handleLeaderboardClick);
  leaderboardList.addEventListener('submit', handleLeaderboardSubmit);
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
