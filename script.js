document.addEventListener("DOMContentLoaded", () => {
    const dropZone = document.getElementById("drop-zone");
    const fileInput = document.getElementById("file-input");
    const infoContainer = document.getElementById("info");
    const statsContainer = document.getElementById("stats");
    const chartsContainer = document.getElementById("charts");
    const userSelect = document.getElementById("user-select");

    let globalMessages = [];
    let globalStats = {};

    dropZone.addEventListener("click", () => fileInput.click());

    dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZone.classList.add("hover");
    });

    dropZone.addEventListener("dragleave", () => {
        dropZone.classList.remove("hover");
    });

    dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.classList.remove("hover");
        const files = e.dataTransfer.files;
        if (files.length) {
            handleFile(files[0]);
        }
    });

    fileInput.addEventListener("change", () => {
        if (fileInput.files.length) {
            handleFile(fileInput.files[0]);
        }
    });

    function handleFile(file) {
        // Reset the page
        resetPage();
    
        if (file.name.endsWith('.zip')) {
            handleZipFile(file);
        } else {
            readTextFile(file);
        }
    }

    function resetPage() {
        // Clear previous data from containers
        infoContainer.classList.add("hidden");
        statsContainer.classList.add("hidden");
        chartsContainer.classList.add("hidden");
    
        // Clear global variables
        globalMessages = [];
        globalStats = {};
    
        // Clear user select dropdown
        userSelect.innerHTML = '<option value="all">All Users</option>';
    
        // Clear any generated content
        clearCharts();
    }
    
    function clearCharts() {
        // Destroy existing charts if any (you might need to store chart instances globally to do this)
        const chartIds = ["messages-per-hour", "messages-per-date", "messages-per-day", "messages-by-author"];
        chartIds.forEach(id => {
            const canvas = document.getElementById(id);
            if (canvas && canvas.chart) {
                canvas.chart.destroy();
            }
        });
    }

    
    function handleZipFile(file) {
        const zip = new JSZip();
        zip.loadAsync(file)
            .then(function(zip) {
                let processedFiles = 0;
                let totalFiles = Object.keys(zip.files).length;
                zip.forEach(function (relativePath, zipEntry) {
                    if (!zipEntry.dir) {
                        zipEntry.async("string").then(function(content) {
                            analyzeChat(content);
                            processedFiles++;
                            if (processedFiles === totalFiles) {
                                console.log("All files in the zip have been processed");
                            }
                        });
                    } else {
                        totalFiles--;
                    }
                });
            });
    }
    
    function readTextFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const chatData = e.target.result;
            analyzeChat(chatData);
        };
        reader.readAsText(file);
    }

    function analyzeChat(data) {
        globalMessages = parseChatData(data);
        globalStats = calculateStats(globalMessages);
        displayInfo(globalStats);
        displayStats(globalStats, "all");
        generateCharts(globalMessages, globalStats.users);
        populateUserSelect(globalStats.users);
    }

    function parseChatData(data) {
        const lines = data.split("\n");
        const messages = lines.map(line => {
            const parts = line.split(" - ");
            if (parts.length < 2) return null;
            const [date, message] = parts;
            const messageParts = message.split(": ");
            if (messageParts.length < 2) return null;
            const [user, text] = messageParts;
            return { date, user, text };
        }).filter(message => message !== null);
        return messages;
    }

    function parseDate(dateStr) {
        let [day, month, year] = dateStr.split(".");
        day = parseInt(day);
        month = parseInt(month) - 1;
        year = parseInt(year);
        return new Date(year, month, day);
    }

    function parseHour(timeString) {
        // Split the string by the colon
        const timeParts = timeString.split(":");
    
        // Convert the parts to integers
        const hour = parseInt(timeParts[0], 10);
        const minute = parseInt(timeParts[1], 10);
    
        // Return an object with hour and minute
        return hour * 60 + minute;
    }


    function calculateStats(messages) {
        const users = {};
        let totalMessages = 0;
        let firstDate = parseDate(messages[0].date.split(", ")[0]);
        let lastDate = parseDate(messages[messages.length - 1].date.split(", ")[0]);
        let mostUsedEmoticons = {};
        let mostSentLinks = {};
        let sentWords = 0;
        let vocabulary = new Set();
        const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;


        messages.forEach(message => {
            totalMessages++;
            if (!users[message.user]) {
                users[message.user] = { 
                    count: 0, 
                    messages: [],
                    emojiCount: 0,
                    wordCount: 0,
                    mostUsedEmoticons: {},
                    mostSentLinks: {},
                    sentWords: 0,
                    vocabulary: new Set()
                };
            }
            users[message.user].count++;
            users[message.user].messages.push(message);

            // Count emojis
            const emojis = message.text.match(emojiRegex) || [];
            users[message.user].emojiCount += emojis.length;
            emojis.forEach(emoji => {
                if (!mostUsedEmoticons[emoji]) mostUsedEmoticons[emoji] = 0;
                mostUsedEmoticons[emoji]++;
                if (!users[message.user].mostUsedEmoticons[emoji]) users[message.user].mostUsedEmoticons[emoji] = 0;
                users[message.user].mostUsedEmoticons[emoji]++;
            });
    

            // Count links
            const links = message.text.match(/https?:\/\/[^\s]+/g) || [];
            links.forEach(link => {
                const domain = new URL(link).hostname;
                if (!mostSentLinks[domain]) mostSentLinks[domain] = 0;
                mostSentLinks[domain]++;
                if (!users[message.user].mostSentLinks[domain]) users[message.user].mostSentLinks[domain] = 0;
                users[message.user].mostSentLinks[domain]++;
            });

            // Count words
            const words = message.text.toLowerCase().split(/\s+/).filter(word => word.length > 0);
            sentWords += words.length;
            users[message.user].sentWords += words.length;
            words.forEach(word => {
                vocabulary.add(word);
                users[message.user].vocabulary.add(word);
            });

            // Count emoticons
            const emoticons = message.text.match(/:\)|:\(|:D|:P/g) || [];
            emoticons.forEach(emoticon => {
                if (!mostUsedEmoticons[emoticon]) mostUsedEmoticons[emoticon] = 0;
                mostUsedEmoticons[emoticon]++;
                if (!users[message.user].mostUsedEmoticons[emoticon]) users[message.user].mostUsedEmoticons[emoticon] = 0;
                users[message.user].mostUsedEmoticons[emoticon]++;
            });
        });

        const daysFromBeginning = Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24)) + 1;
        const averageMessagesPerDay = (totalMessages / daysFromBeginning).toFixed(1);

        let mostTalkativeUser = null;
        let nightOwl = null;
        let earlyBird = null;
        let wrecker = null;
        let starter = null;
        let professor = null;
        let longWinded = null;
        let slowest = null;
        let fastest = null;
        let emojiLover = null;
        let annoying = null;

        // Calculate most talkative user
        let maxMessages = 0;
        for (const user in users) {
            if (users[user].count > maxMessages) {
                maxMessages = users[user].count;
                mostTalkativeUser = user;
            }
        }

        // Calculate night owl (messages sent between 12am - 6am)
        let nightOwlMessages = 0;
        for (const user in users) {
            let nightMessages = users[user].messages.filter(message => {
                const hour = parseInt(message.date.split(", ")[1].split(":")[0]);
                return hour >= 0 && hour <= 6;
            }).length;
            if (nightMessages > nightOwlMessages) {
                nightOwlMessages = nightMessages;
                nightOwl = user;
            }
        }

        // Calculate early bird (messages sent between 5am - 9am)
        let earlyBirdMessages = 0;
        for (const user in users) {
            let earlyMessages = users[user].messages.filter(message => {
                const hour = parseInt(message.date.split(", ")[1].split(":")[0]);
                return hour >= 8 && hour < 12;
            }).length;
            if (earlyMessages > earlyBirdMessages) {
                earlyBirdMessages = earlyMessages;
                earlyBird = user;
            }
        }

        // Calculate wrecker (messages that end conversations)
        let maxEndConversations = 0;
        let endConversationsCount = {};

        messages.forEach((msg, index) => {
            const user = msg.user;
            if (index === messages.length - 1 || 
                parseDate(messages[index].date.split(", ")[0]).getDate() !== 
                parseDate(messages[index + 1].date.split(", ")[0]).getDate()) {
                if (!endConversationsCount[user]) endConversationsCount[user] = 0;
                endConversationsCount[user]++;
            }
        });

        for (const user in endConversationsCount) {
            if (endConversationsCount[user] > maxEndConversations) {
                maxEndConversations = endConversationsCount[user];
                wrecker = user;
            }
        }

        // Calculate starter (messages that start conversations)
        let maxStartConversations = 0;
        let startConversationsCount = {};

        messages.forEach((msg, index) => {
            const user = msg.user;
            if (index === 0 || 
                parseDate(messages[index].date.split(", ")[0]).getDate() !== 
                parseDate(messages[index - 1].date.split(", ")[0]).getDate()) {
                if (!startConversationsCount[user]) startConversationsCount[user] = 0;
                startConversationsCount[user]++;
            }
        });

        for (const user in startConversationsCount) {
            if (startConversationsCount[user] > maxStartConversations) {
                maxStartConversations = startConversationsCount[user];
                starter = user;
            }
        }

        // Calculate professor (user who used the greatest amount of words)
        let maxWords = 0;
        for (const user in users) {
            if (users[user].sentWords > maxWords) {
                maxWords = users[user].sentWords;
                professor = user;
            }
        }

        // Calculate long winded (messages that contain more than 100 characters)
        let maxLongMessages = 0;
        for (const user in users) {
            let longMessages = users[user].messages.filter(message => message.text.length > 100).length;
            if (longMessages > maxLongMessages) {
                maxLongMessages = longMessages;
                longWinded = user;
            }
        }

        // Calculate slowest and fastest responders
        let responseTimes = {};

        messages.forEach((msg, index) => {
            if (index > 0) {
                const prevUser = messages[index - 1].user;
                const currUser = msg.user;
                if (prevUser !== currUser) {
                    const prevTime =  parseHour(messages[index - 1].date.split(", ")[1]);
                    const currTime = parseHour(msg.date.split(", ")[1]);
                    const responseTime = currTime - prevTime;
                    if (!responseTimes[currUser]) responseTimes[currUser] = { total: 0, count: 0 };
                    responseTimes[currUser].total += responseTime;
                    responseTimes[currUser].count++;
                }
            }
        });

        let maxAverageResponseTime = 0;
        let minAverageResponseTime = Infinity;

        for (const user in responseTimes) {
            const averageResponseTime = responseTimes[user].total / responseTimes[user].count;
            if (averageResponseTime > maxAverageResponseTime) {
                maxAverageResponseTime = averageResponseTime;
                slowest = user;
            }
            if (averageResponseTime < minAverageResponseTime) {
                minAverageResponseTime = averageResponseTime;
                fastest = user;
            }
        }

        console.log(responseTimes)

        // Determine emoji lover
        let maxEmojiCount = 0;
        for (const user in users) {
            if (users[user].emojiCount > maxEmojiCount) {
                maxEmojiCount = users[user].emojiCount;
                emojiLover = user;
            }
        }

        // Determine most annoying (user with highest message to word ratio)
        let maxRatio = 0;
        for (const user in users) {
            const ratio = users[user].count / (users[user].sentWords || 1);
            if (ratio > maxRatio) {
                maxRatio = ratio;
                annoying = user;
            }
        }

        return {
            totalMessages,
            totalUsers: Object.keys(users).length,
            daysFromBeginning,
            averageMessagesPerDay,
            mostTalkativeUser,
            nightOwl,
            earlyBird,
            wrecker,
            starter,
            professor,
            longWinded,
            slowest,
            fastest,
            emojiLover,
            annoying,
            mostUsedEmoticons,
            mostSentLinks,
            sentWords,
            vocabulary: vocabulary.size,
            users
        };
    }

    function displayInfo(stats) {
        document.querySelector("#total-messages").innerText = stats.totalMessages;
        document.querySelector("#total-users").innerText = stats.totalUsers;
        document.querySelector("#days-from-beginning").innerText = stats.daysFromBeginning;
        document.querySelector("#average-messages-per-day").innerText = stats.averageMessagesPerDay;
        document.querySelector("#most-talkative-user").innerText = `${stats.mostTalkativeUser} (${((stats.users[stats.mostTalkativeUser].count / stats.totalMessages) * 100).toFixed(1)}%)`;
        document.querySelector("#night-owl").innerText = stats.nightOwl;
        document.querySelector("#early-bird").innerText = stats.earlyBird;
        document.querySelector("#wrecker").innerText = stats.wrecker;
        document.querySelector("#starter").innerText = stats.starter;
        document.querySelector("#professor").innerText = stats.professor;
        document.querySelector("#long-winded").innerText = stats.longWinded;
        document.querySelector("#slowest").innerText = stats.slowest;
        document.querySelector("#fastest").innerText = stats.fastest;
        document.querySelector("#emoji-lover").innerText = `${stats.emojiLover} (${stats.users[stats.emojiLover].emojiCount} emojis)`;
        document.querySelector("#annoying").innerText = stats.annoying;
        infoContainer.classList.remove("hidden");
    }

    function displayStats(stats, selectedUser) {
        const userData = selectedUser === "all" ? stats : stats.users[selectedUser];
    
        // Most Used Emojis (top 3)
        const topEmojis = Object.entries(userData.mostUsedEmoticons)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([emoji, count]) => `${emoji} (${count})`)
            .join(', ');
        document.querySelector("#most-used-emoticons").innerText = topEmojis || "No emojis used";
    
        // Most Sent Links (top 3)
        const topLinks = Object.entries(userData.mostSentLinks)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([domain, count]) => `${domain} (${count})`)
            .join(', ');
        document.querySelector("#most-sent-links").innerText = topLinks || "No links sent";
    
        statsContainer.classList.remove("hidden");
    }

    function populateUserSelect(users) {
        userSelect.innerHTML = '<option value="all">All Users</option>';
        for (const user in users) {
            const option = document.createElement("option");
            option.value = user;
            option.textContent = user;
            userSelect.appendChild(option);
        }
        userSelect.addEventListener("change", () => displayStats(globalStats, userSelect.value));
    }

        // Global object to store chart instances
    const charts = {};

    function generateCharts(messages, users) {
        // Messages per hour
        const messagesPerHour = new Array(24).fill(0);
        messages.forEach(message => {
            const hour = parseInt(message.date.split(", ")[1].split(":")[0]);
            messagesPerHour[hour]++;
        });

        // Destroy existing chart if it exists
        if (charts["messages-per-hour"]) {
            charts["messages-per-hour"].destroy();
        }

        charts["messages-per-hour"] = new Chart(document.getElementById("messages-per-hour").getContext("2d"), {
            type: "bar",
            data: {
                labels: Array.from({ length: 24 }, (_, i) => i),
                datasets: [{
                    label: 'Messages per Hour',
                    data: messagesPerHour,
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });

        // Messages per date
        const messagesPerDate = {};
        messages.forEach(message => {
            const date = parseDate(message.date.split(", ")[0]);
            const dateString = date.toISOString().split('T')[0]; // Convert Date to YYYY-MM-DD string for consistent keys
            if (!messagesPerDate[dateString]) messagesPerDate[dateString] = 0;
            messagesPerDate[dateString]++;
        });
        
        // Sort dates and prepare data
        const sortedDates = Object.keys(messagesPerDate).sort((a, b) => new Date(a) - new Date(b));
        const dateData = sortedDates.map(date => messagesPerDate[date]);
        
        console.log(dateData);


        // Destroy existing chart if it exists
        if (charts["messages-per-date"]) {
            charts["messages-per-date"].destroy();
        }

        charts["messages-per-date"] = new Chart(document.getElementById("messages-per-date").getContext("2d"), {
            type: "line",
            data: {
                labels: sortedDates,
                datasets: [{
                    label: 'Messages per Date',
                    data: dateData,
                    backgroundColor: 'rgba(153, 102, 255, 0.2)',
                    borderColor: 'rgba(153, 102, 255, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });

        // Messages per day of the week
        const messagesPerDay = new Array(7).fill(0);
        messages.forEach(message => {
            const date = parseDate(message.date.split(", ")[0]);
            messagesPerDay[date.getDay()]++;
        });

        // Destroy existing chart if it exists
        if (charts["messages-per-day"]) {
            charts["messages-per-day"].destroy();
        }

        charts["messages-per-day"] = new Chart(document.getElementById("messages-per-day").getContext("2d"), {
            type: "bar",
            data: {
                labels: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
                datasets: [{
                    label: 'Messages per Day of the Week',
                    data: messagesPerDay,
                    backgroundColor: 'rgba(255, 159, 64, 0.2)',
                    borderColor: 'rgba(255, 159, 64, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });

        // Messages by Author
        const authorData = Object.entries(users).map(([user, data]) => ({
            user,
            count: data.count,
            percentage: (data.count / messages.length * 100).toFixed(1)
        })).sort((a, b) => b.count - a.count);

        // Destroy existing chart if it exists
        if (charts["messages-by-author"]) {
            charts["messages-by-author"].destroy();
        }

        charts["messages-by-author"] = new Chart(document.getElementById("messages-by-author").getContext("2d"), {
            type: "pie",
            data: {
                labels: authorData.map(d => `${d.user} (${d.percentage}%)`),
                datasets: [{
                    data: authorData.map(d => d.count),
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.8)',
                        'rgba(54, 162, 235, 0.8)',
                        'rgba(255, 206, 86, 0.8)',
                        'rgba(75, 192, 192, 0.8)',
                        'rgba(153, 102, 255, 0.8)',
                        'rgba(255, 159, 64, 0.8)'
                    ]
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'right',
                    }
                }
            }
        });

        chartsContainer.classList.remove("hidden");
    }

    function clearCharts() {
        // Destroy all existing charts
        for (const key in charts) {
            if (charts[key]) {
                charts[key].destroy();
                delete charts[key];
            }
        }
    }
});