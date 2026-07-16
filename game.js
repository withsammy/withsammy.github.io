(() => {
  const canvas = document.getElementById('snake-canvas');
  const startButton = document.getElementById('game-start');
  const statusText = document.getElementById('game-status');
  const scoreText = document.getElementById('game-score');
  const touchButtons = Array.from(document.querySelectorAll('.control-btn'));

  if (!canvas || !startButton || !statusText || !scoreText) {
    return;
  }

  const ctx = canvas.getContext('2d');
  const gridSize = 20;
  const boardSize = 20;
  const tickMs = 120;

  let snake;
  let direction;
  let nextDirection;
  let food;
  let score;
  let running = false;
  let timer = null;
  let lastSwipePoint = null;

  function setStatus(message) {
    statusText.textContent = message;
  }

  function setScore(value) {
    scoreText.textContent = String(value);
  }

  function resizeCanvas() {
    const size = Math.min(canvas.parentElement.clientWidth || 400, 520);
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

  function resetGame() {
    snake = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ];
    direction = { x: 1, y: 0 };
    nextDirection = { x: 1, y: 0 };
    food = randomCell(snake);
    score = 0;
    setScore(score);
    setStatus('시작 전: 방향키 또는 터치 버튼으로 이동하세요.');
    render();
  }

  function startGame() {
    if (running) {
      return;
    }
    running = true;
    startButton.textContent = '다시 시작';
    setStatus('진행 중: 지렁이를 움직여 먹이를 먹으세요.');
    timer = window.setInterval(step, tickMs);
  }

  function gameOver() {
    running = false;
    if (timer) {
      window.clearInterval(timer);
      timer = null;
    }
    setStatus(`게임 종료: 점수 ${score}점. 다시 시작을 눌러주세요.`);
    startButton.textContent = '다시 시작';
  }

  function step() {
    direction = nextDirection;

    const head = snake[0];
    const newHead = {
      x: head.x + direction.x,
      y: head.y + direction.y,
    };

    const hitWall = newHead.x < 0 || newHead.x >= boardSize || newHead.y < 0 || newHead.y >= boardSize;
    const hitSelf = snake.some((part) => part.x === newHead.x && part.y === newHead.y);

    if (hitWall || hitSelf) {
      gameOver();
      render();
      return;
    }

    snake.unshift(newHead);

    if (newHead.x === food.x && newHead.y === food.y) {
      score += 10;
      setScore(score);
      food = randomCell(snake);
      setStatus(`먹이를 먹었습니다. 현재 점수 ${score}점.`);
    } else {
      snake.pop();
    }

    render();
  }

  function renderGrid(cellSize, boardPx) {
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
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

  function render() {
    const boardPx = canvas.clientWidth || 400;
    const cellSize = boardPx / boardSize;

    ctx.clearRect(0, 0, boardPx, boardPx);
    renderGrid(cellSize, boardPx);

    // Food
    ctx.fillStyle = '#ffcc66';
    ctx.beginPath();
    ctx.arc(
      food.x * cellSize + cellSize / 2,
      food.y * cellSize + cellSize / 2,
      cellSize * 0.32,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // Snake
    snake.forEach((part, index) => {
      ctx.fillStyle = index === 0 ? '#8fb7ff' : '#5fe3c2';
      const pad = cellSize * 0.12;
      const size = cellSize - pad * 2;
      ctx.fillRect(part.x * cellSize + pad, part.y * cellSize + pad, size, size);
    });

    if (!running) {
      ctx.fillStyle = 'rgba(8, 12, 18, 0.62)';
      ctx.fillRect(0, 0, boardPx, boardPx);
      ctx.fillStyle = '#e8edf5';
      ctx.font = '600 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('시작 버튼을 눌러 게임을 시작하세요', boardPx / 2, boardPx / 2);
    }
  }

  function updateDirection(dx, dy) {
    if (dx === -direction.x && dy === -direction.y) {
      return;
    }
    nextDirection = { x: dx, y: dy };
    if (!running) {
      startGame();
    }
  }

  function handleKeydown(event) {
    const key = event.key.toLowerCase();
    if (key === 'arrowup' || key === 'w') {
      event.preventDefault();
      updateDirection(0, -1);
    } else if (key === 'arrowdown' || key === 's') {
      event.preventDefault();
      updateDirection(0, 1);
    } else if (key === 'arrowleft' || key === 'a') {
      event.preventDefault();
      updateDirection(-1, 0);
    } else if (key === 'arrowright' || key === 'd') {
      event.preventDefault();
      updateDirection(1, 0);
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
      updateDirection(mapped[0], mapped[1]);
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
      updateDirection(dx > 0 ? 1 : -1, 0);
    } else {
      updateDirection(0, dy > 0 ? 1 : -1);
    }
  }

  function handleSwipeEnd() {
    lastSwipePoint = null;
  }

  startButton.addEventListener('click', () => {
    if (!running) {
      startGame();
    } else {
      resetGame();
      startGame();
    }
  });

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
})();
