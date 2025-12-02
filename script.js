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
let flagsPlaced = 0; // ตัวแปรนับจำนวนธงที่ปักแล้ว

// ตัวแปรสำหรับจัดการเวลา
let timerInterval; 
let secondsElapsed = 0; 

// DOM Elements
const gridContainer = document.getElementById('grid-container');
const resetButton = document.getElementById('reset-button');
const gameStatus = document.getElementById('game-status');
const minesCountDisplay = document.getElementById('mines-count-display'); 
const timerDisplay = document.getElementById('timer-display');
const difficultySelect = document.getElementById('difficulty-select'); 

// 🚩 DOM Elements สำหรับ Action Menu
const actionMenu = document.getElementById('action-menu');
const menuFlagButton = document.getElementById('menu-flag');
const menuDigButton = document.getElementById('menu-dig');
let currentMenuCell = null; // เก็บข้อมูลช่องที่เมนูถูกแสดงอยู่

// เริ่มต้นเกมเมื่อโหลดหน้า
window.onload = initializeGame;

// ผูกเหตุการณ์
resetButton.addEventListener('click', initializeGame);
difficultySelect.addEventListener('change', initializeGame);

// 🚩 ผูกเหตุการณ์สำหรับปุ่มในเมนู
menuFlagButton.addEventListener('click', handleMenuAction);
menuDigButton.addEventListener('click', handleMenuAction);
// ผูกเหตุการณ์นอกเมนู: ซ่อนเมนูเมื่อคลิกที่อื่น
document.addEventListener('click', hideActionMenu);


// ------------------------------------------------------------------
// 🚩 ฟังก์ชันจัดการ Action Menu และ Mobile Click
// ------------------------------------------------------------------

/**
 * ตรวจสอบว่าเป็นอุปกรณ์มือถือหรือไม่
 */
