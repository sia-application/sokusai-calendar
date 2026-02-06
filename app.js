// ===== State Management =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, deleteDoc, getDoc, updateDoc, writeBatch, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// Video Categories state & DOM
let videoCategories = [];
const videoCategorySelect = document.getElementById('videoCategory');
// videoFilterSelect is handled below/consolidated
const openCategoryModalBtn = document.getElementById('openCategoryModalBtn');
const categoryModal = document.getElementById('categoryModal');
const closeCategoryModalBtn = document.getElementById('closeCategoryModalBtn');
const cancelCategoryBtn = document.getElementById('cancelCategoryBtn');
const categoryForm = document.getElementById('categoryForm');
const categoryColorPicker = document.getElementById('categoryColorPicker');
let selectedCategoryColor = 'linear-gradient(135deg, #ef4444, #dc2626)'; // Default red

// Video State (Consolidated)
const videoList = document.getElementById('videoList');
const openVideoModalBtn = document.getElementById('openVideoModalBtn');
const videoModal = document.getElementById('videoModal');
const closeVideoModalBtn = document.getElementById('closeVideoModalBtn');
const cancelVideoBtn = document.getElementById('cancelVideoBtn');
const videoForm = document.getElementById('videoForm');
// Video Delete Modal Elements
const videoDeleteModal = document.getElementById('videoDeleteModal');
const closeVideoDeleteModalBtn = document.getElementById('closeVideoDeleteModalBtn');
const cancelVideoDeleteBtn = document.getElementById('cancelVideoDeleteBtn');
const confirmVideoDeleteBtn = document.getElementById('confirmVideoDeleteBtn');
const videoDeletePasswordInput = document.getElementById('videoDeletePasswordInput');
const videoDeleteError = document.getElementById('videoDeleteError');
const videoFilterSelect = document.getElementById('videoFilter');
const channelFilterSelect = document.getElementById('channelFilter');
let videoToDeleteId = null;
let currentVideoFilter = 'all';
let currentChannelFilter = 'all';
let currentVideos = [];
let draggedVideoId = null; // For Reordering

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
        const exceptions = event.exceptions || [];

        if (event.repeat === 'none') {
            // One-time event - include if in future and not in exceptions
            if (event.date >= todayStr && !exceptions.includes(event.date)) {
                upcomingEvents.push({
                    date: event.date,
                    title: event.title,
                    dateObj: eventDate
                });
            }
        } else {
            // Repeating event - find next valid occurrence
            let nextOccurrence = new Date(eventDate);
            let maxIterations = 365; // Prevent infinite loops
            let found = false;

            while (maxIterations > 0) {
                // Move to next occurrence if in the past
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

                // Check if this occurrence is past the endDate
                if (event.endDate && nextDateStr > event.endDate) {
                    break; // No more valid occurrences
                }

                // Check if this occurrence is in exceptions
                if (exceptions.includes(nextDateStr)) {
                    // Skip this date, find next one
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
                    maxIterations--;
                    continue;
                }

                // Valid occurrence found
                upcomingEvents.push({
                    date: nextDateStr,
                    title: event.title,
                    dateObj: new Date(nextOccurrence)
                });
                found = true;
                break;
            }
        }
    });

    // Sort by date
    upcomingEvents.sort((a, b) => a.dateObj - b.dateObj);

    // Check for today's events (excluding those marked as excludeCountdown)
    const allEventsForToday = getEventsForDate(todayStr).filter(event => !event.excludeCountdown);

    if (allEventsForToday.length > 0) {
        // Today has events
        if (allEventsForToday.length > 1) {
            countdownEl.textContent = `今日の予定：次まで当日！`;
        } else {
            countdownEl.textContent = `${allEventsForToday[0].title} 当日！`;
        }
        return;
    }

    // Find closest future events
    const futureEvents = upcomingEvents.filter(e => e.date > todayStr);

    if (futureEvents.length > 0) {
        // Group by the closest date
        const nextDate = futureEvents[0].date;
        const eventsOnNextDate = futureEvents.filter(e => e.date === nextDate);

        const diffTime = eventsOnNextDate[0].dateObj - today;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (eventsOnNextDate.length > 1) {
            countdownEl.textContent = `次の予定まで残り ${diffDays} 日`;
        } else {
            countdownEl.textContent = `${eventsOnNextDate[0].title}まで残り ${diffDays} 日`;
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

        let displayTitle = event.title;
        let badgeContent = escapeHtml(displayTitle);
        // Labels removed as per user request
        eventBadge.innerHTML = badgeContent;

        // Click to view event details
        eventBadge.addEventListener('click', (e) => {
            e.stopPropagation();
            openDetailModal(event, dateStr);
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
        currentDetailList = null; // Ensure we are in add mode, not edit
        selectedDate = dateStr;
        const [year, month, day] = dateStr.split('-').map(Number);
        eventDateDisplay.textContent = `${year}年${month}月${day}日`;
        // Reset title to Register
        if (eventModalTitle) eventModalTitle.textContent = '予定の登録';
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
        downloadBtn.innerHTML = '<span class="icon">📷</span>画像DL';
    } catch (error) {
        console.error('Download failed:', error);
        alert('画像のダウンロードに失敗しました。');
        downloadBtn.classList.remove('downloading');
        downloadBtn.innerHTML = '<span class="icon">📷</span>画像DL';
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
        // Check if this date is in the exceptions list
        if (event.exceptions && event.exceptions.includes(dateStr)) {
            return false;
        }

        // Check if event has ended (for "delete future" option)
        if (event.endDate && dateStr > event.endDate) {
            return false;
        }

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

async function deleteEventWithOption(eventId, password, option, clickedDate) {
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

        switch (option) {
            case 'this':
                // Add clicked date to exceptions list
                const exceptions = eventData.exceptions || [];
                if (!exceptions.includes(clickedDate)) {
                    exceptions.push(clickedDate);
                }
                await updateDoc(docRef, { exceptions: exceptions });
                break;

            case 'future':
                // If clicked date is the original date, delete the whole event
                if (clickedDate === eventData.date) {
                    await deleteDoc(docRef);
                } else {
                    // Set end date to day before clicked date
                    const [year, month, day] = clickedDate.split('-').map(Number);
                    const endDate = new Date(year, month - 1, day - 1);
                    const endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
                    await updateDoc(docRef, { endDate: endDateStr });
                }
                break;

            case 'all':
            default:
                // Delete the entire event
                await deleteDoc(docRef);
                break;
        }

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
            openVideoModalBtn.style.display = 'none';
        } else if (tabId === 'tab-video') {
            openPostModalBtn.style.display = 'none';
            openVideoModalBtn.style.display = 'flex';
        } else {
            openPostModalBtn.style.display = 'none';
            openVideoModalBtn.style.display = 'none';
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

        const nameInput = document.getElementById('postTitle');
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
let eventToDeleteDate = null;
let eventToDeleteRepeat = null;

// Event Detail Modal Elements
const eventDetailModal = document.getElementById('eventDetailModal');
const closeEventDetailModalBtn = document.getElementById('closeEventDetailModalBtn');
const detailDeleteBtn = document.getElementById('detailDeleteBtn');
const detailEditBtn = document.getElementById('detailEditBtn');
const detailDate = document.getElementById('detailDate');
const detailTitle = document.getElementById('detailTitle');
const detailRepeat = document.getElementById('detailRepeat');
const detailRepeatGroup = document.getElementById('detailRepeatGroup');
let currentDetailList = null; // Store current event object
const eventModalTitle = document.getElementById('eventModalTitle');

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
    currentDetailList = null; // Reset edit target
    // Reset color picker to default
    colorOptions.forEach(o => o.classList.remove('selected'));
    const defaultColor = colorPicker ? colorPicker.querySelector('[data-color="#8b5cf6"]') : null;
    if (defaultColor) defaultColor.classList.add('selected');
    selectedColor = '#8b5cf6';
    // Reset button text
    const submitBtn = eventForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.textContent = '登録する';
    // Reset title
    if (eventModalTitle) eventModalTitle.textContent = '予定の登録';
}

function closeEventDetailModal() {
    if (eventDetailModal) eventDetailModal.classList.remove('active');
    // Do NOT clear currentDetailList here, as we need it for Edit transition
    // It will be cleared when closing the Edit modal or opening a new Add modal
}

function closeEventDeleteModal() {
    if (eventDeleteModal) eventDeleteModal.classList.remove('active');
    if (eventDeletePasswordInput) eventDeletePasswordInput.value = '';
    if (eventDeleteError) eventDeleteError.textContent = '';
    eventToDeleteId = null;
    eventToDeleteDate = null;
    eventToDeleteRepeat = null;
    // Hide delete options
    const deleteOptionsSection = document.getElementById('deleteOptionsSection');
    if (deleteOptionsSection) deleteOptionsSection.style.display = 'none';
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

if (eventDetailModal) {
    eventDetailModal.addEventListener('click', (e) => {
        if (e.target === eventDetailModal) closeEventDetailModal();
    });
}

function openDetailModal(event, dateStr) {
    currentDetailList = event; // Store event object

    // Set content
    const [year, month, day] = dateStr.split('-').map(Number);
    detailDate.textContent = `${year}年${month}月${day}日`;
    detailTitle.textContent = event.title;

    // Show/hide repeat info
    if (event.repeat && event.repeat !== 'none') {
        const repeatLabels = { weekly: '毎週', monthly: '毎月', yearly: '毎年' };
        detailRepeat.textContent = repeatLabels[event.repeat];
        detailRepeatGroup.style.display = 'block';
    } else {
        detailRepeatGroup.style.display = 'none';
    }

    eventDetailModal.classList.add('active');
}

if (closeEventDetailModalBtn) closeEventDetailModalBtn.addEventListener('click', closeEventDetailModal);

// Edit button handler
if (detailEditBtn) {
    detailEditBtn.addEventListener('click', () => {
        if (!currentDetailList) return;
        closeEventDetailModal();

        // Populate form with event data
        selectedDate = currentDetailList.date; // Original start date
        // NOTE: If editing a repeating event instance, we are editing the rule.
        // It's simpler to edit the original rule.

        eventTitleInput.value = currentDetailList.title;
        eventRepeatSelect.value = currentDetailList.repeat || 'none';
        eventPasswordInput.value = currentDetailList.password || '';
        if (eventExcludeCountdownCheckbox) {
            eventExcludeCountdownCheckbox.checked = currentDetailList.excludeCountdown || false;
        }

        // Select color
        colorOptions.forEach(o => o.classList.remove('selected'));
        const colorOption = colorPicker ? colorPicker.querySelector(`[data-color="${currentDetailList.color}"]`) : null;
        if (colorOption) {
            colorOption.classList.add('selected');
            selectedColor = currentDetailList.color;
        } else {
            selectedColor = currentDetailList.color || '#8b5cf6';
        }

        // Change submit button text
        const submitBtn = eventForm.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.textContent = '更新する';

        // Change title
        if (eventModalTitle) eventModalTitle.textContent = '予定の更新';

        eventModal.classList.add('active');
    });
}

// Delete button handler - opens deletion modal
if (detailDeleteBtn) {
    detailDeleteBtn.addEventListener('click', () => {
        if (!currentDetailList) return;

        eventToDeleteId = currentDetailList.id;
        eventToDeleteRepeat = currentDetailList.repeat;

        // Extract date from detail text to know which instance we are deleting
        const dateText = detailDate.textContent;
        const match = dateText.match(/(\d+)年(\d+)月(\d+)日/);
        if (match) {
            eventToDeleteDate = `${match[1]}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}`;
        }

        closeEventDetailModal();

        // Show/hide delete options
        const deleteOptionsSection = document.getElementById('deleteOptionsSection');
        if (deleteOptionsSection) {
            if (eventToDeleteRepeat && eventToDeleteRepeat !== 'none') {
                deleteOptionsSection.style.display = 'block';
                const defaultOption = document.querySelector('input[name="deleteOption"][value="this"]');
                if (defaultOption) defaultOption.checked = true;
            } else {
                deleteOptionsSection.style.display = 'none';
            }
        }

        eventDeleteModal.classList.add('active');
        eventDeletePasswordInput.focus();
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
                if (currentDetailList) {
                    // Update existing event
                    await updateEvent(currentDetailList.id, {
                        ...currentDetailList, // keep existing data
                        title: title,
                        color: selectedColor,
                        repeat: repeat,
                        password: password,
                        excludeCountdown: excludeCountdown,
                        date: selectedDate // in case we allow date change in future logic
                    });
                } else {
                    // Add new event
                    await addEvent({
                        date: selectedDate,
                        title: title,
                        color: selectedColor,
                        repeat: repeat,
                        password: password,
                        excludeCountdown: excludeCountdown
                    });
                }
                closeEventModal();
            } catch (error) {
                console.error('Error:', error);
                alert('エラーが発生しました: ' + error.message);
            }
        }
    });
}

async function updateEvent(eventId, updateData) {
    try {
        const docRef = doc(db, "events", eventId);
        // For repeating events, we currently update the main rule which affects all future instances.
        // This is the desired "edit" behavior as per plan.

        await updateDoc(docRef, updateData);
        // Refresh is automatic via onSnapshot
    } catch (error) {
        console.error('Error updating event:', error);
        throw error;
    }
}

// Confirm event delete
if (confirmEventDeleteBtn) {
    confirmEventDeleteBtn.addEventListener('click', async () => {
        if (!eventToDeleteId) return;

        const password = eventDeletePasswordInput.value;

        // Get selected delete option
        let deleteOption = 'all';
        if (eventToDeleteRepeat && eventToDeleteRepeat !== 'none') {
            const selectedOption = document.querySelector('input[name="deleteOption"]:checked');
            deleteOption = selectedOption ? selectedOption.value : 'all';
        }

        try {
            await deleteEventWithOption(eventToDeleteId, password, deleteOption, eventToDeleteDate);
            closeEventDeleteModal();
        } catch (error) {
            eventDeleteError.textContent = error.message === 'Incorrect password' ? 'パスワードが間違っています' : '削除エラー';
        }
    });
}

// ===== Video Tab Functions =====
// Elements are now declared at the top of file
// Filter Select Event Listener
if (videoFilterSelect) {
    videoFilterSelect.addEventListener('change', (e) => {
        currentVideoFilter = e.target.value;
        renderVideos(currentVideos);
    });
}
if (channelFilterSelect) {
    channelFilterSelect.addEventListener('change', (e) => {
        currentChannelFilter = e.target.value;
        renderVideos(currentVideos);
    });
}

// ===== Video Category Logic =====

// Fetch Categories
function subscribeToCategories() {
    const q = query(collection(db, "video_categories"), orderBy("createdAt", "asc"));

    onSnapshot(q, async (snapshot) => {
        const categories = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        if (categories.length === 0) {
            // Seed initial data if empty
            await seedInitialCategories();
        } else {
            videoCategories = categories;
            renderCategoryOptions();
            // Re-render videos to update colors if categories changed
            if (currentVideos.length > 0) {
                renderVideos(currentVideos);
            }
        }
    }, (error) => {
        console.error("Error getting categories:", error);
    });
}

// Seed Initial Categories
async function seedInitialCategories() {
    const initialCategories = [
        { name: 'ライブ', color: 'linear-gradient(135deg, #ef4444, #dc2626)', value: 'live' },
        { name: '練習', color: 'linear-gradient(135deg, #3b82f6, #2563eb)', value: 'practice' },
        { name: 'その他', color: 'linear-gradient(135deg, #6b7280, #4b5563)', value: 'other' }
    ];

    try {
        for (const cat of initialCategories) {
            await addDoc(collection(db, "video_categories"), {
                name: cat.name,
                color: cat.color,
                // store original value for compatibility check, though purely ID based is better long term
                // For now we just use name as label.
                value: cat.value,
                createdAt: serverTimestamp()
            });
        }
        console.log("Initial categories seeded");
    } catch (e) {
        console.error("Error seeding categories:", e);
    }
}

// Render Options
function renderCategoryOptions() {
    if (!videoCategorySelect || !videoFilterSelect) return;

    // Filter Select options
    const currentFilter = videoFilterSelect.value;
    videoFilterSelect.innerHTML = '<option value="all">すべてのカテゴリー</option>';

    // Form Select options
    const currentSelection = videoCategorySelect.value;
    videoCategorySelect.innerHTML = '';

    videoCategories.forEach(cat => {
        // Filter Option
        const filterOption = document.createElement('option');
        filterOption.value = cat.id; // Use ID for value
        filterOption.textContent = cat.name;
        videoFilterSelect.appendChild(filterOption);

        // Form Option
        const formOption = document.createElement('option');
        formOption.value = cat.id;
        formOption.textContent = cat.name;
        videoCategorySelect.appendChild(formOption);
    });

    // Restore selections if valid
    if (currentFilter !== 'all' && videoCategories.some(c => c.id === currentFilter)) {
        videoFilterSelect.value = currentFilter;
        // Update global filter state
        currentVideoFilter = currentFilter;
    } else if (currentFilter === 'all') {
        videoFilterSelect.value = 'all';
        currentVideoFilter = 'all';
    } else {
        // Fallback
        videoFilterSelect.value = 'all';
        currentVideoFilter = 'all';
    }

    if (currentSelection && videoCategories.some(c => c.id === currentSelection)) {
        videoCategorySelect.value = currentSelection;
    }

    // Also render the list in the modal
    renderCategoryList();
}

function renderChannelOptions() {
    if (!channelFilterSelect) return;

    const currentFilter = channelFilterSelect.value;
    const channels = [...new Set(currentVideos.map(v => v.author).filter(Boolean))].sort();

    channelFilterSelect.innerHTML = '<option value="all">すべてのチャンネル</option>';
    channels.forEach(channel => {
        const option = document.createElement('option');
        option.value = channel;
        option.textContent = channel;
        channelFilterSelect.appendChild(option);
    });

    if (currentFilter === 'all' || channels.includes(currentFilter)) {
        channelFilterSelect.value = currentFilter;
        currentChannelFilter = currentFilter;
    } else {
        channelFilterSelect.value = 'all';
        currentChannelFilter = 'all';
    }
}

// Category Modal Logic
function openCategoryModal() {
    categoryModal.classList.add('active');
    renderCategoryList(); // Ensure list is fresh
}

function closeCategoryModal() {
    categoryModal.classList.remove('active');
    document.getElementById('categoryName').value = '';
    // Reset color picker? Keep last selected or default?
}

if (openCategoryModalBtn) openCategoryModalBtn.addEventListener('click', openCategoryModal);
if (closeCategoryModalBtn) closeCategoryModalBtn.addEventListener('click', closeCategoryModal);
if (cancelCategoryBtn) cancelCategoryBtn.addEventListener('click', closeCategoryModal);

if (categoryColorPicker) {
    categoryColorPicker.querySelectorAll('.color-option').forEach(option => {
        option.addEventListener('click', () => {
            categoryColorPicker.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            selectedCategoryColor = option.dataset.color;
        });
    });
}

// Add Category Form Submit
if (categoryForm) {
    categoryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('categoryName').value.trim();
        if (!name) return;

        try {
            await addDoc(collection(db, "video_categories"), {
                name: name,
                color: selectedCategoryColor,
                createdAt: serverTimestamp()
            });
            // Clear input but keep modal open to see list update? 
            // Or close it? User might want to add multiple. 
            // Let's close for now as per previous behavior, but maybe clear input.
            document.getElementById('categoryName').value = '';
            // renderCategoryList handled by onSnapshot
        } catch (error) {
            console.error("Error adding category:", error);
            alert("カテゴリー作成に失敗しました");
        }
    });
}

function renderCategoryList() {
    const listContainer = document.getElementById('categoryList');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    if (videoCategories.length === 0) {
        listContainer.innerHTML = '<div class="empty-state">カテゴリーがありません</div>';
        return;
    }

    videoCategories.forEach(cat => {
        const item = document.createElement('div');
        item.className = 'category-list-item';

        item.innerHTML = `
            <div class="category-item-info">
                <div class="category-color-dot" style="background: ${cat.color}"></div>
                <span class="category-name">${escapeHtml(cat.name)}</span>
            </div>
            <button class="category-delete-btn" data-id="${cat.id}" aria-label="削除">🗑️</button>
        `;

        // Add delete listener
        const deleteBtn = item.querySelector('.category-delete-btn');
        deleteBtn.addEventListener('click', () => {
            // Optional: Confirm delete
            if (confirm(`カテゴリー「${cat.name}」を削除しますか？\nこのカテゴリーの動画は「その他」として扱われます。`)) {
                deleteCategory(cat.id);
            }
        });

        listContainer.appendChild(item);
    });
}

async function deleteCategory(id) {
    try {
        await deleteDoc(doc(db, "video_categories", id));
        // UI updates automatically via onSnapshot
    } catch (error) {
        console.error("Error deleting category:", error);
        alert("削除に失敗しました");
    }
}

function subscribeToVideos() {
    // We sort by 'order' asc. documents without 'order' field won't show up in a simple orderBy('order')
    // So we fetch all and sort in memory for robustness during transition.
    const q = query(collection(db, "videos"), orderBy("createdAt", "desc"));

    onSnapshot(q, (snapshot) => {
        const videos = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // In-memory sort: order ASC, fallback to createdAt DESC
        currentVideos = videos.sort((a, b) => {
            const orderA = a.order !== undefined ? a.order : Infinity;
            const orderB = b.order !== undefined ? b.order : Infinity;

            if (orderA !== orderB) {
                return orderA - orderB;
            }

            // Fallback to createdAt if order is missing or same
            const dateA = a.createdAt ? a.createdAt.toMillis() : 0;
            const dateB = b.createdAt ? b.createdAt.toMillis() : 0;
            return dateB - dateA;
        });

        renderChannelOptions();
        renderVideos(currentVideos);
    }, (error) => {
        console.error("Error getting videos:", error);
        if (videoList) {
            videoList.innerHTML = '<div class="empty-state">読み込みエラーが発生しました。</div>';
        }
    });
}

function renderVideos(videos) {
    if (!videoList) return;

    videoList.innerHTML = '';

    // Filter Logic
    // Old videos have 'live', 'practice' stored in `category`.
    // New videos have Category ID stored in `category`.

    const filteredVideos = videos.filter(v => {
        // Category Filter logic
        let categoryMatch = currentVideoFilter === 'all';
        if (!categoryMatch) {
            if (v.category === currentVideoFilter) {
                categoryMatch = true;
            } else {
                const filterCat = videoCategories.find(c => c.id === currentVideoFilter);
                if (filterCat && v.category === filterCat.value) {
                    categoryMatch = true;
                }
            }
        }

        // Channel Filter logic
        const channelMatch = currentChannelFilter === 'all' || v.author === currentChannelFilter;

        return categoryMatch && channelMatch;
    });

    if (filteredVideos.length === 0) {
        videoList.innerHTML = '<div class=\"empty-state\">まだ動画の登録はありません。</div>';
        return;
    }

    filteredVideos.forEach(video => {
        const videoCard = createVideoElement(video);
        videoList.appendChild(videoCard);
    });
}

function createVideoElement(video) {
    // Determine Display Name and Color
    // 1. Try to find by ID
    let catObj = videoCategories.find(c => c.id === video.category);

    // 2. If not found, try to find by legacy value ('live' etc)
    if (!catObj) {
        catObj = videoCategories.find(c => c.value === video.category);
    }

    // 3. Fallback
    const categoryName = catObj ? catObj.name : (video.category || 'その他');
    const categoryColor = catObj ? catObj.color : 'linear-gradient(135deg, #6b7280, #4b5563)'; // Default Gray

    const accordionItem = document.createElement('div');
    accordionItem.className = 'video-accordion-item';

    // Header Structure
    // <div class="video-accordion-header">
    //   <div class="video-header-left">
    //      <div class="video-accordion-title">Title</div>
    //      <div class="video-author">Author</div>
    //   </div>
    //   <div class="video-header-right">
    //      <span class="video-category dynamic" style="background: ${categoryColor}">${escapeHtml(categoryName)}</span>
    //      <button class="video-delete-btn" data-id="${video.id}" aria-label="削除">🗑️</button>
    //      <span class="accordion-icon">▼</span>
    //   </div>
    // </div>

    const authorHtml = video.authorUrl
        ? `<a href="${escapeHtml(video.authorUrl)}" target="_blank" rel="noopener noreferrer" class="author-link" onclick="event.stopPropagation()">${escapeHtml(video.author)}</a>`
        : `<span class="video-author">${escapeHtml(video.author)}</span>`;

    const header = document.createElement('div');
    header.className = 'video-accordion-header';
    header.innerHTML = `
        <div class="video-header-left">
            <div class="video-accordion-title">
                <a href="${escapeHtml(video.url)}" target="_blank" rel="noopener noreferrer" class="title-link" onclick="event.stopPropagation()">${escapeHtml(video.title)}</a>
            </div>
            ${authorHtml}
        </div>
        <div class="video-header-right">
            <span class="video-category dynamic" style="background: ${categoryColor || '#6b7280'}">${escapeHtml(categoryName)}</span>
            <button class="video-delete-btn" data-id="${video.id}" aria-label="削除">🗑️</button>
            <span class="accordion-icon">▼</span>
        </div>
    `;

    // Content Structure
    // <div class="video-accordion-content">
    //   (Video Player or Link)
    // </div>

    let videoContent = '';
    const embedUrl = getVideoEmbedUrl(video.url);

    if (embedUrl) {
        videoContent = `
            <div class="video-embed-container">
                <iframe src="${embedUrl}" title="${escapeHtml(video.title)}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
            </div>
        `;
    } else {
        videoContent = `
            <a href="${escapeHtml(video.url)}" target="_blank" rel="noopener noreferrer" class="video-link">
                <span>📺</span> 動画を見る
            </a>
        `;
    }

    const content = document.createElement('div');
    content.className = 'video-accordion-content';
    content.innerHTML = videoContent;

    // Add elements to item
    accordionItem.appendChild(header);
    accordionItem.appendChild(content);

    // Toggle event
    header.addEventListener('click', () => {
        accordionItem.classList.toggle('active');
    });

    // Drag and Drop implementation
    accordionItem.setAttribute('draggable', true);
    accordionItem.dataset.id = video.id;

    accordionItem.addEventListener('dragstart', (e) => {
        draggedVideoId = video.id;
        accordionItem.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        // Add a small delay to make the drag image look better (optional)
    });

    accordionItem.addEventListener('dragend', () => {
        accordionItem.classList.remove('dragging');
        draggedVideoId = null;
        if (videoList) videoList.classList.remove('drag-over');
    });

    accordionItem.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        const draggingItem = document.querySelector('.video-accordion-item.dragging');
        if (!draggingItem || draggingItem === accordionItem) return;

        // Visual feedback
        const rect = accordionItem.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;

        if (e.clientY < midpoint) {
            accordionItem.style.borderTop = '2px solid var(--accent-primary)';
            accordionItem.style.borderBottom = '';
        } else {
            accordionItem.style.borderBottom = '2px solid var(--accent-primary)';
            accordionItem.style.borderTop = '';
        }
    });

    accordionItem.addEventListener('dragleave', () => {
        accordionItem.style.borderTop = '';
        accordionItem.style.borderBottom = '';
    });

    accordionItem.addEventListener('drop', async (e) => {
        e.preventDefault();
        accordionItem.style.borderTop = '';
        accordionItem.style.borderBottom = '';

        if (!draggedVideoId || draggedVideoId === video.id) return;

        // Calculate new order
        const rect = accordionItem.getBoundingClientRect();
        const dropAtTop = e.clientY < (rect.top + rect.height / 2);

        reorderVideos(draggedVideoId, video.id, dropAtTop);
    });

    // Delete event (now in header)
    const deleteBtn = header.querySelector('.video-delete-btn');
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent accordion toggle
        videoToDeleteId = video.id;
        videoDeleteModal.classList.add('active');
        videoDeletePasswordInput.focus();
    });

    // Category click event (Filter by this category)
    const categoryBadge = header.querySelector('.video-category');
    categoryBadge.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent accordion toggle

        let filterId = catObj ? catObj.id : null;
        if (filterId && videoFilterSelect) {
            videoFilterSelect.value = filterId;
            // Trigger change event manually
            videoFilterSelect.dispatchEvent(new Event('change'));
        }
    });

    return accordionItem;
}

