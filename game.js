(function () {
  "use strict";

  const SIZE = 4;
  const WINNING_VALUE = 2048;

  // DOM
  const boardEl = document.getElementById("board");
  const tileContainerEl = document.getElementById("tile-container");
  const gridBgEl = document.getElementById("grid-bg");
  const scoreEl = document.getElementById("score");
  const bestScoreEl = document.getElementById("best-score");
  const overlayEl = document.getElementById("overlay");
  const overlayMsg = document.getElementById("overlay-message");
  const newGameBtn = document.getElementById("new-game");
  const retryBtn = document.getElementById("overlay-retry");

  let grid, score, bestScore, won, over, tileId;

  // ── Helpers ──────────────────────────────────────────────

  function cellPos(row, col) {
    const gap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--cell-gap"));
    const cellSize = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--cell-size"));
    return {
      left: gap + col * (cellSize + gap),
      top: gap + row * (cellSize + gap),
    };
  }

  function emptyCells() {
    const cells = [];
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (!grid[r][c]) cells.push({ r, c });
    return cells;
  }

  function addRandomTile() {
    const empty = emptyCells();
    if (!empty.length) return null;
    const { r, c } = empty[Math.floor(Math.random() * empty.length)];
    const value = Math.random() < 0.9 ? 2 : 4;
    const tile = createTile(r, c, value);
    grid[r][c] = tile;
    return tile;
  }

  // ── Tile DOM ─────────────────────────────────────────────

  function createTile(row, col, value) {
    const id = tileId++;
    const el = document.createElement("div");
    el.className = "tile new-tile " + tileClass(value);
    el.textContent = value;
    const pos = cellPos(row, col);
    el.style.left = pos.left + "px";
    el.style.top = pos.top + "px";
    tileContainerEl.appendChild(el);
    // remove animation class after it plays
    el.addEventListener("animationend", () => el.classList.remove("new-tile"), { once: true });
    return { id, value, row, col, el };
  }

  function tileClass(value) {
    return value <= 2048 ? "tile-" + value : "tile-super";
  }

  function updateTilePosition(tile) {
    const pos = cellPos(tile.row, tile.col);
    tile.el.style.left = pos.left + "px";
    tile.el.style.top = pos.top + "px";
  }

  function updateTileValue(tile, value) {
    tile.value = value;
    tile.el.textContent = value;
    tile.el.className = "tile merged-tile merged " + tileClass(value);
    tile.el.addEventListener("animationend", () => {
      tile.el.classList.remove("merged-tile");
      tile.el.classList.remove("merged");
    }, { once: true });
  }

  function removeTileEl(tile) {
    if (tile.el && tile.el.parentNode) {
      tile.el.parentNode.removeChild(tile.el);
    }
  }

  // ── Score ────────────────────────────────────────────────

  function setScore(val) {
    score = val;
    scoreEl.textContent = score;
    if (score > bestScore) {
      bestScore = score;
      bestScoreEl.textContent = bestScore;
      try { localStorage.setItem("2048-best", bestScore); } catch (_) {}
    }
  }

  function loadBest() {
    try { bestScore = parseInt(localStorage.getItem("2048-best")) || 0; } catch (_) { bestScore = 0; }
    bestScoreEl.textContent = bestScore;
  }

  // ── Core logic ───────────────────────────────────────────

  function buildGridBg() {
    gridBgEl.innerHTML = "";
    for (let i = 0; i < SIZE * SIZE; i++) {
      const cell = document.createElement("div");
      cell.className = "grid-cell";
      gridBgEl.appendChild(cell);
    }
  }

  function init() {
    tileContainerEl.innerHTML = "";
    overlayEl.classList.add("hidden");
    grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    score = 0;
    won = false;
    over = false;
    tileId = 0;
    setScore(0);
    addRandomTile();
    addRandomTile();
  }

  // Traverse order helpers
  function traverseOrder(dir) {
    const rows = [...Array(SIZE).keys()];
    const cols = [...Array(SIZE).keys()];
    if (dir === "down") rows.reverse();
    if (dir === "right") cols.reverse();
    return { rows, cols };
  }

  function vector(dir) {
    switch (dir) {
      case "up":    return { dr: -1, dc: 0 };
      case "down":  return { dr: 1, dc: 0 };
      case "left":  return { dr: 0, dc: -1 };
      case "right": return { dr: 0, dc: 1 };
    }
  }

  function inBounds(r, c) {
    return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
  }

  function findFarthest(row, col, vec) {
    let prevR = row, prevC = col;
    let r = row + vec.dr, c = col + vec.dc;
    while (inBounds(r, c) && !grid[r][c]) {
      prevR = r; prevC = c;
      r += vec.dr; c += vec.dc;
    }
    return {
      farthest: { r: prevR, c: prevC },
      next: inBounds(r, c) ? { r, c } : null,
    };
  }

  function move(dir) {
    if (over) return;

    const vec = vector(dir);
    const { rows, cols } = traverseOrder(dir);
    let moved = false;
    const mergedSet = new Set(); // track cells already merged this turn
    const toRemove = [];

    for (const r of rows) {
      for (const c of cols) {
        const tile = grid[r][c];
        if (!tile) continue;

        const { farthest, next } = findFarthest(r, c, vec);

        if (next && grid[next.r][next.c] && grid[next.r][next.c].value === tile.value && !mergedSet.has(next.r * SIZE + next.c)) {
          // Merge
          const target = grid[next.r][next.c];
          const newVal = tile.value * 2;
          updateTileValue(target, newVal);

          // move the disappearing tile to the merge position, then remove
          grid[r][c] = null;
          tile.row = next.r;
          tile.col = next.c;
          updateTilePosition(tile);
          toRemove.push(tile);

          mergedSet.add(next.r * SIZE + next.c);
          setScore(score + newVal);
          moved = true;

          if (newVal === WINNING_VALUE && !won) {
            won = true;
            setTimeout(() => showOverlay("You win!"), 300);
          }
        } else if (farthest.r !== r || farthest.c !== c) {
          // Just move
          grid[r][c] = null;
          grid[farthest.r][farthest.c] = tile;
          tile.row = farthest.r;
          tile.col = farthest.c;
          updateTilePosition(tile);
          moved = true;
        }
      }
    }

    if (moved) {
      // Remove old tiles after transition
      setTimeout(() => {
        toRemove.forEach(removeTileEl);
      }, 140);

      setTimeout(() => {
        addRandomTile();
        if (!movesAvailable()) {
          over = true;
          setTimeout(() => showOverlay("Game Over!"), 300);
        }
      }, 140);
    }
  }

  function movesAvailable() {
    if (emptyCells().length > 0) return true;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const val = grid[r][c] && grid[r][c].value;
        if (c + 1 < SIZE && grid[r][c + 1] && grid[r][c + 1].value === val) return true;
        if (r + 1 < SIZE && grid[r + 1][c] && grid[r + 1][c].value === val) return true;
      }
    }
    return false;
  }

  function showOverlay(msg) {
    overlayMsg.textContent = msg;
    overlayEl.classList.remove("hidden");
  }

  // ── Input ────────────────────────────────────────────────

  const keyMap = {
    ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
    w: "up", s: "down", a: "left", d: "right",
  };

  document.addEventListener("keydown", (e) => {
    const dir = keyMap[e.key];
    if (dir) { e.preventDefault(); move(dir); }
  });

  // Touch / swipe
  let touchStartX, touchStartY;

  boardEl.addEventListener("touchstart", (e) => {
    if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
  }, { passive: true });

  boardEl.addEventListener("touchend", (e) => {
    if (touchStartX == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    const absDx = Math.abs(dx), absDy = Math.abs(dy);
    const threshold = 30;
    if (Math.max(absDx, absDy) < threshold) return;

    if (absDx > absDy) {
      move(dx > 0 ? "right" : "left");
    } else {
      move(dy > 0 ? "down" : "up");
    }
    touchStartX = touchStartY = null;
  }, { passive: true });

  // Buttons
  newGameBtn.addEventListener("click", init);
  retryBtn.addEventListener("click", init);

  // ── Start ────────────────────────────────────────────────

  buildGridBg();
  loadBest();
  init();
})();
