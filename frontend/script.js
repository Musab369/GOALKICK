/* ==========================================================
   FOOTBALL AI
   Frontend connected to FastAPI
   Backend: http://127.0.0.1:8000
   Frontend: http://127.0.0.1:3000
   ========================================================== */

"use strict";

/* =========================
   1. CONFIGURATION
   ========================= */

const CONFIG = {
    USE_API: true,
    API_BASE: "http://127.0.0.1:8000",
    REFRESH_INTERVAL: 5000
};

const CLUB_LOGOS = {
    "real madrid": "https://assets.laliga.com/assets/2019/06/07/small/real-madrid.png",
    "barcelona fc": "https://assets.laliga.com/assets/2019/06/07/small/barcelona.png",
    "manchester city": "https://resources.premierleague.com/premierleague/badges/50/t43.png",
    "liverpool fc": "https://resources.premierleague.com/premierleague/badges/50/t14.png",
    "manchester united": "https://resources.premierleague.com/premierleague/badges/50/t1.png",
    "atletico madrid": "https://assets.laliga.com/assets/2019/06/07/small/atletico.png"
};
const DEFAULT_CLUB_LOGO = "https://assets.laliga.com/assets/2019/06/07/small/real-madrid.png";



/* =========================
   2. APP STATE
   ========================= */

const S = {
    v: "home",
    mi: 0,
    mt: "stats",
    lt: "popular",
    lopen: null
};

let M = [];
let T = {};
let XI = {};
let matchLineups = {};
let LG = [];
let UP = [];
let PAST = [];
let PL = [];

// Unique ID for the current GOALKICK AI conversation
const aiConversationId = crypto.randomUUID();


const RECENT_MATCH = {
    id: "recent-001",
    homeTeam: "Liverpool FC",
    awayTeam: "Manchester United",
    homeScore: 2,
    awayScore: 0,
    status: "FT",
    competition: "Premier League",
    dateLabel: "Recently Completed",
    events: [
        {
            minute: 24,
            team: "Liverpool FC",
            player: "Mohamed Salah",
            event: "goal",
            description: "Mohamed Salah scores for Liverpool"
        },
        {
            minute: 67,
            team: "Liverpool FC",
            player: "Cody Gakpo",
            event: "goal",
            description: "Cody Gakpo scores for Liverpool"
        }
    ]
};



let matchStats = {};
let matchSummary = null;

let refreshTimer = null;

// Track goals that have already triggered notifications
let notifiedGoals = new Set();
let previousGoalScore = 0;




/* =========================
   3. DOM ELEMENTS
   ========================= */

const view = document.getElementById("view");
const nav = document.getElementById("nav");
const tabbar = document.getElementById("tabbar");

const sheet = document.getElementById("sheet");
const sheetCard = document.getElementById("sheetCard");


/* =========================
   4. ICONS
   ========================= */

function ic(name) {
    const icons = {
        home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',

        live: '<circle cx="12" cy="12" r="9"/><path d="M8 12h8M12 8v8"/>',

        leagues: '<path d="M3.5 10h17M8 3v4M16 3v4M8 14h2M14 14h2M8 17.5h2"/>',

        fixtures: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',

        players: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',

        stats: '<path d="M4 19V9m5 10V4m5 15v-7m5 7V7"/>',

        arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',

        back: '<path d="m15 18-6-6 6-6"/>',

        close: '<path d="m18 6-12 12M6 6l12 12"/>',

        settings: '<circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.8 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.8-1l-1.7.6-1.4-2.4 1.4-1.1a8 8 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.8-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.8 1l1.7-.6 1.4 2.4-1.4 1.1a8 8 0 0 1 0 2z"/>'
    };

    return '<svg viewBox="0 0 24 24" width="20" height="20" ' +
        'fill="none" stroke="currentColor" stroke-width="1.7" ' +
        'stroke-linecap="round" stroke-linejoin="round" ' +
        'aria-hidden="true">' + (icons[name] || "") + '</svg>';
}


function evIcon(type) {
    const normalizedType = String(type || "")
        .toLowerCase()
        .trim()
        .replace(/[\s-]+/g, "_");

    const icons = {
        goal: "⚽",
        own_goal: "🥅",
        penalty: "⚽",

        shot: "🎯",
        shot_on_target: "🎯",
        shot_off_target: "↗️",
        blocked_shot: "🛡️",
        woodwork: "🥅",

        pass: "➜",
        key_pass: "🎯",
        long_ball: "🚀",
        cross: "↗️",

        tackle: "🛡️",
        interception: "✋",
        possession_change: "🔄",

        corner: "🚩",
        free_kick: "🦵",
        foul: "⚠️",
        throw_in: "↔️",
        offside: "🚩",

        yellow_card: "🟨",
        red_card: "🟥",
        substitution: "🔄",

        var: "📺",
        half_time: "⏸️",
        full_time: "🏁",
        kickoff: "▶️"
    };

    return '<span class="event-icon">' +
        (icons[normalizedType] || "⚽") +
        '</span>';

}



/* =========================
   5. HELPERS
   ========================= */

function esc(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}


function request(path) {
    return fetch(CONFIG.API_BASE + path)
        .then(function (response) {
            if (!response.ok) {
                throw new Error(
                    "API request failed: " +
                    response.status + " " + path
                );
            }

            return response.json();
        });
}


const api = {
    match: function () {
        return request("/match");
    },

    live: function () {
        return request("/match");
    },

    events: function () {
        return request("/events");
    },

    stats: function () {
        return request("/statistics");
    },

    summary: function () {
        return request("/summary");
    },

    leagues: function () {
        return Promise.resolve([]);
    },

    fixtures: function () {
        return Promise.resolve({
            upcoming: [],
            past: []
        });
    },

    teams: function () {
        return Promise.resolve({});
    },

    lineups: function () {
        return request("/lineups");
    },

    players: function () {
        return Promise.resolve([]);
    }
};


/* =========================
   6. DEFAULT DATA
   Used if the API is unavailable
   ========================= */


const LEAGUES = [
    {
        id: "premier-league",
        name: "Premier League",
        country: "England",
        flag: "🏴",
        teams: [
            { name: "Arsenal", logo: "https://resources.premierleague.com/premierleague/badges/50/t3.png" },
            { name: "Liverpool", logo: "https://resources.premierleague.com/premierleague/badges/50/t14.png" },
            { name: "Manchester City", logo: "https://resources.premierleague.com/premierleague/badges/50/t43.png" },
            { name: "Manchester United", logo: "https://resources.premierleague.com/premierleague/badges/50/t1.png" },
            { name: "Chelsea", logo: "https://resources.premierleague.com/premierleague/badges/50/t8.png" },
            { name: "Tottenham Hotspur", logo: "https://resources.premierleague.com/premierleague/badges/50/t6.png" },
            { name: "Newcastle United", logo: "https://resources.premierleague.com/premierleague/badges/50/t4.png" },
            { name: "Aston Villa", logo: "https://resources.premierleague.com/premierleague/badges/50/t7.png" },
            { name: "Brighton", logo: "https://resources.premierleague.com/premierleague/badges/50/t36.png" },
            { name: "West Ham United", logo: "https://resources.premierleague.com/premierleague/badges/50/t21.png" }
        ]
    },
    {
        id: "la-liga",
        name: "La Liga",
        country: "Spain",
        flag: "🇪🇸",
        teams: [
            { name: "Real Madrid", logo: "https://assets.laliga.com/assets/2019/06/07/small/real-madrid.png" },
            { name: "FC Barcelona", logo: "https://assets.laliga.com/assets/2019/06/07/small/barcelona.png" },
            { name: "Atletico Madrid", logo: "https://assets.laliga.com/assets/2019/06/07/small/atletico.png" },
            { name: "Athletic Club", logo: "https://assets.laliga.com/assets/2019/06/07/small/athletic.png" },
            { name: "Real Sociedad", logo: "https://assets.laliga.com/assets/2019/06/07/small/real-sociedad.png" },
            { name: "Villarreal", logo: "https://assets.laliga.com/assets/2019/06/07/small/villarreal.png" },
            { name: "Racing Club", logo: "https://assets.laliga.com/assets/2019/06/07/small/racing.png" },
            { name: "Sevilla", logo: "https://assets.laliga.com/assets/2019/06/07/small/sevilla.png" },
            { name: "Valencia", logo: "https://assets.laliga.com/assets/2019/06/07/small/valencia.png" },
            { name: "Girona", logo: "https://assets.laliga.com/assets/2019/06/07/small/girona.png" }
        ]
    },
    {
        id: "bundesliga",
        name: "Bundesliga",
        country: "Germany",
        flag: "🇩🇪",
        teams: [
            { name: "Bayern Munich", logo: "" },
            { name: "Borussia Dortmund", logo: "" },
            { name: "Bayer Leverkusen", logo: "" },
            { name: "RB Leipzig", logo: "" },
            { name: "Eintracht Frankfurt", logo: "" },
            { name: "VfB Stuttgart", logo: "" },
            { name: "Wolfsburg", logo: "" },
            { name: "Borussia Monchengladbach", logo: "" },
            { name: "SC Freiburg", logo: "" },
            { name: "Werder Bremen", logo: "" }
        ]
    }
];

/* =========================
   DEFAULT LEAGUE STANDINGS
   ========================= */

const INITIAL_STANDINGS = {
    "premier-league": [
        [10, 7, 2, 1, 22, 10, 21],
        [10, 7, 1, 2, 21, 11, 22],
        [10, 6, 2, 2, 20, 12, 20],
        [10, 6, 1, 3, 18, 12, 19],
        [10, 5, 3, 2, 17, 12, 18],
        [10, 5, 2, 3, 16, 13, 17],
        [10, 4, 3, 3, 15, 13, 15],
        [10, 4, 2, 4, 14, 14, 14],
        [10, 3, 3, 4, 12, 15, 12],
        [10, 3, 2, 5, 11, 16, 11]
    ],

    "la-liga": [
        [10, 7, 2, 1, 21, 9, 23],
        [10, 7, 1, 2, 20, 10, 22],
        [10, 6, 2, 2, 18, 10, 20],
        [10, 6, 1, 3, 17, 12, 19],
        [10, 5, 3, 2, 16, 11, 18],
        [10, 5, 2, 3, 15, 12, 17],
        [10, 4, 3, 3, 14, 12, 15],
        [10, 4, 2, 4, 13, 13, 14],
        [10, 3, 3, 4, 12, 14, 12],
        [10, 3, 2, 5, 11, 15, 11]
    ],

    "bundesliga": [
        [9, 7, 1, 1, 25, 9, 22],
        [9, 6, 2, 1, 22, 11, 20],
        [9, 6, 1, 2, 20, 12, 19],
        [9, 5, 2, 2, 18, 12, 17],
        [9, 5, 1, 3, 17, 13, 16],
        [9, 4, 3, 2, 16, 13, 15],
        [9, 4, 2, 3, 15, 14, 14],
        [9, 3, 3, 3, 14, 14, 12],
        [9, 3, 2, 4, 12, 15, 11],
        [9, 2, 3, 4, 11, 16, 9]
    ]
};

const DEFAULT_STANDINGS = {};

LEAGUES.forEach(league => {
    const initialRows = INITIAL_STANDINGS[league.id] || [];

    DEFAULT_STANDINGS[league.id] = league.teams.map((team, index) => {
        const row = initialRows[index] || [0, 0, 0, 0, 0, 0, 0];

        const [played, won, drawn, lost, goalsFor, goalsAgainst, points] = row;

        return {
            team: team.name,
            played,
            won,
            drawn,
            lost,
            goalsFor,
            goalsAgainst,
            goalDifference: goalsFor - goalsAgainst,
            points
        };
    });
});