function isMobileDevice() {
    return /Mobi|Android|iPhone|iPad|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * แสดงเมนู Action Menu ที่พิกัดของช่อง
 */
function showActionMenu(r, c, event) {
    const cellElement = event.target;
    currentMenuCell = { r, c, cellElement };

    // 1. กำหนดตำแหน่งของเมนู (ใช้ Bounding Box ของ Cell)
    const rect = cellElement.getBoundingClientRect();
    
    // ตั้งค่าตำแหน่งให้อยู่กลาง Cell หรือด้านล่าง/ขวาเล็กน้อย
    // และปรับให้อยู่ภายใน Viewport (ใช้ window.scrollY/X)
    const menuWidth = 200; // กะความกว้างของเมนู
    const menuHeight = 50; // กะความสูงของเมนู

    let leftPos = rect.left + rect.width / 2 - (menuWidth / 2);
    let topPos = rect.top + rect.height + window.scrollY;

    // ปรับให้เมนูไม่เกินขอบขวา
    if (leftPos + menuWidth > window.innerWidth) {
        leftPos = window.innerWidth - menuWidth - 10;
    }
    // ปรับให้เมนูไม่เกินขอบซ้าย
    if (leftPos < 0) {
        leftPos = 10;
    }

    actionMenu.style.left = `${leftPos}px`;
    actionMenu.style.top = `${topPos}px`; 

    // 2. แสดงเมนู
    actionMenu.style.display = 'flex';
}

/**
 * ซ่อนเมนู Action Menu
 */
function hideActionMenu(event) {
    // ซ่อนเมื่อคลิกที่อื่นที่ไม่ใช่ปุ่มในเมนู
    if (event && actionMenu.contains(event.target)) {
        return; // ไม่ต้องซ่อนถ้าคลิกภายในเมนู
    }
    actionMenu.style.display = 'none';
    currentMenuCell = null;
}

/**
 * จัดการเมื่อมีการคลิกที่ปุ่มใน Action Menu
 */
function handleMenuAction(event) {
    if (!currentMenuCell) return;

    // ต้องซ่อนเมนูก่อนเสมอ
    hideActionMenu(); 

    const action = event.target.dataset.action;
    const { r, c, cellElement } = currentMenuCell;

    // สร้าง event จำลองเพื่อส่งไปยังฟังก์ชันเดิม
    const simulatedEvent = {
        target: cellElement,
        preventDefault: () => {} // Dummy preventDefault
    };

    if (action === 'dig') {
        // จำลองการคลิกซ้าย
        handleCellClick(simulatedEvent);
    } else if (action === 'flag') {
        // จำลองการคลิกขวา
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
        // ปรับการแสดงผลให้สอดคล้องกับรูปแบบ Timer: 000
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
    // จำนวนระเบิดที่เหลือ = จำนวนระเบิดทั้งหมด - จำนวนธงที่ปักแล้ว
    const minesLeft = currentSettings.mines - flagsPlaced;
    // ปรับการแสดงผลให้สอดคล้องกับรูปแบบ Mines: 010
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
    flagsPlaced = 0; // รีเซ็ตจำนวนธงที่ปัก
    
    // 1. ดึงการตั้งค่าความยากจาก Dropdown
    const selectedDifficulty = difficultySelect.value;
    currentSettings = DIFFICULTY_SETTINGS[selectedDifficulty];

    // หยุดตัวจับเวลาเดิมและรีเซ็ตค่า
    stopTimer();
    secondsElapsed = 0;
    timerDisplay.textContent = "Timer: 000"; 
    
    // 2. สร้างตารางเปล่าๆ (ยังไม่มีระเบิด)
    board = createEmptyBoard(currentSettings.size); 
    
    // 3. สร้าง UI Grid
    renderGrid();
    
    // อัปเดตสถานะการแสดงผล
    gameStatus.textContent = "Status: Playing";
    // เรียกใช้ฟังก์ชันใหม่เพื่ออัปเดตจำนวนระเบิดเริ่มต้น
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
    // ใช้ขนาดบอร์ดปัจจุบันในการกำหนด Grid Template
    gridContainer.style.gridTemplateColumns = `repeat(${currentSettings.size}, 1fr)`;

    for (let r = 0; r < currentSettings.size; r++) {
        for (let c = 0; c < currentSettings.size; c++) {
            const cellElement = document.createElement('div');
            cellElement.classList.add('cell');
            cellElement.dataset.row = r;
            cellElement.dataset.col = c;
            
            // ผูกเหตุการณ์: คลิกซ้าย/ขวา
            cellElement.addEventListener('click', handleCellClick);
            cellElement.addEventListener('contextmenu', handleCellRightClick); 
            
            gridContainer.appendChild(cellElement);
        }
    }
}

/**
 * จัดการเมื่อมีการคลิกซ้าย (เปิดช่อง)
 */
function handleCellClick(event) {
    if (isGameOver) return;
    
    const r = parseInt(event.target.dataset.row);
    const c = parseInt(event.target.dataset.col);
    const cell = board[r][c];

    // ถ้าช่องถูกเปิดแล้ว ให้ไม่ทำอะไร
    if (cell.isRevealed) return; 

    // 1. ตรวจสอบถ้าเป็นมือถือ ให้แสดงเมนู (Action Menu) แทนการเปิดช่องทันที
    if (isMobileDevice() && !cell.isRevealed) {
        // ป้องกันไม่ให้เกิดการเปิดช่องทันทีเมื่อแตะ
        event.preventDefault(); 
        hideActionMenu(); // ซ่อนเมนูเก่าก่อน
        showActionMenu(r, c, event);
        return;
    }
    
    // 2. ถ้าเป็น PC หรือเป็นการคลิก "Dig" จากเมนู (โค้ดจะทำงานต่อจากตรงนี้)
    // ตรวจสอบว่าช่องถูกปักธงไว้หรือไม่
    if (cell.isFlagged) return; 

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
 * **จำกัดจำนวนธงไม่ให้เกินจำนวนระเบิดทั้งหมด**
 */
function handleCellRightClick(event) {
    event.preventDefault(); // ป้องกัน Context Menu ของเบราว์เซอร์
    if (isGameOver) return;

    const r = parseInt(event.target.dataset.row);
    const c = parseInt(event.target.dataset.col);
    const cell = board[r][c];
    const cellElement = event.target;

    if (cell.isRevealed) return; // ไม่สามารถปักธงบนช่องที่เปิดแล้ว

    // ตรรกะการปักธง
    if (!cell.isFlagged) {
        // ตรวจสอบ: ถ้าจำนวนธงที่ปักยังไม่เกินจำนวนระเบิดทั้งหมด
        if (flagsPlaced < currentSettings.mines) { 
            cell.isFlagged = true;
            flagsPlaced++;
            cellElement.textContent = '🚩';
            cellElement.classList.add('flagged');
        } else {
            // ไม่ปักธง: จำนวนธงเต็มแล้ว
            return; 
        }
    } 
    // ตรรกะการถอนธง
    else { 
        cell.isFlagged = false;
        flagsPlaced--;
        cellElement.textContent = '';
        cellElement.classList.remove('flagged');
    }
    
    // อัปเดตการแสดงผลจำนวนระเบิดที่เหลือ
    updateMinesDisplay(); 
}

/**
 * ฟังก์ชันเปิดช่องหลัก (ใช้ Recusrion สำหรับช่องว่าง)
 */
function revealCell(r, c) {
    // ใช้ขนาดบอร์ดปัจจุบันในการตรวจสอบขอบเขต
    if (r < 0 || r >= currentSettings.size || c < 0 || c >= currentSettings.size) return; 
    
    const cell = board[r][c];
    if (cell.isRevealed || cell.isMine) return;
    
    // ถ้าช่องถูกปักธงไว้ (isFlagged) ให้ถอนธงออกก่อนเปิด
    if (cell.isFlagged) {
        cell.isFlagged = false; // ถอนธง
        flagsPlaced--; // ลดจำนวนธง
        const cellElement = document.querySelector(`[data-row="${r}"][data-col="${c}"]`);
        cellElement.classList.remove('flagged');
        cellElement.textContent = '';
        updateMinesDisplay(); // อัปเดตการแสดงผล
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
    // ปิดการคลิกเมื่อเกมจบ
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
    // ใช้ขนาดบอร์ดและจำนวนระเบิดปัจจุบัน
    const requiredRevealed = (currentSettings.size * currentSettings.size) - currentSettings.mines;

    if (cellsRevealed === requiredRevealed) {
        gameOver(true);
    }
}

/**
 * เปิดเผยตำแหน่งระเบิดทั้งหมดเมื่อเกมจบ
 */
function revealAllMines() {
    // ใช้ขนาดบอร์ดปัจจุบัน
    for (let r = 0; r < currentSettings.size; r++) {
        for (let c = 0; c < currentSettings.size; c++) {
            const cell = board[r][c];
            if (cell.isMine) {
                const cellElement = document.querySelector(`[data-row="${r}"][data-col="${c}"]`);
                cellElement.classList.remove('flagged'); // เอาธงออกถ้ามี
                cellElement.classList.add('opened', 'mine');
                cellElement.textContent = '💣';
            }
        }
    }
}
