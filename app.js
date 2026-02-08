/**
 * HIDAYA - Quran Website Application
 * Created by Ahmed Jaballah
 * 
 * Features:
 * - Load all 114 Surahs from Al-Quran Cloud API
 * - Display Ayahs with Arabic text and English translation
 * - Audio recitation with play/pause per Ayah
 * - Search functionality (Arabic + English)
 * - Daily random Ayah & Prayer Times
 * - Dark mode with persistence (Default: Dark)
 * - Share buttons (WhatsApp, Twitter, Copy)
 */

// ==================== CONFIGURATION ====================
const API_BASE = 'https://api.alquran.cloud/v1';
const ALADHAN_API = 'https://api.aladhan.com/v1';
const TRANSLATION_EDITION = 'en.asad'; // Muhammad Asad translation
const TOTAL_AYAHS = 6236; // Total Ayahs in Quran

// ==================== STATE ====================
let surahs = [];
let currentSurah = null;
let currentAyahs = [];
let audioPlayer = null;
let isPlaying = false;
let currentAyahIndex = -1;
let playAllMode = false;

// Audio Settings
let settings = {
    reciter: localStorage.getItem('reciter') || 'ar.alafasy',
    speed: parseFloat(localStorage.getItem('speed')) || 1,
    volume: parseFloat(localStorage.getItem('volume')) || 1
};

// ==================== DOM ELEMENTS ====================
const elements = {
    // Sections
    hero: document.getElementById('hero'),
    surahSection: document.getElementById('surah-section'),
    ayahSection: document.getElementById('ayah-section'),
    searchResults: document.getElementById('search-results'),

    // Lists
    surahList: document.getElementById('surah-list'),
    ayahList: document.getElementById('ayah-list'),
    searchResultsList: document.getElementById('search-results-list'),
    prayerTimes: document.getElementById('prayer-times'),

    // Header & Controls
    logoLink: document.getElementById('logo-link'),
    darkModeToggle: document.getElementById('dark-mode-toggle'),
    locationBtn: document.getElementById('location-btn'),
    backBtn: document.getElementById('back-to-surahs'),
    surahTitle: document.getElementById('surah-title'),
    surahDetails: document.getElementById('surah-details'),

    // Search
    searchInput: document.getElementById('search-input'),
    mobileSearchInput: document.getElementById('mobile-search-input'),
    mobileSearchToggle: document.getElementById('mobile-search-toggle'),
    mobileSearch: document.getElementById('mobile-search'),
    clearSearch: document.getElementById('clear-search'),

    // Daily Ayah
    dailyArabic: document.getElementById('daily-arabic'),
    dailyTranslation: document.getElementById('daily-translation'),
    dailyReference: document.getElementById('daily-reference'),

    // Audio Controls
    playAllBtn: document.getElementById('play-all-btn'),
    playAllText: document.getElementById('play-all-text'),
    playAllIcon: document.getElementById('play-all-icon'),
    stopBtn: document.getElementById('stop-btn'),
    nowPlaying: document.getElementById('now-playing'),
    currentAyahNum: document.getElementById('current-ayah-num'),
    reciterSelect: document.getElementById('reciter-select'),
    speedSelect: document.getElementById('speed-select')
};

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    initDarkMode();
    initInstallPrompt();

    // Only init core app if elements exist (e.g. not on about page)
    if (elements.surahList || elements.dailyTranslation) {
        initAudioPlayer();
        initSettings();
        loadSurahs();
        loadDailyAyah();
        loadPrayerTimes();
        initEventListeners();
    }
});

// ==================== SETTINGS & CONTROLS ====================
function initSettings() {
    // Set initial values
    if (elements.reciterSelect) elements.reciterSelect.value = settings.reciter;
    if (elements.speedSelect) elements.speedSelect.value = settings.speed;

    // Listeners
    if (elements.reciterSelect) {
        elements.reciterSelect.addEventListener('change', (e) => {
            settings.reciter = e.target.value;
            localStorage.setItem('reciter', settings.reciter);
            if (currentSurah) {
                loadSurah(currentSurah.number); // Reload to get new audio URLs
            }
        });
    }

    if (elements.speedSelect) {
        elements.speedSelect.addEventListener('change', (e) => {
            settings.speed = parseFloat(e.target.value);
            localStorage.setItem('speed', settings.speed);
            if (audioPlayer) audioPlayer.playbackRate = settings.speed;
        });
    }
}

// ==================== DARK MODE ====================
function initDarkMode() {
    // Default to true (Dark Mode) if not set
    const isDark = localStorage.getItem('darkMode') !== 'false';
    if (isDark) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
}