function loadSampleData() {
    const home = {
        id: "ars",
        name: "Arsenal",
        score: 0,
        color: "#610da5"
    };

    const away = {
        id: "liv",
        name: "Liverpool FC",
        score: 0,
        color: "#706e6e"
    };

    T = {
        ars: {
            id: "ars",
            n: home.name,
            i: "ARS",
            c: home.color
        },

        liv: {
            id: "liv",
            n: away.name,
            i: "LIV",
            c: away.color
        }
    };

    M = [{
        id: 1,
        h: "ars",
        a: "liv",
        hs: 0,
        as: 0,
        min: 0,
        lg: "Football AI Simulation",
        status: "LIVE",
        ev: [],
        poss: [50, 50],
        sot: [0, 0],
        sh: [0, 0],
        co: [0, 0],
        ai: [
            "The match simulation has started.",
            "Player data is not connected yet.",
            "Waiting for match events."
        ]
    }];

    matchStats = {};
    matchSummary = null;
}


/* =========================
   7. NORMALIZE BACKEND DATA
   ========================= */

function normalizeMatch(data) {
    if (!data) {
        throw new Error("The match endpoint returned no data.");
    }

    const homeName = data.home_team || "Home Team";
    const awayName = data.away_team || "Away Team";

    T = {
        home: {
            id: "home",
            n: homeName,
            i: shortName(homeName),
            c: "#551096"
        },

        away: {
            id: "away",
            n: awayName,
            i: shortName(awayName),
            c: "#e2d5d73d"
        }
    };

    const existingEvents = Array.isArray(data.events)
        ? data.events
        : [];

    return {
        id: data.id || 1,
        h: "home",
        a: "away",
        hs: Number(data.home_score || 0),
        as: Number(data.away_score || 0),
        min: Number(data.minute || 0),
        lg: "Football AI Simulation",
        status: data.status || "LIVE",
        ev: existingEvents,
        poss: [50, 50],
        sot: [0, 0],
        sh: [0, 0],
        co: [0, 0],
        ai: [
            "Match data is supplied by the FastAPI backend.",
            "Player-level data is not available in the current API.",
            "Statistics are based on the generated match events."
        ]
    };
}


function goalScorersHTML(teamName, events) {
    const goals = (events || []).filter(event =>
        String(event.event || "").toLowerCase() === "goal" &&
        String(event.team || "").toLowerCase() ===
        String(teamName || "").toLowerCase()
    );
    if (goals.length === 0) {
        return "";
    }
    return `
        <div class="goal-scorers">
            ${goals.map(goal => `
                <div class="goal-scorer">
                    <span class="goal-icon">⚽</span>
                    <span class="goal-minute">
                        ${Number(goal.minute || 0)}'
                    </span>
                    <span class="goal-player">
                        ${esc(goal.player || "Unknown player")}
                    </span>
                </div>
            `).join("")}
        </div>
    `;
}


function shortName(name) {
    return String(name)
        .split(/\s+/)
        .map(function (part) {
            return part.charAt(0);
        })
        .join("")
        .substring(0, 3)
        .toUpperCase();
}

function normalizeEvents(events) {
    if (!Array.isArray(events)) return [];

    return events.map(event => ({
        ...event,
        minute: Number(event.minute || 0),
        team: event.team || "Unknown team",
        event: event.event || "event",
        player: event.player || "Unknown player"
    }));
}


/* =========================
   8. LOAD BACKEND DATA
   ========================= */

async function loadData() {
    if (!CONFIG.USE_API) {
        loadSampleData();
        return;
    }

    try {
        const results = await Promise.all([
            api.match(),
            api.events(),
            api.stats(),
            api.summary()
        ]);

        const matchData = results[0];
        const eventData = results[1];

        matchStats = results[2] || {};
        matchSummary = results[3] || null;

        const currentMatch = normalizeMatch(matchData);

        currentMatch.ev = normalizeEvents(eventData);

        M = [currentMatch];

        updateStatsFromBackend();

        console.log("Football AI: API data loaded.", {
            match: M[0],
            events: M[0].ev,
            stats: matchStats,
            summary: matchSummary
        });

    } catch (error) {
        console.error("Could not load backend data:", error);

        loadSampleData();

        showNotice(
            "Backend unavailable. Showing sample data."
        );
    }
}


/* =========================
   9. UPDATE STATISTICS
   ========================= */



function updateStatsFromBackend() {
    if (!M.length) return;

    const current = M[0];

    const homeName = T[current.h].n;
    const awayName = T[current.a].n;

    const home = matchStats[homeName] || {};
    const away = matchStats[awayName] || {};

    // Shots
    current.sh = [
        Number(home.shots || 0),
        Number(away.shots || 0)
    ];

    // Shots on target
    current.sot = [
        Number(home.shots_on_target || 0),
        Number(away.shots_on_target || 0)
    ];

    // Corners
    current.co = [
        Number(home.corners || 0),
        Number(away.corners || 0)
    ];

    // Pass accuracy from backend
    current.passAccuracy = [
        Number(home.pass_accuracy || 0),
        Number(away.pass_accuracy || 0)
    ];

    // Total and successful passes
    current.passes = [
        Number(home.passes || 0),
        Number(away.passes || 0)
    ];

    current.successfulPasses = [
        Number(home.successful_passes || 0),
        Number(away.successful_passes || 0)
    ];

    // Possession percentage
    const homePasses = current.successfulPasses[0];
    const awayPasses = current.successfulPasses[1];

    const totalPasses = homePasses + awayPasses;

    // Possession percentage from backend
    current.poss = [
        Number(home.possession ?? 0),
        Number(away.possession ?? 0)
    ];
}


async function updatePassAccuracy() {
    try {
        const response = await fetch("http://127.0.0.1:8000/statistics");
        const data = await response.json();

        const homeTeam = "Barcelona FC";
        const awayTeam = "Real Madrid";

        document.getElementById("homePassAccuracy").textContent =
            data[homeTeam].pass_accuracy + "%";

        document.getElementById("awayPassAccuracy").textContent =
            data[awayTeam].pass_accuracy + "%";

    } catch (error) {
        console.error("Failed to update pass accuracy:", error);
    }
}


/* =========================
   10. REFRESH LIVE DATA
   ========================= */


async function refreshLive() {
    if (!CONFIG.USE_API) return;

    try {
        const results = await Promise.all([
            api.live(),
            api.events(),
            api.stats(),
            api.summary(),
            api.lineups()
        ]);

        const matchData = results[0];
        const eventData = results[1];

        // Update backend statistics and summary
        matchStats = results[2] || {};
        matchLineups = results[4] || {};

        console.log("Possession after API refresh:", {
            barcelona: matchStats["Barcelona FC"]?.possession,
            madrid: matchStats["Real Madrid"]?.possession
        });

        console.log("Free kicks after API refresh:", {
            barcelona: matchStats["Barcelona FC"]?.free_kicks,
            madrid: matchStats["Real Madrid"]?.free_kicks
        });

        matchSummary = results[3] || null;

        // Normalize current match

        const currentMatch = normalizeMatch(matchData);
        currentMatch.ev = normalizeEvents(eventData);

        // Find all recorded goals
        const goals = currentMatch.ev.filter(goal =>
            String(goal.event || "").toLowerCase() === "goal"
        );

        // Notify only about goals that haven't been seen before
        goals.forEach(goal => {
            const goalId = [
                goal.minute,
                goal.team,
                goal.player
            ].join("-");

            if (!notifiedGoals.has(goalId)) {
                notifiedGoals.add(goalId);

                showGoalNotification(
                    goal,
                    currentMatch.h,
                    currentMatch.a,
                    currentMatch.hs,
                    currentMatch.as
                );
            }
        });

        M = [currentMatch];



        // Update statistics, including pass accuracy
        updateStatsFromBackend();

        // Debug: check the actual values
        console.log("Backend match statistics:", matchStats);
        console.log(
            "Home pass accuracy:",
            M[0].passAccuracy?.[0]
        );
        console.log(
            "Away pass accuracy:",
            M[0].passAccuracy?.[1]
        );

        if (S.mi >= M.length) {
            S.mi = 0;
        }

        // Refresh the visible page
        // Refresh the visible page only when the lineup tab is not open
        // Refresh the visible page without interrupting Home page typing.
        if (S.v === "live" && S.mt !== "lineups") {
            render();
        }

    } catch (error) {
        console.warn("Live refresh failed:", error.message);
    }
}


/* =========================
   11. NAVIGATION
   ========================= */

const NAV_ITEMS = [
    { id: "home", label: "Home", icon: "home" },
    { id: "live", label: "Live Matches", icon: "live" },
    { id: "leagues", label: "Leagues", icon: "leagues" },
    { id: "fixtures", label: "Fixtures", icon: "fixtures" },
    { id: "stats", label: "Statistics", icon: "stats" }
];


function buildNavigation() {
    nav.innerHTML = NAV_ITEMS.map(function (item) {
        return '<button class="nav-item ' +
            (S.v === item.id ? "on" : "") +
            '" data-a="nav" data-v="' + item.id + '">' +
            ic(item.icon) +
            '<span>' + item.label + '</span>' +
            '</button>';
    }).join("");

    tabbar.innerHTML = NAV_ITEMS.slice(0, 4).map(function (item) {
        return '<button class="tab ' +
            (S.v === item.id ? "on" : "") +
            '" data-a="nav" data-v="' + item.id + '">' +
            ic(item.icon) +
            '<span>' + item.label + '</span>' +
            '</button>';
    }).join("");
}



function navigate(destination) {
    const allowed = NAV_ITEMS.map(function (item) {
        return item.id;
    });

    // Allow the AI Chat page without adding it to the main navigation.
    allowed.push("ai-chat");

    if (!allowed.includes(destination)) {
        destination = "home";
    }

    S.v = destination;

    history.replaceState(
        null,
        "",
        location.pathname + location.search + "#" + destination
    );

    render();
    if (destination === "ai-chat" && S.aiQuestion) {
        const input = document.getElementById("aiChatInput");

        if (input) {
            input.value = S.aiQuestion;
            input.focus();
        }
    }

    if (destination === "live") {
        refreshLive();
    }
}




/* =========================
   12. RENDER MAIN VIEW
   ========================= */


let statsRefreshTimer = null;

async function refreshMatchStatistics() {
    if (S.v !== "stats") return;

    try {
        // Fetch the latest match statistics
        const response = await fetch(
            "http://127.0.0.1:8000/match/stats"
        );

        if (!response.ok) {
            throw new Error("Failed to fetch match statistics");
        }

        const data = await response.json();

        // Update the frontend statistics data
        const m = M[0];

        if (!m) return;

        const h = T[m.h];
        const a = T[m.a];

        matchStats[h.n] = data.home;
        matchStats[a.n] = data.away;

        // Re-render the Statistics page
        if (S.v === "stats") {
            view.innerHTML = statsPage();
            await loadAIInsights();
        }

    } catch (error) {
        console.error(
            "Failed to refresh match statistics:",
            error
        );
    }
}

function startMatchStatisticsRefresh() {
    if (statsRefreshTimer !== null) {
        clearInterval(statsRefreshTimer);
    }

    statsRefreshTimer = setInterval(() => {
        if (S.v === "stats") {
            refreshMatchStatistics();
        } else {
            clearInterval(statsRefreshTimer);
            statsRefreshTimer = null;
        }
    }, 5000);
}

function render() {
    buildNavigation();

    switch (S.v) {
        case "home":
            view.innerHTML = homePage();
            break;

        case "live":
            view.innerHTML = live();
            break;

        case "recent-details":
            view.innerHTML = recentMatchDetailsPage();
            break;

        case "ai-chat":
            view.innerHTML = aiChatPage();
            break;

        case "leagues":
            view.innerHTML = leagues();
            break;

        case "fixtures":
            view.innerHTML = fixturesPage();
            break;

        case "stats":
            view.innerHTML = statsPage();

            loadAIInsights();
            startAIInsightsRefresh();
            startMatchStatisticsRefresh();

            break;

        default:
            view.innerHTML = homePage();
    }

    // Display selected league's teams
    if (S.v === "leagues" && S.lopen) {
        const container = document.getElementById("leagueTeams");

        if (container) {
            container.innerHTML =
                leagueStandingsHTML(S.lopen) +
                leagueTeamsHTML(S.lopen);
        }
    }
}


