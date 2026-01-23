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

// Events state
let events = [];
let selectedDate = null;
let selectedColor = '#8b5cf6';

// ===== Countdown Function =====
function updateCountdown() {
    if (!countdownEl) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // Calculate next occurrence for each event (including repeating ones)
    const upcomingEvents = [];

    events.filter(event => !event.excludeCountdown).forEach(event => {
        const [eventYear, eventMonth, eventDay] = event.date.split('-').map(Number);
        const eventDate = new Date(eventYear, eventMonth - 1, eventDay);

        if (event.repeat === 'none') {
            // One-time event - include if in future
            if (event.date >= todayStr) {
                upcomingEvents.push({
                    date: event.date,
                    title: event.title,
                    dateObj: eventDate
                });
            }
        } else {
            // Repeating event - find next occurrence
            let nextOccurrence = new Date(eventDate);

            while (nextOccurrence < today) {
                switch (event.repeat) {
                    case 'weekly':
                        nextOccurrence.setDate(nextOccurrence.getDate() + 7);
                        break;
                    case 'monthly':
                        nextOccurrence.setMonth(nextOccurrence.getMonth() + 1);
                        break;
                    case 'yearly':
                        nextOccurrence.setFullYear(nextOccurrence.getFullYear() + 1);
                        break;
                }
            }

            const nextDateStr = `${nextOccurrence.getFullYear()}-${String(nextOccurrence.getMonth() + 1).padStart(2, '0')}-${String(nextOccurrence.getDate()).padStart(2, '0')}`;
            upcomingEvents.push({
                date: nextDateStr,
                title: event.title,
                dateObj: nextOccurrence
            });
        }
    });

    // Sort by date
    upcomingEvents.sort((a, b) => a.dateObj - b.dateObj);

    // Check for today's events (excluding those marked as excludeCountdown)
    const allEventsForToday = getEventsForDate(todayStr).filter(event => !event.excludeCountdown);

    if (allEventsForToday.length > 0) {
        // Today has an event
        countdownEl.textContent = `${allEventsForToday[0].title} 当日！`;
        return;
    }

    // Find first future event (not today)
    const futureEvents = upcomingEvents.filter(e => e.date > todayStr);

    if (futureEvents.length > 0) {
        const nextEvent = futureEvents[0];
        const diffTime = nextEvent.dateObj - today;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        countdownEl.textContent = `${nextEvent.title}まで残り ${diffDays} 日`;
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



    // Events container
    const eventsContainer = document.createElement('div');
    eventsContainer.className = 'events-container';

    // Get events for this date
    const dateEvents = getEventsForDate(dateStr);
    const maxEventsToShow = 2;

    dateEvents.slice(0, maxEventsToShow).forEach(event => {
        const eventBadge = document.createElement('div');
        eventBadge.className = 'event-badge';
        eventBadge.style.backgroundColor = event.color || '#8b5cf6';

        let badgeContent = escapeHtml(event.title);
        if (event.repeat && event.repeat !== 'none') {
            const repeatLabels = { weekly: '週', monthly: '月', yearly: '年' };
            badgeContent += `<span class="repeat-badge">${repeatLabels[event.repeat]}</span>`;
        }
        eventBadge.innerHTML = badgeContent;

        // Click to delete event
        eventBadge.addEventListener('click', (e) => {
            e.stopPropagation();
            eventToDeleteId = event.id;
            eventDeleteModal.classList.add('active');
            eventDeletePasswordInput.focus();
        });

        eventsContainer.appendChild(eventBadge);
    });

    // Show "+X more" if there are more events
    if (dateEvents.length > maxEventsToShow) {
        const moreEvents = document.createElement('div');
        moreEvents.className = 'more-events';
        moreEvents.textContent = `+${dateEvents.length - maxEventsToShow}`;
        eventsContainer.appendChild(moreEvents);
    }

    dayEl.appendChild(eventsContainer);

    // Click to add event
    dayEl.addEventListener('click', () => {
        selectedDate = dateStr;
        const [year, month, day] = dateStr.split('-').map(Number);
        eventDateDisplay.textContent = `${year}年${month}月${day}日`;
        eventModal.classList.add('active');
        eventTitleInput.focus();
    });

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

// ===== Event Management Functions =====

function subscribeToEvents() {
    const q = query(collection(db, "events"), orderBy("createdAt", "desc"));

    onSnapshot(q, (snapshot) => {
        events = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        renderCalendar();
        updateCountdown();
    }, (error) => {
        console.error("Error getting events:", error);
    });
}

function getEventsForDate(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    const targetDate = new Date(year, month - 1, day);
    const dayOfWeek = targetDate.getDay();

    return events.filter(event => {
        const [eventYear, eventMonth, eventDay] = event.date.split('-').map(Number);
        const eventDate = new Date(eventYear, eventMonth - 1, eventDay);

        // Exact match
        if (event.date === dateStr) return true;

        // Check repeat rules
        switch (event.repeat) {
            case 'weekly':
                // Same day of week and after or on the original date
                return eventDate.getDay() === dayOfWeek && targetDate >= eventDate;
            case 'monthly':
                // Same day of month and after or on the original date
                return eventDay === day && targetDate >= eventDate;
            case 'yearly':
                // Same month and day and after or on the original date
                return eventMonth === month && eventDay === day && targetDate >= eventDate;
            default:
                return false;
        }
    });
}

async function addEvent(eventData) {
    try {
        await addDoc(collection(db, "events"), {
            ...eventData,
            createdAt: serverTimestamp()
        });
        return true;
    } catch (error) {
        console.error('Error adding event:', error);
        throw error;
    }
}

async function deleteEventById(eventId, password) {
    try {
        const docRef = doc(db, "events", eventId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            throw new Error('予定が見つかりません');
        }

        const eventData = docSnap.data();
        if (eventData.password && eventData.password !== password) {
            throw new Error('Incorrect password');
        }

        await deleteDoc(docRef);
        return true;
    } catch (error) {
        console.error('Error:', error);
        throw error;
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

        // Toggle FAB visibility
        if (tabId === 'tab-bulletin') {
            openPostModalBtn.style.display = 'flex';
        } else {
            openPostModalBtn.style.display = 'none';
        }
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

// ===== Event Modal Elements =====
const eventModal = document.getElementById('eventModal');
const closeEventModalBtn = document.getElementById('closeEventModalBtn');
const cancelEventBtn = document.getElementById('cancelEventBtn');
const eventForm = document.getElementById('eventForm');
const eventDateDisplay = document.getElementById('eventDateDisplay');
const eventTitleInput = document.getElementById('eventTitle');
const eventRepeatSelect = document.getElementById('eventRepeat');
const eventPasswordInput = document.getElementById('eventPassword');
const eventExcludeCountdownCheckbox = document.getElementById('eventExcludeCountdown');
const colorPicker = document.getElementById('colorPicker');
const colorOptions = colorPicker ? colorPicker.querySelectorAll('.color-option') : [];

// Event Delete Modal Elements
const eventDeleteModal = document.getElementById('eventDeleteModal');
const closeEventDeleteModalBtn = document.getElementById('closeEventDeleteModalBtn');
const cancelEventDeleteBtn = document.getElementById('cancelEventDeleteBtn');
const confirmEventDeleteBtn = document.getElementById('confirmEventDeleteBtn');
const eventDeletePasswordInput = document.getElementById('eventDeletePasswordInput');
const eventDeleteError = document.getElementById('eventDeleteError');
let eventToDeleteId = null;

// Color picker functionality
colorOptions.forEach(option => {
    option.addEventListener('click', () => {
        colorOptions.forEach(o => o.classList.remove('selected'));
        option.classList.add('selected');
        selectedColor = option.dataset.color;
    });
});

function closeEventModal() {
    if (eventModal) eventModal.classList.remove('active');
    if (eventForm) eventForm.reset();
    selectedDate = null;
    // Reset color picker to default
    colorOptions.forEach(o => o.classList.remove('selected'));
    const defaultColor = colorPicker ? colorPicker.querySelector('[data-color="#8b5cf6"]') : null;
    if (defaultColor) defaultColor.classList.add('selected');
    selectedColor = '#8b5cf6';
}

function closeEventDeleteModal() {
    if (eventDeleteModal) eventDeleteModal.classList.remove('active');
    if (eventDeletePasswordInput) eventDeletePasswordInput.value = '';
    if (eventDeleteError) eventDeleteError.textContent = '';
    eventToDeleteId = null;
}

if (closeEventModalBtn) closeEventModalBtn.addEventListener('click', closeEventModal);
if (cancelEventBtn) cancelEventBtn.addEventListener('click', closeEventModal);

if (closeEventDeleteModalBtn) closeEventDeleteModalBtn.addEventListener('click', closeEventDeleteModal);
if (cancelEventDeleteBtn) cancelEventDeleteBtn.addEventListener('click', closeEventDeleteModal);

// Close modals when clicking outside
if (eventModal) {
    eventModal.addEventListener('click', (e) => {
        if (e.target === eventModal) {
            closeEventModal();
        }
    });
}

if (eventDeleteModal) {
    eventDeleteModal.addEventListener('click', (e) => {
        if (e.target === eventDeleteModal) {
            closeEventDeleteModal();
        }
    });
}

// Event form submit
if (eventForm) {
    eventForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const title = eventTitleInput.value.trim();
        const repeat = eventRepeatSelect.value;
        const password = eventPasswordInput.value.trim();
        const excludeCountdown = eventExcludeCountdownCheckbox ? eventExcludeCountdownCheckbox.checked : false;

        if (title && selectedDate) {
            try {
                await addEvent({
                    date: selectedDate,
                    title: title,
                    color: selectedColor,
                    repeat: repeat,
                    password: password,
                    excludeCountdown: excludeCountdown
                });
                closeEventModal();
            } catch (error) {
                console.error('Error:', error);
                alert('エラーが発生しました: ' + error.message);
            }
        }
    });
}

// Confirm event delete
if (confirmEventDeleteBtn) {
    confirmEventDeleteBtn.addEventListener('click', async () => {
        if (!eventToDeleteId) return;

        const password = eventDeletePasswordInput.value;

        try {
            await deleteEventById(eventToDeleteId, password);
            closeEventDeleteModal();
        } catch (error) {
            eventDeleteError.textContent = error.message === 'Incorrect password' ? 'パスワードが間違っています' : '削除エラー';
        }
    });
}

// ===== Initialize =====
renderCalendar();
subscribeToPosts();
subscribeToEvents();
