// ===== State Management =====
let currentDate = new Date();

// ===== マークする日付をここで設定 =====
// 形式: 'YYYY-MM-DD': true
// 例: '2026-01-15': true は2026年1月15日にマークを表示
const markedDates = {
    '2026-01-08': true,
    '2026-01-22': true,
    '2026-02-05': true,
    '2026-02-19': true,
    '2026-03-05': true,
    '2026-03-19': true,
    '2026-04-02': true,
    '2026-04-16': true,
    '2026-05-07': true,
    '2026-05-21': true,
    '2026-06-04': true,
    '2026-06-18': true,
    '2026-07-02': true,
    '2026-07-16': true,
    '2026-08-06': true,
    '2026-08-20': true,
    '2026-09-03': true,
    '2026-09-17': true,
    '2026-10-01': true,
    '2026-10-15': true,
    '2026-10-29': true,
    '2026-11-12': true,
    '2026-11-26': true,
    '2026-12-10': true
};

// ===== DOM Elements =====
const calendarDays = document.getElementById('calendarDays');
const currentMonthEl = document.getElementById('currentMonth');
const prevMonthBtn = document.getElementById('prevMonth');
const nextMonthBtn = document.getElementById('nextMonth');
const downloadBtn = document.getElementById('downloadBtn');

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

    return dayEl;
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

// ===== Initialize =====
renderCalendar();
