const express = require("express");
const router = express.Router();
const axios = require("axios");
const { isAuthenticated } = require("./functions/middleware");
const { RAG_API_URL, INTERNAL_BACKEND_URL } = require("./models/constants");



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
            // Fetch department concurrently if needed (already mostly parallelized in Promise.all below)
            const deptRes = await callInternalAPI(
                `/departments/${userRes.data.departmentID}`, cookies
            ).catch(() => null);
            context.department = deptRes?.data?.departmentName;
        }

        // Parse enrolled courses by grade status
        const groups = groupsRes?.data || [];
        const failGrades = ["FF", "FD"];

        context.completedCourses = groups
            .filter(g => g.grade && g.grade.toUpperCase() !== "PEND" && !failGrades.includes(g.grade.toUpperCase()))
            .map(g => `${g.lessonName} (${g.grade})`);

        context.currentCourses = groups
            .filter(g => !g.grade || g.grade.toUpperCase() === "PEND")
            .map(g => {
                const hoursStr = (g.hours || [])
                    .map(h => `${h.day}. gün ${h.hour}`)
                    .join(", ");
                return `${g.lessonName} - ${g.lessonGroupName}${hoursStr ? ` (Saatler: ${hoursStr})` : ""}`;
            });

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
// Fetch ALL available courses and quotas
// -------------------------------------------------------------------
async function fetchAllCoursesContext(cookies) {
    try {
        const [lessonsRes, groupsRes] = await Promise.all([
            callInternalAPI("/lessons", cookies).catch(() => null),
            callInternalAPI("/lessonGroups", cookies).catch(() => null)
        ]);

        const lessons = lessonsRes?.data || [];
        const groups = groupsRes?.data || [];

        if (lessons.length === 0 || groups.length === 0) return null;

        // Create a map of lessonID -> lessonName
        const lessonMap = {};
        lessons.forEach(l => {
            lessonMap[l.lessonID] = l.lessonName;
        });

        const allGroups = [];

        groups.forEach(g => {
            const lessonName = lessonMap[g.lessonID];
            if (!lessonName) return; // Skip if group belongs to a lesson not in this department/list

            const hours = (g.hours || [])
                .map(h => `${h.day}. gün ${h.hour} (${h.room || "?"})`)
                .join(", ");
            const quota = g.maxNumber != null ? g.maxNumber : "Sınırsız";
            
            allGroups.push(
                `Ders: ${lessonName} | Grup: ${g.lessonGroupName} | Kontenjan: ${quota}${hours ? ` | Saatler: ${hours}` : ""}`
            );
        });

        return allGroups.length > 0 ? `BÖLÜMDEKİ AÇIK DERSLER VE KONTENJANLAR:\n${allGroups.join("\n")}` : null;
    } catch (err) {
        console.error("All courses context fetch error:", err.message);
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

    const requestStartTime = Date.now();
    try {
        // ── Step 1: Fetch dynamic context ──
        const contextStartTime = Date.now();
        
        console.log(`[AI-DEBUG] Starting context fetch for user ${req.user.id}.`);

        const [studentContext, coursesContext] = await Promise.all([
            fetchStudentContext(req.user.id, req.cookies),
            fetchAllCoursesContext(req.cookies)
        ]);

        const externalContext = [studentContext, coursesContext].filter(Boolean).join("\n\n");
        const contextDuration = Date.now() - contextStartTime;
        
        console.log(`[AI-DEBUG] Context fetch completed in ${contextDuration}ms. Length: ${externalContext.length} chars`);

        // ── Step 2: Call the specialized AI service (Request Stream) ──
        console.log(`[AI] Requesting stream for: "${question.substring(0, 50)}${question.length > 50 ? '...' : ''}"`);
        const aiCallStartTime = Date.now();
        
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
        console.log(`[AI] Stream connection established in ${Date.now() - aiCallStartTime}ms`);

        // ── Step 3: Pipe the AI stream to our client ──
        let totalChunks = 0;
        let firstTokenTime = null;

        aiRes.data.on('data', (chunk) => {
            if (!firstTokenTime) {
                firstTokenTime = Date.now();
                console.log(`[AI-DEBUG] Time to first token: ${firstTokenTime - aiCallStartTime}ms`);
            }
            totalChunks++;
            res.write(chunk);
        });

        aiRes.data.on('end', () => {
            const totalDuration = Date.now() - requestStartTime;
            console.log(`[AI-DEBUG] Stream finished. Total chunks: ${totalChunks}, Total duration: ${totalDuration}ms`);
            res.end();
        });

        aiRes.data.on('error', (err) => {
            console.error(`[AI-ERROR] Stream Error after ${Date.now() - requestStartTime}ms:`, err.message);
            res.end();
        });

    } catch (error) {
        const errorDuration = Date.now() - requestStartTime;
        console.error(`[AI-ERROR] Bridge failed after ${errorDuration}ms:`, error.message);
        if (error.response) {
            console.error(`[AI-ERROR] Response data:`, error.response.data);
            console.error(`[AI-ERROR] Status:`, error.response.status);
        }
        res.write(JSON.stringify({ success: false, message: "Yapay zeka sunucusuyla iletişim kurulamadı.", error: error.message }));
        res.end();
    }
});

module.exports = router;