function getVideoEmbedUrl(url) {
    if (!url) return null;

    // YouTube
    const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
    const youtubeMatch = url.match(youtubeRegex);
    if (youtubeMatch && youtubeMatch[1]) {
        return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
    }

    // Vimeo
    const vimeoRegex = /(?:vimeo\.com\/)(\d+)/i;
    const vimeoMatch = url.match(vimeoRegex);
    if (vimeoMatch && vimeoMatch[1]) {
        return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    }

    return null;
}

// Video Modal Event Listeners
if (openVideoModalBtn) {
    openVideoModalBtn.addEventListener('click', () => {
        videoModal.classList.add('active');
    });
}

// Fetch Video Metadata Logic
const videoUrlInput = document.getElementById('videoUrl');
const videoTitleInput = document.getElementById('videoTitle');
const videoAuthorInput = document.getElementById('videoAuthor');
const videoAuthorUrlInput = document.getElementById('videoAuthorUrl');
const fetchVideoInfoBtn = document.getElementById('fetchVideoInfoBtn');

async function fetchVideoMetadata(url) {
    if (!url) return;

    try {
        // Show loading state
        if (fetchVideoInfoBtn) {
            fetchVideoInfoBtn.textContent = '⏳';
            fetchVideoInfoBtn.disabled = true;
        }

        // Use noembed for oEmbed compatible sites (YouTube, Vimeo, etc.)
        const response = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
        const data = await response.json();

        if (data.error) {
            console.log('Could not fetch metadata:', data.error);
            alert('動画情報を取得できませんでした。URLを確認してください。');
        } else {
            // Always overwrite or fill? User clicked "Get", so overwrite seems appropriate.
            if (videoTitleInput) videoTitleInput.value = data.title || '';
            if (videoAuthorInput) videoAuthorInput.value = data.author_name || '';
            if (videoAuthorUrlInput) videoAuthorUrlInput.value = data.author_url || '';
        }

    } catch (error) {
        console.error('Error fetching metadata:', error);
        alert('情報の取得に失敗しました。');
    } finally {
        if (fetchVideoInfoBtn) {
            fetchVideoInfoBtn.textContent = '⬇︎';
            fetchVideoInfoBtn.disabled = false;
        }
    }
}

