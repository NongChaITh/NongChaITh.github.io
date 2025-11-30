// การตั้งค่าความยาก: ใช้สำหรับกำหนดขนาดบอร์ดและจำนวนระเบิด
const DIFFICULTY_SETTINGS = {
    beginner: { size: 9, mines: 10, name: "Beginner" },
    intermediate: { size: 16, mines: 40, name: "Intermediate" },
    expert: { size: 30, mines: 99, name: "Expert" }
};

// ตัวแปรที่ใช้กำหนดขนาด/จำนวนระเบิดปัจจุบัน (เริ่มต้นที่ Beginner)
let currentSettings = DIFFICULTY_SETTINGS.beginner; 

// ตัวแปรสถานะเกม
let board = [];
let isGameOver = false;
let cellsRevealed = 0; 
let isFirstClick = true; 
let flagsPlaced = 0; 

// ตัวแปรสำหรับจัดการเวลา
let timerInterval; 
let secondsElapsed = 0; 

// ตัวแปรสำหรับจัดการ Touch Events บนมือถือ
let touchStartTimer; 
const LONG_PRESS_THRESHOLD = 500; // 500 มิลลิวินาที (ครึ่งวินาที)
let isLongPress = false; // 🚩 เพิ่ม: สถานะเพื่อระบุว่า Long Press ได้ถูกกระตุ้นแล้ว

// DOM Elements
const gridContainer = document.getElementById('grid-container');
const resetButton = document.getElementById('reset-button');
const gameStatus = document.getElementById('game-status');
const minesCountDisplay = document.getElementById('mines-count-display'); 
const timerDisplay = document.getElementById('timer-display');
const difficultySelect = document.getElementById('difficulty-select'); 

// เริ่มต้นเกมเมื่อโหลดหน้า
window.onload = initializeGame;

// ผูกเหตุการณ์
resetButton.addEventListener('click', initializeGame);
difficultySelect.addEventListener('change', initializeGame);

// ------------------------------------------------------------------
// ฟังก์ชันจัดการ Touch Events (สำหรับมือถือ)
// ------------------------------------------------------------------

/**
 * จัดการเมื่อเริ่มสัมผัส (touchstart)
 * เริ่มตัวจับเวลาสำหรับการกดค้าง
 */
function handleTouchStart(event) {
    // 🚩 ลบ event.preventDefault() ออกเพื่อให้ click event ทำงานตามปกติบน PC
    
    isLongPress = false; 

    // ล้างตัวจับเวลาเก่า (ถ้ามี)
    clearTimeout(touchStartTimer);

    // เริ่มตัวจับเวลาใหม่
    touchStartTimer = setTimeout(() => {
        isLongPress = true; // 🚩 ตั้งค่าสถานะ Long Press
        handleLongPress(event);
    }, LONG_PRESS_THRESHOLD);
}

/**
 * จัดการเมื่อสิ้นสุดการสัมผัส (touchend)
 * หากเป็นการแตะสั้น (ไม่ใช่ Long Press) ให้จำลองการคลิกซ้าย
 */
function handleTouchEnd(event) {
    // หยุดตัวจับเวลา Long Press
    clearTimeout(touchStartTimer);
    
    // 🚩 โค้ดที่สำคัญ: ถ้าไม่ได้เกิด Long Press (เป็นการแตะสั้น)
    if (!isLongPress) {
        // ป้องกัน click event ที่ไม่ต้องการจากเบราว์เซอร์
        event.preventDefault(); 
        
        // 🚩 จำลองการเรียกใช้ handleCellClick
        const cellElement = event.target;
        if (cellElement && cellElement.classList.contains('cell')) {
            const simulatedEvent = { 
                target: cellElement,
                preventDefault: () => {}
            };
            handleCellClick(simulatedEvent);
        }
    }
    
    isLongPress = false; // รีเซ็ตสถานะ
}

/**
 * จัดการเมื่อเกิดการกดค้าง (Long Press)
 * จำลองการคลิกขวา (ปักธง)
 */
function handleLongPress(event) {
    // 🚩 สำคัญ: เรียก event.preventDefault() ที่นี่เท่านั้น เพื่อป้องกันการคลิกซ้ายตามมา
    event.preventDefault(); 

    // หากมีการแตะหลายจุด ให้ใช้จุดแรก
    const touch = event.changedTouches[0];
    
    // ค้นหา Element ที่อยู่ภายใต้จุดที่สัมผัส
    const cellElement = document.elementFromPoint(touch.clientX, touch.clientY);

    if (cellElement && cellElement.classList.contains('cell')) {
        // สร้าง Object เพื่อจำลองเหตุการณ์สำหรับฟังก์ชัน handleCellRightClick
        const simulatedEvent = { 
            target: cellElement,
            preventDefault: () => { event.preventDefault(); } 
        };

        // เรียกฟังก์ชันปักธง
        handleCellRightClick(simulatedEvent);
    }
}