/* =========================
   13. HOME PAGE
   ========================= */

function leagues() {
    return `
        <div class="ph">
            <h1>Leagues</h1>
            <p>Explore football leagues and discover their teams.</p>
        </div>

       <div class="league-grid">
    ${LEAGUES.map(league => `
        <button
            class="panel league-card"
            data-a="league"
            data-v="${league.id}"
        >
            <span class="league-flag">${league.flag}</span>
            <h2>${esc(league.name)}</h2>
            <p>${esc(league.country)}</p>
            <span class="league-count">
                ${league.teams.length} teams
            </span>
        </button>
    `).join("")}
</div>

<div id="leagueTeams"></div>
    `;
}


function leagueStandingsHTML(leagueId) {
    const league = LEAGUES.find(l => l.id === leagueId);

    if (!league) return "<p>League not found.</p>";

    const standings = [...(DEFAULT_STANDINGS[leagueId] || [])].sort((a, b) => {
        // 1. Highest points first
        if (b.points !== a.points) {
            return b.points - a.points;
        }

        // 2. Highest goal difference first
        if (b.goalDifference !== a.goalDifference) {
            return b.goalDifference - a.goalDifference;
        }

        // 3. Highest goals scored first
        return b.goalsFor - a.goalsFor;
    });

    // Match each standings entry with its team logo in LEAGUES
    const rows = standings.map((team, index) => {
        const teamName = team.team || team.name;

        const leagueTeam = league.teams.find(
            t => t.name.toLowerCase() === teamName.toLowerCase()
        );

        const logo = leagueTeam?.logo || "";

        return `
            <tr>
                <td class="standing-logo">
                    ${logo
                ? `<img src="${logo}" alt="${teamName}"
                                   onerror="this.style.display='none'">`
                : `<span class="no-team-logo">⚽</span>`
            }
                </td>
                <td>${teamName}</td>
                <td>${team.played}</td>
                <td>${team.won}</td>
                <td>${team.drawn}</td>
                <td>${team.lost}</td>
                <td>${team.goalsFor}</td>
                <td>${team.goalsAgainst}</td>
                <td>${team.goalDifference}</td>
                <td><strong>${team.points}</strong></td>
            </tr>
        `;
    }).join("");

    return `
        <section class="league-standings">
            <h2>${league.flag} ${league.name} Standings</h2>

            <div class="standings-table-wrapper">
                <table class="standings-table">
                    <thead>
                        <tr>
                            <th>Logo</th>
                            <th>Club</th>
                            <th>P</th>
                            <th>W</th>
                            <th>D</th>
                            <th>L</th>
                            <th>GF</th>
                            <th>GA</th>
                            <th>GD</th>
                            <th>Pts</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </section>
    `;
}


function leagueTeamsHTML(leagueId) {
    const league = LEAGUES.find(function (item) {
        return item.id === leagueId;
    });

    if (!league) {
        return "<p>League not found.</p>";
    }

    return `
        <section class="panel league-teams-section">
            <div class="panel-h">
                <div>
                    <h2>${esc(league.name)} Teams</h2>
                    <p>${esc(league.country)}</p>
                </div>
                <span>${league.teams.length} Teams</span>
            </div>

            <div class="team-grid">
                ${league.teams.map(function (team) {
        return `
                        <div class="panel league-team-card">
                            <img
                                src="${team.logo}"
                                alt="${esc(team.name)} logo"
                                class="league-team-logo"
                                onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';"
                            >

                            <div class="league-team-fallback"
                                 style="display:none">
                                ${esc(team.name.charAt(0))}
                            </div>

                            <h3>${esc(team.name)}</h3>
                        </div>
                    `;
    }).join("")}
            </div>
        </section>
    `;
}




function homePage() {
    const m = M[0];

    if (!m) {
        return '<div class="ph">' +
            '<h1>GOALKICK</h1>' +
            '<p>Loading your match data...</p>' +
            '</div>';
    }

    const h = T[m.h];
    const a = T[m.a];

    return '<div class="home-layout">' +

        // Main content
        '<div class="home-main">' +

        // Welcome hero + Ask AI
        '<section class="hero">' +
        '<div class="hero-in">' +
        '<span class="hero-label">YOUR INTELLIGENT FOOTBALL COMPANION</span>' +
        '<h1>Welcome to <em>GOALKICK</em></h1>' +
        '<p>Understand the game beyond the scoreboard. Explore leagues, discover teams and players, and get AI-powered football insights.</p>' +

        '<form class="ask" id="homeAskForm">' +
        '<input id="homeAskInput" type="text" placeholder="Ask anything about football..." autocomplete="off">' +
        '<button class="go" type="submit" aria-label="Ask AI">' +
        ic("arrow") +
        '</button>' +
        '</form>' +

        '<div class="chips">' +
        '<button class="chip" type="button" data-question="Analyze the current match">Analyze this match</button>' +
        '<button class="chip" type="button" data-question="Tell me about popular football leagues">Explore leagues</button>' +
        '<button class="chip" type="button" data-question="Tell me about famous football players">Discover players</button>' +
        '</div>' +
        '</div>' +
        '</section>' +

        // Quick Access
        '<section class="panel quick-access-panel">' +
        '<div class="panel-h">' +
        '<h2>Quick Access</h2>' +
        '<span>Explore football</span>' +
        '</div>' +

        '<div class="quick-access-grid">' +

        '<button class="quick-access-card" data-a="nav" data-v="leagues">' +
        '<span class="quick-access-icon">🏆</span>' +
        '<span class="quick-access-title">Leagues</span>' +
        '<span class="quick-access-desc">Explore competitions and standings</span>' +
        '<span class="quick-access-arrow">→</span>' +
        '</button>' +

        '<button class="quick-access-card" data-a="nav" data-v="teams">' +
        '<span class="quick-access-icon">🛡️</span>' +
        '<span class="quick-access-title">Teams</span>' +
        '<span class="quick-access-desc">Discover clubs and their details</span>' +
        '<span class="quick-access-arrow">→</span>' +
        '</button>' +

        '<button class="quick-access-card" data-a="nav" data-v="players">' +
        '<span class="quick-access-icon">⚽</span>' +
        '<span class="quick-access-title">Players</span>' +
        '<span class="quick-access-desc">Explore football players</span>' +
        '<span class="quick-access-arrow">→</span>' +
        '</button>' +


        '<button class="quick-access-card" data-a="nav" data-v="fixtures">' +
        '<span class="quick-access-icon">📅</span>' +
        '<span class="quick-access-title">Fixtures</span>' +
        '<span class="quick-access-desc">Explore upcoming matches and schedules</span>' +
        '<span class="quick-access-arrow">→</span>' +
        '</button>' +


        '</div>' +
        '</section>' +

        '</div>' +

        // Right sidebar
        '<aside class="home-sidebar">' +

        // Live matches
        '<section class="panel">' +
        '<div class="panel-h">' +
        '<h2>Live Matches</h2>' +
        '<span class="live-tag">LIVE</span>' +
        '</div>' +

        '<button class="lm-row" data-a="nav" data-v="live">' +
        '<span class="h">' + esc(h.n) + '</span>' +
        '<span></span>' +
        '<span class="sc">' + m.hs + ' - ' + m.as +
        '<small>' + esc(String(m.min) + '’') + '</small>' +
        '</span>' +
        '<span></span>' +
        '<span class="a">' + esc(a.n) + '</span>' +
        '</button>' +

        '<button class="link" data-a="nav" data-v="live">' +
        'View live match ' + ic("arrow") +
        '</button>' +
        '</section>' +

        // Recent matches
        '<section class="panel recent-match-card" ' +
        'data-a="recent-match-details" role="button" tabindex="0">' +
        '<div class="panel-h">' +
        '<h2>Recent Matches</h2>' +
        '<span class="match-ft">FT</span>' +
        '</div>' +

        '<div class="recent-teams">' +

        // Liverpool FC
        '<div class="recent-team">' +
        crest("Liverpool FC", 32) +
        '<span>Liverpool FC</span>' +
        '<strong>2</strong>' +
        '</div>' +

        // Manchester United
        '<div class="recent-team">' +
        crest("Manchester United", 32) +
        '<span>Manchester United</span>' +
        '<strong>0</strong>' +
        '</div>' +

        '</div>' +

        '<div class="recent-match-footer">' +
        '<span>Premier League · Recently Completed</span>' +
        ic("arrow") +
        '</div>' +
        '</section>'
}


function aiChatPage() {
    return `
        <div class="football-chat-layout">
     
            <!-- MAIN CHAT AREA -->
            <section class="football-chat-content">

                <header class="fc-topbar">
                    <div>
                        <span class="fc-mobile-brand">⚽ GOALKICK</span>
                        <span class="fc-topbar-title">Football Assistant</span>
                    </div>

                    <div class="fc-topbar-badge">
                        <span></span> Football AI
                    </div>
                </header>

                <main class="fc-chat-messages" id="aiChatMessages">

                <div id="fcInitialQuestion" style="display:none"></div>
                    <div class="fc-welcome" id="fcWelcome">

                        <div class="fc-welcome-icon">⚽</div>

                        <div class="fc-welcome-eyebrow">
                            YOUR FOOTBALL COMPANION
                        </div>

                        <h1>
                            Let's talk <span>football.</span>
                        </h1>

                        <p>
                            Understand the game beyond the scoreboard.
                            Explore match intelligence, team performance,
                            tactics and the beautiful game.
                        </p>

                        <div class="fc-prompt-heading">
                            <span>✦</span> What would you like to explore?
                        </div>

                        <div class="fc-prompt-grid">

                            <button class="fc-prompt-card"
                                data-question="Analyze the current match">
                                <span class="fc-prompt-icon">📊</span>
                                <span>
                                    <strong>Analyze this match</strong>
                                    <small>Understand the current game</small>
                                </span>
                                <span class="fc-prompt-arrow">↗</span>
                            </button>

                            <button class="fc-prompt-card"
                                data-question="Compare both teams">
                                <span class="fc-prompt-icon">⚔️</span>
                                <span>
                                    <strong>Compare teams</strong>
                                    <small>Performance, possession and attack</small>
                                </span>
                                <span class="fc-prompt-arrow">↗</span>
                            </button>

                            <button class="fc-prompt-card"
                                data-question="Give me tactical insights">
                                <span class="fc-prompt-icon">🧠</span>
                                <span>
                                    <strong>Tactical intelligence</strong>
                                    <small>Discover strengths and weaknesses</small>
                                </span>
                                <span class="fc-prompt-arrow">↗</span>
                            </button>

                            <button class="fc-prompt-card"
                                data-question="Explain football rules">
                                <span class="fc-prompt-icon">📖</span>
                                <span>
                                    <strong>Learn football</strong>
                                    <small>Rules, tactics and terminology</small>
                                </span>
                                <span class="fc-prompt-arrow">↗</span>
                            </button>

                        </div>
                    </div>

                </main>

                <!-- MESSAGE COMPOSER -->
                <div class="fc-composer-area">

                    <form class="fc-composer" id="aiChatForm">

                        <textarea
                            id="aiChatInput"
                            rows="1"
                            placeholder="Ask GOALKICK anything about football..."
                            aria-label="Message GOALKICK AI"
                        ></textarea>

                        <button type="submit" aria-label="Send message">
                            <span>↑</span>
                        </button>

                    </form>

                    <div class="fc-composer-note">
                        GOALKICK AI can analyze available match data.
                        Responses depend on the rules and data configured.
                    </div>

                </div>

            </section>

        </div>
    `;
}


