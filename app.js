// ===== State Management =====
let currentDate = new Date();
let isLocked = false;
let markedDates = JSON.parse(localStorage.getItem('markedDates')) || {};
const UNLOCK_PASSWORD = '19920717';

// ===== DOM Elements =====
const calendarDays = document.getElementById('calendarDays');
const currentMonthEl = document.getElementById('currentMonth');
const prevMonthBtn = document.getElementById('prevMonth');
const nextMonthBtn = document.getElementById('nextMonth');
const downloadBtn = document.getElementById('downloadBtn');
const lockBtn = document.getElementById('lockBtn');
const lockIcon = document.getElementById('lockIcon');
const lockText = document.getElementById('lockText');
const passwordModal = document.getElementById('passwordModal');
const passwordInput = document.getElementById('passwordInput');
const passwordError = document.getElementById('passwordError');
const submitPasswordBtn = document.getElementById('submitPassword');
const cancelPasswordBtn = document.getElementById('cancelPassword');

// ===== Calendar Functions =====
function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // Update month title
    const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    currentMonthEl.textContent = `${year}年 ${monthNames[month]}`;

    // Get first day of month and total days
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay();
    const totalDays = lastDay.getDate();

    // Get previous month's last days
    const prevLastDay = new Date(year, month, 0).getDate();

    // Clear and rebuild
    calendarDays.innerHTML = '';

    // Today's date for comparison
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // Previous month days
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
        const dayNum = prevLastDay - i;
        const prevMonth = month === 0 ? 12 : month;
        const prevYear = month === 0 ? year - 1 : year;
        const dateStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        const dayEl = createDayElement(dayNum, dateStr, true, (startDayOfWeek - 1 - i) % 7);
        calendarDays.appendChild(dayEl);
    }

    // Current month days
    for (let day = 1; day <= totalDays; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayOfWeek = (startDayOfWeek + day - 1) % 7;
        const isToday = dateStr === todayStr;
        const dayEl = createDayElement(day, dateStr, false, dayOfWeek, isToday);
        calendarDays.appendChild(dayEl);
    }

    // Next month days
    const totalCells = startDayOfWeek + totalDays;
    const remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let day = 1; day <= remainingCells; day++) {
        const nextMonth = month === 11 ? 1 : month + 2;
        const nextYear = month === 11 ? year + 1 : year;
        const dateStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayOfWeek = (totalCells + day - 1) % 7;
        const dayEl = createDayElement(day, dateStr, true, dayOfWeek);
        calendarDays.appendChild(dayEl);
    }
}

function createDayElement(dayNum, dateStr, isOtherMonth, dayOfWeek, isToday = false) {
    const dayEl = document.createElement('div');
    dayEl.className = 'day';
    dayEl.dataset.date = dateStr;

    if (isOtherMonth) dayEl.classList.add('other-month');
    if (isToday) dayEl.classList.add('today');
    if (dayOfWeek === 0) dayEl.classList.add('sunday');
    if (dayOfWeek === 6) dayEl.classList.add('saturday');

    // Day number
    const dayNumber = document.createElement('div');
    dayNumber.className = 'day-number';
    dayNumber.textContent = dayNum;
    dayEl.appendChild(dayNumber);

    // Mark container
    const markContainer = document.createElement('div');
    markContainer.className = 'mark-container';

    // Check if this date is marked
    if (markedDates[dateStr]) {
        const markImg = document.createElement('img');
        markImg.src = 'sokusai.jpg';
        markImg.alt = '予定';
        markImg.className = 'date-mark';
        markContainer.appendChild(markImg);
        dayEl.classList.add('has-mark');
    }

    dayEl.appendChild(markContainer);

    // Click to toggle mark (if not locked)
    dayEl.addEventListener('click', () => {
        if (!isLocked) {
            toggleMark(dateStr, dayEl);
        }
    });

    return dayEl;
}

// ===== Mark Functions =====
function toggleMark(dateStr, dayEl) {
    const markContainer = dayEl.querySelector('.mark-container');

    if (markedDates[dateStr]) {
        // Remove mark
        delete markedDates[dateStr];
        markContainer.innerHTML = '';
        dayEl.classList.remove('has-mark');
    } else {
        // Add mark
        markedDates[dateStr] = true;
        const markImg = document.createElement('img');
        markImg.src = 'sokusai.jpg';
        markImg.alt = '予定';
        markImg.className = 'date-mark';
        markContainer.appendChild(markImg);
        dayEl.classList.add('has-mark');

        // Add pop animation
        markImg.style.animation = 'popIn 0.3s ease';
    }

    // Save to localStorage
    saveMarkedDates();
}

function saveMarkedDates() {
    localStorage.setItem('markedDates', JSON.stringify(markedDates));
}

// ===== Lock Functions =====
function toggleLock() {
    if (isLocked) {
        // Show password modal
        showPasswordModal();
    } else {
        // Lock without password
        isLocked = true;
        updateLockButton();
    }
}

function showPasswordModal() {
    passwordInput.value = '';
    passwordError.textContent = '';
    passwordModal.classList.add('active');
    // Focus input after modal animation
    setTimeout(() => {
        passwordInput.focus();
    }, 100);
}

function hidePasswordModal() {
    passwordModal.classList.remove('active');
    passwordInput.value = '';
    passwordError.textContent = '';
}

function checkPassword() {
    const enteredPassword = passwordInput.value;

    if (enteredPassword === UNLOCK_PASSWORD) {
        isLocked = false;
        updateLockButton();
        hidePasswordModal();
    } else {
        passwordError.textContent = 'パスワードが正しくありません';
        passwordInput.value = '';
        passwordInput.focus();
    }
}

function updateLockButton() {
    if (isLocked) {
        lockIcon.textContent = '🔒';
        lockText.textContent = 'ロック中';
        lockBtn.classList.add('locked');
    } else {
        lockIcon.textContent = '🔓';
        lockText.textContent = 'ロック';
        lockBtn.classList.remove('locked');
    }
}

// ===== Download Function =====
async function downloadCalendarImage() {
    const calendarWrapper = document.querySelector('.calendar-wrapper');

    downloadBtn.classList.add('downloading');
    downloadBtn.textContent = 'ダウンロード中...';

    try {
        const canvas = await html2canvas(calendarWrapper, {
            backgroundColor: '#ffffff',
            scale: 2,
            useCORS: true,
            allowTaint: true,
            logging: false
        });

        // Direct download
        const link = document.createElement('a');
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        link.download = `calendar_${year}_${String(month).padStart(2, '0')}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();

        downloadBtn.classList.remove('downloading');
        downloadBtn.innerHTML = '<span class="icon">📷</span>画像をダウンロード';
    } catch (error) {
        console.error('Download failed:', error);
        alert('画像のダウンロードに失敗しました。');
        downloadBtn.classList.remove('downloading');
        downloadBtn.innerHTML = '<span class="icon">📷</span>画像をダウンロード';
    }
}

// ===== Event Listeners =====
prevMonthBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
});

nextMonthBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
});

downloadBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    downloadCalendarImage();
});
lockBtn.addEventListener('click', toggleLock);

// Password modal events
submitPasswordBtn.addEventListener('click', checkPassword);
cancelPasswordBtn.addEventListener('click', hidePasswordModal);

passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        checkPassword();
    } else if (e.key === 'Escape') {
        hidePasswordModal();
    }
});

passwordModal.addEventListener('click', (e) => {
    if (e.target === passwordModal) {
        hidePasswordModal();
    }
});

// ===== Initialize =====
renderCalendar();