function toggleDarkMode() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('darkMode', isDark);
}

// ==================== AUDIO PLAYER ====================
function initAudioPlayer() {
    audioPlayer = document.getElementById('audio-player');

    // Apply initial settings
    audioPlayer.volume = settings.volume;
    audioPlayer.playbackRate = settings.speed;

    audioPlayer.addEventListener('ended', () => {
        if (playAllMode && currentAyahIndex < currentAyahs.length - 1) {
            playAyah(currentAyahIndex + 1);
        } else {
            stopAudio();
        }
    });

    audioPlayer.addEventListener('error', () => {
        showToast('Failed to load audio', 'error');
        stopAudio();
    });
}

function playAyah(index) {
    if (index < 0 || index >= currentAyahs.length) return;

    const ayah = currentAyahs[index];
    if (!ayah.audio) {
        showToast('No audio available for this Ayah', 'error');
        return;
    }

    // Update state
    currentAyahIndex = index;
    isPlaying = true;

    // Update UI
    document.querySelectorAll('.ayah-card').forEach(card => card.classList.remove('playing'));
    document.querySelectorAll('.play-btn').forEach(btn => btn.classList.remove('playing'));

    const ayahCard = document.querySelector(`[data-ayah-index="${index}"]`);
    const playBtn = ayahCard?.querySelector('.play-btn');
    if (ayahCard) {
        ayahCard.classList.add('playing');
        // Smooth scroll to active Ayah
        ayahCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    if (playBtn) playBtn.classList.add('playing');

    elements.nowPlaying.classList.remove('hidden');
    elements.currentAyahNum.textContent = `Ayah ${ayah.numberInSurah}`;

    if (playAllMode) {
        elements.playAllText.textContent = 'Playing...';
        updatePlayAllIcon(true);
    }

    // Play audio
    audioPlayer.src = ayah.audio;
    audioPlayer.playbackRate = settings.speed; // Ensure speed is applied
    audioPlayer.play().catch(err => {
        console.error('Audio playback failed:', err);
        showToast('Audio playback failed', 'error');
        stopAudio();
    });
}

function stopAudio() {
    audioPlayer.pause();
    isPlaying = false;
    playAllMode = false;
    currentAyahIndex = -1;

    document.querySelectorAll('.ayah-card').forEach(card => card.classList.remove('playing'));
    document.querySelectorAll('.play-btn').forEach(btn => btn.classList.remove('playing'));

    elements.nowPlaying.classList.add('hidden');
    elements.playAllText.textContent = 'Play Surah';
    updatePlayAllIcon(false);
}

function togglePlayAll() {
    if (playAllMode && isPlaying) {
        stopAudio();
    } else {
        playAllMode = true;
        // Start from current playing ayah or first
        const startIndex = currentAyahIndex > -1 ? currentAyahIndex : 0;
        playAyah(startIndex);
    }
}

function updatePlayAllIcon(playing) {
    if (playing) {
        elements.playAllIcon.innerHTML = '<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clip-rule="evenodd"/>';
    } else {
        elements.playAllIcon.innerHTML = '<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"/>';
    }
}

// ==================== API CALLS ====================
async function fetchAPI(endpoint) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const response = await fetch(`${API_BASE}${endpoint}`, {
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) throw new Error('API request failed');
        const data = await response.json();
        return data.data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

async function loadSurahs() {
    try {
        surahs = await fetchAPI('/surah');
        renderSurahList();
    } catch (error) {
        elements.surahList.innerHTML = `
            <div class="col-span-full text-center py-12">
                <p class="text-red-500">Failed to load Surahs. The API might be slow.</p>
                <button onclick="loadSurahs()" class="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
                    Retry
                </button>
            </div>
        `;
    }
}

async function loadSurah(surahNumber) {
    elements.ayahList.innerHTML = `
        <div class="text-center py-12">
            <div class="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent"></div>
            <p class="mt-4 text-gray-500 dark:text-gray-400">Loading Ayahs...</p>
        </div>
    `;

    try {
        // Fetch Arabic text with AUDIO (based on setting) and translation
        const [arabicData, translationData] = await Promise.all([
            fetchAPI(`/surah/${surahNumber}/${settings.reciter}`),
            fetchAPI(`/surah/${surahNumber}/${TRANSLATION_EDITION}`)
        ]);

        currentSurah = arabicData;

        // Combine Arabic, audio, and translation
        currentAyahs = arabicData.ayahs.map((ayah, i) => ({
            number: ayah.number,
            numberInSurah: ayah.numberInSurah,
            arabic: ayah.text,
            translation: translationData.ayahs[i]?.text || '',
            audio: ayah.audio || ayah.audioSecondary?.[0]
        }));

        // Update header
        elements.surahTitle.textContent = `${currentSurah.englishName} - ${currentSurah.name}`;
        elements.surahDetails.textContent = `${currentSurah.revelationType} • ${currentSurah.numberOfAyahs} Ayahs`;

        renderAyahList();
        showAyahSection();

    } catch (error) {
        elements.ayahList.innerHTML = `
            <div class="text-center py-12">
                <p class="text-red-500">Failed to load Ayahs. Please try again.</p>
                <button onclick="loadSurah(${surahNumber})" class="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
                    Retry
                </button>
            </div>
        `;
    }
}

async function loadDailyAyah() {
    try {
        const today = new Date();
        const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
        const ayahNumber = (seed % TOTAL_AYAHS) + 1;

        const data = await fetchAPI(`/ayah/${ayahNumber}/editions/quran-uthmani,${TRANSLATION_EDITION}`);

        const arabicAyah = data[0];
        const translationAyah = data[1];

        elements.dailyArabic.textContent = arabicAyah.text;
        elements.dailyTranslation.textContent = translationAyah.text;
        elements.dailyReference.textContent = `— ${arabicAyah.surah.englishName} (${arabicAyah.surah.name}), Ayah ${arabicAyah.numberInSurah}`;

    } catch (error) {
        elements.dailyArabic.textContent = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';
        elements.dailyTranslation.textContent = 'In the name of God, the Most Gracious, the Most Merciful';
        elements.dailyReference.textContent = '— Al-Fatihah, Ayah 1';
    }
}

// ==================== PRAYER TIMES ====================
async function loadPrayerTimes() {
    if (!elements.prayerTimes) return;

    elements.prayerTimes.innerHTML = '<div class="col-span-full text-center text-sm text-gray-500">Loading prayer times...</div>';

    try {
        // Try to get location, fallback to London if denied/error
        // Simple timeout for geolocation
        const geoOptions = { timeout: 5000 };
        navigator.geolocation.getCurrentPosition(
            pos => fetchPrayerTimes(pos.coords.latitude, pos.coords.longitude),
            err => fetchPrayerTimes(51.5074, -0.1278), // Default: London
            geoOptions
        );
    } catch (err) {
        fetchPrayerTimes(51.5074, -0.1278);
    }
}

async function fetchPrayerTimes(lat, lng) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(`${ALADHAN_API}/timings/${Math.floor(Date.now() / 1000)}?latitude=${lat}&longitude=${lng}&method=2`, {
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) throw new Error('Prayer API failed');

        const data = await response.json();
        const timings = data.data.timings;

        const prayers = [
            { name: 'Fajr', time: timings.Fajr },
            { name: 'Dhuhr', time: timings.Dhuhr },
            { name: 'Asr', time: timings.Asr },
            { name: 'Maghrib', time: timings.Maghrib },
            { name: 'Isha', time: timings.Isha }
        ];

        renderPrayerTimes(prayers);
    } catch (error) {
        elements.prayerTimes.innerHTML = '<div class="col-span-full text-center text-red-500 text-sm">Failed to load prayer times</div>';
    }
}

function renderPrayerTimes(prayers) {
    const nextPrayerIndex = findNextPrayer(prayers);

    elements.prayerTimes.innerHTML = prayers.map((prayer, index) => `
        <div class="prayer-card flex flex-col items-center justify-center p-3 ${index === nextPrayerIndex ? 'next-prayer' : ''}">
            <span class="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1 uppercase">${prayer.name}</span>
            <span class="text-lg font-bold text-gray-800 dark:text-gray-100">${formatTime(prayer.time)}</span>
        </div>
    `).join('');
}

function findNextPrayer(prayers) {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    for (let i = 0; i < prayers.length; i++) {
        const [hours, minutes] = prayers[i].time.split(':').map(Number);
        const prayerTime = hours * 60 + minutes;

        if (prayerTime > currentTime) {
            return i;
        }
    }
    return 0; // If all passed, next is Fajr tomorrow (show first)
}

function formatTime(timeStr) {
    const [hours, minutes] = timeStr.split(':');
    let h = parseInt(hours);
    const m = minutes;
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    h = h ? h : 12;
    return `${h}:${m} ${ampm}`;
}

// ==================== RENDERING ====================
function renderSurahList() {
    elements.surahList.innerHTML = surahs.map(surah => `
        <div class="surah-card" data-surah="${surah.number}" onclick="loadSurah(${surah.number})">
            <div class="flex items-center gap-4">
                <div class="surah-number">${surah.number}</div>
                <div class="flex-1 min-w-0">
                    <h3 class="font-semibold text-gray-800 dark:text-gray-100 truncate">${surah.englishName}</h3>
                    <p class="text-sm text-gray-500 dark:text-gray-400">${surah.englishNameTranslation}</p>
                </div>
                <div class="text-right">
                    <p class="font-arabic text-xl text-primary-600 dark:text-primary-400">${surah.name}</p>
                    <p class="text-xs text-gray-400 dark:text-gray-500">${surah.numberOfAyahs} Ayahs</p>
                </div>
            </div>
        </div>
    `).join('');
}

function renderAyahList() {
    elements.ayahList.innerHTML = currentAyahs.map((ayah, index) => `
        <div class="ayah-card" data-ayah-index="${index}">
            <div class="flex items-start gap-4 mb-4">
                <div class="ayah-number">${ayah.numberInSurah}</div>
                <button class="play-btn" onclick="toggleAyahPlay(${index})" title="Play Ayah">
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"/>
                    </svg>
                </button>
                <div class="flex gap-2 ml-auto">
                    <button class="share-btn whatsapp" onclick="shareWhatsApp(${index})" title="Share on WhatsApp">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                    </button>
                    <button class="share-btn twitter" onclick="shareTwitter(${index})" title="Share on Twitter">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                    </button>
                    <button class="share-btn copy" onclick="copyAyah(${index})" title="Copy Ayah">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                    </button>
                </div>
            </div>
            <p class="arabic-text mb-4">${ayah.arabic}</p>
            <p class="text-gray-600 dark:text-gray-400 leading-relaxed">${ayah.translation}</p>
        </div>
    `).join('');
}

// ==================== NAVIGATION, SEARCH, SHARE, UTILS ====================
function showSurahSection() {
    stopAudio();
    elements.ayahSection.classList.add('hidden');
    elements.surahSection.classList.remove('hidden');
    elements.hero.classList.remove('hidden');
    currentSurah = null;
    currentAyahs = [];
}

function showAyahSection() {
    elements.surahSection.classList.add('hidden');
    elements.ayahSection.classList.remove('hidden');
    elements.hero.classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

let searchTimeout = null;

function handleSearch(query) {
    clearTimeout(searchTimeout);

    if (!query.trim()) {
        elements.searchResults.classList.add('hidden');
        elements.surahSection.classList.remove('hidden');
        return;
    }

    searchTimeout = setTimeout(async () => {
        const q = query.toLowerCase();
        const results = [];

        // Search in surah names first
        surahs.forEach(surah => {
            if (surah.englishName.toLowerCase().includes(q) ||
                surah.englishNameTranslation.toLowerCase().includes(q) ||
                surah.name.includes(query)) {
                results.push({
                    type: 'surah',
                    surah: surah,
                    match: surah.englishName
                });
            }
        });

        // Search ayahs if currently viewing a surah
        if (currentAyahs.length > 0) {
            currentAyahs.forEach((ayah, index) => {
                if (ayah.arabic.includes(query) || ayah.translation.toLowerCase().includes(q)) {
                    results.push({
                        type: 'ayah',
                        ayah: ayah,
                        index: index,
                        surahName: currentSurah.englishName
                    });
                }
            });
        }

        renderSearchResults(results, query);
    }, 300);
}

function renderSearchResults(results, query) {
    if (results.length === 0) {
        elements.searchResultsList.innerHTML = `
            <div class="text-center py-8 text-gray-500 dark:text-gray-400">
                No results found for "${escapeHtml(query)}"
            </div>
        `;
    } else {
        elements.searchResultsList.innerHTML = results.slice(0, 20).map(result => {
            if (result.type === 'surah') {
                return `
                    <div class="search-result-card" onclick="loadSurah(${result.surah.number})">
                        <div class="flex items-center gap-3">
                            <div class="surah-number">${result.surah.number}</div>
                            <div>
                                <p class="font-semibold">${highlightText(result.surah.englishName, query)}</p>
                                <p class="text-sm text-gray-500">${result.surah.englishNameTranslation}</p>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                return `
                    <div class="search-result-card" onclick="scrollToAyah(${result.index})">
                        <p class="text-sm text-gray-500 mb-2">${result.surahName} - Ayah ${result.ayah.numberInSurah}</p>
                        <p class="arabic-text text-lg mb-2">${result.ayah.arabic}</p>
                        <p class="text-gray-600 dark:text-gray-400">${highlightText(result.ayah.translation, query)}</p>
                    </div>
                `;
            }
        }).join('');
    }

    elements.searchResults.classList.remove('hidden');
    elements.surahSection.classList.add('hidden');
}

function clearSearch() {
    elements.searchInput.value = '';
    elements.mobileSearchInput.value = '';
    elements.searchResults.classList.add('hidden');
    elements.surahSection.classList.remove('hidden');
}

function scrollToAyah(index) {
    clearSearch();
    const ayahCard = document.querySelector(`[data-ayah-index="${index}"]`);
    if (ayahCard) {
        ayahCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        ayahCard.classList.add('playing');
        setTimeout(() => ayahCard.classList.remove('playing'), 2000);
    }
}

function highlightText(text, query) {
    if (!query) return text;
    const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
    return text.replace(regex, '<span class="highlight">$1</span>');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function shareWhatsApp(index) {
    const ayah = currentAyahs[index];
    const text = `${ayah.arabic}\n\n${ayah.translation}\n\n— ${currentSurah.englishName}, Ayah ${ayah.numberInSurah}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

function shareTwitter(index) {
    const ayah = currentAyahs[index];
    const text = `${ayah.translation}\n\n— ${currentSurah.englishName}, Ayah ${ayah.numberInSurah}\n\n#Quran #Hidaya`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
}

async function copyAyah(index) {
    const ayah = currentAyahs[index];
    const text = `${ayah.arabic}\n\n${ayah.translation}\n\n— ${currentSurah.englishName}, Ayah ${ayah.numberInSurah}`;

    try {
        await navigator.clipboard.writeText(text);
        showToast('Ayah copied to clipboard!', 'success');
    } catch (err) {
        showToast('Failed to copy', 'error');
    }
}

function showToast(message, type = 'success') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function initEventListeners() {
    elements.darkModeToggle.addEventListener('click', toggleDarkMode);
    elements.backBtn.addEventListener('click', showSurahSection);

    elements.logoLink.addEventListener('click', (e) => {
        e.preventDefault();
        showSurahSection();
    });

    elements.searchInput.addEventListener('input', (e) => handleSearch(e.target.value));
    elements.mobileSearchInput.addEventListener('input', (e) => handleSearch(e.target.value));

    elements.mobileSearchToggle.addEventListener('click', () => {
        elements.mobileSearch.classList.toggle('hidden');
        if (!elements.mobileSearch.classList.contains('hidden')) {
            elements.mobileSearchInput.focus();
        }
    });

    elements.clearSearch.addEventListener('click', clearSearch);

    elements.playAllBtn.addEventListener('click', togglePlayAll);
    elements.stopBtn.addEventListener('click', stopAudio);

    // Location button
    if (elements.locationBtn) {
        elements.locationBtn.addEventListener('click', () => {
            loadPrayerTimes();
            showToast('Updating location...', 'success');
        });
    }

    // PWA Install Button
    initInstallPrompt();
}

// ==================== PWA INSTALL ====================
let deferredPrompt;

function initInstallPrompt() {
    const installBtn = document.getElementById('install-btn'); // Header button
    const installBtnPage = document.getElementById('install-btn-page'); // Install Page Button
    const installInstructions = document.getElementById('install-instructions-desktop');

    // Initially hide header button
    if (installBtn) installBtn.classList.add('hidden');

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;

        // Show header button if available
        if (installBtn) installBtn.classList.remove('hidden');

        // Ensure instructions are hidden if prompt is available (only if we wanted to hide them by default)
        // But we keep instructions hidden in HTML by default, so this is fine.
        if (installInstructions) installInstructions.classList.add('hidden');
    });

    const triggerInstall = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`User response: ${outcome}`);
            deferredPrompt = null;
            if (installBtn) installBtn.classList.add('hidden');
        } else {
            // Fallback: Show instructions
            if (installInstructions) {
                installInstructions.classList.remove('hidden');
                installInstructions.scrollIntoView({ behavior: 'smooth' });
            } else {
                alert('To install, use your browser menu or look for the install icon in the address bar.');
            }
        }
    };

    if (installBtn) installBtn.addEventListener('click', triggerInstall);
    if (installBtnPage) installBtnPage.addEventListener('click', triggerInstall);

    window.addEventListener('appinstalled', () => {
        console.log('PWA was installed');
        if (installBtn) installBtn.classList.add('hidden');
        if (installInstructions) installInstructions.classList.remove('hidden');
    });
}

function toggleAyahPlay(index) {
    if (currentAyahIndex === index && isPlaying) {
        stopAudio();
    } else {
        playAllMode = false;
        playAyah(index);
    }
}

// Register Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Service Worker registered!', reg))
            .catch(err => console.log('Service Worker registration failed: ', err));
    });
}
