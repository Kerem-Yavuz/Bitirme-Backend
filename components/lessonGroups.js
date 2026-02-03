const express = require("express");
const router = express.Router();
const con = require("./models/db");
const { isAuthenticated, isHavePriv } = require("./functions/middleware");
const { response } = require("./functions/utils");

// Create Group (Admin)
router.post("/", isAuthenticated, isHavePriv("Admin"), (req, res) => {
    const { lessonGroupName, lessonID, maxNumber, lessonDesc, hour, day } = req.body;
    if (!lessonGroupName || !lessonID) {
        return response(res, 400, false, "Group Name and Lesson ID are required.");
    }

    con.query("INSERT INTO lesson_groups (lessonGroupName, lessonID) VALUES (?, ?)", [lessonGroupName, lessonID], (err, result) => {
        if (err) return response(res, 500, false, err.message);
        const groupID = result.insertId;

        if (maxNumber) {
            con.query("INSERT INTO lesson_group_details (lessonGroupID, maxNumber, lessonDesc, hour, day) VALUES (?, ?, ?, ?, ?)",
                [groupID, maxNumber, lessonDesc, hour, day], (errDetail, resDetail) => {
                    if (errDetail) return response(res, 500, false, errDetail.message);
                    return response(res, 201, true, "Lesson Group created.", { id: groupID, ...req.body });
                });
        } else {
            return response(res, 201, true, "Lesson Group created.", { id: groupID, ...req.body });
        }
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

// Get Groups for a Lesson
router.get("/", isAuthenticated, (req, res) => {
    const { lessonID } = req.query;

    let query = "SELECT lg.*, lgd.maxNumber, lgd.lessonDesc, lgd.hour, lgd.day FROM lesson_groups lg LEFT JOIN lesson_group_details lgd ON lg.lessonGroupID = lgd.lessonGroupID";
    let params = [];

    if (lessonID) {
        query += " WHERE lg.lessonID = ?";
        params.push(lessonID);
    }

    con.query(query, params, (err, result) => {
        if (err) return response(res, 500, false, err.message);
        return response(res, 200, true, "Lesson Groups list.", result);
    });
});

module.exports = router;