if (fetchVideoInfoBtn && videoUrlInput) {
    fetchVideoInfoBtn.addEventListener('click', () => {
        const url = videoUrlInput.value.trim();
        if (url) {
            fetchVideoMetadata(url);
        } else {
            alert('URLを入力してください');
        }
    });

}


function closeVideoModal() {
    videoModal.classList.remove('active');
    videoForm.reset();
}

function closeVideoDeleteModal() {
    videoDeleteModal.classList.remove('active');
    videoDeletePasswordInput.value = '';
    videoDeleteError.textContent = '';
    videoToDeleteId = null;
}

if (closeVideoModalBtn) closeVideoModalBtn.addEventListener('click', closeVideoModal);
if (cancelVideoBtn) cancelVideoBtn.addEventListener('click', closeVideoModal);

if (closeVideoDeleteModalBtn) closeVideoDeleteModalBtn.addEventListener('click', closeVideoDeleteModal);
if (cancelVideoDeleteBtn) cancelVideoDeleteBtn.addEventListener('click', closeVideoDeleteModal);

if (videoModal) {
    videoModal.addEventListener('click', (e) => {
        if (e.target === videoModal) closeVideoModal();
    });
}

if (videoDeleteModal) {
    videoDeleteModal.addEventListener('click', (e) => {
        if (e.target === videoDeleteModal) closeVideoDeleteModal();
    });
}

