const express = require("express");
const router = express.Router();
const axios = require("axios");
const { isAuthenticated } = require("./functions/middleware");
const { RAG_API_URL, INTERNAL_BACKEND_URL } = require("./models/constants");

// ── Keyword-based quota detection ──
const QUOTA_KEYWORDS = /kontenjan|kapasite|doluluk|quota|kişi kayıtlı|yer var mı|dolu mu|boş.{0,10}yer|kayıtlı.{0,10}kişi|kapasitesi/i;

// -------------------------------------------------------------------
// Helper: internal API call (forwards cookies for auth)
// -------------------------------------------------------------------
async function callInternalAPI(path, cookies, method = "get") {
    const cookieHeader = Object.entries(cookies || {})
        .map(([k, v]) => `${k}=${v}`)
        .join("; ");

    const res = await axios({
        method,
        url: `${INTERNAL_BACKEND_URL}${path}`,
        headers: { Cookie: cookieHeader },
        timeout: 8000
    });
    return res.data;
}

// -------------------------------------------------------------------
// Fetch student context: department, completed & current courses
// -------------------------------------------------------------------
async function fetchStudentContext(userID, cookies) {
    try {
        const [userRes, groupsRes] = await Promise.all([
            callInternalAPI(`/users/${userID}`, cookies).catch(() => null),
            callInternalAPI(`/lessonGroups/my`, cookies).catch(() => null)
        ]);

        const context = {};

        // Department name
        if (userRes?.data?.departmentID) {
            try {
                const deptRes = await callInternalAPI(
                    `/departments/${userRes.data.departmentID}`, cookies
                );
                context.department = deptRes?.data?.departmentName;
            } catch { /* non-fatal */ }
        }

        // Parse enrolled courses by grade status
        const groups = groupsRes?.data || [];
        const failGrades = ["FF", "FD"];

        context.completedCourses = groups
            .filter(g => g.grade && g.grade.toUpperCase() !== "PEND" && !failGrades.includes(g.grade.toUpperCase()))
            .map(g => `${g.lessonName} (${g.grade})`);

        context.currentCourses = groups
            .filter(g => !g.grade || g.grade.toUpperCase() === "PEND")
            .map(g => `${g.lessonName} - ${g.lessonGroupName}`);

        context.failedCourses = groups
            .filter(g => g.grade && failGrades.includes(g.grade.toUpperCase()))
            .map(g => `${g.lessonName} (${g.grade})`);

        let contextStr = "ÖĞRENCİ PROFİLİ:";
        if (context.department) contextStr += `\n- Bölüm: ${context.department}`;
        if (context.completedCourses.length) contextStr += `\n- Geçtiği dersler: ${context.completedCourses.join(", ")}`;
        if (context.currentCourses.length) contextStr += `\n- Şu an aldığı dersler: ${context.currentCourses.join(", ")}`;
        if (context.failedCourses.length) contextStr += `\n- Kaldığı dersler: ${context.failedCourses.join(", ")}`;

        return contextStr;
    } catch (err) {
        console.error("Student context fetch error:", err.message);
        return "";
    }
}

// -------------------------------------------------------------------
// Keyword-based quota lookup
// -------------------------------------------------------------------
async function fetchQuotaContext(question, cookies) {
    try {
        const lessonsRes = await callInternalAPI("/lessons", cookies);
        const lessons = lessonsRes?.data || [];

        const questionLower = question.toLowerCase().replace(/ı/g, "i").replace(/ö/g, "o")
            .replace(/ü/g, "u").replace(/ş/g, "s").replace(/ç/g, "c").replace(/ğ/g, "g");

        const matched = lessons.filter(l => {
            const nameLower = (l.lessonName || "").toLowerCase().replace(/ı/g, "i").replace(/ö/g, "o")
                .replace(/ü/g, "u").replace(/ş/g, "s").replace(/ç/g, "c").replace(/ğ/g, "g");
            return questionLower.includes(nameLower) && nameLower.length > 2;
        });

        if (matched.length === 0) return null;

        const allGroups = [];
        for (const lesson of matched.slice(0, 3)) {
            try {
                const groupsRes = await callInternalAPI(
                    `/lessonGroups?lessonID=${lesson.lessonID}`, cookies
                );
                const groups = groupsRes?.data || [];
                groups.forEach(g => {
                    const hours = (g.hours || [])
                        .map(h => `${h.day}. gün ${h.hour} (${h.room || "?"})`)
                        .join(", ");
                    const quota = g.maxNumber != null ? g.maxNumber : "Sınırsız";
                    allGroups.push(
                        `Ders: ${lesson.lessonName} | Grup: ${g.lessonGroupName} | Kontenjan: ${quota}${hours ? ` | Saatler: ${hours}` : ""}`
                    );
                });
            } catch { /* skip */ }
        }

        return allGroups.length > 0 ? `KONTENJAN BİLGİSİ:\n${allGroups.join("\n")}` : null;
    } catch (err) {
        console.error("Quota context fetch error:", err.message);
        return null;
    }
}

// -------------------------------------------------------------------
// POST /api/ai/ask — Delegates to specialized AI service with STREAMING
// -------------------------------------------------------------------
router.post("/ask", isAuthenticated, async (req, res) => {
    const { question } = req.body;

    if (!question || !question.trim()) {
        return res.status(400).json({ success: false, message: "Soru boş olamaz." });
    }

    // Set headers for streaming (SSE)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering for Nginx

    try {
        // ── Step 1: Fetch dynamic context ──
        const needsQuota = QUOTA_KEYWORDS.test(question);
        const [studentContext, quotaContext] = await Promise.all([
            fetchStudentContext(req.user.id, req.cookies),
            needsQuota ? fetchQuotaContext(question, req.cookies) : Promise.resolve(null)
        ]);

        const externalContext = [studentContext, quotaContext].filter(Boolean).join("\n\n");

        // ── Step 2: Call the specialized AI service (Request Stream) ──
        console.log(`[AI] Requesting stream for: "${question}"`);
        const startTime = Date.now();
        
        const aiRes = await axios.post(
            `${RAG_API_URL}/api/ask`,
            { 
                question, 
                external_context: externalContext,
                top_k: 5,
                stream: true 
            },
            { 
                timeout: 60000,
                responseType: 'stream' 
            }
        );
        console.log(`[AI] Stream started in ${Date.now() - startTime}ms`);

        // ── Step 3: Pipe the AI stream to our client ──
        aiRes.data.on('data', (chunk) => {
            res.write(chunk);
        });

        aiRes.data.on('end', () => {
            res.end();
        });

        aiRes.data.on('error', (err) => {
            console.error("Stream Error:", err.message);
            res.end();
        });

    } catch (error) {
        console.error("AI Bridge Error:", error.message);
        res.write(JSON.stringify({ success: false, message: "Yapay zeka sunucusuyla iletişim kurulamadı." }));
        res.end();
    }
});

module.exports = router;