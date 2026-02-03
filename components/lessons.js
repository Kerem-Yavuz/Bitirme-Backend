const express = require("express");
const router = express.Router();
const con = require("./models/db");
const { isAuthenticated, isHavePriv } = require("./functions/middleware");
const { response } = require("./functions/utils");

// Create Lesson (Admin)
router.post("/", isAuthenticated, isHavePriv("Admin"), (req, res) => {
    const { lessonName, lessonTeacherID, departmentID, semesterNo } = req.body;
    if (!lessonName) {
        return response(res, 400, false, "Lesson Name is required.");
    }

    con.query("INSERT INTO lessons (lessonName, lessonTeacherID, departmentID, semesterNo) VALUES (?, ?, ?, ?)",
        [lessonName, lessonTeacherID, departmentID, semesterNo], (err, result) => {
            if (err) return response(res, 500, false, err.message);
            return response(res, 201, true, "Lesson created.", { id: result.insertId, ...req.body });
        });
});

// Get Lessons (Filtered by Semester & Department)
router.get("/", isAuthenticated, (req, res) => {
    const { semesterNo, departmentID } = req.query;
    const userID = req.user.id;

    // Filter logic...
    const getUserDeptQuery = "SELECT departmentID FROM userDetails WHERE userID = ?";

    con.query(getUserDeptQuery, [userID], (err, userRes) => {
        if (err) return response(res, 500, false, err.message);

        let query = "SELECT l.*, d.departmentName FROM lessons l LEFT JOIN departments d ON l.departmentID = d.departmentID WHERE 1=1";
        let params = [];

        if (semesterNo) {
            query += " AND l.semesterNo = ?";
            params.push(semesterNo);
        }

        if (userRes.length > 0 && userRes[0].departmentID) {
            query += " AND l.departmentID = ?";
            params.push(userRes[0].departmentID);
        } else if (departmentID) {
            query += " AND l.departmentID = ?";
            params.push(departmentID);
        }

        con.query(query, params, (err, result) => {
            if (err) return response(res, 500, false, err.message);
            return response(res, 200, true, "Lessons list.", result);
        });
    });
});

router.get("/:id", isAuthenticated, (req, res) => {
    const id = req.params.id;
    con.query("SELECT l.*, d.departmentName FROM lessons l LEFT JOIN departments d ON l.departmentID = d.departmentID WHERE l.lessonID = ?", [id], (err, result) => {
        if (err) return response(res, 500, false, err.message);
        if (result.length === 0) return response(res, 404, false, "Lesson not found");
        return response(res, 200, true, "Lesson details.", result[0]);
    });
});

router.delete("/:id", isAuthenticated, isHavePriv("Admin"), (req, res) => {
    const id = req.params.id;
    con.query("DELETE FROM lessons WHERE lessonID = ?", [id], (err, result) => {
        if (err) return response(res, 500, false, err.message);
        return response(res, 200, true, "Lesson deleted successfully!");
    });
});

module.exports = router;