// ------------------------------------------------------------------
// ฟังก์ชันจัดการเวลา
// ------------------------------------------------------------------

/**
 * เริ่มต้นตัวจับเวลา (นับทุก 1 วินาที)
 */
function startTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
    }

    timerInterval = setInterval(() => {
        secondsElapsed++;
        if (secondsElapsed > 999) {
             secondsElapsed = 999;
             stopTimer();
        }
        timerDisplay.textContent = `Timer: ${secondsElapsed.toString().padStart(3, '0')}`;
    }, 1000); 
}

/**
 * หยุดตัวจับเวลา
 */
function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
}

// ------------------------------------------------------------------
// ฟังก์ชันหลักและตรรกะเกม
// ------------------------------------------------------------------

/**
 * อัปเดตการแสดงผลจำนวนระเบิดที่เหลืออยู่ (Mines - Flags)
 */
function updateMinesDisplay() {
    const minesLeft = currentSettings.mines - flagsPlaced;
    minesCountDisplay.textContent = `Mines: ${minesLeft.toString().padStart(3, '0')}`;
}


/**
 * ฟังก์ชันหลักในการเริ่มต้นเกมและตั้งค่าใหม่
 */
function initializeGame() {
    gridContainer.style.pointerEvents = 'auto'; 
    
    isGameOver = false;
    cellsRevealed = 0;
    isFirstClick = true; 
    flagsPlaced = 0; 
    
    const selectedDifficulty = difficultySelect.value;
    currentSettings = DIFFICULTY_SETTINGS[selectedDifficulty];

    stopTimer();
    secondsElapsed = 0;
    timerDisplay.textContent = "Timer: 000"; 
    
    board = createEmptyBoard(currentSettings.size); 
    
    renderGrid();
    
    gameStatus.textContent = "Status: Playing";
    updateMinesDisplay(); 
}

/**
 * สร้างอาร์เรย์ (ตาราง) เปล่า
 */
function createEmptyBoard(size) {
    const newBoard = [];
    for (let r = 0; r < size; r++) {
        newBoard[r] = [];
        for (let c = 0; c < size; c++) {
            newBoard[r][c] = {
                isMine: false,
                isRevealed: false,
                isFlagged: false,
                neighborMines: 0 
            };
        }
    }
    return newBoard;
}

/**
 * วางระเบิดแบบสุ่มและคำนวณตัวเลข โดยยกเว้นบริเวณที่คลิกครั้งแรก
 */
function placeMinesAndCalculate(board, size, mines, safeR, safeC) {
    
    let minesPlaced = 0;
    while (minesPlaced < mines) {
        const randomRow = Math.floor(Math.random() * size);
        const randomCol = Math.floor(Math.random() * size);

        if (!board[randomRow][randomCol].isMine) {
            
            // บริเวณปลอดภัย: ช่องที่คลิกและช่องรอบๆ 8 ช่อง
            const isSafeZone = (
                randomRow >= safeR - 1 && randomRow <= safeR + 1 &&
                randomCol >= safeC - 1 && randomCol <= safeC + 1
            );

            if (!isSafeZone) {
                board[randomRow][randomCol].isMine = true;
                minesPlaced++;
            }
        }
    }

    // คำนวณตัวเลขบอกจำนวนระเบิดรอบๆ
    calculateNeighborMines(board, size);
}

/**
 * คำนวณจำนวนระเบิดในช่องรอบๆ แต่ละช่อง
 */
function calculateNeighborMines(board, size) {
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            if (!board[r][c].isMine) {
                let count = 0;
                for (let i = -1; i <= 1; i++) {
                    for (let j = -1; j <= 1; j++) {
                        const newR = r + i;
                        const newC = c + j;

                        if (newR >= 0 && newR < size && newC >= 0 && newC < size) {
                            if (board[newR][newC].isMine) {
                                count++;
                            }
                        }
                    }
                }
                board[r][c].neighborMines = count;
            }
        }
    }
}

/**
 * สร้างองค์ประกอบ HTML ของตารางเกมและผูกเหตุการณ์
 */
function renderGrid() {
    gridContainer.innerHTML = ''; 
    gridContainer.style.gridTemplateColumns = `repeat(${currentSettings.size}, 1fr)`;

    for (let r = 0; r < currentSettings.size; r++) {
        for (let c = 0; c < currentSettings.size; c++) {
            const cellElement = document.createElement('div');
            cellElement.classList.add('cell');
            cellElement.dataset.row = r;
            cellElement.dataset.col = c;
            
            // ผูกเหตุการณ์ PC: คลิกซ้าย/ขวา (click event จะทำงานบนมือถือเฉพาะเมื่อ touchend ไม่ถูก preventDefault)
            cellElement.addEventListener('click', handleCellClick);
            cellElement.addEventListener('contextmenu', handleCellRightClick); 
            
            // ผูกเหตุการณ์มือถือ
            cellElement.addEventListener('touchstart', handleTouchStart);
            cellElement.addEventListener('touchend', handleTouchEnd);
            
            gridContainer.appendChild(cellElement);
        }
    }
}

