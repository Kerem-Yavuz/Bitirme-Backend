const express = require("express");
const router = express.Router();
const con = require("./models/db");
const { isAuthenticated, isHavePriv } = require("./functions/middleware");
const { response } = require("./functions/utils");

// Helper: Group rows by lessonGroupID and aggregate hours
function groupWithHours(rows) {
    const map = {};
    rows.forEach(row => {
        const gid = row.lessonGroupID;
        if (!map[gid]) {
            map[gid] = {
                lessonGroupID: row.lessonGroupID,
                lessonGroupName: row.lessonGroupName,
                lessonID: row.lessonID,
                maxNumber: row.maxNumber,
                lessonName: row.lessonName,
                semesterNo: row.semesterNo,
                grade: row.grade,
                userLessonGroupID: row.userLessonGroupID,
                hours: []
            };
        }
        if (row.hourID) {
            map[gid].hours.push({
                hourID: row.hourID,
                hour: row.hour,
                day: row.day,
                room: row.room
            });
        }
    });
    return Object.values(map);
}

// Create Group (Admin)
router.post("/", isAuthenticated, isHavePriv("Admin"), (req, res) => {
    const { lessonGroupName, lessonID, maxNumber } = req.body;
    if (!lessonGroupName || !lessonID) {
        return response(res, 400, false, "Group Name and Lesson ID are required.");
    }

    con.query("INSERT INTO lesson_groups (lessonGroupName, lessonID, maxNumber) VALUES (?, ?, ?)",
        [lessonGroupName, lessonID, maxNumber || null], (err, result) => {
            if (err) return response(res, 500, false, err.message);
            return response(res, 201, true, "Lesson Group created.", { id: result.insertId, ...req.body });
        });
});

// Add Hour to Group (Admin)
router.post("/:id/hours", isAuthenticated, isHavePriv("Admin"), (req, res) => {
    const groupID = req.params.id;
    const { hour, day, room } = req.body;

    if (!hour || !day) {
        return response(res, 400, false, "Hour and Day are required.");
    }

    con.query("INSERT INTO lesson_group_hours (lessonGroupID, hour, day, room) VALUES (?, ?, ?, ?)",
        [groupID, hour, day, room || null], (err, result) => {
            if (err) return response(res, 500, false, err.message);
            return response(res, 201, true, "Hour added.", { hourID: result.insertId });
        });
});

// Delete Hour (Admin)
router.delete("/hours/:hourID", isAuthenticated, isHavePriv("Admin"), (req, res) => {
    const hourID = req.params.hourID;
    con.query("DELETE FROM lesson_group_hours WHERE hourID = ?", [hourID], (err, result) => {
        if (err) return response(res, 500, false, err.message);
        return response(res, 200, true, "Hour deleted.");
    });
});

// Register for a Group (Student)
router.post("/register", isAuthenticated, (req, res) => {
    const { lessonGroupID } = req.body;
    const userID = req.user.id;

    if (!lessonGroupID) {
        return response(res, 400, false, "Lesson Group ID is required.");
    }

    con.query("INSERT INTO user_lesson_groups (lessonGroupID, userID, grade) VALUES (?, ?, ?)",
        [lessonGroupID, userID, 'PEND'],
        (err, result) => {
            if (err) return response(res, 500, false, err.message);
            return response(res, 201, true, "Registration request successful.", { id: result.insertId });
        });
});

// Get My Registered Lesson Groups (Authenticated User)
router.get("/my", isAuthenticated, (req, res) => {
    const userID = req.user.id;

    const query = `
        SELECT ulg.userLessonGroupID, ulg.lessonGroupID, ulg.grade,
               lg.lessonGroupName, lg.lessonID, lg.maxNumber,
               lgh.hourID, lgh.hour, lgh.day, lgh.room,
               l.lessonName, l.semesterNo
        FROM user_lesson_groups ulg
        JOIN lesson_groups lg ON ulg.lessonGroupID = lg.lessonGroupID
        LEFT JOIN lesson_group_hours lgh ON lg.lessonGroupID = lgh.lessonGroupID
        LEFT JOIN lessons l ON lg.lessonID = l.lessonID
        WHERE ulg.userID = ?
    `;

    con.query(query, [userID], (err, result) => {
        if (err) return response(res, 500, false, err.message);
        return response(res, 200, true, "User's registered lesson groups.", groupWithHours(result));
    });
});