document.addEventListener("submit", function (event) {
    if (event.target.id !== "homeAskForm") return;

    event.preventDefault();

    const input = document.getElementById("homeAskInput");
    const question = input ? input.value.trim() : "";

    S.aiQuestion = question;
    navigate("ai-chat");
});




// <<====RECENT MATCH DETAILS======>>>

function recentMatchDetailsPage() {
    const match = {
        home: "Liverpool FC",
        away: "Manchester United",
        homeScore: 2,
        awayScore: 0
    };

    const homeLineup = [
        "Alisson Becker",
        "Trent Alexander-Arnold",
        "Virgil van Dijk",
        "Ibrahima Konate",
        "Andy Robertson",
        "Alexis Mac Allister",
        "Ryan Gravenberch",
        "Dominik Szoboszlai",
        "Mohamed Salah",
        "Cody Gakpo",
        "Luis Diaz"
    ];

    const awayLineup = [
        "Andre Onana",
        "Diogo Dalot",
        "Matthijs de Ligt",
        "Lisandro Martinez",
        "Noussair Mazraoui",
        "Casemiro",
        "Bruno Fernandes",
        "Kobbie Mainoo",
        "Marcus Rashford",
        "Rasmus Hojlund",
        "Alejandro Garnacho"
    ];

    const events = [
        {
            minute: 24,
            team: "Liverpool FC",
            player: "Mohamed Salah",
            event: "⚽ Goal",
            description: "Liverpool take the lead!"
        },
        {
            minute: 45,
            team: "Manchester United",
            player: "Bruno Fernandes",
            event: "🟨 Yellow Card",
            description: "Caution for Manchester United."
        },
        {
            minute: 67,
            team: "Liverpool FC",
            player: "Cody Gakpo",
            event: "⚽ Goal",
            description: "Liverpool double their lead!"
        },
        {
            minute: 90,
            team: "Match",
            player: "",
            event: "🏁 Full Time",
            description: "Liverpool win 2–0."
        }
    ];

    const stats = [
        { label: "Possession", home: 58, away: 42, suffix: "%" },
        { label: "Total Shots", home: 16, away: 9 },
        { label: "Shots on Target", home: 7, away: 3 },
        { label: "Completed Passes", home: 486, away: 328 },
        { label: "Pass Accuracy", home: 87, away: 79, suffix: "%" },
        { label: "Corners", home: 8, away: 4 },
        { label: "Fouls", home: 10, away: 14 }
    ];

    function lineupHTML(players) {
        return `
            <ol class="recent-lineup-list">
                ${players.map((player, index) => `
                    <li>
                        <span>${index + 1}</span>
                        <span>${esc(player)}</span>
                    </li>
                `).join("")}
            </ol>
        `;
    }

    function comparisonHTML(stat) {
        const total = Number(stat.home) + Number(stat.away);
        const homeWidth = total ? stat.home / total * 100 : 50;
        const awayWidth = total ? stat.away / total * 100 : 50;

        return `
            <div class="recent-stat-row">
                <div class="recent-stat-values">
                    <strong>${stat.home}${stat.suffix || ""}</strong>
                    <span>${esc(stat.label)}</span>
                    <strong>${stat.away}${stat.suffix || ""}</strong>
                </div>

                <div class="recent-stat-bar">
                    <span style="width:${homeWidth}%"></span>
                    <span style="width:${awayWidth}%"></span>
                </div>
            </div>
        `;
    }

    return `
        <div class="recent-details-page">

            <button class="btn"
                    data-a="nav"
                    data-v="home">
                ← Back to Home
            </button>

            <header class="recent-details-scoreboard">
                <span class="recent-details-competition">
                    PREMIER LEAGUE · FULL TIME
                </span>

                <div class="recent-details-teams">
                    <div>
                        ${crest("Liverpool FC", 64)}
                        <h2>${esc(match.home)}</h2>
                    </div>

                    <div class="recent-details-score">
                        ${match.homeScore}
                        <span>–</span>
                        ${match.awayScore}
                    </div>

                    <div>
                        ${crest("Manchester United", 64)}
                        <h2>${esc(match.away)}</h2>
                    </div>
                </div>

                <p>Simulated match · Final result</p>
            </header>

            <section class="panel recent-details-section">
                <div class="panel-h">
                    <h2>📋 Match Events</h2>
                    <span>FULL TIME</span>
                </div>

                <div class="recent-timeline">
                    ${events.map(event => `
                        <article class="recent-event">
                            <strong>${event.minute}'</strong>

                            <div>
                                <b>${esc(event.event)}</b>
                                <p>${esc(event.description)}</p>
                                <small>
                                    ${esc(event.team)}
                                    ${event.player
            ? " · " + esc(event.player)
            : ""}
                                </small>
                            </div>
                        </article>
                    `).join("")}
                </div>
            </section>

            <section class="recent-details-section">
                <div class="panel-h">
                    <h2>👥 Starting Lineups</h2>
                    <span>4-3-3 · Sample lineups</span>
                </div>

                <div class="recent-lineups-grid">
                    <article class="panel recent-lineup-card">
                        <h3>
                            ${crest("Liverpool FC", 28)}
                            Liverpool FC
                        </h3>
                        ${lineupHTML(homeLineup)}
                    </article>

                    <article class="panel recent-lineup-card">
                        <h3>
                            ${crest("Manchester United", 28)}
                            Manchester United
                        </h3>
                        ${lineupHTML(awayLineup)}
                    </article>
                </div>
            </section>

            <section class="panel recent-details-section">
                <div class="panel-h">
                    <h2>📊 Performance Comparison</h2>
                    <span>Team statistics</span>
                </div>

                <div class="recent-stats-legend">
                    <span>■ Liverpool FC</span>
                    <span>■ Manchester United</span>
                </div>

                ${stats.map(comparisonHTML).join("")}
            </section>

        </div>
    `;
}


/* =========================
   14. LIVE MATCH PAGE
   ========================= */