/**
 * จัดการเมื่อมีการคลิกซ้าย (เปิดช่อง)
 */
function handleCellClick(event) {
    if (isGameOver) return;
    // event.target อาจเป็น cellElement ที่จำลองมาจาก handleTouchEnd หรือจาก PC click event
    const r = parseInt(event.target.dataset.row);
    const c = parseInt(event.target.dataset.col);
    const cell = board[r][c];

    if (cell.isRevealed || cell.isFlagged) return; 

    // **ตรรกะการคลิกครั้งแรก (Safe First Click)**
    if (isFirstClick) {
        placeMinesAndCalculate(board, currentSettings.size, currentSettings.mines, r, c);
        startTimer();
        isFirstClick = false; 
    }

    // 1. ช่องเป็นระเบิด
    if (cell.isMine) {
        cell.isRevealed = true;
        gameOver(false); 
        revealAllMines(); 
        return;
    }

    // 2. ช่องเป็นเลขหรือช่องว่าง
    revealCell(r, c);

    // 3. ตรวจสอบชัยชนะ
    checkWin();
}

/**
 * จัดการเมื่อมีการคลิกขวา (ปัก/ถอน ธง)
 */
function handleCellRightClick(event) {
    event.preventDefault(); 
    if (isGameOver) return;

    const r = parseInt(event.target.dataset.row);
    const c = parseInt(event.target.dataset.col);
    const cell = board[r][c];
    const cellElement = event.target;

    if (cell.isRevealed) return; 

    cell.isFlagged = !cell.isFlagged;
    
    if (cell.isFlagged) {
        flagsPlaced++;
        cellElement.textContent = '🚩';
    } else {
        flagsPlaced--;
        cellElement.textContent = '';
    }
    
    cellElement.classList.toggle('flagged', cell.isFlagged);
    
    updateMinesDisplay(); 
}

/**
 * ฟังก์ชันเปิดช่องหลัก (ใช้ Recusrion สำหรับช่องว่าง)
 */
function revealCell(r, c) {
    if (r < 0 || r >= currentSettings.size || c < 0 || c >= currentSettings.size) return; 
    
    const cell = board[r][c];
    if (cell.isRevealed || cell.isMine) return;
    
    // ถ้าช่องถูกปักธงไว้ (isFlagged) ให้ถอนธงออกก่อนเปิด
    if (cell.isFlagged) {
        cell.isFlagged = false; 
        flagsPlaced--; 
        const cellElement = document.querySelector(`[data-row="${r}"][data-col="${c}"]`);
        cellElement.classList.remove('flagged');
        cellElement.textContent = '';
        updateMinesDisplay(); 
    }

    cell.isRevealed = true;
    cellsRevealed++;
    
    const cellElement = document.querySelector(`[data-row="${r}"][data-col="${c}"]`);
    cellElement.classList.add('opened');
    
    // แสดงตัวเลขหรือว่างเปล่า
    if (cell.neighborMines > 0) {
        cellElement.textContent = cell.neighborMines;
        cellElement.classList.add(`n${cell.neighborMines}`); 
    }
    
    // ถ้าเป็นช่องว่าง (neighborMines === 0) ให้เปิดช่องรอบๆ
    if (cell.neighborMines === 0) {
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                revealCell(r + i, c + j); 
            }
        }
    }
}

/**
 * จัดการสถานะเกมเมื่อจบลง (ชนะหรือแพ้)
 */
function gameOver(hasWon) {
    isGameOver = true;
    stopTimer(); 
    gridContainer.style.pointerEvents = 'none'; 
    
    if (hasWon) {
        gameStatus.textContent = "Status: Win! 🎉";
    } else {
        gameStatus.textContent = "Status: Lose! 💥";
    }
}

/**
 * ตรวจสอบเงื่อนไขชัยชนะ: เปิดช่องที่ไม่ใช่ระเบิดครบทั้งหมด
 */
function checkWin() {
    const requiredRevealed = (currentSettings.size * currentSettings.size) - currentSettings.mines;

    if (cellsRevealed === requiredRevealed) {
        gameOver(true);
    }
}

/**
 * เปิดเผยตำแหน่งระเบิดทั้งหมดเมื่อเกมจบ
 */
function revealAllMines() {
    for (let r = 0; r < currentSettings.size; r++) {
        for (let c = 0; c < currentSettings.size; c++) {
            const cell = board[r][c];
            if (cell.isMine) {
                const cellElement = document.querySelector(`[data-row="${r}"][data-col="${c}"]`);
                cellElement.classList.remove('flagged'); 
                cellElement.classList.add('opened', 'mine');
                cellElement.textContent = '💣';
            }
        }
    }
}
