const express = require("express");
const router = express.Router();
const con = require("./models/db");
const { response } = require("./functions/utils");
const { isAuthenticated, isHavePriv } = require("./functions/middleware");

router.post("/", isAuthenticated, isHavePriv("Admin"), (req, res) => {
    if (!req.body.departmentName) {
        return response(res, 400, false, "Content can not be empty!");
    }

    con.query("INSERT INTO departments (departmentName) VALUES (?)", [req.body.departmentName], (err, result) => {
        if (err) return response(res, 500, false, err.message);
        return response(res, 201, true, "Department created.", { id: result.insertId, departmentName: req.body.departmentName });
    });
});

router.get("/", isAuthenticated, (req, res) => {
    con.query("SELECT * FROM departments", (err, result) => {
        if (err) return response(res, 500, false, err.message);
        return response(res, 200, true, "Departments list.", result);
    });
});

router.get("/:id", isAuthenticated, (req, res) => {
    const id = req.params.id;
    con.query("SELECT * FROM departments WHERE departmentID = ?", [id], (err, result) => {
        if (err) return response(res, 500, false, err.message);
        if (result.length === 0) return response(res, 404, false, "Department not found");
        return response(res, 200, true, "Department details.", result[0]);
    });
});

router.put("/:id", isAuthenticated, isHavePriv("Admin"), (req, res) => {
    const id = req.params.id;
    con.query("UPDATE departments SET departmentName = ? WHERE departmentID = ?", [req.body.departmentName, id], (err, result) => {
        if (err) return response(res, 500, false, err.message);
        return response(res, 200, true, "Department updated successfully.");
    });
});

router.delete("/:id", isAuthenticated, isHavePriv("Admin"), (req, res) => {
    const id = req.params.id;
    con.query("DELETE FROM departments WHERE departmentID = ?", [id], (err, result) => {
        if (err) return response(res, 500, false, err.message);
        return response(res, 200, true, "Department deleted successfully!");
    });
});

module.exports = router;