function live() {
    const m = M[S.mi] || M[0];

    if (!m) {
        return `
            <div class="live-page">
                <div class="ph">
                    <h1>Live Matches</h1>
                    <p>Waiting for match data...</p>
                </div>
            </div>
        `;
    }

    const h = T[m.h];
    const a = T[m.a];

    const isLive = String(m.status).toUpperCase() === "LIVE";

    const latestEvents = [...(m.ev || [])].sort((a, b) => {
        const aMinute = Number(a.minute || 0);
        const bMinute = Number(b.minute || 0);

        const aType = String(a.event || "").toLowerCase();
        const bType = String(b.event || "").toLowerCase();

        // Full Time must always appear first
        if (aType === "full_time" && bType !== "full_time") return -1;
        if (bType === "full_time" && aType !== "full_time") return 1;

        // Latest minute first
        return bMinute - aMinute;
    });


    const latestEventsHTML = latestEvents.length
        ? latestEvents.map(e => {
            const type = String(e.event || e.type || "")
                .toLowerCase()
                .trim()
                .replace(/[\s-]+/g, "_");
            const player = e.player || "Unknown player";
            const team = e.team || "Unknown team";
            const minute = Number(e.minute || 0);

            const icons = {
                goal: "⚽",
                own_goal: "🥅",
                penalty: "⚽",
                shot: "🎯",
                shot_on_target: "🎯",
                shot_off_target: "↗️",
                blocked_shot: "🛡️",
                woodwork: "🥅",
                pass: "➜",
                cross: "↗️",
                tackle: "🛡️",
                interception: "✋",
                possession_change: "🔄",
                corner: "🚩",
                free_kick: "🦵",
                foul: "⚠️",
                yellow_card: "🟨",
                red_card: "🟥",
                substitution: "🔄",
                key_pass: "🎯",
                long_ball: "🚀",
                offside: "🚩",
                var: "📺",
                throw_in: "↔️",
            };

            let detail = e.description || player;

            if (type === "goal") {
                detail = e.description || `GOAL! ${player}`;
            } else if (type === "own_goal") {
                detail = e.description || `OWN GOAL! ${player}`;
            } else if (type === "penalty") {
                detail = e.description || `Penalty awarded to ${team}`;
            } else if (type === "shot" || type === "shot_on_target" || type === "shot_off_target") {
                detail = e.description || `${player} · ${type === "shot_on_target" ? "Shot on target" :
                    type === "shot_off_target" ? "Shot off target" : "Shot"
                    }`;
            } else if (type === "cross") {
                detail = e.description || `${player} · Cross`;
            } else if (type === "corner") {
                detail = e.description || `${team} win a corner`;
            } else if (type === "free_kick" || type === "free kick") {
                detail = e.description || `Free kick awarded to ${team}`;
            } else if (type === "foul") {
                detail = e.description || `${player} commits a foul`;
            } else if (type === "pass") {
                detail = e.description || `${player} · ${e.successful === false ? "Failed pass" : "Successful pass"}`;
            } else if (type === "tackle") {
                detail = e.description || `${player} · ${e.successful === false ? "Unsuccessful tackle" : "Successful tackle"}`;
            } else if (type === "interception") {
                detail = e.description || `${player} · Interception`;
            } else if (type === "possession_change") {
                detail = e.description || `${team} gain possession`;
            } else if (type === "blocked_shot") {
                detail = e.description || `${player} · Blocked shot`;
            } else if (type === "woodwork") {
                detail = e.description || `${player} · Shot hits the woodwork`;
            } else if (type === "yellow_card") {
                detail = e.description || `${player} · Yellow card`;
            } else if (type === "red_card") {
                detail = e.description || `${player} · Red card`;
            } else if (type === "substitution") {
                detail = e.description ||
                    `IN: ${e.player_in || "Unknown player"} · OUT: ${e.player_out || player}`;
            }
            else if (type === "key_pass") {
                detail = e.description || `${player} · Key Pass`;
            }

            else if (type === "long_ball") {
                detail = e.description || `${player} · Long Ball`;
            }

            else if (type === "offside") {
                detail = e.description || `${player} · Offside`;
            }

            else if (type === "var") {
                detail = e.description || "VAR Review";
            }

            else if (type === "free_kick") {
                detail = e.description || `Free kick awarded to ${team}`;
            }

            else if (type === "throw_in") {
                detail = e.description || `Throw-in for ${team}`;
            }

            return `
            <div class="live-event">
                <span class="live-event-minute">${minute}'</span>
                <span class="live-event-icon">${icons[type] || "•"}</span>
                <div class="live-event-info">
                    <strong>${esc(detail)}</strong>
                    <small>${esc(team)}</small>
                </div>
            </div>
        `;
        }).join("")
        : `<div class="empty-state">No events yet</div>`;



    return `
        <div class="live-page">

            <!-- PAGE HEADING -->
            <div class="live-page-heading">
                <div>
                    <div class="live-title">
                        <span class="live-title-icon">◉</span>
                        <h1>Live Matches</h1>
                    </div>

                    <p>
                        Real-time action, scores, and match events.
                    </p>
                </div>

                <div class="live-count">
                    <span class="live-count-dot"></span>
                    ${isLive ? "Live Now" : esc(m.status)}
                    <span class="live-count-divider">·</span>
                    1 match
                </div>
            </div>

            <!-- FEATURED MATCH -->
            <section class="live-featured">

                <div class="live-featured-main">

                    <div class="live-match-meta">
                        <span class="live-badge">
                            <span></span>
                            ${isLive ? "LIVE" : esc(m.status)}
                        </span>

                        <span class="live-league">
                            ⚽ ${esc(m.lg)}
                        </span>
                    </div>

        
<div class="live-scoreboard">

    <div class="live-team">
        ${crest(m.h, 66)}
        <strong>${esc(h.n)}</strong>

        ${goalScorersHTML(h.n, m.ev)}
    </div>

    <div class="live-score">
        <div>
            ${m.hs}
            <span>-</span>
            ${m.as}
        </div>

        <span class="live-minute">
            ${Number(m.min || 0)}'
        </span>
    </div>

    <div class="live-team">
        ${crest(m.a, 66)}
        <strong>${esc(a.n)}</strong>

        ${goalScorersHTML(a.n, m.ev)}
    </div>

</div>

<!-- MATCH SIMULATION CONTROLS -->
<div class="match-controls">
    <div class="match-controls-heading">
        <div>
            <h3>Match Controls</h3>
            <p>Manage your live match simulation</p>
        </div>

        <span class="simulation-mode">
            ⚙ SIMULATION
        </span>
    </div>

    <div class="match-controls-actions">
        <button
            class="match-control-btn start-btn"
            data-a="simulation-control"
            data-control="start">
            <span>▶</span>
            <span>Start</span>
        </button>

        <button
            class="match-control-btn pause-btn"
            data-a="simulation-control"
            data-control="pause">
            <span>Ⅱ</span>
            <span>Pause</span>
        </button>

        <button
            class="match-control-btn reset-btn"
            data-a="simulation-control"
            data-control="reset">
            <span>↻</span>
            <span>Reset</span>
        </button>

        <button
            class="match-control-btn speed-btn"
            data-a="simulation-control"
            data-control="speed">
            <span>⏩</span>
            <span>Speed Up</span>
        </button>
    </div>

    <div class="match-controls-footer">
        <span class="control-status-dot"></span>
        <span id="simulationControlStatus">
            Ready to control the simulation
        </span>
        <span class="simulation-speed-label" id="simulationSpeedLabel">
            1× Speed
        </span>
    </div>
</div>



                    <div class="live-featured-footer">
                        <span>
                            ${isLive ? "● Match in progress" : "Match status"}
                        </span>

  <button
    class="live-full-btn"
    data-a="full-match-statistics">
    Full Match Statistics ${ic("arrow")}
</button>

                    </div>

                </div>

                <!-- LATEST EVENTS -->
                <div class="live-events-panel">

                    <div class="live-panel-heading">
                        <h2>Latest Events</h2>
                        <span>${latestEvents.length} events</span>
                    </div>

                    <div class="live-events-list">
                        ${latestEventsHTML}
                    </div>

                </div>

            </section>

            <!-- MATCH CENTER -->
            <div class="live-section-heading">
                <div>
                    <h2>Match Center</h2>
                    <p>Follow the action as the match progresses.</p>
                </div>

                <span class="live-center-status">
                    ${isLive ? "LIVE UPDATES" : "MATCH DETAILS"}
                </span>
            </div>
<div class="live-center-grid tactical-match-center">


<!-- BARCELONA LINEUP -->
${renderTacticalLineup(h.n, "home")}

<!-- CENTRAL PERFORMANCE COMPARISON -->
<section class="panel tactical-comparison">
    <div class="panel-h">
        <h2>Match Intelligence</h2>
        <span class="live-mini-tag">
            ${isLive ? "LIVE" : esc(m.status)}
        </span>
    </div>

    <div class="tactical-score">
        <span>${m.hs}</span>
        <span class="tactical-score-divider">:</span>
        <span>${m.as}</span>
    </div>

    <p class="tactical-minute">
        ${Number(m.min || 0)}' · ${isLive ? "Match in progress" : esc(m.status)}
    </p>

    <div class="tactical-stat">
        <div class="tactical-stat-labels">
            <span>Possession</span>
            <strong>Possession</strong>
            <span>Possession</span>
        </div>
        <div class="tactical-stat-bar">
            <span style="width:${Number(matchStats[h.n]?.possession ?? 50)}%"></span>
        </div>
        <div class="tactical-stat-values">
            <strong>${Number(matchStats[h.n]?.possession ?? 50)}%</strong>
            <strong>${Number(matchStats[a.n]?.possession ?? 50)}%</strong>
        </div>
    </div>

    <div class="tactical-stat">
        <div class="tactical-stat-labels">
            <span>Shots</span>
            <strong>Shots</strong>
            <span>Shots</span>
        </div>
        <div class="tactical-stat-values">
            <strong>${Number(matchStats[h.n]?.shots ?? 0)}</strong>
            <strong>${Number(matchStats[a.n]?.shots ?? 0)}</strong>
        </div>
    </div>

    <div class="tactical-stat">
        <div class="tactical-stat-labels">
            <span>Passes</span>
            <strong>Passes</strong>
            <span>Passes</span>
        </div>
        <div class="tactical-stat-values">
            <strong>${Number(matchStats[h.n]?.passes ?? 0)}</strong>
            <strong>${Number(matchStats[a.n]?.passes ?? 0)}</strong>
        </div>
    </div>

    <div class="tactical-stat">
        <div class="tactical-stat-labels">
            <span>Passing accuracy</span>
            <strong>Accuracy</strong>
            <span>Passing accuracy</span>
        </div>
        <div class="tactical-stat-values">
            <strong>${Number(matchStats[h.n]?.pass_accuracy ?? matchStats[h.n]?.passing_accuracy ?? 0)}%</strong>
            <strong>${Number(matchStats[a.n]?.pass_accuracy ?? matchStats[a.n]?.passing_accuracy ?? 0)}%</strong>
        </div>
    </div>

    <div class="tactical-stat">
        <div class="tactical-stat-labels">
            <span>Corners</span>
            <strong>Corners</strong>
            <span>Corners</span>
        </div>
        <div class="tactical-stat-values">
            <strong>${Number(matchStats[h.n]?.corners ?? 0)}</strong>
            <strong>${Number(matchStats[a.n]?.corners ?? 0)}</strong>
        </div>
    </div>

  <button
    class="live-full-btn"
    data-a="full-match-statistics">
    Full Match Statistics ${ic("arrow")}
</button>

    <div class="tactical-ai-summary">
        <span>✦ AI Match Insight</span>
        <p>${esc(matchSummary?.summary || "AI insights will appear as match events become available.")}</p>

        <button
    class="live-full-btn"
    data-a="explore-ai-analysis"
>
    Explore AI Analysis ${ic("arrow")}
</button>

    </div>
</section>

<!-- REAL MADRID LINEUP -->
${renderTacticalLineup(a.n, "away")}


</div>


        </div>
    `;
}

function renderTacticalLineup(teamName, side) {
    const lineup = matchLineups[teamName];


    if (!lineup || !Array.isArray(lineup.starting_xi)) {
        return `
        <div class="tactical-team">
            <h3>${esc(teamName)}</h3>
            <p>Lineup unavailable</p>
        </div>
    `;
    }

    const formation = lineup.formation || "4-3-3";

    const positionOrder = {
        GK: 0,

        LB: 1,
        LWB: 1,
        CB: 2,
        RB: 3,
        RWB: 3,

        CDM: 1,
        CM: 2,
        CAM: 3,
        LM: 1,
        RM: 3,

        LW: 1,
        CF: 2,
        ST: 2,
        RW: 3,
        FW: 2
    };

    const players = lineup.starting_xi;

    const goalkeeper = players.filter(p => p.position === "GK");
    const defenders = players.filter(p =>
        ["LB", "CB", "RB", "LWB", "RWB"].includes(p.position)
    );
    const midfielders = players.filter(p =>
        ["CDM", "CM", "CAM", "LM", "RM"].includes(p.position)
    );
    const forwards = players.filter(p =>
        ["LW", "RW", "ST", "CF", "FW"].includes(p.position)
    );

    const sortPlayers = list => list.sort((a, b) =>
        (positionOrder[a.position] ?? 99) -
        (positionOrder[b.position] ?? 99)
    );

    function playerRow(playersInRow, rowClass) {
        return `
        <div class="tactical-player-row ${rowClass}">
            ${sortPlayers([...playersInRow]).map(player => `
                <div class="tactical-player">
                    <span class="tactical-player-number">
                        ${Number(player.number) || ""}
                    </span>
                    <span class="tactical-player-name">
                        ${esc(player.name || "Unknown")}
                    </span>
                    <small>${esc(player.position || "")}</small>
                </div>
            `).join("")}
        </div>
    `;
    }

    // Home team attacks upward; away team attacks downward.

    // Generate tactical rows according to the selected formation.
    const formationRows = formation
        .split("-")
        .map(Number);

    const outfieldRows = [
        defenders,
        midfielders,
        forwards
    ];

    // Build rows from the formation numbers.
    // For 4-2-3-1: defenders=4, midfielders=2, attacking midfielders=3, striker=1.
    const formationGroups = {};

    if (formation === "4-2-3-1") {
        formationGroups.defenders = defenders;
        formationGroups.midfielders = players.filter(p =>
            ["CDM", "CM"].includes(p.position)
        );
        formationGroups.attackingMidfielders = players.filter(p =>
            ["CAM", "LM", "RM", "LW", "RW"].includes(p.position)
        );
        formationGroups.strikers = players.filter(p =>
            ["ST", "CF", "FW"].includes(p.position)
        );
    }

    const homeRows = formation === "4-2-3-1"
        ? [
            playerRow(goalkeeper, "goalkeeper"),
            playerRow(formationGroups.defenders, "defenders"),
            playerRow(formationGroups.midfielders, "midfielders"),
            playerRow(formationGroups.attackingMidfielders, "attacking-midfielders"),
            playerRow(formationGroups.strikers, "strikers")
        ]
        : [
            playerRow(goalkeeper, "goalkeeper"),
            playerRow(defenders, "defenders"),
            playerRow(midfielders, "midfielders"),
            playerRow(forwards, "forwards")
        ];

    const awayRows = [...homeRows].reverse();

    const rows = side === "away" ? awayRows : homeRows;



    return `
<section class="tactical-team ${side}">

    <div class="tactical-team-heading">
        <h3>${esc(teamName)}</h3>
        <span>${esc(formation)}</span>
    </div>

    <div class="tactical-pitch">
        <div class="tactical-pitch-markings">
            <div class="tactical-center-circle"></div>
            <div class="tactical-center-line"></div>
            <div class="tactical-penalty-box top"></div>
            <div class="tactical-penalty-box bottom"></div>
        </div>

        <div class="tactical-formation">
            ${rows.join("")}
        </div>
    </div>

    <div class="tactical-substitutes">
        <div class="tactical-substitutes-heading">
            <h4>Substitutes</h4>
            <span>${(lineup.substitutes || []).length} players</span>
        </div>

        <div class="tactical-substitutes-list">
            ${(lineup.substitutes || []).map(player => `
                <div class="tactical-substitute-player">
                    <span class="tactical-substitute-number">
                        ${Number(player.number) || "—"}
                    </span>

                    <span class="tactical-substitute-name">
                        ${esc(player.name || "Unknown")}
                    </span>

                    <small>${esc(player.position || "")}</small>
                </div>
            `).join("") || `
                <p class="no-substitutes">No substitutes available</p>
            `}
        </div>
    </div>

</section>`;


}

/* =========================
   15. EVENT FEED
   ========================= */

