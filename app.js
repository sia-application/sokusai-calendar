// ===== State Management =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, deleteDoc, getDoc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAEfG5xJyZ7ISgJZn1rIjBjxMlWTQzQru0",
    authDomain: "sokusai-calendar.firebaseapp.com",
    projectId: "sokusai-calendar",
    storageBucket: "sokusai-calendar.firebasestorage.app",
    messagingSenderId: "298806417570",
    appId: "1:298806417570:web:bfab76d710109532af9ffb",
    measurementId: "G-JTMXCWMDPC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

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
const countdownEl = document.getElementById('countdown');
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const bulletinForm = document.getElementById('bulletinForm');
const bulletinPosts = document.getElementById('bulletinPosts');

// ===== Countdown Function =====
function updateCountdown() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if today is a marked date
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    if (markedDates[todayStr]) {
        countdownEl.textContent = '当日！';
        return;
    }

    // Get all marked dates and sort them (parse as local time)
    const dates = Object.keys(markedDates)
        .map(dateStr => {
            const [year, month, day] = dateStr.split('-').map(Number);
            return new Date(year, month - 1, day);
        })
        .sort((a, b) => a - b);

    // Find next date after today (not including today)
    const nextDate = dates.find(date => date > today);

    if (nextDate) {
        const diffTime = nextDate - today;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
            countdownEl.textContent = '明日！';
        } else {
            countdownEl.textContent = `残り ${diffDays} 日`;
        }
    } else {
        countdownEl.textContent = '予定なし';
    }
}

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
        markImg.src = './sokusai.jpg';
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

// ===== Bulletin Board Functions =====

function subscribeToPosts() {
    const q = query(collection(db, "bulletin_boards"), orderBy("date", "desc"));

    onSnapshot(q, (snapshot) => {
        const posts = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        renderPosts(posts);
    }, (error) => {
        console.error("Error getting posts:", error);
        bulletinPosts.innerHTML = '<div class="empty-state">読み込みエラーが発生しました。</div>';
    });
}

function renderPosts(posts) {
    bulletinPosts.innerHTML = '';

    if (posts.length === 0) {
        bulletinPosts.innerHTML = '<div class="empty-state">まだ投稿はありません。</div>';
        return;
    }

    // Render the latest post (first one)
    const latestPost = posts[0];
    bulletinPosts.appendChild(createPostElement(latestPost));

    // If there are more posts, show "View Past Posts" button
    if (posts.length > 1) {
        const viewPastBtn = document.createElement('button');
        viewPastBtn.className = 'view-past-btn';
        viewPastBtn.textContent = '過去の投稿を見る';

        viewPastBtn.addEventListener('click', () => {
            // Render remaining posts
            for (let i = 1; i < posts.length; i++) {
                bulletinPosts.appendChild(createPostElement(posts[i]));
            }
            // Remove the button
            viewPastBtn.remove();
        });

        bulletinPosts.appendChild(viewPastBtn);
    }
}

function createPostElement(post) {
    const date = new Date(post.date);
    const dateStr = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;

    const postCard = document.createElement('div');
    postCard.className = 'post-card';
    postCard.innerHTML = `
        <div class="post-header">
            <span class="post-author">${escapeHtml(post.name)}</span>
            <div class="post-meta">
                <span class="post-date">${dateStr}</span>
                <button class="delete-post-btn" data-id="${post.id}" aria-label="削除">🗑️</button>
            </div>
        </div>
        <div class="post-message">${escapeHtml(post.message)}</div>
    `;

    // Add delete event listener
    const deleteBtn = postCard.querySelector('.delete-post-btn');
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent bubbling if necessary
        postToDeleteId = post.id;
        deleteModal.classList.add('active');
        deletePasswordInput.focus();
    });

    return postCard;
}

async function deletePost(postId) {
    const password = deletePasswordInput.value;
    try {
        const docRef = doc(db, "bulletin_boards", postId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            throw new Error('投稿が見つかりません');
        }

        const postData = docSnap.data();
        if (postData.password && postData.password !== password) {
            throw new Error('Incorrect password');
        }

        await deleteDoc(docRef);
        // renderPosts will be called automatically by onSnapshot
        return true;
    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
}

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
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

// ===== Tab Event Listeners =====
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // Remove active class from all
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));

        // Add active class to clicked
        btn.classList.add('active');
        const tabId = btn.getAttribute('data-tab');
        document.getElementById(tabId).classList.add('active');
    });
});

// ===== Bulletin Board Event Listeners =====
const openPostModalBtn = document.getElementById('openPostModalBtn');
const postModal = document.getElementById('postModal');
const closePostModalBtn = document.getElementById('closePostModalBtn');
const cancelPostBtn = document.getElementById('cancelPostBtn');

// Delete Modal Elements
const deleteModal = document.getElementById('deleteModal');
const closeDeleteModalBtn = document.getElementById('closeDeleteModalBtn');
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
const deletePasswordInput = document.getElementById('deletePasswordInput');
const deleteError = document.getElementById('deleteError');
let postToDeleteId = null;

if (openPostModalBtn) {
    openPostModalBtn.addEventListener('click', () => {
        postModal.classList.add('active');
    });
}

function closePostModal() {
    postModal.classList.remove('active');
}

function closeDeleteModal() {
    deleteModal.classList.remove('active');
    deletePasswordInput.value = '';
    deleteError.textContent = '';
    postToDeleteId = null;
}

if (closePostModalBtn) closePostModalBtn.addEventListener('click', closePostModal);
if (cancelPostBtn) cancelPostBtn.addEventListener('click', closePostModal);

if (closeDeleteModalBtn) closeDeleteModalBtn.addEventListener('click', closeDeleteModal);
if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', closeDeleteModal);

if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', async () => {
        if (!postToDeleteId) return;

        const password = deletePasswordInput.value;
        // if (!password) {
        //     deleteError.textContent = 'パスワードを入力してください';
        //     return;
        // }

        try {
            await deletePost(postToDeleteId);
            closeDeleteModal();
        } catch (error) {
            deleteError.textContent = error.message === 'Incorrect password' ? 'パスワードが間違っています' : '削除エラー';
        }
    });
}

// Close modal when clicking outside
if (postModal) {
    postModal.addEventListener('click', (e) => {
        if (e.target === postModal) {
            closePostModal();
        }
    });
}

if (deleteModal) {
    deleteModal.addEventListener('click', (e) => {
        if (e.target === deleteModal) {
            closeDeleteModal();
        }
    });
}

if (bulletinForm) {
    bulletinForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const nameInput = document.getElementById('postName');
        const messageInput = document.getElementById('postMessage');
        const passwordInput = document.getElementById('postPassword');

        const name = nameInput.value.trim();
        const message = messageInput.value.trim();
        const password = passwordInput.value.trim();

        if (name && message) {
            try {
                // Add to Firestore
                await addDoc(collection(db, "bulletin_boards"), {
                    name: name,
                    message: message,
                    password: password,
                    date: new Date().toISOString() // Or serverTimestamp()
                });

                bulletinForm.reset();
                closePostModal();
                // renderPosts will be called automatically
            } catch (error) {
                console.error('Error:', error);
                alert('エラーが発生しました: ' + error.message);
            }
        }
    });
}

// ===== Initialize =====
renderCalendar();
updateCountdown();
subscribeToPosts();