// Get Groups for a Lesson (with hours)
router.get("/", isAuthenticated, (req, res) => {
    const { lessonID } = req.query;

    let query = `
        SELECT lg.lessonGroupID, lg.lessonGroupName, lg.lessonID, lg.maxNumber,
               lgh.hourID, lgh.hour, lgh.day, lgh.room
        FROM lesson_groups lg
        LEFT JOIN lesson_group_hours lgh ON lg.lessonGroupID = lgh.lessonGroupID
    `;
    let params = [];

    if (lessonID) {
        query += " WHERE lg.lessonID = ?";
        params.push(lessonID);
    }

    query += " ORDER BY lg.lessonGroupID, lgh.day, lgh.hour";

    con.query(query, params, (err, result) => {
        if (err) return response(res, 500, false, err.message);
        return response(res, 200, true, "Lesson Groups list.", groupWithHours(result));
    });
});

// Get Students in a Group (Teacher + Admin)
router.get("/:id/students", isAuthenticated, isHavePriv(), (req, res) => {
    const groupID = req.params.id;
    const callerPrivs = req.user.privs || [];
    const callerID = req.user.id;

    // First get group info
    const groupQuery = `
        SELECT lg.lessonGroupID, lg.lessonGroupName, l.lessonName, l.lessonTeacherID
        FROM lesson_groups lg
        JOIN lessons l ON lg.lessonID = l.lessonID
        WHERE lg.lessonGroupID = ?
    `;

    con.query(groupQuery, [groupID], (err, groupResult) => {
        if (err) return response(res, 500, false, err.message);
        if (groupResult.length === 0) return response(res, 404, false, "Group not found.");

        const group = groupResult[0];

        // Teacher can only see their own lessons' students
        if (!callerPrivs.includes("Admin") && callerPrivs.includes("Teacher")) {
            if (group.lessonTeacherID !== callerID) {
                return response(res, 403, false, "You can only view students in your own lessons.");
            }
        } else if (!callerPrivs.includes("Admin") && !callerPrivs.includes("Teacher")) {
            return response(res, 403, false, "Require Admin or Teacher privilege.");
        }

        // Get students
        const studentsQuery = `
            SELECT ulg.userLessonGroupID, ulg.grade, u.userID, ud.fullName, ud.email, ud.phoneNo
            FROM user_lesson_groups ulg
            JOIN users u ON ulg.userID = u.userID
            LEFT JOIN userDetails ud ON u.userID = ud.userID
            WHERE ulg.lessonGroupID = ?
            ORDER BY ud.fullName
        `;

        con.query(studentsQuery, [groupID], (err2, students) => {
            if (err2) return response(res, 500, false, err2.message);
            return response(res, 200, true, "Students list.", {
                groupInfo: {
                    lessonGroupID: group.lessonGroupID,
                    lessonGroupName: group.lessonGroupName,
                    lessonName: group.lessonName
                },
                students
            });
        });
    });
});

// Update Student Grade (Teacher only — must be their own lesson)
router.put("/:groupId/students/:userId/grade", isAuthenticated, isHavePriv("Teacher"), (req, res) => {
    const { groupId, userId } = req.params;
    const { grade } = req.body;
    const callerID = req.user.id;

    if (!grade) {
        return response(res, 400, false, "Grade is required.");
    }

    // Verify teacher owns this lesson
    const verifyQuery = `
        SELECT l.lessonTeacherID
        FROM lesson_groups lg
        JOIN lessons l ON lg.lessonID = l.lessonID
        WHERE lg.lessonGroupID = ?
    `;

    con.query(verifyQuery, [groupId], (err, verifyResult) => {
        if (err) return response(res, 500, false, err.message);
        if (verifyResult.length === 0) return response(res, 404, false, "Group not found.");
        if (verifyResult[0].lessonTeacherID !== callerID) {
            return response(res, 403, false, "You can only grade students in your own lessons.");
        }

        con.query(
            "UPDATE user_lesson_groups SET grade = ? WHERE lessonGroupID = ? AND userID = ?",
            [grade, groupId, userId],
            (err2, result) => {
                if (err2) return response(res, 500, false, err2.message);
                if (result.affectedRows === 0) return response(res, 404, false, "Student registration not found.");
                return response(res, 200, true, "Grade updated.", { grade });
            }
        );
    });
});

module.exports = router;