function eventsHTML(events) {
    if (!events || events.length === 0) {
        return '<div class="empty">' +
            '<p>No events yet.</p>' +
            '<small>Events will appear as the match progresses.</small>' +
            '</div>';
    }


    const icons = {
        goal: "⚽",
        own_goal: "🥅",
        penalty: "⚽",

        shot: "🎯",
        shot_on_target: "🎯",
        shot_off_target: "↗️",
        blocked_shot: "🛡️",
        woodwork: "🥅",

        pass: "⚽",
        cross: "↗️",
        tackle: "🛡️",
        interception: "✋",
        possession_change: "🔄",

        corner: "🚩",
        free_kick: "🦵",
        foul: "⚠️",
        throw_in: "↔️",

        yellow_card: "🟨",
        red_card: "🟥",
        substitution: "🔄",

        kickoff: "🟢",
        half_time: "⏸️",
        full_time: "🏁"
    };


    return [...events]
        .sort((a, b) => Number(b.minute) - Number(a.minute))
        .map(function (e) {
            const minute = Number(e.minute || 0);

            const type = String(e.event || "event")
                .toLowerCase()
                .trim()
                .replace(/[\s-]+/g, "_");

            const team = String(e.team || "Unknown team");
            const player = e.player || "Unknown player";

            let detail = "";

            if (type === "goal") {
                detail = "⚽ " + player;

                if (e.assist) {
                    detail += " · Assist: " + e.assist;
                }
            }

            else if (type === "pass") {
                detail = player + (
                    e.successful
                        ? " · Successful pass"
                        : " · Failed pass"
                );
            }

            else if (type === "tackle") {
                detail = player + (
                    e.successful
                        ? " · Successful tackle"
                        : " · Unsuccessful tackle"
                );
            }

            else if (type === "interception") {
                detail = player + " · Interception";
            }

            else if (
                type === "shot" ||
                type === "shot_on_target" ||
                type === "shot_off_target"
            ) {
                let outcome = e.outcome;


                if (!outcome) {
                    if (type === "shot_on_target") {
                        outcome = "Shot on target";
                    } else if (type === "shot_off_target") {
                        outcome = "Shot off target";
                    } else {
                        outcome = "Shot";
                    }
                }

                detail = player + " · " + outcome;


            }

            else if (type === "corner") {
                detail = e.description || team + " win a corner!";
            }

            else if (type === "free kick") {
                detail = e.description || "Free kick awarded";
            }

            else if (type === "foul") {
                detail = e.description || player + " commits a foul";
            }

            else if (type === "own_goal") {
                detail = e.description || "Own goal by " + player;
            }

            else if (type === "penalty") {
                detail = e.description || "Penalty awarded";
            }

            else if (type === "blocked_shot") {
                detail = player + " · Blocked shot";
            }

            else if (type === "woodwork") {
                detail = player + " · Shot hits the woodwork";
            }


            else if (type === "yellow_card") {
                detail = player + " · " +
                    (e.reason || "Yellow card");
            }

            else if (type === "red_card") {
                detail = player + " · " +
                    (e.reason || "Red card");
            }

            else if (type === "substitution") {
                detail = "IN: " + (e.player_in || player) +
                    " · OUT: " + (e.player_out || "Unknown player");
            }

            else {
                detail = e.description || player;
            }
            return '<div class="ev">' +
                '<span class="m">' + minute + '’</span>' +

                '<span class="event-icon">' +
                (icons[type] || "•") +
                '</span>' +

                '<span>' +
                '<b style="font-weight:500">' +
                esc(type.replace(/_/g, " ").toUpperCase()) +
                '</b>' +

                '<small>' +
                esc(team + " · " + detail) +
                '</small>' +

                '</span>' +
                '</div>';
        })
        .join("");
}

/* =========================
   16. STATISTICS
   ========================= */

function statRow(label, homeValue, awayValue) {
    const h = Number(homeValue || 0);
    const a = Number(awayValue || 0);
    const total = h + a;

    const homeWidth = total > 0 ? (h / total) * 100 : 50;
    const awayWidth = total > 0 ? (a / total) * 100 : 50;

    return `
        <div class="stat-row">
        <div class="stat-values">
            <strong class="stat-home-value">${h}</strong>
            <span class="stat-label">${esc(label)}</span>
            <strong class="stat-away-value">${a}</strong>
        </div>

        <div class="stat-comparison-bar">
            <span
                class="stat-home-bar"
                style="width:${homeWidth}%">
            </span>

            <span
                class="stat-away-bar"
                style="width:${awayWidth}%">
            </span>
        </div>
    </div >
        `;
}

function matchTimelineHTML(m) {
    const h = T[m.h];
    const a = T[m.a];

    const events = Array.isArray(m.ev) ? m.ev : [];
    const currentMinute = Number(m.min ?? m.minute ?? 0);

    console.log("Timeline events:", events);

    // Normalize event names
    function getType(e) {
        return String(e.event || e.type || "")
            .toLowerCase()
            .trim()
            .replace(/[\s-]+/g, "_");
    }

    // Identify important moments only
    const importantEvents = events.filter(e => {
        const type = getType(e);

        // Always show goals and cards
        if ([
            "goal",
            "yellow_card",
            "red_card",
            "important_tackle",
            "key_tackle",
            "half_time",
            "full_time",
            "ht",
            "ft"
        ].includes(type)) {
            return true;
        }

        // Support ordinary tackles marked as important
        if (
            type === "tackle" &&
            (
                e.is_important === true ||
                e.important === true ||
                e.key_moment === true
            )
        ) {
            return true;
        }

        return false;
    });

    // Build the timeline
    const timeline = [
        {
            event: "kickoff",
            minute: 0,
            team: h.n,
            player: ""
        },
        ...importantEvents
    ];

    // Add half-time once the simulation reaches minute 45
    if (
        currentMinute >= 45 &&
        !timeline.some(e => ["half_time", "ht"].includes(getType(e)))
    ) {
        timeline.push({
            event: "half_time",
            minute: 45,
            team: "",
            player: ""
        });
    }

    // Add full-time when the backend indicates the match has ended
    const finished = [
        "finished",
        "full_time",
        "full-time",
        "ft",
        "completed"
    ].includes(String(m.status || "").toLowerCase());

    if (
        finished &&
        !timeline.some(e => ["full_time", "ft"].includes(getType(e)))
    ) {
        timeline.push({
            event: "full_time",
            minute: 90,
            team: "",
            player: ""
        });
    }

    timeline.sort(
        (x, y) => Number(x.minute || 0) - Number(y.minute || 0)
    );

    const icons = {
        kickoff: "🟢",
        goal: "⚽",
        tackle: "🛡️",
        important_tackle: "🛡️",
        key_tackle: "🛡️",
        yellow_card: "🟨",
        red_card: "🟥",
        half_time: "⏸️",
        ht: "⏸️",
        full_time: "🏁",
        ft: "🏁"
    };

    function title(e) {
        const type = getType(e);

        const titles = {
            kickoff: "Kick-off",
            goal: "GOAL!",
            tackle: "Key Tackle",
            important_tackle: "Key Tackle",
            key_tackle: "Key Tackle",
            yellow_card: "Yellow Card",
            red_card: "Red Card",
            half_time: "Half-time",
            ht: "Half-time",
            full_time: "Full-time",
            ft: "Full-time"
        };

        return titles[type] || type.replace(/_/g, " ");
    }

    return `
        <section class="panel match-timeline-panel">

            <div class="panel-h">
                <div>
                    <h2>Match Timeline</h2>
                    <p class="muted">
                        Goals, cards and decisive defensive moments
                    </p>
                </div>

                <span class="timeline-count">
                    ${timeline.length} moments
                </span>
            </div>

            <div class="timeline-score">
                <span>${crest(m.h, 30)} ${esc(h.n)}</span>
                <strong>${m.hs} - ${m.as}</strong>
                <span>${crest(m.a, 30)} ${esc(a.n)}</span>
            </div>

            <div class="timeline-scroll">
                <div class="timeline-track">

                    ${timeline.map(e => {
        const type = getType(e);

        const minuteLabel =
            ["half_time", "ht"].includes(type)
                ? "HT"
                : ["full_time", "ft"].includes(type)
                    ? "FT"
                    : `${Number(e.minute || 0)}′`;

        const isHome =
            String(e.team || "").toLowerCase() ===
            String(h.n).toLowerCase();

        return `
                            <article class="timeline-event">

                                <span class="timeline-minute">
                                    ${minuteLabel}
                                </span>

                                <span class="timeline-dot ${isHome ? "home-event" : "away-event"
            }">
                                    ${icons[type] || "•"}
                                </span>

                                <div class="timeline-event-info">
                                    <strong>${esc(title(e))}</strong>
                                    <span>${esc(e.team || "")}</span>
                                    <small>${esc(e.player || "")}</small>
                                </div>

                            </article>
                        `;
    }).join("")}

                </div>
            </div>

        </section>
    `;
}

function aiInsightsHTML(insights = []) {
    const icons = {
        attacking_pressure: "🎯",
        defensive_activity: "🛡️",
        finishing_efficiency: "⚽",
        attacking_concern: "⚠️",
        score_summary: "📊"
    };

    if (!insights.length) {
        return `
            <section class="ai-insights-panel" id="ai-match-intelligence-section">
                <div class="ai-insights-heading">
                    <span>🧠</span>
                    <div>
                        <h2>AI Match Intelligence</h2>
                        <p>Analyzing match performance...</p>
                    </div>
                </div>
            </section>
        `;
    }

    return `
        <section class="ai-insights-panel">

            <div class="ai-insights-heading">
                <span class="ai-brain-icon">🧠</span>
                <div>
                    <h2>AI Match Intelligence</h2>
                    <p>Insights derived from match events</p>
                </div>
                <span class="ai-live-badge">AI INSIGHTS</span>
            </div>

            <div class="ai-insights-list">
                ${insights.map(insight => `
                    <article class="ai-insight-card">
                        <span class="ai-insight-icon">
                            ${icons[insight.type] || "💡"}
                        </span>

                        <div class="ai-insight-content">
                            <strong>
                                ${esc(
        (insight.type || "insight")
            .replace(/_/g, " ")
            .replace(/\b\w/g, c => c.toUpperCase())
    )}
                            </strong>

                            <p>${esc(insight.message || "")}</p>

                            ${insight.team ? `
                                <span class="ai-insight-team">
                                    ${esc(insight.team)}
                                </span>
                            ` : ""}
                        </div>
                    </article>
                `).join("")}
            </div>

            <p class="ai-insights-disclaimer">
                Insights are generated from synthetic match data.
            </p>

        </section>
    `;
}


async function fetchAIInsights() {
    try {
        const response = await fetch(
            "http://127.0.0.1:8000/match/insights"
        );

        if (!response.ok) {
            throw new Error(
                `AI insights request failed: ${response.status}`
            );
        }

        const data = await response.json();

        return Array.isArray(data.insights)
            ? data.insights
            : [];

    } catch (error) {
        console.error("Failed to fetch AI insights:", error);
        return [];
    }
}