// Video Form Submit
if (videoForm) {
    videoForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const title = document.getElementById('videoTitle').value.trim();
        const url = document.getElementById('videoUrl').value.trim();
        const category = document.getElementById('videoCategory').value;
        const author = document.getElementById('videoAuthor').value.trim();
        const authorUrlInput = document.getElementById('videoAuthorUrl');
        const authorUrl = authorUrlInput ? authorUrlInput.value.trim() : '';
        const password = document.getElementById('videoPassword').value.trim();

        if (!title || !author) {
            alert('動画情報を取得できませんでした。URLを確認してください。');
            return;
        }

        if (title && url && author) {
            try {
                // Get current max order
                const maxOrder = currentVideos.reduce((max, v) => Math.max(max, v.order || 0), 0);

                await addDoc(collection(db, "videos"), {
                    title: title,
                    url: url,
                    category: category,
                    author: author,
                    authorUrl: authorUrl,
                    password: password,
                    order: maxOrder + 1, // Add to bottom
                    createdAt: serverTimestamp()
                });

                closeVideoModal();
            } catch (error) {
                console.error('Error adding video:', error);
                alert('エラーが発生しました: ' + error.message);
            }
        }
    });
}

// Reordering Logic
async function reorderVideos(draggedId, targetId, before) {
    // 1. Get filtered list (the one the user is looking at)
    const videosInList = Array.from(videoList.querySelectorAll('.video-accordion-item'))
        .map(el => el.dataset.id);

    const draggedIdx = videosInList.indexOf(draggedId);
    let targetIdx = videosInList.indexOf(targetId);

    if (draggedIdx === -1 || targetIdx === -1) return;

    // 2. Remove dragged item
    videosInList.splice(draggedIdx, 1);

    // 3. Re-find target index after splice
    targetIdx = videosInList.indexOf(targetId);

    // 4. Insert before or after
    if (before) {
        videosInList.splice(targetIdx, 0, draggedId);
    } else {
        videosInList.splice(targetIdx + 1, 0, draggedId);
    }

    // 5. Build updates
    try {
        const batch = writeBatch(db);

        // We only update the 'order' of videos that are currently visible/filtered
        // This keeps it simple.
        videosInList.forEach((id, index) => {
            const vRef = doc(db, "videos", id);
            batch.update(vRef, { order: index });
        });

        await batch.commit();
        // UI will update automatically via subscribeToVideos
    } catch (error) {
        console.error("Error saving order:", error);
    }
}

// Video Delete Action
if (confirmVideoDeleteBtn) {
    confirmVideoDeleteBtn.addEventListener('click', async () => {
        if (!videoToDeleteId) return;

        const password = videoDeletePasswordInput.value;

        try {
            const docRef = doc(db, "videos", videoToDeleteId);
            const docSnap = await getDoc(docRef);

            if (!docSnap.exists()) {
                throw new Error('動画が見つかりません');
            }

            const videoData = docSnap.data();
            if (videoData.password && videoData.password !== password) {
                throw new Error('Incorrect password');
            }

            await deleteDoc(docRef);
            closeVideoDeleteModal();
        } catch (error) {
            videoDeleteError.textContent = error.message === 'Incorrect password' ? 'パスワードが間違っています' : '削除エラー';
        }
    });
}

// ===== Initialization =====
document.addEventListener('DOMContentLoaded', () => {
    renderCalendar();
    subscribeToEvents();
    subscribeToPosts();
    subscribeToVideos();
    subscribeToCategories();
});
