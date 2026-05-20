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

// Helper: Detect semester type dynamically from current date
function getCurrentSemesterType() {
    const month = new Date().getMonth() + 1; // 1-indexed (1: Jan, 12: Dec)
    // Spring (Bahar): February (2) to July (7) inclusive
    // Fall (Güz): August (8) to January (1) inclusive
    return (month >= 2 && month <= 7) ? "Bahar" : "Güz";
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

        const semesterType = getCurrentSemesterType();
        const isActiveSemesterCourse = (semesterNo) => {
            if (!semesterNo) return false;
            if (semesterType === "Bahar") {
                return semesterNo % 2 === 0; // Even semesters are Spring
            } else {
                return semesterNo % 2 !== 0; // Odd semesters are Fall
            }
        };

        // Create a map of lessonID -> lesson object
        const lessonMap = {};
        const activeLessons = [];
        const passiveLessons = [];

        lessons.forEach(l => {
            lessonMap[l.lessonID] = l;
            if (isActiveSemesterCourse(l.semesterNo)) {
                activeLessons.push(`${l.lessonName} (${l.semesterNo}. Dönem)`);
            } else {
                passiveLessons.push(`${l.lessonName} (${l.semesterNo}. Dönem)`);
            }
        });

        const allGroups = [];

        groups.forEach(g => {
            const lesson = lessonMap[g.lessonID];
            if (!lesson) return; // Skip if group belongs to a lesson not in this department/list

            // Only allow active semester's courses
            if (!isActiveSemesterCourse(lesson.semesterNo)) return;

            const hours = (g.hours || [])
                .map(h => `${h.day}. gün ${h.hour} (${h.room || "?"})`)
                .join(", ");
            const quota = g.maxNumber != null ? g.maxNumber : "Sınırsız";
            
            allGroups.push(
                `Ders: ${lesson.lessonName} | Grup: ${g.lessonGroupName} | Kontenjan: ${quota}${hours ? ` | Saatler: ${hours}` : ""}`
            );
        });

        let contextParts = [];
        contextParts.push(`ŞU ANKİ AKTİF DÖNEM: ${semesterType} Dönemi`);
        contextParts.push(`Şu an sadece ${semesterType} dönemi dersleri alınabilir.`);

        if (activeLessons.length > 0) {
            contextParts.push(`AKTİF ${semesterType.toUpperCase()} DÖNEMİ DERSLERİ (Şu an alınabilir):\n${activeLessons.map(name => `- ${name}`).join("\n")}`);
        }

        const passiveSemesterType = semesterType === "Bahar" ? "Güz" : "Bahar";
        if (passiveLessons.length > 0) {
            contextParts.push(`PASİF ${passiveSemesterType.toUpperCase()} DÖNEMİ DERSLERİ (Şu an ALINAMAZ, ${passiveSemesterType} döneminde açılır):\n${passiveLessons.map(name => `- ${name}`).join("\n")}`);
        }

        if (allGroups.length > 0) {
            contextParts.push(`ŞU AN AÇILAN AKTİF DERS GRUPLARI VE KONTENJANLAR:\n${allGroups.join("\n")}`);
        }

        return contextParts.join("\n\n");
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