function statsHTML(m) {
    const h = T[m.h];
    const a = T[m.a];

    const home = matchStats[h.n] || {};
    const away = matchStats[a.n] || {};

    const homePasses = Number(home.successful_passes || 0);
    const awayPasses = Number(away.successful_passes || 0);

    const homeAttempts = Number(home.passes || 0);
    const awayAttempts = Number(away.passes || 0);

    const homeShots = Number(home.shots || 0);
    const awayShots = Number(away.shots || 0);

    const homeGoals = Number(home.goals ?? m.hs ?? 0);
    const awayGoals = Number(away.goals ?? m.as ?? 0);


    const homeCorners = Number(home.corners || 0);
    const awayCorners = Number(away.corners || 0);

    const homePossession = Number(home.possession ?? 0);
    const awayPossession = Number(away.possession ?? 0);

    const homeRedCards = Number(home.red_cards || 0);
    const awayRedCards = Number(away.red_cards || 0);

    const homeYellowCards = Number(home.yellow_cards || 0);
    const awayYellowCards = Number(away.yellow_cards || 0);

    const homeFreeKicks = Number(home.free_kicks ?? 0);
    const awayFreeKicks = Number(away.free_kicks ?? 0);

    const homePenalties = Number(home.penalties || 0);
    const awayPenalties = Number(away.penalties || 0);



    const homeAccuracy = homeAttempts > 0
        ? (homePasses / homeAttempts * 100)
        : 0;

    const awayAccuracy = awayAttempts > 0
        ? (awayPasses / awayAttempts * 100)
        : 0;

    const matchStatus = String(m.status || "LIVE");
    const currentMinute = Number(m.min ?? m.minute ?? 0);

    const metrics = [
        {
            label: "TOTAL SHOTS",
            icon: "🎯",
            home: homeShots,
            away: awayShots
        },
        {
            label: "COMPLETED PASSES",
            icon: "↗",
            home: homePasses,
            away: awayPasses
        },
        {
            label: "PASS ACCURACY",
            icon: "◎",
            home: homeAccuracy.toFixed(1) + "%",
            away: awayAccuracy.toFixed(1) + "%"
        }
    ];

    return `
    <div class="stats-dashboard">

        <section class="stats-scoreboard">
            <div class="stats-match-status">
                <span class="stats-status-dot"></span>
                ${esc(matchStatus)}
                <span>·</span>
                ${currentMinute >= 90 ? "90′" : currentMinute + "′"}
            </div>

            <div class="stats-score-teams">
                <div class="stats-team">
                    ${crest(m.h, 64)}
                    <strong>${esc(h.n)}</strong>
                    <span>HOME</span>
                </div>

                <div class="stats-score-center">
                    <div class="stats-score-number">
                        ${m.hs}
                        <span>:</span>
                        ${m.as}
                    </div>
                    <span class="stats-score-caption">
                        CURRENT SCORE
                    </span>
                </div>

                <div class="stats-team">
                    ${crest(m.a, 64)}
                    <strong>${esc(a.n)}</strong>
                    <span>AWAY</span>
                </div>
            </div>
        </section>

        <section class="stats-metric-grid">
            ${metrics.map(item => `
                <article class="stats-metric-card">
                    <div class="stats-metric-top">
                        <span>${item.icon}</span>
                        <span>${esc(item.label)}</span>
                    </div>

                    <div class="stats-metric-values">
                        <strong>${item.home}</strong>
                        <span>VS</span>
                        <strong>${item.away}</strong>
                    </div>

                    <div class="stats-metric-teams">
                        <span>${esc(h.n)}</span>
                        <span>${esc(a.n)}</span>
                    </div>
                </article>
            `).join("")}
        </section>

        <section class="stats-comparison">
            <div class="stats-section-heading">
                <div>
                    <h2>Performance Comparison</h2>
                    <p>Compare both teams across the match.</p>
                </div>
                <span class="stats-section-icon">◫</span>
            </div>

            ${statRow("Goals", homeGoals, awayGoals)}
            ${statRow("Total Shots", homeShots, awayShots)}
            ${statRow("Pass Attempts", homeAttempts, awayAttempts)}
            ${statRow("Completed Passes", homePasses, awayPasses)}
            ${statRow(
        "Pass Accuracy (%)",
        homeAccuracy.toFixed(1),
        awayAccuracy.toFixed(1)
    )}
   
${statRow("Corners", homeCorners, awayCorners)}

${statRow(
        "Possession (%)",
        homePossession,
        awayPossession
    )}

${statRow("Red Cards", homeRedCards, awayRedCards)}

${statRow("Yellow Cards", homeYellowCards, awayYellowCards)}

${statRow("Free Kicks", homeFreeKicks, awayFreeKicks)}

${statRow("Penalties", homePenalties, awayPenalties)}



                     <p class="stats-data-note">
                Statistics are calculated from synthetic match events.
            </p>
        </section>

        <div id="aiInsightsContainer">
            ${aiInsightsHTML()}
        </div>

    </div>
`;
}


function statsPage() {
    const m = M[0];

    if (!m) {
        return '<div class="ph"><h1>Statistics</h1></div>';
    }

    return '<div class="ph">' +
        '<h1>Match Statistics</h1>' +
        '<p>Statistics from your football simulation.</p>' +
        '</div>' +

        '<section class="panel" id="match-statistics-section">' +
        statsHTML(m) +
        '</section>' +

        matchTimelineHTML(m) +
        '<section class="panel">' +
        '<div class="panel-h"><h2>Match Summary</h2></div>' +
        '<p>' +
        esc(
            matchSummary?.summary ||
            "No summary available yet."
        ) +
        '</p>' +
        '</section>';
}

async function loadAIInsights() {
    const container = document.getElementById("aiInsightsContainer");

    if (!container) return;

    try {
        const insights = await fetchAIInsights();

        // The user may have left the Statistics page
        const currentContainer =
            document.getElementById("aiInsightsContainer");

        if (!currentContainer) return;

        currentContainer.innerHTML = aiInsightsHTML(insights);

    } catch (error) {
        console.error("Failed to load AI insights:", error);
    }
}

let aiInsightsTimer = null;

function startAIInsightsRefresh() {
    // Prevent duplicate timers
    if (aiInsightsTimer !== null) {
        clearInterval(aiInsightsTimer);
    }

    // Refresh every 10 seconds
    aiInsightsTimer = setInterval(() => {
        if (S.v === "stats") {
            loadAIInsights();
        } else {
            clearInterval(aiInsightsTimer);
            aiInsightsTimer = null;
        }
    }, 10000);
}


/* =========================
   18. FIXTURES
   ========================= */


function fixturesPage() {
    const m = M[0];

    // Demo upcoming fixtures
    const upcoming = [
        {
            home: "Manchester City",
            away: "Liverpool FC",
            date: "Tomorrow",
            time: "18:00",
            competition: "Premier League"
        },
        {
            home: "Barcelona FC",
            away: "Atletico Madrid",
            date: "In 2 days",
            time: "20:00",
            competition: "La Liga"
        },
        {
            home: "Manchester United",
            away: "Manchester City",
            date: "In 3 days",
            time: "17:30",
            competition: "Premier League"
        }
    ];

    const recent = {
        home: "Liverpool FC",
        away: "Manchester United",
        homeScore: 2,
        awayScore: 0,
        competition: "Premier League"
    };

    return `
        <div class="ph fixtures-heading">
            <h1>Fixtures & Results</h1>
            <p>Follow live action, upcoming games and completed matches.</p>
        </div>

        <!-- Fixtures summary -->
        <div class="fixtures-overview">
            <article class="panel fixtures-overview-card">
                <span class="fixtures-overview-icon">🔴</span>
                <div>
                    <strong>${m ? "1" : "0"}</strong>
                    <span>Live Match</span>
                </div>
            </article>

            <article class="panel fixtures-overview-card">
                <span class="fixtures-overview-icon">📅</span>
                <div>
                    <strong>${upcoming.length}</strong>
                    <span>Upcoming</span>
                </div>
            </article>

            <article class="panel fixtures-overview-card">
                <span class="fixtures-overview-icon">🏁</span>
                <div>
                    <strong>1</strong>
                    <span>Recent Result</span>
                </div>
            </article>
        </div>

        <!-- Live match -->
        <section class="fixtures-section">
            <div class="fixtures-section-heading">
                <div>
                    <h2>Live Now</h2>
                    <p>Follow the current simulation.</p>
                </div>

                <span class="fixtures-live-badge">
                    <span></span> LIVE
                </span>
            </div>

            ${m ? `
                <article class="panel fixture-card fixture-live-card">
                    <div class="fixture-card-top">
                        <span class="fixture-competition">
                            ${esc("Football AI Simulation")}
                        </span>
                        <span class="fixture-live-minute">
                            ${esc(String(m.min ?? 0))}'
                        </span>
                    </div>

                    <div class="fixture-teams">
                        <div class="fixture-team">
                            ${crest(m.h, 48)}
                            <strong>${esc(T[m.h]?.n || m.h)}</strong>
                            <small>HOME</small>
                        </div>

                        <div class="fixture-score">
                            <strong>${m.hs} - ${m.as}</strong>
                            <span>${esc(m.status || "LIVE")}</span>
                        </div>

                        <div class="fixture-team">
                            ${crest(m.a, 48)}
                            <strong>${esc(T[m.a]?.n || m.a)}</strong>
                            <small>AWAY</small>
                        </div>
                    </div>

                    <button class="btn fixtures-action"
                            data-a="nav"
                            data-v="live">
                        View Live Match →
                    </button>
                </article>
            ` : `
                <article class="panel fixture-card">
                    <p>No live match is available right now.</p>
                </article>
            `}
        </section>

        <!-- Upcoming fixtures -->
        <section class="fixtures-section">
            <div class="fixtures-section-heading">
                <div>
                    <h2>Upcoming Fixtures</h2>
                    <p>Explore the next scheduled demo matches.</p>
                </div>

                <span class="fixtures-count">
                    ${upcoming.length} MATCHES
                </span>
            </div>

            <div class="fixtures-upcoming-grid">
                ${upcoming.map(match => `
                    <article class="panel fixture-card">
                        <div class="fixture-card-top">
                            <span class="fixture-competition">
                                ${esc(match.competition)}
                            </span>
                            <span class="fixture-upcoming-badge">
                                UPCOMING
                            </span>
                        </div>

                        <div class="fixture-teams">
                            <div class="fixture-team">
                                ${crest(match.home, 42)}
                                <strong>${esc(match.home)}</strong>
                            </div>

                            <div class="fixture-vs">VS</div>

                            <div class="fixture-team">
                                ${crest(match.away, 42)}
                                <strong>${esc(match.away)}</strong>
                            </div>
                        </div>

                        <div class="fixture-date">
                            <span>📅 ${esc(match.date)}</span>
                            <span>🕒 ${esc(match.time)}</span>
                        </div>
                    </article>
                `).join("")}
            </div>
        </section>

        <!-- Recent results -->
        <section class="fixtures-section">
            <div class="fixtures-section-heading">
                <div>
                    <h2>Recent Results</h2>
                    <p>Review completed demo matches.</p>
                </div>

                <span class="fixtures-count">FULL TIME</span>
            </div>

            <article class="panel fixture-card fixture-result-card">
                <div class="fixture-card-top">
                    <span class="fixture-competition">
                        ${esc(recent.competition)}
                    </span>
                    <span class="fixture-ft-badge">FT</span>
                </div>

                <div class="fixture-teams">
                    <div class="fixture-team">
                        ${crest(recent.home, 48)}
                        <strong>${esc(recent.home)}</strong>
                    </div>

                    <div class="fixture-score">
                        <strong>
                            ${recent.homeScore} - ${recent.awayScore}
                        </strong>
                        <span>FULL TIME</span>
                    </div>

                    <div class="fixture-team">
                        ${crest(recent.away, 48)}
                        <strong>${esc(recent.away)}</strong>
                    </div>
                </div>

                <button class="btn fixtures-action"
                        data-a="recent-match-details">
                    View Match Details →
                </button>
            </article>
        </section>
    `;
}



/* =========================
   19. BADGES AND CRESTS
   ========================= */

function crest(id, size) {
    const team = T[id] || {
        n: id,
        i: shortName(id),
        c: "#888"
    };

    // Normalize the team name to find its saved logo
    const teamName = String(team.n || id)
        .trim()
        .toLowerCase();

    const logo = CLUB_LOGOS[teamName];

    // Display the actual team logo when available
    if (logo) {
        return `
            <span class="crest"
                  style="width:${size}px;height:${size}px;
                         background:transparent;
                         display:inline-flex;
                         align-items:center;
                         justify-content:center;">
                <img
                    src="${logo}"
                    alt="${esc(team.n || id)} logo"
                    style="width:100%;height:100%;object-fit:contain;"
                    onerror="this.style.display='none';"
                >
            </span>
        `;
    }

    // Fallback for teams without a saved logo
    return `
        <span class="crest"
              style="width:${size}px;height:${size}px;
                     background:${esc(team.c || "#888")};">
            ${esc(team.i || shortName(team.n || id))}
        </span>
    `;
}




/* =========================
   20. NOTICES
   ========================= */

function showNotice(message) {
    console.info("[Football AI]", message);
}

function showGoalNotification(goal, homeTeam, awayTeam, homeScore, awayScore) {
    const oldNotification = document.querySelector(".goal-toast");

    if (oldNotification) {
        oldNotification.remove();
    }

    const toast = document.createElement("div");
    toast.className = "goal-toast";

    toast.innerHTML = `
        <div class="goal-toast-icon">⚽</div>

        <div class="goal-toast-content">
            <strong>GOAL!</strong>

            <div class="goal-toast-player">
                ${esc(goal.player || "Unknown player")}
            </div>

            <div class="goal-toast-details">
                ${esc(goal.team || "Unknown team")}
                · ${Number(goal.minute || 0)}'
            </div>

            <div class="goal-toast-score">
                ${homeScore} - ${awayScore}
            </div>
        </div>

        <button class="goal-toast-close"
                aria-label="Dismiss notification">×</button>
    `;

    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add("show");
    });

    const closeButton = toast.querySelector(".goal-toast-close");

    closeButton.addEventListener("click", () => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 300);
    });

    setTimeout(() => {
        if (toast.isConnected) {
            toast.classList.remove("show");
            setTimeout(() => toast.remove(), 300);
        }
    }, 5000);
}


function openStatisticsAt(targetId) {
    S.v = "stats";
    render();

    // Load AI insights when opening Statistics
    if (typeof loadAIInsights === "function") {
        loadAIInsights();
    }

    // Wait for the page to render before scrolling
    setTimeout(() => {
        const target = document.getElementById(targetId);

        if (target) {
            target.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        } else {
            console.error(
                "Statistics section not found:",
                targetId
            );
        }
    }, 150);
}

/* =========================
   FOOTBALL SIMULATION CONTROLS
   ========================= */

let currentSimulationSpeed = 1;

async function handleSimulationControl(control) {
    const endpoints = {
        start: "/match/start",
        pause: "/match/pause",
        reset: "/match/reset",
        speed: "/match/speed-up"
    };

    const statusLabel = document.getElementById(
        "simulationControlStatus"
    );

    const speedLabel = document.getElementById(
        "simulationSpeedLabel"
    );

    if (!endpoints[control]) {
        console.error("Unknown simulation control:", control);
        return;
    }

    try {
        if (statusLabel) {
            statusLabel.textContent = "Processing...";
        }

        const response = await fetch(
            CONFIG.API_BASE + endpoints[control],
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                }
            }
        );

        const data = await response.json();

        if (!response.ok || data.success === false) {
            throw new Error(
                data.message || "Simulation control failed."
            );
        }

        // Update the selected simulation speed.
        if (typeof data.speed === "number") {
            currentSimulationSpeed = data.speed;
        }

        // Reset frontend goal notifications when resetting.
        if (control === "reset") {
            notifiedGoals.clear();
            previousGoalScore = 0;
            currentSimulationSpeed = 1;
        }

        // Refresh the scorecard, events, and statistics.
        await refreshLive();

        // Update the controls after refreshing the interface.
        const updatedStatus = document.getElementById(
            "simulationControlStatus"
        );

        const updatedSpeed = document.getElementById(
            "simulationSpeedLabel"
        );

        if (updatedStatus) {
            updatedStatus.textContent =
                control === "speed"
                    ? "Speed updated"
                    : data.status || "Ready";
        }

        if (updatedSpeed) {
            updatedSpeed.textContent =
                currentSimulationSpeed + "x";
        }

        console.log("Simulation control successful:", data);

    } catch (error) {
        console.error("Simulation control error:", error);

        if (statusLabel) {
            statusLabel.textContent = "Control failed";
        }

        showNotice(
            "Could not control the match. Check that the backend is running."
        );
    }
}

/* =========================
   21. CLICK HANDLER
   This is what makes navigation work.
   ========================= */

document.addEventListener("click", function (event) {
    const button = event.target.closest("[data-a]");

    if (!button) return;

    const action = button.dataset.a;

    // Handle football simulation controls.
    if (action === "simulation-control") {
        handleSimulationControl(button.dataset.control);
        return;
    }

    if (action === "recent-match-details") {
        S.v = "recent-details";

        history.replaceState(
            null,
            "",
            location.pathname + location.search + "#recent-details"
        );

        render();
        return;
    }

    // Open Statistics and scroll to the full statistics
    if (action === "full-match-statistics") {
        openStatisticsAt("match-statistics-section");
        return;
    }

    // Open Statistics and scroll to AI Match Intelligence
    if (action === "explore-ai-analysis") {
        openStatisticsAt("ai-match-intelligence-section");
        return;
    }

    if (action === "nav") {
        navigate(button.dataset.v);
        return;
    }

    if (action === "mtab") {
        S.mt = button.dataset.t;
        render();

        if (S.mt === "lineups") {
            loadLineups();
        }

        return;
    }

    if (action === "ltab") {
        S.lt = button.dataset.t;
        render();
        return;
    }

    if (action === "match") {
        S.mi = Number(button.dataset.i || 0);
        render();
        return;
    }

    if (action === "league") {
        console.log("Clicked league:", button.dataset.v);

        S.lopen = button.dataset.v;

        const container = document.getElementById("leagueTeams");

        if (container) {
            const standingsHTML = leagueStandingsHTML(S.lopen);
            const teamsHTML = leagueTeamsHTML(S.lopen);

            container.innerHTML = standingsHTML + teamsHTML;

            console.log("Standings and teams rendered!");
        } else {
            console.log("League container not found!");
        }

        return;


    }

});


/* =========================
   22. HANDLE URL HASH
   Supports #home, #live, etc.
   ========================= */

function readHash() {
    const destination = location.hash.replace("#", "");

    const allowed = NAV_ITEMS.map(function (item) {
        return item.id;
    });

    if (allowed.includes(destination)) {
        S.v = destination;
    } else {
        S.v = "home";
    }
}


window.addEventListener("hashchange", function () {
    readHash();
    render();
});


/* =========================
   23. START APPLICATION
   ========================= */

async function startApp() {
    readHash();

    loadSampleData();

    render();

    await loadData();
    updateStatsFromBackend();
    render();
    render();

    if (refreshTimer) {
        clearInterval(refreshTimer);
    }

    refreshTimer = setInterval(function () {
        refreshLive();
    }, CONFIG.REFRESH_INTERVAL);
}


startApp();

async function loadLineups(teamName = "Barcelona FC") {
    const container = document.getElementById("lineups-container");

    if (!container) return;

    container.innerHTML = '<p class="muted">Loading lineups...</p>';

    try {
        const response = await fetch(
            `${CONFIG.API_BASE}/lineups/${encodeURIComponent(teamName)}`
        );

        if (!response.ok) {
            throw new Error("Failed to load lineup data");
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        container.innerHTML = `
    <div class="lineup-header">
        <div class="club-info">
    <img
        src="${getClubLogo(data.team)}"
        alt="${data.team} logo"
        class="club-logo"
        onerror="this.onerror=null;this.src=DEFAULT_CLUB_LOGO"
    >

    <h3>${data.team}</h3>
</div>

        <select id="lineup-team-select">
            <option value="Barcelona FC"
                ${data.team === "Barcelona FC" ? "selected" : ""}>
                Barcelona FC
            </option>

            <option value="Real Madrid"
                ${data.team === "Real Madrid" ? "selected" : ""}>
                Real Madrid
            </option>
        </select>
    </div>

    <p>Formation: ${data.formation}</p>

 <h4>Starting XI</h4>

<div class="football-pitch">
    <div class="pitch-line halfway-line"></div>
    <div class="center-circle"></div>
    <div class="center-spot"></div>

    <div class="penalty-box penalty-top"></div>
    <div class="penalty-box penalty-bottom"></div>

    <div class="goal goal-top"></div>
    <div class="goal goal-bottom"></div>

    <div class="pitch-players">

       ${(() => {
                const formation = {
                    GK: [
                        { x: 50, y: 92 }
                    ],

                    DEF: [
                        { x: 20, y: 75 },
                        { x: 40, y: 78 },
                        { x: 60, y: 78 },
                        { x: 80, y: 75 }
                    ],

                    MID: [
                        { x: 25, y: 55 },
                        { x: 50, y: 60 },
                        { x: 75, y: 55 }
                    ],

                    FWD: [
                        { x: 20, y: 25 },
                        { x: 50, y: 20 },
                        { x: 80, y: 25 }
                    ]
                };

                const positionMap = {
                    GK: "GK",

                    LB: "DEF",
                    RB: "DEF",
                    CB: "DEF",
                    LWB: "DEF",
                    RWB: "DEF",

                    CDM: "MID",
                    CM: "MID",
                    CAM: "MID",
                    LM: "MID",
                    RM: "MID",

                    LW: "FWD",
                    RW: "FWD",
                    ST: "FWD",
                    CF: "FWD"
                };
                const counters = { GK: 0, DEF: 0, MID: 0, FWD: 0 };

                return data.starting_xi.map(player => {
                    const originalPosition = String(player.position)
                        .toUpperCase()
                        .trim();

                    const role = positionMap[originalPosition] || "MID";

                    const positions = formation[role];
                    const index = counters[role] || 0;

                    counters[role] = index + 1;

                    const position = positions[index % positions.length];

                    return `
            <div
                class="pitch-player"
                style="left:${position.x}%;top:${position.y}%"
                title="${player.name} — ${player.position}"
            >
                <span class="pitch-shirt">${player.number}</span>
                <span class="pitch-player-name">${player.name}</span>
            </div>
        `;
                }).join("");
            })()}


    </div>
</div>

            <h4>Substitutes</h4>
            <div class="lineup-players">
                ${data.substitutes.map(player => `
                    <div class="lineup-player">
                        <span class="shirt-number">${player.number}</span>
                        <span>${player.name}</span>
                        <small>${player.position}</small>
                    </div>
                `).join("")}
            </div>
        `;

    } catch (error) {
        console.error("Lineup error:", error);

        container.innerHTML =
            '<p class="muted">Could not load lineups. Check your FastAPI server.</p>';
    }

    document.addEventListener("change", function (event) {
        if (event.target.id === "lineup-team-select") {
            loadLineups(event.target.value);
        }
    });

}

function getClubLogo(clubName) {
    const name = String(clubName || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");

    return CLUB_LOGOS[name] || DEFAULT_CLUB_LOGO;
}


document.addEventListener("submit", async function (event) {
    if (event.target.id !== "aiChatForm") return;

    event.preventDefault();

    const input = document.getElementById("aiChatInput");
    const question = input ? input.value.trim() : "";

    if (!question) return;

    const messages = document.getElementById("aiChatMessages");
    const welcome = document.getElementById("fcWelcome");

    if (welcome) {
        welcome.remove();
    }

    const userMessage = document.createElement("div");
    userMessage.className = "fc-user-message";
    userMessage.textContent = question;

    messages.appendChild(userMessage);

    // Send the question to the FastAPI backend
    const aiMessage = document.createElement("div");
    aiMessage.className = "fc-ai-message";
    aiMessage.textContent = "GOALKICK AI is thinking...";

    messages.appendChild(aiMessage);

    try {
        const response = await fetch("http://127.0.0.1:8000/api/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                question: question,
                conversation_id: aiConversationId
            })
        });

        if (!response.ok) {
            throw new Error(`Backend returned status ${response.status}`);
        }

        const data = await response.json();

        aiMessage.textContent = data.answer || "I couldn't generate an answer.";
    } catch (error) {
        console.error("GOALKICK AI error:", error);

        aiMessage.textContent =
            "Sorry, I couldn't connect to GOALKICK AI. Please check that the backend is running.";
    }

    messages.scrollTop = messages.scrollHeight;

    input.value = "";
    input.focus();

    messages.scrollTop = messages.scrollHeight;

    S.aiQuestion = "";
});

document.addEventListener("click", function (event) {
    const card = event.target.closest("[data-question]");

    if (!card) return;

    const question = card.dataset.question;
    const input = document.getElementById("aiChatInput");
    const form = document.getElementById("aiChatForm");

    if (!input || !form) return;

    input.value = question;

    form.requestSubmit();
});

document.addEventListener("keydown", function (event) {
    if (event.target.id !== "aiChatInput") return;
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();

        const form = document.getElementById("aiChatForm");

        if (form) {
            form.requestSubmit();
        }
    }
});
